# Prompt Lovable — miglioramento esclusivo del realismo 3D

## File da allegare a Lovable

Allega questi file mantenendo i rispettivi percorsi, preferibilmente dentro un unico file ZIP:

```text
src/components/pool/PoolViewport.tsx
src/components/pool/three/PoolScene.tsx
src/components/pool/three/PoolModel.tsx
src/components/pool/three/Skimmers.tsx
src/components/pool/three/PoolMeasurements.tsx
src/components/pool/three/poolGeometry.ts
src/components/pool/three/textures.ts

src/lib/pool/types.ts
src/lib/pool/config.ts
src/lib/pool/context.ts
src/lib/pool/engineering.ts
src/lib/pool/geometry.ts
src/lib/pool/materials.ts

src/configurator/3d/scene/visual-preset.ts
src/configurator/materials/interior-textures.ts
src/configurator/materials/visual-presets.ts

public/textures/pool/pvc-liner-base.png
public/textures/pool/mosaic-base.png

package.json
tsconfig.json
vite.config.ts
```

Non è necessario allegare form, step, review, accessori o interfaccia completa: Lovable non deve modificarli.

---

## Testo da incollare in Lovable insieme ai file

Ti allego il modulo 3D originale e funzionante del progetto **POOL SHAPER**.

Repository informativo:

`https://github.com/daniellamthi/POOL-SHAPER`

Se il repository non è accessibile dal tuo piano, lavora esclusivamente sui file allegati. I file allegati contengono la scena, il modello, la geometria, i materiali, la camera, i tipi e le funzioni di dominio necessarie per comprendere il rendering esistente.

## Obiettivo unico

Migliora esclusivamente il realismo e la qualità estetica della piscina 3D, con un risultato simile a un configuratore premium Porsche, Ferrari, Tesla o Apple.

Non ricostruire l’applicazione. Non creare un nuovo configuratore. Non creare pagine o una nuova UI.

## Parti che non puoi modificare

Mantieni completamente invariati:

- workflow New Pool e Pool Renovation;
- ordine, numero e struttura degli step;
- navigazione Continue e Back;
- stato globale, reducer e Context;
- business logic;
- calcoli di area, volume, superfici e perimetro;
- limiti delle dimensioni;
- validazione dei poligoni custom;
- regola di uno skimmer ogni 25 m²;
- forme supportate: Rectangle e Custom Shape;
- sistemi supportati: Skimmer Pool e Overflow Edge Pool;
- nomi e firme delle props pubbliche;
- tipi TypeScript pubblici;
- comportamento degli accessori;
- Final Review;
- UI e Design System;
- alias di importazione `@/*`;
- architettura React e React Three Fiber.

Non modificare i file di dominio dentro `src/lib/pool`. Sono allegati esclusivamente per comprendere tipi, dati e contratti. Se ritieni indispensabile cambiarne uno, non farlo: descrivi invece la modifica proposta separatamente.

## File sui quali puoi intervenire

Puoi restituire modifiche esclusivamente per:

```text
src/components/pool/three/PoolScene.tsx
src/components/pool/three/PoolModel.tsx
src/components/pool/three/Skimmers.tsx
src/components/pool/three/poolGeometry.ts
src/components/pool/three/textures.ts
src/configurator/3d/scene/visual-preset.ts
src/configurator/materials/interior-textures.ts
src/configurator/materials/visual-presets.ts
public/textures/pool/*
```

Modifica `PoolViewport.tsx` soltanto se indispensabile per caricamento o performance e senza cambiarne l’API pubblica.

## Asset e modelli

Non dispongo di modelli GLB, GLTF o OBJ.

Devi realizzare proceduralmente con Three.js:

- skimmer realistico;
- dettaglio dello sfioro perimetrale;
- eventuali smussi e raccordi costruttivi;
- texture aggiuntive originali e locali, se necessarie.

Non usare modelli o texture remoti. Non aggiungere dipendenze da CDN, API esterne o URL che possano fallire. Non utilizzare asset di cui non sia chiara la licenza commerciale.

