import { useEffect, useMemo, useRef, useState } from "react";
import { Columns3, Loader2, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import { useConfigurator } from "@/lib/pool/context";
import { createProjectId } from "@/lib/pool/project";
import { buildProjectSummary } from "@/lib/project-delivery/summary-model";
import {
  applyProposal,
  comparisonKey,
  comparisonRows,
  designFingerprint,
  designSnapshot,
  emptyBoard,
  MAX_PROPOSALS,
  parseBoard,
  type ProposalBoard,
} from "@/lib/pool/proposal-comparison";

async function thumbnail(source: string): Promise<string> {
  const image = new Image();
  image.src = source;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = Math.min(720, image.naturalWidth);
  canvas.height = Math.round((image.naturalHeight * canvas.width) / image.naturalWidth);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image unavailable");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.75);
}

export function ProposalComparison({
  captureHero,
  onApplied,
}: {
  captureHero?: (() => Promise<string | null>) | undefined;
  onApplied?: (() => void) | undefined;
}) {
  const { t, locale } = useI18n();
  const { projectConfiguration, restoreProject } = useConfigurator();
  // A project switch remounts the board so no asynchronous capture can cross it.
  return (
    <ProjectProposals
      key={projectConfiguration.projectId}
      project={projectConfiguration}
      restore={restoreProject}
      captureHero={captureHero}
      onApplied={onApplied}
      t={t}
      locale={locale}
    />
  );
}

function ProjectProposals({
  project,
  restore,
  captureHero,
  onApplied,
  t,
  locale,
}: {
  project: ReturnType<typeof useConfigurator>["projectConfiguration"];
  restore: ReturnType<typeof useConfigurator>["restoreProject"];
  captureHero?: (() => Promise<string | null>) | undefined;
  onApplied?: (() => void) | undefined;
  t: ReturnType<typeof useI18n>["t"];
  locale: ReturnType<typeof useI18n>["locale"];
}) {
  const [board, setBoard] = useState<ProposalBoard>(() => emptyBoard(project.projectId));
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [onlyDifferences, setOnlyDifferences] = useState(true);
  const [undo, setUndo] = useState<ProposalBoard | null>(null);
  const current = useRef(project);
  current.current = project;
  const mounted = useRef(true);
  const storedRaw = useRef<string | null>(null);
  useEffect(() => {
    mounted.current = true;
    try {
      storedRaw.current = localStorage.getItem(comparisonKey(project.projectId));
      setBoard(parseBoard(storedRaw.current, project.projectId));
      setReady(true);
    } catch {
      setMessage(
        "Impossibile leggere le proposte salvate. I dati esistenti sono stati conservati.",
      );
    }
    return () => {
      mounted.current = false;
    };
  }, [project.projectId]);
  const models = useMemo(
    () => board.proposals.map((proposal) => buildProjectSummary(proposal.project, locale)),
    [board.proposals, locale],
  );
  const rows = useMemo(() => comparisonRows(models), [models]);
  const visibleRows =
    onlyDifferences && models.length > 1 ? rows.filter((row) => row.different) : rows;
  const fingerprint = designFingerprint(project);
  const alreadyAdded = board.proposals.some(
    (proposal) => designFingerprint(proposal.project) === fingerprint,
  );

  const persist = (next: ProposalBoard): boolean => {
    try {
      const latest = localStorage.getItem(comparisonKey(project.projectId));
      if (latest !== storedRaw.current) {
        setBoard(parseBoard(latest, project.projectId));
        storedRaw.current = latest;
        setUndo(null);
        setMessage(
          "Le proposte sono cambiate in un’altra scheda. Il confronto è stato aggiornato: ripeti la scelta.",
        );
        return false;
      }
      const validated = parseBoard(JSON.stringify(next), project.projectId);
      const raw = JSON.stringify(validated);
      localStorage.setItem(comparisonKey(project.projectId), raw);
      storedRaw.current = raw;
      setBoard(validated);
      setMessage("");
      return true;
    } catch {
      setMessage(
        "Salvataggio non riuscito: spazio del browser esaurito o non disponibile. Le proposte precedenti restano conservate.",
      );
      return false;
    }
  };
  const add = async () => {
    if (busy || !ready || alreadyAdded || board.proposals.length >= MAX_PROPOSALS) return;
    const snapshot = designSnapshot(project);
    setBusy(true);
    setMessage("");
    try {
      const source = await captureHero?.();
      if (!source) throw new Error("Capture unavailable");
      const preview = await thumbnail(source);
      if (!mounted.current) return;
      if (designFingerprint(current.current) !== designFingerprint(snapshot)) {
        setMessage(
          "La configurazione è cambiata durante la cattura. Aggiungila nuovamente al confronto.",
        );
        return;
      }
      const proposal = {
        id: createProjectId(),
        name: name.trim() || t("Proposta {number}", { number: board.proposals.length + 1 }),
        createdAt: new Date().toISOString(),
        project: snapshot,
        preview,
      };
      if (persist({ ...board, proposals: [...board.proposals, proposal] })) {
        setName("");
        setUndo(null);
      }
    } catch {
      if (mounted.current)
        setMessage("Impossibile acquisire l’immagine. Riprova quando la scena è pronta.");
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const choose = (index: number) => {
    const proposal = board.proposals[index];
    if (!proposal || busy) return;
    try {
      const next = applyProposal(project, proposal.project);
      if (persist({ ...board, previous: designSnapshot(project) })) {
        restore(next);
        onApplied?.();
        setUndo(null);
        setMessage("Proposta applicata. Puoi ripristinare la configurazione precedente.");
      }
    } catch {
      setMessage("Questa proposta appartiene a un altro tipo di progetto.");
    }
  };
  const restorePrevious = () => {
    if (!board.previous || busy) return;
    try {
      const previous = applyProposal(project, board.previous);
      if (persist({ ...board, previous: designSnapshot(project) })) {
        restore(previous);
        onApplied?.();
        setMessage("Configurazione precedente ripristinata.");
      }
    } catch {
      setMessage("Questa proposta appartiene a un altro tipo di progetto.");
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) setOpen(value);
      }}
    >
      <section
        className="rounded-2xl border border-hairline bg-card p-5"
        data-testid="proposal-comparison"
      >
        <DialogTrigger asChild>
          <Button variant="outline" className="rounded-full">
            <Columns3 className="mr-2 size-4" />
            {t("Confronta proposte")}{" "}
            {ready && board.proposals.length > 0 ? `(${board.proposals.length})` : ""}
          </Button>
        </DialogTrigger>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          {t("Conserva fino a tre alternative e confronta le differenze.")}
        </p>
      </section>
      <DialogContent
        className="w-[calc(100%_-_1rem)] max-w-6xl rounded-2xl p-4 sm:p-6"
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{t("Confronta proposte")}</DialogTitle>
          <DialogDescription>
            {t(
              "Proposte conservate solo in questo browser, separate dal salvataggio cloud. Non sono incluse nel link condiviso o nel PDF.",
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
            {t("Nome della proposta")}
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={60}
              placeholder={t("Es. Travertino e luci calde")}
              disabled={busy || !ready || board.proposals.length >= MAX_PROPOSALS}
              className="h-10 w-full rounded-md border border-input bg-background px-3"
            />
          </label>
          <Button
            onClick={() => void add()}
            disabled={
              busy ||
              !ready ||
              alreadyAdded ||
              board.proposals.length >= MAX_PROPOSALS ||
              !captureHero
            }
          >
            {busy ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Plus className="mr-2 size-4" />
            )}
            {t(busy ? "Acquisizione in corso…" : "Aggiungi configurazione attuale")}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {t(
            alreadyAdded
              ? "La configurazione attuale è già nel confronto."
              : board.proposals.length >= MAX_PROPOSALS
                ? "Hai tre proposte. Rimuovine una per aggiungere un’alternativa."
                : "Aggiungi una proposta, chiudi il confronto e modifica la piscina per creare un’alternativa.",
          )}
        </p>
        <div role="status" aria-live="polite" className="text-sm">
          {message ? t(message) : ""}
        </div>
        {undo ? (
          <Button
            variant="outline"
            onClick={() => {
              if (persist(undo)) setUndo(null);
            }}
          >
            {t("Annulla rimozione")}
          </Button>
        ) : null}
        {board.previous ? (
          <Button variant="outline" disabled={busy} onClick={restorePrevious}>
            <RotateCcw className="mr-2 size-4" />
            {t("Ripristina configurazione precedente")}
          </Button>
        ) : null}
        {board.proposals.length > 0 ? (
          <>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={onlyDifferences}
                onChange={(event) => setOnlyDifferences(event.target.checked)}
              />
              {t("Mostra solo le differenze")}
            </label>
            <p className="text-xs text-muted-foreground sm:hidden">
              {t("Scorri la tabella verso destra per confrontare le altre proposte.")}
            </p>
            <div
              className="overflow-x-auto rounded-lg border border-hairline"
              role="region"
              aria-label={t("Tabella confronto proposte")}
              tabIndex={0}
            >
              <table className="w-full border-collapse text-left text-sm">
                <caption className="sr-only">{t("Tabella confronto proposte")}</caption>
                <thead>
                  <tr>
                    <th scope="col" className="min-w-28 p-3 align-bottom sm:min-w-36">
                      {t("Caratteristiche")}
                    </th>
                    {board.proposals.map((proposal, index) => (
                      <th
                        key={proposal.id}
                        scope="col"
                        className="min-w-56 max-w-80 border-l border-hairline p-3 align-top font-normal"
                      >
                        {proposal.preview ? (
                          <img
                            src={proposal.preview}
                            alt={t("Anteprima di {name}", { name: proposal.name })}
                            className="mb-3 aspect-video w-full rounded-md object-cover"
                          />
                        ) : null}
                        <span className="block break-words font-medium">{proposal.name}</span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {models[index]?.subline}
                        </span>
                        {models[index]?.compatibilityIssues?.length ? (
                          <p className="mt-2 text-xs text-destructive">
                            {models[index]?.compatibilityIssues?.join(" · ")}
                          </p>
                        ) : null}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy || designFingerprint(proposal.project) === fingerprint}
                            onClick={() => choose(index)}
                            aria-label={t("Usa {name}", { name: proposal.name })}
                          >
                            {t(
                              designFingerprint(proposal.project) === fingerprint
                                ? "Attuale"
                                : "Usa proposta",
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy || !ready}
                            aria-label={t("Rimuovi {name}", { name: proposal.name })}
                            onClick={() => {
                              const before = board;
                              if (
                                persist({
                                  ...board,
                                  proposals: board.proposals.filter(
                                    (item) => item.id !== proposal.id,
                                  ),
                                })
                              )
                                setUndo(before);
                            }}
                          >
                            {t("Rimuovi")}
                          </Button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => (
                    <tr key={row.key} className={row.different ? "bg-muted/40" : ""}>
                      <th scope="row" className="border-t border-hairline p-3 font-normal">
                        <span className="block text-xs text-muted-foreground">{row.section}</span>
                        {row.label}
                      </th>
                      {row.values.map((value, index) => (
                        <td
                          key={board.proposals[index]?.id}
                          className="whitespace-pre-line border-l border-t border-hairline p-3 align-top"
                        >
                          {value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {models.length > 1 && visibleRows.length === 0 ? (
              <p className="text-sm">
                {t("Le proposte coincidono nelle caratteristiche riepilogate.")}
              </p>
            ) : null}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
