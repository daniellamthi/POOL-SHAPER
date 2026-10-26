import { PresentationContextPicker } from "@/components/pool/PresentationContextPicker";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { Droplets, Paintbrush, Layers, Wrench, Settings, RefreshCw } from "lucide-react";
import { ChoiceCard, ChoiceGrid, GroupLabel, StepTabs } from "@/components/pool/wizard/ChoiceCard";
import { ShapeTray, type TrayContext } from "@/components/pool/wizard/StepTrays";
import { FileDrop } from "@/components/pool/FileDrop";
import { TextField } from "@/components/pool/TextField";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FINISHES, LINER_COLORS } from "@/lib/pool/config";
import { copingMaterialsForPool } from "@/lib/pool/coping-materials";
import { isReferenceFinish, isPorcelainReference } from "@/lib/pool/reference-finishes";
import { ReferenceFinishSwatch } from "@/components/pool/ReferenceFinishSwatch";
import { PorcelainFinishChoice } from "@/components/pool/PorcelainFinishChoice";
import { useConfigurator } from "@/lib/pool/context";
import { allowedFinishesForStructure } from "@/lib/pool/structure-finish";
import { renovationDecisions, renovationPreviewConfig, renovationMosaicLabel, renovationLinerLabel } from "@/lib/pool/renovation";
import { configuredAccessPlan } from "@/lib/pool/access-plan";
import { getCustomerValidation } from "@/lib/pool/validation";
import type { RenovationConfig } from "@/lib/pool/types";
import { RENOVATION_AREA_LABEL, FILTRATION_WORK_LABEL, STRUCTURE_ISSUE_LABEL, EQUIPMENT_UPGRADE_LABEL } from "@/lib/lead/renovationLabels";
import { MOSAIC_FINISHES } from "@/configurator/materials/interior-textures";
import { ProposalComparison } from "@/components/pool/delivery/ProposalComparison";
import { ProjectSummary } from "@/components/pool/ProjectSummary";
import { ProjectDeliveryPanel } from "@/components/pool/delivery/ProjectDelivery";
import { useProjectDelivery } from "@/components/pool/delivery/useProjectDelivery";
import { LeadRequestDialog } from "@/configurator/steps/final-review/LeadRequestDialog";

type DecisionProps = { tab: string; setTab: (id: string) => void };
const toggle = <T extends string>(items: readonly T[], id: T): readonly T[] =>
  items.includes(id) ? items.filter(v => v !== id) : [...items, id];
const body = "flex flex-col gap-5";

export function RenovationScopeStep() {
  const { t } = useI18n();
  const { renovation: r, updateRenovation } = useConfigurator();
  const icons = { interiorFinish: Paintbrush, filtration: Droplets, coping: Layers, structure: Wrench, equipment: Settings, complete: RefreshCw };
  const descriptions = {
    interiorFinish: "Sostituzione del liner o rinnovo del mosaico.",
    filtration: "Pompa, filtro e sistema di raccolta dell’acqua.",
    coping: "Sostituzione del bordo con una finitura del catalogo.",
    structure: "Perdite, fessurazioni e impermeabilizzazione.",
    equipment: "Dotazioni aggiuntive da valutare con il consulente.",
    complete: "Valutazione di tutte le aree della piscina.",
  };
  return <div className={body}>
    <ChoiceGrid label={t("Interventi di ristrutturazione")}>
      {Object.entries(RENOVATION_AREA_LABEL).map(([key, title]) => {
        const id = key as keyof typeof RENOVATION_AREA_LABEL;
        const Icon = icons[id];
        return <ChoiceCard key={id} title={title} description={descriptions[id]} image={<Icon className="size-16" strokeWidth={1} />}
          selected={r.areas.includes(id)} onSelect={() => updateRenovation({ areas: toggle(r.areas, id) })} />;
      })}
    </ChoiceGrid>
    <p className="text-[12px] font-light text-muted-foreground">{t("Puoi scegliere più interventi. Optional e dettagli vengono richiesti nei passaggi successivi.")}</p>
  </div>;
}

