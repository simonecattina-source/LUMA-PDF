/* LUMA PDF OCR: fotografia/scatto/screenshot -> PDF con immagine e testo invisibile.
   Librerie, worker, WASM e modelli linguistic sono distribuiti dal medesimo dominio.
   NESSUN upload, telemetria o memorizzazione permanente; cacheMethod none. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const e = {
    camera: $('ocrCameraButton'), gallery: $('ocrGalleryButton'), cameraInput: $('ocrCameraInput'), galleryInput: $('ocrGalleryInput'),
    addMore: $('ocrAddMore'), clear: $('ocrClear'), drop: $('ocrDrop'), list: $('ocrList'), empty: $('ocrEmpty'),
    footer: $('ocrFooter'), count: $('ocrCount'), summary: $('ocrSummaryCount'),
    name: $('ocrFilename'), sizing: $('ocrSizing'), generate: $('ocrGenerate'), label: $('ocrGenerateLabel'),
    progress: $('ocrProgress'), bar: $('ocrProgressBar'), status: $('ocrProgressText'), result: $('ocrResult')
  };
  const MAX_ITEMS = 20, MAX_ITEM_SIZE = 30*1024*1024, MAX_TOTAL = 160*1024*1024;
  const items = [];
  let nextId = 1, busy = false, total = 0;
  const icons = {
    up:'<path d="m5 14 7-7 7 7"/>', down:'<path d="m5 10 7 7 7-7"/>',
    del:'<path d="M4 7h16M10 3h4M6 7l1 14h10l1-14M10 11v6M14 11v6"/>'
  };
  const safeName = value => (value||'').replace(/\.pdf$/i,'').replace(/[\\/:*?"<>|\x00-\x1f]/g,'-').trim().replace(/[. ]+$/g,'').slice(0,80);
  const bytesText = n => n > 1048576 ? (n/1048576).toFixed(1).replace('.',',')+' MB' : Math.round(n/1024)+' KB';
  function alertResult(message,error=false) {
    e.result.hidden=!message;
    e.result.textContent=message||'';
    e.result.classList.toggle('error',error);
  }
  function updateButtons() {
    const can = !busy && items.length > 0 && !!safeName(e.name.value);
    e.generate.disabled = !can;
    for(const btn of [e.camera,e.gallery,e.addMore,e.clear,e.cameraInput,e.galleryInput,e.name,e.sizing]) btn.disabled=busy;
    for(const btn of e.list.querySelectorAll('button')) btn.disabled=busy || btn.dataset.boundary==='true';
  }
  function render() {
    e.list.replaceChildren();
    e.empty.hidden=items.length>0;
    e.footer.hidden=items.length===0;
    e.count.textContent=`${items.length} ${items.length===1?'pagina':'pagine'}`;
    e.summary.textContent=String(items.length);
    for(let i=0;i<items.length;i++) {
      const item=items[i];
      const li=document.createElement('li');li.className='merge-item';li.dataset.id=String(item.id);
      const num=document.createElement('span');num.className='page-index';num.textContent=String(i+1);
      const img=document.createElement('img');img.className='ocr-thumb';img.src=item.url;img.alt='Anteprima pagina '+(i+1);
      const details=document.createElement('div');details.className='ocr-file-meta';
      const title=document.createElement('div');title.className='ocr-file-name';title.textContent=item.file.name;
      title.title=item.file.name;
      const size=document.createElement('div');size.className='photo-sub';size.textContent=bytesText(item.file.size);
      details.append(title,size);
      const tools=document.createElement('div');tools.className='merge-tools';
      for(const [action,svg,boundary,label] of [['up',icons.up,i===0,'Sposta su'],['down',icons.down,i===items.length-1,'Sposta giù'],['delete',icons.del,false,'Elimina']]) {
        const b=document.createElement('button');b.type='button';b.className='tool-button'+(action==='delete'?' delete':'');
        b.dataset.action=action;b.dataset.id=String(item.id);b.dataset.boundary=String(boundary);
        b.setAttribute('aria-label',label+' pagina '+(i+1));b.title=label;b.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true">${svg}</svg>`;
        tools.append(b);
      }
      li.append(num,img,details,tools);e.list.append(li);
    }
    updateButtons();
  }
  const validImage = file => file.type !== 'image/svg+xml' && !/\.svg$/i.test(file.name) &&
    (/^image\//.test(file.type) || /\.(jpe?g|png|webp|heic|heif|bmp)$/i.test(file.name));
  function imageLoaded(url) {
    return new Promise((resolve,reject)=>{
      const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Formato immagine non leggibile.'));image.src=url;
    });
  }
  async function add(files) {
    if(busy) return;
    const list=Array.from(files||[]);if(!list.length)return;
    busy=true;updateButtons();let failures=[],added=0;
    try {
      for (const file of list) {
        if (items.length >= MAX_ITEMS) { failures.push('Massimo 20 immagini per documento OCR.');break; }
        if (!validImage(file)) { failures.push('File non supportato: '+file.name);continue; }
        if (file.size>MAX_ITEM_SIZE || total+file.size>MAX_TOTAL) {failures.push('Dimensione immagini oltre il limite previsto.');continue;}
        const url=URL.createObjectURL(file);
        try {const image=await imageLoaded(url); if(!image.naturalWidth||!image.naturalHeight)throw new Error('Immagine vuota.');
          items.push({id:nextId++,file,url});total+=file.size;added++;
        } catch(error) {URL.revokeObjectURL(url);failures.push(file.name+': formato non leggibile.');}
      }
    } finally {busy=false;render();}
    if(added) alertResult('Immagini aggiunte: '+added+'. Pronte per la scansione OCR.');
    if(failures.length) {alertResult(failures.slice(0,2).join(' '),true);await window.LumaDialog.error('Immagine non supportata',failures.slice(0,2).join(' '));}
  }
  function clear() {
    items.forEach(item=>URL.revokeObjectURL(item.url));items.length=0;total=0;
    e.cameraInput.value='';e.galleryInput.value='';alertResult('');render();
  }
  for(const [btn,input] of [[e.camera,e.cameraInput],[e.gallery,e.galleryInput],[e.addMore,e.galleryInput]]) btn.addEventListener('click',()=>input.click());
  for(const input of [e.cameraInput,e.galleryInput]) input.addEventListener('change',event=>{
    const files=Array.from(event.target.files||[]);event.target.value='';void add(files);
  });
  e.name.addEventListener('input',updateButtons);
  e.list.addEventListener('click',event=>{
    const button=event.target.closest('button[data-action]');if(!button||busy)return;
    const index=items.findIndex(x=>x.id===Number(button.dataset.id));if(index<0)return;
    if(button.dataset.action==='delete') {
      URL.revokeObjectURL(items[index].url);total-=items[index].file.size;items.splice(index,1);
    } else if(button.dataset.action==='up' && index>0) {
      [items[index-1],items[index]]=[items[index],items[index-1]];
    } else if(button.dataset.action==='down' && index<items.length-1) {
      [items[index],items[index+1]]=[items[index+1],items[index]];
    }
    alertResult('');render();
  });
  e.clear.addEventListener('click',async()=>{
    if(busy||!items.length)return;
    if(await window.LumaDialog.confirm('Svuotare OCR?','Rimuovere tutte le immagini in memoria? Gli originali resteranno intatti.','Svuota tutto','Annulla'))clear();
  });
  let dragDepth=0;
  e.drop.addEventListener('dragenter',event=>{if(!event.dataTransfer?.types.includes('Files'))return;event.preventDefault();dragDepth++;e.drop.classList.add('is-dragging');});
  e.drop.addEventListener('dragover',event=>{if(!event.dataTransfer?.types.includes('Files'))return;event.preventDefault();event.dataTransfer.dropEffect='copy';});
  e.drop.addEventListener('dragleave',()=>{dragDepth=Math.max(0,dragDepth-1);if(!dragDepth)e.drop.classList.remove('is-dragging');});
  e.drop.addEventListener('drop',event=>{event.preventDefault();dragDepth=0;e.drop.classList.remove('is-dragging');void add(event.dataTransfer?.files);});
  function stage(percent,text) {e.bar.style.width=percent+'%';e.status.textContent=text;}
  e.generate.addEventListener('click',async()=>{
    if(busy||!items.length||!safeName(e.name.value))return;
    busy=true;updateButtons();alertResult('');e.progress.hidden=false;e.label.textContent='Riconoscimento OCR...';stage(0,'Preparazione del motore OCR locale...');
    let worker=null;
    try {
      if(!window.Tesseract?.createWorker || !window.LumaA4 || !window.PDFLib) throw new Error('Motore OCR locale non disponibile: controlla il deploy e la compilazione npm.');
      const local=relative=>new URL(relative,document.baseURI).href;
      worker=await window.Tesseract.createWorker(['ita','eng'],1,{
        workerPath:local('./vendor/worker.min.js'), corePath:local('./vendor/core'),langPath:local('./vendor/lang'),
        cacheMethod:'none',workerBlobURL:false,
        logger:msg=>{if(msg?.status==='recognizing text' && typeof msg.progress==='number'){
          const percent=Math.round((done+msg.progress)/items.length*86);stage(percent,`OCR: pagina ${done+1} di ${items.length}, ${Math.round(msg.progress*100)}%`);
        }}
      });
      await worker.setParameters({preserve_interword_spaces:'1'});
      const pdfPages=[];
      for(let i=0;i<items.length;i++) {
        done=i;stage(Math.round(i/items.length*85),`Riconoscimento pagina ${i+1} di ${items.length}...`);
        const output=await worker.recognize(items[i].url,{}, {pdf:true,text:true});
        const result=output?.data?.pdf;
        if(!result || !result.byteLength) throw new Error('Il riconoscimento non ha prodotto il livello PDF.');
        pdfPages.push(new Uint8Array(result));
      }
      stage(92,'Composizione del documento A4 ricercabile...');
      const pdf=await window.LumaA4.combinePdfBytes(pdfPages,e.sizing.value);
      stage(100,'PDF digitalizzato pronto.');
      const url=URL.createObjectURL(pdf);
      const anchor=document.createElement('a');anchor.href=url;anchor.download=safeName(e.name.value)+'.pdf';document.body.append(anchor);anchor.click();anchor.remove();
      setTimeout(()=>URL.revokeObjectURL(url),60000);
      const msg=`PDF OCR creato: ${items.length} ${items.length===1?'pagina':'pagine'} A4. Download richiesto al browser. Verifica sempre l'OCR di importi e tabelle.`;
      alertResult(msg);await window.LumaDialog.success('PDF OCR pronto',msg,'Perfetto');
    } catch(error) {
      console.error('OCR locale:',error);
      const msg='Impossibile completare la scansione OCR. '+(error?.message||'Prova con meno immagini.');
      alertResult(msg,true);await window.LumaDialog.error('OCR non riuscito',msg);
    } finally {
      if(worker) try {await worker.terminate();} catch(_){ /* stop */ }
      busy=false;e.progress.hidden=true;e.label.textContent='Digitalizza e crea PDF';updateButtons();
    }
  });
  let done=0;
  window.addEventListener('pagehide',clear);
  render();
})();
