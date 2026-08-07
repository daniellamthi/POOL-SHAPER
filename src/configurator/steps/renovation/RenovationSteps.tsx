import { OptionCard, StepSection, SwatchOption, ToggleChip } from "@/components/pool/StepSection";
import { DimensionControl } from "@/components/pool/DimensionControl";
import { TextField } from "@/components/pool/TextField";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DIMENSION_LIMITS, FINISHES, LINER_COLORS, POOL_SHAPES } from "@/lib/pool/config";
import { useConfigurator } from "@/lib/pool/context";
import type {
  EquipmentUpgrade,
  FiltrationWork,
  RenovationArea,
  StructureIssue,
} from "@/lib/pool/types";
import { formatNumber } from "@/lib/pool/format";

const AREAS: ReadonlyArray<{ id: RenovationArea; title: string; description: string }> = [
  { id: "interiorFinish", title: "Interior Finish", description: "Replace liner or mosaic." },
  {
    id: "filtration",
    title: "Pool Filtration System",
    description: "Filter, pump, skimmers and hydraulic equipment.",
  },
  {
    id: "coping",
    title: "Pool Edge / Coping",
    description: "Replace coping stones or edge finish.",
  },
  {
    id: "structure",
    title: "Pool Structure",
    description: "Repairs, leaks, cracks and waterproofing.",
  },
  {
    id: "equipment",
    title: "Pool Equipment Upgrade",
    description: "Automation, salt system, heat pump or control unit.",
  },
  {
    id: "complete",
    title: "Complete Pool Renovation",
    description: "A complete technical and aesthetic renovation consultation.",
  },
];

const toggle = <T extends string>(items: ReadonlyArray<T>, value: T): ReadonlyArray<T> =>
  items.includes(value) ? items.filter((item) => item !== value) : [...items, value];

export function RenovationScopeStep() {
  const { renovation, updateRenovation } = useConfigurator();
  return (
    <StepSection
      title="What would you like to renovate?"
      subtitle="Select every area you would like our consultants to evaluate."
    >
      <div className="grid gap-3">
        {AREAS.map((area) => (
          <ToggleChip
            key={area.id}
            title={area.title}
            description={area.description}
            selected={renovation.areas.includes(area.id)}
            onToggle={() => updateRenovation({ areas: toggle(renovation.areas, area.id) })}
          />
        ))}
      </div>
    </StepSection>
  );
}

export function RenovationPoolStep() {
  const { config, setShape, setDimension } = useConfigurator();
  return (
    <StepSection
      title="Current Pool Information"
      subtitle="Tell us only the essential information about the existing pool."
    >
      <div className="grid gap-3">
        {POOL_SHAPES.map((shape) => (
          <OptionCard
            key={shape.id}
            title={shape.title}
            selected={config.shape === shape.id}
            onSelect={() => setShape(shape.id)}
          />
        ))}
      </div>
      <div className="flex flex-col gap-7 border-t border-hairline pt-8">
        {(["length", "width", "depth"] as const).map((key) => {
          const limits = DIMENSION_LIMITS[key];
          return (
            <DimensionControl
              key={key}
              label={key === "depth" ? "Approximate Depth" : key[0]!.toUpperCase() + key.slice(1)}
              value={config.dimensions[key]}
              min={limits.min}
              max={limits.max}
              step={limits.step}
              unit={limits.unit}
              onChange={(value) => setDimension(key, value)}
            />
          );
        })}
      </div>
    </StepSection>
  );
}

const FILTRATION: ReadonlyArray<{ id: FiltrationWork; title: string }> = [
  { id: "pump", title: "Replace Pump" },
  { id: "filter", title: "Replace Filter" },
  { id: "skimmers", title: "Replace Skimmers" },
  { id: "overflow", title: "Convert to Overflow Edge Pool" },
];
const STRUCTURE: ReadonlyArray<{ id: StructureIssue; title: string }> = [
  { id: "leakage", title: "Water leakage" },
  { id: "crack", title: "Structural crack" },
  { id: "waterproofing", title: "Waterproofing problem" },
  { id: "generalRepair", title: "General structural repair" },
];
const EQUIPMENT: ReadonlyArray<{ id: EquipmentUpgrade; title: string }> = [
  { id: "salt", title: "Salt chlorination" },
  { id: "dosing", title: "Automatic dosing" },
  { id: "heatPump", title: "Heat pump" },
  { id: "automation", title: "Automation / Smart Control" },
];