function FinishCatalogue({ existing = false }: { existing?: boolean }) {
  const { t } = useI18n();
  const { config, renovation: r, updateRenovation, setFinish, setLinerColor, setMosaicFinish } = useConfigurator();
  const finish = existing ? r.existing?.finish ?? r.currentFinish : config.finish;
  const choose = (value: Partial<NonNullable<RenovationConfig["existing"]>>) => updateRenovation({ existing: { ...r.existing, ...value } });
  const allowed = allowedFinishesForStructure(r.existing?.structure ?? config.structure);
  return <div className={body}>
    <ChoiceGrid label={existing ? "Rivestimento esistente" : "Nuovo rivestimento"}>
      {FINISHES.filter(f => allowed.includes(f.id)).map(f => <ChoiceCard key={f.id} compact title={f.title}
        image={<Paintbrush className="size-12" strokeWidth={1} />} selected={existing ? r.existing?.finish === f.id : config.finish === f.id}
        onSelect={() => existing ? updateRenovation({ currentFinish: f.id, existing: { ...r.existing, finish: f.id,
          linerColor: r.existing?.linerColor ?? config.linerColor, mosaicFinish: r.existing?.mosaicFinish ?? config.mosaicFinish } }) : setFinish(f.id)} />)}
    </ChoiceGrid>
    {allowed.length === 1 ? <p className="text-[12px] text-muted-foreground">{t("La struttura a pannelli è compatibile con Liner PVC, non con il mosaico.")}</p> : null}
    <GroupLabel>{existing ? "Finitura attuale" : "Finitura proposta"}</GroupLabel>
    <ChoiceGrid label={finish === "mosaic" ? "Mosaici del catalogo" : "Liner del catalogo"} dense>
      {finish === "mosaic" ? MOSAIC_FINISHES.map(m => <ChoiceCard compact key={m.id} title={renovationMosaicLabel(m.id)} image={m.preview}
        selected={(existing ? r.existing?.mosaicFinish ?? config.mosaicFinish : config.mosaicFinish) === m.id}
        onSelect={() => existing ? choose({ mosaicFinish: m.id }) : setMosaicFinish(m.id)} />)
        : LINER_COLORS.map(l => <ChoiceCard compact key={l.id} title={renovationLinerLabel(l.title)} image={l.texture}
          selected={(existing ? r.existing?.linerColor ?? config.linerColor : config.linerColor) === l.id}
          onSelect={() => existing ? choose({ linerColor: l.id }) : setLinerColor(l.id)} />)}
    </ChoiceGrid>
    {finish === "mosaic" ? <p className="text-[12px] text-muted-foreground">{t("Campioni reali del catalogo. Il catalogo non fornisce nomi commerciali: gli identificativi tecnici restano nei dati del progetto.")}</p> : null}
  </div>;
}

