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

const btn = page.getByRole("button", { name: /photo mode/i }).first();
await btn.click({ force: true, timeout: 30000, noWaitAfter: true });
console.log("Photo Mode activated");

for (let i = 0; i < 8; i++) {
  await sleep(15000);
  const body = await page
    .locator("body")
    .innerText({ timeout: 5000 })
    .catch(() => "TIMEOUT");
  const m = body.match(/Refining[^\n]*/i);
  console.log(`t=${(i + 1) * 15}s ${m ? m[0] : "?"}`);
  await page.screenshot({ path: `${outDir}/hdri-t${(i + 1) * 15}s.png`, timeout: 60000 });
}

// Test quality picker
const highBtn = page.getByRole("button", { name: /^high$/i }).first();
if (await highBtn.count()) {
  await highBtn.click({ force: true });
  console.log("Clicked High quality preset");
  await sleep(3000);
  await page.screenshot({ path: `${outDir}/hdri-high-quality.png`, timeout: 60000 });
}

// Test export button (may still be disabled if not enough samples after remount)
const exportBtn = page.getByRole("button", { name: /generate photo/i }).first();
if (await exportBtn.count()) {
  const disabled = await exportBtn.isDisabled();
  console.log("Export button disabled?", disabled);
}

console.log("=== console/page logs (filtered) ===");
console.log(
  logs
    .filter((l) => /photomode|hdri|error|warn/i.test(l))
    .slice(0, 60)
    .join("\n"),
);

await browser.close();
