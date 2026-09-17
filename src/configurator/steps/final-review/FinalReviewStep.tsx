import { ProjectSummary } from "@/components/pool/ProjectSummary";
import { StepSection } from "@/components/pool/StepSection";
import { useConfigurator } from "@/lib/pool/context";
import { LeadRequestDialog } from "./LeadRequestDialog";

/** Final Review: a premium, Italian presentation of the customer's own
 * canonical ProjectConfiguration (see `ProjectSummary`), then -- only once
 * they've had a chance to appreciate the project -- the contact recap and
 * the commercial CTA, which opens `LeadRequestDialog` to actually submit
 * the qualified lead. */
export function FinalReviewStep() {
  const { config, projectConfiguration } = useConfigurator();
  const customerRows = [
    ["Nome", `${config.customer.name} ${config.customer.surname}`.trim() || "—"],
    ["Azienda", config.customer.company || "—"],
    ["Email", config.customer.email || "—"],
    ["Telefono", config.customer.phone || "—"],
    ["Località", [config.customer.city, config.customer.country].filter(Boolean).join(", ") || "—"],
    ["Note", config.customer.notes || "—"],
  ] as const;

  return (
    <StepSection
      title="Il tuo progetto"
      subtitle="Ecco la sintesi della piscina che hai progettato, pronta per essere valutata con un consulente."
    >
      <ProjectSummary />

      <section className="rounded-2xl border border-hairline bg-card/40 p-7">
        <h3 className="label-xs mb-5">I tuoi dati</h3>
        <dl>
          {customerRows.map(([label, value]) => (
            <div
              key={label}
              className="flex justify-between gap-6 border-b border-hairline py-3 last:border-0"
            >
              <dt className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                {label}
              </dt>
              <dd className="max-w-[65%] text-right text-[13px] font-light text-foreground">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="flex flex-col items-center gap-4 rounded-2xl border border-hairline bg-card/40 p-8 text-center">
        <h3 className="text-[20px] font-extralight tracking-[-0.015em] text-foreground">
          Vuoi trasformare questo progetto in una proposta reale?
        </h3>
        <p className="max-w-[46ch] text-[13px] leading-[1.8] font-light text-muted-foreground">
          Un nostro consulente può verificare configurazione, fattibilità e investimento.
        </p>
        <LeadRequestDialog
          projectConfiguration={projectConfiguration}
          defaultCustomer={{
            name: `${config.customer.name} ${config.customer.surname}`.trim(),
            email: config.customer.email,
            phone: config.customer.phone,
          }}
        />
      </section>
    </StepSection>
  );
}
