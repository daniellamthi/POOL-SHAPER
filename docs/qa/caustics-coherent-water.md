# Caustiche coerenti — confronto controllato, 26 settembre 2026

Branch `feat/premium-infinity-waterline-v1`, HEAD `a9846c3`, WIP precedente preservato. Preview: http://127.0.0.1:49872/. Nessun commit, push o deploy.

## Diagnosi e validità del controllo

La media **0,13453465** è la media del canale rosso normalizzato della texture procedurale 512²: non è la luminanza finale dell'immagine. **0,75** è il moltiplicatore adimensionale `causticVisibility` applicato alla forza del liner; non significa 75% di luminosità della piscina.

La verifica mirata della storia ha individuato i limiti in `db1f3c0`, passaggio estetico per caustiche appena percepibili. Il limite texture **0,08** controllava un campo sparso, mentre **0,1** limitava un preset allora associato a un'equazione diversa e a un cap 0,007. Il WIP approvato usa una rimappatura non lineare e cap 0,035. Limitare solo il preset non controlla più l'energia aggiunta: con lo stesso preset, un diverso shader può produrre un effetto completamente diverso. Nessuno di questi numeri è un limite fisico universale.

Il confronto ON/OFF, lasciando invariati luce, materiale e acqua, ha mostrato un velo caustico diffuso che copriva parte della grana Sand. Il campionamento numerico dell'equazione corrente confermava un'occupazione luminosa troppo estesa: **44,54%** dei campioni oltre metà del massimo locale. Il difetto era quindi reale, non soltanto un test obsoleto.

Il limite texture 0,08 e quello di morbidezza 30 sono rimasti invariati. Solo l'asserzione sul preset è stata sostituita con verifica dell'equazione effettiva: media non nulla ma contenuta, picco leggibile e limitato, copertura spaziale, continuità temporale e ricevitori sommersi. I nuovi budget sono guardie estetiche del progetto, non misure radiometriche. Il precedente WIP non soddisfa le nuove guardie di distribuzione; non sono state allargate le vecchie soglie. La storia dettagliata resta in [caustics-open-failure.md](./caustics-open-failure.md).

## Modifica conservata

- Concentrazione del campo vicino alle linee cellulari: decadimento `exp(-gap * 22)` anziché 10, mantenendo risoluzione, filtro morbido, seme e scala.
- Ricezione: `smoothstep(0.08, 0.24, value)` anziché `(0.025, 0.22, value)` per rimuovere il contributo diffuso di fondo.
- Preset **0,75**, guadagno, cap, velocità, profondità, acqua, riflessi, materiali Sand, luci ed esposizione invariati. Chiavi cache dei tre shader aggiornate.
- Applicazione soltanto a pareti, fondo e gradini interni, con maschera alla quota acqua già esistente; niente nuovo ricevitore sul decking o sulle superfici esterne.

La grana è meno velata e le concentrazioni restano visibili, soprattutto sulla parete. Sul Grey la differenza è più contenuta. Il confronto generale non dimostra un salto al fotorealismo: è una correzione locale di distribuzione, non una nuova resa globale.

## Prove visive reali

Confronti a **12 s dello stesso orologio** per acqua e caustiche; stessa camera dedicata, esposizione, illuminazione diurna, LED blu `#0011FF` al 23%, Infinity lato 2, 10×4,5×1,5 m, bordo Travertino, guide spente. Anche la vista generale e quella mobile usano lo stesso istante. Lo scroll del pannello può differire di pochi pixel; la composizione 3D confrontata resta uguale. Il congelamento e l'override OFF erano temporanei e sono stati rimossi prima dei controlli finali e della verifica del movimento.

| Scena | Prima | Dopo / controllo |
| --- | --- | --- |
| Sand, parete/fondo | [Prima](/private/tmp/caustics-sand-before-t12.png) | [Dopo](/private/tmp/caustics-sand-after-t12.png) · [Caustiche OFF](/private/tmp/caustics-sand-off-t12.png) |
| Grey, stessa camera | [Prima](/private/tmp/caustics-grey-before-t12.png) | [Dopo](/private/tmp/caustics-grey-after-t12.png) |
| Vista generale | [Prima](/private/tmp/caustics-general-before-t12.png) | [Dopo](/private/tmp/caustics-general-after-t12.png) |
| Mobile emulato 390×844 | [Prima](/private/tmp/caustics-mobile-before-t12.png) | [Dopo](/private/tmp/caustics-mobile-after-t12.png) |

### Sand — prima

![Sand prima, tempo 12 s](/private/tmp/caustics-sand-before-t12.png)

### Sand — dopo

![Sand dopo, tempo 12 s](/private/tmp/caustics-sand-after-t12.png)

### Validazione interattiva successiva, animazione normale

[Orbita/zoom desktop](/private/tmp/caustics-motion-desktop.png) · [Orbita/zoom mobile](/private/tmp/caustics-mobile-motion.png) · [Sand 8×3 m](/private/tmp/caustics-sand-8x3.png) · [Gradini interni 8×3 m](/private/tmp/caustics-stairs-8x3.png).

Interazioni reali nella preview, non solo compilazione. Verificate parete/fondo, vista generale, orbita, zoom, seconda dimensione e scala interna angolare. Nessuna nuova copia visibile di geometria durante queste interazioni; nessuna proiezione caustica osservata sul decking. Il movimento mantiene variazioni morbide nei campioni osservati, senza salti evidenti. Screenshot e osservazione interattiva non equivalgono a un'analisi video ad alta frequenza. Mobile significa **viewport emulata**, non telefono reale; nessun benchmark hardware mobile. A fine controllo ripristinati 10×4,5 m, Sand e inox, desktop e animazione normale; preview lasciata su Stile.

## Risultati numerici e limiti del modello

