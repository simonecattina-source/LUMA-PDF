/* Controls for the redesign only. Original creation, merging and OCR modules remain untouched. */
(() => {
  'use strict';
  document.querySelectorAll('#panelMerge .advanced-toggle, #panelOcr .advanced-toggle').forEach(button => {
    const region = button.nextElementSibling;
    if (!region || !region.classList.contains('advanced-content')) return;
    const name = button.closest('#panelOcr') ? 'ocr-options' : 'merge-options';
    region.id = name;
    button.setAttribute('aria-controls', name);
    button.addEventListener('click', () => {
      region.hidden = !region.hidden;
      button.setAttribute('aria-expanded', String(!region.hidden));
    });
  });
})();
