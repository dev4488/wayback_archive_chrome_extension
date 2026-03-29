/**
 * Options page controller for Wayback Archive Viewer.
 * Reads/writes settings to chrome.storage.sync.
 */

const DEFAULTS = {
  archiveEngine: 'wayback',
  defaultBehavior: 'latest',
  autoOpen: false,
  themeMode: 'system'
};

// ─── DOM ────────────────────────────────────────────────────────────────────
const engineRadios = document.querySelectorAll('input[name="archiveEngine"]');
const radios       = document.querySelectorAll('input[name="defaultBehavior"]');
const toggleAuto   = document.getElementById('toggle-auto-open');
const selectTheme  = document.getElementById('select-theme');
const saveToast    = document.getElementById('save-toast');

// ─── Theme ──────────────────────────────────────────────────────────────────
function applyTheme(mode) {
  if (mode === 'system') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', mode);
  }
}

// ─── Load Settings ──────────────────────────────────────────────────────────
async function loadSettings() {
  const settings = await chrome.storage.sync.get(DEFAULTS);

  // Engine radios
  engineRadios.forEach(r => {
    r.checked = r.value === settings.archiveEngine;
  });

  // Default behavior radios
  radios.forEach(r => {
    r.checked = r.value === settings.defaultBehavior;
  });

  // Auto-open toggle
  toggleAuto.checked = settings.autoOpen;

  // Theme select
  selectTheme.value = settings.themeMode;
  applyTheme(settings.themeMode);
}

// ─── Save Settings ──────────────────────────────────────────────────────────
let toastTimer = null;

function showSaveToast() {
  saveToast.classList.remove('hidden');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    saveToast.classList.add('hidden');
  }, 2000);
}

async function save(key, value) {
  await chrome.storage.sync.set({ [key]: value });
  showSaveToast();
}

// ─── Event Listeners ────────────────────────────────────────────────────────
engineRadios.forEach(radio => {
  radio.addEventListener('change', () => {
    if (radio.checked) {
      save('archiveEngine', radio.value);
    }
  });
});

radios.forEach(radio => {
  radio.addEventListener('change', () => {
    if (radio.checked) {
      save('defaultBehavior', radio.value);
    }
  });
});

toggleAuto.addEventListener('change', () => {
  save('autoOpen', toggleAuto.checked);
});

selectTheme.addEventListener('change', () => {
  const mode = selectTheme.value;
  applyTheme(mode);
  save('themeMode', mode);
});

// ─── Init ───────────────────────────────────────────────────────────────────
loadSettings();
