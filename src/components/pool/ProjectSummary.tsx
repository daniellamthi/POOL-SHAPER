import { useMemo, type ReactNode } from "react";
import { STEPS } from "@/lib/pool/config";
import { useConfigurator } from "@/lib/pool/context";
import {
  buildProjectSummary,
  type SummaryRow,
  type SummarySwatch,
} from "@/lib/project-delivery/summary-model";

const stepIndex = (id: string) => STEPS.findIndex((step) => step.id === id);

function EditLink({ label = "Modifica", onEdit }: { label?: string; onEdit: () => void }) {
  return (
    <button
      type="button"
      onClick={onEdit}
      className="shrink-0 text-[10px] font-normal uppercase tracking-[0.16em] text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
    >
      {label}
    </button>
  );
}

function Section({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit?: (() => void) | undefined;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 border-t border-hairline pt-7 first:border-0 first:pt-0">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-[10px] font-normal uppercase tracking-[0.18em] text-muted-foreground">
          {title}
        </h3>
        {onEdit ? <EditLink onEdit={onEdit} /> : null}
      </div>
      <dl className="flex flex-col gap-3.5">{children}</dl>
    </section>
  );
}

function Swatch({ hex, texture }: SummarySwatch) {
  return (
    <span
      aria-hidden
      className="inline-block size-4 shrink-0 rounded-full border border-hairline/80 bg-cover bg-center"
      style={{ backgroundColor: hex, backgroundImage: texture ? `url(${texture})` : undefined }}
    />
  );
}

function Row({ row }: { row: SummaryRow }) {
  return (
    <div className="flex items-start justify-between gap-6" data-summary-row={row.label}>
      <dt className="pt-0.5 text-[11px] font-light text-muted-foreground">{row.label}</dt>
      <dd className="flex max-w-[64%] flex-col items-end gap-1 text-right">
        <span className="flex items-center gap-2 text-[13px] font-light text-foreground">
          {row.swatch ? <Swatch {...row.swatch} /> : null}
          {row.value}
        </span>
        {row.hint ? (
          <span className="text-[11px] font-light text-muted-foreground/85 italic">{row.hint}</span>
        ) : null}
      </dd>
    </div>
  );
}

/** The Premium Summary: renders `buildProjectSummary` -- the same model the
 * Project Book PDF renders -- computed only from the canonical
 * `ProjectConfiguration`. Nothing here keeps a second copy of a choice. */
export function ProjectSummary({
  publicRef,
  heroUrl,
}: {
  /** Public project reference (PW-XXXX-XXXXXX) once the project is saved. */
  publicRef?: string | null | undefined;
  /** Clean hero capture of the configured pool, when taken. */
  heroUrl?: string | null | undefined;
} = {}) {
  const { projectConfiguration, goToStep } = useConfigurator();
  const model = useMemo(() => buildProjectSummary(projectConfiguration), [projectConfiguration]);
  const editStep = (id: string) => {
    const index = stepIndex(id);
    return index >= 0 ? () => goToStep(index) : undefined;
  };

  return (
    <section
      className="animate-rise flex flex-col gap-9 rounded-2xl border border-hairline bg-card/40 p-7"
      data-testid="project-summary"
    >
      {heroUrl ? (
        <img
          src={heroUrl}
          alt="La tua piscina configurata"
          className="-mx-7 -mt-7 aspect-[16/9] w-[calc(100%+3.5rem)] max-w-none rounded-t-2xl bg-viewport object-cover"
        />
      ) : null}
      <header className="flex flex-col gap-3">
        <p className="text-[10px] font-normal uppercase tracking-[0.18em] text-muted-foreground">
          Il tuo progetto
        </p>
        <h2 className="text-[26px] leading-[1.08] font-extralight tracking-[-0.02em] text-foreground sm:text-[30px]">
          {model.headline}
        </h2>
        <p className="text-[12px] font-light text-muted-foreground">{model.subline}</p>
        <p className="text-[11px] font-light tracking-[0.08em] text-muted-foreground">
          {publicRef ? (
            <>
              Project ID{" "}
              <span className="font-normal text-brand" data-testid="summary-project-ref">
                {publicRef}
              </span>
            </>
          ) : (
            "Project ID assegnato al salvataggio"
          )}
        </p>
        <a
          href="#pool-viewport"
          className="w-fit text-[11px] font-light text-muted-foreground underline-offset-4 hover:text-foreground hover:underline lg:hidden"
        >
          ↑ Espandi piscina
        </a>
      </header>

      {model.sections.map((section) => (
        <Section key={section.id} title={section.title} onEdit={editStep(section.stepId)}>
          {section.rows.map((row, index) => (
            <Row key={`${row.label}-${index}`} row={row} />
          ))}
        </Section>
      ))}

      {model.deferred.length > 0 ? (
        <section className="flex flex-col gap-4 border-t border-hairline pt-7">
          <h3 className="text-[10px] font-normal uppercase tracking-[0.18em] text-muted-foreground">
            Da definire con il consulente
          </h3>
          <ul className="flex flex-col gap-2.5">
            {model.deferred.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2.5 text-[12px] font-light text-muted-foreground"
              >
                <span aria-hidden className="mt-[7px] size-1 shrink-0 rounded-full bg-brand" />
                {item}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <details className="group border-t border-hairline pt-7">
        <summary className="cursor-pointer list-none text-[10px] font-normal uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground">
          Scopri i dettagli tecnici
        </summary>
        <dl className="mt-5 flex flex-col gap-3.5">
          {model.technical.map((row) => (
            <Row key={row.label} row={row} />
          ))}
          <Row row={{ label: "Codice configurazione", value: model.projectId }} />
        </dl>
        <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
          {model.technicalNote}
        </p>
      </details>
    </section>
  );
}
