// Exercises PhotoModeRenderer's actual try/catch -> onUnsupported() path
// (temporarily forced to always throw in the source, see the TEMP comment)
// without breaking the base WebGL2 context the live view also needs -- a
// more faithful test than disabling WebGL2 globally, which also breaks the
// live raster view in this three.js version and so can't isolate Photo
// Mode's own failure handling.
import { chromium } from "playwright-core";
const url = process.argv[2];
const outDir = process.argv[3] || ".";
const browser = await chromium.launch({
  args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const logs = [];
page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => logs.push("[pageerror] " + e.message));
const sleep = (ms) => page.waitForTimeout(ms);

await page.goto(url, { waitUntil: "load", timeout: 45000 });
await page
  .getByText("Preparing the 3D studio", { exact: false })
  .waitFor({ state: "detached", timeout: 30000 })
  .catch(() => {});
await sleep(1500);
await page.screenshot({ path: `${outDir}/before-unsupported.png` });

const btn = page.getByRole("button", { name: /photo mode/i }).first();
await btn.click({ force: true, timeout: 30000, noWaitAfter: true });
await sleep(3000);

const toastVisible = await page.getByText(/isn't supported on this device/i).count();
console.log("Toast message visible?", toastVisible > 0);

const disabledNow = await btn.isDisabled();
console.log("Photo Mode button disabled after failure?", disabledNow);

const stillBackToLive = await page.getByRole("button", { name: /back to live/i }).count();
console.log("Did NOT get stuck in Photo Mode (no Back to Live button)?", stillBackToLive === 0);

await page.screenshot({ path: `${outDir}/after-unsupported.png` });

// Live view should still be fully usable: try orbiting the canvas.
const canvas = page.locator("canvas").first();
const box = await canvas.boundingBox();
if (box) {
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.4, { steps: 10 });
  await page.mouse.up();
  console.log("Orbited the live canvas without error after the failure.");
}
await sleep(500);
await page.screenshot({ path: `${outDir}/live-still-usable.png` });

console.log("=== relevant logs ===");
console.log(logs.filter((l) => /photomode|error/i.test(l)).join("\n"));

await browser.close();
