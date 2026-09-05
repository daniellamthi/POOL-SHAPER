#!/usr/bin/env node
// Deterministic visual-regression harness (AUTO-009).
//
// Boots the app via `vite dev` and drives a fixed Chromium viewport through
// a small set of named reference configurations, and either saves the
// current screenshot as the baseline (`--update`) or diffs it against the
// existing baseline with pixelmatch, failing the run if any reference
// exceeds the pixel-difference threshold.
//
// NOTE: `vite dev` is used rather than a production preview because this
// project's `vite preview` / `.output` (Nitro `cloudflare-module` preset)
// combination does not serve locally out of the box (500: cannot find
// `dist/server/server.js` -- TanStack Start's preview-server plugin expects
// a different build layout than this preset produces). That mismatch is a
// pre-existing, separate build/tooling gap -- tracked as AUTO-011 in
// docs/AUTONOMOUS_ISSUES.md -- not something this harness works around by
// design. The 3D scene under audit is fully client-rendered, so `vite dev`
// output is visually equivalent for screenshot purposes; revisit once
// AUTO-011 is fixed.
//
// Reference set intentionally starts small (see docs/AUTONOMOUS_BACKLOG.md
// AUTO-009) and grows incrementally -- each entry describes exactly how to
// reach it from a fresh load, so a case is reproducible by inspection.
//
// Usage:
//   node scripts/visual-audit.mjs            # compare against baselines
//   node scripts/visual-audit.mjs --update   # (re)write baselines

import { chromium } from "playwright";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BASELINE_DIR = path.join(ROOT, "test-baselines", "visual");
const PREVIEW_PORT = 4174;
const PREVIEW_URL = `http://127.0.0.1:${PREVIEW_PORT}/`;
const DIFF_THRESHOLD_RATIO = 0.005; // 0.5% of pixels may differ before failing
const UPDATE = process.argv.includes("--update");

/** @type {{ name: string, viewport: { width: number, height: number }, run: (page: import('playwright').Page) => Promise<void> }[]} */
const REFERENCES = [
  {
    name: "landing-desktop",
    viewport: { width: 1440, height: 900 },
    // Fresh load, no interaction: Step 01 "Project Type" with the default
    // rectangle/skimmer/PVC-Liner preview pool. This is the one reference
    // currently exercised by CI/local smoke checks (see AUTO-007's
    // Playwright smoke test) -- kept here as the first, always-reachable
    // baseline so the harness itself has continuous coverage.
    async run() {
      // no-op: default state after load is the reference.
    },
  },
];

function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = async () => {
      try {
        const res = await fetch(url);
        if (res.ok || res.status < 500) return resolve(undefined);
      } catch {
        // not up yet
      }
      if (Date.now() - start > timeoutMs) return reject(new Error(`Timed out waiting for ${url}`));
      setTimeout(attempt, 300);
    };
    attempt();
  });
}

async function main() {
  await mkdir(BASELINE_DIR, { recursive: true });

  const viteBin = path.join(ROOT, "node_modules", ".bin", "vite");
  const preview = spawn(
    viteBin,
    ["dev", "--host", "127.0.0.1", "--port", String(PREVIEW_PORT), "--strictPort"],
    { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], detached: true },
  );
  let previewOutput = "";
  preview.stdout.on("data", (d) => (previewOutput += d));
  preview.stderr.on("data", (d) => (previewOutput += d));

  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || "/opt/pw-browsers/chromium",
    headless: true,
  });

  let failures = 0;
  try {
    await waitForServer(PREVIEW_URL);

    for (const ref of REFERENCES) {
      const page = await browser.newPage({ viewport: ref.viewport, deviceScaleFactor: 1 });
      const consoleErrors = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });
      page.on("pageerror", (err) => consoleErrors.push(String(err)));

      await page.goto(PREVIEW_URL, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(3000); // let the 3D scene settle (async texture/material load)
      await ref.run(page);
      await page.waitForTimeout(500);

      const buffer = await page.screenshot();
      await page.close();

      const baselinePath = path.join(BASELINE_DIR, `${ref.name}.png`);
      const currentPath = path.join(BASELINE_DIR, `${ref.name}.current.png`);
      await writeFile(currentPath, buffer);

      if (UPDATE || !existsSync(baselinePath)) {
        await writeFile(baselinePath, buffer);
        console.log(`[baseline] wrote ${ref.name} (${buffer.length} bytes)`);
        continue;
      }

      const baseline = PNG.sync.read(await readFile(baselinePath));
      const current = PNG.sync.read(buffer);
      if (baseline.width !== current.width || baseline.height !== current.height) {
        console.error(
          `[FAIL] ${ref.name}: dimension mismatch baseline=${baseline.width}x${baseline.height} current=${current.width}x${current.height}`,
        );
        failures++;
        continue;
      }
      const diff = new PNG({ width: baseline.width, height: baseline.height });
      const diffPixels = pixelmatch(
        baseline.data,
        current.data,
        diff.data,
        baseline.width,
        baseline.height,
        {
          threshold: 0.1,
        },
      );
      const totalPixels = baseline.width * baseline.height;
      const ratio = diffPixels / totalPixels;
      const status = ratio > DIFF_THRESHOLD_RATIO ? "FAIL" : "pass";
      if (status === "FAIL") {
        failures++;
        const diffPath = path.join(BASELINE_DIR, `${ref.name}.diff.png`);
        await writeFile(diffPath, PNG.sync.write(diff));
        console.error(
          `[FAIL] ${ref.name}: ${diffPixels}/${totalPixels} px differ (${(ratio * 100).toFixed(3)}%) > ${(DIFF_THRESHOLD_RATIO * 100).toFixed(2)}% threshold -- see ${diffPath}`,
        );
      } else {
        console.log(
          `[pass] ${ref.name}: ${diffPixels}/${totalPixels} px differ (${(ratio * 100).toFixed(3)}%)`,
        );
      }
      if (consoleErrors.length > 0) {
        console.warn(
          `[warn] ${ref.name}: ${consoleErrors.length} console error(s): ${consoleErrors.join(" | ")}`,
        );
      }
    }
  } finally {
    await browser.close();
    // `vite dev` forks its own child process; kill the whole group (negative
    // pid) so nothing is left dangling after this script exits.
    try {
      process.kill(-preview.pid, "SIGTERM");
    } catch {
      preview.kill();
    }
  }

  if (failures > 0) {
    console.error(`\n${failures} reference(s) failed. Preview log:\n${previewOutput}`);
    process.exit(1);
  }
  console.log(`\nVisual audit passed: ${REFERENCES.length} reference(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
