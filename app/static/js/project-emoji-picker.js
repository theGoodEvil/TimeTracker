/** Full, self-hosted emoji/PNG project icon selector. */
import Picker from 'emoji-picker-element/picker.js';
import deI18n from 'emoji-picker-element/i18n/de.js';
import enI18n from 'emoji-picker-element/i18n/en.js';

function initPicker(root) {
  const typeInput = root.querySelector('[data-project-icon-type]');
  const emojiInput = root.querySelector('[data-project-icon-emoji]');
  const manualInput = root.querySelector('[data-project-emoji-manual]');
  const fileInput = root.querySelector('[data-project-icon-file]');
  const emojiPreview = root.querySelector('[data-project-icon-preview-emoji]');
  const imagePreview = root.querySelector('[data-project-icon-preview-image]');
  const placeholder = root.querySelector('[data-project-icon-preview-placeholder]');
  const pickerHost = root.querySelector('[data-project-emoji-picker-host]');
  let objectUrl = null;

  function toggle(element, visible) {
    if (element) element.classList.toggle('hidden', !visible);
  }

  function chooseEmoji(emoji) {
    if (!emoji) return;
    emojiInput.value = emoji;
    manualInput.value = emoji;
    emojiPreview.textContent = emoji;
  }

  function setMode(mode) {
    typeInput.value = mode;
    root.querySelectorAll('[data-project-icon-mode]').forEach((button) => {
      const active = button.dataset.projectIconMode === mode;
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      button.classList.toggle('bg-primary', active);
      button.classList.toggle('text-white', active);
      button.classList.toggle('text-text-muted-light', !active);
      button.classList.toggle('dark:text-text-muted-dark', !active);
    });
    root.querySelectorAll('[data-project-icon-panel]').forEach((panel) => {
      toggle(panel, panel.dataset.projectIconPanel === mode);
    });
    toggle(emojiPreview, mode === 'emoji');
    toggle(imagePreview, mode === 'png' && Boolean(imagePreview?.getAttribute('src')));
    toggle(placeholder, mode === 'none' || (mode === 'png' && !imagePreview?.getAttribute('src')));
  }

  root.querySelectorAll('[data-project-icon-mode]').forEach((button) => {
    button.addEventListener('click', () => setMode(button.dataset.projectIconMode));
  });

  manualInput.addEventListener('input', () => chooseEmoji(manualInput.value.trim()));

  if (fileInput) {
    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = URL.createObjectURL(file);
      imagePreview.setAttribute('src', objectUrl);
      toggle(imagePreview, true);
      toggle(placeholder, false);
    });
  }

  if (pickerHost) {
    const pageLanguage = (document.documentElement.lang || 'en').toLowerCase();
    const isGerman = pageLanguage.startsWith('de');
    const picker = new Picker({
      dataSource: isGerman ? pickerHost.dataset.emojiSourceDe : pickerHost.dataset.emojiSourceEn,
      locale: isGerman ? 'de' : 'en',
      i18n: isGerman ? deI18n : enI18n,
    });
    picker.style.width = '100%';
    picker.style.height = '22rem';
    picker.classList.toggle('dark', document.documentElement.classList.contains('dark'));
    picker.addEventListener('emoji-click', (event) => chooseEmoji(event.detail.unicode));
    pickerHost.appendChild(picker);

    new MutationObserver(() => {
      picker.classList.toggle('dark', document.documentElement.classList.contains('dark'));
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  }

  setMode(typeInput.value || 'emoji');
}

function init() {
  document.querySelectorAll('[data-project-icon-picker]').forEach(initPicker);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();
