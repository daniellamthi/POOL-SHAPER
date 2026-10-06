import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, FileDown, Link2, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfigurator } from "@/lib/pool/context";
import { projectShareUrl } from "@/lib/project-delivery/reference";
import { buildProjectSummary } from "@/lib/project-delivery/summary-model";
import type { ProjectDeliveryState } from "./useProjectDelivery";

/** Save · Share · Project Book. Sits above the Premium Summary. */
export function ProjectDeliveryPanel({
  delivery,
  captureHero,
}: {
  delivery: ProjectDeliveryState;
  captureHero?: (() => Promise<string | null>) | undefined;
}) {
  const { projectConfiguration, sharedProject } = useConfigurator();
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [bookStatus, setBookStatus] = useState<"idle" | "working" | "error">("idle");
  const { link, shareUrl, status } = delivery;

  useEffect(() => {
    if (!shareUrl) return setQr(null);
    let active = true;
    void QRCode.toDataURL(shareUrl, { margin: 1, width: 240 }).then((url) => {
      if (active) setQr(url);
    });
    return () => {
      active = false;
    };
  }, [shareUrl]);

  const copy = async () => {
    const target =
      shareUrl ??
      (await delivery
        .save()
        .then((l) => (l ? projectShareUrl(window.location.origin, l.publicRef) : null)));
    if (!target) return;
    try {
      await navigator.clipboard.writeText(target);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      setCopied(false);
    }
  };

  const projectBook = async () => {
    setBookStatus("working");
    try {
      const saved = delivery.dirty || !link ? await delivery.save() : link;
      if (!saved) throw new Error("not saved");
      const hero = delivery.heroUrl ?? (captureHero ? await captureHero() : null);
      if (hero) delivery.setHeroUrl(hero);
      const { buildProjectBook } = await import("@/lib/project-delivery/projectBook");
      const doc = await buildProjectBook({
        model: buildProjectSummary(projectConfiguration),
        publicRef: saved.publicRef,
        shareUrl: projectShareUrl(window.location.origin, saved.publicRef),
        heroDataUrl: hero,
        issuedAt: new Date(),
      });
      doc.save(`Project-Book-${saved.publicRef}.pdf`);
      setBookStatus("idle");
    } catch {
      setBookStatus("error");
    }
  };

  const viewer = Boolean(link && !delivery.owner);
  return (
    <section
      aria-label="Salva e condividi"
      data-testid="project-delivery"
      className="flex flex-col gap-4 rounded-2xl border border-hairline bg-card p-5"
    >
      {sharedProject?.status === "error" ? (
        <p className="text-[12px] text-destructive">{sharedProject.message}</p>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="label-xs">Il tuo progetto</p>
          {link ? (
            <p className="flex items-center gap-2 text-[15px] font-light text-foreground">
              <Check className="size-4 text-brand" strokeWidth={1.75} />
              {viewer ? "Progetto condiviso" : "Salvato"} ·{" "}
              <span className="tabular-nums text-brand" data-testid="delivery-project-ref">
                {link.publicRef}
              </span>
            </p>
          ) : (
            <p className="text-[15px] font-light text-foreground">Non ancora salvato</p>
          )}
          <p className="text-[12px] font-light text-muted-foreground">
            {viewer
              ? "Sola lettura: salvando crei una tua copia, l’originale non cambia."
              : link
                ? delivery.dirty
                  ? "Hai modifiche non salvate."
                  : "Riprendilo quando vuoi, anche da un altro dispositivo, con il link."
                : "Salva per ricevere un Project ID, riprenderlo e condividerlo."}
          </p>
          {delivery.durable === false ? (
            <p className="text-[11px] text-muted-foreground">
              Archivio cloud non configurato in questo ambiente: salvataggio temporaneo.
            </p>
          ) : null}
          {delivery.message ? (
            <p className="text-[12px] text-destructive" role="alert">
              {delivery.message}
            </p>
          ) : null}
        </div>
        {qr && link ? (
          <img
            src={qr}
            alt={`QR del progetto ${link.publicRef}`}
            className="size-[72px] rounded-md border border-hairline bg-white p-1"
          />
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => void delivery.save()}
          disabled={status === "saving"}
          className="rounded-full px-4"
          data-testid="delivery-save"
        >
          {status === "saving" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Save className="size-3.5" />
          )}
          {viewer
            ? "Salva una copia"
            : link
              ? delivery.dirty
                ? "Salva modifiche"
                : "Salvato"
              : "Salva progetto"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => void copy()}
          className="rounded-full px-4"
          data-testid="delivery-share"
        >
          {copied ? <Copy className="size-3.5" /> : <Link2 className="size-3.5" />}
          {copied ? "Link copiato" : "Condividi"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => void projectBook()}
          disabled={bookStatus === "working"}
          className="rounded-full px-4"
          data-testid="delivery-pdf"
        >
          {bookStatus === "working" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <FileDown className="size-3.5" />
          )}
          Project Book PDF
        </Button>
      </div>
      {shareUrl ? (
        <p className="truncate text-[11px] text-muted-foreground" data-testid="delivery-share-url">
          {shareUrl}
        </p>
      ) : null}
      {bookStatus === "error" ? (
        <p className="text-[12px] text-destructive">Project Book non generato. Riprova.</p>
      ) : null}
    </section>
  );
}
