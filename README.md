# LUMA PDF — Crea PDF, Unisci PDF, PDF OCR, Convertitore PDF

Applicazione Web **senza server di elaborazione e senza upload dei documenti**. Tutto il lavoro avviene nel browser del dispositivo.

## Modalità

- **Crea PDF:** scatta o carica fotografie e screenshot, modifica l'ordine, ruota, scegli orientamento A4 e qualità. Nome file obbligatorio e inizialmente vuoto.
- **Unisci PDF:** seleziona due o più documenti e uniscili in un PDF. I PDF protetti da password o con strutture particolari possono non essere supportati.
- **Convertitore PDF:** carica un documento Microsoft Word **`.docx`**, testo **`.txt`** o Markdown **`.md`** (trattato come testo semplice), controlla l’anteprima e scarica un PDF **A4**. La conversione DOCX conserva visivamente l’anteprima renderizzata nel browser, ma il testo nel PDF potrebbe non essere selezionabile, e tabelle/grafici complessi possono differire dall’originale. TXT/MD produce testo selezionabile. I formati `.doc`, `.xlsx`, `.pptx`, `.odt` non sono supportati.
- **PDF OCR:** scatta una nuova foto o carica immagini e screenshot, riordina le pagine e genera un PDF con il livello OCR ricercabile (italiano e inglese). Grafiche, tabelle e impaginazione restano visivamente quelle dell'immagine fotografata, **non ricostruite da OCR**. L'OCR può sbagliare cifre, ordine di lettura e caratteri: verificare sempre gli importi delle buste paga.

### Formato A4 in tutte le modalità

L'output è A4 anche per la nuova modalità Convertitore PDF. Due opzioni per la proporzione:

- **Pagina completa senza tagli (predefinito):** massima dimensione all'interno del foglio A4, senza margini aggiunti. Se la proporzione originale non coincide con A4, rimangono inevitabilmente bande bianche.
- **A4 pieno con ritaglio:** riempie completamente la superficie del foglio. Ritaglia le zone esterne quando le proporzioni non coincidono: **non usare per tabelle, buste paga o documenti in cui tutte le cifre devono rimanere visibili**.

Allargare e schiacciare per riempire l'A4 deformerebbe celle e grafici, per questo non viene fatto.

## GitHub + Vercel — IMPORTANTISSIMO

Le modalità OCR e Convertitore PDF richiedono una **compilazione automatica in fase di deploy**, perché il motore OCR WebAssembly, i dati linguistici italiani/inglesi, la libreria PDF e le librerie Word/rendering vengono copiati nel sito. Il browser NON scarica nulla da siti di terze parti: file OCR e PDF sono serviti dal dominio di LUMA PDF.

1. Carica il contenuto della cartella `LUMA_PDF_Web` nella radice del repository, insieme alla cartella `scripts` e a `package.json`.
2. Su Vercel apri il progetto → **Settings → Build and Deployment**.
3. `Framework Preset`: **Other**. `Root Directory`: `./`.
4. `Build Command`: **`npm run build`** (rimuovi eventuale precedente Override vuoto che impedisce la build).
5. `Output Directory`: **`dist`**.
6. `Install Command`: predefinito (**npm install**); non lasciare un override vuoto che impedisca di installare le dipendenze.
7. Esegui **Redeploy** o un nuovo commit su GitHub. Nella build Vercel installerà le librerie npm sul suo server di compilazione e copierà nel sito i modelli OCR e gli strumenti Word DOCX.

**Non è più il vecchio sito statico senza build.** Non caricare direttamente questa versione senza aggiornare le impostazioni Vercel, altrimenti non funzionerà.

## Privacy

