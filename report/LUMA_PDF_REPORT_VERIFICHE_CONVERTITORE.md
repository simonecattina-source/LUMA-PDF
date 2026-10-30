# LUMA PDF – Verifiche Convertitore PDF

**Data:** 30 ottobre 2026
**Sorgente:** ultimo pacchetto «LUMA_PDF_CONVERTITORE_PDF_COMPLETO.zip».
**Consegna:** pacchetto correttivo che sostituisce esclusivamente `document-convert-ui.js`, `vercel.json`, `README.md`.

## Risultati effettivamente verificati

| Verifica | Esito | Metodo |
|---|---|---|
| UI convertitore a 320, 375, 390, 1280 px | PASSA | Chromium con librerie PDF/DOCX simulate |
| Navigazione fra quattro modalità | PASSA | Chromium |
| Nome del file obbligatorio, non precompilato | PASSA | Chromium |
| File TXT e MD: lettura e anteprima | PASSA | Chromium; lettura reale con File API |
| DOCX: orchestrazione anteprima/download | PASSA CON SIMULAZIONI | Chromium; `docx-preview`, `html2canvas`, `pdf-lib` sostituiti con mock |
| File `.doc`, vuoti e superiori a 15 MB rifiutati | PASSA | Chromium |
| DOCX con errore di lettura: popup e funzione bloccata | PASSA | Chromium; errore simulato |
| TXT oltre 70 pagine: popup di errore | PASSA | Chromium; motore PDF simulato |
| A4 selezionabile: pagina completa / riempimento | PASSA | Chromium |
| Modalità documento e popup | PASSA | Chromium |
| TXT: parola di 1.200 caratteri senza spazi | CORRETTO E PASSA | Misurazione width/word wrap con font simulato; prima 1.200 caratteri fuori pagina, dopo max 88 caratteri per riga |
| CSS dinamico DOCX bloccato da CSP | CORRETTO E PASSA | Chromium con riproduzione esplicita delle direttive CSP prima/dopo |
| Icone iPhone, favicon, grafica e illustrazione | IDENTICHE | Confronto byte per byte con pacchetto precedente |
| Sintassi JavaScript / JSON Vercel | PASSA | `node --check`, parser JSON |
| Integrità ZIP, riferimenti HTML | PASSA | Verifica CRC e riferimenti locali |

## Test non conclusi: NON considerati superati

- **Installazione npm e build Vercel reale:** il container di prova non riesce a raggiungere `registry.npmjs.org`, quindi non si installano le dipendenze.
- **Conversione reale DOCX in un PDF valido:** non possibile senza `docx-preview`, `html2canvas` e `pdf-lib` installati. Il test con mock non prova fedeltà o integrità del PDF.
- **Conversione reale TXT / MD in PDF valido:** non possibile senza `pdf-lib` installato; confermata solo la logica in browser con mock.
- **Confronto visivo di tabelle, immagini, grafici, intestazioni e paginazione** con Microsoft Word: non certificato.
- **Safari e iPhone reali, memoria e prestazioni OCR:** non testati in questo ambiente.

## Problemi trovati e corretti

1. **Una riga TXT senza spazi usciva dall'A4.** Ora viene spezzata in segmenti la cui larghezza viene verificata usando il font PDF.
2. **La Content Security Policy bloccava gli stili generati da `docx-preview`.** La direttiva è stata modificata in `style-src 'self' 'unsafe-inline'`, lasciando invariati i blocchi degli script e le restrizioni di rete.

## Rischi rimanenti

- I DOCX complessi vengono convertiti in immagini e inseriti in PDF: il testo potrebbe non essere selezionabile, le tabelle potrebbero spezzarsi in modo diverso da Word, e la fedeltà visiva è **non garantita**.
- I formati `.doc`, `.xlsx`, `.pptx` non sono supportati.
- `Markdown .md` viene convertito come testo semplice, senza render Markdown formattato.

**Conclusione:** le due correzioni individuate sono verificate; il convertitore non può essere dichiarato collaudato end-to-end senza installare realmente le dipendenze, eseguire la build Vercel e controllare i PDF prodotti. Non usare come unica copia affidabile di documenti importanti una conversione non verificata.
