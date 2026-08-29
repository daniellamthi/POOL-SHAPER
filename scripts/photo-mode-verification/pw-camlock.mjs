import { chromium } from "playwright-core";
const url = process.argv[2];
const browser = await chromium.launch({
  args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const resetLogs = [];
page.on("console", (m) => {
  if (m.text().includes("[photomode-debug] reset fired")) resetLogs.push(m.text());
});
const sleep = (ms) => page.waitForTimeout(ms);

await page.goto(url, { waitUntil: "load", timeout: 45000 });
await sleep(2500);

const btn = page.getByRole("button", { name: /photo mode/i }).first();
await btn.click({ force: true, timeout: 15000 });
console.log("Photo Mode activated at", Date.now(), "-- NOT touching camera/mouse from here on.");

for (let i = 0; i < 10; i++) {
  await sleep(3000);
  const body = await page
    .locator("body")
    .innerText({ timeout: 5000 })
    .catch(() => "TIMEOUT");
  const m = body.match(/Refining[^\n]*/i);
  console.log(`t=${(i + 1) * 3}s samples-text="${m ? m[0] : "?"}" resetCount=${resetLogs.length}`);
}

console.log("\n=== total resets observed over the whole idle window ===", resetLogs.length);
console.log(resetLogs.join("\n"));

await browser.close();
