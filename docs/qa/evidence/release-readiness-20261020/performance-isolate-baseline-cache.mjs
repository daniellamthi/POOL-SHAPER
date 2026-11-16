import assert from "node:assert/strict";
import { lstat, mkdir, readdir, readlink, symlink, unlink } from "node:fs/promises";
import { join } from "node:path";
const baseline = "/Users/danielelamthi/Documents/Codex/pool-shaper-wip-backups/release-baseline-20261020-RtqXZ8/node_modules";
const dependencies = "/Users/danielelamthi/Documents/Codex/pool-shaper-fullscreen-20261013/node_modules";
assert((await lstat(baseline)).isSymbolicLink());
assert.equal(await readlink(baseline), dependencies);
// Remove only the symlink created for this QA baseline; never its target.
await unlink(baseline);
await mkdir(baseline);
let count = 0;
for (const entry of await readdir(dependencies)) {
  if ([".vite", ".cache", ".vite-temp"].includes(entry)) continue;
  await symlink(join(dependencies, entry), join(baseline, entry));
  count++;
}
console.log(JSON.stringify({ status: "PASS", packageSymlinks: count, baselineCache: join(baseline, ".vite"), sourceChanged: false }));
