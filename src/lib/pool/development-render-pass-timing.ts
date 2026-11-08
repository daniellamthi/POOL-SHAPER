import type { WebGLRenderer } from "three";

/** DEV-only passive GPU queries around existing renders. Never changes frame
 * ownership, creates draws, flushes/finishes GL or reads scene/image data. */
export function installDevelopmentRenderPassTiming(renderer: WebGLRenderer): () => void {
  if (typeof window === "undefined") return () => {};
  const params = new URLSearchParams(window.location.search);
  if (params.get("qaPassGpuTiming") !== "1" || params.has("qaGpuTiming")) return () => {};
  const context = renderer.getContext() as WebGL2RenderingContext;
  const extension = context.getExtension("EXT_disjoint_timer_query_webgl2");
  if (!extension) {
    console.debug("[Pool3D render pass GPU] unavailable");
    return () => {};
  }
  type Pending = { query: WebGLQuery; pass: string; width: number; height: number };
  const pending: Pending[] = [];
  const spare: WebGLQuery[] = [];
  const owned = new Set<WebGLQuery>();
  const windows = new Map<
    string,
    { pass: string; width: number; height: number; values: number[] }
  >();
  const original = renderer.render;
  let activeQuery: WebGLQuery | null = null,
    stopped = false,
    reportedAt = performance.now();
  const release = (query: WebGLQuery) => {
    if (!owned.delete(query)) return;
    try {
      context.deleteQuery(query);
    } catch {
      /* Lost contexts are already released. */
    }
  };
  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (renderer.render === wrapper) renderer.render = original;
    for (const query of owned) if (query !== activeQuery) release(query);
    pending.length = spare.length = 0;
    windows.clear();
  };
  const poll = () => {
    if (context.getParameter(extension.GPU_DISJOINT_EXT)) {
      pending.splice(0).forEach((item) => release(item.query));
      windows.clear();
      return;
    }
    while (
      pending.length &&
      context.getQueryParameter(pending[0]!.query, context.QUERY_RESULT_AVAILABLE)
    ) {
      const item = pending.shift()!;
      const ms = Number(context.getQueryParameter(item.query, context.QUERY_RESULT)) / 1e6;
      spare.push(item.query);
      if (!Number.isFinite(ms) || ms < 0) continue;
      const key = `${item.pass}:${item.width}:${item.height}`;
      const bucket = windows.get(key) ?? {
        pass: item.pass,
        width: item.width,
        height: item.height,
        values: [],
      };
      if (bucket.values.length < 240) bucket.values.push(ms);
      windows.set(key, bucket);
    }
    const now = performance.now();
    if (now - reportedAt < 2000) return;
    const passes = [...windows.values()].map(({ pass, width, height, values }) => {
      values.sort((a, b) => a - b);
      return {
        pass,
        width,
        height,
        samples: values.length,
        medianMs: Number(values[Math.floor(values.length * 0.5)]!.toFixed(3)),
        p95Ms: Number(
          values[Math.min(values.length - 1, Math.floor(values.length * 0.95))]!.toFixed(3),
        ),
      };
    });
    if (passes.length)
      console.debug(
        "[Pool3D render pass GPU]",
        JSON.stringify({
          passes,
          scope: "existing render calls; nested renders included in their outer call",
        }),
      );
    windows.clear();
    reportedAt = now;
  };
  const wrapper: typeof renderer.render = function (this: WebGLRenderer, scene, camera) {
    if (stopped || activeQuery) return original.call(this, scene, camera);
    let item: Pending | null = null;
    try {
      poll();
      // Respect queries installed by any other owner; never nest or end them.
      if (!context.getQuery(extension.TIME_ELAPSED_EXT, context.CURRENT_QUERY)) {
        const query = spare.pop() ?? (owned.size < 8 ? context.createQuery() : null);
        if (query) {
          owned.add(query);
          const target = renderer.getRenderTarget();
          item = {
            query,
            pass:
              camera.name === "pool-water-reflection"
                ? "mirror"
                : target
                  ? "offscreen-other"
                  : "main",
            width: target?.width ?? renderer.domElement.width,
            height: target?.height ?? renderer.domElement.height,
          };
          context.beginQuery(extension.TIME_ELAPSED_EXT, query);
          activeQuery = query;
        }
      }
    } catch {
      stop();
    }
    try {
      return original.call(this, scene, camera);
    } finally {
      if (item && activeQuery === item.query) {
        try {
          if (context.getQuery(extension.TIME_ELAPSED_EXT, context.CURRENT_QUERY) === item.query)
            context.endQuery(extension.TIME_ELAPSED_EXT);
        } catch {
          /* Diagnostics cannot replace a render exception or return. */
        }
        activeQuery = null;
        if (stopped) release(item.query);
        else pending.push(item);
      }
    }
  };
  renderer.render = wrapper;
  return stop;
}
