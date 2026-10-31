# LUMA PDF

LUMA PDF è un'app web per creare, unire, digitalizzare e convertire documenti in PDF, usando il browser del dispositivo. L'interfaccia mantiene la palette originale: blu notte `#0A1120`, pannelli `#101B2C`, menta `#A8F0BE`, salvia `#93D9B7` e verde secondario `#77DCA2`.

## Quattro modalità

1. **Crea PDF:** fotografie e screenshot (JPG, PNG e immagini leggibili dal browser), pagine ordinabili/ruotabili, orientamento automatico/verticale/orizzontale. Qualità bilanciata o alta; **in alta qualità gli screenshot PNG entro 3400 px e senza rotazione sono incorporati senza compressione JPEG**. Gli altri formati vengono elaborati con il codec JPEG. Al massimo 60 immagini, 30 MB ciascuna, 250 MB totali.
2. **Unisci PDF:** da almeno due file PDF, fino a 20 e 100 MB totali. Pagine già A4 copiate direttamente quando si usa «Pagina completa»; le altre pagine adattate su A4 con grafica vettoriale tramite pdf-lib. PDF protetti o non validi rifiutati. Se vengono riconosciuti moduli/annotazioni compare un avviso: l'adattamento A4 potrebbe far perdere elementi interattivi.
3. **PDF OCR:** fotografie e screenshot, OCR italiano/inglese, pagina fotografata conservata visivamente e strato di testo ricercabile. Il testo OCR può contenere errori, soprattutto cifre e tabelle: verificare sempre gli importi. Non ricostruisce o ridisegna tabelle e grafici.
4. **Convertitore PDF:** `.docx`, `.xlsx`, `.pptx`, `.txt`, `.md` **verso** PDF. Non converte PDF verso questi formati. I vecchi `.doc`, `.xls` e `.ppt` non sono supportati. Il nome del PDF è sempre obbligatorio e vuoto inizialmente.

## Fedeltà e limiti importanti

- **DOCX:** la pagina renderizzata dal browser viene inserita nel PDF come PNG; può differire da Word. Il testo non è necessariamente selezionabile. Se una sezione Word molto lunga contiene tabelle e richiede un taglio, la conversione viene interrotta per evitare celle spezzate.
- **XLSX:** testo e bordi nel PDF sono vettoriali; il convertitore gestisce fogli visibili, celle, unioni e diversi formati numerici comuni, compreso il simbolo €. **Non ricalcola formule**: utilizza risultati salvati. Non sono supportati grafici, disegni, immagini e oggetti incorporati; questi file vengono rifiutati per evitare omissioni. Celle illeggibili/troncate, formati numerici non riproducibili e caratteri non rappresentabili causano un errore, non modifiche silenziose al PDF. La suddivisione in fogli A4 ha margini per la leggibilità.
- **PPTX:** le diapositive vengono renderizzate nel browser come PNG ad alta risoluzione e inserite su A4, con proporzioni preservate oppure ritaglio esplicito. Alcuni font, grafici e oggetti Office potrebbero differire da PowerPoint. Se il renderer segnala errori sugli elementi, la conversione viene interrotta. Elementi esterni non vengono scaricati.
- **TXT/MD:** conversione in testo PDF vettoriale; Markdown è trattato come testo semplice. Il font standard PDF copre il repertorio WinAnsi, **non tutti i caratteri Unicode**: i caratteri non supportati vengono rifiutati per evitare sostituzioni errate.
- **A4:** «Pagina completa» mantiene tutte le informazioni ma può lasciare bande vuote; «A4 pieno» può ritagliare i bordi. Excel e testo usano paginazione propria, senza scelta di ritaglio. Non si deformano intenzionalmente le proporzioni per riempire il foglio.

**I documenti importanti richiedono comunque una verifica visiva del PDF creato**, soprattutto buste paga e prospetti finanziari. Nessun convertitore Office interamente nel browser può garantire identità visiva universale con Microsoft Office.

## Privacy e sicurezza

I documenti vengono elaborati nel browser: non è implementato un upload verso server di conversione. I moduli JavaScript, il motore OCR e i dati linguistici sono distribuiti dal dominio della stessa app e incorporati nella build. Non sono implementati login, database, analytics o sincronizzazione remota. La Content Security Policy limita l'origine degli script e delle connessioni. Prima della lettura dei documenti Office sono eseguiti controlli su dimensioni e struttura ZIP; in situazioni complesse il browser può comunque esaurire la memoria disponibile.

## Deploy GitHub / Vercel

1. Carica **tutti i file e le cartelle del progetto** nella radice del repository GitHub.
2. Vercel: **Framework Preset: Other**, **Root Directory: `./`**, **Build Command: `npm run build`**, **Output Directory: `dist`**, dipendenze installate tramite npm.
3. Il comando `npm run build` copia nell'output i file dell'app e le librerie locali da `node_modules`. Le dipendenze NON si trovano già compilate nello ZIP.
4. Dopo il deploy prova i quattro tab, crea un PDF da foto, poi controlla con file di test realistici `.docx`, `.xlsx`, `.pptx` e OCR. L'icona Home iPhone resta quella originale con lettera L, foglio e scritta PDF.
5. Se il repository conserva il vecchio file `pdf-merge-engine.js`, lo puoi eliminare: non viene più caricato o incluso nella build.

## Stato dei test al 31 ottobre 2026

- **Superati:** lint sintattico JavaScript, test UI e navigazione su 320/375/390/430/768/1280 px, nome file obbligatorio, flussi Excel simulati, produzione **reale** di PDF A4 da immagine nel browser, verifica dell'immagine incorporata.
- **Non certificati:** build con dipendenze reali, unione pdf-lib nuova, OCR su Safari iPhone, conversione DOCX/XLSX/PPTX con rendering effettivo. Nell'ambiente di prova il registro npm ha risposto `EAI_AGAIN` (DNS temporaneamente non raggiungibile). I mock verificano chiamate e interfaccia, **non la qualità del PDF reale**.

Per dettagli, vedere il rapporto `AUDIT_LUMA_PDF_2026-10-31.md` allegato al pacchetto completo.