export function RenovationPoolStep({ ctx, tab, setTab }: { ctx: TrayContext } & DecisionProps) {
  const { t } = useI18n();
  const { config, renovation: r, updateRenovation } = useConfigurator();
  const e = r.existing;
  const choose = (patch: Partial<NonNullable<RenovationConfig["existing"]>>) => updateRenovation({ existing: { ...e, ...patch } });
  return <div className={body}>
    <StepTabs label={t("Dati della piscina esistente")} tabs={renovationDecisions("renovation-pool", r)} value={tab} onChange={setTab} />
    <p className="text-[12px] text-muted-foreground">{t("Stato esistente · il 3D mostra la vasca attuale, non i lavori futuri.")}</p>
    {["shape", "plan", "depth"].includes(tab) ? <ShapeTray ctx={ctx} tab={tab} setTab={setTab} showTabs={false} /> : null}
    {tab === "structure" ? <>
      <ChoiceGrid label={t("Installazione esistente")}>
        {([ ["in-ground", "Interrata"], ["above-ground", "Fuori terra"] ] as const).map(([id, title]) =>
          <ChoiceCard key={id} compact title={title} image={<Layers className="size-12" strokeWidth={1} />} selected={e?.poolType === id}
            onSelect={() => choose({ poolType: id, ...(id === "above-ground" ? { structure: "modular-steel-panels", finish: "liner" } : {}) })} />)}
      </ChoiceGrid>
      <ChoiceGrid label={t("Struttura esistente")}>
        {([ ["reinforced-concrete", "Calcestruzzo armato"], ["modular-steel-panels", "Pannelli in acciaio"] ] as const)
          .filter(([id]) => e?.poolType !== "above-ground" || id === "modular-steel-panels")
          .map(([id, title]) => <ChoiceCard key={id} compact title={title} image={<Layers className="size-12" strokeWidth={1} />} selected={e?.structure === id}
            onSelect={() => updateRenovation({ ...(id === "modular-steel-panels" ? { currentFinish: "liner" } : {}), existing: { ...e, structure: id, ...(id === "modular-steel-panels" ? { finish: "liner" } : {}) } })} />)}
      </ChoiceGrid>
    </> : null}
    {tab === "system" ? <>
      <ChoiceGrid label={t("Sistema idraulico esistente")}>
        {([ ["skimmer", "Skimmer"], ["overflow", "Sfioro"] ] as const).map(([id, title]) =>
          <ChoiceCard key={id} compact title={title} image={<Droplets className="size-12" strokeWidth={1} />} selected={e?.system === id} onSelect={() => choose({ system: id })} />)}
      </ChoiceGrid>
      {e?.system === "overflow" ? <ChoiceGrid label={t("Sfioro esistente")}>
        {([ ["visible", "Sfioro a vista"], ["hidden", "Sfioro a bordo continuo"] ] as const).map(([id, title]) =>
          <ChoiceCard key={id} compact title={title} image={<Droplets className="size-12" strokeWidth={1} />} selected={e.overflowType === id} onSelect={() => choose({ overflowType: id })} />)}
      </ChoiceGrid> : null}
    </> : null}
    {tab === "finish" ? <>
      <FinishCatalogue existing />
      <GroupLabel>{t("Bordo esistente")}</GroupLabel>
      <ChoiceGrid label={t("Bordo attuale")} dense>{copingMaterialsForPool(e?.poolType ?? config.poolType)
        .filter(c => (e?.poolType ?? config.poolType) === "above-ground" || !isPorcelainReference(c.id))
        .map(c => (e?.poolType ?? config.poolType) === "in-ground" && c.id === "anthracite-gres" ?
        <PorcelainFinishChoice key={c.id} value={e?.copingMaterial} onSelect={id => choose({ copingMaterial: id })} /> : <ChoiceCard compact key={c.id} title={t(c.title)}
        image={isReferenceFinish(c.id) ? <ReferenceFinishSwatch id={c.id} /> : <span className="size-16 rounded-lg" style={{ backgroundColor: c.color }} />}
        selected={(e?.copingMaterial ?? "travertine") === c.id} onSelect={() => choose({ copingMaterial: c.id })} />)}</ChoiceGrid>
    </> : null}
    {tab === "access" ? <>
      <ChoiceGrid label={t("Accesso esistente")}>
        {([ [null, "Senza scala interna"], ["internalSteps", "Scala interna"], ["stainlessSteelLadder", "Scaletta inox"] ] as const)
          .filter(([id]) => e?.poolType !== "above-ground" || id !== "stainlessSteelLadder")
          .map(([id, title]) => <ChoiceCard key={id ?? "none"} compact title={title} image={<Layers className="size-12" strokeWidth={1} />} selected={e?.poolAccess === id}
            onSelect={() => choose({ poolAccess: id })} />)}
      </ChoiceGrid>
      {e?.poolAccess === "internalSteps" ? <ChoiceGrid label={t("Scala interna esistente")}>
        {([ ["linear", "Scala rettilinea"], ["corner", "Scala angolare"] ] as const)
          .filter(([id]) => !configuredAccessPlan(renovationPreviewConfig(config, { ...r, existing: { ...e, internalStairType: id } }, true)).reason)
          .map(([id, title]) =>
          <ChoiceCard key={id} compact title={title} image={<Layers className="size-12" strokeWidth={1} />} selected={(e.internalStairType ?? "linear") === id}
            onSelect={() => choose({ internalStairType: id })} />)}
      </ChoiceGrid> : null}
      {e?.poolAccess && configuredAccessPlan(renovationPreviewConfig(config, r, true)).reason ? <p role="alert" className="text-[12px] text-destructive">
        {t(configuredAccessPlan(renovationPreviewConfig(config, r, true)).reason ?? "")} {t("Scegli un accesso compatibile o indica una vasca senza scala interna.")}{" "}</p> : null}
    </> : null}
  </div>;
}

