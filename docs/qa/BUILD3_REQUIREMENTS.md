# BUILD 3 — Ristrutturazione e completamento commerciale

Base verificata il 2026-10-11: `bb1c1d5ae1eb7506684e13d158e29b54da024269`, branch operativo `claude/pool-shaper-build2-project-delivery`; archivio Build 2 alla stessa SHA, non modificato. Worktree iniziale pulito.

Questa matrice precede le modifiche applicative. FAIL iniziale significa requisito non ancora dimostrato, non necessariamente difetto. Nessun test locale equivale a invio email reale o deploy.

| ID | Requisito | Stato iniziale | Modifica necessaria / verifica | Test previsto | Evidenza finale | Gate |
|---|---|---|---|---|---|---|
| R01 | Repository, HEAD remoto, WIP, archivio | HEAD remoto e locale bb1c1d5; WIP assente | Preservare e verificare prima del push | Git status/ls-remote | Verifica iniziale eseguita | PASS |
| R02 | Italiano completo | Step e label Ristrutturazione in inglese | Tradurre solo percorso renovation | Test copy + browser | after-scope-desktop, contacts-430, quote-validation-desktop; italiano nel percorso renovation | PASS |
| R03 | Font, palette, componenti premium | Vecchi StepSection, non tray premium | Riutilizzare componenti esistenti | Desktop/mobile screenshot | before-scope-desktop → after-scope-desktop; tray/card/font/token esistenti riutilizzati | PASS |
| R04 | Continua/Indietro e sottocategorie obbligatorie | Flusso esistente da verificare | Correggere gate/sottopassi senza alterare Nuova Piscina | Navigation regression + E2E | Regression sottopassi/gate + browser Back da Summary a Contatti e ai sottopassi proposta; incompatibile disabilita Continua | PASS |
| R05 | Esistente distinto dalla proposta | currentFinish parziale; resto da verificare | Modellare solo dati necessari dell'esistente | Config/state regression | existing separato nel payload; mosaic-before/after-desktop-final; reducer preserva Blue Sky cambiando proposta | PASS |
| R06 | Forma e dimensioni supportate | Scelte esistenti; label/limiti da verificare | Usare limiti e forme reali | Matrice forme/dimensioni | 1.355 controlli: forme reali × 6/8/10/12 × 3/4/5 × flat/slope × skimmer/overflow | PASS |
| R07 | Struttura e sistema esistenti | UI assente nello step attuale | Scelte compatibili dal catalogo | Compatibilità + browser | Pannelli solo liner; renderer preview segue il sistema esistente/proposto; system-before/after-desktop | PASS |
| R08 | Interventi selezionabili | Sei aree già presenti | Conservare catalogo e pulire stati non pertinenti | Renovation tests | Catalogo sei aree conservato; complete espone cinque sottocategorie; pulizia lavori deselezionati | PASS |
| R09 | Liner reale | Catalogo presente | Riutilizzare senza alterare materiali | Liner E2E + snapshot | Blue Sky esistente → Sand Beach proposto, texture/ID reali invariati; tre viewport cloud | PASS |
| R10 | Mosaico reale e nomi leggibili | Catalogo presente | Niente UUID/codici grezzi nel customer UI | Mosaic E2E + export | Campione mosaico 01–09 senza inventare marchi; ID/texture invariati; mosaico 02 in UI/PDF/email | PASS |
| R11 | Optional separati | Equipment separato ma vecchia UI | Presentare come optional, senza prezzi | Browser + summary | Optional impianto distinto; Pompa di calore in sottocategoria e riepilogo | PASS |
| R12 | Riepilogo completo | Inglese/raw shape/finish | Label umane, esistente/proposta, tutte lavorazioni | Summary/export/email tests | Sezioni esistente/proposta/lavori/fattibilità; mosaic-summary-1440/390/430; PDF pagine 2–4 | PASS |
| R13 | Mobile 390/430 | Non verificato per nuova renovation | Correggere solo difetti renovation | Screenshot e E2E | E2E 390×844/430×932; pagina senza overflow orizzontale; canvas 372×310 / 412×352; form leggibile | PASS |
| R14 | 3D geometria/profondità/fondo | Modello condiviso esistente | Verificare aggiornamenti, nessuna nuova geometria | Runtime + metrics tests | Matrice metriche finite; volume rettangolare esatto; runtime profondità 1,20→1,50 e fondo inclinato | PASS |
| R15 | 3D rivestimenti esistenti/proposti | Prima/dopo da verificare | Preview proposta coerente; confronto se supportato | Browser before/after | mosaic-before-desktop-final → mosaic-after-desktop-final stessa camera; liner/mosaico/bordo effettivamente diversi | PASS |
| R16 | Scale/accessi e Skimmer/Sfioro compatibili | Da verificare | Mappature renovation soltanto | Compatibilità/3D regression | Corner+slope bloccato, lineare ammesso; corner-access-390/430; conversione sfioro a griglia visibile | PASS |
| R17 | Nessuna selezione stale da Nuova Piscina | Da verificare | Reset isolato e normalizzazione | Transition tests | Reducer New→Renovation elimina optional stale preservando Project ID; regression PASS | PASS |
| R18 | Project ID + snapshot completo | Backend Build 2 validato | Riutilizzare con dati renovation | Cloud snapshot identity | Sei copie cloud: ID nuovo, snapshot completo esatto, ZERO mismatch; tabella sotto | PASS |
| R19 | Contatto/località/note/privacy | Dialog commerciale presente | Verificare prefill/validazione/consensi | Quote form E2E + schema | Prefill località/note; privacy e timing mancanti mostrano errori italiani; input mantenuti; sei quote confermate | PASS |
| R20 | Allegati opzionali sicuri | Build 2 upload concurrency PASS | Riutilizzo e verifica mirata renovation | Attachment/quote tests | test:attachments policy/mock storage e payload renovation PASS; sicurezza live Build 2 congelata preservata (limite filechooser sotto) | PASS |
| R21 | Server validation/duplicati/errori senza perdita dati | Build 2 backend PASS | Non ricostruire; test nuovi payload | Lead regression + browser errore | Server rifiuta renovation malformata; regressioni duplicati/retry; un lead per copia; errore form conserva dati | PASS |
| R22 | Save/Reload cloud reale | Build 2 PASS | Verificare renovation sul ref autorizzato | Cloud E2E | Sei browser E2E e righe Supabase reali: Save/Reload, nessun falso dirty | PASS |
| R23 | Share/read-only/Save Copy | Build 2 PASS | Verificare snapshot e privacy renovation | Cloud E2E | Sei Share/read-only/Save Copy; snapshot esatto, PII esclusi, edit token invalido rifiutato | PASS |
| R24 | Project Book PDF | Build 2 sette pagine | Dati renovation leggibili e completi | PDF runtime/render/text | Sei PDF browser di sette pagine; ID/materiali/lavori controllati; render pagine 2–4 e 6; Day/Night stessa camera | PASS |
| R25 | Preventivo collegato al progetto | Build 2 PASS | Verificare righe reali e snapshot | Quote cloud E2E | Sei conferme browser e sei lead reali legati a Project ID/snapshot esatti | PASS |
| R26 | Email sandbox con Project ID/configurazione | Queue Build 2 PASS, label renovation inglesi | Label/dettagli renovation; provider mock | Email/lead targeted tests | Email italiana Project ID/lavori/materiali; test provider mock; destinatario aziendale già configurato | PASS |
| R27 | Lead prima di notifica/retry/no duplicati/stati/privacy | Build 2 PASS | Riutilizzo, niente audit ripetuto | Lead/email regression | Audit sandbox: 20 worker → 1 invio mock, error/retry/firme/stati; sei outbox failed EMAIL_NOT_CONFIGURED, provider_id null | PASS |
| R28 | Invio email reale | Rinviato dal proprietario | Non inviare messaggi reali | Verifica nessuna credenziale/invio QA | Rinviato come richiesto | BLOCKED (rinviato, non gate Build 3) |
| R29 | Backend esclusivo Daniele 2 / waetxxqdlsuanqescuye | Connector selezionato e ref verificato | Nessuna nuova migrazione salvo bug | Connessione + persisted rows | get_project ACTIVE_HEALTHY | PASS |
| R30 | Preservare New/Infinity/Fuori Terra/materiali/LED/Photo Mode | Build 2 congelato | No modifica geometrie/wizard New/backend non necessari | Targeted regression + diff review | New preview no-op exact identity; renderer/geometrie/materiali/LED/Photo Mode assenti dal diff; revisori read-only senza regressioni residue | PASS |
| R31 | Typecheck/build/project-config/persistence/export/delivery | Suite disponibili | Eseguire quelle richieste | Comandi mirati | Tutte suite richieste exit 0, typecheck/build PASS, diff-check PASS; nessun deploy | PASS |
| R32 | Prima/dopo reali, commit/push stesso branch | Non ancora eseguito | Evidenze fuori Git, commit solo dopo gate | Browser captures + git verification | Acquisizioni prima/dopo fuori Git verificate; commit/push dopo gate obbligatori, SHA nella consegna Git | PASS |

