/* LUMA PDF — conversione offline Excel XLSX / PowerPoint PPTX in PDF A4.
 * XLSX: celle, unioni, formattazione e testo PDF vettoriale, ad alta nitidezza.
 * PPTX: slides renderizzate in-browser, acquisizione HD lossless PNG.
 * I contenuti Office non vengono inviati a servizi remoti. Nessuna ricostruzione fittizia
 * di grafici Excel o altri oggetti non supportati: la conversione viene bloccata.
 */
(() => {
  'use strict';
  const A4 = { w: 595.28, h: 841.89 };
  const MAX_SHEETS = 30, MAX_PAGES = 100, MAX_CELLS = 35000;
  let pptxModulePromise;
  const err = msg => new Error(msg);
  function colorRgb(input, fallback=[0.08,0.13,0.19]) {
    const argb=typeof input==='string'?input:(input?.argb||'');
    const hex=argb.replace(/^#/, '').slice(-6);
    if(!/^[\da-f]{6}$/i.test(hex))return fallback;
    return [0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)/255);
  }
  function textSafe(v) {
    return String(v ?? '').replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"')
      .replace(/[\u2013\u2014]/g,'-').replace(/\u00a0/g,' ')
      .replace(/[\x00-\x08\x0B\x0E-\x1F\u0100-\u2021\u2023-\uFFFF]/g,c => ({'\u2022':'*'})[c]||'?');
  }
  function excelValue(cell) {
    if(cell.type===0) return '';
    if(typeof cell.text==='string' && cell.text) return cell.text;
    const value=cell.value;
    if(value==null)return '';
    if(value instanceof Date)return value.toLocaleDateString('it-IT');
    if(typeof value==='object') {
      if(Array.isArray(value.richText))return value.richText.map(x=>x.text||'').join('');
      if('result' in value)return String(value.result??'#FORMULA SENZA RISULTATO');
      if('text' in value)return String(value.text);
      return '[valore Office non supportato]';
    }
    return String(value);
  }
  function splitText(value,font,size,maxWidth,maxLines) {
    const lines=[];
    for (const paragraph of textSafe(value).replace(/\r/g,'').split('\n')){
      if(!paragraph){lines.push('');continue;}
      let line='';
      for(const ch of paragraph) {
        if(font.widthOfTextAtSize(line+ch,size)<=maxWidth){line+=ch;continue;}
        if(line)lines.push(line);
        line=ch;
        if(lines.length>=maxLines)break;
      }
      if(line && lines.length<maxLines)lines.push(line);
      if(lines.length>=maxLines)break;
    }
    return lines.slice(0,maxLines);
  }
  const hexType = x => (x?.rgb && /^[0-9a-f]{8}$/i.test(x.rgb)) ? x.rgb : (x?.argb||'');
  function vectorColor(pdf,color, fallback){const x=colorRgb(hexType(color),fallback);return pdf.rgb(...x);}
  async function inspectZip(file, kind) {
    if(!window.JSZip) throw err('Lettore Office non disponibile nel sito. Controlla la build Vercel.');
    const zip=await window.JSZip.loadAsync(file);
    const names=Object.keys(zip.files);
    const off = kind==='xlsx' ? ['xl/charts/','xl/drawings/','xl/embeddings/','xl/media/'] : [];
    const found=off.filter(folder=>names.some(n=>n.startsWith(folder) && !n.endsWith('/')));
    return {found, encrypted:names.some(n=>/EncryptedPackage|EncryptionInfo/.test(n))};
  }
  async function excelLoad(file){
    if(!window.ExcelJS?.Workbook) throw err('Motore Excel non disponibile. Controlla che Vercel abbia completato npm run build.');
    const workbook=new window.ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const visible=workbook.worksheets.filter(w => w.state!=='hidden' && w.state!=='veryHidden');
    if(!visible.length) throw err('Nessun foglio Excel visibile.');
    if(visible.length>MAX_SHEETS)throw err('Troppi fogli Excel (massimo 30).');
    let total=0;
    for(const sh of visible){
      const cells=sh.actualRowCount*sh.actualColumnCount;
      total+=cells;
      if(sh.rowCount>2000 || sh.columnCount>120 || total>MAX_CELLS)
        throw err('Foglio Excel troppo grande per il dispositivo. Suddividi il file (massimo 2000 righe, 120 colonne e 35.000 celle complessive).');
      // Il browser non ricalcola formule Excel: un risultato non salvato non va inventato.
      sh.eachRow({includeEmpty:false},row=>row.eachCell({includeEmpty:false},cell=>{
        if(cell.value && typeof cell.value==='object' && 'formula' in cell.value && cell.value.result==null)
          throw err('Excel contiene formule senza risultati salvati. Apri e salva il documento in Excel prima della conversione.');
      }));
    }
    return {workbook,sheets:visible};
  }
  function getMerges(sh) {
    const ranges=[]; const src=sh.model?.merges||[];
    for(const addr of src){
      const [a,b]=addr.split(':');if(!a||!b)continue;
      const from=sh.getCell(a),to=sh.getCell(b);
      ranges.push({r1:from.row,c1:from.col,r2:to.row,c2:to.col});
    }
    return ranges;
  }
  function colWidths(sh,last) {
    return Array.from({length:last},(_,i)=>{
      const col=sh.getColumn(i+1);
      return col.hidden?0:Math.max(28,Math.min(260,(col.width||13)*7.0+8));
    });
  }
  function rowHeights(sh,last) {
    return Array.from({length:last},(_,i)=>{
      const row=sh.getRow(i+1);
      return row.hidden?0:Math.max(20,Math.min(170,(row.height||18)*1.333));
    });
  }
  // Suddivide in fasce di colonne/righe per preservare la leggibilità del testo.
  function chunks(widths,max,totalLength) {
    const out=[];let first=0,acc=0;
    for(let i=0;i<totalLength;i++){
      const w=widths[i];
      if(acc && acc+w>max){out.push([first,i]);first=i;acc=0;}
      acc+=w;
    }
    if(first<totalLength)out.push([first,totalLength]);
    return out;
  }
  function pageSections(sh){
    const ncol=Math.max(1,sh.columnCount),nrow=Math.max(1,sh.rowCount);
    const widths=colWidths(sh,ncol),heights=rowHeights(sh,nrow);
    const byCol=chunks(widths,900,ncol), byRow=chunks(heights,1130,nrow);
    return {widths,heights,byCol,byRow};
  }
  function locateMerge(merges,r,c){return merges.find(m=>r>=m.r1&&r<=m.r2&&c>=m.c1&&c<=m.c2);}
  function drawCell(pdf,page,fonts,cell,x,top,w,h,scale) {
    const fill=cell.fill?.fgColor;
    const paint=cell.fill?.pattern==='solid'&&fill;
    const rgb=pdf.rgb;
    if(paint)page.drawRectangle({x,y:A4.h-top-h,width:w,height:h,color:vectorColor(pdf,fill,[1,1,1])});
    const border=cell.border||{};
    const color=edge=>vectorColor(pdf,edge?.color,[.52,.58,.62]);
    const y=A4.h-top-h;
    if(border.top?.style) page.drawLine({start:{x,y:y+h},end:{x:x+w,y:y+h},color:color(border.top),thickness:.55});
    if(border.bottom?.style)page.drawLine({start:{x,y},end:{x:x+w,y},color:color(border.bottom),thickness:.55});
    if(border.left?.style)page.drawLine({start:{x,y},end:{x,y:y+h},color:color(border.left),thickness:.55});
    if(border.right?.style)page.drawLine({start:{x:x+w,y},end:{x:x+w,y:y+h},color:color(border.right),thickness:.55});
    const txt=excelValue(cell);
    if(!txt)return;
    const font=cell.font?.bold?fonts.bold:fonts.normal;
    const pointSize=Math.max(5.5,Math.min(15,Number(cell.font?.size)||10))*Math.min(1.3,scale*1.23);
    const pad=2.5*scale;
    const lines=splitText(txt,font,pointSize,Math.max(8,w-pad*2),Math.max(1,Math.floor((h-pad*2)/(pointSize*1.13))));
    const lineH=pointSize*1.13;
    const totalH=lines.length*lineH;
    const vert=cell.alignment?.vertical||'middle';
    const offY=vert==='top'?pad:vert==='bottom'?Math.max(pad,h-totalH-pad):Math.max(pad,(h-totalH)/2);
    for(let i=0;i<lines.length;i++){
      const line=lines[i],textW=font.widthOfTextAtSize(line,pointSize);
      const align=cell.alignment?.horizontal||'left';
      const tx=align==='right'?Math.max(x+pad,x+w-pad-textW):align==='center'?Math.max(x+pad,x+(w-textW)/2):x+pad;
      const ty=A4.h-top-offY-(i+1)*lineH+pointSize*.22;
      if(ty<A4.h-top-h)break;
      page.drawText(line,{x:tx,y:ty,font,size:pointSize,color:vectorColor(pdf,cell.font?.color,[.09,.14,.19])});
    }
  }
  async function makeExcelPdf(file,{progress=()=>{}}={}){
    const {sheets}=await excelLoad(file);
    const pdf=await window.PDFLib.PDFDocument.create();
    const normal=await pdf.embedFont(window.PDFLib.StandardFonts.Helvetica);
    const bold=await pdf.embedFont(window.PDFLib.StandardFonts.HelveticaBold);
    let pageCount=0;
    for(let si=0;si<sheets.length;si++){
      const sh=sheets[si],sects=pageSections(sh),merges=getMerges(sh);
      // Una cella unita non può essere spezzata tra due pagine senza perdere struttura.
      for(const m of merges){
        if(sects.byCol.some(([start,end])=>start<m.c2&&end>=m.c1&&end<m.c2) ||
           sects.byRow.some(([start,end])=>start<m.r2&&end>=m.r1&&end<m.r2))
          throw err(`Nel foglio ${sh.name} alcune celle unite attraversano un cambio pagina. Per conservare fedelmente la tabella, riduci la larghezza o l'altezza delle celle nel file Excel.`);
      }
      for(const [rStart,rEnd] of sects.byRow) for(const [cStart,cEnd] of sects.byCol) {
        if(++pageCount>MAX_PAGES) throw err('Documento Excel oltre il limite di 100 pagine A4. Riduci o suddividi il file.');
        const page=pdf.addPage([A4.w,A4.h]);
        const margin=28, availableW=A4.w-margin*2,availableH=A4.h-64;
        const rawW=sects.widths.slice(cStart,cEnd).reduce((a,b)=>a+b,0);
        const rawH=sects.heights.slice(rStart,rEnd).reduce((a,b)=>a+b,0);
        const scale=Math.min(availableW/Math.max(1,rawW),availableH/Math.max(1,rawH),1.5);
        // Notifica foglio/parte con testo vettoriale anziché rasterizzazione sfocata.
        const meta=`${sh.name} · righe ${rStart+1}-${rEnd} · colonne ${cStart+1}-${cEnd}`;
        page.drawText(textSafe(meta).slice(0,100),{x:margin,y:A4.h-19,size:8,font:normal,color:window.PDFLib.rgb(.35,.43,.48)});
        let top=36;
        for(let r=rStart;r<rEnd;r++) {
          const h=sects.heights[r]*scale;if(!h)continue;
          let x=margin;
          for(let c=cStart;c<cEnd;c++){
            const w=sects.widths[c]*scale;if(!w)continue;
            const merge=locateMerge(merges,r+1,c+1);
            if(merge && (r+1!==merge.r1||c+1!==merge.c1)){x+=w;continue;}
            const spanW=merge?sects.widths.slice(c,Math.min(cEnd,merge.c2)).reduce((a,b)=>a+b,0)*scale:w;
            const spanH=merge?sects.heights.slice(r,Math.min(rEnd,merge.r2)).reduce((a,b)=>a+b,0)*scale:h;
            drawCell(window.PDFLib,page,{normal,bold},sh.getCell(r+1,c+1),x,top,spanW,spanH,scale);
            x+=w;
          }
          top+=h;
        }
        progress(Math.min(.97,pageCount/(sheets.length*3+pageCount)),`Excel · ${sh.name} · pagina ${pageCount}`);
        await new Promise(res=>setTimeout(res,0));
      }
    }
    return {bytes:await pdf.save(),pages:pageCount};
  }
  async function loadPowerPoint(file){
    if(!pptxModulePromise)pptxModulePromise=import('./vendor/aiden0z-pptx-renderer.browser.es.js');
    let mod;
    try{mod=await pptxModulePromise;}catch(e){pptxModulePromise=null;throw err('Motore PowerPoint non disponibile nella build Vercel.');}
    const data=await file.arrayBuffer();
    const files=await mod.parseZip(data,mod.RECOMMENDED_ZIP_LIMITS);
    const presentation=mod.buildPresentation(files);
    if(!presentation.slides?.length)throw err('Nessuna diapositiva trovata nel PowerPoint.');
    if(presentation.slides.length>55)throw err('Massimo 55 diapositive per conversione nel browser.');
    return {mod,presentation};
  }
  async function captureSlide(mod,presentation,index,off,scale=2.2){
    if(typeof window.html2canvas!=='function')throw err('Motore immagini HD non disponibile.');
    const handle=mod.renderSlide(presentation,presentation.slides[index],{externalMedia:'block',pdfjs:false,mediaUrlCache:new Map()});
    try{
      off.replaceChildren();
      off.append(handle.element);
      await handle.ready;
      if(document.fonts?.ready)await document.fonts.ready;
      const el=handle.element;
      const width=el.scrollWidth||el.offsetWidth;
      const height=el.scrollHeight||el.offsetHeight;
      if(!width||!height)throw err('Diapositiva PowerPoint senza dimensioni renderizzabili.');
      // A4 HD, in genere >2000 pixel lungo il lato più lungo, limite massimo 20 MP.
      const maxSide=Math.max(width,height);
      const wanted=Math.min(2700/maxSide,3.2);
      const factor=Math.max(1,Math.min(scale,wanted));
      if(width*height*factor*factor>22_000_000)throw err('Diapositiva troppo grande per la memoria del dispositivo.');
      const canvas=await window.html2canvas(el,{backgroundColor:'#ffffff',scale:factor,logging:false,useCORS:false,allowTaint:false,scrollX:0,scrollY:-window.scrollY,width,height});
      return canvas;
    }finally {handle.dispose();off.replaceChildren();}
  }
  function pdfImagePlacement(imgW,imgH,sizing){
    const ratio=sizing==='cover'?Math.max(A4.w/imgW,A4.h/imgH):Math.min(A4.w/imgW,A4.h/imgH);
    return {x:(A4.w-imgW*ratio)/2,y:(A4.h-imgH*ratio)/2,width:imgW*ratio,height:imgH*ratio};
  }
  async function makePptxPdf(file,{off,sizing='contain',progress=()=>{}}={}) {
    const {mod,presentation}=await loadPowerPoint(file);
    const pdf=await window.PDFLib.PDFDocument.create();
    const n=presentation.slides.length;
    for(let i=0;i<n;i++){
      progress((i+1)/(n+1),`PowerPoint · diapositiva ${i+1} di ${n} · HD`);
      await new Promise(res=>setTimeout(res,10));
      const canvas=await captureSlide(mod,presentation,i,off);
      // PNG lossless: bordi delle tabelle e testi non subiscono artefatti JPEG.
      const png=await pdf.embedPng(canvas.toDataURL('image/png'));
      const page=pdf.addPage([A4.w,A4.h]);
      page.drawImage(png,pdfImagePlacement(canvas.width,canvas.height,sizing));
      canvas.width=canvas.height=1;
    }
    return {bytes:await pdf.save(),pages:n};
  }
  async function inspect(file,kind){
    const meta=await inspectZip(file,kind);
    if(meta.encrypted)throw err('Documento Office cifrato o protetto: impossibile convertirlo localmente.');
    if(kind==='xlsx'){
      // Sicurezza di fedeltà: diagrammi/disegni Excel non vengono mai omessi in silenzio.
      if(meta.found.length)throw err('Questo Excel contiene grafici, immagini o oggetti incorporati che non possono essere riprodotti fedelmente dal convertitore locale. Per evitare omissioni, la conversione è bloccata. Esporta il PDF direttamente da Excel per conservare questi elementi.');
      const {sheets}=await excelLoad(file);
      const lines=[];
      for(const sh of sheets.slice(0,4)){
        const values=[];
        for(let r=1;r<=Math.min(sh.rowCount,7);r++) {
          const parts=[];
          for(let c=1;c<=Math.min(sh.columnCount,6);c++)parts.push(excelValue(sh.getCell(r,c)).slice(0,40));
          if(parts.some(Boolean))values.push(parts.join(' | '));
        }
        lines.push(`${sh.name} (${sh.rowCount} righe, ${sh.columnCount} colonne)\n${values.join('\n')}`);
      }
      return {type:'text',description:`Excel XLSX · ${sheets.length} fogli · PDF vettoriale HD (testo selezionabile)`,preview:lines.join('\n\n')||'Fogli Excel vuoti'};
    }
    const {mod,presentation}=await loadPowerPoint(file);
    return {type:'slides',description:`PowerPoint PPTX · ${presentation.slides.length} diapositive · HD PNG senza perdita`,mod,presentation};
  }
  window.LumaOffice=Object.freeze({inspect,makeExcelPdf,makePptxPdf,captureSlide});
})();
