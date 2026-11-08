import type { WebGLRenderer } from "three";
import type { WebGLPathTracer } from "three-gpu-pathtracer";

type Resource = { dispose(): void };
type CopyTexture = Resource & {
  setTextures(renderer: WebGLRenderer, ...args: unknown[]): unknown;
};
type OwnedMaterial = Resource & {
  uniforms: Record<string, { value: unknown }>;
  removeEventListener(type: string, listener: unknown): void;
};
type PathRenderer = Resource & {
  material: OwnedMaterial;
  _blendQuad?: { material: Resource };
  _compileFunction?: unknown;
  _compilePromise?: Promise<unknown> | null;
};
type AtlasTarget = Resource & {
  texture: unknown;
  fsQuad?: { material: Resource };
};
type PrivateTracer = {
  _pathTracer: PathRenderer;
  _lowResPathTracer: PathRenderer;
  _compilePromise?: Promise<unknown> | null;
  _internalBackground?: Resource | null;
  _colorBackground?: Resource | null;
};
export interface PhotoTracerResources {
  dispose(restoreScene: () => void): Promise<void>;
}
const owners = new WeakMap<WebGLPathTracer, PhotoTracerResources>();

/** The installed public disposer omits low-res targets and material data.
 * Own only that graph. Never traverse/dispose scene materials or source maps. */
export function ownPhotoTracerResources(tracer: WebGLPathTracer): PhotoTracerResources {
  const existing = owners.get(tracer);
  if (existing) return existing;
  const internal = tracer as unknown as PrivateTracer;
  const renderers = [internal._pathTracer, internal._lowResPathTracer];
  if (renderers.some((renderer) => !renderer?.material?.uniforms || !renderer.dispose))
    throw new Error("Unsupported Photo Mode tracer resource ownership");
  const materials = new Set(renderers.map((renderer) => renderer.material));
  const atlases = new Set<CopyTexture>();
  for (const material of materials) {
    for (const key of ["textures", "iesProfiles"]) {
      const texture = material.uniforms[key]?.value as CopyTexture | undefined;
      if (typeof texture?.setTextures !== "function")
        throw new Error("Unsupported Photo Mode atlas ownership");
      atlases.add(texture);
    }
  }
  const targets = new Set<AtlasTarget>();
  const restoreCopies: Array<() => void> = [];
  for (const texture of atlases) {
    const original = texture.setTextures;
    // Three185's array target replaces its texture without attaching the
    // owner. Observe the existing copy calls through a facade: the borrowed
    // renderer itself, draw arguments and returned values are untouched.
    const wrapped: CopyTexture["setTextures"] = (renderer, ...args) => {
      const facade = new Proxy(renderer, {
        get(target, key) {
          if (key === "setRenderTarget")
            return (...targetArgs: unknown[]) => {
              const atlas = targetArgs[0] as AtlasTarget | null;
              if (atlas?.texture === texture) targets.add(atlas);
              return Reflect.apply(target.setRenderTarget, target, targetArgs);
            };
          const value: unknown = Reflect.get(target, key, target);
          return typeof value === "function" ? value.bind(target) : value;
        },
        set: (target, key, value) => Reflect.set(target, key, value, target),
      });
      return Reflect.apply(original, texture, [facade, ...args]);
    };
    texture.setTextures = wrapped;
    restoreCopies.push(() => {
      if (texture.setTextures === wrapped) texture.setTextures = original;
    });
  }
  let cleanup: Promise<void> | undefined;
  const owner: PhotoTracerResources = {
    dispose(restoreScene) {
      if (cleanup) return cleanup;
      let complete!: () => void;
      cleanup = new Promise<void>((resolve) => {
        complete = resolve;
      });
      const failures: unknown[] = [];
      const attempt = (action: () => void) => {
        try {
          action();
        } catch (error) {
          failures.push(error);
        }
      };
      const pending = [internal._compilePromise, ...renderers.map((r) => r._compilePromise)].filter(
        (promise): promise is Promise<unknown> => !!promise,
      );
      renderers.forEach((renderer) => materials.add(renderer.material));
      // Shader adapter restoration increments material.version. Detach both
      // owned compilers first so exit never starts fresh compileAsync work.
      for (const material of materials)
        for (const renderer of renderers)
          if (renderer._compileFunction)
            attempt(() => material.removeEventListener("recompilation", renderer._compileFunction));
      restoreCopies.forEach((restore) => attempt(restore));
      const resources = new Set<Resource>();
      const add = (value: unknown) => {
        if (value && typeof (value as Resource).dispose === "function")
          resources.add(value as Resource);
      };
      for (const material of materials) {
        for (const key of [
          "bvh",
          "attributesArray",
          "materialIndexAttribute",
          "materials",
          "envMapInfo",
          "stratifiedTexture",
          "stratifiedOffsetTexture",
        ])
          add(material.uniforms[key]?.value);
        add((material.uniforms["lights"]?.value as { tex?: unknown } | undefined)?.tex);
      }
      for (const target of targets) {
        add(target);
        add(target.fsQuad?.material);
      }
      // An atlas never copied into an FBO has no captured target/GPU copy
      // material. Its owned texture can still have been bound as a sampler.
      for (const atlas of atlases)
        if (![...targets].some((target) => target.texture === atlas)) add(atlas);
      add(internal._internalBackground);
      add(internal._colorBackground);
      renderers.forEach((renderer) => add(renderer._blendQuad?.material));
      materials.forEach(add);
      attempt(restoreScene);
      attempt(() => tracer.dispose());
      attempt(() => internal._lowResPathTracer.dispose());
      // compileAsync polls its WebGLProgram. Wait for existing work before
      // deleting the owned program/data; render tasks already stopped above.
      void Promise.allSettled(pending).then(() => {
        for (const resource of resources) attempt(() => resource.dispose());
        if (failures.length) console.warn("[PhotoMode] resource cleanup incomplete", failures);
        complete();
      });
      return cleanup;
    },
  };
  owners.set(tracer, owner);
  return owner;
}
