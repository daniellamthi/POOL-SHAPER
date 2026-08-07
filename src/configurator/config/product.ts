import piscineWellnessLogo from "@/configurator/assets/icons/piscine-wellness-logo.png";

/** Single rebranding surface for template customers. */
export const PRODUCT_BRAND = {
  name: "Piscine Wellness",
  productName: "Pool Studio",
  descriptor: "Swimming Pool Configurator",
  logoUrl: piscineWellnessLogo as string | null,
  logoAlt: "Piscine Wellness",
} as const;

/** Replace null values with hosted or bundled assets without touching components. */
export const PRODUCT_ASSETS = {
  waterNormalMap: null as string | null,
  causticsMap: null as string | null,
  environmentMap: null as string | null,
  productImages: {} as Readonly<Record<string, string>>,
} as const;
