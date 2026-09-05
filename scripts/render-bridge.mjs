#!/usr/bin/env node
/**
 * Local render bridge -- the missing link between the "Generate
 * Photorealistic Render" button and the already-working Blender/Cycles
 * pipeline in rendering/blender/. The browser cannot spawn a `blender`
 * process itself, so this small standalone Node server does it on the
 * developer's own machine:
 *
 *   POST   /render            -> { jobId }            (writes config.json, spawns Blender)
 *   GET    /render/:id        -> { status, progress, error }
 *   GET    /render/:id/output -> the finished PNG
 *   POST   /render/:id/cancel -> kills the Blender process
 *   GET    /health            -> { ok, blender }
 *
 * Dev-only by design (see src/lib/render-pipeline/renderBackend.ts): the app
 * itself still deploys to Cloudflare Workers, which cannot run this. The
 * frontend probes /health and falls back to the old JSON+CLI export when
 * this bridge isn't running, so nothing here is required for the app to work.
 *
 * Run with `npm run render-bridge` (separate terminal from `npm run dev`).
 */
import { createServer } from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { createReadStream, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const BLENDER_SCRIPT = path.join(PROJECT_ROOT, "rendering", "blender", "pool_render.py");
const ASSETS_ROOT = path.join(PROJECT_ROOT, "public");
const PORT = Number(process.env.RENDER_BRIDGE_PORT) || 5177;
const JOB_ROOT = path.join(tmpdir(), "pool-render-bridge");

const BLENDER_CANDIDATES = [
  process.env.BLENDER_PATH,
  "blender",
  "/opt/homebrew/bin/blender",
  "/Applications/Blender.app/Contents/MacOS/Blender",
].filter(Boolean);

function findBlender() {
  for (const candidate of BLENDER_CANDIDATES) {
    const probe = spawnSync(candidate, ["--version"], { stdio: "ignore" });
    if (!probe.error) return candidate;
  }
  return null;
}

const blenderPath = findBlender();
if (!blenderPath) {
  console.warn(
    "[render-bridge] No Blender executable found (checked PATH and common macOS install " +
      "locations). /render will return 503 until BLENDER_PATH is set or Blender is installed.",
  );
} else {
  console.log(`[render-bridge] Using Blender: ${blenderPath}`);
}

/** @type {Map<string, { status: string, progress: {current:number,total:number}|null, error: string|null, outputPath: string, child: import("node:child_process").ChildProcess|null, log: string[] }>} */
const jobs = new Map();

function sendJson(res, statusCode, body, origin) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": origin ?? "*",
  });
  res.end(JSON.stringify(body));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 10_000_000) req.destroy(new Error("Payload too large"));
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : null);
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

async function handleCreateRender(req, res, origin) {
  if (!blenderPath) {
    return sendJson(res, 503, { error: "Blender executable not found on this machine." }, origin);
  }

  let config;
  try {
    config = await readJsonBody(req);
  } catch {
    return sendJson(res, 400, { error: "Invalid JSON body." }, origin);
  }
  const outputPreset = config?.outputPreset;
  if (!outputPreset?.width || !outputPreset?.height || !outputPreset?.samples) {
    return sendJson(res, 400, { error: "Config is missing a valid outputPreset." }, origin);
  }

  const jobId = randomUUID();
  const jobDir = path.join(JOB_ROOT, jobId);
  await mkdir(jobDir, { recursive: true });
  const configPath = path.join(jobDir, "config.json");
  const outputPath = path.join(jobDir, "output.png");
  await writeFile(configPath, JSON.stringify(config, null, 2), "utf8");

  const args = [
    "--background",
    "--factory-startup",
    "--python",
    BLENDER_SCRIPT,
    "--",
    "--config",
    configPath,
    "--assets-root",
    ASSETS_ROOT,
    "--out",
    outputPath,
    "--width",
    String(outputPreset.width),
    "--height",
    String(outputPreset.height),
    "--samples",
    String(outputPreset.samples),
  ];

  const child = spawn(blenderPath, args, { cwd: PROJECT_ROOT });
  const job = { status: "rendering", progress: null, error: null, outputPath, child, log: [] };
  jobs.set(jobId, job);

  const onChunk = (chunk) => {
    const text = chunk.toString();
    job.log.push(text);
    if (job.log.length > 200) job.log.shift();
    // Cycles background-mode progress line, e.g. "... | Sample 128/256".
    const match = text.match(/Sample\s+(\d+)\s*\/\s*(\d+)/);
    if (match) job.progress = { current: Number(match[1]), total: Number(match[2]) };
  };
  child.stdout.on("data", onChunk);
  child.stderr.on("data", onChunk);

  child.on("error", (error) => {
    job.status = "error";
    job.error = `Couldn't start Blender: ${error.message}`;
  });
  child.on("exit", (code) => {
    if (job.status === "cancelled") return;
    if (code === 0 && existsSync(outputPath)) {
      job.status = "complete";
      job.progress = job.progress ? { ...job.progress, current: job.progress.total } : null;
    } else {
      job.status = "error";
      job.error = job.error ?? `Blender exited with code ${code}.\n${job.log.slice(-8).join("")}`.slice(0, 4000);
    }
  });

  sendJson(res, 202, { jobId }, origin);
}

function handleStatus(jobId, res, origin) {
  const job = jobs.get(jobId);
  if (!job) return sendJson(res, 404, { error: "Unknown job id." }, origin);
  sendJson(res, 200, { status: job.status, progress: job.progress, error: job.error }, origin);
}

function handleOutput(jobId, res, origin) {
  const job = jobs.get(jobId);
  if (!job) return sendJson(res, 404, { error: "Unknown job id." }, origin);
  if (job.status !== "complete") {
    return sendJson(res, 409, { error: `Render not finished yet (status: ${job.status}).` }, origin);
  }
  res.writeHead(200, {
    "Content-Type": "image/png",
    "Content-Disposition": `attachment; filename="pool-render-${jobId}.png"`,
    "Access-Control-Allow-Origin": origin ?? "*",
  });
  createReadStream(job.outputPath).pipe(res);
}

function handleCancel(jobId, res, origin) {
  const job = jobs.get(jobId);
  if (!job) return sendJson(res, 404, { error: "Unknown job id." }, origin);
  if (job.child && job.status === "rendering") job.child.kill("SIGTERM");
  job.status = "cancelled";
  sendJson(res, 200, { status: "cancelled" }, origin);
}

const server = createServer((req, res) => {
  const origin = req.headers.origin;
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": origin ?? "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return res.end();
  }

  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const parts = url.pathname.split("/").filter(Boolean);

  if (req.method === "GET" && parts.length === 1 && parts[0] === "health") {
    return sendJson(res, 200, { ok: true, blender: blenderPath }, origin);
  }
  if (req.method === "POST" && parts.length === 1 && parts[0] === "render") {
    return void handleCreateRender(req, res, origin);
  }
  if (req.method === "GET" && parts.length === 2 && parts[0] === "render") {
    return handleStatus(parts[1], res, origin);
  }
  if (req.method === "GET" && parts.length === 3 && parts[0] === "render" && parts[2] === "output") {
    return handleOutput(parts[1], res, origin);
  }
  if (req.method === "POST" && parts.length === 3 && parts[0] === "render" && parts[2] === "cancel") {
    return handleCancel(parts[1], res, origin);
  }
  sendJson(res, 404, { error: "Not found." }, origin);
});

server.listen(PORT, () => {
  console.log(`[render-bridge] Listening on http://localhost:${PORT}`);
});
