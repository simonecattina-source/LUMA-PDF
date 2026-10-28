/*
 * LUMA PDF — applicazione locale, senza librerie esterne.
 * Nessun fetch, XMLHttpRequest, analytics, localStorage, cookie o service worker.
 * Le foto rimangono in memoria e vengono convertite nel browser in JPEG + PDF.
 */
(() => {
  'use strict';

  const MAX_PHOTOS = 60;
  const MAX_SINGLE_SIZE = 30 * 1024 * 1024;
  const MAX_TOTAL_SIZE = 250 * 1024 * 1024;
  const A4_SHORT = 595.28;
  const A4_LONG = 841.89;
  const MARGIN = 18;

  const elements = {
    cameraButton: document.getElementById('cameraButton'),
    galleryButton: document.getElementById('galleryButton'),
    cameraInput: document.getElementById('cameraInput'),
    galleryInput: document.getElementById('galleryInput'),
    addMoreButton: document.getElementById('addMoreButton'),
    clearButton: document.getElementById('clearButton'),
    dropzone: document.getElementById('dropzone'),
    emptyState: document.getElementById('emptyState'),
    photoList: document.getElementById('photoList'),
    pagesFooter: document.getElementById('pagesFooter'),
    pageCount: document.getElementById('pageCount'),
    summaryCount: document.getElementById('summaryCount'),
    filename: document.getElementById('filename'),
    orientation: document.getElementById('orientation'),
    quality: document.getElementById('quality'),
    generateButton: document.getElementById('generateButton'),
    generateLabel: document.getElementById('generateLabel'),
    progressArea: document.getElementById('progressArea'),
    progressBar: document.getElementById('progressBar'),
    progressLabel: document.getElementById('progressLabel'),
    resultMessage: document.getElementById('resultMessage'),
    toast: document.getElementById('toast'),
    modal: document.getElementById('themeModal'),
    modalBackdrop: document.getElementById('themeModalBackdrop'),
    modalPanel: document.getElementById('themeModalPanel'),
    modalIcon: document.getElementById('themeModalIcon'),
    modalTitle: document.getElementById('themeModalTitle'),
    modalBody: document.getElementById('themeModalBody'),
    modalCancel: document.getElementById('themeModalCancel'),
    modalConfirm: document.getElementById('themeModalConfirm')
  };

  /** @type {{id: number, file: File, url: string, width: number, height: number, rotation: number}[]} */
  const photos = [];
  let nextId = 1;
  let generating = false;
  let adding = false;
  let toastTimer = null;
  let downloadUrl = null;
  let downloadRevokeTimer = null;
  let activeModalResolver = null;
  let lastFocusedElement = null;

  const icons = {
    up: '<path d="m5 14 7-7 7 7"/>',
    down: '<path d="m5 10 7 7 7-7"/>',
    rotate: '<path d="M20 11a8 8 0 1 1-2.34-5.66M20 3v6h-6"/>',
    delete: '<path d="M4 7h16M10 3h4M6 7l1 14h10l1-14M10 11v6M14 11v6"/>'
  };

  function iconSvg(markup) {
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${markup}</svg>`;
  }

  function formatBytes(bytes) {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.hidden = false;
    toastTimer = setTimeout(() => { elements.toast.hidden = true; }, 4500);
  }

  function closeModal(result = false) {
    if (elements.modal.hidden) return;
    elements.modal.hidden = true;
    elements.modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    const resolver = activeModalResolver;
    activeModalResolver = null;
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') lastFocusedElement.focus();
    lastFocusedElement = null;
    if (resolver) resolver(result);
  }

  function modalIcon(type) {
    if (type === 'success') return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.2 2.2 4.8-5.2"/></svg>' ;
    if (type === 'error') return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.75 21 19.25H3L12 3.75Z"/><path d="M12 9v4.5"/><circle cx="12" cy="16.5" r="1" fill="currentColor" stroke="none"/></svg>' ;
    if (type === 'confirm') return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="M9 12h6M12 9v6"/></svg>' ;
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 10.5v5"/><circle cx="12" cy="7.5" r="1" fill="currentColor" stroke="none"/></svg>' ;
  }

  function openModal({ type = 'info', title, message, confirmText = 'OK', cancelText = 'Annulla', showCancel = false }) {
    if (activeModalResolver) closeModal(false);
    lastFocusedElement = document.activeElement;
    elements.modal.hidden = false;
    elements.modal.setAttribute('aria-hidden', 'false');
    elements.modalPanel.dataset.variant = type;
    elements.modalIcon.dataset.variant = type;
    elements.modalIcon.innerHTML = modalIcon(type);
    elements.modalTitle.textContent = title;
    elements.modalBody.textContent = message;
    elements.modalCancel.hidden = !showCancel;
    elements.modalCancel.textContent = cancelText;
    elements.modalConfirm.textContent = confirmText;
    document.body.classList.add('modal-open');
    return new Promise(resolve => {
      activeModalResolver = resolve;
      const buttonToFocus = showCancel ? elements.modalCancel : elements.modalConfirm;
      requestAnimationFrame(() => buttonToFocus.focus());
    });
  }

  function showInfoModal(title, message, confirmText = 'OK') {
    return openModal({ type: 'info', title, message, confirmText });
  }

  function showSuccessModal(title, message, confirmText = 'OK') {
    return openModal({ type: 'success', title, message, confirmText });
  }

  function showErrorModal(title, message, confirmText = 'Chiudi') {
    return openModal({ type: 'error', title, message, confirmText });
  }

  function showConfirmModal(title, message, confirmText = 'Conferma', cancelText = 'Annulla') {
    return openModal({ type: 'confirm', title, message, confirmText, cancelText, showCancel: true });
  }

  function setResult(message, error = false) {
    const result = elements.resultMessage;
    if (!message) {
      result.hidden = true;
      result.textContent = '';
      return;
    }
    result.textContent = message;
    result.classList.toggle('error', error);
    result.hidden = false;
  }

  function revokePreviousDownload() {
    if (downloadRevokeTimer) clearTimeout(downloadRevokeTimer);
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    downloadRevokeTimer = null;
    downloadUrl = null;
  }

  function loadImage(objectUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Immagine non leggibile dal browser.'));
      img.src = objectUrl;
    });
  }

  function updateBusyState() {
    const busy = generating || adding;
    const hasName = Boolean(elements.filename.value.trim().replace(/\.pdf$/i, '').trim());
    for (const item of [elements.cameraButton, elements.galleryButton,
      elements.addMoreButton, elements.clearButton,
      elements.filename, elements.orientation, elements.quality]) {
      item.disabled = busy;
    }
    elements.generateButton.disabled = busy || photos.length === 0 || !hasName;
    for (const button of elements.photoList.querySelectorAll('button')) button.disabled = busy || button.dataset.boundary === 'true';
  }

  function render() {
    elements.photoList.replaceChildren();
    elements.emptyState.hidden = photos.length > 0;
    elements.pagesFooter.hidden = photos.length === 0;
    elements.pageCount.textContent = `${photos.length} ${photos.length === 1 ? 'pagina' : 'pagine'}`;
    elements.summaryCount.textContent = `${photos.length}`;

    photos.forEach((item, index) => {
      const li = document.createElement('li');
      li.className = 'photo-card';
      li.draggable = !generating && !adding;
      li.dataset.id = String(item.id);

      const label = document.createElement('span');
      label.className = 'page-index';
      label.textContent = `${index + 1}`;
      label.setAttribute('aria-label', `Pagina ${index + 1}`);
      li.append(label);

      const preview = document.createElement('div');
      preview.className = 'thumb';
      const img = document.createElement('img');
      img.src = item.url;
      img.alt = `Anteprima pagina ${index + 1}`;
      img.draggable = false;
      img.style.transform = `rotate(${item.rotation}deg)`;
      preview.append(img);
      li.append(preview);

      const info = document.createElement('div');
      info.className = 'photo-meta';
      const name = document.createElement('div');
      name.className = 'photo-name';
      name.textContent = item.file.name || `Fotografia ${index + 1}`;
      name.title = item.file.name;
      const details = document.createElement('div');
      details.className = 'photo-sub';
      details.textContent = `${formatBytes(item.file.size)} · ${item.width} × ${item.height}`;
      info.append(name, details);
      li.append(info);

      const tools = document.createElement('div');
      tools.className = 'photo-tools';
      const configs = [
        { key: 'up', title: `Sposta la pagina ${index + 1} su`, boundary: index === 0 },
        { key: 'down', title: `Sposta la pagina ${index + 1} giù`, boundary: index === photos.length - 1 },
        { key: 'rotate', title: `Ruota la pagina ${index + 1} di 90 gradi`, boundary: false },
        { key: 'delete', title: `Elimina la pagina ${index + 1}`, boundary: false }
      ];
      for (const cfg of configs) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `tool-button${cfg.key === 'delete' ? ' delete' : ''}`;
        button.innerHTML = iconSvg(icons[cfg.key]); // icona statica, nessun dato utente inserito come HTML
        button.title = cfg.title;
        button.setAttribute('aria-label', cfg.title);
        button.dataset.action = cfg.key;
        button.dataset.id = String(item.id);
        button.dataset.boundary = String(cfg.boundary);
        button.disabled = generating || adding || cfg.boundary;
        tools.append(button);
      }
      li.append(tools);

      li.addEventListener('dragstart', event => {
        if (generating || adding) return event.preventDefault();
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(item.id));
        li.classList.add('is-dragging');
      });
      li.addEventListener('dragend', () => li.classList.remove('is-dragging'));
      li.addEventListener('dragover', event => {
        if (generating || adding) return;
        event.preventDefault();
        li.classList.add('drag-target');
      });
      li.addEventListener('dragleave', () => li.classList.remove('drag-target'));
      li.addEventListener('drop', event => {
        event.preventDefault();
        li.classList.remove('drag-target');
        if (generating || adding) return;
        // Riordino interno solo se il drag contiene l'ID di una pagina della lista.
        const fromId = Number(event.dataTransfer.getData('text/plain'));
        if (photos.some(photo => photo.id === fromId)) moveTo(fromId, item.id);
      });
      elements.photoList.append(li);
    });
    updateBusyState();
  }

  function moveTo(fromId, targetId) {
    const sourceIndex = photos.findIndex(item => item.id === fromId);
    const targetIndex = photos.findIndex(item => item.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;
    const [item] = photos.splice(sourceIndex, 1);
    photos.splice(targetIndex, 0, item);
    setResult('');
    render();
  }

  function moveRelative(id, offset) {
    const index = photos.findIndex(item => item.id === id);
    if (index < 0 || index + offset < 0 || index + offset >= photos.length) return;
    [photos[index], photos[index + offset]] = [photos[index + offset], photos[index]];
    setResult('');
    render();
  }

  function removePhoto(id) {
    const index = photos.findIndex(item => item.id === id);
    if (index < 0) return;
    URL.revokeObjectURL(photos[index].url);
    photos.splice(index, 1);
    setResult('');
    render();
  }

  function clearPhotos() {
    for (const photo of photos) URL.revokeObjectURL(photo.url);
    photos.length = 0;
    elements.cameraInput.value = '';
    elements.galleryInput.value = '';
    revokePreviousDownload();
    setResult('');
    render();
  }

  function acceptableImage(file) {
    // Evita SVG (può contenere riferimenti esterni): soltanto foto raster.
    if (file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)) return false;
    return /^image\//i.test(file.type) || /\.(jpe?g|png|webp|gif|heic|heif|bmp|tiff?)$/i.test(file.name);
  }

  async function addFiles(fileList) {
    if (adding || generating) return;
    const files = Array.from(fileList || []);
    if (!files.length) return;
    adding = true;
    updateBusyState();
    let added = 0;
    const problems = [];
    try {
      for (const file of files) {
        if (photos.length >= MAX_PHOTOS) { problems.push(`Massimo ${MAX_PHOTOS} fotografie per documento.`); break; }
        if (!acceptableImage(file)) { problems.push('Un file non è una fotografia supportata.'); continue; }
        if (file.size > MAX_SINGLE_SIZE) { problems.push(`File troppo grande: ${file.name} (limite 30 MB).`); continue; }
        const currentTotal = photos.reduce((sum, photo) => sum + photo.file.size, 0);
        if (currentTotal + file.size > MAX_TOTAL_SIZE) { problems.push('Superato il limite complessivo di 250 MB.'); break; }
        const url = URL.createObjectURL(file);
        try {
          const image = await loadImage(url);
          if (!image.naturalWidth || !image.naturalHeight) throw new Error('Dimensioni non valide');
          photos.push({ id: nextId++, file, url, width: image.naturalWidth, height: image.naturalHeight, rotation: 0 });
          added++;
        } catch (_) {
          URL.revokeObjectURL(url);
          problems.push(`Impossibile aprire ${file.name}. Su alcuni browser, le foto HEIC devono essere convertite in JPG.`);
        }
      }
    } finally {
      adding = false;
      render();
    }
    if (added) {
      setResult('');
      showToast(`${added} ${added === 1 ? 'fotografia aggiunta' : 'fotografie aggiunte'} al documento.`);
    }
    if (problems.length) {
      const message = problems.slice(0, 2).join(' ');
      setResult(message, true);
      await showErrorModal('Avviso LUMA PDF', message);
    }
  }

  function canvasToJpeg(canvas, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob && blob.type === 'image/jpeg') resolve(blob);
        else reject(new Error('Il browser non ha potuto convertire una fotografia.'));
      }, 'image/jpeg', quality);
    });
  }

  async function preparePhoto(item, highQuality) {
    const image = await loadImage(item.url);
    const maxSide = highQuality ? 3000 : 2000;
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const w = Math.max(1, Math.round(image.naturalWidth * scale));
    const h = Math.max(1, Math.round(image.naturalHeight * scale));
    const sideways = item.rotation % 180 !== 0;
    const canvas = document.createElement('canvas');
    canvas.width = sideways ? h : w;
    canvas.height = sideways ? w : h;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Impossibile elaborare le immagini sul dispositivo.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate(item.rotation * Math.PI / 180);
    context.drawImage(image, -w / 2, -h / 2, w, h);
    const blob = await canvasToJpeg(canvas, highQuality ? 0.93 : 0.83);
    const width = canvas.width;
    const height = canvas.height;
    // Rilascia il buffer della canvas appena possibile.
    canvas.width = 0;
    canvas.height = 0;
    return { bytes: new Uint8Array(await blob.arrayBuffer()), width, height };
  }

  /* PDF 1.4: scrittura diretta di pagine A4 con immagini JPEG, senza librerie,
     API remote, stampe di sistema o dipendenze da CDN. */
  class PdfWriter {
    constructor(count) {
      this.count = count;
      this.parts = [];
      this.size = 0;
      this.offsets = new Array(4 + count * 3).fill(0);
      this.encoder = new TextEncoder();
      this.add(new Uint8Array([37,80,68,70,45,49,46,52,10,37,226,227,207,211,10]));
      this.object(1, '<< /Type /Catalog /Pages 2 0 R >>');
      const kids = Array.from({ length: count }, (_, i) => `${6 + i * 3} 0 R`).join(' ');
      this.object(2, `<< /Type /Pages /Kids [${kids}] /Count ${count} >>`);
      this.object(3, '<< /Producer (LUMA PDF - elaborazione locale) /Creator (LUMA PDF) >>');
    }
    add(value) {
      const bytes = typeof value === 'string' ? this.encoder.encode(value) : value;
      this.parts.push(bytes);
      this.size += bytes.byteLength;
    }
    begin(id) { this.offsets[id] = this.size; this.add(`${id} 0 obj\n`); }
    end() { this.add('\nendobj\n'); }
    object(id, body) { this.begin(id); this.add(body); this.end(); }
    appendPhoto(index, photo, orientation) {
      const imageId = 4 + index * 3;
      const contentId = imageId + 1;
      const pageId = imageId + 2;
      const landscape = orientation === 'landscape' || (orientation === 'auto' && photo.width > photo.height);
      const pageWidth = landscape ? A4_LONG : A4_SHORT;
      const pageHeight = landscape ? A4_SHORT : A4_LONG;
      const factor = Math.min((pageWidth - 2 * MARGIN) / photo.width,
                              (pageHeight - 2 * MARGIN) / photo.height);
      const drawWidth = photo.width * factor;
      const drawHeight = photo.height * factor;
      const x = (pageWidth - drawWidth) / 2;
      const y = (pageHeight - drawHeight) / 2;
      const n = value => value.toFixed(3);
      this.begin(imageId);
      this.add(`<< /Type /XObject /Subtype /Image /Width ${photo.width} /Height ${photo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${photo.bytes.byteLength} >>\nstream\n`);
      this.add(photo.bytes);
      this.add('\nendstream');
      this.end();
      const commands = `q\n${n(drawWidth)} 0 0 ${n(drawHeight)} ${n(x)} ${n(y)} cm\n/Im0 Do\nQ\n`;
      const contentSize = this.encoder.encode(commands).byteLength;
      this.begin(contentId);
      this.add(`<< /Length ${contentSize} >>\nstream\n`);
      this.add(commands);
      this.add('endstream');
      this.end();
      this.object(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n(pageWidth)} ${n(pageHeight)}] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    }
    finish() {
      const xrefPos = this.size;
      this.add(`xref\n0 ${this.offsets.length}\n0000000000 65535 f \n`);
      for (let id = 1; id < this.offsets.length; id++) {
        this.add(`${String(this.offsets[id]).padStart(10, '0')} 00000 n \n`);
      }
      this.add(`trailer\n<< /Size ${this.offsets.length} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`);
      return new Blob(this.parts, { type: 'application/pdf' });
    }
  }

  function normalizedName(value) {
    return (value || '')
      .replace(/\.pdf$/i, '')
      .replace(/[\\/:*?"<>|\x00-\x1f]/g, '-')
      .trim()
      .replace(/[. ]+$/g, '')
      .slice(0, 80);
  }

  async function createPdf() {
    if (generating || adding || !photos.length || !normalizedName(elements.filename.value)) return;
    generating = true;
    setResult('');
    elements.progressArea.hidden = false;
    elements.progressBar.style.width = '0%';
    elements.generateLabel.textContent = 'Creazione in corso...';
    updateBusyState();
    revokePreviousDownload();
    try {
      const writer = new PdfWriter(photos.length);
      for (let i = 0; i < photos.length; i++) {
        elements.progressLabel.textContent = `Elaborazione fotografia ${i + 1} di ${photos.length}...`;
        elements.progressBar.style.width = `${Math.round(i / photos.length * 100)}%`;
        // Permette di aggiornare la schermata prima del lavoro sulla foto.
        await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
        const jpeg = await preparePhoto(photos[i], elements.quality.value === 'high');
        writer.appendPhoto(i, jpeg, elements.orientation.value);
      }
      elements.progressLabel.textContent = 'Finalizzazione PDF...';
      elements.progressBar.style.width = '100%';
      const pdf = writer.finish();
      const name = `${normalizedName(elements.filename.value)}.pdf`;
      downloadUrl = URL.createObjectURL(pdf);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = name;
      document.body.append(a);
      a.click();
      a.remove();
      downloadRevokeTimer = setTimeout(revokePreviousDownload, 60000);
      const successMessage = `PDF creato: ${photos.length} ${photos.length === 1 ? 'pagina' : 'pagine'} · ${formatBytes(pdf.size)}. Il download è stato richiesto al browser.`;
      setResult(successMessage);
      showToast('PDF creato! Controlla i download del dispositivo.');
      await showSuccessModal('PDF pronto', successMessage, 'Perfetto');
    } catch (error) {
      console.error('Errore PDF (elaborazione locale):', error);
      const errorMessage = `Non è stato possibile creare il PDF. ${error?.message || 'Riprova con meno fotografie o con qualità bilanciata.'}`;
      setResult(errorMessage, true);
      await showErrorModal('Creazione non riuscita', errorMessage);
    } finally {
      generating = false;
      elements.generateLabel.textContent = 'Crea PDF';
      elements.progressArea.hidden = true;
      updateBusyState();
    }
  }

  elements.cameraButton.addEventListener('click', () => elements.cameraInput.click());
  elements.galleryButton.addEventListener('click', () => elements.galleryInput.click());
  elements.addMoreButton.addEventListener('click', () => elements.galleryInput.click());
  elements.cameraInput.addEventListener('change', event => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    addFiles(files);
  });
  elements.galleryInput.addEventListener('change', event => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    addFiles(files);
  });
  elements.clearButton.addEventListener('click', async () => {
    if (generating || adding || !photos.length) return;
    const confirmed = await showConfirmModal(
      'Svuotare il documento?',
      'Le fotografie saranno rimosse dalla memoria di questa pagina e il documento tornerà vuoto.',
      'Svuota tutto',
      'Annulla'
    );
    if (confirmed) clearPhotos();
  });
  elements.photoList.addEventListener('click', event => {
    const button = event.target.closest('button[data-action]');
    if (!button || generating || adding) return;
    const id = Number(button.dataset.id);
    if (button.dataset.action === 'up') moveRelative(id, -1);
    if (button.dataset.action === 'down') moveRelative(id, 1);
    if (button.dataset.action === 'delete') removePhoto(id);
    if (button.dataset.action === 'rotate') {
      const photo = photos.find(item => item.id === id);
      if (photo) { photo.rotation = (photo.rotation + 90) % 360; setResult(''); render(); }
    }
  });
  elements.filename.addEventListener('input', updateBusyState);
  elements.generateButton.addEventListener('click', createPdf);

  // Trascinamento dei file sull'area di importazione; nessuna rete coinvolta.
  let dragDepth = 0;
  elements.dropzone.addEventListener('dragenter', event => {
    if (!event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    dragDepth++;
    elements.dropzone.classList.add('is-dragging');
  });
  elements.dropzone.addEventListener('dragover', event => {
    if (!event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  });
  elements.dropzone.addEventListener('dragleave', () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) elements.dropzone.classList.remove('is-dragging');
  });
  elements.dropzone.addEventListener('drop', event => {
    event.preventDefault();
    dragDepth = 0;
    elements.dropzone.classList.remove('is-dragging');
    if (event.dataTransfer?.files.length) addFiles(event.dataTransfer.files);
  });

  // Evita che trascinare accidentalmente un file fuori dall'area rimpiazzi la pagina.
  document.addEventListener('dragover', event => {
    if (event.dataTransfer?.types.includes('Files')) event.preventDefault();
  });
  document.addEventListener('drop', event => {
    if (event.dataTransfer?.types.includes('Files') && !elements.dropzone.contains(event.target)) event.preventDefault();
  });

  // Evita lo zoom gestuale in Safari su iPhone/iPad e il pinch multi-touch.
  // Il normale scorrimento con un dito e la selezione di foto restano attivi.
  for (const gestureType of ['gesturestart', 'gesturechange']) {
    document.addEventListener(gestureType, event => {
      if (event.cancelable) event.preventDefault();
    }, { passive: false });
  }
  document.addEventListener('touchmove', event => {
    if (event.touches.length > 1 && event.cancelable) event.preventDefault();
  }, { passive: false });

  // Rimuove gli URL temporanei quando il browser lascia la pagina.
  window.addEventListener('pagehide', () => {
    for (const photo of photos) URL.revokeObjectURL(photo.url);
    revokePreviousDownload();
  });

  elements.modalBackdrop.addEventListener('click', event => {
    if (event.target === elements.modalBackdrop) closeModal(false);
  });
  elements.modalCancel.addEventListener('click', () => closeModal(false));
  elements.modalConfirm.addEventListener('click', () => closeModal(true));
  document.addEventListener('keydown', event => {
    if (elements.modal.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeModal(false);
    }
    if (event.key === 'Tab') {
      const focusables = [elements.modalCancel, elements.modalConfirm].filter(button => !button.hidden && !button.disabled);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  window.LumaDialog = Object.freeze({
    info: showInfoModal, success: showSuccessModal, error: showErrorModal, confirm: showConfirmModal
  });
  render();
})();
