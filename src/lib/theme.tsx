import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "pool-studio-theme";

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // The configurator shell is always the white daytime interface. Night is
  // no longer a global theme: it is previewed only inside the scene, in the
  // lighting step, where LED colours are evaluated (see PoolConfigurator).
  const [theme, setTheme] = useState<Theme>("light");

  // Read the resolved theme after hydration (the inline boot script already
  // applied the class, so there is no flash).
  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === "dark" ? "light" : "dark";
      document.documentElement.classList.toggle("dark", next === "dark");
      document.documentElement.style.colorScheme = next;
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  }, []);

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}

/** Runs before paint to avoid a theme flash. Injected in the document head.
 * Always starts in the light (day) shell -- neither the OS preference nor a
 * previously stored dark choice turns the whole configurator into night. */
export const THEME_BOOT_SCRIPT = `(function(){try{localStorage.removeItem("${STORAGE_KEY}");}catch(e){}var d=document.documentElement;d.classList.remove("dark");d.style.colorScheme="light";})();`;
