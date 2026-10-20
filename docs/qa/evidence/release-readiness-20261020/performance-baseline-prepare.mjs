// Read-only source archive + exact preserved-WIP overlay. No application edits.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { copyFile, lstat, mkdir, readFile, readdir, realpath, symlink } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const repo = "/Users/danielelamthi/Documents/Codex/pool-shaper-fullscreen-20261013";
const backup = "/Users/danielelamthi/Documents/Codex/pool-shaper-wip-backups/residual-gates-20261015-vPbgdc";
const baseline = resolve(process.argv[2] ?? "");
assert(baseline.startsWith("/Users/danielelamthi/Documents/Codex/pool-shaper-wip-backups/release-baseline-20261020-"));
assert.equal((await readdir(baseline)).length, 0, "Only a fresh empty mktemp directory is allowed");
const expectedHead = "0665d3b44bb0d25319f273397dea14825ff5f64a";
const manifestBytes = await readFile(join(backup, "manifest.json"));
const manifest = JSON.parse(manifestBytes);
assert.equal(manifest.head, expectedHead);
assert.equal(manifest.files.length, 40);
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const secretName = /(^|\/)(\.env(?:\.|$)|\.aws|\.ssh|credentials(?:\.|$)|secrets?(?:\.|$)|id_rsa(?:\.|$)|id_ed25519(?:\.|$))/i;
for (const entry of manifest.files) {
  assert(!entry.name.startsWith("/") && !entry.name.split("/").includes("..") && !secretName.test(entry.name), "Safe manifest path");
  const bytes = await readFile(join(backup, "files", entry.name));
  assert.equal(bytes.length, entry.bytes, entry.name);
  assert.equal(digest(bytes), entry.sha256, entry.name);
}
function completion(child, name) {
  return new Promise((ok, fail) => {
    child.once("error", fail);
    child.once("close", code => code === 0 ? ok() : fail(new Error(`${name} exited ${code}`)));
  });
}
// Source archive is streamed directly into tar; no archive or large buffer exists.
const archive = spawn("git", ["archive", "--format=tar", expectedHead], { cwd: repo, stdio: ["ignore", "pipe", "inherit"] });
const unpack = spawn("tar", ["-xf", "-", "-C", baseline], { stdio: ["pipe", "inherit", "inherit"] });
archive.stdout.pipe(unpack.stdin);
await Promise.all([completion(archive, "git archive"), completion(unpack, "tar")]);
const archiveFiles = [];
async function inventory(root, prefix = "") {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    assert(!secretName.test(relative), `Secret-like path excluded: ${relative}`);
    if (entry.isDirectory()) await inventory(join(root, entry.name), relative);
    else archiveFiles.push(relative);
  }
}
await inventory(baseline);
const verifiedOverlay = [];
for (const entry of manifest.files) {
  const target = join(baseline, entry.name);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(join(backup, "files", entry.name), target);
  assert.equal(digest(await readFile(target)), entry.sha256, `Overlay ${entry.name}`);
  verifiedOverlay.push({ name: entry.name, bytes: entry.bytes, sha256: entry.sha256 });
}
assert(!(await lstat(join(baseline, "node_modules")).catch(() => null)));
await symlink(join(repo, "node_modules"), join(baseline, "node_modules"), "dir");
const sourceFingerprints = [];
for (const name of ["src/components/pool/three/PoolScene.tsx", "src/lib/pool/camera.ts", "src/lib/pool/contextual-camera.ts", "src/lib/pool/comfort-plan.ts", "src/lib/pool/sun-shelf-loungers.ts", "src/lib/pool/store.tsx", "src/lib/pool/types.ts", "src/lib/pool/project.ts", "package.json", "vite.config.ts"]) {
  const bytes = await readFile(join(baseline, name));
  sourceFingerprints.push({ name, bytes: bytes.length, sha256: digest(bytes) });
}
console.log(JSON.stringify({ status: "PASS", baseline, expectedHead, archiveFiles: archiveFiles.length, backupManifestSHA256: digest(manifestBytes), overlayCount: verifiedOverlay.length, verifiedOverlay, sourceFingerprints, nodeModules: await realpath(join(baseline, "node_modules")), secretsCopied: false, archiveMethod: "git archive piped to tar; no archive buffered" }, null, 2));
