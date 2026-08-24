# POOL SHAPER — prompt completo per Lovable

> Incolla questo documento in Lovable come specifica principale. Ricrea il progetto descritto senza semplificare flussi, stato, geometria, rendering o design. Non sostituire il configuratore 3D con immagini statiche. Non aggiungere funzionalità non richieste.

## 1. Obiettivo vincolante

Costruisci **POOL SHAPER / Piscine Wellness**, un configuratore premium per piscine residenziali con due percorsi indipendenti:

1. **New Pool**, configurazione completa di una nuova piscina in 9 step.
2. **Pool Renovation**, consulenza guidata per ristrutturare una piscina esistente in 6 step.

L'app deve conservare un'interfaccia scura, minimale e architettonica, con pannello wizard a sinistra e viewport 3D sempre visibile a destra. Il modello deve aggiornarsi in tempo reale per forma, dimensioni, sistema piscina, finitura e colore. Gli accessori sono esclusivamente opzioni commerciali e non devono modificare la scena 3D.

Vincoli assoluti:

- niente Freeform Pool: le sole forme sono **Rectangle** e **Custom Shape**;
- niente infinity edge: i sistemi sono **Skimmer Pool** e **Overflow Edge Pool**, dove overflow indica sfioro perimetrale residenziale;
- nessun paesaggio, giardino, arredo, pavimentazione esterna o oggetto decorativo configurabile;
- non renderizzare accessori in 3D;
- non usare servizi remoti indispensabili al rendering;
- ogni input numerico deve essere validato e limitato prima di generare geometria;
- il modello non deve mai scomparire, deformarsi in modo invalido o produrre NaN;
- mantenere la stessa camera per il confronto Skimmer/Overflow e la stessa camera per il confronto Liner/Mosaic;
- dark mode iniziale, light mode disponibile e persistente.

## 2. Stack e configurazione

Usa questo stack, mantenendo TypeScript in modalità strict:

- React 19.2 e React DOM 19.2;
- TypeScript 5.8;
- Vite 8;
- TanStack Start, TanStack Router e TanStack Query;
- Tailwind CSS 4 con plugin Vite;
- Three.js 0.185;
- `@react-three/fiber` 9.7;
- `@react-three/drei` 10.7;
- Lucide React per le icone;
- componenti accessibili Radix UI / shadcn;
- `clsx`, `tailwind-merge` e `class-variance-authority`;
- React Hook Form e Zod disponibili per moduli e validazione;
- ESLint 9 e Prettier 3.

Alias obbligatorio: `@/*` punta a `./src/*`.

Script richiesti:

```json
{
  "dev": "vite dev",
  "build": "vite build",
  "build:dev": "vite build --mode development",
  "preview": "vite preview",
  "test:geometry": "node scripts/run-geometry-audit.mjs",
  "lint": "eslint .",
  "format": "prettier --write ."
}
```

Se il template Lovable disponibile usa React Router anziché TanStack Router, è ammesso adattare esclusivamente il bootstrap e il routing, ma non la struttura funzionale, lo stato, i flussi o i moduli del configuratore.

## 3. Architettura e struttura delle cartelle

Ricrea questa separazione. I file `.gitkeep` indicano spazi di estensione intenzionali per la versione vendibile del framework.

```text
public/
  favicon.png
  robots.txt
  textures/pool/
    pvc-liner-base.png
    mosaic-base.png

src/
  app/.gitkeep
  assets/
  components/
    animations/.gitkeep
    layout/.gitkeep
    sections/.gitkeep
    ui/                         # primitive shadcn/Radix riutilizzabili
    pool/
      BrandLogo.tsx
      DimensionControl.tsx
      FileDrop.tsx
      LiveSummary.tsx
      MetricsPanel.tsx
      PoolConfigurator.tsx
      PoolViewport.tsx
      ProjectSummary.tsx
      ShapeEditor.tsx
      StepIndicator.tsx
      StepSection.tsx
      TextField.tsx
      ThemeToggle.tsx
      steps/
        ProjectTypeStep.tsx
        ShapeStep.tsx
        DimensionsStep.tsx
        SystemStep.tsx
        CustomerStep.tsx
      three/
        PoolScene.tsx
        PoolModel.tsx
        PoolMeasurements.tsx
        Skimmers.tsx
        poolGeometry.ts
        textures.ts
  configurator/
    steps/
      project-type/ProjectTypeStep.tsx
      pool-shape/PoolShapeStep.tsx
      pool-dimensions/PoolDimensionsStep.tsx
      pool-system/PoolSystemStep.tsx
      interior-finish/InteriorFinishStep.tsx
      interior-color/InteriorColorStep.tsx
      accessories/AccessoriesStep.tsx
      contact-details/ContactDetailsStep.tsx
      final-review/FinalReviewStep.tsx
      renovation/RenovationSteps.tsx
    3d/
      components/.gitkeep
      geometry/.gitkeep
      scene/visual-preset.ts
    forms/.gitkeep
    calculations/.gitkeep
    materials/
      interior-textures.ts
      visual-presets.ts
    services/.gitkeep
    hooks/.gitkeep
    store/.gitkeep
    types/.gitkeep
    utils/.gitkeep
    constants/.gitkeep
    data/.gitkeep
    config/
      design-tokens.ts
      product.ts
    assets/
      icons/piscine-wellness-logo.png
      models/.gitkeep
      textures/.gitkeep
  hooks/use-mobile.tsx
  lib/
    pool/
      config.ts
      context.ts
      engineering.ts
      format.ts
      geometry.ts
      materials.ts
      store.tsx
      types.ts
      validation.ts
    theme.tsx
    utils.ts
    error-capture.ts
    error-page.ts
    lovable-error-reporting.ts
  routes/
    __root.tsx
    index.tsx
  services/.gitkeep
  store/.gitkeep
  styles/.gitkeep
  types/three-fiber.d.ts
  utils/.gitkeep
  router.tsx
  server.ts
  start.ts
  styles.css
```

