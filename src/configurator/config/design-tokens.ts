export const DESIGN_TOKENS = {
  icon: { size: 16, strokeWidth: 1.15 },
  transition: { fast: 240, standard: 500, slow: 700 },
  radius: { control: 999, card: 18, panel: 0 },
  spacing: { panelX: 44, section: 56 },
  typography: { displayWeight: 200, bodyWeight: 300, labelTracking: "0.22em" },
  elevation: { card: "var(--shadow-lift)", panel: "var(--shadow-panel)" },
  accent: { primary: "var(--brand)", subtle: "var(--brand-soft)" },
} as const;
