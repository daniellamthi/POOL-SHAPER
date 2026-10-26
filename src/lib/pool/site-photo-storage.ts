import type { PhotoPoint } from "./site-photo-camera";
export interface SitePhotoDraft {
  version: 1;
  projectId: string;
  image: string;
  width: number;
  height: number;
  points: PhotoPoint[];
  length: string;
  depth: string;
  knownFov: string;
  offsetX: number;
  offsetZ: number;
  rotation: number;
}
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let blocked = false;
    const request = indexedDB.open("pool-shaper-site-photos", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("photos", { keyPath: "projectId" });
    request.onsuccess = () => {
      if (blocked) request.result.close();
      else {
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      }
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      blocked = true;
      reject(new Error("Photo storage blocked"));
    };
  });
}
export function validSitePhoto(value: unknown, projectId: string): value is SitePhotoDraft {
  if (!value || typeof value !== "object") return false;
  const d = value as SitePhotoDraft;
  return (
    d.version === 1 &&
    d.projectId === projectId &&
    typeof d.image === "string" &&
    d.image.length <= 4000000 &&
    /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(d.image) &&
    [d.width, d.height].every((v) => Number.isInteger(v) && v >= 100 && v <= 1800) &&
    Array.isArray(d.points) &&
    d.points.length <= 4 &&
    d.points.every(
      (p) =>
        Array.isArray(p) &&
        p.length === 2 &&
        p.every(Number.isFinite) &&
        p[0] >= 0 &&
        p[0] <= d.width &&
        p[1] >= 0 &&
        p[1] <= d.height,
    ) &&
    [d.length, d.depth, d.knownFov].every((v) => typeof v === "string" && v.length <= 20) &&
    [d.offsetX, d.offsetZ, d.rotation].every(Number.isFinite) &&
    Math.abs(d.offsetX) <= 100 &&
    Math.abs(d.offsetZ) <= 100 &&
    Math.abs(d.rotation) <= 360
  );
}
export async function readSitePhoto(projectId: string): Promise<SitePhotoDraft | null> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction("photos", "readonly").objectStore("photos").get(projectId);
      request.onsuccess = () => {
        const value: unknown = request.result;
        if (value === undefined) resolve(null);
        else if (validSitePhoto(value, projectId)) resolve(value);
        else reject(new Error("Unreadable photo draft"));
      };
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}
export async function writeSitePhoto(draft: SitePhotoDraft): Promise<void> {
  if (!validSitePhoto(draft, draft.projectId)) throw new Error("Invalid photo draft");
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("photos", "readwrite");
      transaction.objectStore("photos").put(draft);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}
export async function prepareSitePhoto(
  file: File,
): Promise<{ image: string; width: number; height: number }> {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 20 * 1024 * 1024
  )
    throw new Error("file");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (image.naturalWidth < 100 || image.naturalHeight < 100) throw new Error("file");
    const factor = Math.min(1, 1800 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.naturalWidth * factor);
    canvas.height = Math.round(image.naturalHeight * factor);
    if (canvas.width < 100 || canvas.height < 100) throw new Error("file");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("image");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return {
      image: canvas.toDataURL("image/jpeg", 0.88),
      width: canvas.width,
      height: canvas.height,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}
