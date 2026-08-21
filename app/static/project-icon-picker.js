/** Emoji/PNG project icon selector used by create and edit forms. */
(function () {
  'use strict';

  function initPicker(root) {
    var typeInput = root.querySelector('[data-project-icon-type]');
    var emojiInput = root.querySelector('[data-project-icon-emoji]');
    var fileInput = root.querySelector('[data-project-icon-file]');
    var emojiPreview = root.querySelector('[data-project-icon-preview-emoji]');
    var imagePreview = root.querySelector('[data-project-icon-preview-image]');
    var placeholder = root.querySelector('[data-project-icon-preview-placeholder]');
    var objectUrl = null;

    function toggle(element, visible) {
      if (element) element.classList.toggle('hidden', !visible);
    }

    function setMode(mode) {
      typeInput.value = mode;
      root.querySelectorAll('[data-project-icon-mode]').forEach(function (button) {
        var active = button.dataset.projectIconMode === mode;
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
        button.classList.toggle('bg-primary', active);
        button.classList.toggle('text-white', active);
        button.classList.toggle('text-text-muted-light', !active);
        button.classList.toggle('dark:text-text-muted-dark', !active);
      });
      root.querySelectorAll('[data-project-icon-panel]').forEach(function (panel) {
        toggle(panel, panel.dataset.projectIconPanel === mode);
      });
      toggle(emojiPreview, mode === 'emoji');
      toggle(imagePreview, mode === 'png' && Boolean(imagePreview && imagePreview.getAttribute('src')));
      toggle(placeholder, mode === 'none' || (mode === 'png' && !(imagePreview && imagePreview.getAttribute('src'))));
    }

    root.querySelectorAll('[data-project-icon-mode]').forEach(function (button) {
      button.addEventListener('click', function () { setMode(button.dataset.projectIconMode); });
    });

    root.querySelectorAll('[data-project-emoji]').forEach(function (button) {
      button.addEventListener('click', function () {
        var emoji = button.dataset.projectEmoji;
        emojiInput.value = emoji;
        emojiPreview.textContent = emoji;
        root.querySelectorAll('[data-project-emoji]').forEach(function (choice) {
          var selected = choice === button;
          choice.setAttribute('aria-pressed', selected ? 'true' : 'false');
          choice.classList.toggle('bg-primary/10', selected);
          choice.classList.toggle('ring-1', selected);
          choice.classList.toggle('ring-primary/40', selected);
        });
      });
    });

    if (fileInput) {
      fileInput.addEventListener('change', function () {
        var file = fileInput.files && fileInput.files[0];
        if (!file) return;
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = URL.createObjectURL(file);
        imagePreview.setAttribute('src', objectUrl);
        toggle(imagePreview, true);
        toggle(placeholder, false);
      });
    }

    setMode(typeInput.value || 'emoji');
  }

  function init() {
    document.querySelectorAll('[data-project-icon-picker]').forEach(initPicker);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
