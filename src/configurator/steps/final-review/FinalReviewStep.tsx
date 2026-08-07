import { Button } from "@/components/ui/button";
import { ProjectSummary } from "@/components/pool/ProjectSummary";
import { StepSection } from "@/components/pool/StepSection";
import { useConfigurator } from "@/lib/pool/context";

export function FinalReviewStep() {
  const { config } = useConfigurator();
  const customerRows = [
    ["Name", config.customer.name],
    ["Company", config.customer.company || "—"],
    ["Email", config.customer.email],
    ["Phone", config.customer.phone],
    ["Location", [config.customer.city, config.customer.country].filter(Boolean).join(", ")],
    ["Notes", config.customer.notes || "—"],
  ] as const;

  return (
    <StepSection
      title="Final Review"
      subtitle="Review the 3D pool, configuration and customer details."
    >
      <ProjectSummary />
      <section className="rounded-2xl border border-hairline bg-card/40 p-7">
        <h3 className="label-xs mb-5">Customer information</h3>
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
      <Button type="button" size="lg" disabled title="Quote submission will be implemented later">
        Request Quote
      </Button>
      <p className="text-center text-xs font-light text-muted-foreground">
        Quote submission is intentionally reserved for the next implementation phase.
      </p>
    </StepSection>
  );
}
