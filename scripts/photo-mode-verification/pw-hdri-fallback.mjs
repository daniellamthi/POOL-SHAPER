// Verifies Photo Mode's HDRI-load-failure fallback: block every .hdr request
// so HDRLoader always fails, then confirm Photo Mode still activates
// (gradient sky) instead of getting stuck or throwing.
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

await page.route("**/*.hdr", (route) => route.fulfill({ status: 404, body: "not found" }));

await page.goto(url, { waitUntil: "load", timeout: 45000 });
await page
  .getByText("Preparing the 3D studio", { exact: false })
  .waitFor({ state: "detached", timeout: 30000 })
  .catch(() => {});
await sleep(1500);

const btn = page.getByRole("button", { name: /photo mode/i }).first();
await btn.click({ force: true, timeout: 30000, noWaitAfter: true });
console.log("Photo Mode activated with .hdr blocked");

for (let i = 0; i < 6; i++) {
  await sleep(10000);
  const body = await page
    .locator("body")
    .innerText({ timeout: 5000 })
    .catch(() => "TIMEOUT");
  const m = body.match(/Refining[^\n]*/i);
  console.log(
    `t=${(i + 1) * 10}s samples text:`,
    m ? m[0] : "NO MATCH -- full body snippet: " + body.slice(0, 200).replace(/\n/g, " | "),
  );
  await page.screenshot({ path: `${outDir}/hdri-fallback-t${(i + 1) * 10}s.png`, timeout: 60000 });
}

console.log("=== relevant logs ===");
console.log(logs.filter((l) => /photomode|hdri|error/i.test(l)).join("\n"));

await browser.close();
