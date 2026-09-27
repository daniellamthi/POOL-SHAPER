# Divario fotografico — verifica mirata, 26 settembre 2026

Progetto POOL-SHAPER, branch `feat/premium-infinity-waterline-v1`, HEAD `a9846c3`, WIP preservato. Nessuna modifica applicativa, commit, push o deploy. Preview esistente: http://127.0.0.1:49872/.

## Riferimento e condizioni

La fotografia reale fornita è stata effettivamente aperta: `/var/folders/ms/tnsg20_x4llf9k724y6nxdzr0000gn/T/codex-clipboard-2c8e3caf-fb94-41cf-8cb8-ff25fe614c02.png`. Mostra acqua e riflessi all'aperto, fronte Infinity sul lato lungo, raccolta inferiore, terreno e pavimentazione con risposte diverse. Sedie, fabbricati, terreno di cantiere e scale esterne non sono obiettivi da copiare.

La configurazione trovata nella preview era 10×4,5×1,5 m, liner **Deep Sea**, bordo Travertino, inox, giorno, Infinity lato 2, step Comfort. Non era più Sand: non è stato cambiato il liner per forzare la somiglianza. Per il confronto è stato selezionato temporaneamente il lato lungo 3 ed è stata orientata manualmente la camera a tre quarti, con estremità vicina in basso a destra e fronte lungo verso sinistra. Angolo e soggetto sono confrontabili, ma **non è un camera match metrico**: focale/quote della fotografia non sono note e il riquadro della preview è verticale. Non si attribuisce al renderer la differenza di colore rispetto a un rivestimento fotografato non identificato.

![Fotografia reale](/var/folders/ms/tnsg20_x4llf9k724y6nxdzr0000gn/T/codex-clipboard-2c8e3caf-fb94-41cf-8cb8-ff25fe614c02.png)

![Vista generale corrente, nessuna modifica](/private/tmp/photographic-gap-general.png)

## Tre difetti prioritari

Ordine per impatto nella vista generale; costo relativo di realizzazione/validazione, non preventivo commerciale.

| Priorità | Categoria unica | Causa osservabile e riscontro mirato | Impatto / costo |
| --- | --- | --- | --- |
| 1 | **Asset/materiale** | Il terreno sembra un tappeto granuloso che diventa una fascia uniforme in distanza. Non offre la gerarchia di micro-rilievo, zolle e risposta radente visibile in un terreno reale. Nel ramo Infinity di `PoolScene.tsx` il materiale non usa map, normalMap o roughnessMap: due rumori modificano soltanto il colore, con roughness costante 0,86. La grana fine viene correttamente attenuata in distanza per evitare aliasing, ma resta solo il colore a bassa frequenza. La ricerca mirata degli asset terreno non ha individuato un campione dedicato. Non si tratta di un errore da correggere aumentando semplicemente la risoluzione. | **Molto alto / medio**, un materiale campione calibrato e la sua verifica alla scala reale; eventuale rilievo geometrico va valutato separatamente, non aggiunto qui. |
| 2 | **Luce/ambiente** | Mancano punti di riferimento e contrasti strutturati nei riflessi: cielo, terreno e acqua hanno grandi campiture simili, senza la varietà direzionale della foto. La scena usa già riflessione planare e un HDR sky-only coerente: la povertà del contenuto riflesso non prova che il riflesso sia guasto. La foto include vegetazione e volumi che la scena volutamente non contiene. Non è dimostrato che basti alzare sole o esposizione. | **Alto / medio-alto**, serve un contesto minimo coerente o un campione di illuminazione validato, non un incremento indiscriminato delle luci. |
| 3 | **Acqua** | In orbita la superficie resta troppo simile a un piano trasparente: pareti e fondo mantengono linee molto nette, mentre la fotografia mostra distorsione e riflessi più articolati. La pipeline corrente forza `material.thickness = 0.0` nella rifrazione raster per evitare le copie fantasma; le normali animano ancora il riflesso, ma il campionamento trasmesso non viene spostato. È un compromesso verificabile della pipeline attuale, **non un limite universale di Three.js**. La mancanza di contenuto riflettente del punto 2 contribuisce alla percezione piatta, quindi non tutta la differenza è imputabile alla rifrazione. | **Alto / alto e rischioso**, richiederebbe una prova locale di trasmissione consapevole della profondità senza duplicazioni. Non implementata; nessun nuovo esperimento sul film Infinity. |