## Skimmer Pool

Migliora lo skimmer esistente senza cambiare il piano di posizionamento calcolato.

Lo skimmer procedurale deve mostrare:

- corpo incassato nella parete;
- cornice rettangolare con smussi realistici;
- apertura orizzontale profonda;
- bocca interna scura;
- paratia galleggiante interna;
- piccoli dettagli di fissaggio discreti;
- materiale ABS/PVC bianco realistico;
- ombre di contatto;
- corretto rapporto con coping, parete e waterline.

Deve restare leggero. Riutilizza geometrie e materiali. Non generare un modello diverso a ogni render.

La quantità deve continuare a provenire esclusivamente da `planSkimmers`: uno skimmer ogni 25 m². Overflow non deve mostrare skimmer.

## Overflow Edge Pool

Non rappresentare una infinity pool.

Costruisci uno sfioro perimetrale residenziale credibile che segua automaticamente l’intero outline Rectangle o Custom Shape.

Deve mostrare:

- acqua allo stesso livello del bordo interno;
- sottile lama d’acqua che supera il bordo;
- fessura perimetrale continua;
- parete verticale della canalina;
- canale di raccolta nascosto;
- ombra interna che renda leggibile la profondità;
- coping che inizia dopo la fessura;
- proporzioni costruttive realistiche;
- nessuna cascata da infinity edge;
- nessuna griglia rigida che si deformi male lungo curve e Custom Shape.

Mantieni la generazione parametrica. Non sostituirla con un modello fisso.

## Stessa camera Skimmer/Overflow

La camera attuale usa lo stesso close-up per Skimmer e Overflow. Questo comportamento è vincolante.

Quando l’utente cambia sistema devono rimanere identici:

- posizione camera;
- target;
- FOV;
- distanza;
- zoom;
- angolo;
- prospettiva;
- durata ed easing dell’animazione.

Deve cambiare soltanto il dettaglio costruttivo.

## Coping, pareti e geometria visuale

Non cambiare la matematica che genera l’outline.

Migliora soltanto la costruzione visuale:

- coping con spessore credibile;
- smussi sottili sui bordi;
- raccordi puliti;
- spessore visibile della parete quando necessario;
- waterline corretta;
- normali coerenti;
- eliminazione di z-fighting;
- eliminazione di superfici sovrapposte;
- niente fessure visibili;
- nessuna deformazione con dimensioni minime o massime;
- compatibilità completa con outline custom curvi.

Preferisci highlight band e geometrie leggere rispetto a bevel con densità eccessiva.

## PVC Liner

Usa la texture allegata come base e migliorane il comportamento PBR.

Il PVC Liner deve apparire:

- continuo;
- perfettamente liscio;
- senza fughe;
- con microtrama molto sottile;
- con riflessi morbidi;
- con roughness realistica;
- senza effetto plastica economica;
- senza pattern stirato.

La selezione del colore deve continuare a modificare soltanto il materiale, senza ricostruire la geometria o spostare la camera.

## Mosaic

Usa la texture allegata come base e migliorane il comportamento PBR.

Il mosaico deve mostrare:

- tessere leggibili;
- fughe realistiche;
- scala fisica credibile;
- variazioni cromatiche leggere;
- normal/bump map discreta;
- roughness differenziata;
- riflessi controllati;
- nessuna distorsione cambiando dimensioni.

Le texture di fondo e pareti devono avere UV e repeat indipendenti, mantenendo una scala costante in metri.

## Confronto Interior Finish

Mantieni l’attuale camera interna e lo stesso framing per PVC Liner e Mosaic.

Durante il passaggio fra materiali:

- non spostare la camera;
- non ricreare Canvas;
- non ricaricare la scena;
- non rigenerare outline o geometria;
- sostituisci soltanto mappe e parametri del materiale.

Mantieni l’acqua nascosta esclusivamente nello step Interior Finish e ripristinala uscendo dallo step.

## Acqua

