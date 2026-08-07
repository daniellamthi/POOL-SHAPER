// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { Plugin } from "vite";

/**
 * TanStack's development source inspector annotates every JSX element. Those
 * DOM-only attributes are invalid R3F props, so remove them from scene modules
 * after source inspection has run and before React compiles the JSX.
 */
function r3fSourceAnnotationGuard(): Plugin {
  return {
    name: "pool:r3f-source-annotation-guard",
    enforce: "pre",
    transform(code, id) {
      if (!id.includes("/components/pool/three/") || !code.includes("data-tsd-source")) return;
      return code.replace(/\sdata-tsd-source=(?:"[^"]*"|'[^']*')/g, "");
    },
  };
}

export default defineConfig({
  plugins: [r3fSourceAnnotationGuard()],
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