Responsabilità dei confini:

- `components/pool`: composizione visuale e componenti specifici del prodotto;
- `components/pool/three`: adattatori React Three Fiber e mesh, senza business logic del wizard;
- `configurator/steps`: implementazioni modulari degli step esportate tramite `index.ts`;
- `lib/pool`: dominio puro, tipi, reducer, geometria, metriche, validazione e ingegneria;
- `configurator/config`: branding e design token sostituibili centralmente;
- `configurator/materials`: registro texture e preset PBR;
- `components/ui`: sole primitive generiche accessibili;
- `routes`: shell applicativa, error boundary e pagina configuratore.

Non duplicare calcoli o liste di opzioni nei componenti. Tutte le definizioni sono centralizzate in `lib/pool/config.ts`.

## 4. Tipi TypeScript del dominio

Implementa esattamente questi concetti:

```ts
type ProjectType = "new" | "renovation";
type PoolShapeId = "rectangle" | "custom";
type CustomMode = "draw" | "upload";
type SystemType = "skimmer" | "overflow";
type FinishMaterial = "liner" | "mosaic";
type LinerColor = "white" | "sand" | "lightGrey" | "darkGrey" | "blue" | "green";

type AccessoryId =
  | "automaticCover" | "heatPump" | "saltElectrolysis" | "automaticDosing"
  | "ledLighting" | "perimeterLed" | "waterfall" | "hydromassage"
  | "counterCurrent" | "poolRobot" | "smartControl" | "solarShower";

type RenovationArea =
  | "interiorFinish" | "filtration" | "coping" | "structure"
  | "equipment" | "complete";
type FiltrationWork = "pump" | "filter" | "skimmers" | "overflow";
type StructureIssue = "leakage" | "crack" | "waterproofing" | "generalRepair";
type EquipmentUpgrade = "salt" | "dosing" | "heatPump" | "automation";

interface Dimensions {
  length: number;
  width: number;
  depth: number;
  cornerRadius: number;
}

type ControlPoint = readonly [number, number];
type Outline = ReadonlyArray<readonly [number, number]>;

interface CustomerInfo {
  name: string;
  surname: string;
  company: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  notes: string;
}

interface RenovationConfig {
  areas: ReadonlyArray<RenovationArea>;
  currentFinish: FinishMaterial;
  filtrationWorks: ReadonlyArray<FiltrationWork>;
  replaceCoping: boolean | null;
  copingMaterial: string;
  structureIssues: ReadonlyArray<StructureIssue>;
  equipmentUpgrades: ReadonlyArray<EquipmentUpgrade>;
}

interface PoolConfig {
  projectType: ProjectType | null;
  shape: PoolShapeId;
  customMode: CustomMode;
  controlPoints: ReadonlyArray<ControlPoint>;
  dimensions: Dimensions;
  system: SystemType;
  finish: FinishMaterial;
  linerColor: LinerColor;
  accessories: ReadonlyArray<AccessoryId>;
  customer: CustomerInfo;
  uploads: ReadonlyArray<UploadedFile>;
}

interface PoolMetrics {
  waterVolume: number;
  waterSurface: number;
  floorSurface: number;
  wallSurface: number;
  internalSurface: number;
  perimeter: number;
}
```

`UploadedFile` contiene `id`, `name`, `size`, `type`, `url: string | null` e `category: "reference" | "site"`. Revocare sempre gli object URL alla rimozione e al reset.

## 5. Stato globale e navigazione

Usa `ConfiguratorProvider` con `useReducer`, Context tipizzato e valori derivati memoizzati. Lo stato è:

```ts
interface State {
  config: PoolConfig;
  renovation: RenovationConfig;
  step: number;
}
```

Valori iniziali:

- step `0`;
- project type `null`;
- shape `rectangle`;
- custom mode `draw`;
- dimensioni `10 × 4.5 × 1.5 m`;
- corner radius `0.25` mantenuto nel tipo per compatibilità, ma non esposto come forma separata;
- system `skimmer`;
- finish `liner`;
- color `lightGrey`;
- accessori e upload vuoti;
- campi cliente vuoti;
- configurazione renovation con array vuoti, `currentFinish: liner`, `replaceCoping: null`.

Azioni del reducer:

