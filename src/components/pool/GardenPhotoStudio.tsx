import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import {
  calibrateSitePhoto,
  CalibrationError,
  type PhotoCalibration,
  type PhotoPoint,
  type SitePhotoCamera,
} from "@/lib/pool/site-photo-camera";
import {
  prepareSitePhoto,
  readSitePhoto,
  writeSitePhoto,
  type SitePhotoDraft,
} from "@/lib/pool/site-photo-storage";
import type { SitePhotoView } from "./three/SitePhotoCameraRig";

const field = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
const errorCopy = {
  dimensions: "Inserisci le due misure reali del rettangolo, tra 0,5 e 100 metri.",
  points:
    "Segna quattro angoli in senso orario, senza incrociarli, partendo da quello lontano a sinistra.",
  perspective:
    "La prospettiva non è sufficiente. Usa un riferimento più grande o una foto obliqua; se conosci il campo visivo, inseriscilo nelle opzioni avanzate.",
  accuracy:
    "I punti non corrispondono a un rettangolo piano con queste misure. Controlla gli angoli e le distanze.",
};

export default function GardenPhotoStudio({
  projectId,
  poolLength,
  poolWidth,
  renderScene,
  onClose,
}: {
  projectId: string;
  poolLength: number;
  poolWidth: number;
  renderScene: (view: SitePhotoView) => ReactNode;
  onClose: () => void;
}) {
  const { t, number } = useI18n();
  const [draft, setDraft] = useState<SitePhotoDraft | null>(null);
  const [selected, setSelected] = useState(0);
  const [calibration, setCalibration] = useState<SitePhotoCamera | null>(null);
  const [editing, setEditing] = useState(true);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState<"load" | "save" | "export" | null>("load");
  const [message, setMessage] = useState("");
  const [exportRequest, setExportRequest] = useState(0);
  const alive = useRef(true);
  const opener = useRef(
    typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null,
  );
  useEffect(() => {
    alive.current = true;
    void readSitePhoto(projectId)
      .then((saved) => {
        if (alive.current) {
          setDraft(saved);
          if (saved) setMessage("Foto e riferimenti ripristinati da questo browser.");
        }
      })
      .catch(() => {
        if (alive.current)
          setMessage(
            "Archivio foto locale non disponibile. Puoi comunque lavorare nella sessione.",
          );
      })
      .finally(() => {
        if (alive.current) setBusy(null);
      });
    return () => {
      alive.current = false;
    };
  }, [projectId]);
  const update = (change: Partial<SitePhotoDraft>) => {
    setDraft((current) => (current ? { ...current, ...change } : current));
    setMessage("");
  };
  const setPoint = (point: PhotoPoint) => {
    if (!draft) return;
    const points = [...draft.points];
    points[selected] = point;
    update({ points });
    setCalibration(null);
  };
  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy("load");
    setMessage("");
    try {
      const photo = await prepareSitePhoto(file);
      if (!alive.current) return;
      setDraft({
        version: 1,
        projectId,
        ...photo,
        points: [],
        length: "",
        depth: "",
        knownFov: "",
        offsetX: 0,
        offsetZ: 0,
        rotation: 0,
      });
      setCalibration(null);
      setEditing(true);
      setSelected(0);
      setReady(false);
    } catch {
      if (alive.current)
        setMessage("Usa una foto JPG, PNG o WebP, fino a 20 MB, con almeno 100 pixel per lato.");
    } finally {
      if (alive.current) setBusy(null);
    }
  };
  const calibrate = () => {
    if (!draft) return;
    try {
      if (draft.points.length !== 4) throw new CalibrationError("points");
      const camera = calibrateSitePhoto({
        imageWidth: draft.width,
        imageHeight: draft.height,
        points: draft.points as unknown as PhotoCalibration["points"],
        referenceLength: Number(draft.length.replace(",", ".")),
        referenceWidth: Number(draft.depth.replace(",", ".")),
        ...(draft.knownFov.trim() ? { verticalFov: Number(draft.knownFov) } : {}),
      });
      setExportRequest(0);
      setCalibration(camera);
      setEditing(false);
      setReady(false);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof CalibrationError ? errorCopy[error.code] : errorCopy.perspective);
    }
  };
  const save = async () => {
    if (!draft) return;
    setBusy("save");
    try {
      await writeSitePhoto(draft);
      if (alive.current) setMessage("Foto e posizionamento conservati in questo browser.");
    } catch {
      if (alive.current)
        setMessage("Salvataggio locale non riuscito. La foto resta disponibile nella sessione.");
    } finally {
      if (alive.current) setBusy(null);
    }
  };
  const onCapture = useCallback(
    (overlay: string | null) => {
      void (async () => {
        if (!overlay || !draft) {
          setBusy(null);
          setMessage("Immagine non disponibile. Attendi il caricamento della scena e riprova.");
          return;
        }
        try {
          const background = new Image(),
            pool = new Image();
          background.src = draft.image;
          pool.src = overlay;
          await Promise.all([background.decode(), pool.decode()]);
          if (!alive.current) return;
          const canvas = document.createElement("canvas");
          canvas.width = draft.width;
          canvas.height = draft.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("canvas");
          ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
          ctx.drawImage(pool, 0, 0, canvas.width, canvas.height);
          const bar = Math.max(24, Math.round(canvas.width / 60));
          ctx.fillStyle = "rgba(255,255,255,0.9)";
          ctx.fillRect(0, canvas.height - bar, canvas.width, bar);
          ctx.fillStyle = "#333";
          ctx.font = `${Math.max(10, Math.round(bar * 0.48))}px sans-serif`;
          ctx.fillText(
            t("Studio indicativo · misure e fattibilità da verificare sul posto"),
            10,
            canvas.height - bar * 0.32,
            canvas.width - 20,
          );
          const blob = await new Promise<Blob>((resolve, reject) =>
            canvas.toBlob(
              (value) => (value ? resolve(value) : reject(new Error("export"))),
              "image/png",
            ),
          );
          if (!alive.current) return;
          const url = URL.createObjectURL(blob),
            link = document.createElement("a");
          link.href = url;
          link.download = "pool-shaper-giardino.png";
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 60000);
          setMessage("Immagine del giardino esportata.");
        } catch {
          if (alive.current)
            setMessage("Esportazione non riuscita. Riprova quando la scena è pronta.");
        } finally {
          if (alive.current) setBusy(null);
        }
      })();
    },
    [draft, t],
  );
  const point = draft?.points[selected];
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        className="max-h-[calc(100dvh_-_1rem)] w-[calc(100%_-_1rem)] max-w-6xl overflow-y-auto rounded-2xl p-4 sm:p-6"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          opener.current?.focus();
        }}
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{t("Nel tuo giardino")}</DialogTitle>
          <DialogDescription>
            {t(
              "La foto resta su questo dispositivo. Usa un terreno piano e libero: gli oggetti in primo piano non mascherano automaticamente la piscina.",
            )}
          </DialogDescription>
        </DialogHeader>
        <fieldset disabled={!!busy} className="min-w-0 space-y-4">
          <label className="block text-sm">
            {t("Carica foto del giardino")}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => void upload(event.target.files?.[0])}
              className="mt-1 block w-full text-sm"
            />
          </label>
          {draft && (
            <>
              <p className="text-sm">
                {t(
                  "Piscina configurata: {length} × {width} m. La scala dipende dalle misure del riferimento.",
                  { length: number(poolLength), width: number(poolWidth) },
                )}
              </p>
              {editing ? (
                <>
                  <p className="text-sm">
                    {t(
                      "Individua un rettangolo sul terreno con misure note. Tocca i quattro angoli in senso orario: 1 lontano a sinistra, 2 lontano a destra, 3 vicino a destra, 4 vicino a sinistra.",
                    )}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-sm">
                      {t("Lato 1–2 (metri)")}
                      <input
                        className={field}
                        inputMode="decimal"
                        value={draft.length}
                        onChange={(event) => update({ length: event.target.value })}
                        maxLength={20}
                      />
                    </label>
                    <label className="text-sm">
                      {t("Lato 2–3 (metri)")}
                      <input
                        className={field}
                        inputMode="decimal"
                        value={draft.depth}
                        onChange={(event) => update({ depth: event.target.value })}
                        maxLength={20}
                      />
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2" aria-label={t("Punti di riferimento")}>
                    {[0, 1, 2, 3].map((i) => (
                      <Button
                        key={i}
                        size="sm"
                        variant={selected === i ? "default" : "outline"}
                        aria-pressed={selected === i}
                        disabled={i > draft.points.length}
                        onClick={() => setSelected(i)}
                      >
                        {t("Punto {number}", { number: i + 1 })}
                      </Button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditing(true);
                      setReady(false);
                    }}
                  >
                    {t("Modifica riferimenti")}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {t("La piscina mantiene le dimensioni configurate.")}
                  </span>
                </div>
              )}
              <div
                className="relative mx-auto overflow-hidden rounded-lg border border-hairline bg-black"
                style={{
                  width: `min(100%, calc(58dvh * ${draft.width / draft.height}))`,
                  aspectRatio: `${draft.width}/${draft.height}`,
                }}
              >
                <img
                  src={draft.image}
                  alt={t("Foto del giardino")}
                  className="absolute inset-0 h-full w-full"
                  draggable={false}
                />
                {!editing && calibration ? (
                  <div className="absolute inset-0">
                    {renderScene({
                      camera: calibration,
                      offsetX: draft.offsetX,
                      offsetZ: draft.offsetZ,
                      rotation: draft.rotation,
                      exportRequest,
                      exportWidth: draft.width,
                      exportHeight: draft.height,
                      onReady: setReady,
                      onCapture,
                    })}
                  </div>
                ) : null}
                {editing ? (
                  <svg
                    className="absolute inset-0 h-full w-full touch-none cursor-crosshair"
                    viewBox={`0 0 ${draft.width} ${draft.height}`}
                    role="img"
                    aria-label={t("Seleziona i quattro punti sulla foto")}
                    onPointerDown={(event) => {
                      if (busy) return;
                      const bounds = event.currentTarget.getBoundingClientRect();
                      setPoint([
                        Math.max(
                          0,
                          Math.min(
                            draft.width,
                            ((event.clientX - bounds.left) * draft.width) / bounds.width,
                          ),
                        ),
                        Math.max(
                          0,
                          Math.min(
                            draft.height,
                            ((event.clientY - bounds.top) * draft.height) / bounds.height,
                          ),
                        ),
                      ]);
                      setSelected(Math.min(3, selected + 1));
                    }}
                  >
                    {draft.points.length > 1 ? (
                      <polygon
                        points={draft.points.map((p) => p.join(",")).join(" ")}
                        fill="rgba(50,200,250,0.15)"
                        stroke="#00bfff"
                        strokeWidth={Math.max(2, draft.width / 450)}
                      />
                    ) : null}
                    {draft.points.map(([x, y], i) => (
                      <g key={i}>
                        <circle
                          cx={x}
                          cy={y}
                          r={draft.width / 55}
                          fill={i === selected ? "#543fc0" : "#ffffff"}
                          stroke="#252525"
                          strokeWidth={draft.width / 700}
                        />
                        <text
                          x={x}
                          y={y}
                          fill={i === selected ? "white" : "black"}
                          fontSize={draft.width / 42}
                          textAnchor="middle"
                          dominantBaseline="central"
                        >
                          {i + 1}
                        </text>
                      </g>
                    ))}
                  </svg>
                ) : null}
              </div>
              {editing ? (
                <>
                  {point ? (
                    <div className="grid grid-cols-2 gap-3">
                      <label className="text-xs">
                        {t("Coordinata X del punto (pixel)")}
                        <input
                          className={field}
                          type="number"
                          min={0}
                          max={draft.width}
                          value={Math.round(point[0])}
                          onChange={(event) =>
                            setPoint([
                              Math.max(0, Math.min(draft.width, Number(event.target.value))),
                              point[1],
                            ])
                          }
                        />
                      </label>
                      <label className="text-xs">
                        {t("Coordinata Y del punto (pixel)")}
                        <input
                          className={field}
                          type="number"
                          min={0}
                          max={draft.height}
                          value={Math.round(point[1])}
                          onChange={(event) =>
                            setPoint([
                              point[0],
                              Math.max(0, Math.min(draft.height, Number(event.target.value))),
                            ])
                          }
                        />
                      </label>
                    </div>
                  ) : null}
                  <details>
                    <summary className="cursor-pointer text-sm">
                      {t("Opzioni avanzate della foto")}
                    </summary>
                    <label className="mt-2 block text-sm">
                      {t("Campo visivo verticale noto (gradi, facoltativo)")}
                      <input
                        className={field}
                        type="number"
                        min={10}
                        max={110}
                        value={draft.knownFov}
                        onChange={(event) => update({ knownFov: event.target.value })}
                      />
                    </label>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t(
                        "Usa una foto non ritagliata e senza forte distorsione grandangolare. La calibrazione presume il centro ottico al centro dell’immagine.",
                      )}
                    </p>
                  </details>
                  <Button disabled={draft.points.length !== 4} onClick={calibrate}>
                    {t("Mostra piscina nel giardino")}
                  </Button>
                </>
              ) : (
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="text-sm">
                    {t("Spostamento X (metri)")}
                    <input
                      className={field}
                      type="number"
                      min={-100}
                      max={100}
                      step={0.1}
                      value={draft.offsetX}
                      onChange={(event) =>
                        update({
                          offsetX: Math.max(-100, Math.min(100, Number(event.target.value))),
                        })
                      }
                    />
                  </label>
                  <label className="text-sm">
                    {t("Spostamento Z (metri)")}
                    <input
                      className={field}
                      type="number"
                      min={-100}
                      max={100}
                      step={0.1}
                      value={draft.offsetZ}
                      onChange={(event) =>
                        update({
                          offsetZ: Math.max(-100, Math.min(100, Number(event.target.value))),
                        })
                      }
                    />
                  </label>
                  <label className="text-sm">
                    {t("Rotazione piscina (gradi)")}
                    <input
                      className={field}
                      type="number"
                      min={-360}
                      max={360}
                      step={5}
                      value={draft.rotation}
                      onChange={(event) =>
                        update({
                          rotation: Math.max(-360, Math.min(360, Number(event.target.value))),
                        })
                      }
                    />
                  </label>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void save()}>
                  {t("Conserva in questo browser")}
                </Button>
                {!editing ? (
                  <Button
                    disabled={!ready}
                    onClick={() => {
                      setBusy("export");
                      setMessage("");
                      setExportRequest((value) => value + 1);
                    }}
                  >
                    {t("Esporta immagine giardino")}
                  </Button>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                {t(
                  "Foto e posizionamento non sono inclusi nel link condiviso o nel Project Book. Esporta questa immagine separatamente.",
                )}
              </p>
            </>
          )}
        </fieldset>
        <p role="status" aria-live="polite" className="text-sm">
          {busy
            ? t(
                busy === "load"
                  ? "Caricamento foto…"
                  : busy === "save"
                    ? "Salvataggio locale…"
                    : "Esportazione immagine…",
              )
            : message
              ? t(message)
              : !editing && !ready
                ? t("Preparazione della piscina…")
                : ""}
        </p>
      </DialogContent>
    </Dialog>
  );
}
