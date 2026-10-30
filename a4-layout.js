/* LUMA PDF - A4 locale a tutta area, preserva proporzioni (contain) o copre con ritaglio (cover). */
(() => {
  'use strict';
  const SHORT = 595.28, LONG = 841.89;
  function lib() {
    if (!window.PDFLib?.PDFDocument) throw new Error('Motore PDF locale non presente. Verifica la compilazione del progetto su Vercel.');
    return window.PDFLib;
  }
  const bytesFrom = async input => input instanceof Blob ? new Uint8Array(await input.arrayBuffer()) : input;
  async function combinePdfBytes(inputs, sizing = 'contain') {
    const { PDFDocument } = lib();
    const out = await PDFDocument.create();
    let count = 0;
    for (const input of inputs) {
      const bytes = await bytesFrom(input);
      const src = await PDFDocument.load(bytes);
      const originalPages = src.getPages();
      // Importa tutte le pagine in un'unica passata, riducendo memoria e CPU su iPhone.
      const embeddedPages = await out.embedPdf(bytes, originalPages.map((_, i) => i));
      for (let i = 0; i < originalPages.length; i++) {
        const original = originalPages[i];
        const { width, height } = original.getSize();
        if (!(width > 0 && height > 0)) throw new Error('Dimensioni di una pagina PDF non valide.');
        const embedded = embeddedPages[i];
        const landscape = width > height;
        const pw = landscape ? LONG : SHORT;
        const ph = landscape ? SHORT : LONG;
        const factor = (sizing === 'cover' ? Math.max : Math.min)(pw / width, ph / height);
        const scaledW = width * factor, scaledH = height * factor;
        const page = out.addPage([pw, ph]);
        page.drawPage(embedded, { x: (pw - scaledW) / 2, y: (ph - scaledH) / 2, width: scaledW, height: scaledH });
        count++;
      }
    }
    if (!count) throw new Error('Il documento non contiene pagine.');
    const buffer = await out.save({ useObjectStreams: true });
    return new Blob([buffer], { type: 'application/pdf' });
  }
  async function convertPdf(blob, sizing = 'contain') { return combinePdfBytes([blob], sizing); }
  window.LumaA4 = Object.freeze({ combinePdfBytes, convertPdf });
})();