## Evidenze e comandi finali

Collaudo eseguito il 2026-10-11. Nessuna credenziale in questo report. Nessuna migrazione o dipendenza nuova. Screenshot/PDF fuori dal checkout.

### Browser E2E cloud reale

Tutte le righe: Save Copy → Save → Reload → Share → read-only → PDF → preventivo, sul solo progetto autorizzato. Dati cliente sintetici QA; nessuna email reale.

| Variante | Viewport | Sorgente | Copia verificata | Esito |
|---|---|---|---|---|
| Liner | 1440×900 | PW-8HG9-ENH3W8 | PW-YKVW-4P54K5 | PASS |
| Mosaico | 1440×900 | PW-NKYV-896M0E | PW-G3CX-CRD0YK | PASS |
| Liner | 390×844 | PW-8HG9-ENH3W8 | PW-GC3J-DHQ4CK | PASS |
| Mosaico | 390×844 | PW-NKYV-896M0E | PW-S5WK-DGNDD7 | PASS |
| Liner | 430×932 | PW-8HG9-ENH3W8 | PW-4XNJ-HD83QQ | PASS |
| Mosaico | 430×932 | PW-NKYV-896M0E | PW-7KZ2-Y4NAY4 | PASS |

`scripts/run-renovation-cloud.mjs`: tutte sei copie PASS, ZERO mismatch. Verifica storage durevole (fallback vietato), snapshot/sorgente/copia, PII esclusi da share, token invalido rifiutato, lead/snapshot/outbox reali. Nessun token privato nel report.

