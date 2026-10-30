/* LUMA PDF — tabs, accordion and local PDF merging. No network or persistent storage. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const el = {
    createTab: $('tabCreate'), mergeTab: $('tabMerge'), ocrTab: $('tabOcr'), createPanel: $('panelCreate'), mergePanel: $('panelMerge'), ocrPanel: $('panelOcr'),
    advancedToggle: $('advancedToggle'), advancedContent: $('advancedContent'), advancedSummary: $('advancedSummary'),
    orientation: $('orientation'), quality: $('quality'),
    sizing: $('mergeSizing'), input: $('mergeInput'), add: $('mergeAddButton'), more: $('mergeAddMore'), drop: $('mergeDrop'),
    list: $('mergeList'), empty: $('mergeEmpty'), footer: $('mergeFooter'), count: $('mergeCount'),
    countSummary: $('mergeSummaryCount'), pageSummary: $('mergePageCount'), name: $('mergeFilename'),
    clear: $('mergeClear'), generate: $('mergeGenerate'), generateLabel: $('mergeGenerateLabel'),
    progress: $('mergeProgress'), progressBar: $('mergeProgressBar'), progressText: $('mergeProgressText'),
    result: $('mergeResult')
  };
  const docs = [];
  let nextId = 1;
  let busy = false;
  let totalBytes = 0;
  const maxDocs = 20;
  const maxTotalBytes = 100 * 1024 * 1024;
  const icons = {
    up: '<path d="m5 14 7-7 7 7"/>', down: '<path d="m5 10 7 7 7-7"/>',
    delete: '<path d="M4 7h16M10 3h4M6 7l1 14h10l1-14M10 11v6M14 11v6"/>'
  };
  const formatBytes = bytes => bytes < 1024 * 1024 ? `${Math.max(1,Math.round(bytes/1024))} KB` : `${(bytes/1048576).toFixed(1).replace('.',',')} MB`;
  function validName(s) {
    return (s || '').replace(/\.pdf$/i,'').replace(/[\\/:*?"<>|\x00-\x1f]/g,'-').trim().replace(/[. ]+$/g,'').slice(0,80);
  }
  function setMode(mode) {
    for (const [name,tab,panel] of [
      ['create',el.createTab,el.createPanel],['merge',el.mergeTab,el.mergePanel],['ocr',el.ocrTab,el.ocrPanel]
    ]) {
      const active = name === mode;
      panel.hidden = !active;
      tab.classList.toggle('is-active',active);
      tab.setAttribute('aria-selected',String(active));
    }
  }
  for (const [name,tab] of [['create',el.createTab],['merge',el.mergeTab],['ocr',el.ocrTab]]) {
    tab.addEventListener('click',()=>setMode(name));
    tab.addEventListener('keydown',evt=>{
      if (!['ArrowLeft','ArrowRight'].includes(evt.key)) return;
      evt.preventDefault();
      const tabs=[el.createTab,el.mergeTab,el.ocrTab];
      const index=tabs.indexOf(tab);
      const next=tabs[(index + (evt.key==='ArrowRight'?1:2)) % tabs.length];
      next.click();next.focus();
    });
  }
  function updateAdvanced() {
    const o = el.orientation.value === 'auto' ? 'Automatico' : el.orientation.value === 'portrait' ? 'Verticale' : 'Orizzontale';
    const q = el.quality.value === 'high' ? 'Qualità alta' : 'Qualità bilanciata';
    el.advancedSummary.textContent = `${o} · ${q}`;
  }
  el.advancedToggle.addEventListener('click', () => {
    const open = el.advancedContent.hidden;
    el.advancedContent.hidden = !open;
    el.advancedToggle.setAttribute('aria-expanded', String(open));
  });
  el.orientation.addEventListener('change', updateAdvanced);
  el.quality.addEventListener('change', updateAdvanced);
  updateAdvanced();

  function updateBusy() {
    el.add.disabled = busy;
    el.more.disabled = busy;
    el.clear.disabled = busy;
    el.input.disabled = busy;
    el.name.disabled = busy;
    el.generate.disabled = busy || docs.length < 2 || !validName(el.name.value);
    for (const button of el.list.querySelectorAll('button')) button.disabled = busy || button.dataset.boundary === 'true';
  }
  function render() {
    el.list.replaceChildren();
    el.empty.hidden = docs.length !== 0;
    el.footer.hidden = docs.length === 0;
    el.count.textContent = `${docs.length} PDF`;
    el.countSummary.textContent = String(docs.length);
    el.pageSummary.textContent = String(docs.reduce((n, d) => n + d.parsed.pageCount, 0));
    docs.forEach((doc,i) => {
      const li=document.createElement('li');
      li.className='merge-item';
      const number=document.createElement('span');number.className='page-index';number.textContent=String(i+1);
      const symbol=document.createElement('span');symbol.className='merge-file-icon';symbol.textContent='PDF';
      const meta=document.createElement('span');meta.className='merge-file-meta';
      const fileName=document.createElement('strong');fileName.className='merge-file-name';fileName.textContent=doc.file.name;fileName.title=doc.file.name;
      const details=document.createElement('small');details.textContent=`${doc.parsed.pageCount} ${doc.parsed.pageCount===1?'pagina':'pagine'} · ${formatBytes(doc.file.size)}`;
      meta.append(fileName,details);
      const tools=document.createElement('span');tools.className='photo-tools merge-tools';
      [{key:'up',boundary:i===0,label:'Sposta su'},{key:'down',boundary:i===docs.length-1,label:'Sposta giù'},{key:'delete',boundary:false,label:'Rimuovi PDF'}].forEach(cfg => {
        const btn=document.createElement('button');btn.type='button';btn.className=`tool-button ${cfg.key==='delete'?'delete':''}`;
        btn.setAttribute('aria-label', `${cfg.label}: ${doc.file.name}`);
        btn.title=`${cfg.label}: ${doc.file.name}`;
        btn.dataset.action=cfg.key;btn.dataset.id=String(doc.id);btn.dataset.boundary=String(cfg.boundary);
        btn.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true">${icons[cfg.key]}</svg>`;
        tools.append(btn);
      });
      li.append(number,symbol,meta,tools);el.list.append(li);
    });
    updateBusy();
  }
  function setResult(text, error=false) {
    el.result.hidden = !text;
    el.result.textContent = text || '';
    el.result.classList.toggle('error',error);
  }
  async function addFiles(files) {
    if (busy) return;
    const list=Array.from(files||[]);
    if (!list.length) return;
    busy = true;updateBusy();
    let added=0;let error='';
    try {
      for (const file of list) {
        if (docs.length >= maxDocs) {error=`Massimo ${maxDocs} PDF per unione.`;break;}
        if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {error='Seleziona soltanto documenti PDF.';continue;}
        if (totalBytes + file.size > maxTotalBytes) {error='Hai raggiunto il limite complessivo di 100 MB.';break;}
        try {
          const parsed=await window.LumaPdfMerge.parsePdf(new Uint8Array(await file.arrayBuffer()));
          docs.push({id:nextId++,file,parsed}); totalBytes+=file.size; added++;
        } catch(e) { error=`${file.name}: ${e?.message||'PDF non supportato.'}`; }
      }
    } finally {busy=false;render();}
    if (added) setResult('');
    if (error) {setResult(error,true);await window.LumaDialog.error('Documento non utilizzabile',error);}
  }
  el.add.addEventListener('click', () => el.input.click());
  el.more.addEventListener('click', () => el.input.click());
  el.input.addEventListener('change', e => {const files=[...e.target.files];e.target.value='';void addFiles(files);});
  el.list.addEventListener('click', e => {
    const btn=e.target.closest('button[data-action]');
    if (!btn || busy) return;
    const at=docs.findIndex(d => d.id === Number(btn.dataset.id));
    if (at<0) return;
    if (btn.dataset.action==='delete') {totalBytes-=docs[at].file.size;docs.splice(at,1);}
    if (btn.dataset.action==='up' && at>0) [docs[at-1],docs[at]]=[docs[at],docs[at-1]];
    if (btn.dataset.action==='down' && at<docs.length-1) [docs[at+1],docs[at]]=[docs[at],docs[at+1]];
    setResult('');render();
  });
  el.name.addEventListener('input', updateBusy);
  el.clear.addEventListener('click',async () => {
    if (busy||!docs.length) return;
    const yes=await window.LumaDialog.confirm('Svuotare i PDF?', 'Rimuoverai tutti i documenti dalla memoria di questa pagina. I file originali rimarranno intatti.', 'Svuota tutto', 'Annulla');
    if (!yes) return;
    docs.length=0;totalBytes=0;setResult('');render();
  });
  let dragging=0;
  el.drop.addEventListener('dragenter',e => {if (!e.dataTransfer?.types.includes('Files'))return;e.preventDefault();dragging++;el.drop.classList.add('is-dragging');});
  el.drop.addEventListener('dragover',e => {if (!e.dataTransfer?.types.includes('Files'))return;e.preventDefault();e.dataTransfer.dropEffect='copy';});
  el.drop.addEventListener('dragleave',() => {dragging=Math.max(0,dragging-1);if(!dragging)el.drop.classList.remove('is-dragging');});
  el.drop.addEventListener('drop',e => {e.preventDefault();dragging=0;el.drop.classList.remove('is-dragging');void addFiles(e.dataTransfer?.files);});
  el.generate.addEventListener('click',async () => {
    if (busy || docs.length<2 || !validName(el.name.value)) return;
    busy=true;setResult('');el.progress.hidden=false;el.progressBar.style.width='20%';el.progressText.textContent='Unione dei documenti in corso...';el.generateLabel.textContent='Unione in corso...';updateBusy();
    try {
      await new Promise(resolve => requestAnimationFrame(()=>setTimeout(resolve,0)));
      const combined=window.LumaPdfMerge.buildMerged(docs.map(d=>d.parsed));
      el.progressText.textContent='Adattamento di tutte le pagine al formato A4...';
      const pdf=await window.LumaA4.convertPdf(combined, el.sizing.value);
      el.progressBar.style.width='100%';
      const url=URL.createObjectURL(pdf);
      const anchor=document.createElement('a');anchor.download=validName(el.name.value)+'.pdf';anchor.href=url;
      document.body.append(anchor);anchor.click();anchor.remove();
      setTimeout(()=>URL.revokeObjectURL(url),60000);
      const pages=docs.reduce((n,d)=>n+d.parsed.pageCount,0);
      const message=`PDF unito: ${pages} ${pages===1?'pagina':'pagine'} · ${formatBytes(pdf.size)}. Download richiesto al browser.`;
      setResult(message);
      await window.LumaDialog.success('PDF unito!',message,'Perfetto');
    } catch(e) {
      const message=`Impossibile unire i documenti. ${e?.message||'Verifica che i PDF non siano protetti.'}`;
      setResult(message,true);
      await window.LumaDialog.error('Unione non riuscita',message);
    } finally {busy=false;el.progress.hidden=true;el.generateLabel.textContent='Unisci e scarica PDF';updateBusy();}
  });
  window.addEventListener('pagehide',()=>{docs.length=0;totalBytes=0;});
  render();
})();
