# LUMA PDF — app Web privata

LUMA PDF è un’app Web **100% statica** per convertire fotografie in PDF A4 oppure unire due o più PDF in un unico documento. Funziona nei browser di iPhone, iPad, Android e PC.

## Due finestre selezionabili
- **Crea PDF** (aperta all'avvio): scatta o carica fotografie, riordinale e genera il documento.
- **Unisci PDF**: carica due o più PDF, decidi l'ordine, imposta un nome e scarica il file unico.
- In entrambe le modalità il **nome del documento è obbligatorio e parte vuoto**.
- In Crea PDF la sezione **CREA IL DOCUMENTO** comprende le Impostazioni documento richiudibili: orientamento automatico e qualità bilanciata come valori iniziali.
- I titoli dei passaggi sono evidenziati in verde menta con numerazione 01, 02 e 03.

## Funzioni
- Scatto da fotocamera (quando il browser/dispositivo lo consente).
- Caricamento di una o più immagini dalla galleria o dal PC.
- Anteprime, riordino delle pagine, rotazione di 90° ed eliminazione.
- Formato A4 con orientamento automatico, verticale oppure orizzontale.
- Qualità bilanciata o alta; creazione e download del PDF direttamente nel browser.
- Popup di conferma, errore ed esito con grafica LUMA PDF, senza dialoghi standard del browser.
- Zoom gestuale disabilitato dove supportato (pinch e doppio tocco); lo scorrimento resta normale.
- Unione PDF locale senza conversione delle pagine in immagini: per i PDF compatibili preserva testo, vettori e dimensioni delle pagine.
- **Niente account, database, cloud per file, pubblicità, tracciamento, cookie, API esterne o dipendenze da CDN.**

## Dimensioni della pagina e zoom
La pagina si adatta alla larghezza del dispositivo e mantiene la scala iniziale. Su touchscreen viene impedito lo zoom con due dita e quello da doppio tocco, nei limiti consentiti dal browser; iOS/Safari e funzioni di accessibilità possono comunque imporre comportamenti propri. Il font dei campi è almeno 16 px sui dispositivi touch per evitare lo zoom automatico di Safari durante la digitazione. Disattivare lo zoom riduce l’accessibilità per chi ha necessità di ingrandire i contenuti. Lo scorrimento verticale resta attivo.

## Privacy e limiti
- Immagini e PDF sono trattati nella memoria temporanea del browser e **non vengono inviati a server**.
- Non utilizza `localStorage`, `IndexedDB`, cookie, `fetch`, service worker o backend.
- Il PDF salvato dall'utente rimane nella cartella download del suo dispositivo. Le foto originali restano dove si trovavano.
- Browser e sistema operativo possono usare cache o file temporanei fuori dal controllo dell'app. Vercel, essendo l'hosting Web, serve i file della pagina e può conservare log tecnici di accesso al sito, **non le fotografie**.
- Chiudendo/ricaricando la pagina si perde il lavoro in corso: è voluto, per evitare archiviazioni.
- Alcuni formati come HEIC/HEIF dipendono dal supporto del browser. Se non vengono aperti, convertirli in JPG o usare le immagini già convertite dal sistema.
- Limiti di protezione della memoria: 60 immagini (30 MB ciascuna, 250 MB originali complessivi); unione fino a 20 PDF, 100 MB complessivi.
- L’unione supporta PDF standard e PDF con oggetti compressi FlateDecode. I PDF con password, malformati, con filtri non gestiti o costruzioni PDF specialistiche potrebbero non essere unibili; l’app visualizza un popup di errore senza toccare gli originali.
- I file del codice possono essere pubblici su GitHub e la pagina Web pubblica su Vercel. Per accessi privati servirebbe un sistema aggiuntivo, non incluso.

## Struttura
```
index.html
styles.css
app.js
merge-ui.js                 # le due finestre e il caricamento/unione
pdf-merge-engine.js        # motore PDF locale senza servizi esterni
assets/luma-pdf-header-l.png     # sola L, senza scritta PDF: icona intestazione
assets/icon.svg                  # versione precedente, non utilizzata
assets/luma-pdf-apple-180.png     # icona Home iPhone/iPad
assets/luma-pdf-icon-192.png      # icona browser
assets/luma-pdf-icon-512.png      # immagine alta risoluzione
assets/luma-pdf-favicon-32.png    # icona scheda Web
vercel.json
README.md
```
### Icona ufficiale
La nuova icona **LUMA PDF** raffigura un documento luminoso verde menta con una grande L a effetto spray e la scritta PDF. `index.html` usa le immagini locali per la scheda del browser e per la schermata Home di iPhone/iPad. Non sono stati aggiunti manifest, service worker o servizi esterni. La piccola icona accanto al titolo usa invece `assets/luma-pdf-header-l.png` con la sola L spray, come richiesto. `assets/icon.svg` resta solo come vecchia risorsa di backup, ma non è più collegata alla pagina.

Se l'iPhone continua a mostrare la vecchia icona sulla schermata Home, il collegamento precedente potrebbe essere memorizzato da iOS: dopo il deploy, apri l'URL in Safari e aggiungi nuovamente alla schermata Home. LUMA PDF non conserva documenti tra sessioni; assicurati comunque di aver scaricato gli eventuali PDF ancora in lavorazione prima di rimuovere l'icona precedente.

L'app genera il PDF con uno scrittore PDF 1.4 incluso in `app.js`, senza librerie esterne. Supporta JPG, PNG, WebP, GIF e gli altri raster **se il browser riesce a decodificarli**. SVG esclusi per sicurezza.

## Pubblicazione su GitHub e Vercel (senza terminale)
1. Crea su GitHub un **nuovo repository**, distinto dagli altri progetti.
2. **Estrai lo ZIP** fornito: non caricare lo ZIP così com'è.
3. Nel repository scegli **Add file → Upload files**, carica `index.html`, `styles.css`, `app.js`, `merge-ui.js`, `pdf-merge-engine.js`, `vercel.json`, `README.md` e la cartella `assets`, poi fai commit. Se GitHub non permette l'intera cartella, crea prima `assets` o carica il file tramite il percorso `assets/icon.svg`.
4. In Vercel: **Add New → Project → Import Git Repository** e seleziona questo nuovo repo.
5. Se richiesto, imposta **Framework Preset: Other**. Non servono né install command né build command; il sito è statico. Root Directory: `./`. Non impostare una output directory come `dist`: `index.html` è nella root.
6. Fai deploy. Apri l'URL HTTPS di Vercel da iPhone, iPad o PC.

Non ci sono chiavi API, servizi da collegare, variabili d'ambiente o pacchetti da installare. Vercel pubblica automaticamente le modifiche caricate sul branch collegato.

## Test locale
Aprire semplicemente `index.html` può funzionare per alcuni browser, ma è preferibile provare direttamente dal sito HTTPS Vercel per testare fotocamera e download nella modalità reale.

## Nota sui PDF
I PDF uniti restano in memoria temporanea fino al download. Non vengono salvati in una cronologia. I PDF protetti o in formati non supportati vengono segnalati con un popup a tema.

Ogni immagine è adattata alla pagina A4 **senza tagliarne i bordi**, mantenendo le proporzioni. Il PDF risultante contiene immagini JPEG convertite localmente; non viene memorizzato nell'app dopo la chiusura della sessione.