Texture: media **0,06547890**, gradiente massimo avvolto sui due assi **20**. Copertura oltre metà massimo: **12,94%**. Per Sand, moltiplicatore medio aggiunto alla sola luce diffusa diretta **0,10138 → 0,03069**; picco testato **0,26081**, conservato.

Il test campiona bilinearmente due dimensioni (10×4,5 e 8×3), due profondità (0,4 e 1,5 m), tre istanti (0/12/60 s), sei liner, con incremento temporale equivalente a 60 Hz. Il modello CPU replica la proiezione del fondo; verifica il codice di mascheratura e l'aggancio degli altri ricevitori, ma non sostituisce una prova GPU di ogni normale/occlusione/angolo. I valori misurano il moltiplicatore shader prima della risposta completa della scena, non la luminanza dei pixel.

| Liner | Media aggiunta | Picco | Massima variazione in 1/60 s |
| --- | ---: | ---: | ---: |
| Deep Sea | 0,03580 | 0,30428 | 0,00763 |
| Blue Sky | 0,01918 | 0,16300 | 0,00409 |
| Arctic White | 0,02148 | 0,18257 | 0,00458 |
| Sand Beach | 0,03069 | 0,26081 | 0,00654 |
| Grey Rock | 0,01688 | 0,14344 | 0,00360 |
| Black Stone | 0,02455 | 0,20865 | 0,00523 |

## Prestazioni comparabili

Stesso dispositivo/tab, stessa camera Sand 10×4,5×1,5, canvas 540×827, DPR 2, profilo experience, shadow map 4096, scena diurna, acqua/caustiche a t=12. Nessuna build concorrente durante le finestre. Ogni blocco comprende sette aggregati da circa 2 secondi del monitor esistente. Misura **intervallo RAF**, non tempo GPU né latenza input.

| Blocco cronologico | Campioni ms/frame | Media ± deviazione standard | Intervallo |
| --- | --- | ---: | ---: |
| Baseline iniziale | 14,02; 13,82; 13,61; 13,78; 14,15; 13,85; 14,18 | 13,92 ± 0,19 | 13,61–14,18 |
| Dopo, primo blocco | 14,53; 14,33; 14,54; 15,06; 14,58; 14,65; 15,04 | 14,68 ± 0,25 | 14,33–15,06 |
| Dopo, ripetizione | 14,53; 14,81; 14,57; 14,91; 14,35; 14,63; 14,82 | 14,66 ± 0,18 | 14,35–14,91 |
| Baseline ripristinata temporaneamente | 14,80; 14,77; 14,49; 14,52; 14,48; 14,47; 14,50 | 14,58 ± 0,13 | 14,47–14,80 |
| Dopo finale adiacente | 14,54; 14,48; 14,57; 14,55; 14,51; 14,24; 14,84 | 14,53 ± 0,16 | 14,24–14,84 |

L'aumento iniziale di circa 0,76 ms non è isolabile dalla deriva della sessione: anche il successivo baseline sale a 14,58. La coppia adiacente **14,58 → 14,53** è entro il rumore e **non dimostra un miglioramento prestazionale**. Nessun nuovo pass, texture ad alta risoluzione o campionamento per pixel aggiunto. Dopo il confronto A/B, valori finali ripristinati e pagina ricaricata prima della verifica animata, eliminando cache HMR dubbie.

## Controlli e file di questa sessione

- TypeScript `tsc --noEmit`: PASS.
- `scripts/caustics-audit.ts` (bundle Rolldown + esecuzione Node): PASS, sei liner e contratti di ricezione/movimento; usato anche `--measure` per documentare il baseline senza mascherare il FAIL.
- `scripts/liner-material-audit.ts`: PASS, sei liner e quattro contratti materiali.
- `node scripts/water-transmission-audit.mjs`: PASS, 13 contratti anti-copie/acqua.
- Build Vite client/SSR/Nitro: PASS. Avvisi già presenti su chunk, tsconfig e inlineDynamicImports; nessun deploy.
- `git diff --check`: PASS. Console browser finale: nessun errore rilevato.
- Non rieseguito l'audit geometrico generale: non si dichiara un PASS dell'intera matrice estranea all'intervento.

File applicativi modificati: `src/components/pool/three/textures.ts`, `src/components/pool/three/PoolModel.tsx`.
Controlli/documentazione: `scripts/caustics-audit.ts` (nuovo), `scripts/geometry-audit.ts`, `docs/qa/caustics-open-failure.md`, questo report. `WaterSurfaceMaterial.tsx` è stato toccato solo temporaneamente per le catture e riportato al WIP d'ingresso; il suo dirty status precedente resta intenzionale.

Skill caricate e applicate: [VB Orchestrator](/Users/danielelamthi/.codex/skills/vb-orchestrator/SKILL.md) per limitare lo scope, [realtime-water-rendering](/Users/danielelamthi/.codex/skills/realtime-water-rendering/SKILL.md), [realtime-pbr-photorealism](/Users/danielelamthi/.codex/skills/realtime-pbr-photorealism/SKILL.md) e [threejs-shaders](/Users/danielelamthi/.codex/skills/threejs-shaders/SKILL.md) per confinare la correzione ai ricevitori, [realtime-performance-profiler](/Users/danielelamthi/.codex/skills/realtime-performance-profiler/SKILL.md) per il confronto ripetuto e la variabilità. Nessun subagente, nuova dipendenza o audit generale.

Limiti aperti: caustiche ancora approssimazione raster procedurale, non soluzione fisica dei raggi rifratti; resa complessiva ancora CG. Leggibilità della lama Infinity invariata e aperta, senza nuovi tentativi. Non certificata assenza di scintillii su tutti i dispositivi; nessuna misura GPU/telefono reale. WIP e miglioramento Sand conservati.
