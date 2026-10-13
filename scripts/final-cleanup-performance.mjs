// Isolated, read-only Chromium context. No project writes, edit tokens or emails.
// Measures browser RAF pacing, NOT GPU frame time or a before/after regression.
import { chromium } from "playwright";
const url = process.env.POOL_QA_READONLY_URL;
if (!url || !/^http:\/\/(127\.0\.0\.1|localhost):3001\/\?p=PW-[A-Z0-9-]+$/.test(url))
  throw new Error("Provide an explicit local read-only QA project URL");
const browser = await chromium.launch({ channel: "chrome", headless: process.env.POOL_QA_HEADED !== "1" });
// A software WebGL stall can also block the page's own timeout. Bound the
// complete read-only harness from Node rather than leaving a QA process alive.
const watchdog = setTimeout(() => {
  console.error("BLOCKED: isolated browser did not complete within 90 seconds");
  void browser.close();
  setTimeout(() => process.exit(1), 2000).unref();
}, 90000);
try {
  for (const [width, height] of [[1440,900],[390,844],[430,932]]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.locator("canvas").first().waitFor({ state: "visible" });
    await page.waitForTimeout(8000);
    const result = await page.evaluate(async () => {
      const canvas = document.querySelector("canvas");
      const gl = canvas?.getContext("webgl2");
      const info = gl?.getExtension("WEBGL_debug_renderer_info");
      const renderer = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : "unavailable";
      const samples = [];
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("RAF measurement timeout")), 30000);
        let previous;
        function frame(now) {
          if (previous !== undefined) samples.push(now - previous);
          previous = now;
          if (samples.length === 120) { clearTimeout(timeout); resolve(); }
          else requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      });
      const ordered = [...samples].sort((a,b) => a-b);
      const resources = performance.getEntriesByType("resource");
      return {
        renderer, samples: samples.length,
        medianRafMs: +ordered[60].toFixed(2), p95RafMs: +ordered[114].toFixed(2),
        maxRafMs: +ordered[119].toFixed(2),
        optionalPhotoEnvironmentRequests: resources.filter(r => /photo-environments|HybridEnvironment|HybridPhoto/.test(r.name)).length,
        jsHeapBytes: performance.memory?.usedJSHeapSize ?? null,
        readonlyVisible: document.body.innerText.includes("Sola lettura"),
      };
    });
    console.log(JSON.stringify({ width, height, dpr: 1, ...result }));
    await context.close();
  }
} finally { clearTimeout(watchdog); await browser.close(); }
