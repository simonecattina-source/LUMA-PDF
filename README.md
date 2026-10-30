# LUMA PDF — Crea PDF, Unisci PDF, PDF OCR

Applicazione Web **senza server di elaborazione e senza upload dei documenti**. Tutto il lavoro avviene nel browser del dispositivo.

## Modalità

- **Crea PDF:** scatta o carica fotografie e screenshot, modifica l'ordine, ruota, scegli orientamento A4 e qualità. Nome file obbligatorio e inizialmente vuoto.
- **Unisci PDF:** seleziona due o più documenti e uniscili in un PDF. I PDF protetti da password o con strutture particolari possono non essere supportati.
- **PDF OCR:** scatta una nuova foto o carica immagini e screenshot, riordina le pagine e genera un PDF con il livello OCR ricercabile (italiano e inglese). Grafiche, tabelle e impaginazione restano visivamente quelle dell'immagine fotografata, **non ricostruite da OCR**. L'OCR può sbagliare cifre, ordine di lettura e caratteri: verificare sempre gli importi delle buste paga.

### Formato A4 in tutte le modalità

L'output è A4. Due opzioni per la proporzione:

- **Pagina completa senza tagli (predefinito):** massima dimensione all'interno del foglio A4, senza margini aggiunti. Se la proporzione originale non coincide con A4, rimangono inevitabilmente bande bianche.
- **A4 pieno con ritaglio:** riempie completamente la superficie del foglio. Ritaglia le zone esterne quando le proporzioni non coincidono: **non usare per tabelle, buste paga o documenti in cui tutte le cifre devono rimanere visibili**.

Allargare e schiacciare per riempire l'A4 deformerebbe celle e grafici, per questo non viene fatto.

## GitHub + Vercel — IMPORTANTISSIMO

Dalla versione OCR serve una **compilazione automatica in fase di deploy**, perché il motore OCR WebAssembly, i dati linguistici italiani/inglesi e la libreria PDF vengono copiati nel sito. Il browser NON scarica nulla da siti di terze parti: file OCR e PDF sono serviti dal dominio di LUMA PDF.

1. Carica il contenuto della cartella `LUMA_PDF_Web` nella radice del repository, insieme alla cartella `scripts` e a `package.json`.
2. Su Vercel apri il progetto → **Settings → Build and Deployment**.
3. `Framework Preset`: **Other**. `Root Directory`: `./`.
4. `Build Command`: **`npm run build`** (rimuovi eventuale precedente Override vuoto che impedisce la build).
5. `Output Directory`: **`dist`**.
6. `Install Command`: predefinito (**npm install**); non lasciare un override vuoto che impedisca di installare le dipendenze.
7. Esegui **Redeploy** o un nuovo commit su GitHub. Nella build Vercel installerà le librerie npm sul suo server di compilazione e copierà nel sito i modelli OCR.

**Non è più il vecchio sito statico senza build.** Non caricare direttamente questa versione senza aggiornare le impostazioni Vercel, altrimenti non funzionerà.

## Privacy

- Non vengono richiesti account e i documenti non sono inviati a server per essere elaborati.
- Niente database, telemetria, cookie, localStorage, IndexedDB applicativo o service worker.
- `Tesseract.js` è configurato con `cacheMethod: 'none'` per non conservare il modello linguistico nell'IndexedDB.
- I modelli OCR e le librerie sono scaricati dallo **stesso sito Vercel**, non da CDN esterni. L'accesso al sito è soggetto agli usuali log tecnici di hosting.
- I dati temporanei rimangono in RAM/browser e vengono rilasciati alla chiusura/rimozione dalla pagina per quanto tecnicamente possibile.
- La funzione OCR usa la libreria open-source `tesseract.js@5.1.1` (licenza Apache-2.0), `tesseract.js-core@5.1.1`, dataset linguistici `@tesseract.js-data/{ita,eng}` e `pdf-lib@1.17.1` (licenza MIT).

## Stato del collaudo

L'interfaccia HTML/JS e il controllo statico possono essere verificati localmente. L'OCR completo richiede una build `npm install && npm run build` con accesso ai pacchetti npm durante il deployment; testare lo scatto e la creazione OCR sull'iPhone reale dopo il primo deploy. Non è garantita la corrispondenza esatta del testo estratto e nessun OCR è infallibile.

## Nuova interfaccia LUMA — grafica approvata (30 ottobre 2026)

- Identità visiva originale conservata: blu notte `#0A1120`, pannelli `#101B2C`, verde menta `#A8F0BE` e salvia `#93D9B7`.
- Intestazione con l'icona **L + foglio** senza il riquadro scuro. L'icona di installazione sulla Home iPhone resta quella precedente (con scritta PDF).
- Illustrazione dei documenti molto più compatta, **a sinistra del titolo** «Tutto in un solo PDF» anche su smartphone.
- Tre schede sempre visibili: Crea PDF / Unisci PDF / PDF OCR; un solo flusso alla volta.
- Passaggi guidati numerati e compatti. Nome documento sempre richiesto, mai precompilato.
- Orientamento, qualità e gestione A4 mantengono le impostazioni e le avvertenze sui ritagli. Le impostazioni sono chiuse inizialmente, incluse quelle nelle schede Unisci PDF e PDF OCR.
- Finestre popup originali (informazione, conferma, successo, errore e svuotamento) ridisegnate con bordi salvia, sfondo blu notte, icone chiare e pulsanti verde menta.

### File aggiunti e modificati

`redesign.css`, `redesign.js`, `assets/luma-floating-pages.png` e `assets/luma-header-document-l.png` sono nuovi. `index.html` dispone la nuova struttura e mantiene i selettori ID per la compatibilità con i motori JavaScript; `scripts/build.mjs` copia i due nuovi file UI nella cartella `dist`. `README.md` aggiornato. I motori `app.js`, `merge-ui.js`, `ocr-ui.js`, `a4-layout.js` e `pdf-merge-engine.js` non sono stati modificati per il restyling.

**Verifiche:** sintassi JS e integrità strutturale HTML esaminate; la build npm completa e i test funzionali iPhone/Vercel devono essere eseguiti dopo la pubblicazione. Il file standalone di anteprima HTML incluso separatamente è solo una demo grafica, non elabora documenti.
