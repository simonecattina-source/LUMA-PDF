/* LUMA PDF — documento DOCX / TXT / MD in PDF, soltanto nel browser.
 * DOCX: anteprima locale docx-preview -> canvas -> pagine PDF A4.
 * TXT/MD: PDF A4 con testo vettoriale, non interpretazione del Markdown.
 * Non vengono usati servizi di conversione né richieste a siti esterni.
 */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const ui = {
    input: $('docInput'), choose: $('docChoose'), drop: $('docDrop'),
    empty: $('docEmpty'), selected: $('docSelected'), name: $('docFilename'),
    filename: $('docFileName'), fileInfo: $('docFileInfo'),
    count: $('docCount'), summary: $('docSummary'), remove: $('docRemove'),
    preview: $('docPreviewImage'), previewText: $('docPreviewText'),
    off: $('docRenderOff'), generate: $('docGenerate'), label: $('docGenerateLabel'),
    advanced: $('docAdvancedToggle'), settings: $('docAdvancedContent'),
    sizing: $('docSizing'), settingSummary: $('docAdvancedSummary'),
    progress: $('docProgress'), bar: $('docProgressBar'), progressText: $('docProgressText'),
    result: $('docResult')
  };
  if (!ui.input) return;
  let file = null;
  let fileType = null;
  let busy = false;
  let renderReady = false;
  let currentId = 0;
  const a4 = {width:595.28,height:841.89};
  function validName(value) {
    return String(value||'').replace(/\.pdf$/i,'').replace(/[\\/:*?"<>|\x00-\x1f]/g,'-').trim().replace(/[. ]+$/g,'').slice(0,80);
  }
  function formattedSize(bytes) {return bytes < 1048576 ? Math.ceil(bytes / 1024)+' KB' : (bytes / 1048576).toFixed(1).replace('.',',')+' MB';}
  function showResult(message,error=false) {ui.result.hidden=!message;ui.result.textContent=message;ui.result.classList.toggle('error',error);}
  function update() {
    ui.generate.disabled=busy||!file||!renderReady||!validName(ui.name.value);
    for (const item of [ui.choose,ui.input,ui.name,ui.remove,ui.sizing]) item.disabled=busy;
    ui.empty.hidden=!!file;ui.selected.hidden=!file;
    ui.count.textContent=file?'1 documento':'Nessun file';ui.summary.textContent=file?fileType.toUpperCase():'Nessuno';
  }
  function setBusy(next,message) {
    busy=next;
    ui.progress.hidden=!next;
    ui.progressText.textContent=message||'Preparazione...';
    ui.bar.style.width=next?'12%':'0%';
    ui.label.textContent=next?'Conversione in corso...':'Converti e scarica PDF';
    update();
  }
  function clearFile() {
    ++currentId;file=null;fileType=null;renderReady=false;
    ui.off.replaceChildren();ui.preview.removeAttribute('src');ui.preview.hidden=true;
    ui.previewText.hidden=false;showResult('');update();
  }
  function explainError(message) {showResult(message,true);return window.LumaDialog.error('Documento non convertibile',message);}
  function getKind(f) {
    const lower=f.name.toLowerCase();
    if(lower.endsWith('.docx'))return 'docx';
    if(lower.endsWith('.txt'))return 'txt';
    if(lower.endsWith('.md'))return 'md';
    return null;
  }
  async function readyImages(root) {
    const imgs=Array.from(root.querySelectorAll('img'));
    await Promise.all(imgs.map(img => img.complete?Promise.resolve():new Promise(resolve => {img.onload=resolve;img.onerror=resolve;setTimeout(resolve,12000);})))
    if(document.fonts?.ready) await document.fonts.ready;
  }
  function getPages() {
    // docx-preview produce un elemento section.docx per ogni pagina/sezione Word.
    const items=Array.from(ui.off.querySelectorAll('section.docx'));
    if(!items.length)throw new Error('Il documento Word non contiene pagine leggibili.');
    if(items.length>40)throw new Error('Limite di 40 pagine Word raggiunto. Suddividi il documento.');
    return items;
  }
  async function capture(section,scale) {
    if(typeof window.html2canvas!=='function')throw new Error('Motore di rendering non caricato. Controlla la build Vercel.');
    const width=section.scrollWidth||section.clientWidth;
    const height=section.scrollHeight||section.clientHeight;
    if(width*height*scale*scale>30_000_000)throw new Error('Una pagina è troppo grande per la memoria del dispositivo.');
    return window.html2canvas(section,{
      backgroundColor:'#ffffff',scale,logging:false,useCORS:false,
      imageTimeout:12000,scrollX:0,scrollY:-window.scrollY,
      width,height,windowWidth:Math.max(document.documentElement.clientWidth,width+48)
    });
  }
  async function previewDocx() {
    if(!window.docx?.renderAsync)throw new Error('Motore Word non disponibile nella build Vercel.');
    ui.off.replaceChildren();
    await window.docx.renderAsync(file,ui.off,null,{
      inWrapper:true,breakPages:true,ignoreLastRenderedPageBreak:false,
      useBase64URL:true,renderAltChunks:false,renderComments:false,
      renderHeaders:true,renderFooters:true
    });
    const pages=getPages();
    await readyImages(ui.off);
    const mini=await capture(pages[0],0.5);
    // Anteprima usa PNG per non perdere nitidezza sui testi piccoli.
    ui.preview.src=mini.toDataURL('image/png');ui.preview.hidden=false;ui.previewText.hidden=true;
    ui.fileInfo.textContent=`${formattedSize(file.size)} · Word DOCX · ${pages.length} ${pages.length===1?'pagina/sezione':'pagine/sezioni'} rilevate`;
    mini.width=mini.height=1;
  }
  async function previewPlain() {
    const text=await file.text();
    if(text.length>300000)throw new Error('Documento di testo troppo lungo (limite 300.000 caratteri).');
    ui.previewText.textContent=(text.slice(0,1600)||'Documento vuoto')+(text.length>1600?'…':'');
    ui.previewText.hidden=false;ui.preview.hidden=true;
    ui.fileInfo.textContent=formattedSize(file.size)+' · Testo semplice · conversione con testo selezionabile';
  }
  async function chooseFile(f) {
    if(busy||!f)return;
    const kind=getKind(f);
    if(!kind) {await explainError('Questa versione supporta Word .docx e file .txt o .md. Il vecchio formato .doc, Excel e PowerPoint non sono ancora supportati.');return;}
    if(f.size===0||f.size>15*1048576) {await explainError('Seleziona un documento non vuoto di massimo 15 MB.');return;}
    clearFile();const id=currentId;
    file=f;fileType=kind;renderReady=false;
    ui.filename.textContent=f.name;ui.previewText.textContent='Preparazione dell’anteprima locale...';
    ui.previewText.hidden=false;ui.preview.hidden=true;
    ui.name.value='';setBusy(true,'Lettura del documento...');
    try {
      if(kind==='docx')await previewDocx();else await previewPlain();
      if(id!==currentId)return;
      renderReady=true;showResult('Anteprima pronta. Verifica impaginazione e cifre prima di convertire.');
    } catch(e) {
      if(id!==currentId)return;
      clearFile();await explainError('Non è stato possibile leggere il documento: '+(e?.message||'file non valido.'));
    } finally {setBusy(false);}
  }
  ui.choose.addEventListener('click',()=>ui.input.click());
  ui.input.addEventListener('change',event=>{const f=event.target.files?.[0];event.target.value='';void chooseFile(f);});
  ui.remove.addEventListener('click',()=>{if(!busy)clearFile();});
  ui.name.addEventListener('input',update);
  ui.advanced.addEventListener('click',()=>{ui.settings.hidden=!ui.settings.hidden;ui.advanced.setAttribute('aria-expanded',String(!ui.settings.hidden));});
  ui.sizing.addEventListener('change',()=>{ui.settingSummary.textContent=ui.sizing.value==='cover'?'A4 · Pieno con ritaglio':'A4 · Pagina completa';});
  let dragDepth=0;
  ui.drop.addEventListener('dragenter',e=>{if(!e.dataTransfer?.types.includes('Files'))return;e.preventDefault();++dragDepth;ui.drop.classList.add('is-dragging');});
  ui.drop.addEventListener('dragover',e=>{if(!e.dataTransfer?.types.includes('Files'))return;e.preventDefault();e.dataTransfer.dropEffect='copy';});
  ui.drop.addEventListener('dragleave',()=>{dragDepth=Math.max(0,dragDepth-1);if(!dragDepth)ui.drop.classList.remove('is-dragging');});
  ui.drop.addEventListener('drop',e=>{e.preventDefault();dragDepth=0;ui.drop.classList.remove('is-dragging');void chooseFile(e.dataTransfer?.files?.[0]);});
  function normalizeText(s) {
    // PDF StandardFonts: font base compatibili WinAnsi; sostituisci simboli non rappresentabili.
    return s.replace(/\t/g,'    ').replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"')
      .replace(/[\u2013\u2014]/g,'-').replace(/\u2022/g,'*').replace(/\u00a0/g,' ')
      .replace(/[^\x20-\x7e\u00a1-\u00ff\u20ac\n\r]/g,'?');
  }
  function download(pdf,name) {
    const url=URL.createObjectURL(new Blob([pdf],{type:'application/pdf'}));
    const link=document.createElement('a');link.href=url;link.download=name+'.pdf';document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
  async function buildTxtPdf(f) {
    const pdf=await window.PDFLib.PDFDocument.create();
    const font=await pdf.embedFont(window.PDFLib.StandardFonts.Helvetica);
    const fontSize=11, lineHeight=16, margin=44, right=a4.width-margin;
    let page=pdf.addPage([a4.width,a4.height]),y=a4.height-margin-fontSize;
    const lines=normalizeText(await f.text()).split(/\r?\n/);
    let pageCount=1;
    function addText(text) {
      if(y<margin){if(++pageCount>70)throw new Error('Documento troppo lungo (massimo 70 pagine).');page=pdf.addPage([a4.width,a4.height]);y=a4.height-margin-fontSize;}
      if(text)page.drawText(text,{x:margin,y,size:fontSize,font,color:window.PDFLib.rgb(0.07,0.11,0.16)});
      y-=lineHeight;
    }
    const maxTextWidth = right - margin;
    for(const line of lines) {
      if (!line.trim()) { addText(''); continue; }
      // Spezza anche parole, URL e codici privi di spazi, senza perdere caratteri
      // né disegnare testo fuori dalla pagina A4.
      let current = '';
      let lastSpace = -1;
      for (const char of line) {
        const candidate = current + char;
        if (current.length === 0 || font.widthOfTextAtSize(candidate, fontSize) <= maxTextWidth) {
          current = candidate;
          if (char === ' ') lastSpace = current.length - 1;
          continue;
        }
        if (lastSpace > 0) {
          addText(current.slice(0, lastSpace).trimEnd());
          current = (current.slice(lastSpace + 1) + char).trimStart();
        } else {
          addText(current.trimEnd());
          current = char;
        }
        lastSpace = current.lastIndexOf(' ');
      }
      if (current) addText(current.trimEnd());
    }
    return {bytes:await pdf.save(),pages:pageCount};
  }
  async function buildDocxPdf() {
    const pdf=await window.PDFLib.PDFDocument.create();
    const sections=getPages();let total=0;
    for(let i=0;i<sections.length;i++){
      ui.progressText.textContent=`Conversione pagina Word ${i+1} di ${sections.length}...`;
      ui.bar.style.width=(12+76*i/sections.length)+'%';
      await new Promise(resolve=>setTimeout(resolve,10));
      const canvas=await capture(sections[i],1.45);
      const targetH=Math.max(1,Math.round(canvas.width*a4.height/a4.width));
      // Evita che una sezione DOCX insolitamente lunga venga rimpicciolita illeggibilmente.
      const split=canvas.height>targetH*1.18;
      const step=split?targetH:canvas.height;
      for(let top=0;top<canvas.height;top+=step){
        if(++total>70)throw new Error('Troppe pagine per questa conversione (limite 70).');
        const height=Math.min(step,canvas.height-top);
        const tile=document.createElement('canvas');tile.width=canvas.width;tile.height=height;
        const ctx=tile.getContext('2d',{alpha:false});ctx.fillStyle='#fff';ctx.fillRect(0,0,tile.width,tile.height);
        ctx.drawImage(canvas,0,top,canvas.width,height,0,0,canvas.width,height);
        const image=await pdf.embedJpg(tile.toDataURL('image/jpeg',0.94));
        const page=pdf.addPage([a4.width,a4.height]);
        const ratio=ui.sizing.value==='cover'?Math.max(a4.width/tile.width,a4.height/tile.height):Math.min(a4.width/tile.width,a4.height/tile.height);
        const w=tile.width*ratio,h=tile.height*ratio;
        page.drawImage(image,{x:(a4.width-w)/2,y:(a4.height-h)/2,width:w,height:h});
        tile.width=tile.height=1;
      }
      canvas.width=canvas.height=1;
    }
    return {bytes:await pdf.save(),pages:total};
  }
  ui.generate.addEventListener('click',async()=>{
    if(busy||!renderReady||!file||!validName(ui.name.value))return;
    const current=file;
    if(!window.PDFLib?.PDFDocument){await explainError('Libreria PDF non caricata. Verifica il deploy Vercel.');return;}
    setBusy(true,'Preparazione del PDF A4...');showResult('');
    try {
      const result=fileType==='docx'?await buildDocxPdf():await buildTxtPdf(current);
      ui.bar.style.width='100%';
      download(result.bytes,validName(ui.name.value));
      const message=`${result.pages} ${result.pages===1?'pagina A4':'pagine A4'} · Conversione eseguita nel browser. Verifica il PDF scaricato.`;
      showResult(message);await window.LumaDialog.success('Documento convertito!',message);
    } catch(e) {
      const message='Conversione non riuscita. '+(e?.message||'Controlla il documento e riprova.');
      showResult(message,true);await window.LumaDialog.error('Impossibile convertire',message);
    } finally {setBusy(false);}
  });
  window.addEventListener('pagehide',()=>{ui.off.replaceChildren();file=null;});
  update();
})();