export function RenovationDetailsStep() {
  const { config, renovation, metrics, skimmers, setFinish, setLinerColor, updateRenovation } =
    useConfigurator();
  const selected = (area: RenovationArea) =>
    renovation.areas.includes(area) || renovation.areas.includes("complete");
  return (
    <StepSection
      title="Renovation Details"
      subtitle="Only the questions relevant to your selected work are shown."
    >
      {selected("interiorFinish") ? (
        <DetailSection title="Interior Finish">
          <p className="label-xs">Current finish</p>
          <div className="grid grid-cols-2 gap-3">
            {FINISHES.map((item) => (
              <OptionCard
                key={item.id}
                title={item.title}
                selected={renovation.currentFinish === item.id}
                onSelect={() => updateRenovation({ currentFinish: item.id })}
              />
            ))}
          </div>
          <p className="label-xs">New finish</p>
          <div className="grid grid-cols-2 gap-3">
            {FINISHES.map((item) => (
              <OptionCard
                key={item.id}
                title={item.title}
                selected={config.finish === item.id}
                onSelect={() => setFinish(item.id)}
              />
            ))}
          </div>
          <p className="label-xs">Finish colour</p>
          <div className="grid grid-cols-3 gap-3">
            {LINER_COLORS.map((item) => (
              <SwatchOption
                key={item.id}
                title={item.title}
                hex={item.hex}
                selected={config.linerColor === item.id}
                onSelect={() => setLinerColor(item.id)}
              />
            ))}
          </div>
        </DetailSection>
      ) : null}
      {selected("filtration") ? (
        <DetailSection title="Pool Filtration System">
          {FILTRATION.map((item) => (
            <ToggleChip
              key={item.id}
              title={item.title}
              description=""
              selected={renovation.filtrationWorks.includes(item.id)}
              onToggle={() =>
                updateRenovation({ filtrationWorks: toggle(renovation.filtrationWorks, item.id) })
              }
            />
          ))}
          {renovation.filtrationWorks.includes("skimmers") ? (
            <p className="rounded-xl border border-hairline bg-brand-soft p-4 text-xs text-foreground">
              Recommended: {skimmers.count} skimmer{skimmers.count === 1 ? "" : "s"} for{" "}
              {formatNumber(metrics.waterSurface)} m² — one every 25 m².
            </p>
          ) : null}
        </DetailSection>
      ) : null}
      {selected("coping") ? (
        <DetailSection title="Pool Edge / Coping">
          <p className="label-xs">Replace existing coping?</p>
          <div className="grid grid-cols-2 gap-3">
            <OptionCard
              title="Yes"
              selected={renovation.replaceCoping === true}
              onSelect={() => updateRenovation({ replaceCoping: true })}
            />
            <OptionCard
              title="No"
              selected={renovation.replaceCoping === false}
              onSelect={() => updateRenovation({ replaceCoping: false })}
            />
          </div>
          {renovation.replaceCoping ? (
            <TextField
              label="Preferred material"
              type="text"
              autoComplete="off"
              value={renovation.copingMaterial}
              onChange={(value) => updateRenovation({ copingMaterial: value })}
            />
          ) : null}
        </DetailSection>
      ) : null}
      {selected("structure") ? (
        <DetailSection title="Pool Structure">
          {STRUCTURE.map((item) => (
            <ToggleChip
              key={item.id}
              title={item.title}
              description=""
              selected={renovation.structureIssues.includes(item.id)}
              onToggle={() =>
                updateRenovation({ structureIssues: toggle(renovation.structureIssues, item.id) })
              }
            />
          ))}
        </DetailSection>
      ) : null}
      {selected("equipment") ? (
        <DetailSection title="Pool Equipment Upgrade">
          {EQUIPMENT.map((item) => (
            <ToggleChip
              key={item.id}
              title={item.title}
              description=""
              selected={renovation.equipmentUpgrades.includes(item.id)}
              onToggle={() =>
                updateRenovation({
                  equipmentUpgrades: toggle(renovation.equipmentUpgrades, item.id),
                })
              }
            />
          ))}
        </DetailSection>
      ) : null}
    </StepSection>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-5 border-t border-hairline pt-8 first:border-0 first:pt-0">
      <h3 className="text-xl font-light text-foreground">{title}</h3>
      {children}
    </section>
  );
}