- set project type, shape, custom mode, singolo control point, dimensione, system, finish, color e customer field;
- reset control points;
- toggle accessory senza duplicati;
- merge parziale della renovation config;
- add/remove upload;
- goToStep, next, previous e reset.

Regole fondamentali:

- ogni dimensione non finita viene ignorata;
- ogni dimensione viene clampata ai limiti prima di entrare nello stato;
- `goToStep` e `next` usano la lunghezza del flusso attivo;
- un utente può tornare indietro, ma non saltare a step futuri non completati;
- la selezione del project type determina immediatamente il workflow senza mescolare i dati;
- `outline`, `metrics` e `skimmers` sono calcolati con `useMemo`;
- le callback pubbliche sono stabili e il valore Context è memoizzato;
- nessuna chiamata `setState` deve avvenire durante il render.

Limiti dimensioni:

| Campo | Min | Max | Step |
|---|---:|---:|---:|
| Length | 3 m | 25 m | 0.1 m |
| Width | 2 m | 12 m | 0.1 m |
| Depth | 0.8 m | 3.5 m | 0.05 m |

## 6. Flusso New Pool

Implementa 9 step, nello stesso ordine.

### Step 0 — Project Type

Due card: **New Pool** e **Pool Renovation**. La scelta è obbligatoria. Card con titolo, descrizione, stato selezionato e check discreto. Questo è l'unico step condiviso.

### Step 1 — Pool Shape

Mostra esclusivamente:

- **Rectangle**: geometria rettangolare architettonica;
- **Custom Shape**: editor a control point oppure upload di una planimetria di riferimento.

Non creare né citare Freeform. In modalità draw mostra `ShapeEditor`; in modalità upload mostra `FileDrop`. L'upload è un riferimento e non deve fingere di estrarre automaticamente una geometria.

Default custom control points normalizzati, in ordine:

```ts
[
  [-0.5, -0.36], [-0.16, -0.5], [0.22, -0.5], [0.5, -0.3],
  [0.5, 0.32], [0.18, 0.5], [-0.2, 0.5], [-0.5, 0.34]
]
```

### Step 2 — Pool Dimensions

Tre controlli chiari per Length, Width e Depth, con input numerico e slider sincronizzati. Mostra una preview compatta delle metriche. Ogni modifica deve aggiornare outline, geometria e camera senza reload.

### Step 3 — Pool System

Due card:

- **Skimmer Pool**: livello acqua sotto il bordo e skimmer visibili nella parete;
- **Overflow Edge Pool**: sfioro perimetrale con fessura, canale nascosto e acqua sul bordo.

Non usare i termini Infinity o Infinity Edge. Entrando nello step, la camera esegue un close-up. Se si cambia sistema, la camera mantiene esattamente posizione, distanza, zoom, angolo e framing; cambia solo il dettaglio costruttivo.

### Step 4 — Interior Finish

Card **PVC Liner** e **Mosaic**. Entrando nello step:

- spostare dolcemente la camera dentro la vasca;
- inquadrare una parete e parte del fondo;
- nascondere temporaneamente l'acqua;
- usare una prospettiva fissa identica per entrambi i materiali;
- sostituire solo il materiale, senza ricostruire la geometria o la scena.

Quando si lascia questo step, ripristinare automaticamente l'acqua.

### Step 5 — Interior Color

Sei campioni: White, Sand, Light Grey, Dark Grey, Blue e Green. La camera resta nell'inquadratura materiale. Il colore modifica istantaneamente solo mappe/parametri del materiale selezionato.

### Step 6 — Optional Accessories

Griglia responsive: una colonna su schermi piccoli, due sul desktop ampio. Card grandi, allineate, con icona Lucide minimale, titolo, descrizione di massimo due righe, check piccolo, bordo sottile e stato selezionato discreto.

Opzioni esatte:

1. Automatic Cover — Automatic safety and thermal protection system.
2. Heat Pump — Efficient water heating for a longer swimming season.
3. Salt Electrolysis — Comfortable, automated salt-water treatment.
4. Automatic Chlorine / pH Dosing — Automatic control of essential water treatment.
5. LED Lighting — Underwater lighting for evening use.
6. Perimeter LED — Subtle lighting around the pool perimeter.
7. Waterfall — Architectural water feature.
8. Hydromassage — Integrated therapeutic water and air jets.
9. Counter-current Swimming — A compact system for continuous swimming.
10. Pool Robot — Automatic cleaning for the pool floor and walls.
11. Smart Pool Control / Automation — Simple remote management of pool functions.
12. Solar Shower — An efficient outdoor shower for the pool area.

Queste scelte entrano solo nel preventivo/review: non aggiungere mesh, luci o animazioni 3D.

### Step 7 — Customer Details

Campi New Pool: Name, Company optional, Email, Phone, City, Country e Notes. Il Continue è abilitato solo con name, email valida, phone, city e country. Mostrare gli errori senza spostare bruscamente il layout.

### Step 8 — Final Review

La viewport 3D resta l'elemento visivo principale con overview isometrica premium. Nel pannello, priorità a:

1. Project Type;
2. Pool Shape;
3. Dimensions;
4. Pool System;
5. Interior Finish;
6. Interior Color;
7. Selected Accessories.

