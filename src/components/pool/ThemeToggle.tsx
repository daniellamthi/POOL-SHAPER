import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="group relative flex h-9 w-[68px] items-center rounded-full border border-hairline bg-card/60 px-1 transition-colors duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        className={cn(
          "absolute size-7 rounded-full bg-foreground/5 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]",
          dark ? "translate-x-[30px]" : "translate-x-0",
        )}
      />
      <span className="relative z-10 flex w-1/2 justify-center">
        <Sun
          className={cn(
            "size-3.5 stroke-[1.25] transition-colors duration-500",
            dark ? "text-muted-foreground/50" : "text-foreground",
          )}
        />
      </span>
      <span className="relative z-10 flex w-1/2 justify-center">
        <Moon
          className={cn(
            "size-3.5 stroke-[1.25] transition-colors duration-500",
            dark ? "text-foreground" : "text-muted-foreground/50",
          )}
        />
      </span>
    </button>
  );
}