export function RenovationCustomerStep() {
  const { config, setCustomerField } = useConfigurator();
  const fields = [
    ["name", "Name", "text", "given-name"],
    ["surname", "Surname", "text", "family-name"],
    ["email", "Email", "email", "email"],
    ["phone", "Phone", "tel", "tel"],
    ["city", "City", "text", "address-level2"],
    ["country", "Country", "text", "country-name"],
  ] as const;
  const required = fields.map(([key]) => key);
  const missing = required.filter((key) => config.customer[key].trim().length === 0);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(config.customer.email.trim());
  const complete = missing.length === 0 && emailValid;
  return (
    <StepSection
      title="Customer Information"
      subtitle="Your contact details for a tailored renovation consultation."
    >
      <div className="grid gap-x-8 gap-y-7 sm:grid-cols-2">
        {fields.map(([key, label, type, autoComplete]) => (
          <TextField
            key={key}
            label={label}
            type={type}
            autoComplete={autoComplete}
            value={config.customer[key]}
            required
            error={
              key === "email" && config.customer.email.length > 0 && !emailValid
                ? "Enter a valid email address"
                : undefined
            }
            onChange={(value) => setCustomerField(key, value)}
          />
        ))}
        <div className="sm:col-span-2">
          <Label htmlFor="renovation-notes" className="label-xs">
            Notes
          </Label>
          <Textarea
            id="renovation-notes"
            className="mt-3 min-h-28"
            value={config.customer.notes}
            onChange={(event) => setCustomerField("notes", event.target.value)}
          />
        </div>
      </div>
      <div
        className="rounded-2xl border border-hairline bg-card/40 p-5 text-xs font-light"
        role="status"
        aria-live="polite"
      >
        {complete ? (
          <p className="text-brand">Information complete. You can continue to Review.</p>
        ) : (
          <p className="text-muted-foreground">
            Complete all required fields
            {missing.length
              ? `: ${missing.map((key) => fields.find(([field]) => field === key)?.[1]).join(", ")}`
              : ": enter a valid email address"}
            .
          </p>
        )}
      </div>
    </StepSection>
  );
}

export function RenovationReviewStep() {
  const { config, renovation } = useConfigurator();
  const areaNames = AREAS.filter((item) => renovation.areas.includes(item.id)).map(
    (item) => item.title,
  );
  const color = LINER_COLORS.find((item) => item.id === config.linerColor)?.title;
  const filtration = FILTRATION.filter((item) => renovation.filtrationWorks.includes(item.id)).map(
    (item) => item.title,
  );
  const structure = STRUCTURE.filter((item) => renovation.structureIssues.includes(item.id)).map(
    (item) => item.title,
  );
  const equipment = EQUIPMENT.filter((item) => renovation.equipmentUpgrades.includes(item.id)).map(
    (item) => item.title,
  );
  const rows = [
    ["Requested work", areaNames.join(", ")],
    ["Pool shape", config.shape],
    [
      "Dimensions",
      `${config.dimensions.length} × ${config.dimensions.width} × ${config.dimensions.depth} m`,
    ],
    ["Customer", `${config.customer.name} ${config.customer.surname}`],
    ["Location", `${config.customer.city}, ${config.customer.country}`],
    ...(renovation.areas.includes("interiorFinish") || renovation.areas.includes("complete")
      ? [["Interior finish", `${renovation.currentFinish} → ${config.finish} · ${color}`]]
      : []),
    ...(renovation.areas.includes("filtration") || renovation.areas.includes("complete")
      ? [["Filtration work", filtration.length ? filtration.join(", ") : "Consultation required"]]
      : []),
    ...(renovation.areas.includes("coping") || renovation.areas.includes("complete")
      ? [
          [
            "Coping",
            renovation.replaceCoping
              ? renovation.copingMaterial || "Replace — material to define"
              : "No replacement",
          ],
        ]
      : []),
    ...(renovation.areas.includes("structure") || renovation.areas.includes("complete")
      ? [["Structure", structure.length ? structure.join(", ") : "General assessment"]]
      : []),
    ...(renovation.areas.includes("equipment") || renovation.areas.includes("complete")
      ? [["Equipment", equipment.length ? equipment.join(", ") : "Upgrade assessment"]]
      : []),
    ...(config.customer.notes ? [["Notes", config.customer.notes]] : []),
  ];
  return (
    <StepSection
      title="Renovation Review"
      subtitle="A concise brief for your professional consultation."
    >
      <dl className="rounded-2xl border border-hairline bg-card/40 p-7">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex justify-between gap-6 border-b border-hairline py-4 last:border-0"
          >
            <dt className="label-xs">{label}</dt>
            <dd className="max-w-[65%] text-right text-sm font-light">{value}</dd>
          </div>
        ))}
      </dl>
    </StepSection>
  );
}