Seguono informazioni cliente e una sezione secondaria **Pool Metrics**, compatta in due colonne. Numeri nella stessa famiglia tipografica del testo, dimensione normale, senza stile dashboard KPI. Il pulsante Request Quote può restare predisposto/disabilitato finché non esiste un backend; non simulare un invio.

## 7. Flusso Pool Renovation

Il percorso renovation deve restare separato e non deve modificare il flusso New Pool. Ha 6 step totali incluso il Project Type condiviso.

### Renovation step 1 — What would you like to renovate?

Selezione multipla:

- Interior Finish — Replace liner or mosaic;
- Pool Filtration System — Filter, pump, skimmers, hydraulic equipment;
- Pool Edge / Coping — Replace coping stones or edge finish;
- Pool Structure — Repairs, leaks, cracks, waterproofing;
- Pool Equipment Upgrade — Automation, salt system, heat pump, control unit;
- Complete Pool Renovation.

Almeno una selezione è necessaria per continuare. `Complete` rende disponibili tutte le sezioni dinamiche senza cancellare le eventuali altre scelte.

### Renovation step 2 — Current Pool Information

Chiedi solo: Pool Shape, Length, Width e Approximate Depth. Usa gli stessi limiti e la stessa geometria sicura del percorso New Pool. La scena rimane in overview e reagisce alle dimensioni.

### Renovation step 3 — Dynamic Questions

Mostra esclusivamente le sezioni scelte nello step 1:

- **Interior Finish**: Current finish (Liner/Mosaic), New finish (Liner/Mosaic), Finish colour. Aggiorna il materiale 3D quando cambia la nuova finitura/colore.
- **Pool Filtration System**, multi-select: Replace Pump, Replace Filter, Replace Skimmers, Convert to Overflow Pool. Se Replace Skimmers è selezionato, mostra la raccomandazione automatica di uno skimmer ogni 25 m².
- **Pool Edge / Coping**: Replace existing coping? Se sì, chiedi Preferred material.
- **Pool Structure**, multi-select: Water leakage, Structural crack, Waterproofing problem, General structural repair.
- **Pool Equipment Upgrade**, multi-select: Salt chlorination, Automatic dosing, Heat pump, Automation / Smart Control.

Non chiedere dati non pertinenti.

### Renovation step 4 — Customer Information

Campi: Name, Surname, Email, Phone, City, Country, Notes. Continue richiede i primi sei campi e una email valida. Questo requisito è importante: il form deve consentire realmente l'avanzamento quando i valori validi sono presenti.

### Renovation step 5 — Review

Riepilogo professionale e dinamico di tutte le opere selezionate, dati piscina corrente, dettagli tecnici scelti e cliente. Omettere sezioni non selezionate. Mantenere la viewport visibile.

## 8. Geometria e calcoli puri

Tutta la matematica deve vivere in funzioni pure in `lib/pool/geometry.ts` e `engineering.ts`, testabili senza React o Three.js.

### Outline

- Rectangle: unit outline centrato nell'origine, da `-0.5` a `0.5` su X e Z.
- Custom: validare il poligono di controllo, applicare Chaikin corner cutting fino ad almeno 128 campioni, quindi normalizzare e scalare.
- La scala finale moltiplica X per `length` e Z per `width`.
- Se input o custom polygon sono invalidi, usare un rettangolo valido come fallback invece di restituire geometria vuota.
- Mai passare valori non finiti o dimensioni <= 0 a Three.js; applicare un minimo di sicurezza di `0.01` durante la costruzione.

### Validazione custom polygon

Richiedere:

- almeno 3 vertici;
- coordinate finite;
- area normalizzata >= `0.02`;
- ogni lato >= `0.035`;
- nessuna autointersezione tra lati non adiacenti.

Quando si trascina un control point verso una posizione invalida, non rompere il modello: trovare la posizione valida più vicina con ricerca binaria di 16 iterazioni tra punto precedente e punto richiesto.

### Metriche

Calcolare con shoelace formula e perimetro dei segmenti:

```text
waterSurface   = area outline
floorSurface   = waterSurface
wallSurface    = perimeter × depth
internalSurface = floorSurface + wallSurface
waterVolume    = waterSurface × depth
perimeter      = somma lunghezze lati
```

Formattare metri con `m`, superfici con `m²`, volumi con `m³`, con precisione leggibile e coerente.

### Skimmer planning

- solo se system è `skimmer`;
- quantità `max(1, ceil(waterSurface / 25))`;
- distribuirli uniformemente sul lato lungo e più adatto;
- rispettare distanza visiva dagli angoli;
- restituire posizione X/Z e rotazione verso la parete;
- nessuno skimmer nel sistema overflow.

## 9. Pipeline 3D

La scena deve essere vera geometria Three.js, non un mockup.

### Componenti

- `PoolViewport`: client-only, lazy import della scena, Suspense fallback e `React.memo`;
- `PoolScene`: Canvas, camera rig, luci, environment locale, studio floor, model, skimmers, misure e controls;
- `PoolModel`: pareti, fondo, acqua, coping e dettaglio overflow;
- `Skimmers`: modello parametrico leggero e posizionamento dal piano ingegneristico;
- `PoolMeasurements`: guide opzionali;
- `poolGeometry`: creazione ShapeGeometry, wall BufferGeometry e ring geometry;
- `textures`: CanvasTexture procedurali per ripple normal e caustiche.

