import { chromium } from "playwright-core";
const url = process.argv[2];
const outDir = process.argv[3] || ".";
const browser = await chromium.launch({
  args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const sleep = (ms) => page.waitForTimeout(ms);

async function clickOnce(text) {
  const loc = page.getByText(text, { exact: true }).first();
  if (await loc.count()) {
    await loc.click({ force: true });
    return true;
  }
  return false;
}
async function continueOnce() {
  const loc = page.getByRole("button", { name: /continue/i }).first();
  if (!(await loc.count())) return "no-btn";
  if (await loc.isDisabled()) return "disabled";
  await loc.click({ force: true });
  return "clicked";
}

await page.goto(url, { waitUntil: "load", timeout: 45000 });
await page
  .getByText("Preparing the 3D studio", { exact: false })
  .waitFor({ state: "detached", timeout: 30000 })
  .catch(() => {});
await sleep(1000);

const steps = ["New Pool", "In-Ground Pool", null, null, null, null, null, null, null];
for (const pick of steps) {
  if (pick) {
    await clickOnce(pick);
    await sleep(500);
  }
  let res = await continueOnce();
  if (res === "disabled") {
    await sleep(700);
    res = await continueOnce();
  }
  await sleep(600);
}

await sleep(1500);
await page.screenshot({ path: `${outDir}/live-final.png`, timeout: 60000 });
console.log("live screenshot taken");

const btn = page.getByRole("button", { name: /photo mode/i }).first();
await btn.click({ force: true, timeout: 15000 });
const t0 = Date.now();

for (let i = 0; i < 6; i++) {
  await sleep(8000);
  const body = await page
    .locator("body")
    .innerText({ timeout: 5000 })
    .catch(() => "TIMEOUT");
  const m = body.match(/Refining[^\n]*/i);
  console.log(`t=${((Date.now() - t0) / 1000).toFixed(1)}s ${m ? m[0] : "?"}`);
  await page.screenshot({ path: `${outDir}/photo-final-t${(i + 1) * 8}s.png`, timeout: 60000 });
}

await browser.close();
