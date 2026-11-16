# Micro-spot e Finiture — gate mirato, 19 ottobre 2026

Base: `0a1b01bc2bb2bac9c59191bb89119403b7fa996a`; branch `feat/fullscreen-day-night-hidden-overflow`.
WIP precedente: 39 file preservati nel backup locale `residual-gates-20261015-zzsEn6`. Nessun backend, nuova ambientazione o refactor generale.

## Matrice requisiti

| ID | Requisito / accettazione | Responsabile | Test / evidenza necessaria | Stato |
|---|---|---|---|---|
| MS-01 | Piccoli apparecchi realistici, coerenti con fari principali, incassati e centrati nelle alzate; quantità contenuta | Lighting 3D | Geometria e giorno/notte; `desktop-straight-main-red-calibrated.jpg`, `desktop-corner-main-red-calibrated.jpg` | PASS |
| MS-02 | Micro-spot sotto panca idromassaggio, ordinati, pochi, nessuna modifica seduta/schienale | Lighting 3D | 2 L / 3 U, raycast e invarianti; `desktop-hydroA-blue-calibrated.jpg`, `desktop-hydroB-red-calibrated.jpg` | PASS |
| MS-03 | Scale e panca seguono il colore LED globale e relativa resa, senza bianco fisso; optional indipendenti | Lighting 3D / integrazione | 8 colori × dimmer nei test; `desktop-corner-main-red-calibrated.jpg`, A blu/B rosso e mobile ON/OFF/Giorno | PASS |
| MS-04 | Bocchette e getti non emissivi, nessuna confusione con luci dedicate | Lighting 3D / QA indipendente | `HydroJet` invariato e senza emissione; A ravvicinato giorno/notte, B d'insieme | PASS |
| UX-01 | Gres: selezione categoria mostra e accompagna immediatamente alle quattro tonalità reali | UX Finiture | `desktop-gres-auto.jpg`, `mobile390-gres-after.jpg`, `mobile430-gres-after.jpg`; replay indipendente | PASS |
| UX-02 | Travertino categoria con sottovarianti esistenti comprensibili e riconoscibili | UX Finiture | `desktop-travertine-auto.jpg`, `mobile390-travertine-after.jpg`, `mobile430-travertine-auto.jpg`; chiaro/venato esistenti | PASS |
| UX-03 | Materiale → relativa scelta successiva, scroll morbido interno, highlight discreto, nessun popup/salto cieco | UX Finiture | Replay bordo/pavimentazione e liner/mosaico; focus/reduced-motion nei 602 controlli mirati | PASS |
| UX-04 | Nessun reset o perdita di selezioni, né cambi inattesi al pannello | UX / QA indipendente | Riepilogo e Indietro/Continua nel browser; 20 cicli reducer e snapshot canonici offline | PASS |
| QA-01 | Verifica indipendente reale nel browser integrato, anteprima visibile | QA indipendente | Replay diretto finale PASS, report separato; integratore con anteprima visibile, 43 catture incluse quelle diagnostiche | PASS |
| QA-02 | Desktop 1440, mobile 390 e 430 emulati | QA indipendente | Catture 1440×900, 390×844, 430×932 di finiture e luci; nessun dispositivo fisico dichiarato | PASS |
| QA-03 | Typecheck, production build, test mirati UI/UX/3D e diff-check | Integrazione | Comandi rieseguiti dopo la calibrazione definitiva a 2 cd | PASS |
| SAFE-01 | Preservazione WIP, isolamento file agenti, no merge/deploy/backend; commit/push solo dopo gate PASS | Integrazione | Backup/hash, staging mirato di 16 file codice/test; zero credenziali rilevate. SHA commit/push verificato nella consegna finale | PASS |

Tre agenti reali: `microspot_lighting` (implementazione 3D), `finishes_ux` (wizard), `micro_finish_independent_qa` (sola revisione runtime). Un solo integratore gestisce file condivisi e Git.

## Difetti riprodotti e correzioni

