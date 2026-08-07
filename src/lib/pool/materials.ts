import { FINISHES, LINER_COLORS } from "./config";
import { POOL_BORDER_PRESET } from "@/configurator/materials/visual-presets";
import { getInteriorTexture } from "@/configurator/materials/interior-textures";
import type { PoolConfig } from "./types";

export interface ResolvedMaterials {
  liner: { color: string; roughness: number; metalness: number };
  floor: { color: string; roughness: number };
  surface: { textureUrl: string; tileSize: number; bumpScale: number };
  water: string;
  coping: { color: string; roughness: number };
}

/** Slightly darken a hex colour (floor reads deeper than the walls). */
function shade(hex: string, amount: number): string {
  const value = hex.replace("#", "");
  const num = Number.parseInt(value, 16);
  const channels = [(num >> 16) & 255, (num >> 8) & 255, num & 255].map((c) =>
    Math.round(Math.max(0, Math.min(255, c * amount))),
  );
  return `#${channels.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

const WATER_TINT: Record<string, string> = {
  white: "#3fb6d6",
  sand: "#3fbfc0",
  lightGrey: "#1f9dbf",
  darkGrey: "#0d5f7a",
  blue: "#1178a8",
  green: "#177f7a",
};

export function resolveMaterials(
  config: Pick<PoolConfig, "finish" | "linerColor">,
): ResolvedMaterials {
  const finish = FINISHES.find((item) => item.id === config.finish) ?? FINISHES[0]!;
  const linerColor = LINER_COLORS.find((item) => item.id === config.linerColor) ?? LINER_COLORS[0]!;

  const linerHex = config.finish === "liner" ? linerColor.hex : shade(linerColor.hex, 0.88);
  const water = WATER_TINT[config.linerColor] ?? "#1f9dbf";

  return {
    liner: { color: linerHex, roughness: finish.roughness, metalness: finish.metalness },
    floor: { color: shade(linerHex, 0.92), roughness: finish.roughness },
    surface: {
      textureUrl: getInteriorTexture(config.finish, config.linerColor),
      tileSize: config.finish === "mosaic" ? 0.42 : 1.6,
      bumpScale: config.finish === "mosaic" ? 0.012 : 0,
    },
    water,
    coping: { color: POOL_BORDER_PRESET.color, roughness: POOL_BORDER_PRESET.roughness },
  };
}
