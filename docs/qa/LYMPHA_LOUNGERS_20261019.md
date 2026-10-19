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