- Micro-spot: colore caldo costante e disco additivo sovradimensionato nel renderer. Collegata calibrazione/dimmer LED comune, rimossi dischi, nuovo corpo incassato da 35 mm e luce corta verso zona piedi. Una luce centrale per alzata curva; due/tre sulle reali facce panca L/U. Nessuna modifica a sedute, schienali, bocchette o camere.
- Finiture: apertura non guidata, Travertino e varianti separati in elenco piatto. Introdotte famiglie con scelte esistenti, focus/scroll limitati al contenitore wizard e attivati solo da azione esplicita. Gli ID salvati restano invariati finché non viene selezionata una variante.
- Revisione indipendente: **FAIL iniziale mobile 390/430**, nomi Beige/Greige sotto il footer. Corrette solo le schede di famiglia: campione utile 44 px, etichette e target nativi conservati. Nuovo replay PASS: tutti e quattro i nomi visibili senza scroll manuale. I file `*-before-fix.jpg` e le vecchie catture `*-auto.jpg` rimangono traccia del difetto, non prova del candidato finale.
- Panca: il primo puntamento fisso da scala non raggiungeva correttamente la zona piedi. Il nuovo puntamento deriva dal pavimento effettivo (anche inclinato o non rialzato), dalle facce panca e dal relativo spazio libero. Le sole prove geometriche non bastavano: il replay mostrava ancora il pavimento buio.
- Causa effettiva nel materiale: il trasporto subacqueo usava il campo vicino dei fari principali (1,4 m), oltre la portata dei micro-spot; il cutoff della versione Three.js installata annullava il contributo. Registro esplicito delle sole sorgenti micro, uniforme stabile per singola piscina e campo vicino dedicato: nessuna classificazione per colore/portata, nessuna modifica al percorso ottico principale. Cache shader aggiornate anche per l'inox dal componente ospitante, senza modificare il relativo WIP.
- Dopo il fix funzionale, il replay ha rilevato un accento troppo forte a dimmer predefinito 60%. Ridotto soltanto il budget visivo del fascio micro da 8 a 2 cd; calibrazione RGB, curva dimmer, lenti, fari principali e ambiente invariati. Retest A/B al 60%: accento localizzato e rivestimento leggibile, non una lastra sovraesposta. La verifica mobile usa anch'essa il 60%, non il 25% usato soltanto come confronto diagnostico. Le catture intermedie `*-final*` precedono questa calibrazione e non sono la prova finale di realismo; le prove definitive hanno suffisso `*-calibrated.jpg`.
- Footer illuminazione: ora elenca anche `micro-spot panca` quando effettivamente disponibili e attivi; testo IT/EN, indipendente da scale e fari.
- Bocchette: confronto ravvicinato con fari principali ON/OFF e veri micro-spot sempre ON. I riflessi rossi sull'anello metallico scompaiono spegnendo il faro principale, mentre lenti e fasci dei micro-spot restano rossi. `HydroJet` identico byte per byte a HEAD e privo di emissività/luci/aloni. Nessun oscuramento cosmetico del metallo approvato.

## Verifiche tecniche già eseguite (non sostituiscono la QA visiva)

- `npx tsc --noEmit`: PASS dopo correzione del passaggio opzionale `undefined` nei nuovi props luce.
- `npm run build`: PASS client, SSR e Nitro sul candidato a 2 cd; avvisi preesistenti `vite-tsconfig-paths` e chunk oltre 500 kB. Nessun deploy eseguito.
- `node scripts/run-micro-spot-realism-audit.mjs`: **5.441 controlli / 224 configurazioni PASS** dopo calibrazione a 2 cd; 420 raycast sulle vere zone piedi (76 non rialzate, 172 inclinate), verifica cutoff del renderer installato, identità esplicita delle sorgenti, uniformi stabili, limite e ON/OFF, geometrie invariate, RGB/dimmer e giorno non emissivo.
- `node scripts/run-stair-lighting-audit.mjs`: 496 configurazioni / 2.140 apparecchi nelle alzate PASS; invarianti geometria/accesso/fari, snapshot/preventivo/Photo Spec/dirty state.
- `node scripts/run-hydromassage-audit.mjs`: 36.153 controlli PASS, eseguito dallo specialista sul candidato 3D.
- `node scripts/finish-guidance-audit.mjs`: **602 controlli PASS**; markup delle famiglie, quattro Gres/due Travertino, scroll delimitato, reduced-motion, 20 cicli reducer e round-trip canonico offline IT/EN. Non sono 20 cicli browser.
- `git diff --check`: PASS.

