import { SRGBColorSpace, Texture, TextureLoader } from "three";
import { MOSAIC_ASSETS } from "@/configurator/materials/mosaic-assets.generated";

type Subscriber = { ready: () => void; error: (error: unknown) => void };
type Entry = { source: Texture; ready: boolean; subscribers: Set<Subscriber> };
const images = new Map<string, Entry>();
const loader = new TextureLoader();
const catalogueUrls = new Set(MOSAIC_ASSETS.map(asset => `/textures/mosaico/${encodeURIComponent(asset.filename)}`));

/** Only the finite mosaic catalogue is cached. Source UUID stays stable, so
 * existing photo-derived detail maps are reused instead of baked again on
 * every reselection. Each mounted consumer still owns/disposes its texture. */
export function requestMosaicTexture(url: string, onReady: (texture: Texture) => void, onError: (error: unknown) => void) {
  if (!catalogueUrls.has(url)) throw new Error("Mosaic-only texture cache");
  let entry = images.get(url);
  if (!entry) {
    const next = { ready: false, subscribers: new Set<Subscriber>() } as Entry;
    next.source = loader.load(url, () => {
      next.ready = true;
      for (const subscriber of [...next.subscribers]) subscriber.ready();
      next.subscribers.clear();
    }, undefined, error => {
      if (images.get(url) === next) images.delete(url);
      for (const subscriber of [...next.subscribers]) subscriber.error(error);
      next.subscribers.clear();
      next.source.dispose();
    });
    next.source.colorSpace = SRGBColorSpace;
    images.set(url, next);
    entry = next;
  }
  const texture = new Texture();
  texture.source = entry.source.source;
  texture.colorSpace = SRGBColorSpace;
  let active = true, delivered = false;
  const subscriber: Subscriber = {
    ready: () => {
      if (!active) return;
      delivered = true;
      texture.needsUpdate = true;
      onReady(texture);
    },
    error: error => { if (active) { texture.dispose(); onError(error); } },
  };
  if (entry.ready) queueMicrotask(subscriber.ready);
  else entry.subscribers.add(subscriber);
  return () => {
    active = false;
    entry.subscribers.delete(subscriber);
    if (!delivered) texture.dispose();
  };
}