- Non vengono richiesti account e i documenti non sono inviati a server per essere elaborati.
- Niente database, telemetria, cookie, localStorage, IndexedDB applicativo o service worker.
- `Tesseract.js` è configurato con `cacheMethod: 'none'` per non conservare il modello linguistico nell'IndexedDB.
- I modelli OCR e le librerie sono scaricati dallo **stesso sito Vercel**, non da CDN esterni. L'accesso al sito è soggetto agli usuali log tecnici di hosting.
- I dati temporanei rimangono in RAM/browser e vengono rilasciati alla chiusura/rimozione dalla pagina per quanto tecnicamente possibile.
- La nuova conversione DOCX usa `docx-preview@0.3.6`, `jszip@3.10.1` e `html2canvas@1.4.1`. Converte localmente e può non mantenere impaginazione o selezionabilità del testo; non utilizzare senza verifica su file dove la fedeltà numerica è critica.
- La funzione OCR usa la libreria open-source `tesseract.js@5.1.1` (licenza Apache-2.0), `tesseract.js-core@5.1.1`, dataset linguistici `@tesseract.js-data/{ita,eng}` e `pdf-lib@1.17.1` (licenza MIT).

## Stato del collaudo

L'interfaccia HTML/JS e il controllo statico possono essere verificati localmente. L'OCR completo richiede una build `npm install && npm run build` con accesso ai pacchetti npm durante il deployment; testare lo scatto e la creazione OCR sull'iPhone reale dopo il primo deploy. Non è garantita la corrispondenza esatta del testo estratto e nessun OCR è infallibile.

## Nuova interfaccia LUMA — grafica approvata (30 ottobre 2026)

- Identità visiva originale conservata: blu notte `#0A1120`, pannelli `#101B2C`, verde menta `#A8F0BE` e salvia `#93D9B7`.
- Intestazione con l'icona **L + foglio** senza il riquadro scuro. L'icona di installazione sulla Home iPhone resta quella precedente (con scritta PDF).
- Illustrazione dei documenti molto più compatta, **a sinistra del titolo** «Tutto in un solo PDF» anche su smartphone.
- Quattro schede sempre visibili: Crea PDF / Unisci PDF / PDF OCR / Convertitore PDF; un solo flusso alla volta.
- Passaggi guidati numerati e compatti. Nome documento sempre richiesto, mai precompilato.
- Orientamento, qualità e gestione A4 mantengono le impostazioni e le avvertenze sui ritagli. Le impostazioni sono chiuse inizialmente, incluse quelle nelle schede Unisci PDF e PDF OCR.
- Finestre popup originali (informazione, conferma, successo, errore e svuotamento) ridisegnate con bordi salvia, sfondo blu notte, icone chiare e pulsanti verde menta.

### File aggiunti e modificati

`redesign.css`, `redesign.js`, `assets/luma-floating-pages.png` e `assets/luma-header-document-l.png` sono nuovi. `index.html` dispone la nuova struttura e mantiene i selettori ID per la compatibilità con i motori JavaScript; `scripts/build.mjs` copia i due nuovi file UI nella cartella `dist`. `README.md` aggiornato. I motori `app.js`, `merge-ui.js`, `ocr-ui.js`, `a4-layout.js` e `pdf-merge-engine.js` non sono stati modificati per il restyling.

**Verifiche:** sintassi JS e integrità strutturale HTML esaminate; la build npm completa e i test funzionali iPhone/Vercel devono essere eseguiti dopo la pubblicazione. Il file standalone di anteprima HTML incluso separatamente è solo una demo grafica, non elabora documenti.

## Nuova funzione «Convertitore PDF» — da collaudare prima dell’uso reale

