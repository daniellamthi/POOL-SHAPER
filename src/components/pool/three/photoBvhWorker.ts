import { Box3, BufferAttribute, type BufferGeometry } from "three";
import { MeshBVH, type MeshBVHOptions } from "three-mesh-bvh";
import type { BVHWorker } from "three-gpu-pathtracer";

type IndexArray = Uint16Array | Uint32Array;
// The installed library serializes indirectBuffer, omitted by its older types.
export type PhotoBvhData = Omit<ReturnType<typeof MeshBVH.serialize>, "index"> & {
  index: IndexArray | null;
  indirectBuffer: IndexArray | null;
};
export type PhotoBvhRequest = {
  id: number;
  position: BufferAttribute["array"];
  normalized: boolean;
  index: BufferAttribute["array"] | null;
  groups: BufferGeometry["groups"];
  drawRange: BufferGeometry["drawRange"];
  options: Omit<MeshBVHOptions, "onProgress">;
  reportProgress: boolean;
};
export type PhotoBvhReply =
  | { id: number; type: "progress"; progress: number }
  | { id: number; type: "done"; position: BufferAttribute["array"]; bvh: PhotoBvhData }
  | { id: number; type: "error"; message: string };

/** Own one worker and transfer only the path tracer's merged geometry buffers.
 * Reject before terminating so setSceneAsync cannot upload a cancelled result. */
export function createPhotoBvhWorker(
  createWorker: () => Worker = () => new Worker(new URL("./photoBvh.worker.ts", import.meta.url), { type: "module" }),
): BVHWorker & { dispose(): void } {
  const worker = createWorker();
  let disposed = false, sequence = 0;
  let pending: { cancel(error: unknown): void } | null = null;
  const abortError = () => new DOMException("Photo scene preparation cancelled", "AbortError");
  return {
    generate(geometry, options = {}) {
      if (disposed) return Promise.reject(abortError());
      if (pending) return Promise.reject(new Error("Photo BVH generation is already running"));
      const position = geometry.getAttribute("position");
      const index = geometry.getIndex();
      if (!(position instanceof BufferAttribute) || position.itemSize !== 3 ||
          (index && (!(index instanceof BufferAttribute) || index.itemSize !== 1)))
        return Promise.reject(new Error("Photo BVH requires non-interleaved merged positions and indices"));
      return new Promise<MeshBVH>((resolve, reject) => {
        const id = ++sequence;
        const cleanup = () => {
          worker.removeEventListener("message", onMessage);
          worker.removeEventListener("error", onError);
          worker.removeEventListener("messageerror", onMessageError);
        };
        const job = { cancel(error: unknown) {
          if (pending !== job) return;
          pending = null;
          cleanup();
          reject(error);
        } };
        const onError = (event: ErrorEvent) => {
          event.preventDefault();
          job.cancel(new Error(event.message || "Photo BVH worker failed"));
        };
        const onMessageError = () => job.cancel(new Error("Unreadable Photo BVH worker response"));
        const onMessage = (event: MessageEvent<PhotoBvhReply>) => {
          if (disposed || pending !== job || event.data.id !== id) return;
          const data = event.data;
          try {
            if (data.type === "error") throw new Error(data.message);
            if (data.type === "progress") { options.onProgress?.(data.progress); return; }
            if (data.type !== "done") throw new Error("Invalid Photo BVH worker response");
            options.onProgress?.(1);
            // Progress callbacks may synchronously unmount the owner.
            if (disposed || pending !== job) return;
            position.array = data.position;
            if (data.bvh.index) {
              if (index) index.array = data.bvh.index;
              else geometry.setIndex(new BufferAttribute(data.bvh.index, 1));
            }
            const bvh = MeshBVH.deserialize(data.bvh as ReturnType<typeof MeshBVH.serialize>, geometry, { setIndex: false });
            if (options.setBoundingBox !== false && !geometry.boundingBox) geometry.boundingBox = bvh.getBoundingBox(new Box3());
            pending = null;
            cleanup();
            resolve(bvh);
          } catch (error) { job.cancel(error); }
        };
        pending = job;
        worker.addEventListener("message", onMessage);
        worker.addEventListener("error", onError);
        worker.addEventListener("messageerror", onMessageError);
        const { onProgress, ...bvhOptions } = options;
        const message: PhotoBvhRequest = { id, position: position.array, normalized: position.normalized,
          index: index?.array ?? null, groups: geometry.groups.map(group => ({ ...group })),
          drawRange: { ...geometry.drawRange }, options: bvhOptions, reportProgress: !!onProgress };
        const transfer = [...new Set([position.array.buffer, ...(index ? [index.array.buffer] : [])])]
          .filter((buffer): buffer is ArrayBuffer => buffer instanceof ArrayBuffer);
        try { worker.postMessage(message, transfer); }
        catch (error) { job.cancel(error); }
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      pending?.cancel(abortError());
      worker.terminate();
    },
  };
}
