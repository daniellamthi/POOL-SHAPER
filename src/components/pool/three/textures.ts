import * as THREE from "three";

/** Procedural tiling ripple normal map — no external assets, generated once. */
export function createRippleNormalMap(size = 256): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(size, size);

  const height = (x: number, y: number) => {
    const u = (x / size) * Math.PI * 2;
    const v = (y / size) * Math.PI * 2;
    return (
      Math.sin(u * 3 + Math.sin(v * 2) * 0.8) * 0.5 +
      Math.sin(v * 4 - Math.cos(u * 3) * 0.6) * 0.35 +
      Math.sin((u + v) * 6) * 0.15
    );
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = height((x + 1) % size, y) - height((x - 1 + size) % size, y);
      const dy = height(x, (y + 1) % size) - height(x, (y - 1 + size) % size);
      const inverseLength = 1 / Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      image.data[i] = (-dx * inverseLength * 0.5 + 0.5) * 255;
      image.data[i + 1] = (-dy * inverseLength * 0.5 + 0.5) * 255;
      image.data[i + 2] = (inverseLength * 0.5 + 0.5) * 255;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/** Soft animated caustics pattern projected on the pool floor. */
export function createCausticsMap(size = 256): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * Math.PI * 2;
      const v = (y / size) * Math.PI * 2;
      const w =
        Math.sin(u * 3 + Math.sin(v * 2.5) * 1.4) + Math.sin(v * 3.5 + Math.cos(u * 2) * 1.2);
      const intensity = Math.pow(Math.max(0, w * 0.5 + 0.5), 4);
      const i = (y * size + x) * 4;
      const value = 40 + intensity * 215;
      image.data[i] = value;
      image.data[i + 1] = value;
      image.data[i + 2] = value;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}
