import { chromium } from "playwright-core";
const url = process.argv[2];
const outDir = process.argv[3] || ".";
const outTag = process.argv[4] || "run";
const waitSeconds = Number(process.argv[5] || 40);

const browser = await chromium.launch({
  args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
const logs = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
  if (m.text().includes("photomode-debug")) logs.push(m.text());
});
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
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

// New Pool -> In-Ground Pool (open/outdoor, not an above-ground panel kit) on
// the first two steps specifically (so the basin is a real in-ground open
// pool for point 3's exterior reflection check); every later step just picks
// whatever option is first in its `[role="group"]` and continues -- we only
// need water + materials filled in, not a specific finish.
await clickOnce("New Pool");
await sleep(500);
await continueOnce();
await sleep(600);
await clickOnce("In-Ground Pool");
await sleep(500);
await continueOnce();
await sleep(600);

for (let i = 0; i < 8; i++) {
  let res = await continueOnce();
  if (res === "disabled") {
    const firstOption = page.locator('[role="group"] button[aria-pressed]').first();
    if (await firstOption.count()) {
      await firstOption.click({ force: true });
      await sleep(400);
      res = await continueOnce();
    }
  }
  await sleep(600);
  if (res === "no-btn") break;
}

await sleep(1500);
await page.screenshot({ path: `${outDir}/${outTag}-00-live.png`, timeout: 60000 });
console.log("live screenshot taken");

const btn = page.getByRole("button", { name: /photo mode/i }).first();
await btn.click({ force: true, timeout: 20000 }).catch((e) => {
  console.log(
    "click() reported an error (often benign under swiftshader):",
    e.message.split("\n")[0],
  );
});
const t0 = Date.now();

await page
  .getByText(/Refining/i)
  .waitFor({ state: "visible", timeout: 20000 })
  .catch((e) =>
    console.log("Photo Mode never showed a Refining overlay:", e.message.split("\n")[0]),
  );
console.log("Photo Mode activated at", t0);

const readSamplesText = async () => {
  const body = await page
    .locator("body")
    .innerText({ timeout: 5000 })
    .catch(() => "TIMEOUT");
  const m = body.match(/Refining[^\n]*/i);
  return m ? m[0] : "?";
};

const chunks = Math.max(1, Math.round(waitSeconds / 8));
for (let i = 0; i < chunks; i++) {
  await sleep(8000);
  const text = await readSamplesText();
  console.log(`t=${((Date.now() - t0) / 1000).toFixed(1)}s ${text}`);
}

await page.screenshot({ path: `${outDir}/${outTag}-01-photomode.png`, timeout: 60000 });
console.log("Saved photo mode screenshot");

console.log("=== console errors ===");
console.log(errors.length ? errors.join("\n") : "(none)");
console.log("=== photomode-debug logs ===");
console.log(logs.length ? logs.join("\n") : "(none)");

await browser.close();