- Quarta scheda nella grafica approvata, con upload drag-and-drop o selezione documenti, anteprima, nome PDF obbligatorio, impostazioni A4 e popup a tema.
- **DOCX:** il documento viene interpretato tramite `docx-preview` e ogni pagina/sezione viene rasterizzata localmente mediante `html2canvas` e incorporata in un PDF A4 tramite `pdf-lib`. Il PDF risultante riflette l’anteprima del browser, NON necessariamente l’impaginazione esatta di Microsoft Word. Il testo DOCX così convertito **non è normalmente selezionabile o ricercabile**. Le sezioni molto lunghe vengono ripartite su più pagine e possono spezzare una tabella.
- **TXT e MD:** generazione PDF A4 con testo vettoriale selezionabile (Markdown non interpretato). I simboli non supportati dal font di base vengono sostituiti.
- Compatibilità iniziale esclusivamente `.docx`, `.txt`, `.md`. I vecchi `.doc`, `.xlsx`, `.pptx` non vengono accettati e mostrano popup personalizzati.
- Dimensione massima 15 MB; soglie di memoria e pagine per evitare blocchi del browser. Tutto in RAM.
- Sono state verificate la sintassi JavaScript, la struttura HTML e l’integrità dei pacchetti ZIP; NON è stata completata una build npm reale in questo ambiente, né la conversione DOCX su iPhone. Sono necessari test dopo il deploy, soprattutto con documenti complessi.
- `document-convert-ui.js` e `document-convert.css` sono nuovi; `index.html`, `merge-ui.js`, `package.json`, `scripts/build.mjs`, `README.md` aggiornati. Icone Home iOS **inalterate**.


### Verifiche aggiuntive del Convertitore PDF (30/10/2026)

- Corretta la gestione delle righe di testo senza spazi, che in precedenza potevano uscire dai margini A4.
- Consentiti esclusivamente gli stili CSS dinamici richiesti da `docx-preview` (CSP `style-src`), lasciando invariati gli altri divieti di script e rete.
- Verificati in browser (con motori PDF/DOCX simulati) selezione dei file, vincolo del nome, popup, download, formati rifiutati e layout responsive.
- **Da verificare dopo la compilazione Vercel:** reale qualità dei PDF DOCX e TXT, tabelle, paginazione, font, immagini e Safari iPhone. I test simulati non provano la correttezza del PDF finale.


## Excel e PowerPoint → PDF (alta qualità)

Nella scheda **Convertitore PDF**, puoi caricare **`.xlsx` e `.pptx`** oltre a `.docx`, `.txt` e `.md`.
L'elaborazione rimane nel browser, senza servizi di conversione o caricamento di documenti su server.

- **Excel XLSX:** ogni foglio visibile viene impaginato in A4, conservando i valori e molti elementi di formattazione (celle unite, colore, bordi, stili e allineamenti). Il testo viene scritto come **vettore nel PDF**, quindi resta nitido a ogni zoom. Non ricalcola formule: utilizza i valori salvati nel workbook. **Excel contenenti grafici, disegni, immagini o oggetti incorporati sono bloccati** perché non è possibile garantirne una ricostruzione fedele tramite il renderer locale. Esportali direttamente da Excel.
- **PowerPoint PPTX:** ogni diapositiva viene renderizzata localmente in **PNG lossless HD** e posizionata su un foglio A4. Default: pagina completa, proporzioni preservate; opzionale A4 pieno con possibile ritaglio. Alcuni effetti, font, video, 3D o elementi complessi possono variare da PowerPoint.
- **Word DOCX:** la conversione renderizza le pagine in PNG senza compressione con perdita (qualità aumentata, compatibilmente con la memoria del dispositivo). DOCX complessi possono comunque differire dall'originale.
- **TXT e MD:** testo PDF vettoriale, `.md` trattato come testo semplice.
- **Crea PDF, Unisci PDF e PDF OCR:** funzioni già presenti conservate, senza modifica alle icone installate.

### Limiti e affidabilità

La conversione di Microsoft Office eseguita **interamente nel browser** non è equivalente al motore ufficiale di Excel/PowerPoint. I renderer HTML possono gestire in modo diverso font, bordi, layout e contenuti complessi. I file importanti vanno verificati visivamente dopo la conversione. Per XLSX con grafici/disegni, il programma non genera un PDF incompleto: blocca la conversione con un messaggio chiaro.

La build Vercel aggiunge `exceljs` e `@aiden0z/pptx-renderer` come dipendenze installate durante `npm install`; i file serviti dal browser provengono solo dal dominio dell'app.

**Configurazione Vercel:** Framework Other, Build `npm run build`, Output `dist`. La conversione va verificata dopo il deploy con un file reale XLSX e PPTX, incluse anteprime e pagine PDF risultanti.
