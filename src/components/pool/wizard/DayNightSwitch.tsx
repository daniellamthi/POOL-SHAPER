import { useI18n } from "@/lib/i18n";
import { Moon, Sun } from "lucide-react";
import type { SceneTimeOfDay } from "../three/PoolScene";

export function DayNightSwitch({
  sceneTime,
  onChange,
}: {
  sceneTime: SceneTimeOfDay;
  onChange: (value: SceneTimeOfDay) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="day-night-switch" role="group" aria-label={t("Ora della scena")}>
      <button
        type="button"
        aria-pressed={sceneTime === "day"}
        onClick={() => onChange("day")}
      >
        <Sun aria-hidden="true" size={15} strokeWidth={1.5} />
        <span>{t("Giorno")}</span>
      </button>
      <button
        type="button"
        aria-pressed={sceneTime === "night"}
        onClick={() => onChange("night")}
      >
        <Moon aria-hidden="true" size={15} strokeWidth={1.5} />
        <span>{t("Notte")}</span>
      </button>
    </div>
  );
}