export function RenovationDetailsStep({ tab, setTab, before, setBefore }: DecisionProps & { before: boolean; setBefore: (v: boolean) => void }) {
  const { t } = useI18n();
  const { config, renovation: r, updateRenovation, setOverflowType } = useConfigurator();
  return <div className={body}>
    <StepTabs label={t("Lavori proposti")} tabs={renovationDecisions("renovation-details", r)} value={tab} onChange={setTab} />
    <StepTabs label={t("Confronto piscina")} tabs={[{ id: "before", label: "Prima · esistente" }, { id: "after", label: "Dopo · proposta" }]}
      value={before ? "before" : "after"} onChange={v => setBefore(v === "before")} />
    <p className="text-[12px] text-muted-foreground">{t("Anteprima indicativa: gli interventi su impianti e ripristini richiedono verifica in cantiere.")}</p>
    {tab === "interiorFinish" ? <FinishCatalogue /> : null}
    {tab === "filtration" ? <><ChoiceGrid label={t("Lavori impianto")}>
      {Object.entries(FILTRATION_WORK_LABEL).filter(([id]) => r.existing?.system !== "overflow" || (id !== "skimmers" && id !== "overflow")).map(([key, title]) => {
        const id = key as keyof typeof FILTRATION_WORK_LABEL;
        return <ChoiceCard key={id} compact title={title} image={<Droplets className="size-12" strokeWidth={1} />} selected={r.filtrationWorks.includes(id)}
          onSelect={() => updateRenovation({ filtrationWorks: toggle(r.filtrationWorks.filter(v => id === "overflow" ? v !== "skimmers" : id === "skimmers" ? v !== "overflow" : true), id) })} />;
      })}
    </ChoiceGrid>
      {r.filtrationWorks.includes("overflow") ? <ChoiceGrid label={t("Sfioro proposto")}>
        {([ ["visible", "Sfioro a vista"], ["hidden", "Sfioro a bordo continuo"] ] as const).map(([id, title]) =>
          <ChoiceCard key={id} compact title={title} image={<Droplets className="size-12" strokeWidth={1} />}
            selected={config.overflowType === id} onSelect={() => setOverflowType(id)} />)}
      </ChoiceGrid> : null}
    </> : null}
    {tab === "coping" ? <>
      <ChoiceGrid label={t("Sostituzione bordo")}>
        {([ [true, "Sostituire il bordo"], [false, "Conservare il bordo"] ] as const).map(([value, title]) => <ChoiceCard key={String(value)} compact title={title}
          image={<Layers className="size-12" strokeWidth={1} />} selected={r.replaceCoping === value} onSelect={() => updateRenovation({ replaceCoping: value })} />)}
      </ChoiceGrid>
      {r.replaceCoping ? <ChoiceGrid label={t("Nuovo bordo")} dense>{copingMaterialsForPool(r.existing?.poolType ?? config.poolType)
        .filter(c => (r.existing?.poolType ?? config.poolType) === "above-ground" || !isPorcelainReference(c.id))
        .map(c => (r.existing?.poolType ?? config.poolType) === "in-ground" && c.id === "anthracite-gres" ?
        <PorcelainFinishChoice key={c.id} value={r.copingMaterial} onSelect={id => updateRenovation({ copingMaterial: id })} /> : <ChoiceCard compact key={c.id} title={t(c.title)}
        image={isReferenceFinish(c.id) ? <ReferenceFinishSwatch id={c.id} /> : <span className="size-16 rounded-lg" style={{ backgroundColor: c.color }} />} selected={r.copingMaterial === c.id}
        onSelect={() => updateRenovation({ copingMaterial: c.id })} />)}</ChoiceGrid> : null}
    </> : null}
    {tab === "structure" ? <ChoiceGrid label={t("Ripristini richiesti")}>
      {Object.entries(STRUCTURE_ISSUE_LABEL).map(([key, title]) => { const id = key as keyof typeof STRUCTURE_ISSUE_LABEL;
        return <ChoiceCard compact key={id} title={title} image={<Wrench className="size-12" strokeWidth={1} />} selected={r.structureIssues.includes(id)}
          onSelect={() => updateRenovation({ structureIssues: toggle(r.structureIssues, id) })} />; })}
    </ChoiceGrid> : null}
    {tab === "equipment" ? <ChoiceGrid label={t("Optional impianto")}>
      {Object.entries(EQUIPMENT_UPGRADE_LABEL).map(([key, title]) => { const id = key as keyof typeof EQUIPMENT_UPGRADE_LABEL;
        return <ChoiceCard optional key={id} title={title} description={t("Da dimensionare con il consulente")} image={<Settings className="size-8" strokeWidth={1} />}
          selected={r.equipmentUpgrades.includes(id)} onSelect={() => updateRenovation({ equipmentUpgrades: toggle(r.equipmentUpgrades, id) })} />; })}
    </ChoiceGrid> : null}
  </div>;
}

