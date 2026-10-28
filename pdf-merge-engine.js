/*
 * LUMA PDF - unione locale di PDF standard; nessuna chiamata di rete.
 * Parser PDF con supporto per oggetti indiretti, stream opachi e ObjStm/FlateDecode.
 * Non interpreta i contenuti grafici: le pagine e risorse originali restano intatte.
 * Limiti: PDF cifrati, filtri degli ObjStm non supportati, struttura corrotta.
 * Il motore evita conversioni in immagine e non salva mai dati sul server.
 */
(() => {
  'use strict';
  // TextDecoder('latin1') is Windows-1252, so decode bytes without altering 0x80..0x9F.
  const decodeLatin1 = bytes => { let s = ''; for(let i=0; i<bytes.length; i+=32768) s += String.fromCharCode(...bytes.subarray(i,i+32768)); return s; };
  const asciiEncoder = new TextEncoder();
  const enc = value => asciiEncoder.encode(value);
  const refRx = /\b(\d+)\s+(\d+)\s+R\b/g;
  const sizeLimit = 100 * 1024 * 1024;

  function pdfValue(text, name) {
    // Extract a PDF name key's value while preserving nested arrays/dictionaries.
    const match = new RegExp(`/${name}(?![A-Za-z0-9_-])\\s*`).exec(text);
    if (!match) return null;
    let i = match.index + match[0].length;
    const start = i;
    if (text.startsWith('<<', i)) {
      let depth = 0;
      let inString = 0;
      while (i < text.length) {
        if (inString) {
          if (text[i] === '\\') { i += 2; continue; }
          if (text[i] === '(') inString++;
          if (text[i] === ')') inString--;
          i++; continue;
        }
        if (text[i] === '(') { inString = 1; i++; continue; }
        if (text.startsWith('<<', i)) { depth++; i += 2; continue; }
        if (text.startsWith('>>', i)) { depth--; i += 2; if (!depth) break; continue; }
        i++;
      }
      return text.slice(start, i);
    }
    if (text[i] === '[') {
      let depth = 0;
      while (i < text.length) {
        if (text[i] === '[') depth++;
        if (text[i] === ']') { depth--; if (!depth) { i++; break; } }
        if (text[i] === '(') {
          i++;
          while (i < text.length && text[i] !== ')') { if (text[i] === '\\') i++; i++; }
        }
        i++;
      }
      return text.slice(start, i);
    }
    const ref = /^(\d+)\s+(\d+)\s+R\b/.exec(text.slice(i));
    if (ref) return ref[0];
    const numberToken = /^[-+]?\d+(?:\.\d+)?(?=[\s\/>\[\]()]|$)/.exec(text.slice(i));
    if (numberToken) return numberToken[0];
    const token = /^[^\s<>\[\]()]+/.exec(text.slice(i));
    return token ? token[0] : null;
  }
  function refNum(value) {
    const match = value && /^(\d+)\s+\d+\s+R$/.exec(value.trim());
    return match ? Number(match[1]) : null;
  }
  const refs = string => [...string.matchAll(refRx)].map(x => Number(x[1]));
  const unsupported = message => { throw new Error(message); };
  function validate(bytes) {
    if (bytes.length < 30 || !decodeLatin1(bytes.slice(0, 1024)).includes('%PDF-')) {
      unsupported('Il file non è un PDF valido.');
    }
  }
  async function inflate(bytes) {
    if (typeof DecompressionStream !== 'function') unsupported('Questo browser non supporta la decompressione necessaria a questo PDF.');
    try {
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
      const reader=stream.getReader(); const parts=[]; let size=0;
      while (true) { const {value,done}=await reader.read(); if (done) break; parts.push(value); size+=value.byteLength; }
      const output=new Uint8Array(size); let offset=0;
      for (const part of parts) { output.set(part,offset); offset+=part.byteLength; }
      return output;
    } catch (err) { console.warn('LUMA PDF decompression', err); unsupported('Impossibile leggere uno stream compresso del documento.'); }
  }
  function rawObjects(bytes) {
    const binary = decodeLatin1(bytes);
    const results = new Map();
    const pattern = /(?:^|[\r\n])\s*(\d+)\s+(\d+)\s+obj\b/g;
    let match;
    while ((match = pattern.exec(binary))) {
      const start = match.index + match[0].length;
      const end = binary.indexOf('endobj', start);
      if (end < 0) break;
      const id = Number(match[1]);
      if (id > 0 && id < 1000000) {
        const body = binary.slice(start, end).trimStart();
        results.set(id, { id, body, generation: Number(match[2]) });
      }
      pattern.lastIndex = end + 6;
    }
    if (!results.size) unsupported('Non riesco a leggere gli oggetti di questo PDF.');
    return results;
  }
  function beforeStream(object) {
    const pos = object.body.search(/\bstream\r?\n/);
    return pos < 0 ? object.body : object.body.slice(0, pos);
  }
  async function unpackObjects(objects) {
    for (const item of [...objects.values()]) {
      const head = beforeStream(item);
      if (!/\/Type\s*\/ObjStm\b/.test(head)) continue;
      const match = /\bstream\r?\n/.exec(item.body);
      if (!match) unsupported('Stream PDF non valido.');
      const start = match.index + match[0].length;
      const end = item.body.lastIndexOf('endstream');
      if (end < start) unsupported('Stream PDF incompleto.');
      const declaredLength = Number(pdfValue(head, 'Length'));
      const dataLength = Number.isInteger(declaredLength) && declaredLength > 0 && declaredLength <= end - start ? declaredLength : end - start;
      const compressed = new Uint8Array(dataLength);
      for (let i = 0; i < compressed.length; i++) compressed[i] = item.body.charCodeAt(start + i) & 255;
      const filter = pdfValue(head, 'Filter');
      if (filter && !/^(\/FlateDecode|\[\s*\/FlateDecode\s*\])$/.test(filter)) unsupported('Questo PDF contiene una compressione non supportata.');
      const raw = filter ? await inflate(compressed) : compressed;
      const decoded = decodeLatin1(raw);
      const n = Number(pdfValue(head, 'N'));
      const first = Number(pdfValue(head, 'First'));
      if (!(n > 0 && Number.isFinite(first) && first < decoded.length && n < 100000)) unsupported('Struttura del PDF compressa non valida.');
      const entries = [...decoded.slice(0, first).matchAll(/(\d+)\s+(\d+)/g)].slice(0, n);
      if (entries.length !== n) unsupported('Indice delle pagine del PDF non leggibile.');
      entries.forEach((entry, index) => {
        const id = Number(entry[1]);
        const a = first + Number(entry[2]);
        const b = index === n - 1 ? decoded.length : first + Number(entries[index + 1][2]);
        if (a < first || b < a || b > decoded.length) unsupported('Oggetto PDF compresso non valido.');
        if (!objects.has(id)) objects.set(id, { id, body: decoded.slice(a, b).trim(), generation: 0 });
      });
    }
  }
  function findPages(objects) {
    const get = id => objects.get(id);
    let catalog;
    for (const item of objects.values()) {
      if (/\/Type\s*\/Catalog\b/.test(beforeStream(item))) catalog = item;
    }
    if (!catalog) unsupported('Il catalogo del PDF non è leggibile.');
    const rootId = refNum(pdfValue(beforeStream(catalog), 'Pages'));
    if (!rootId) unsupported('Impossibile trovare le pagine del PDF.');
    const out = [];
    const seen = new Set();
    function walk(id, depth = 0) {
      if (!id || seen.has(id) || depth > 1000) unsupported('Struttura delle pagine PDF non valida.');
      seen.add(id);
      const item = get(id);
      if (!item) unsupported('Una pagina del PDF non è leggibile.');
      const head = beforeStream(item);
      if (/\/Type\s*\/Page\b/.test(head)) { out.push(id); return; }
      const kids = pdfValue(head, 'Kids');
      if (!kids) unsupported('Elenco delle pagine PDF mancante.');
      for (const child of refs(kids)) walk(child, depth + 1);
    }
    walk(rootId);
    if (!out.length) unsupported('Il PDF non contiene pagine leggibili.');
    return out;
  }
  async function parsePdf(bytes) {
    if (bytes.length > sizeLimit) unsupported('Il documento PDF supera il limite di 100 MB.');
    validate(bytes);
    const text = decodeLatin1(bytes);
    if (/\/Encrypt\s+\d+\s+\d+\s+R\b/.test(text.slice(-8192))) unsupported('I PDF protetti da password non sono supportati.');
    const objects = rawObjects(bytes);
    await unpackObjects(objects);
    const pages = findPages(objects);
    return { objects, pages, pageCount: pages.length };
  }
  function renameRefs(text, mapping) {
    // Never rewrite inside strings, hex strings, streams, comments or names.
    let i = 0, out = '', nesting = 0, hex = false, comment = false;
    while (i < text.length) {
      const c = text[i];
      if (comment) { out += c; i++; if (c === '\n' || c === '\r') comment = false; continue; }
      if (nesting) {
        if (c === '\\') { out += text.slice(i,i+2); i+=2; continue; }
        if (c === '(') nesting++;
        if (c === ')') nesting--;
        out += c; i++; continue;
      }
      if (hex) { if (c === '>') hex = false; out += c; i++; continue; }
      if (c === '%') { comment = true; out += c; i++; continue; }
      if (c === '(') { nesting = 1; out += c; i++; continue; }
      if (c === '<' && text[i+1] === '<') { out += '<<'; i += 2; continue; }
      if (c === '<') { hex = true; out += c; i++; continue; }
      if (c >= '0' && c <= '9' && (i === 0 || !/\d/.test(text[i-1]))) {
        const match = /^(\d+)\s+(\d+)\s+R\b/.exec(text.slice(i));
        if (match) {
          const id = mapping.get(Number(match[1]));
          if (!id) unsupported('Questo PDF contiene riferimenti a oggetti mancanti.');
          out += `${id} 0 R`; i += match[0].length; continue;
        }
      }
      out += c; i++;
    }
    return out;
  }
  function inherit(objects, id, key) {
    const seen = new Set();
    for (let current=id; current && !seen.has(current);) {
      seen.add(current);
      const obj=objects.get(current);
      if (!obj) return null;
      const head=beforeStream(obj);
      const value=pdfValue(head,key);
      if (value) return value;
      current=refNum(pdfValue(head,'Parent'));
    }
    return null;
  }
  function patchPage(object, document, mapping) {
    let head = beforeStream(object);
    const parent = /\/Parent\s+\d+\s+\d+\s+R\b/;
    if (parent.test(head)) head = head.replace(parent, '/Parent __LUMA_ROOT__');
    else head = head.replace(/<<\s*/, '<< /Parent __LUMA_ROOT__ ');
    const originalHead = beforeStream(object);
    const additions = [];
    for (const key of ['Resources','MediaBox','CropBox','Rotate']) {
      if (!pdfValue(originalHead,key)) {
        const inherited = inherit(document.objects,object.id,key);
        if (inherited) additions.push(`/${key} ${inherited}`);
      }
    }
    if (!pdfValue(originalHead,'MediaBox') && !additions.some(x => x.startsWith('/MediaBox'))) unsupported('Una pagina del PDF è priva delle dimensioni.');
    if (additions.length) head = head.replace(/<<\s*/, `<< ${additions.join(' ')} `);
    return renameRefs(head, mapping).replace('/Parent __LUMA_ROOT__','/Parent 2 0 R') + object.body.slice(beforeStream(object).length);
  }
  function latin1Bytes(value) {
    const bytes = new Uint8Array(value.length);
    for (let i=0;i<value.length;i++) bytes[i]=value.charCodeAt(i)&255;
    return bytes;
  }
  function buildMerged(parsedDocs) {
    let nextId = 4;
    const docMappings = parsedDocs.map(doc => {
      const mapping = new Map();
      for (const id of [...doc.objects.keys()].sort((a,b)=>a-b)) mapping.set(id,nextId++);
      return mapping;
    });
    const pageRefs = [];
    const chunks = [];
    let total = 0;
    const offsets = new Array(nextId).fill(0);
    const push = bytes => { chunks.push(bytes); total += bytes.length; };
    const add = str => push(enc(str));
    function object(id, contents) {
      offsets[id]=total;
      add(`${id} 0 obj\n`);
      push(latin1Bytes(contents));
      add('\nendobj\n');
    }
    add('%PDF-1.7\n%LUMA\n');
    for (let d=0; d<parsedDocs.length; d++) {
      const doc=parsedDocs[d], mapping=docMappings[d];
      for (const page of doc.pages) pageRefs.push(`${mapping.get(page)} 0 R`);
      for (const [id,obj] of [...doc.objects].sort(([a],[b])=>a-b)) {
        const body = doc.pages.includes(id) ? patchPage(obj,doc,mapping) : (()=>{
          const pre=beforeStream(obj);
          return renameRefs(pre,mapping)+obj.body.slice(pre.length);
        })();
        object(mapping.get(id),body);
      }
    }
    object(1, '<< /Type /Catalog /Pages 2 0 R >>');
    object(2,`<< /Type /Pages /Kids [${pageRefs.join(' ')}] /Count ${pageRefs.length} >>`);
    object(3, '<< /Producer (LUMA PDF - local merge) /Creator (LUMA PDF) >>');
    const startXref = total;
    add(`xref\n0 ${nextId}\n0000000000 65535 f \n`);
    for (let id=1;id<nextId;id++) add(`${String(offsets[id]).padStart(10,'0')} 00000 n \n`);
    add(`trailer\n<< /Root 1 0 R /Info 3 0 R /Size ${nextId} >>\nstartxref\n${startXref}\n%%EOF\n`);
    return new Blob(chunks,{type:'application/pdf'});
  }
  window.LumaPdfMerge = Object.freeze({parsePdf, buildMerged});
})();