## Perché non è stata fatta una correzione applicativa

Il punto 1 richiede un'informazione materiale oggi assente, non una soglia sbagliata individuata nel codice. Cambiare i due verdi, intensificare il rumore o aggiungere rilievo procedurale casuale non dimostrerebbe una risposta da terreno reale; aumentare dettagli geometrici contrasterebbe con la conservazione delle geometrie richiesta. Non c'è un asset calibrato disponibile da collegare con una modifica circoscritta. Perciò non è stata introdotta una taratura cosmetica né affrontato il secondo difetto al posto del primo.

Non esiste un AFTER modificato in questa sessione: le immagini documentano **lo stato attuale**, non vengono presentate come prova di un miglioramento inesistente. Nessun prima/dopo prestazionale artificioso fra camere/configurazioni diverse.

## Decisione: B

Preparare con un technical artist **un solo campione PBR di terreno paesaggistico sobrio**, con dimensione reale dichiarata, albedo senza ombre dipinte, normal/roughness coerenti e risposta controllata a luce radente. Non copiare il cantiere della foto. Provarlo in seguito su una porzione rappresentativa e poi sulla geometria attuale, mantenendo fisse luce/camera/esposizione e confrontando general view, orbita e mobile. Nessuna commissione o attività esterna è stata avviata.

Questa scelta affronta il difetto più esteso con informazioni materiali concrete, senza spendere ancora su effetti d'acqua. **A** diventa sensata quando esiste questo campione da integrare. **C** non è giustificata dalla prova: non è stata dimostrata un'incapacità del motore di visualizzare un terreno PBR o riflessi coerenti; cambiare motore mantenendo gli stessi input incompleti non dimostrerebbe la soluzione. Non si propone una migrazione.

## QA e prestazioni

- Desktop: vista generale confrontabile, orbita reale e zoom; [vista in orbita](/private/tmp/photographic-gap-orbit.png).
- Mobile **emulato 390×844**, non telefono reale: orbita e zoom esercitati; [immagine mobile](/private/tmp/photographic-gap-mobile.png). L'adattamento mobile cambia la camera; non è una coppia A/B con desktop.
- Nessun errore browser rilevato alla fine. Le immagini mostrano ancora il divario CG descritto; non certificano la qualità fotografica.
- Baseline della vista generale ferma, prima dell'orbita finale: sette finestre del logger esistente, canvas 540×827, DPR 2, experience, shadow map 4096. Campioni RAF in ms/frame: **9,66; 9,79; 9,73; 9,87; 9,68; 9,67; 9,57**; media **9,71**, deviazione standard **0,09**, intervallo **9,57–9,87**. Non è un tempo GPU né un benchmark mobile. Nessuna variazione di codice da confrontare; **nessun miglioramento prestazionale dichiarato** e nessun confronto con il precedente campione Sand da 14,5 ms.
- `tsc --noEmit`: PASS. Controllo caustiche sei liner: PASS. `water-transmission-audit.mjs`: PASS, 13 contratti. `git diff --check`: PASS. Non rieseguita la build completa, perché non è cambiato codice applicativo; il PASS della build precedente non viene presentato come nuova esecuzione.
- Ripristinati Infinity lato 2, viewport desktop e step Comfort/inox. Dimensioni, liner Deep Sea, luci e opzioni non modificate. La camera segue nuovamente il controller esistente; non è stato salvato un nuovo preset.

## File e skill

Solo questo report è nuovo. Nessun file applicativo modificato; Sand, caustiche corrette, anti-copie, scale, geometrie, camere e sfioro nascosto preservati. Infinity resta un limite aperto.

Caricate e applicate: [VB Orchestrator](/Users/danielelamthi/.codex/skills/vb-orchestrator/SKILL.md) per lo scope e la decisione di non introdurre una correzione non dimostrata; [visual-reference-matching](/Users/danielelamthi/.codex/skills/visual-reference-matching/SKILL.md) per il confronto reale e i suoi limiti; [realtime-pbr-photorealism](/Users/danielelamthi/.codex/skills/realtime-pbr-photorealism/SKILL.md) e [material-scan-calibration](/Users/danielelamthi/.codex/skills/material-scan-calibration/SKILL.md) per distinguere informazioni mancanti da parametri; [realtime-performance-profiler](/Users/danielelamthi/.codex/skills/realtime-performance-profiler/SKILL.md) per riportare baseline e variabilità senza inventare un guadagno. Nessuna installazione o subagente.