export function RenovationCustomerStep() {
  const { t } = useI18n();
  const { config, setCustomerField } = useConfigurator();
  const validation = getCustomerValidation(config.customer);
  return <div className={body}>
    <div className="grid gap-5 sm:grid-cols-2">
      {([ ["name", "Nome", "text", "given-name"], ["surname", "Cognome", "text", "family-name"], ["email", "Email", "email", "email"],
        ["phone", "Telefono", "tel", "tel"], ["city", "Località intervento", "text", "address-level2"], ["country", "Paese", "text", "country-name"] ] as const).map(([key, label, type, autoComplete]) =>
          <TextField key={key} label={label} type={type} autoComplete={autoComplete} required={key !== "surname"} value={config.customer[key]}
            error={key === "email" && config.customer.email.length > 0 && !validation.emailValid ? "Inserisci un indirizzo email valido." : undefined}
            onChange={v => setCustomerField(key, v)} />)}
    </div>
    <div><Label htmlFor="renovation-notes">{t("Note cliente (facoltative)")}</Label><Textarea id="renovation-notes" className="mt-2" maxLength={2000}
      value={config.customer.notes} onChange={e => setCustomerField("notes", e.target.value)} /></div>
    <FileDrop category="site" label={t("Foto o planimetrie (facoltative)")} hint={t("JPG, PNG, WebP o PDF. Gli allegati non sono inclusi nel link pubblico.")} />
  </div>;
}

export function RenovationReviewStep({ ctx }: { ctx: TrayContext }) {
  const { t } = useI18n();
  const { config, projectConfiguration } = useConfigurator();
  const delivery = useProjectDelivery();
  return <div className={body}>
    <ProjectDeliveryPanel delivery={delivery} captureHero={ctx.captureHero} captureDayNight={ctx.captureDayNight} />
    {ctx.openGardenStudio ? <Button variant="outline" onClick={ctx.openGardenStudio}>{t("Nel tuo giardino")}</Button> : null}
    {ctx.presentationContext ? <PresentationContextPicker choice={ctx.presentationContext} /> : null}
    <ProposalComparison captureHero={ctx.captureHero} onApplied={() => delivery.setHeroUrl(null)} />
    <ProjectSummary publicRef={delivery.link?.publicRef} heroUrl={delivery.heroUrl} />
    <section className="flex flex-col gap-3 border-t border-hairline pt-5">
      <h3 className="text-[20px] font-light">{t("Richiedi una proposta di ristrutturazione")}</h3>
      <p className="text-[12px] font-light text-muted-foreground">{t("Un consulente verifica lavori, fattibilità e investimento. Nessun prezzo automatico.")}</p>
      <LeadRequestDialog projectConfiguration={projectConfiguration} projectReference={delivery.link?.publicRef}
        prepareProject={async () => {
          const saved = await delivery.save();
          return saved ? { projectConfiguration: saved.projectConfiguration, projectReference: saved.publicRef } : null;
        }}
        defaultCustomer={{ name: [config.customer.name, config.customer.surname].filter(Boolean).join(" "), email: config.customer.email, phone: config.customer.phone,
          projectLocation: [config.customer.city, config.customer.country].filter(Boolean).join(", "), notes: config.customer.notes }} />
    </section>
  </div>;
}
