import { chromium } from "playwright-core";
const url = process.argv[2];
const outDir = process.argv[3] || ".";
const browser = await chromium.launch({
  args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const sleep = (ms) => page.waitForTimeout(ms);

await page.goto(url, { waitUntil: "load", timeout: 45000 });
await page
  .getByText("Preparing the 3D studio", { exact: false })
  .waitFor({ state: "detached", timeout: 30000 })
  .catch(() => {});
await sleep(3000);

const btn = page.getByRole("button", { name: /photo mode/i }).first();
await btn.click({ force: true, timeout: 45000 });
const t0 = Date.now();
console.log("Photo Mode activated at", t0);

for (let i = 0; i < 16; i++) {
  await sleep(25000);
  const body = await page
    .locator("body")
    .innerText({ timeout: 5000 })
    .catch(() => "TIMEOUT");
  const m = body.match(/Refining[^\n]*/i);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`t=${elapsed}s ${m ? m[0] : "?"}`);
  await page.screenshot({ path: `${outDir}/long-t${elapsed}s.png`, timeout: 60000 });
}

await browser.close();
