import { chromium } from "playwright-core";
const url = process.argv[2];
const browser = await chromium.launch({
  args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const logs = [];
page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => logs.push("[pageerror] " + e.message));
const sleep = (ms) => page.waitForTimeout(ms);

await page.goto(url, { waitUntil: "load", timeout: 45000 });
await sleep(2500);

const btn = page.getByRole("button", { name: /photo mode/i }).first();
await btn.click({ force: true, timeout: 40000 });
console.log("Photo Mode activated -- not touching camera.");

await sleep(20000);
const body = await page
  .locator("body")
  .innerText({ timeout: 5000 })
  .catch(() => "TIMEOUT");
console.log("body snippet:", (body.match(/Refining[^\n]*/i) || ["?"])[0]);
console.log("=== all logs ===");
console.log(logs.join("\n"));

await browser.close();
