import { Link, createFileRoute } from "@tanstack/react-router";

const title = "Informativa sulla Privacy — Piscine Wellness";
const description =
  "Informativa sul trattamento dei dati personali raccolti tramite il configuratore piscine Piscine Wellness.";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [{ title }, { name: "description", content: description }],
  }),
  component: PrivacyPolicy,
});

/** Placeholder that still stands out visually against the body text below,
 * for anything a customer-facing legal page cannot state without real
 * legal/business review (company registration details, DPO contact,
 * retention windows, etc.). See the P6A report for the full list. */
function Placeholder({ children }: { children: string }) {
  return (
    <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-destructive">[{children}]</span>
  );
}

function Section({ title: heading, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-hairline pt-8 first:border-0 first:pt-0">
      <h2 className="text-[15px] font-normal tracking-tight text-foreground">{heading}</h2>
      <div className="flex flex-col gap-3 text-[13px] leading-[1.8] font-light text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

function PrivacyPolicy() {
  return (
    <main className="mx-auto flex min-h-screen max-w-[640px] flex-col gap-10 px-6 py-16 sm:px-8">
      <div>
        <Link to="/" className="label-xs text-muted-foreground hover:text-foreground">
          ← Torna al configuratore
        </Link>
      </div>

      <header className="flex flex-col gap-4">
        <h1 className="text-[32px] font-extralight tracking-[-0.03em] text-foreground">
          Informativa sulla Privacy
        </h1>
        <p className="text-[13px] leading-[1.8] font-light text-muted-foreground">
          Questa informativa descrive come Piscine Wellness tratta i dati personali raccolti tramite
          il configuratore piscine, in conformità al Regolamento (UE) 2016/679 (GDPR).
        </p>
        <div
          role="note"
          className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-[12px] leading-[1.7] font-light text-destructive"
        >
          Documento predisposto per lo sviluppo del prodotto. I campi evidenziati devono essere
          completati e la pagina deve essere validata da un consulente legale/privacy prima della
          pubblicazione in produzione.
        </div>
      </header>

      <div className="flex flex-col gap-8">
        <Section title="1. Titolare del trattamento">
          <p>
            <Placeholder>Ragione sociale completa di Piscine Wellness</Placeholder>, con sede in{" "}
            <Placeholder>indirizzo sede legale</Placeholder>, P.IVA/C.F.{" "}
            <Placeholder>numero P.IVA</Placeholder>, contattabile all&apos;indirizzo{" "}
            <Placeholder>email privacy/DPO</Placeholder>.
          </p>
        </Section>

        <Section title="2. Dati raccolti">
          <p>Quando invii una richiesta di valutazione dal configuratore raccogliamo:</p>
          <ul className="ml-4 list-disc space-y-1.5">
            <li>Dati di contatto: nome, email, telefono, località del progetto;</li>
            <li>Tempistica desiderata e note facoltative che scegli di aggiungere;</li>
            <li>
              La configurazione completa della piscina che hai progettato (forma, dimensioni,
              sistema idraulico, rivestimento, bordo, accesso, illuminazione, dotazioni);
            </li>
            <li>
              La tua scelta di accettazione della presente informativa e del consenso al marketing
              (se dato).
            </li>
          </ul>
        </Section>

        <Section title="3. Finalità e base giuridica">
          <p>
            Utilizziamo questi dati per valutare la fattibilità del progetto e predisporre una
            proposta commerciale (esecuzione di misure precontrattuali su tua richiesta, art. 6.1.b
            GDPR). Se hai dato il consenso facoltativo, potremo inviarti comunicazioni commerciali
            (consenso, art. 6.1.a GDPR) — puoi revocarlo in qualsiasi momento.
          </p>
        </Section>

        <Section title="4. Conservazione dei dati">
          <p>
            Conserviamo i dati per il tempo necessario a gestire la tua richiesta e, in caso di
            rapporto contrattuale, per <Placeholder>periodo di conservazione definito</Placeholder>{" "}
            in base agli obblighi di legge applicabili.
          </p>
        </Section>

        <Section title="5. Destinatari dei dati">
          <p>
            I dati sono trattati dal nostro personale autorizzato e da fornitori tecnici che
            agiscono come responsabili del trattamento, tra cui il servizio utilizzato per
            l&apos;invio delle email di notifica (Resend) e{" "}
            <Placeholder>fornitore di hosting/archiviazione dati</Placeholder>. Non vendiamo né
            condividiamo i tuoi dati con terzi per finalità diverse da quelle indicate.
          </p>
        </Section>

        <Section title="6. I tuoi diritti">
          <p>
            Puoi richiedere in qualsiasi momento l&apos;accesso, la rettifica, la cancellazione o la
            limitazione del trattamento dei tuoi dati, opporti al trattamento o richiederne la
            portabilità, scrivendo a <Placeholder>email privacy/DPO</Placeholder>. Hai inoltre
            diritto di proporre reclamo al Garante per la Protezione dei Dati Personali.
          </p>
        </Section>

        <Section title="7. Aggiornamenti">
          <p>
            Questa informativa può essere aggiornata; la versione corrente è sempre disponibile a
            questo indirizzo.
          </p>
          <p className="text-[11px] tracking-[0.06em] text-muted-foreground/70">
            Ultimo aggiornamento: <Placeholder>data di pubblicazione</Placeholder>
          </p>
        </Section>
      </div>
    </main>
  );
}