### Comandi locali

- `npx tsc --noEmit`: PASS.
- `npm run build`: PASS, soltanto warning preesistenti bundle-size; nessun deploy.
- `npm run test:renovation`: PASS, 1.355 controlli.
- `npm run test:project-config`, `npm run test:persistence`, `npm run test:lead-pipeline`, `npm run test:export-guard`, `npm run test:project-delivery`, `npm run test:attachments`: PASS.
- `node scripts/run-email-notification-audit.mjs`: PASS sandbox/mock; concorrenza/errori/retry/firme/stati.
- `git diff --check`: PASS.
- Revisori indipendenti read-only stato/configurazione e backend/privacy: nessuna regressione confermata residua.

Le suite delivery/attachments locali usano fixture/memory/mock e NON sono indicate come verifiche cloud. Le sei righe sopra sono browser e Supabase reali.

### Evidenze visuali

Directory `../build3-evidence/` rispetto al checkout (non committata). JPEG: `before-scope-desktop`, `after-scope-desktop`, `mosaic-before-desktop-final`, `mosaic-after-desktop-final`, `mosaic-after-390-final`, `corner-access-390`, `corner-access-430`, `slope-access-incompatible-desktop`, `slope-access-linear-desktop`, `system-before-desktop`, `system-after-desktop`, `contacts-430`, `quote-validation-desktop`, `liner-form-390/430`, riepiloghi/conferme delle sei righe E2E.

PDF `{liner,mosaic}-{1440,390,430}-final.pdf`: sette pagine, Project ID/materiali/lavori controllati. Render `liner-pdf-presentation-final.png` / `mosaic-pdf-presentation-final.png`. Il vecchio render `mosaic-pdf-presentation.png` mostrava night close-up diverso dal day hero: corretto bloccando review solo durante capture renovation. Le immagini della comparazione renovation sono contenute nel riquadro senza crop, anche mobile; nessun cambiamento al PDF Nuova Piscina.

### Limiti e rinvii espliciti

- Email reale rinviata dal proprietario: non testata/inviata; dominio/mittente Piscine Wellness da attivare in futuro. R28 non è gate Build 3.
- Il tentativo upload live via filechooser in questa sessione è stato interrotto dal tool: NON contato come PASS live. R20 usa i test mirati policy/mock PASS e il backend upload Build 2 congelato, non modificato. Nessun bug nuovo dell'upload dimostrato.
- Alcune acquisizioni PDF sono state ripetute dopo interruzioni del controllo browser; solo i file effettivamente scaricati e ispezionati costituiscono evidenza.
- Nessun prezzo, materiale, lavorazione extra o conformità normativa inventati.
