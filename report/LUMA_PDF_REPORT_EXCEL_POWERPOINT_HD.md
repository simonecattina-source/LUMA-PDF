# LUMA PDF — Excel/PowerPoint → PDF — verifica del 31 ottobre 2026

## Implementazione
- Convertitore PDF ampliato ai formati .xlsx (Excel) e .pptx (PowerPoint), **solo in direzione Office → PDF**.
- Excel XLSX: rendering vettoriale di valori, testo, bordi, riempimenti, allineamenti, celle unite; ogni foglio su una o più pagine A4. Non ricalcola formule; impedisce output con formule prive di risultato salvato. Blocca i workbook con disegni, immagini, grafici o oggetti non riproducibili, anziché ometterli silenziosamente.
- PowerPoint PPTX: renderer locale di diapositive, output PNG senza perdita ad alta risoluzione su pagine A4, conservando proporzioni (modalità A4 pieno può tagliare i bordi). Compatibilità grafica best-effort: font, effetti e oggetti complessi possono differire dalla versione PowerPoint.
- DOCX: rendering PNG ad alta qualità anziché JPEG, più nitido quando la memoria consente.
- Crea PDF da fotografie: aumento del limite lungo lato immagine a 2600 px bilanciata / 3400 px alta qualità, JPEG 0.92 / 0.97. I limiti reali del dispositivo possono ridurre il beneficio.
- PDF OCR: mantiene l'immagine originale e il livello di testo OCR senza cambiamenti al motore.
- Altre modalità, palette e sette asset grafici inclusa l'icona Home iPhone invariati.

## Verifiche eseguite qui
1. Verifica sintassi con `node --check`: tutti gli script in esame validi.
2. UI in Chromium con CSS/JS iniettati e motori vendor assenti: quattro modalità presenti, file .xlsx/.pptx accettati, nome obbligatorio, assenza scroll orizzontale a 320, 375, 390, 768, 1280 px.
3. Flusso XLSX con ExcelJS/PDFLib/ZIP simulati: anteprima, validazione nome, generazione, download richiesto; caso con grafici rifiutato correttamente.
4. Esecuzione dello script di build con dipendenze locali **simulate**: tutti gli asset, inclusi i nuovi bundle Excel/PPTX, copiati nella cartella dist.
5. Confronto byte-per-byte dei sette asset grafici con il precedente pacchetto: identici.

## NON testato / limiti
- Il registro npm non è raggiungibile in questo ambiente (EAI_AGAIN). **Non sono state installate le vere librerie ExcelJS e PPTX renderer**; non è stato possibile eseguire la build reale né produrre un PDF XLSX/PPTX tramite questi motori. I test con mock non dimostrano la fedeltà finale dei PDF.
- Nessun collaudo reale Safari iPhone / Vercel del nuovo modulo.
- Fogli Excel con grafici, disegni, immagini o oggetti incorporati vengono **rifiutati** con errore esplicito, perché questo renderer non offre una conversione fedele di tali contenuti. Per questi file usare l'esportazione PDF ufficiale di Excel.
- Per PowerPoint grafici ed elementi comuni sono trattati dal renderer scelto, ma non si garantisce corrispondenza pixel per pixel con Microsoft PowerPoint; 3D, video, font e effetti complessi possono variare.

## Installazione
Aggiornare su GitHub i file presenti nello ZIP delle sole modifiche mantenendo la struttura; Vercel: Framework Other, Build `npm run build`, Output `dist`. Controllare logs build e output dopo il deploy. Prima di affidare documenti importanti, confrontare almeno un file reale Office con il PDF risultante.
