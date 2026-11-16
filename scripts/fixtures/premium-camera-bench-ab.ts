/** Portable scope oracle for AB. Z supplied the untouched camera branches;
 * AA supplied the physical head-module eye. AB changes only its aiming/lens.
 * No screenshot, backup checkout or ignored evidence is required at runtime. */
export const BENCH_MACRO_AB = {
  zCameraSha: "3dbde29f93b9b230743333d20b317770071e957d50d4082e02e16983ba255e30",
  contextOtherBranchesSha: "f77a560bd648702c1488c696b74163072f512841c69005aab3b7153b60be6e0e",
  configuratorSha: "c91dd7e94f8ef90183bded2c704189fbaaec3ddae9893180b9550506e4b7688c",
  criticalAAEye: [-1.464218991973485, 0.4217287917870412, 0.5887499999999999],
  // Actual public DOM; the 430 capture is the same open Lighting panel
  // after exit to main LEDs (focus features), not another bench screenshot.
  ui: {
    390: {
      source: "AA-before-bench-B-390-dom.json",
      canvas: { left: 0, top: 0, width: 390, height: 844 },
      overlays: [
        { left: 8, top: 8, width: 374, height: 108 },
        { left: 12, top: 132, width: 131.9140625, height: 36 },
        { left: 180.921875, top: 293.515625, width: 193.078125, height: 40 },
        { left: 289, top: 297.515625, width: 32, height: 32 },
        { left: 334, top: 293.515625, width: 40, height: 40 },
        { left: 0, top: 0, width: 0, height: 0 },
        { left: 8, top: 365.515625, width: 374, height: 470.484375 },
      ],
    },
    430: {
      source: "AB-bench-B-430-dom.json",
      canvas: { left: 0, top: 0, width: 430, height: 932 },
      overlays: [
        { left: 8, top: 8, width: 414, height: 108 },
        { left: 12, top: 132, width: 131.9140625, height: 36 },
        { left: 220.921875, top: 346.3125, width: 193.078125, height: 40 },
        { left: 329, top: 350.3125, width: 32, height: 32 },
        { left: 374, top: 346.3125, width: 40, height: 40 },
        { left: 0, top: 0, width: 0, height: 0 },
        { left: 8, top: 418.3125, width: 414, height: 505.6875 },
      ],
    },
    1440: {
      source: "AA-bench-B-1440-dom.json",
      canvas: { left: 0, top: 0, width: 1440, height: 900 },
      overlays: [
        { left: 16, top: 12, width: 1408, height: 72 },
        { left: 16, top: 96, width: 131.9140625, height: 36 },
        { left: 0, top: 0, width: 0, height: 0 },
        { left: 0, top: 0, width: 0, height: 0 },
        { left: 0, top: 0, width: 0, height: 0 },
        { left: 1114.8515625, top: 447.5078125, width: 305.1484375, height: 40 },
        { left: 130, top: 515.5078125, width: 1180, height: 368.4921875 },
      ],
    },
  },
} as const;
