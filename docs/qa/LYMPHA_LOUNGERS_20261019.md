# Chaise longue: sostituzione mirata — 19 ottobre 2026

Base: `48114b32001596d326639a6ac9d15855ac492b3f`, branch `feat/fullscreen-day-night-hidden-overflow`.
Backup WIP precedente: `pool-shaper-wip-backups/residual-gates-20261015-4aiYv5` (39 file). Nessuna modifica a backend, camere o altri arredi.

## Riferimenti e limiti

Le immagini sono fornite dal proprietario nella cartella “Lympha”. Il codice fotografato LT302 corrisponde a **Esse di Lyxo**, non a una nuova collezione inventata:

- [Scheda ufficiale Esse](https://lyxodesign.com/prod/esse/): 185 × 73 × 57 cm senza telaio; 185 × 73 × 77 cm con telaio.
- [Catalogo 2025](https://www.lyxodesign.com/wp-content/uploads/2025/04/Catalogo_Lyxo_2025.pdf): immersione massima 20 cm e zavorramento secondo il produttore.
- [Scheda telaio LT303](https://lyxodesign.com/wp-content/uploads/2024/10/LYXO_ESSE_LETTINO-303.pdf).

La modifica della sola spiaggetta da 22 a 20 cm è stata approvata esplicitamente dall’utente. Il modello procedurale riprende il profilo e le aperture delle fotografie con ingombri pubblicati; **non è CAD del produttore né approvazione tecnica d’installazione**. Profilo, spessori rappresentativi e cuscini non sono quote strutturali certificate.

## Requisiti / evidenze

| ID | Modifica | Verifica | Risultato |
|---|---|---|---|
| CH-01 | Scocca curva cava, apertura frontale, impugnatura passante, colore acqua; nessun telaio immerso | Browser 8×4 e raycast attraverso l’impugnatura, ingombri metrici | PASS |
| CH-02 | Stessa scocca con telaio scuro, cuscini e poggiatesta sulla pavimentazione | Browser e test ingombri/appoggio, massimo Y entro l’inquadratura riservata | PASS |
| CH-03 | Spiaggetta a 20 cm; quantità senza ridimensionare il prodotto | Audit 6×3, 8×4, 12×5, 4×8, 25×12 e compatibilità Infinity/accessi | PASS |
| CH-04 | Controlli distinti, fotografie corrette, descrizioni IT/EN | OFF esterno rimuove i quattro lettini esterni lasciando i due immersi; ON li ripristina | PASS |
| CH-05 | Identificativi salvati invariati, richieste non compatibili non cancellate | Reducer e round-trip progetto/condivisione offline, riepiloghi IT/EN | PASS |
| CH-06 | Idromassaggio e camere non modificati | Audit idromassaggio e proiezioni parametriche | PASS |

Capacità effettiva: 6×3 non compatibile con questa spiaggetta; 8×4 due; 12×5 tre. Un progetto salvato con richiesta esplicita di quattro conserva l’intento e segnala incompatibilità, senza mostrare una quantità parziale o ridurre le dimensioni dei lettini.

## Test eseguiti

- `node scripts/sun-shelf-loungers-audit.mjs`: **1.152** controlli PASS; scocca indicizzata **7.096 triangoli**, nessuna maschera alfa; foro passante verificato geometricamente; telaio e cuscini entro impronta e inviluppo riservati.
- `node scripts/sun-shelf-state-audit.mjs`: **93** controlli PASS; nessuna chiamata backend.
- `node scripts/run-parametric-comfort-audit.mjs`: **264** controlli PASS.
- `node scripts/run-parametric-comfort-audit.mjs camera`: **91.347** controlli / **222** proiezioni PASS; non sono cicli browser.
- `node scripts/run-hydromassage-audit.mjs`: **36.153** controlli PASS.
- Typecheck `npx tsc --noEmit`: PASS.
- Production build `npm run build`: PASS; restano gli avvisi esistenti sui chunk grandi e sul plugin tsconfig.
- `git diff --check`: PASS.

Browser reale integrato, viewport desktop disponibile 1111×931: selezione, modello in acqua, versione esterna, rimozione/ripristino indipendente e fotografie ispezionati direttamente. [Entrambi ON](evidence/lympha-20261019/both-on.jpg), [esterni OFF / immersi ON](evidence/lympha-20261019/deck-off-immersed-on.jpg).

L’emulazione 390×844 ha restituito una cattura con scala anomala: non è utilizzata come PASS visivo mobile. Nessuna prova su telefono fisico o benchmark GPU dichiarata. Nessun nuovo E2E cloud, PDF o preventivo live: schema, identificativi degli optional e pipeline di esportazione rimangono quelli esistenti, verificati qui soltanto tramite round-trip offline.

## Asset

Solo ritaglio, conversione sRGB e ridimensionamento dei file forniti; nessuna generazione o ricostruzione fotografica. La quarta immagine, già modificata nel file dell’utente, rappresenta la versione con telaio: non viene presentata come fotografia ufficiale non ritoccata. Originali intatti; immagini lazy da 640 px, circa 15,6 e 31,2 KB. Provenienza: caricamenti esplicitamente forniti per questo configuratore; nessuna nuova licenza di terzi presunta.

Riproduzione locale: `node scripts/prepare-lympha-photos.mjs [cartella-originali]` (macOS/sips).

| Asset | SHA256 originale | SHA256 derivato |
|---|---|---|
| immerso | `77403e33868243c2840b03a081d00c6c30fbe06e27f7e92e55c167fd1e4dc2b6` | `4cd71dbe8408bcc35896669865321370d5c71930b7a248daaff65f3eefca1943` |
| esterno | `0a57908b4a52b6e5b6f3c33fa2404b4a9b410474e1d3145aecf49e64322bb720` | `f9b94396421cee4c922795a71c7b0cd9623852e54ee8f501da9a121b4bc05ef1` |

Rendering: geometrie memoizzate e smaltite; una scocca condivisa per gli immersi, batch per materiale per gli esterni (quattro come prima), nessuna nuova libreria né lavoro per-frame. Questo è un controllo del costo strutturale, non una misura FPS prima/dopo.

## Disposizione esterna — richiesta successiva del proprietario

Base di questa correzione: `d8cd4f15c3a47bc05435152519ba8df223045724`. Solo layout esterno: misure dei prodotti, lettini immersi, piscina e materiali invariati.

- Passaggio dal bordo esterno della piscina al piede dei lettini: **1,00 m** (prima 0,50 m).
- Distanza libera fra lettini nella stessa coppia: **0,70 m**; fra le coppie **0,80 m**, con il tavolino esistente al centro.
- Pavimentazione con optional esterno ON: fascia minima **3,25 m**, derivata da passaggio + lettino 1,85 m + margine posteriore 0,40 m. Per la 12×5 resta 3,60 m. Optional OFF e prime fasi conservano le fasce precedenti.
- Stesso calcolo condiviso da pavimentazione, apertura nel prato, arredi e inviluppo delle camere. Nessun aggiornamento per-frame o cambio di schema/configurazione.
- Sono scelte di composizione dell’anteprima, non attestazioni normative o distanze d’installazione certificate.

`node scripts/deck-lounger-spacing-audit.mjs`: **584 controlli PASS**, 6×3 / 8×4 / 12×5 / 4×8, interrata/fuori terra, Skimmer e Sfioro; appoggio dell’intera impronta, gap, corridoio, margine posteriore, rimozione OFF e rispetto dell’accesso. Audit immersi ancora **1.152 PASS**; typecheck e diff-check PASS. Nessun nuovo build completo o audit generale, non necessari per questi soli parametri di disposizione.

Browser integrato: confronto diretto della medesima 8×4 con entrambi gli optional ON: [prima](evidence/lympha-20261019/both-on.jpg) / [dopo](evidence/lympha-20261019/deck-spacing-after.jpg). Confermati quattro lettini esterni separati, fascia di passaggio libera, intero arredo appoggiato sulla pavimentazione ampliata e due lettini immersi immutati. Revisione React mirata: dipendenza `loungers` aggiunta alla geometria memoizzata; disposal e cache ombre esistenti preservati.

## Bordo omogeneo, arredo finale e centratura — richiesta aggiuntiva

Base `afa1c99c450996ba79cbeca46217169764408e78`. WIP precedente (39 file) preservato nel backup locale `pool-shaper-wip-backups/residual-gates-20261015-tPsOQ5`, esclusi segreti. Intervento limitato alle richieste successive del proprietario; nessuna modifica a backend, piscina, luci, lettini immersi o preset Infinity.

| ID | Modifica / criterio | Evidenza | Esito |
|---|---|---|---|
| CH-07 | Deck Marrone rimosso dalle sole scelte bordo; ID legacy ancora valido | Picker browser e audit catalogo/retrocompatibilità; pavimentazione invariata | PASS |
| CH-08 | Ipè omogeneo, stesso legno fotografico, un elemento per lato senza fughe intermedie | [Bordo dopo](evidence/lympha-20261019/ipe-coping-after.jpg); geometria continua e quote invariate su 6×3, 8×4, 12×5; nessuna modifica allo shader di posa della pavimentazione | PASS |
| CH-09 | Chaise esterne soltanto in Presentazione, selezione conservata | [Optional ON ma arredi non ancora visibili](evidence/lympha-20261019/optional-no-deck-loungers.jpg) → [Presentazione finale 12×5](evidence/lympha-20261019/final-terrace-after.jpg); controllo distinto dagli immersi | PASS |
| CH-10 | Stesso modello senza ridimensionamenti, più spazio e pavimentazione sul lato effettivamente occupato | 0,90 m fra lettini, 1,00 m fra coppie, passaggio 1,00 m; estensione esterna +0,80 m solo sul lato delle file calcolate; audit impronte/accessi e screenshot finale | PASS |
| CH-11 | Pianta centrata durante forma/lunghezza/larghezza, senza occultamenti | Stessa 10×4,5 / viewport 1280×720: [prima](evidence/lympha-20261019/top-centering-before.jpg), centro X circa 551 px, [dopo](evidence/lympha-20261019/top-centering-after-10x45.jpg), centro X 640 px; [6×3](evidence/lympha-20261019/top-centering-after-6x3.jpg), [8×4](evidence/lympha-20261019/top-centering-after-8x4.jpg), [12×5](evidence/lympha-20261019/top-centering-after-12x5.jpg) | PASS |
| CH-12 | Fluidità in modifica dimensioni: eliminare lavoro dimostrato inutile, senza ridurre dettagli visibili | Costruzione differita delle sole lastre/fughe nascoste; array posizioni finali identici al generatore precedente; benchmark CPU sotto | PASS per il collo di bottiglia misurato |

La fascia esterna passa da 3,25 a 4,05 m sul lato occupato nelle taglie piccole e da 3,60 a 4,40 m nella 12×5; gli altri lati restano invariati. Misure compositive dell'anteprima, non distanze normative certificate. I moduli di pavimentazione vengono ritagliati, non stirati. L'Ipè mantiene fotografia e scala originali: eliminati soltanto variazione artificiale fra moduli e giunti intermedi del bordo. [Prima bordo](evidence/lympha-20261019/ipe-coping-before.jpg) è una cattura su configurazione/viewport diversi: non è un confronto numerico a parità di condizioni.

### Verifica mirata conclusiva

- `npx tsc --noEmit`: PASS.
- `node scripts/deck-lounger-spacing-audit.mjs`: **1.312 controlli PASS**, inclusi 6×3 / 8×4 / 12×5 / 4×8, disposizione, OFF, accessi, continuità bordo e proiezioni 1280/1440/390/430. Proiezioni automatizzate, non prove su telefoni fisici.
- `node scripts/run-structure-progression-audit.mjs`: **82.457 controlli PASS**, dipendenza pertinente alla comparsa degli arredi nella sola fase finale.
- `node scripts/finish-guidance-audit.mjs`: **602 controlli PASS**, stato e navigazione interessati; non sono 602 cicli browser.
- `npm run build`: PASS; avvisi esistenti tsconfig e chunk grandi non modificati.
- `git diff --check`: PASS.
- Browser integrato realmente utilizzato a 1280×720: variazioni dimensioni, ritorno alle fasi, bordo Ipè, arredi non visibili negli Optional e presenti in Presentazione; console finale senza warning/errori catturati. Preferenze esistenti conservate. Nessuna nuova verifica cloud/PDF/preventivo live dichiarata per queste modifiche puramente di presentazione.
- Revisione React mirata: geometrie e piano arredi memoizzati, array default stabile, smaltimento e invalidazione ombre preservati; nessun lavoro aggiuntivo per-frame, libreria o texture.

### Prestazioni: prova limitata e ripetibile

Tre confronti CPU dopo warm-up, medesima 12×5 e stessi moduli: **solo costruzione della pavimentazione che non è ancora visibile**.

| Materiale | Vertici nascosti prima → dopo | Mediana CPU prima → dopo | Tre tempi prima / dopo (ms) |
|---|---|---|---|
| Lastre | 3.660 → 0 | 2,335 → 0,004 ms | 2,335 / 2,587 / 2,049 → 0,004 / 0,005 / 0,003 |
| Doghe | 8.784 → 0 | 4,401 → 0,004 ms | 5,166 / 4,059 / 4,401 → 0,004 / 0,004 / 0,005 |

Nel browser, il log esistente di costruzione su dimensioni 12×5 registrava 4.704 vertici ancora nascosti e circa 3,0–5,7 ms; dopo la correzione registra 0 vertici e 0–0,2 ms. La scena finale continua a costruire integralmente lastre e fughe. Questi dati dimostrano la rimozione di lavoro CPU inutile, **non** un aumento FPS/GPU o prestazioni mobile reali: nessuna di queste misure aggiuntive viene dichiarata verificata.

## Fluidità delle modifiche — ottimizzazione successiva, stesso giorno

Base `70ec9390bba606b017a31cc22ba5c0ca8a461e1a`; backup dei 39 file WIP precedenti: `pool-shaper-wip-backups/residual-gates-20261015-rBzxz5`. Skill impiegate: vb-orchestrator, realtime-performance-profiler, threejs-performance. Un solo obiettivo: ridurre il lavoro CPU della posa visibile durante cambi forma/formato/materiale, senza alterarne il risultato.

- `pavingGridOrigin`: punteggio del candidato migliore conservato anziché ricalcolato ad ogni confronto; eliminati array temporanei `flatMap/map` per ciascuna delle 256 origini. Stessi candidati, tolleranza, ordine e gestione dei pareggi.
- Clipping: un poligono interamente dentro un semipiano conserva direttamente i suoi punti; uno interamente fuori termina subito. Le intersezioni continuano a usare esattamente l'algoritmo precedente.
- Nessun cambiamento a shader, risoluzione, riflessi, ombre, materiali, disegno dei giunti, numero di moduli, geometrie approvate, opzioni o persistenza.

`node scripts/paving-performance-audit.mjs docs/qa/evidence/lympha-20261019/paving-performance.json`: **672 controlli PASS**; 54 casi, rettangolare/L/organica, 6×3 / 8×4 / 12×5 e sei moduli di lastre/doghe. Confronto con il sorgente effettivo del commit base: posizioni, normali, UV, colori, indici e metadata **identici byte per byte**. Include 294 confronti di origini, corsi sfalsati e superficie vuota. Nessuna perdita di dettagli o quantità selezionate.

Tre confronti alternati, dopo warm-up, sette generazioni per campione. Mediane CPU delle tre coppie sulla stessa 12×5:

| Forma/materiale | Prima → dopo | Riduzione CPU |
|---|---|---|
| Rettangolare/lastre | 3,799 → 3,403 ms | 10% |
| Rettangolare/doghe | 8,689 → 7,820 ms | 10% |
| Organica/lastre | 29,616 → 14,305 ms | 52% |
| Organica/doghe | 51,215 → 31,537 ms | 38% |

Tempi completi e limiti nel [risultato JSON](evidence/lympha-20261019/paving-performance.json). È un confronto di generazione geometrica CPU, non FPS/GPU o latenza end-to-end; nessuna promessa di incremento universale FPS. Il log della scena IAB prima dell'intervento rilevava Apple M1 Pro/ANGLE Metal, viewport 831×931, DPR 1,819, circa 30,4–30,5 FPS, mediana 33 ms: questi dati non sono usati come benchmark prima/dopo, perché non è stato isolato il carico GPU delle altre schede.

Browser integrato: cambio reale 60×120 → 30×60 cm, poi WPC; posa e finiture si aggiornano, bordo Ipè distinto e invariato. [Screenshot WPC dopo](evidence/lympha-20261019/paving-speed-wpc.jpg). Log della generazione WPC visibile 12×5: 11.388 vertici, circa 5,1–5,4 ms; non un confronto temporale normalizzato con il precedente Node. [Ritorno in Presentazione](evidence/lympha-20261019/paving-speed-presentation.jpg) verificato, arredi presenti e pannello utilizzabile. Nella sessione dopo HMR/riapertura sono comparsi avvisi Three.Clock deprecato e texture senza image data: nessuna modifica a texture o gestione risorse in questo commit; non sono dichiarati risolti né usati come evidenza PASS.

Typecheck PASS; audit dipendente disposizione/pavimentazione **1.312 PASS**; diff-check PASS. Nessun nuovo build completo richiesto per questa sola modifica algoritmica locale: riutilizzato il build precedente come evidenza storica, non descritto come un nuovo build del candidato. WIP non pertinente preservato integralmente.