Migliora il materiale esistente mantenendo una soluzione leggera basata su `MeshPhysicalMaterial` o equivalente.

L’acqua deve avere:

- IOR fisico vicino a `1.33`;
- trasparenza credibile;
- transmission controllata;
- riflessioni ambientali morbide;
- assorbimento proporzionale alla profondità;
- tonalità derivata dal colore interno;
- normal map animata lentamente;
- piccole increspature naturali;
- corretta waterline per Skimmer e Overflow;
- profondità visivamente leggibile;
- niente effetto specchio;
- niente effetto gelatina;
- niente onde aggressive;
- niente shader eccessivamente costosi.

## Illuminazione e riflessioni

Crea un ambiente da showroom architettonico premium.

Usa:

- ACES Filmic Tone Mapping;
- environment locale procedurale con Lightformer;
- illuminazione neutra;
- riflessi morbidi;
- directional light diffusa;
- fill light controllata;
- ombre morbide;
- ContactShadows;
- esposizione equilibrata in dark e light mode;
- piscina sempre chiaramente visibile.

Non utilizzare HDRI remoti. Se proponi supporto per una HDRI futura, deve essere opzionale e avere sempre un fallback locale sicuro.

## Camera e transizioni

Mantieni i focus esistenti:

```text
overview
skimmer
overflow
interior
review
```

Mantieni anche la mappatura tra step e focus.

Puoi migliorare soltanto:

- easing;
- fluidità;
- precisione del framing;
- interpolazione indipendente dal frame rate;
- arresto morbido vicino al target.

Non introdurre camera jump. Non cambiare camera quando cambia solamente materiale o colore.

## Performance e stabilità

Mantieni o migliora:

- lazy loading della scena;
- DPR massimo limitato;
- `preserveDrawingBuffer: false`;
- geometrie memoizzate;
- materiali e texture riutilizzati;
- cleanup con `dispose()` per risorse create a runtime;
- un solo render loop React Three Fiber;
- nessun `setState` dentro `useFrame`;
- nessun listener senza cleanup;
- nessuna ricostruzione geometrica per colore/accessori;
- nessuna promise rejection da asset remoti;
- nessun warning React o Three.js;
- nessun memory leak.

Non eliminare commenti di stabilità esistenti senza una ragione tecnica documentata.

## Output richiesto

Non creare un progetto nuovo.

Restituisci:

1. i file completi modificati, mantenendo i percorsi originali;
2. eventuali nuovi asset locali;
3. elenco esatto dei file modificati;
4. descrizione sintetica dei miglioramenti;
5. conferma che props, tipi, calcoli e workflow non sono cambiati;
6. istruzioni per reintegrare i file nel repository originale;
7. eventuali dipendenze nuove, che devono essere evitate salvo assoluta necessità.

Non restituire soltanto frammenti di codice o pseudocodice.

## Verifiche obbligatorie

Prima di terminare verifica:

1. TypeScript senza errori;
2. build production riuscita;
3. Rectangle con dimensioni minime, default e massime;
4. Custom Shape con dimensioni minime, default e massime;
5. Skimmer Pool e regola 1/25 m²;
6. Overflow Edge senza skimmer;
7. stessa camera per Skimmer e Overflow;
8. PVC Liner e tutti i colori;
9. Mosaic e tutti i colori;
10. stessa camera per Liner e Mosaic;
11. acqua nascosta e ripristinata correttamente;
12. nessun modello che scompare;
13. nessuno z-fighting evidente;
14. nessun errore React, Three.js o WebGL;
15. nessuna modifica a workflow, step, calcoli o UI.

Prima di modificare il codice, conferma di avere identificato correttamente:

- componente Canvas;
- camera rig;
- modello parametrico della piscina;
- modello skimmer;
- geometria overflow;
- registro materiali;
- texture liner e mosaico;
- contratti TypeScript che devono restare invariati.

Se manca un file indispensabile, non inventarne il contenuto: indicami esattamente quale file aggiuntivo devo allegare.