### Geometria costruttiva

- pareti verticali dal livello `0` a `-depth`;
- fondo alla quota `-depth`;
- freeboard skimmer `0.12 m`;
- coping width `0.38 m`;
- coping thickness `0.055 m`;
- coping come anello, non come lastra che copre la vasca;
- studio floor neutro con vero foro corrispondente alla vasca e al coping;
- tutte le mesh devono seguire rectangle e custom outline.

Per Skimmer Pool mostra un corpo realistico nella parete: cornice bianca sottile a quattro elementi, bocca scura incassata, waterline, coping e finitura interna. Per Overflow Edge Pool mostra sfioro perimetrale residenziale: water edge offset circa `0.06 m`, slot edge circa `0.105 m`, canale nascosto a quota circa `-0.095 m`, film acqua circa `-0.026 m`, coping esterno allo slot. Non rappresentare una cascata infinity.

### Materiali interni

Registro centralizzato:

```ts
INTERIOR_TEXTURES[finish][color] -> URL asset
```

Precaricare una volta gli URL unici. Inizialmente tutte le varianti liner possono puntare a `/textures/pool/pvc-liner-base.png` e tutte le mosaic a `/textures/pool/mosaic-base.png`; il colore PBR differenzia le varianti. La struttura deve permettere di sostituire ogni combinazione con un file specifico senza cambiare componenti o logica.

- PVC Liner: superficie continua, liscia, senza fughe, bump scale 0, tile size indicativa 1.6 m, roughness circa 0.32, metalness 0.02.
- Mosaic: tessere e fughe visibili, tile scale corretta, tile size indicativa 0.42 m, bump scale circa 0.012, roughness circa 0.12, metalness 0.06.
- Clonare texture per fondo e pareti, usare repeat wrapping, sRGB e anisotropy 4; disporre le clone al cambio.
- Cambiare finish/color deve aggiornare il materiale senza ricostruire outline o camera.

Colori base:

```text
white #eef2f2
sand #e3d6bd
lightGrey #c8cccd
darkGrey #6f7476
blue #7fa9c9
green #8aa893
```

### Acqua

Usa `MeshPhysicalMaterial` leggero:

- opacity `0.84`, transparent;
- roughness `0.085`, metalness `0`;
- transmission `0.82`;
- IOR `1.33`;
- clearcoat `1`, clearcoat roughness `0.075`;
- normal strength `0.075`;
- attenuation distance proporzionale alla profondità;
- `depthWrite: false`;
- ripple map procedurale a movimento lento e non aggressivo;
- oscillazione verticale massima circa `0.004 m`;
- tonalità acqua derivata dal colore interno, non blu fisso esagerato.

Nascondi acqua e caustiche solo nello step Interior Finish New Pool. Ripristinale uscendo.

### Illuminazione e renderer

- Canvas antialias, ombre PCF, ACES Filmic Tone Mapping;
- DPR massimo `1.5`;
- FOV `34`, near `0.1`, far `500`;
- `preserveDrawingBuffer: false` per evitare crescita di memoria WebGL;
- hemisphere, directional e spot light neutre e morbide;
- ContactShadows risoluzione 512, calcolate una sola volta;
- Environment procedurale locale con Lightformers, risoluzione 128;
- non caricare HDR remoti: un errore di rete non deve raggiungere l'error boundary dell'app;
- fog coerente con lo sfondo e showroom neutro.

### Camera focus e controlli

Focus disponibili: `overview | skimmer | overflow | interior | review`.

Mappatura New Pool:

```text
Project Type        -> overview
Pool Shape          -> overview
Dimensions          -> overview
Pool System         -> skimmer oppure overflow
Interior Finish     -> interior
Interior Color      -> interior
Accessories         -> overview
Customer Details    -> overview
Final Review        -> review
```

Il percorso Renovation usa overview stabile.

Movimento camera con interpolazione in `useFrame`, mai jump. Formula temporale indipendente dal frame rate, per esempio `t = 1 - pow(0.0015, delta)`, poi `camera.position.lerp(goal, t)` e `controls.target.lerp(lookAt, t)`. Interrompere il volo quando posizione e target sono entro una piccola tolleranza.

Requisiti specifici:

- overview: distanza `max(6, hypot(length,width)/2 × 3.25)`, isometrica premium;
- review: stessa logica ma più elevata;
- system close-up: memorizzare il dettaglio skimmer centrale e riusare esattamente lo stesso goal/target per skimmer e overflow;
- interior: goal dentro piscina circa `(0, -depth×0.28, min(width×0.15,1.1))`, target circa `(0, -depth×0.82, -min(width×0.45,2.6))`;
- cambiare liner/mosaic o colore non deve essere una dipendenza dell'effetto camera;
- OrbitControls con damping, movimento controllato e niente prospettive estreme;
- cambio dimensione/forma incrementa un frame token e rifà il framing completo.

### Lifecycle e performance

