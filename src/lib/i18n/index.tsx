import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { messages } from "./messages";
import type { ProjectSummaryModel, SummaryRow } from "@/lib/project-delivery/summary-model";

export type Locale = "it" | "en";
type Parameters = Record<string, string | number>;
export const LOCALE_STORAGE_KEY = "pool-shaper.locale";
const languageTag = (locale: Locale) => locale === "en" ? "en-GB" : "it-IT";

export function formatNumber(value: number, locale: Locale, options: Intl.NumberFormatOptions = {}): string {
  return new Intl.NumberFormat(languageTag(locale), { useGrouping: false, ...options }).format(value);
}

export function formatDate(value: Date, locale: Locale, options: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat(languageTag(locale), options).format(value);
}

/** Only measurements with an explicit unit: catalogue codes and project references are excluded. */
export function formatNumericText(text: string, locale: Locale): string {
  return text.replace(/(?<![\w.,-])(\d+(?:[.,]\d+)+)(?=\s*(?:×|m²|m³|cm|mm|m|%)(?=$|[\s·×→,;/)]))/g, value => {
    const separator = Math.max(value.lastIndexOf("."), value.lastIndexOf(","));
    const digits = value.length - separator - 1;
    const numeric = Number(`${value.slice(0, separator).replace(/[.,]/g, "")}.${value.slice(separator + 1)}`);
    return formatNumber(numeric, locale, { minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: false });
  });
}

const lookups = { it: new Map<string, string>(), en: new Map<string, string>() };
for (const [it, en] of messages) {
  lookups.it.set(it, it);
  lookups.it.set(en, it);
  lookups.en.set(it, en);
  lookups.en.set(en, en);
}
const templates = messages.filter(([it]) => /\{\w+\}/.test(it)).flatMap(([it, en]) =>
  (["it", "en"] as const).map(sourceLocale => {
    const source = sourceLocale === "it" ? it : en;
    const names: string[] = [];
    const expression = source.split(/(\{\w+\})/).map(part => {
      if (/^\{\w+\}$/.test(part)) { names.push(part.slice(1, -1)); return "(.+?)"; }
      return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }).join("");
    return { expression: new RegExp(`^${expression}$`), names, it, en };
  }),
);

/** Explicit, authored messages. Unknown values (including names and catalogue IDs) are preserved. */
export function translateText(text: string, locale: Locale, params?: Parameters): string {
  const exact = lookups[locale].get(text);
  let result = exact ?? text;
  if (!exact) {
    for (const template of templates) {
      const match = text.match(template.expression);
      if (!match) continue;
      result = template[locale].replace(/\{(\w+)\}/g, (_, name: string) => {
        const captured = match[template.names.indexOf(name) + 1] ?? "";
        return captured.length < text.length ? translateText(captured, locale) : captured;
      });
      break;
    }
  }
  if (result === text && !exact && /(?: · |: |\n| → | — | \+ |, )/.test(text)) {
    const separator = [/( · |\n| → | — | \+ )/, /(: )/, /(, )/].find(pattern => pattern.test(text))!;
    result = text.split(separator).map(part =>
      part.length < text.length ? translateText(part, locale) : part,
    ).join("");
  }
  if (result === text && !exact && /[.!?]\s+/.test(text)) {
    result = text.split(/(?<=[.!?])\s+/).map(part => lookups[locale].get(part) ?? part).join(" ");
  }
  return formatNumericText(params ? result.replace(/\{(\w+)\}/g, (placeholder, name: string) => String(params[name] ?? placeholder)) : result, locale);
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (text: string, params?: Parameters) => string;
  number: (value: number, options?: Intl.NumberFormatOptions) => string;
  date: (value: Date, options?: Intl.DateTimeFormatOptions) => string;
}

const I18nContext = createContext<I18nContextValue>({
  locale: "it",
  setLocale: () => {},
  t: (text, params) => translateText(text, "it", params),
  number: (value, options) => formatNumber(value, "it", options),
  date: (value, options) => formatDate(value, "it", options),
});

/** Presentation preference only: never enters the project snapshot or configurator reducer. */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, updateLocale] = useState<Locale>("it");
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
      if (saved === "it" || saved === "en") updateLocale(saved);
    } catch { /* The language switch also works when storage is unavailable. */ }
  }, []);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  const setLocale = useCallback((next: Locale) => {
    updateLocale(next);
    try { window.localStorage.setItem(LOCALE_STORAGE_KEY, next); } catch { /* Optional preference. */ }
  }, []);
  const value = useMemo<I18nContextValue>(() => ({
    locale,
    setLocale,
    t: (text, params) => translateText(text, locale, params),
    number: (value, options) => formatNumber(value, locale, options),
    date: (value, options) => formatDate(value, locale, options),
  }), [locale, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue { return useContext(I18nContext); }

export function LocaleControls() {
  const { locale, setLocale, t } = useI18n();
  return <div role="group" aria-label={t("Lingua")} className="inline-flex items-center gap-0.5 rounded-full border border-hairline bg-card p-0.5">
    {(["it", "en"] as const).map(language => <button key={language} type="button"
      lang={language} aria-pressed={locale === language} aria-label={t(language === "it" ? "Italiano" : "Inglese")}
      onClick={() => setLocale(language)}
      className={`min-h-8 rounded-full px-2.5 text-[11px] ${locale === language ? "bg-foreground text-background" : "text-muted-foreground"}`}>
      {language.toUpperCase()}
    </button>)}
  </div>;
}

/** Translate customer presentation fields only; project/step IDs and swatches retain their identity. */
export function localizeSummaryModel(model: ProjectSummaryModel, locale: Locale): ProjectSummaryModel {
  const t = (text: string) => formatNumericText(translateText(text, locale), locale);
  const row = (value: SummaryRow): SummaryRow => ({ ...value, label: t(value.label), value: t(value.value),
    ...(value.hint ? { hint: t(value.hint) } : {}) });
  return { ...model, headline: t(model.headline), subline: t(model.subline), technicalNote: t(model.technicalNote),
    sections: model.sections.map(section => ({ ...section, title: t(section.title), rows: section.rows.map(row) })),
    technical: model.technical.map(row), deferred: model.deferred.map(t),
    plan: { ...model.plan, depthLabel: t(model.plan.depthLabel) } };
}
