import { StepSection } from "@/components/pool/StepSection";
import { TextField } from "@/components/pool/TextField";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CUSTOMER_FIELDS } from "@/lib/pool/config";
import { useConfigurator } from "@/lib/pool/context";
import {
  CUSTOMER_FIELD_LABELS,
  getCustomerValidation,
  REQUIRED_CUSTOMER_FIELDS,
} from "@/lib/pool/validation";

/** Step 8 — customer contact and project location details. */
export function ContactDetailsStep() {
  const { config, setCustomerField } = useConfigurator();
  const validation = getCustomerValidation(config.customer);

  return (
    <StepSection
      title="Customer Details"
      subtitle="Add the contact and project location details required for the quote request."
    >
      <div className="grid grid-cols-1 gap-x-8 gap-y-7 sm:grid-cols-2">
        {CUSTOMER_FIELDS.map((field) => (
          <TextField
            key={field.key}
            label={field.label}
            type={field.type}
            autoComplete={field.autoComplete}
            value={config.customer[field.key]}
            onChange={(value) => setCustomerField(field.key, value)}
            required={REQUIRED_CUSTOMER_FIELDS.some((key) => key === field.key)}
            error={
              field.key === "email" && config.customer.email.length > 0 && !validation.emailValid
                ? "Enter a valid email address"
                : undefined
            }
            className={field.span ? "sm:col-span-2" : undefined}
          />
        ))}
        <div className="flex flex-col gap-3 sm:col-span-2">
          <Label htmlFor="customer-notes" className="label-xs">
            Notes (optional)
          </Label>
          <Textarea
            id="customer-notes"
            value={config.customer.notes}
            onChange={(event) => setCustomerField("notes", event.target.value)}
            placeholder="Project constraints, preferences or additional information"
            className="min-h-28 resize-y"
          />
        </div>
      </div>

      <div
        className="rounded-2xl border border-hairline bg-card/40 p-5 text-[12px] font-light leading-relaxed"
        role="status"
        aria-live="polite"
      >
        {validation.valid ? (
          <p className="text-brand">Information complete. You can continue to Final Review.</p>
        ) : (
          <p className="text-muted-foreground">
            Complete the required fields marked with *
            {validation.missing.length
              ? `: ${validation.missing.map((key) => CUSTOMER_FIELD_LABELS[key]).join(", ")}`
              : validation.emailValid
                ? "."
                : ": enter a valid email address."}
          </p>
        )}
      </div>
    </StepSection>
  );
}
