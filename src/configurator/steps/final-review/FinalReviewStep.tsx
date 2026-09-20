import { ProjectSummary } from "@/components/pool/ProjectSummary";
import { StepSection } from "@/components/pool/StepSection";
import { useConfigurator } from "@/lib/pool/context";
import { LeadRequestDialog } from "./LeadRequestDialog";

/** Final Review (Progetto): a premium, Italian presentation of the
 * customer's own canonical ProjectConfiguration (see `ProjectSummary`),
 * then the commercial CTA, which opens `LeadRequestDialog` to actually
 * collect contact details and submit the qualified lead. Contact
 * information is no longer a mandatory earlier wizard step -- it is
 * collected once, here, only if the customer chooses to request a
 * consultation. */
export function FinalReviewStep() {
  const { projectConfiguration } = useConfigurator();

  return (
    <StepSection
      title="Il tuo progetto"
      subtitle="Ecco la sintesi della piscina che hai progettato, pronta per essere valutata con un consulente."
    >
      <ProjectSummary />

      <section className="flex flex-col items-center gap-4 rounded-2xl border border-hairline bg-card/40 p-8 text-center">
        <h3 className="text-[20px] font-extralight tracking-[-0.015em] text-foreground">
          Vuoi trasformare questo progetto in una proposta reale?
        </h3>
        <p className="max-w-[46ch] text-[13px] leading-[1.8] font-light text-muted-foreground">
          Un nostro consulente può verificare configurazione, fattibilità e investimento.
        </p>
        <LeadRequestDialog projectConfiguration={projectConfiguration} />
      </section>
    </StepSection>
  );
}
