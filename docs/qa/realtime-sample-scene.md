# Scena campione realtime — 25 settembre 2026

Branch `feat/premium-infinity-waterline-v1`, WIP preservato; nessun commit, push o deploy.
Preview: http://127.0.0.1:49872/.
VB Orchestrator, realtime PBR, water rendering, architectural lighting, GLSL e visual-reference matching caricati; nessuna installazione o delega.

## Campione e confronto

Rettangolare 10 × 4,50 × 1,20 m, fondo piano, Infinity lato 3,
Motion Arctic White, Limestone Ivory, scala interna rettilinea, LED spenti, tema chiaro.
Desktop 1126 × 934, canvas 628 × 827, DPR 2, preset experience, guide nascoste.
Camera generale: ingresso in Acqua, cinque eventi zoom-in; vista bassa: drag
(785,210) → (785,160). Dettaglio: ingresso in Stile. Stessi controlli e dimensioni
prima/dopo; animazione dell'acqua non sincronizzata al medesimo istante.

| Vista | Prima | Dopo |
| --- | --- | --- |
| Generale | [PNG](/private/tmp/sample-before-general.png) | [PNG](/private/tmp/sample-after-general.png) |
| Bassa Infinity | [PNG](/private/tmp/sample-before-low.png) | [PNG](/private/tmp/sample-after-low.png) |
| Parete/fondo | [PNG](/private/tmp/sample-before-liner.png) | [PNG](/private/tmp/sample-after-liner.png) |

## Tre differenze affrontate

1. Acqua quasi priva di dettaglio: campo caustico filtrato meno distruttivamente,
   range recuperato e contributo limitato alla luce diffusa diretta, attenuato con la profondità.
   Normali lievemente più leggibili; prova con ampiezza maggiore scartata per striature su 8 × 3.
2. Decking ripetitivo: il deck Infinity, chiamato limestone, utilizzava mappe travertino.
   Ora riusa le mappe limestone esistenti; posa e geometria invariate, roughness 0,72.
3. Illuminazione/riflessi da fonti diverse: Infinity diurno riusa la stessa mappa sky-only
   per IBL, cielo visibile e riflesso planare. Studio e notte mantengono la precedente sorgente.

Asset riutilizzato: [Qwantani Noon Pure Sky, Poly Haven, CC0](https://polyhaven.com/a/qwantani_noon_puresky),
già presente in `public/hdri`, nessun download. AgX/esposizione/luci e geometrie non modificati.
Nessun nuovo render pass, texture procedurali della stessa risoluzione e stesso numero di campionamenti.

## Protezioni e QA effettiva

- Rifrazione raster non dislocata preservata: evita di ricampionare bordi e corrimano emersi;
  è una semplificazione, non una rifrazione volumetrica completa. Assorbimento, Fresnel e riflessi restano.
- Orbita/zoom desktop, mobile 390 × 844 anche espanso, scala interna e inox:
  nessuna copia fantasma osservata nelle viste controllate.
- [Mobile Infinity](/private/tmp/sample-mobile-orbit.png), [mobile inox](/private/tmp/sample-mobile-inox.png).
- [Skimmer](/private/tmp/sample-skimmer.png), [sfioro nascosto](/private/tmp/sample-hidden-overflow.png),
  [sfioro a vista](/private/tmp/sample-visible-overflow.png): controllo visivo rapido, nessun recupero storico.
- Provata seconda dimensione 8 × 3 × 1,20; ripristinato il campione 10 × 4,50.
- Un artefatto transitorio sul deck durante l'espansione mobile è scomparso dopo orbita;
  non dichiarato risolto né attribuito con certezza a questa modifica.
- Video non prodotto: la superficie browser disponibile non espone registrazione video.

## Prestazioni

MacBook Pro Apple M1 Pro 10 core, 16 GB; browser integrato Codex, stessa viewport/DPR/preset.
Contatore DEV esistente: media del delta R3F su finestre di circa 2 secondi, scena ferma;
non è un timer GPU e non misura input latency. Nessun profiler hardware/VRAM disponibile.

Baseline: 72,7 / 74,1 / 74,8 FPS, 13,76 / 13,50 / 13,38 ms.
Dopo: 64,6 / 63,7 / 64,5 FPS, 15,49 / 15,70 / 15,50 ms.
Media circa 13,55 → 15,56 ms (+15%): NON un miglioramento prestazionale;
variazioni di carico e sequenza QA non isolate sperimentalmente.
Texture 22 prima e dopo ricaricamento; 37 dopo attraversamento delle tipologie/materiali.
Nessuna prova di stabilità a lungo termine. `calls=7` è l'ultimo passaggio di riflessione,
non il totale frame: non presentato come misura completa delle draw call.

## File di questa passata

- `src/components/pool/three/DaylightEnvironment.tsx`
- `src/components/pool/three/PoolScene.tsx`
- `src/components/pool/three/PoolModel.tsx`
- `src/components/pool/three/textures.ts`
- `src/configurator/materials/visual-presets.ts`
- questo report. Tutte le altre modifiche preesistenti sono WIP conservato.

Typecheck, 8 contratti shader anti-duplicazione, build client/SSR e diff-check eseguiti.
La verifica estetica è separata dai test: miglioramento visibile di pietra e caustiche,
ma qualità fotografica NON raggiunta. Lama Infinity poco leggibile, contesto ancora CG,
prestazioni da consolidare. Prossimo intervento utile: misurare e correggere il contributo
riflesso della superficie/film, senza ripristinare il campionamento di geometria emersa.
