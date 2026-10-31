# Rapporto audit e interventi — LUMA PDF
31 ottobre 2026 · base: LUMA_PDF_EXCEL_POWERPOINT_HD_COMPLETO_GITHUB_VERCEL.zip, ultimo pacchetto preparato. Confronto anche con il repository ZIP inviato precedentemente. **Non prova deploy in produzione.**

## Rischi risolti o ridotti

| Area | Problema | Azione verificata |
|---|---|---|
| Excel | Testo lungo tagliato quando la cella non aveva spazio | Conversione ora interrotta con identificativo cella e messaggio, senza PDF incompleto |
| Excel/TXT | Simboli non WinAnsi sostituiti tacitamente con `?`, incluso `€` in Excel | Accettati i caratteri WinAnsi, compreso `€`; gli altri vengono rifiutati senza output modificato |
| Excel | Valori numerici formattati rappresentati come numeri semplici | Gestione di percentuali, valute e decimali comuni; formati non riproducibili bloccati |
| Excel | Colonne o righe troppo grandi ridotte con clamp senza avviso | Errore visibile per misure oltre i limiti; nessun ridimensionamento silenzioso |
| Word | Taglio arbitrario di una tabella in una sezione lunga | Blocco della conversione in presenza di tabelle su sezioni da dividere |
| PDF Merge | Parser PDF fatto su misura con possibile rischio su file complessi | Sostituito dal motore pdf-lib, limitazione a 500 pagine finali, avviso per annotazioni e moduli |
| PDF A4 | Pagine A4 sempre ridisegnate | Copia pagine già A4 direttamente nel nuovo documento quando possibile; pagine non A4 scalate |
| Immagini | Screenshot PNG sempre ricodificati in JPEG | Con qualità Alta, PNG non ruotati ed entro 3400px incorporati lossless, con limite memoria |
| Office ZIP | Zip bomb e file eccessivamente compressi | Pre-controllo di entry ZIP e dimensioni dichiarate espanse; limiti file e pagine mantenuti |
| PPTX | Errori di rendering di singoli elementi non segnalati | Conversione bloccata se il renderer emette errori sugli elementi della diapositiva |
| Impostazioni | Opzione «A4 con ritaglio» proposta a formati in cui non era applicata | Selettore disabilitato per Excel/TXT/MD, spiegazione a video |
| Sicurezza CSP | Risorse font Office locali potenzialmente bloccate | `font-src` consente solo origine app e blob/data locali, senza accesso di rete |
| Manuale | Informazioni contraddittorie su formati supportati | README riscritto con supporto e limiti effettivi |

## Limiti non risolti integralmente

- Il renderer Word/PowerPoint in browser non replica tutte le funzioni proprietarie di Microsoft Office. Alcuni font, grafici complessi, note, campi o oggetti possono cambiare. Gli output DOCX/PPTX sono PNG ad alta qualità, non testo vettoriale selezionabile.
- I fogli Excel con grafici, disegni o oggetti incorporati non vengono convertiti per evitare omissioni. Le formule possono avere valori in cache obsoleti senza che il browser possa ricalcolarli.
- Il motore OCR può sbagliare importi e testo nelle tabelle pur conservando la pagina visiva.
- I moduli interattivi PDF e le annotazioni possono essere persi nell'adattamento di pagine non A4; la UI avverte. Le pagine già A4 sono copiate invece di ridisegnarle quando possibile.
- Una conversione di documenti Office con caratteri Unicode fuori da WinAnsi richiede in futuro un motore font più ampio; per adesso viene bloccata anziché creare dati alterati.
- Fino al completamento della build reale e di test su Safari non è possibile dichiarare assenza di problemi nella distribuzione.

## Test eseguiti

- Browser Chromium: UI/modalità a 320, 375, 390, 430, 768 e 1280 px; nessun errore JavaScript o overflow orizzontale.
- Browser Chromium: condizioni di nome PDF obbligatorio, pulsanti disabilitati per input incompleto.
- Excel **con motore PDF/Excel simulato**: testo con euro accettato; stringa lunga bloccata; carattere non supportato bloccato. Non prova il contenuto del PDF reale XLSX.
- **Conversione foto PDF reale:** PNG campione inserito tramite upload, PDF creato dal browser, aperto con PyMuPDF: una pagina A4 595,28×841,89 pt e una immagine incorporata.
- Controlli sintattici su tutti gli script `.js`, controllo integrità ZIP e confronto SHA256 di tutte le icone rispetto al pacchetto base.
- Tentativo reale di installazione npm fallito (`EAI_AGAIN`, impossibilità di raggiungere `registry.npmjs.org`). Build OCR/Office e merge pdf-lib non certificati end-to-end.

## Test raccomandati prima di usare documenti importanti

In un deploy di prova: JPG/PNG con dettagli piccoli, PDF multipagina + annotazioni, fotografia OCR in italiano, Word con tabella su più pagine, Excel con valuta/formule/celle unite, Excel con grafici (deve essere bloccato), PowerPoint con immagini e grafici, controllo output A4 e caratteri Euro; verificare soprattutto su Safari iPhone. Conservare una copia della versione funzionante.
