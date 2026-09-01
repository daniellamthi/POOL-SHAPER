import { chromium } from "playwright-core";

const OUT = "/private/tmp/claude-501/-Users-danielelamthi-Downloads-GITHUB-CONFIG--3D-PISICNE-WELLNESS/d70c3732-5560-441b-93e2-e62113287b28/scratchpad";
const LINERS = [
  "Motion Deep Sea",
  "Motion Blue Sky",
  "Motion Arctic White",
  "Motion Sand Beach",
  "Motion Grey Rock",
  "Motion Black Stone",
];

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on("console", (msg) => {
  if (msg.type() === "error") console.log("CONSOLE ERROR:", msg.text());
});
await page.goto("http://localhost:8081/", { waitUntil: "domcontentloaded", timeout: 20000 });
await page.waitForTimeout(3000);

// Step 1: Project Type -> New Pool -> Continue
await page.click('text="New Pool"', { force: true });
await page.click('button:has-text("Continue")');
await page.waitForTimeout(800);

// Walk through steps until we reach "Finish"
for (let i = 0; i < 6; i++) {
  const stepLabel = await page.locator("h2, h1").first().textContent().catch(() => "");
  console.log("step heading:", stepLabel);
  if (stepLabel && /finish/i.test(stepLabel)) break;
  const contBtn = page.locator('button:has-text("Continue")');
  if (await contBtn.count()) {
    await contBtn.first().click();
    await page.waitForTimeout(600);
  } else {
    break;
  }
}
await page.screenshot({ path: `${OUT}/01-finish-step.png` });

for (const liner of LINERS) {
  const swatch = page.locator(`button:has-text("${liner}")`).first();
  await swatch.scrollIntoViewIfNeeded();
  await swatch.click();
  await page.waitForTimeout(500);
  // Move to next step to see water rendering (showWater is false on finish step)
  await page.click('button:has-text("Continue")');
  await page.waitForTimeout(1500);
  const safeName = liner.replace(/\s+/g, "-");
  await page.screenshot({ path: `${OUT}/liner-${safeName}.png` });
  // Go back to finish step
  await page.click('button:has-text("Back")');
  await page.waitForTimeout(600);
}

await browser.close();
console.log("DONE");
