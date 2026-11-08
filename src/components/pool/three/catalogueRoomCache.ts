import type { PMREMGenerator, WebGLRenderTarget } from "three";

export interface CatalogueRoomCache {
  key: string;
  targets: WebGLRenderTarget[] | null;
  generator: { current: PMREMGenerator | null };
}

/** One geometry/GPU generation owns two indoor captures and an empty exterior
 * slot. Reuse the filtering generator; dispose only when that owner changes. */
export function createCatalogueRoomCachePool() {
  const entries = new Map<string, CatalogueRoomCache>();
  const generator: CatalogueRoomCache["generator"] = { current: null };
  return {
    get(key: string): CatalogueRoomCache {
      let entry = entries.get(key);
      if (!entry) {
        if (entries.size >= 3) throw new Error("Room reflection cache capacity exceeded");
        entry = { key, targets: null, generator };
        entries.set(key, entry);
      }
      return entry;
    },
    dispose(): void {
      for (const entry of entries.values()) {
        entry.targets?.forEach((target) => target.dispose());
        entry.targets = null;
      }
      generator.current?.dispose();
      generator.current = null;
      // Keep entry identities valid during Strict Mode effect replay.
    },
  };
}
