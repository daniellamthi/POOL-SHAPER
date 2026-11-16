import type { Locale } from "@/lib/i18n";

const formatter = (digits: number, locale?: Locale) =>
  new Intl.NumberFormat(locale === "it" ? "it-IT" : locale === "en" ? "en-GB" : "en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const formatNumber = (value: number, digits = 2, locale?: Locale) => formatter(digits, locale).format(value);

export const formatMeasure = (value: number, unit: string, digits = 2, locale?: Locale) =>
  `${formatNumber(value, digits, locale)} ${unit}`;
