import type { ReactNode } from "react";

/**
 * Architectural line illustrations for the option cards: sections and plans
 * in the language of a technical brochure, so a customer who knows nothing
 * about pools sees the difference between two choices before selecting.
 * Pure SVG (no assets, no network), themed through `currentColor`.
 */
const WATER = "#7fb8c9";
const STONE = "#cfc6b6";

function Frame({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 160 100"
      className="h-full w-full"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

/** Ground line + soil hatch used by every section drawing. */
function Ground({ y = 30 }: { y?: number }) {
  return (
    <>
      <line x1="6" y1={y} x2="154" y2={y} />
      {Array.from({ length: 14 }, (_, i) => (
        <line
          key={i}
          x1={10 + i * 10}
          y1={y + 2}
          x2={6 + i * 10}
          y2={y + 6}
          strokeWidth={0.6}
          opacity={0.45}
        />
      ))}
    </>
  );
}

const sections: Record<string, ReactNode> = {
  "project-new": (
    <Frame>
      <rect x="30" y="28" width="100" height="44" rx="3" />
      <rect
        x="36"
        y="34"
        width="88"
        height="32"
        rx="2"
        fill={WATER}
        fillOpacity={0.35}
        stroke="none"
      />
      <path d="M118 16 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" strokeWidth={1.1} />
    </Frame>
  ),
  "project-renovation": (
    <Frame>
      <rect x="30" y="28" width="100" height="44" rx="3" strokeDasharray="4 3" />
      <rect
        x="36"
        y="34"
        width="88"
        height="32"
        rx="2"
        fill={WATER}
        fillOpacity={0.25}
        stroke="none"
      />
      <path d="M110 20 l14 14 M106 16 a6 6 0 1 0 8 8" />
    </Frame>
  ),
  "pooltype-in-ground": (
    <Frame>
      <Ground y={34} />
      <path d="M36 34 v38 h88 v-38" strokeWidth={2} />
      <rect x="38" y="40" width="84" height="31" fill={WATER} fillOpacity={0.4} stroke="none" />
      <line x1="38" y1="40" x2="122" y2="40" stroke={WATER} />
    </Frame>
  ),
  "pooltype-above-ground": (
    <Frame>
      <Ground y={78} />
      <path d="M36 78 v-40 h88 v40" strokeWidth={2} />
      <rect x="38" y="46" width="84" height="31" fill={WATER} fillOpacity={0.4} stroke="none" />
      <path d="M124 78 l12 -10 M124 70 l8 -6 M124 62 l4 -3" strokeWidth={1} />
    </Frame>
  ),
  "structure-reinforced-concrete": (
    <Frame>
      <Ground y={26} />
      <path d="M30 26 v52 h100 v-52 M40 26 v42 h80 v-42" strokeWidth={1.6} />
      <path d="M30 78 h100" />
      {Array.from({ length: 9 }, (_, i) => (
        <circle key={i} cx={36 + i * 11} cy={73} r={1.2} fill="currentColor" stroke="none" />
      ))}
      {[34, 44, 54, 64].map((y) => (
        <circle key={y} cx={35} cy={y} r={1.2} fill="currentColor" stroke="none" />
      ))}
      <rect x="40" y="32" width="80" height="36" fill={WATER} fillOpacity={0.3} stroke="none" />
    </Frame>
  ),
  "structure-modular-steel-panels": (
    <Frame>
      <Ground y={26} />
      <path d="M38 26 v46 h84 v-46" strokeWidth={2.2} />
      {[50, 62, 74, 86, 98, 110].map((x) => (
        <line key={x} x1={x} y1={72} x2={x} y2={76} />
      ))}
      <path d="M38 34 l-10 30 M122 34 l10 30" strokeWidth={1.1} />
      <rect x="40" y="32" width="80" height="39" fill={WATER} fillOpacity={0.3} stroke="none" />
      <line x1="40" y1="32" x2="40" y2="71" strokeDasharray="2 3" />
    </Frame>
  ),
  "structure-visible-stainless-steel": (
    <Frame>
      <Ground y={26} />
      <path d="M38 26 v46 h84 v-46" strokeWidth={1.2} />
      <rect x="39" y="30" width="82" height="41" fill={WATER} fillOpacity={0.25} stroke="none" />
      {[46, 56, 66, 76, 86, 96, 106, 116].map((x) => (
        <line key={x} x1={x} y1={34} x2={x - 4} y2={68} strokeWidth={0.6} opacity={0.5} />
      ))}
      <path d="M44 36 l10 0" strokeWidth={2.2} stroke="#ffffff" />
    </Frame>
  ),
  "shape-rectangle": (
    <Frame>
      <rect x="30" y="22" width="100" height="56" rx="2" fill={WATER} fillOpacity={0.3} />
    </Frame>
  ),
  "shape-l-shape": (
    <Frame>
      <path d="M30 22 h100 v34 h-46 v22 h-54z" fill={WATER} fillOpacity={0.3} />
    </Frame>
  ),
  "shape-organic": (
    <Frame>
      <path
        d="M38 50 C38 22 78 18 104 26 C132 34 136 64 116 74 C92 86 78 64 58 76 C40 86 38 66 38 50z"
        fill={WATER}
        fillOpacity={0.3}
      />
    </Frame>
  ),
  "shape-custom": (
    <Frame>
      <path
        d="M32 30 L74 20 L128 32 L120 74 L70 80 L40 64z"
        fill={WATER}
        fillOpacity={0.3}
        strokeDasharray="5 3"
      />
      {[
        [32, 30],
        [74, 20],
        [128, 32],
        [120, 74],
        [70, 80],
        [40, 64],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={2.4} fill="currentColor" stroke="none" />
      ))}
    </Frame>
  ),
  "system-skimmer": (
    <Frame>
      <Ground y={28} />
      <path d="M24 28 h12 M124 28 h12" strokeWidth={3} stroke={STONE} />
      <path d="M36 28 v50 h88 v-50" strokeWidth={1.8} />
      <rect x="38" y="38" width="84" height="39" fill={WATER} fillOpacity={0.4} stroke="none" />
      <line x1="38" y1="38" x2="122" y2="38" stroke={WATER} strokeWidth={1.2} />
      <rect x="112" y="33" width="12" height="9" rx="1" fill="currentColor" fillOpacity={0.15} />
      <path d="M131 38 h10 M138 35 l3 3 -3 3" strokeWidth={1} />
      <text x="138" y="52" fontSize="7" fill="currentColor" stroke="none" textAnchor="middle">
        −12 cm
      </text>
    </Frame>
  ),
  "system-overflow": (
    <Frame>
      <Ground y={30} />
      <path d="M36 30 v48 h88 v-48" strokeWidth={1.8} />
      <rect x="38" y="30" width="84" height="47" fill={WATER} fillOpacity={0.45} stroke="none" />
      <path d="M22 30 h12 v8 h-12z M126 30 h12 v8 h-12z" fill="currentColor" fillOpacity={0.12} />
      {[24, 27, 30, 128, 131, 134].map((x) => (
        <line key={x} x1={x} y1={30} x2={x} y2={33} strokeWidth={0.8} />
      ))}
      <path d="M38 29 h84" stroke={WATER} strokeWidth={2} />
    </Frame>
  ),
  "system-infinity": (
    <Frame>
      <line x1="6" y1="30" x2="40" y2="30" />
      <path d="M40 30 v46 h80 v-40" strokeWidth={1.8} />
      <rect x="42" y="30" width="78" height="45" fill={WATER} fillOpacity={0.45} stroke="none" />
      <path d="M120 30 C126 34 126 52 128 62" stroke={WATER} strokeWidth={2.2} />
      <path d="M122 62 v14 h22 v-14" strokeWidth={1.4} />
      <rect x="123" y="66" width="20" height="9" fill={WATER} fillOpacity={0.4} stroke="none" />
      <path d="M128 18 h26" strokeDasharray="2 3" opacity={0.6} />
    </Frame>
  ),
  "overflow-hidden": (
    <Frame>
      <path d="M30 40 v40 h70" strokeWidth={1.6} />
      <rect x="32" y="40" width="68" height="39" fill={WATER} fillOpacity={0.4} stroke="none" />
      <path d="M100 38 h34" strokeWidth={4} stroke={STONE} />
      <path d="M104 44 v14 h14 v-14" />
      <path d="M100 40 C104 41 106 44 108 50" stroke={WATER} strokeWidth={1.4} />
    </Frame>
  ),
  "overflow-visible": (
    <Frame>
      <path d="M30 40 v40 h70" strokeWidth={1.6} />
      <rect x="32" y="40" width="68" height="39" fill={WATER} fillOpacity={0.4} stroke="none" />
      <path d="M102 40 h20" />
      {[104, 108, 112, 116, 120].map((x) => (
        <line key={x} x1={x} y1={38} x2={x} y2={42} strokeWidth={1.2} />
      ))}
      <path d="M102 44 v14 h20 v-14" />
      <path d="M122 38 h16" strokeWidth={4} stroke={STONE} />
    </Frame>
  ),
  "access-steps": (
    <Frame>
      <path d="M30 26 h10 v10 h12 v10 h12 v10 h12 v10 h50" strokeWidth={1.6} />
      <path d="M30 26 v50 h96 v-50" opacity={0.35} />
      <rect x="40" y="30" width="86" height="46" fill={WATER} fillOpacity={0.25} stroke="none" />
    </Frame>
  ),
  "access-steps-corner": (
    <Frame>
      <rect x="34" y="20" width="92" height="60" rx="2" fill={WATER} fillOpacity={0.25} />
      {[14, 24, 34].map((r) => (
        <path key={r} d={`M${34 + r} 20 A${r} ${r} 0 0 1 34 ${20 + r}`} />
      ))}
    </Frame>
  ),
  "access-steps-linear": (
    <Frame>
      <rect x="34" y="20" width="92" height="60" rx="2" fill={WATER} fillOpacity={0.25} />
      {[10, 20, 30].map((d) => (
        <line key={d} x1={34 + d} y1={20} x2={34 + d} y2={44} />
      ))}
      <line x1="34" y1="44" x2="64" y2="44" />
    </Frame>
  ),
  "access-ladder": (
    <Frame>
      <Ground y={30} />
      <path d="M60 78 V36 C60 18 74 18 74 30 M86 78 V36 C86 18 100 18 100 30" strokeWidth={2} />
      {[46, 56, 66, 76].map((y) => (
        <line key={y} x1={60} y1={y} x2={86} y2={y} strokeWidth={2.4} />
      ))}
      <rect x="40" y="36" width="80" height="42" fill={WATER} fillOpacity={0.25} stroke="none" />
    </Frame>
  ),
  "access-external": (
    <Frame>
      <Ground y={78} />
      <path d="M70 78 v-44 h70 v44" strokeWidth={1.8} />
      <path d="M20 78 h10 v-8 h10 v-8 h10 v-8 h10 v-8 h10" strokeWidth={1.6} />
      <rect x="72" y="42" width="66" height="35" fill={WATER} fillOpacity={0.35} stroke="none" />
    </Frame>
  ),
  "comfort-none": (
    <Frame>
      <path d="M30 30 v48 h100 v-48" strokeWidth={1.6} />
      <rect x="32" y="36" width="96" height="41" fill={WATER} fillOpacity={0.3} stroke="none" />
    </Frame>
  ),
  "comfort-sunShelf": (
    <Frame>
      <path d="M30 30 v14 h40 v34 h60 v-48" strokeWidth={1.6} />
      <rect x="32" y="36" width="38" height="7" fill={WATER} fillOpacity={0.25} stroke="none" />
      <rect x="70" y="36" width="58" height="41" fill={WATER} fillOpacity={0.4} stroke="none" />
      <circle cx="46" cy="18" r="6" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <line
          key={a}
          x1={46 + Math.cos((a * Math.PI) / 180) * 9}
          y1={18 + Math.sin((a * Math.PI) / 180) * 9}
          x2={46 + Math.cos((a * Math.PI) / 180) * 12}
          y2={18 + Math.sin((a * Math.PI) / 180) * 12}
        />
      ))}
    </Frame>
  ),
  "comfort-hydro-closed": (
    <Frame>
      <rect x="28" y="20" width="104" height="60" rx="2" fill={WATER} fillOpacity={0.25} />
      <path d="M28 20 h44 v40 h-44" strokeWidth={1.8} />
      <path d="M30 22 h38 v8 h-30 v28 h-8z" fill="currentColor" fillOpacity={0.12} />
      {[
        [46, 40],
        [54, 46],
        [48, 50],
        [58, 38],
      ].map(([x, y]) => (
        <circle key={`${x}${y}`} cx={x} cy={y} r={2} />
      ))}
    </Frame>
  ),
  "comfort-hydro-open": (
    <Frame>
      <rect x="28" y="20" width="104" height="60" rx="2" fill={WATER} fillOpacity={0.25} />
      <path d="M28 20 h44 v40" strokeWidth={1.8} />
      <path d="M30 22 h38 v8 h-30 v30 h-8z M68 30 v30" fill="currentColor" fillOpacity={0.12} />
      {[
        [46, 40],
        [54, 46],
        [48, 50],
        [58, 38],
      ].map(([x, y]) => (
        <circle key={`${x}${y}`} cx={x} cy={y} r={2} />
      ))}
    </Frame>
  ),
  "comfort-bench": (
    <Frame>
      <path d="M30 30 v48 h100 v-48" strokeWidth={1.6} />
      <path d="M112 30 v22 h18" strokeWidth={1.6} fill="currentColor" fillOpacity={0.1} />
      <rect x="32" y="36" width="80" height="41" fill={WATER} fillOpacity={0.35} stroke="none" />
    </Frame>
  ),
  "led-on": (
    <Frame>
      <rect x="20" y="16" width="120" height="68" rx="3" fill="#0f2233" stroke="none" />
      <path d="M40 60 l40 -26 l40 26" fill={WATER} fillOpacity={0.35} stroke="none" />
      <circle cx="80" cy="34" r="5" fill="#ffffff" stroke="none" />
    </Frame>
  ),
  "led-off": (
    <Frame>
      <rect x="20" y="16" width="120" height="68" rx="3" fill="#0f2233" fillOpacity={0.15} />
      <circle cx="80" cy="34" r="5" />
    </Frame>
  ),
  "time-day": (
    <Frame>
      <circle cx="112" cy="28" r="9" />
      <path d="M20 70 h120" />
      <rect x="40" y="56" width="80" height="14" fill={WATER} fillOpacity={0.4} stroke="none" />
    </Frame>
  ),
  "time-night": (
    <Frame>
      <rect x="10" y="10" width="140" height="80" rx="4" fill="#0f1b28" stroke="none" />
      <path d="M116 22 a9 9 0 1 0 9 12 a7 7 0 1 1 -9 -12z" fill="#e9e4d4" stroke="none" />
      <rect x="40" y="56" width="80" height="14" fill="#2f86c9" fillOpacity={0.8} stroke="none" />
    </Frame>
  ),
  "equipment-automaticCover": (
    <Frame>
      <rect x="30" y="24" width="100" height="52" rx="2" fill={WATER} fillOpacity={0.3} />
      {Array.from({ length: 8 }, (_, i) => (
        <line key={i} x1={30 + i * 7} y1={24} x2={30 + i * 7} y2={76} />
      ))}
      <rect x="18" y="22" width="8" height="56" rx="3" />
    </Frame>
  ),
  "equipment-heatPump": (
    <Frame>
      <rect x="44" y="26" width="72" height="48" rx="4" />
      <circle cx="68" cy="50" r="14" />
      <path d="M68 36 v28 M54 50 h28" strokeWidth={0.8} />
      <path d="M96 38 v24 M102 38 v24 M108 38 v24" strokeWidth={0.8} />
    </Frame>
  ),
  "equipment-saltElectrolysis": (
    <Frame>
      <path d="M50 20 h60 M58 20 v58 h44 v-58" />
      {(
        [
          [70, 50],
          [86, 44],
          [80, 62],
          [92, 58],
        ] as const
      ).map(([x, y]) => (
        <path key={`${x}${y}`} d={`M${x} ${y - 4} l4 4 -4 4 -4 -4z`} />
      ))}
    </Frame>
  ),
  "equipment-automaticDosing": (
    <Frame>
      <rect x="40" y="30" width="36" height="46" rx="4" />
      <rect x="88" y="22" width="30" height="54" rx="3" />
      <path d="M76 52 h12" />
      <text x="58" y="56" fontSize="9" fill="currentColor" stroke="none" textAnchor="middle">
        pH
      </text>
    </Frame>
  ),
  "equipment-solarShower": (
    <Frame>
      <rect
        x="74"
        y="12"
        width="10"
        height="76"
        rx="1"
        fill="currentColor"
        fillOpacity={0.85}
        stroke="none"
      />
      <path d="M84 16 h18" strokeWidth={1.6} />
      <ellipse cx="104" cy="17" rx="8" ry="2" />
      {[98, 102, 106, 110].map((x) => (
        <line
          key={x}
          x1={x}
          y1={22}
          x2={x - 2}
          y2={36}
          strokeWidth={0.6}
          strokeDasharray="2 2"
          stroke={WATER}
        />
      ))}
      <rect
        x="62"
        y="86"
        width="44"
        height="4"
        fill="currentColor"
        fillOpacity={0.3}
        stroke="none"
      />
    </Frame>
  ),
  "env-outdoor-villa": (
    <Frame>
      <path d="M20 52 h120" />
      <rect x="92" y="26" width="44" height="26" />
      <path d="M92 26 h44" strokeWidth={2.4} />
      <rect x="24" y="58" width="64" height="16" fill={WATER} fillOpacity={0.4} stroke="none" />
      <path d="M30 52 c0 -10 6 -14 6 -22 c0 8 6 12 6 22" />
    </Frame>
  ),
  "env-indoor-wellness": (
    <Frame>
      <path d="M20 84 V30 L80 14 L140 30 V84" />
      {[44, 68, 92, 116].map((x) => (
        <line key={x} x1={x} y1={24} x2={x} y2={84} opacity={0.5} />
      ))}
      <rect x="36" y="62" width="88" height="14" fill={WATER} fillOpacity={0.4} stroke="none" />
    </Frame>
  ),
  "env-panorama-infinity": (
    <Frame>
      <path d="M10 46 h140" stroke={WATER} />
      <path d="M10 46 c20 -6 30 -2 44 -10 c10 6 18 4 26 10" />
      <rect x="30" y="58" width="100" height="16" fill={WATER} fillOpacity={0.45} stroke="none" />
      <path d="M130 58 v16" strokeDasharray="2 2" />
    </Frame>
  ),
  photo: (
    <Frame>
      <rect x="34" y="28" width="92" height="56" rx="6" />
      <circle cx="80" cy="56" r="16" />
      <circle cx="80" cy="56" r="8" />
      <rect x="62" y="20" width="22" height="8" rx="2" />
    </Frame>
  ),
};

/** Look up the illustration for a choice key; a neutral plan as fallback. */
export function Illustration({ name }: { name: string }) {
  return <>{sections[name] ?? sections["comfort-none"]}</>;
}