- memoizzare tutte le geometrie con dipendenze minime;
- chiamare `dispose()` su BufferGeometry, texture clonate e CanvasTexture in cleanup;
- non ricreare Canvas, scena o geometry per accessori o colore;
- nessun listener globale senza cleanup;
- nessun RAF esterno non cancellato;
- evitare setState in `useFrame`;
- mantenere il rendering fluido e un solo loop R3F;
- nessun warning React/Three in console.

## 10. Design system e UX

Dark mode è l'esperienza primaria: graphite atelier, neutri caldi e un solo accento wellness desaturato. Light mode è una galleria bianca discreta.

Font stack:

```css
"SF Pro Display", "Inter", "Helvetica Neue", ui-sans-serif, system-ui, sans-serif
```

Peso body `300`, heading `300`, display `200`. Label uppercase molto piccole con tracking `0.22em`. Non usare font numerico separato nella Final Review.

Token principali:

```ts
icon: { size: 16, strokeWidth: 1.15 }
transition: { fast: 240, standard: 500, slow: 700 }
radius: { control: 999, card: 18, panel: 0 }
spacing: { panelX: 44, section: 56 }
typography: { displayWeight: 200, bodyWeight: 300, labelTracking: "0.22em" }
ease: cubic-bezier(0.16, 1, 0.3, 1)
```

Dark palette orientativa in OKLCH:

```css
--background: oklch(0.135 0.003 70);
--foreground: oklch(0.94 0.004 85);
--card: oklch(0.18 0.004 70);
--muted: oklch(0.215 0.004 70);
--muted-foreground: oklch(0.66 0.005 80);
--brand: oklch(0.74 0.04 184);
--border: oklch(1 0 0 / 12%);
--hairline: oklch(1 0 0 / 7%);
--viewport: oklch(0.105 0.004 70);
```

Layout desktop:

- header sottile con logo Piscine Wellness, descriptor, theme toggle e reset;
- pannello wizard sinistro largo circa 452 px, fino a 512 px su viewport ampie;
- area 3D che occupa tutto lo spazio restante e resta sempre visibile;
- step indicator elegante, step corrente evidente, completati con check discreto, futuri visibili ma disabilitati;
- footer del pannello con Back e Continue sempre coerenti;
- summary live sovrapposto con discrezione alla viewport su desktop ampio.

Layout mobile/tablet:

- stack verticale senza perdere alcun controllo;
- viewport con altezza utile, configuratore leggibile sotto/sopra secondo lo spazio;
- card a una colonna;
- nessun overflow orizzontale;
- controlli touch almeno 44 px;
- testo accessori senza word-break innaturali.

Microinterazioni: transizioni 240–500 ms, hover con lieve bordo/lift, selected state con bordo accent sottile, background appena colorato e piccolo check. Rispettare `prefers-reduced-motion` portando le animazioni quasi a zero.

## 11. Componenti React e responsabilità

- `PoolConfigurator`: provider, shell, selezione flusso, mapping step -> componente, focus camera, showWater, navigazione e layout. Non contiene formule geometriche.
- `StepIndicator`: riceve definitions, corrente e completion; consente accesso solo a step raggiungibili.
- `StepSection`: titolo, subtitle e transizione coerente per il contenuto dello step.
- `PoolViewport`: boundary client/lazy della parte WebGL.
- `LiveSummary`: riepilogo discreto delle selezioni principali sopra la viewport.
- `ProjectSummary`: gerarchia della Final Review e metriche secondarie.
- `DimensionControl`: input+slider accessibile, valore controllato e clamp nel reducer.
- `ShapeEditor`: SVG/editor control point; usa il vincolo geometrico, non scrive punti invalidi.
- `FileDrop`: MIME/size UI, preview immagine via object URL e rimozione sicura.
- `MetricsPanel`: formato compatto di volume/superfici/perimetro.
- `TextField`: label, input, stato errore e autocomplete.
- `BrandLogo`: legge solo `PRODUCT_BRAND`.
- `ThemeToggle`: persiste `light|dark`, evita hydration mismatch con boot script in `<head>`.
- ogni step legge e aggiorna lo store tramite hook Context, senza prop drilling esteso.

## 12. Branding e asset sostituibili

Centralizza in `configurator/config/product.ts`:

```ts
PRODUCT_BRAND = {
  name: "Piscine Wellness",
  productName: "Pool Studio",
  descriptor: "Swimming Pool Configurator",
  logoUrl: importedLogo,
  logoAlt: "Piscine Wellness"
}

PRODUCT_ASSETS = {
  waterNormalMap: null,
  causticsMap: null,
  environmentMap: null,
  productImages: {}
}
```

Usa `src/configurator/assets/icons/piscine-wellness-logo.png` come logo corrente. Non hardcodare logo, nome o URL nei componenti. Mantieni texture di base in `public/textures/pool`; in futuro nuovi liner e mosaici devono richiedere solo nuovi file e aggiornamento del registro.

## 13. Stabilità, error boundaries e SSR

