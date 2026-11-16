/** Temporary, opt-in GL call attribution. The caller must gate this to DEV.
 * Only method names/counts/durations are retained; no GL arguments or results.
 * No GL inspection, readback, flush or finish is introduced. */
export function installDevelopmentGlDiagnostic(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
): () => void {
  if (typeof window === "undefined" || new URLSearchParams(window.location.search).get("qaGlDiagnostic") !== "1") return () => {};

  const names = [
    "getProgramInfoLog", "getShaderInfoLog", "getProgramParameter",
    "compileShader", "linkProgram", "getUniformLocation", "getActiveUniform",
    "bufferData", "texImage2D", "texStorage2D", "renderbufferStorageMultisample",
    "generateMipmap", "drawElements", "drawArrays",
  ] as const;
  type NativeMethod = (...args: unknown[]) => unknown;
  type Metric = { count: number; totalMs: number; maxMs: number };
  type Sample = { sample: number; event: string; methods: Map<string, Metric> };
  const context = gl as unknown as Record<string, NativeMethod>;
  const installed: Array<{ name: string; original: NativeMethod; wrapper: NativeMethod; descriptor: PropertyDescriptor | undefined }> = [];
  const pending = new Set<number>();
  let active: Sample | null = null;
  let samples = 0;
  let stopped = false;

  for (const name of names) {
    const original = context[name];
    if (typeof original !== "function") continue;
    const descriptor = Object.getOwnPropertyDescriptor(context, name);
    const wrapper: NativeMethod = function (this: unknown, ...args) {
      const context = this;
      const sample = active;
      if (!sample) return original.apply(context, args);
      let startedAt: number;
      try { startedAt = performance.now(); }
      catch { return original.apply(context, args); }
      try {
        return original.apply(context, args);
      } finally {
        // Diagnostics must never replace the native return value or exception.
        try {
          if (!stopped && active === sample) {
            const duration = Math.max(0, performance.now() - startedAt);
            const metric = sample.methods.get(name) ?? { count: 0, totalMs: 0, maxMs: 0 };
            metric.count++;
            metric.totalMs += duration;
            metric.maxMs = Math.max(metric.maxMs, duration);
            sample.methods.set(name, metric);
          }
        } catch { /* The diagnostic cannot affect native GL semantics. */ }
      }
    };
    try {
      Object.defineProperty(context, name, {
        configurable: true, writable: true,
        enumerable: descriptor?.enumerable ?? false, value: wrapper,
      });
      installed.push({ name, original, wrapper, descriptor });
    } catch { /* Missing or non-wrappable methods are simply unmeasured. */ }
  }

  const cancelPending = () => {
    for (const frame of pending) cancelAnimationFrame(frame);
    pending.clear();
  };
  const record = (event: Event) => {
    if (!event.isTrusted || stopped || samples >= 60) return;
    cancelPending();
    const sample: Sample = { sample: ++samples, event: event.type, methods: new Map() };
    active = sample;
    const first = requestAnimationFrame(() => {
      pending.delete(first);
      if (stopped || active !== sample) return;
      const second = requestAnimationFrame(() => {
        pending.delete(second);
        if (stopped || active !== sample) return;
        active = null;
        const methods = Object.fromEntries([...sample.methods].map(([name, metric]) => [name, {
          count: metric.count,
          totalMs: Number(metric.totalMs.toFixed(2)),
          maxMs: Number(metric.maxMs.toFixed(2)),
        }]));
        try {
          console.debug("[Pool3D GL diagnostic]", JSON.stringify({ sample: sample.sample, event: sample.event, methods }));
        } catch { /* Logging cannot interrupt the render loop. */ }
      });
      pending.add(second);
    });
    pending.add(first);
  };
  const events = ["click", "input"] as const;
  for (const event of events) window.addEventListener(event, record, { capture: true, passive: true });

  return () => {
    if (stopped) return;
    stopped = true;
    active = null;
    for (const event of events) window.removeEventListener(event, record, true);
    cancelPending();
    for (const { name, wrapper, descriptor } of installed) {
      // Do not replace a wrapper another owner installed after this one.
      if (context[name] !== wrapper) continue;
      if (descriptor) Object.defineProperty(context, name, descriptor);
      else delete context[name];
    }
  };
}