Il vecchio script WIP `bench-lighting-regression.ts` contiene hash “frozen” dei file ora modificati su esplicita richiesta. Non viene aggiornato cosmeticamente né contato PASS: le nuove verifiche coprono le modifiche autorizzate e vengono affiancate dal replay browser, non sostituite ad esso.

## Isolamento e limiti

- Controllo SHA256 del backup: **38 dei 39 file WIP identici byte per byte**. L'unico file condiviso, `PoolModel.tsx`, conserva tutte e quattro le proprietà `seamlessSteel` preesistenti; i relativi hunk non pertinenti sono esclusi dallo staging. Il WIP estraneo resta locale, non viene spacciato per collaudato o committato da questo goal.
- Nessun cambio di schema/configurazione, catalogo, camera, geometria di sedute/schienali o backend. Nessun nuovo pacchetto. Il linguaggio del corpo incassato è una rappresentazione progettuale, non un prodotto o una fotometria certificata.
- Nuovi fasci locali senza shadow map; registro limitato a 64 sorgenti, con uscita anticipata al numero reale e nessuna allocazione nel frame loop. Nessun benchmark FPS o prestazione su telefono fisico dichiarati.
- Persistenza ed export verificati tramite invarianti e round-trip offline. Non sono stati ripetuti Save/Share/PDF/preventivi cloud né inviate email: questo goal non modifica tali pipeline.

## Evidenze consultabili

- [Replay indipendente e difetti ritestati](MICRO_FINISH_INDEPENDENT_20261019.md).
- [Scala angolare e faro principale, rosso coordinato](evidence/micro-finish-20261019/desktop-corner-main-red-calibrated.jpg).
- [Scala rettilinea e faro principale, rosso coordinato](evidence/micro-finish-20261019/desktop-straight-main-red-calibrated.jpg): cinque alzate effettivamente disponibili in questa combinazione con idromassaggio, senza inventare una sesta luce.
- [Isolamento riflessi delle bocchette](evidence/micro-finish-20261019/desktop-straight-main-off-nozzle-reflection.jpg): stessi micro-spot attivi, faro principale OFF.
- [Panca A, luce blu calibrata](evidence/micro-finish-20261019/desktop-hydroA-blue-calibrated.jpg) / [panca B, rosso](evidence/micro-finish-20261019/desktop-hydroB-red-calibrated.jpg).
- [Panca mobile 390](evidence/micro-finish-20261019/mobile390-hydroA-blue-calibrated.jpg); [430 rosso](evidence/micro-finish-20261019/mobile430-hydroA-red-calibrated.jpg), [giorno](evidence/micro-finish-20261019/mobile430-hydroA-day-calibrated.jpg), [OFF](evidence/micro-finish-20261019/mobile430-hydroA-off-calibrated.jpg).
- [Gres 1440](evidence/micro-finish-20261019/desktop-gres-auto.jpg), [390](evidence/micro-finish-20261019/mobile390-gres-after.jpg), [430](evidence/micro-finish-20261019/mobile430-gres-after.jpg).
- [Travertino 1440](evidence/micro-finish-20261019/desktop-travertine-auto.jpg), [390](evidence/micro-finish-20261019/mobile390-travertine-after.jpg), [430](evidence/micro-finish-20261019/mobile430-travertine-auto.jpg).
- [Anteprima visibile dall'integratore](evidence/micro-finish-20261019/root-visible-gres.jpg): quattro tonalità aperte con focus interno, nessun cambio imposto al Travertino precedentemente selezionato.

Esito del gate mirato: **KEEP**. Tutti i requisiti di questo goal hanno evidenza; nessun PASS esteso agli audit fuori scope indicati sopra. L'eventuale camera dedicata alla panca B, molto stretta, non è stata modificata né certificata: il controllo dell'intera zona piedi usa la vista d'insieme esistente e l'orbita manuale. Nessun merge/deploy.