- Root shell con `suppressHydrationWarning` sull'elemento html e script tema eseguito nel `<head>` prima del paint;
- importare WebGL solo lato client;
- root error boundary con messaggio recuperabile, log dell'errore e pulsante retry;
- non accedere a `window`, `document`, `localStorage`, `URL.createObjectURL` o WebGL durante SSR;
- nessun remote asset indispensabile alla prima renderizzazione;
- fallback visivo durante il lazy load della scena;
- controllare che un errore texture non abbatta tutta l'app;
- mantenere context e hook order invariati;
- non usare indici instabili per key quando esiste un id;
- la pagina deve restare attiva per sessioni prolungate e dopo refresh ripetuti.

## 14. Test richiesti prima della consegna

Esegui e risolvi tutti gli errori prima di dichiarare completato:

1. TypeScript/build production senza errori.
2. Lint senza nuovi errori.
3. Audit geometrico automatico su rectangle e custom.
4. Test manuale dimensioni minime, massime e valori intermedi.
5. Trascinamento estremo dei punti custom: niente autointersezioni e nessuna sparizione.
6. Cambio ripetuto Rectangle/Custom.
7. Cambio ripetuto Skimmer/Overflow: stessa camera, dettaglio costruttivo diverso, zero skimmer in overflow.
8. Superfici sotto, esattamente e sopra multipli di 25 m² per verificare il conteggio skimmer.
9. Cambio Liner/Mosaic e tutti i sei colori senza camera jump o ricostruzione scena.
10. Acqua nascosta solo nello step Interior Finish e ripristinata altrove.
11. Tutti i 12 accessori selezionabili/deselezionabili e visibili nella review, senza variazioni 3D.
12. Form New Pool: Continue disabilitato/abilitato correttamente.
13. Form Renovation: Name, Surname, Email, Phone, City e Country validi permettono Continue.
14. Tutte le combinazioni delle sezioni renovation e review dinamica.
15. Responsive desktop, laptop, tablet e mobile senza clipping.
16. Dark/light mode senza flash o hydration warning.
17. Console browser senza errori React, Three.js, WebGL o promise rejection.
18. Refresh ripetuti e sessione aperta almeno 30 secondi senza memory growth anomala o crash.

## 15. Criteri finali di accettazione

La ricostruzione è accettabile soltanto se:

- entrambi i workflow sono completi e distinti;
- il New Pool ha esattamente 9 step e Renovation esattamente 6;
- ogni Continue segue le validazioni descritte;
- Rectangle e Custom funzionano in ogni dimensione ammessa;
- metriche e skimmer sono derivati dalla geometria reale;
- Skimmer e Overflow sono chiaramente distinguibili dalla medesima inquadratura;
- Liner e Mosaic sono confrontabili dalla medesima inquadratura interna con acqua nascosta;
- la Final Review riflette tutte le scelte;
- gli accessori restano commerciali;
- branding e texture sono sostituibili centralmente;
- nessun runtime crash, loop infinito, hydration error, leak o warning Three.js;
- UX, UI e logica restano premium, minimali e coerenti con il prodotto esistente.

Non fermarti a uno scaffold o a placeholder visivi. Implementa l'intera esperienza descritta, verifica ogni criterio e mantieni il codice modulare, tipizzato e pronto per produzione.

## 16. Specifica definitiva del realismo 3D

Questa sezione completa e rende vincolanti le indicazioni della pipeline 3D precedente. La ricostruzione non deve limitarsi a forme geometriche generiche o materiali piatti.

### Skimmer procedurale realistico

Non sono disponibili modelli GLB, GLTF o OBJ. Costruisci internamente uno skimmer residenziale realistico e leggero con geometrie Three.js riutilizzabili.

Lo skimmer deve comprendere:

- corpo tecnico incassato dietro la parete;
- cornice rettangolare bianca in ABS/PVC;
- bordi leggermente arrotondati che reagiscono alla luce;
- apertura orizzontale realmente vuota e profonda;
- bocca interna scura;
- paratia galleggiante leggermente inclinata;
- piccoli fissaggi metallici discreti;
- acqua che continua all'interno della bocca;
- ombra di contatto fra cornice, parete e incasso;
- corretto allineamento con waterline e coping.

Dimensioni visive indicative del frontale: circa `0.70–0.72 m` di larghezza e `0.20–0.22 m` di altezza complessiva. Evitare un semplice rettangolo nero applicato alla parete.

Ogni istanza deve usare posizione e rotazione restituite da `planSkimmers`. Conservare rigidamente la regola `max(1, ceil(area / 25))` e non mostrare skimmer nel sistema Overflow.

### Sfioro perimetrale realistico

Lo sfioro deve rappresentare un vero sistema residenziale perimetrale, non un bordo infinity.

La sezione costruttiva deve includere:

- acqua quasi complanare al bordo interno;
- sottile film d'acqua oltre il labbro;
- fessura continua scura e stretta;
- parete verticale interna della canalina;
- volume di raccolta nascosto sotto il piano;
- ombra profonda nella fessura;
- coping o lastra esterna che inizia oltre il canale;
- materiale minerale coerente su bordo e pavimentazione immediata;
- nessuna cascata laterale visibile.

Il dettaglio deve essere parametrico e seguire integralmente Rectangle e Custom Shape. Non usare un segmento rigido ripetuto che produca sovrapposizioni nelle curve. Come riferimento dimensionale iniziale, usare offset progressivi di circa `0.06 m`, `0.105 m` e `0.165 m`, adattandoli soltanto a fini visivi senza alterare l'outline o le metriche.

