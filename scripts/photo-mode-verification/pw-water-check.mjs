import { chromium } from "playwright-core";
const url = process.argv[2];
const outDir = process.argv[3] || ".";
const browser = await chromium.launch({
  args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
const sleep = (ms) => page.waitForTimeout(ms);

await page.goto(url, { waitUntil: "load", timeout: 45000 });
await page
  .getByText("Preparing the 3D studio", { exact: false })
  .waitFor({ state: "detached", timeout: 30000 })
  .catch(() => {});
await sleep(1500);
await page.screenshot({ path: `${outDir}/00-live.png` });

const btn = page.getByRole("button", { name: /photo mode/i }).first();
await btn.click({ force: true, timeout: 15000 });
const t0 = Date.now();
console.log("Photo Mode activated at", t0);

const readSamplesText = async () => {
  const body = await page
    .locator("body")
    .innerText({ timeout: 5000 })
    .catch(() => "TIMEOUT");
  const m = body.match(/Refining[^\n]*/i);
  return m ? m[0] : "?";
};

for (let i = 0; i < 12; i++) {
  await sleep(5000);
  const text = await readSamplesText();
  console.log(`t=${((Date.now() - t0) / 1000).toFixed(1)}s ${text}`);
  await page.screenshot({ path: `${outDir}/photo-t${(i + 1) * 5}s.png`, timeout: 60000 });
}

console.log("=== console errors ===");
console.log(errors.length ? errors.join("\n") : "(none)");

await browser.close();
