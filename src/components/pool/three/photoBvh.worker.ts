import { BufferAttribute, BufferGeometry } from "three";
import { MeshBVH } from "three-mesh-bvh";
import type { PhotoBvhData, PhotoBvhReply, PhotoBvhRequest } from "./photoBvhWorker";

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<PhotoBvhRequest>) => void) | null;
  postMessage(message: PhotoBvhReply, transfer?: Transferable[]): void;
};
scope.onmessage = ({ data }) => {
  try {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(data.position, 3, data.normalized));
    if (data.index) geometry.setIndex(new BufferAttribute(data.index, 1));
    geometry.groups = data.groups;
    geometry.setDrawRange(data.drawRange.start, data.drawRange.count);
    let lastProgress = performance.now();
    const bvh = new MeshBVH(geometry, { ...data.options, ...(data.reportProgress ? {
      onProgress: (progress: number) => {
        const now = performance.now();
        if (progress < 1 && now - lastProgress >= 10) {
          scope.postMessage({ id: data.id, type: "progress", progress });
          lastProgress = now;
        }
      },
    } : {}) });
    const serialized = MeshBVH.serialize(bvh, { cloneBuffers: false }) as PhotoBvhData;
    const transfer = [...new Set([data.position.buffer, ...serialized.roots,
      ...(serialized.index ? [serialized.index.buffer] : []),
      ...(serialized.indirectBuffer ? [serialized.indirectBuffer.buffer] : [])])]
      .filter((buffer): buffer is ArrayBuffer => buffer instanceof ArrayBuffer);
    scope.postMessage({ id: data.id, type: "done", position: data.position, bvh: serialized }, transfer);
  } catch (error) {
    scope.postMessage({ id: data.id, type: "error", message: error instanceof Error ? error.message : String(error) });
  }
};