### Coping e pietra

Il coping deve avere:

- larghezza nominale `0.38 m`;
- spessore nominale `0.055 m`;
- fianchi visibili;
- piccoli smussi o sottili bande di highlight sui bordi;
- microtexture minerale fine e seamless;
- bump estremamente contenuto, circa `0.004–0.006`;
- roughness medio-alta;
- riflessi molto discreti;
- nessun effetto plastica o metallo.

Se non esiste una texture commerciale, genera una CanvasTexture locale originale con grana minerale multiscala. La texture deve ripetersi in base alle dimensioni fisiche della piscina e non stirarsi.

### PVC Liner realistico

Il liner deve sembrare una membrana continua:

- nessuna fuga;
- nessuna tessera;
- microtrama tessile quasi impercettibile;
- bump pari a zero o estremamente basso;
- clearcoat contenuto;
- riflessione morbida;
- colorazione uniforme senza perdere la microtrama;
- stessa scala su pareti e fondo.

### Mosaico realistico

Il mosaico deve mostrare:

- tessere quadrate in scala credibile;
- fughe sottili e leggibili nel close-up;
- leggere variazioni fra tessere;
- bump indicativo `0.012`;
- roughness e riflessi coerenti con vetro/ceramica immersi;
- repeat indipendente per pareti e fondo;
- nessuna deformazione al cambio di lunghezza, larghezza o profondità.

### Acqua fisicamente credibile

Mantenere una soluzione performante basata su `MeshPhysicalMaterial`:

- IOR `1.33`;
- opacity indicativa `0.84`;
- transmission indicativa `0.82`;
- roughness indicativa `0.085`;
- clearcoat `1` con clearcoat roughness bassa;
- attenuation dipendente dalla profondità;
- tinta derivata dal colore del rivestimento;
- normal map procedurale seamless;
- animazione lenta su due assi;
- oscillazione verticale massima circa `0.004 m`;
- `depthWrite: false`;
- riflessi presenti ma non specchiati;
- nessuna onda aggressiva o effetto gelatina.

Nel sistema Skimmer la quota acqua resta sotto il coping. Nel sistema Overflow arriva al labbro e alimenta visivamente la fessura. La superficie deve continuare dentro la bocca dello skimmer.

### Illuminazione premium e riflessioni

Realizzare un ambiente da showroom architettonico:

- sfondo graphite in dark mode e galleria neutra in light mode;
- ACES Filmic Tone Mapping;
- esposizione controllata;
- Environment locale procedurale con Lightformer;
- key light ampia e morbida;
- fill light neutra;
- ombre diffuse;
- ContactShadows calcolate una volta;
- riflessi leggibili su acqua e materiali senza bruciature;
- nessun colore acceso o illuminazione teatrale;
- nessuna HDRI remota obbligatoria.

È possibile predisporre una HDRI locale futura, ma l'applicazione deve avere sempre un fallback procedurale e non deve mai andare in errore per un asset mancante.

### Camera cinematografica

Le transizioni devono essere fluide e indipendenti dal frame rate. Usare interpolazione di camera e target nel render loop senza React state.

Vincoli:

- stessa identica camera per Skimmer e Overflow;
- stessa identica camera interna per Liner e Mosaic;
- nessun movimento al cambio del solo colore;
- nessun movimento al cambio del solo materiale durante il confronto interno;
- overview completa dopo forma, dimensioni, accessori, cliente e review;
- close-up del sistema abbastanza vicino da leggere il dettaglio costruttivo;
- niente top-down nello step Pool System;
- niente salti, rotazioni improvvise o prospettive grandangolari estreme.

### Divieti 3D

Non creare o renderizzare:

- waterfall;
- hydromassage;
- cover;
- heat pump;
- sistemi di dosaggio;
- illuminazione accessori;
- robot;
- arredamento;
- giardino;
- paesaggio;
- pavimentazione esterna configurabile;
- componenti idraulici tecnici non comprensibili al cliente.

Gli accessori restano selezioni commerciali visibili soltanto nel wizard e nella Final Review.

### Accettazione visiva aggiuntiva

Prima della consegna verificare in close-up che:

- lo skimmer sembri integrato nella parete e non applicato davanti;
- l'acqua attraversi visivamente la bocca dello skimmer;
- la fessura overflow sia continua e non presenti interruzioni o triangoli errati;
- il canale overflow sia percepibile ma prevalentemente nascosto;
- coping e pietra abbiano grana visibile senza rumore eccessivo;
- Liner e Mosaic risultino immediatamente distinguibili;
- pareti e fondo non mostrino UV stirate;
- non esistano z-fighting, light leak, flickering o geometrie sovrapposte;
- il frame rate resti fluido su desktop e laptop;
- il bundle 3D resti caricato separatamente tramite lazy import.

Queste migliorie sono esclusivamente visuali. Non autorizzano modifiche a reducer, Context, step, validazioni, navigazione, calcoli, tipi pubblici o flussi descritti nelle sezioni precedenti.
