# Terreno PBR Infinity — DISCARD

26 settembre 2026. Branch `feat/premium-infinity-waterline-v1`, WIP preservato.
Preview: http://127.0.0.1:49872/. Nessun commit, push o deploy.

## Provenienza e intervento

Un solo materiale: **Brown Mud Dry**, Rob Tuytel / Poly Haven,
[asset](https://polyhaven.com/a/brown_mud_dry), [licenza CC0](https://polyhaven.com/license).
Tre JPG originali 1024×1024, 2.849.933 byte complessivi, modulo dichiarato 1,3 m.
Diffuse sRGB, normal OpenGL e roughness non-color. Download, HTTP locale e checksum
verificati contro il provider:

| Mappa | MD5 |
| --- | --- |
| color.jpg | 0c0ad82fec60f091690c69c23657cb74 |
| normal.jpg | a842517bea5187ccbceb69fd26629d1e |
| roughness.jpg | 4e047a601af768eded6468faab4ec615 |

Sostituzione temporanea del solo materiale terreno Infinity: normal strength 0,35,
metalness 0, coordinate metriche comuni. Due campioni traslati e miscelati per
ridurre la ripetizione; derivate UV esplicite per mipmapping coerente.
Nessun displacement, nuova mesh o passaggio di rendering. Pendenza, illuminazione,
acqua, camere, Sand, caustiche e geometrie non modificati.

VB Orchestrator ha mantenuto l'ambito circoscritto; PBR/scan calibration hanno
guidato scala, spazi colore e coerenza delle mappe. Visual reference matching e
performance profiler hanno imposto confronto reale e scarto, non approvazione
basata sui soli controlli tecnici.

## Risultato visivo e decisione

Zolle e microvariazioni vicino al decking sono più credibili del tappeto verde.
In distanza e nel viewport mobile resta però una grande campitura marrone uniforme.
Il vantaggio locale non giustifica il costo misurato. **DISCARD**.
Nessun rilievo geometrico aggiunto; restano invariati anche i limiti preesistenti
del raccordo alle estremità. Nessun nuovo esperimento sulla lama Infinity.

## Performance comparabile

A/B contemporaneo: 10×4,5×1,5 m, Deep Sea, giorno, Infinity lato 3, camera ferma
dopo zoom, stessa luce/esposizione, canvas 540×827, DPR 2, experience, shadow 4096.
Sette finestre successive di circa due secondi dopo assestamento; nessun build
durante la misura. Tempi RAF, non GPU timer.
DPR 2 forzato temporaneamente per compensare DPR 1 del viewport emulato, poi
ripristinata la politica originale. La superficie dell'acqua non è stata congelata:
il terreno confrontato è statico, le immagini non sono un water-pattern match.

| Versione | ms/frame: media ± deviazione standard campionaria | Intervallo |
| --- | --- | --- |
| Originale, baseline rifatta | **9,27 ± 0,04** | 9,21–9,32 |
| Campione, anisotropia 8 | **32,89 ± 0,11** | 32,73–33,07 |
| Campione, anisotropia 2 | **32,92 ± 0,14** | 32,71–33,11 |

Baseline: 9.21, 9.31, 9.23, 9.26, 9.30, 9.27, 9.32.
Campione: 32.86, 33.07, 32.73, 32.84, 32.85, 32.90, 32.96.
Filtraggio 2: 32.97, 32.87, 32.85, 32.71, 32.85, 33.06, 33.11.
Regressione circa +23,6 ms/frame, molto superiore alla variabilità.
L'unica riduzione del filtraggio non l'ha risolta; non è stato identificato con
GPU profiling lo specifico collo di bottiglia, quindi non se ne inventa la causa.
La baseline storica 9,71±0,09 non dimostra un miglioramento attuale: render settings
riprodotti, ma posa numerica storica e carico non disponibili. Valida la coppia
contemporanea A/B. Geometrie 68→68; texture residenti 31→34 durante HMR/cache.
I draw call del logger alternano main/reflection pass, non sono un totale frame.

## Verifiche e immagini

Desktop: generale, raccordo, orbita/zoom; 10×4,5 e 8×3, lati 3 e 1 (non matrice
completa di tutte le combinazioni). Mobile **emulato 390×844**, orbita/zoom,
nessun telefono reale. Asset caricati; nessun errore console rilevato.
Prima/dopo: camera, configurazione e luce uguali. **Il dopo è il tentativo scartato,
non la versione consegnata.**

![Prima](/private/tmp/terrain-pbr-before.png)
![Campione scartato](/private/tmp/terrain-pbr-after.png)
![Raccordo e orbita](/private/tmp/terrain-pbr-contact.png)
![8×3, lato 1](/private/tmp/terrain-pbr-8x3-side1.png)
![Mobile emulato](/private/tmp/terrain-pbr-mobile.png)
![Preview ripristinata](/private/tmp/terrain-pbr-restored.png)

Audit temporaneo delle mappe/hash/dimensioni e sampling: PASS.
Dopo lo scarto: TypeScript, 13 contratti water/shadow, audit caustiche sei liner,
build client/SSR/Nitro e diff-check: PASS; avvisi di build preesistenti.
Viewport naturale e DPR adattivo ripristinati, configurazione riportata a
10×4,5×1,5, White, Infinity lato 2. Preview operativa.

## File e seguito necessario

Rimossi soltanto componente InfinityGroundMaterial, integrazione in PoolScene,
audit e asset di questo tentativo. PoolScene restituito al WIP d'ingresso.
Le tre mappe sono recuperabili fuori dal progetto in
`/private/tmp/pool-terrain-pbr-discarded/`, non cancellate.
Nel progetto resta soltanto questo nuovo report della sessione.

Lavorazione mancante: **atlante terreno art-directed con macrovariazione baked**,
coerente tra fascia decking e pendio distante, con normal/roughness allineate,
da provare inizialmente con un singolo campionamento per mappa.
Non implementato qui, né garanzia di prestazioni. La leggibilità della lama
Infinity resta un limite separato aperto.
