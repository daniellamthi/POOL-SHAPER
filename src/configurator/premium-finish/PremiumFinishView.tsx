import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  resolvePremiumFinishAsset,
  resolvePremiumFinishFamilyAssets,
  type PremiumFinishAsset,
  type PremiumFinishConfig,
} from "./premium-finish-assets";

interface PremiumFinishViewProps {
  config: PremiumFinishConfig;
  fallback: ReactNode;
}

function preloadImage(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
    image.src = src;
  });
}

const preloadSource = (asset: PremiumFinishAsset) =>
  window.matchMedia("(max-width: 1023px)").matches
    ? asset.sources.webp.mobile
    : asset.sources.webp.desktop;

function PremiumPicture({ asset, visible }: { asset: PremiumFinishAsset; visible: boolean }) {
  const position = `${asset.focalPoint.x}% ${asset.focalPoint.y}%`;
  return (
    <picture
      className={`absolute inset-0 transition-opacity duration-300 ease-out ${visible ? "opacity-100" : "opacity-0"}`}
    >
      <source
        type="image/avif"
        srcSet={`${asset.sources.avif.mobile} 960w, ${asset.sources.avif.desktop} 1920w`}
        sizes="(max-width: 1023px) 100vw, calc(100vw - 452px)"
      />
      <img
        src={asset.sources.webp.desktop}
        srcSet={`${asset.sources.webp.mobile} 960w, ${asset.sources.webp.desktop} 1920w`}
        sizes="(max-width: 1023px) 100vw, calc(100vw - 452px)"
        alt={asset.alt}
        className="h-full w-full object-cover"
        style={{ objectPosition: position }}
        draggable={false}
      />
    </picture>
  );
}

export function PremiumFinishView({ config, fallback }: PremiumFinishViewProps) {
  const requested = useMemo(() => resolvePremiumFinishAsset(config), [config]);
  const familyAssets = useMemo(() => resolvePremiumFinishFamilyAssets(config), [config]);
  const [active, setActive] = useState<PremiumFinishAsset | null>(null);
  const [previous, setPrevious] = useState<PremiumFinishAsset | null>(null);
  const [visible, setVisible] = useState(true);
  const activeRef = useRef<PremiumFinishAsset | null>(null);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    let cancelled = false;
    let fadeFrame = 0;
    let cleanupTimer = 0;

    if (!requested) {
      activeRef.current = null;
      setActive(null);
      setPrevious(null);
      setVisible(true);
      return;
    }

    void preloadImage(preloadSource(requested)).then((available) => {
      if (cancelled) return;
      if (!available) {
        activeRef.current = null;
        setActive(null);
        setPrevious(null);
        setVisible(true);
        return;
      }

      const current = activeRef.current;
      if (current?.id === requested.id) return;
      setPrevious(current);
      setActive(requested);
      activeRef.current = requested;
      setVisible(current === null);
      if (current) {
        fadeFrame = requestAnimationFrame(() => setVisible(true));
        cleanupTimer = window.setTimeout(() => setPrevious(null), 360);
      }

      window.setTimeout(() => {
        for (const candidate of familyAssets) {
          if (candidate.id !== requested.id) {
            const image = new Image();
            image.src = preloadSource(candidate);
          }
        }
      }, 500);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(fadeFrame);
      window.clearTimeout(cleanupTimer);
    };
  }, [requested, familyAssets]);

  if (!active) return fallback;

  return (
    <div className="relative h-full w-full overflow-hidden bg-viewport">
      {previous ? <PremiumPicture asset={previous} visible /> : null}
      <PremiumPicture asset={active} visible={visible} />
    </div>
  );
}
