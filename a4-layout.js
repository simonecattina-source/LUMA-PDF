/* LUMA PDF — composizione A4 via pdf-lib, solo in memoria. Nessun servizio esterno.
 * Le pagine già in A4 sono copiate senza rasterizzarle né ridisegnarle.
 * Le altre pagine vengono adattate su A4 come contenuto vettoriale; i form
 * interattivi non sono preservabili in modo affidabile durante la scalatura.
 */
(() => {
  'use strict';
  const SHORT=595.28,LONG=841.89,MAX_PAGES=500;
  function lib() {
    if(!window.PDFLib?.PDFDocument)throw new Error('Motore PDF locale non disponibile: verifica il deploy Vercel.');
    return window.PDFLib;
  }
  const bytesFrom=async input => input instanceof Blob?new Uint8Array(await input.arrayBuffer()):input;
  function a4Size(width,height) {
    return width>height?[LONG,SHORT]:[SHORT,LONG];
  }
  const closeTo=(a,b)=>Math.abs(a-b)<0.8;
  async function combinePdfBytes(inputs,sizing='contain') {
    const {PDFDocument}=lib();
    const out=await PDFDocument.create();
    let count=0;
    for(const source of inputs){
      const bytes=await bytesFrom(source);
      const src=await PDFDocument.load(bytes,{updateMetadata:false});
      const pages=src.getPages();
      if(!pages.length)throw new Error('Uno dei PDF non contiene pagine.');
      if(count+pages.length>MAX_PAGES)throw new Error('Troppi fogli: massimo 500 pagine nel PDF finale.');
      let embeddedPages=null;
      for(let i=0;i<pages.length;i++){
        const original=pages[i];
        const {width,height}=original.getSize();
        if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)
          throw new Error('Dimensioni di una pagina PDF non valide.');
        const [pw,ph]=a4Size(width,height);
        // Preserve the entire page structure when the source is already A4.
        const rotation=original.getRotation()?.angle||0;
        if(sizing==='contain'&&closeTo(width,pw)&&closeTo(height,ph)){
          const [copied]=await out.copyPages(src,[i]);
          out.addPage(copied);
        }else{
          // pdf-lib retains original vector page content, not the source AcroForm.
          if(rotation%180!==0)throw new Error('Una pagina PDF ruotata richiede una normalizzazione che potrebbe modificarne l’aspetto. Raddrizza il PDF originale e riprova.');
          if(!embeddedPages)embeddedPages=await out.embedPdf(bytes,pages.map((_,index)=>index));
          const embedded=embeddedPages[i];
          const ratio=(sizing==='cover'?Math.max:Math.min)(pw/width,ph/height);
          const dw=width*ratio,dh=height*ratio;
          const page=out.addPage([pw,ph]);
          page.drawPage(embedded,{x:(pw-dw)/2,y:(ph-dh)/2,width:dw,height:dh});
        }
        count++;
      }
    }
    if(!count)throw new Error('Nessuna pagina disponibile.');
    return new Blob([await out.save({useObjectStreams:true})],{type:'application/pdf'});
  }
  async function convertPdf(blob,sizing='contain'){return combinePdfBytes([blob],sizing);}
  window.LumaA4=Object.freeze({combinePdfBytes,convertPdf});
})();
