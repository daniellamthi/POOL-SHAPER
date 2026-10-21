import { useI18n } from "@/lib/i18n";
import { useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { TextField } from "@/components/pool/TextField";
import type { ProjectConfiguration } from "@/lib/pool/project";
import { LEAD_TIMING_OPTIONS, type LeadTimingId } from "@/lib/lead/types";
import { submitLead } from "@/lib/lead/submitLead.server";
import { comfortConfigurationIssues, COMFORT_RESOLUTION_MESSAGE } from "@/lib/pool/comfort-compatibility";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Status = "idle" | "submitting" | "success" | "error";

interface FormState {
  name: string;
  email: string;
  phone: string;
  projectLocation: string;
  timing: LeadTimingId | "";
  notes: string;
  privacyAccepted: boolean;
  marketingConsent: boolean;
  /** Honeypot -- must stay empty; hidden from sighted/keyboard users. */
  website: string;
}

function validate(form: FormState): Partial<Record<keyof FormState, string>> {
  const errors: Partial<Record<keyof FormState, string>> = {};
  if (form.name.trim().length === 0) errors.name = "Il nome è obbligatorio";
  if (!EMAIL_PATTERN.test(form.email.trim())) errors.email = "Inserisci un'email valida";
  if (form.phone.trim().length < 4) errors.phone = "Inserisci un numero di telefono valido";
  if (form.projectLocation.trim().length === 0) {
    errors.projectLocation = "Indica la località del progetto";
  }
  if (!form.timing) errors.timing = "Seleziona una tempistica";
  if (!form.privacyAccepted)
    errors.privacyAccepted = "È necessario accettare l'informativa privacy";
  return errors;
}

export function LeadRequestDialog({
  projectConfiguration,
  projectReference,
  prepareProject,
  defaultCustomer = { name: "", email: "", phone: "" },
}: {
  projectConfiguration: ProjectConfiguration;
  /** Public Project ID (PW-XXXX-XXXXXX) of the saved project, when saved. */
  projectReference?: string | null | undefined;
  prepareProject?: (() => Promise<{
    projectConfiguration: ProjectConfiguration;
    projectReference?: string | null | undefined;
  } | null>) | undefined;
  /** Optional -- with Customer Details no longer a mandatory earlier step,
   * this dialog is normally the first and only place contact details are
   * collected, so it starts blank unless a caller has something to prefill. */
  defaultCustomer?: { name: string; email: string; phone: string; projectLocation?: string; notes?: string };
}) {
  const { t } = useI18n();
  const requestTrigger = useRef<HTMLButtonElement>(null);
  const incompatible = comfortConfigurationIssues(projectConfiguration.config).length > 0;
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [requestRef, setRequestRef] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [form, setForm] = useState<FormState>({
    name: defaultCustomer.name,
    email: defaultCustomer.email,
    phone: defaultCustomer.phone,
    projectLocation: defaultCustomer.projectLocation ?? "",
    timing: "",
    notes: defaultCustomer.notes ?? "",
    privacyAccepted: false,
    marketingConsent: false,
    website: "",
  });

  // Generated once per page load and reused on every retry, so a network
  // retry or an accidental resubmit of the same project is recognised
  // server-side instead of creating a second lead.
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);
  const submitLeadFn = useServerFn(submitLead);

  const errors = touched ? validate(form) : {};
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const handleSubmit = async () => {
    if (incompatible) { setErrorMessage(COMFORT_RESOLUTION_MESSAGE); return; }
    setTouched(true);
    const validationErrors = validate(form);
    if (Object.keys(validationErrors).length > 0 || !form.timing) return;
    if (status === "submitting" || status === "success") return;

    setStatus("submitting");
    setErrorMessage(null);
    try {
      const prepared = prepareProject
        ? await prepareProject()
        : { projectConfiguration, projectReference };
      if (!prepared) throw new Error("Salvataggio del progetto non riuscito. Riprova prima di inviare la richiesta.");
      if (comfortConfigurationIssues(prepared.projectConfiguration.config).length)
        throw new Error(COMFORT_RESOLUTION_MESSAGE);
      const result = await submitLeadFn({
        data: {
          customer: {
            name: form.name.trim(),
            email: form.email.trim(),
            phone: form.phone.trim(),
            projectLocation: form.projectLocation.trim(),
          },
          commercial: { timing: form.timing, notes: form.notes.trim() },
          // `validate()` above already guarantees this is true -- the
          // schema requires the literal `true`, not just `boolean`.
          privacy: { accepted: true, marketingConsent: form.marketingConsent },
          website: form.website,
          idempotencyKey,
          ...(prepared.projectReference ? { projectReference: prepared.projectReference } : {}),
          project: prepared.projectConfiguration,
        },
      });
      setRequestRef(result.requestId);
      setStatus("success");
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Invio non riuscito. Riprova tra poco.";
      setErrorMessage(message);
      setStatus("error");
    }
  };

  return (
    <>
      {incompatible ? <p role="status" className="text-xs text-muted-foreground">{t(COMFORT_RESOLUTION_MESSAGE)}</p> : null}
      <Button ref={requestTrigger} type="button" size="lg" className="mt-1" disabled={incompatible} onClick={() => setOpen(true)}>
        {t("Valuta il progetto con un consulente")}{" "}</Button>

      <Dialog
        open={open}
        onOpenChange={(next) => !next && status !== "submitting" && setOpen(next)}
      >
        <DialogContent
          className="max-w-md gap-6 rounded-2xl border-hairline p-7"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            requestTrigger.current?.focus();
          }}
        >
          {status === "success" ? (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <DialogHeader className="gap-2">
                <DialogTitle className="text-[20px] font-extralight tracking-[-0.015em] text-foreground">
                  {t("Progetto inviato")}{" "}</DialogTitle>
                <DialogDescription className="text-[13px] leading-[1.8] font-light text-muted-foreground">
                  {t("Abbiamo ricevuto la tua configurazione. Un consulente Piscine Wellness la esaminerà per verificare fattibilità, soluzioni tecniche e investimento.")}{" "}</DialogDescription>
              </DialogHeader>
              {requestRef ? (
                <p className="text-[11px] font-light tracking-[0.08em] text-muted-foreground/70">
                  {t("Riferimento richiesta:")}{" "}{requestRef.slice(0, 8).toUpperCase()}
                </p>
              ) : null}
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t("Chiudi")}{" "}</Button>
            </div>
          ) : (
            <>
              <DialogHeader className="gap-1.5">
                <DialogTitle className="text-[19px] font-extralight tracking-[-0.015em] text-foreground">
                  {t("Valuta il progetto con un consulente")}{" "}</DialogTitle>
                <DialogDescription className="text-[12.5px] leading-[1.7] font-light text-muted-foreground">
                  {t("Pochi dati per farti ricontattare da un consulente Piscine Wellness.")}{" "}</DialogDescription>
              </DialogHeader>

              <div className="flex flex-col gap-5">
                <TextField
                  label={t("Nome")}
                  type="text"
                  autoComplete="name"
                  required
                  value={form.name}
                  onChange={(v) => set("name", v)}
                  error={errors.name}
                />
                <TextField
                  label={t("Email")}
                  type="email"
                  autoComplete="email"
                  required
                  value={form.email}
                  onChange={(v) => set("email", v)}
                  error={errors.email}
                />
                <TextField
                  label={t("Telefono")}
                  type="tel"
                  autoComplete="tel"
                  required
                  value={form.phone}
                  onChange={(v) => set("phone", v)}
                  error={errors.phone}
                />
                <TextField
                  label={t("Località del progetto")}
                  type="text"
                  autoComplete="address-level2"
                  required
                  value={form.projectLocation}
                  onChange={(v) => set("projectLocation", v)}
                  error={errors.projectLocation}
                />

                <div className="flex flex-col gap-2.5">
                  <span className="label-xs">
                    {t("Quando vuoi realizzarla?")}{" "}<span className="text-brand">*</span>
                  </span>
                  <RadioGroup
                    aria-label={t("Quando vuoi realizzarla?")}
                    required
                    value={form.timing}
                    onValueChange={(v) => set("timing", v as LeadTimingId)}
                    className="gap-2.5"
                  >
                    {LEAD_TIMING_OPTIONS.map((option) => (
                      <label
                        key={option.id}
                        htmlFor={`timing-${option.id}`}
                        className="flex items-center gap-2.5 text-[13px] font-light text-foreground"
                      >
                        <RadioGroupItem value={option.id} id={`timing-${option.id}`} />
                        {t(option.label)}
                      </label>
                    ))}
                  </RadioGroup>
                  {errors.timing ? (
                    <span className="text-[11px] font-light text-destructive">{t(errors.timing)}</span>
                  ) : null}
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="lead-notes" className="label-xs">
                    {t("Note (opzionale)")}{" "}</Label>
                  <Textarea
                    id="lead-notes"
                    className="min-h-20"
                    value={form.notes}
                    onChange={(event) => set("notes", event.target.value)}
                  />
                </div>

                {/* Honeypot: visually and semantically hidden from real users. */}
                <input
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  className="absolute h-0 w-0 opacity-0"
                  value={form.website}
                  onChange={(event) => set("website", event.target.value)}
                />

                <div className="flex flex-col gap-3 border-t border-hairline pt-5">
                  <label className="flex items-start gap-2.5 text-[12px] leading-[1.6] font-light text-muted-foreground">
                    <Checkbox
                      checked={form.privacyAccepted}
                      onCheckedChange={(v) => set("privacyAccepted", v === true)}
                      className="mt-0.5"
                    />
                    {t("Ho letto e accetto l’")}{" "}<a
                      href="/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(event) => event.stopPropagation()}
                      className="underline underline-offset-2 hover:text-foreground"
                    >
                      {t("informativa sulla privacy")}{" "}</a>
                    . <span className="text-brand">*</span>
                  </label>
                  {errors.privacyAccepted ? (
                    <span className="text-[11px] font-light text-destructive">
                      {t(errors.privacyAccepted)}
                    </span>
                  ) : null}
                  <label className="flex items-start gap-2.5 text-[12px] leading-[1.6] font-light text-muted-foreground">
                    <Checkbox
                      checked={form.marketingConsent}
                      onCheckedChange={(v) => set("marketingConsent", v === true)}
                      className="mt-0.5"
                    />
                    {t("Desidero ricevere comunicazioni commerciali (opzionale).")}{" "}</label>
                </div>

                {status === "error" ? (
                  <div
                    role="alert"
                    className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-[12.5px] font-light text-destructive"
                  >
                    {t(errorMessage ?? "Invio non riuscito. Riprova tra poco.")} {t("La tua configurazione resta salvata: puoi riprovare senza perdere nulla.")}{" "}</div>
                ) : null}

                <Button
                  type="button"
                  size="lg"
                  disabled={status === "submitting"}
                  onClick={handleSubmit}
                >
                  {t(status === "submitting"
                    ? "Invio in corso…"
                    : status === "error"
                      ? "Riprova"
                      : "Invia richiesta")}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
