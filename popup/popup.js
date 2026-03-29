/**
 * Popup controller for Wayback Archive Viewer.
 */

// ─── DOM References ─────────────────────────────────────────────────────────
const elCurrentUrl    = document.getElementById('current-url');
const elStateLoading  = document.getElementById('state-loading');
const elStateFound    = document.getElementById('state-found');
const elStateNotFound = document.getElementById('state-not-found');
const elStateNotArch  = document.getElementById('state-not-archivable');
const elStateError    = document.getElementById('state-error');
const elStateSaving   = document.getElementById('state-saving');
const elStateSaveOk   = document.getElementById('state-save-success');
const elSnapshotDate  = document.getElementById('snapshot-date');
const elErrorMsg      = document.getElementById('error-message');
const elBtnLatest     = document.getElementById('btn-latest');
const elBtnTimeline   = document.getElementById('btn-timeline');
const elBtnSave       = document.getElementById('btn-save');
const elSettingsBtn   = document.getElementById('settings-btn');
const elDefaultLabel  = document.getElementById('default-mode-label');

const ALL_STATES = [
  elStateLoading, elStateFound, elStateNotFound,
  elStateNotArch, elStateError, elStateSaving, elStateSaveOk
];

// ─── State Management ───────────────────────────────────────────────────────
let currentTabUrl = null;
let currentSnapshot = null;
let currentEngine = 'wayback';

function showState(stateEl) {
  ALL_STATES.forEach(el => el.classList.add('hidden'));
  stateEl.classList.remove('hidden');
}

function enableActions(snapshot) {
  elBtnLatest.disabled   = !snapshot;
  elBtnTimeline.disabled = false;
  elBtnSave.disabled     = false;
}

function disableActions() {
  elBtnLatest.disabled   = true;
  elBtnTimeline.disabled = true;
  elBtnSave.disabled     = true;
}

// ─── Theme Application ─────────────────────────────────────────────────────
async function applyTheme() {
  const { themeMode } = await chrome.storage.sync.get({ themeMode: 'system' });
  if (themeMode === 'system') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', themeMode);
  }
}

// ─── Default Mode Indicator ─────────────────────────────────────────────────
async function updateDefaultIndicator() {
  const { defaultBehavior, archiveEngine } = await chrome.storage.sync.get({ 
    defaultBehavior: 'latest', 
    archiveEngine: 'wayback' 
  });
  
  currentEngine = archiveEngine;

  if (defaultBehavior === 'timeline') {
    elDefaultLabel.textContent = 'Default: Open archive timeline';
    elBtnTimeline.classList.add('is-default');
    elBtnLatest.classList.remove('is-default');
  } else {
    elDefaultLabel.textContent = 'Default: Open latest snapshot';
    elBtnLatest.classList.add('is-default');
    elBtnTimeline.classList.remove('is-default');
  }
}

// ─── Core Logic ─────────────────────────────────────────────────────────────

/** Check if URL is archivable (mirrors lib/url-utils.js logic without imports) */
function isArchivable(url) {
  if (!url) return false;
  if (!url.startsWith('http://') && !url.startsWith('https://')) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (['localhost', '127.0.0.1', '0.0.0.0', '[::1]'].includes(host)) return false;
    if (host.endsWith('.local')) return false;
  } catch { return false; }
  return true;
}

async function init() {
  await applyTheme();
  await updateDefaultIndicator();

  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) {
    showState(elStateNotArch);
    return;
  }

  currentTabUrl = tab.url;

  // Display truncated URL
  try {
    const parsed = new URL(tab.url);
    elCurrentUrl.textContent = parsed.hostname + parsed.pathname;
    elCurrentUrl.title = tab.url;
  } catch {
    elCurrentUrl.textContent = tab.url;
    elCurrentUrl.title = tab.url;
  }

  // Can we archive this URL?
  if (!isArchivable(tab.url)) {
    showState(elStateNotArch);
    return;
  }

  // Fetch snapshot
  await fetchSnapshot(tab.url);
}

async function fetchSnapshot(url) {
  showState(elStateLoading);
  disableActions();

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'getSnapshot',
      url: url,
      archiveEngine: currentEngine
    });

    if (response?.success && response.snapshot) {
      currentSnapshot = response.snapshot;

      // Format timestamp
      const tsResp = await chrome.runtime.sendMessage({
        action: 'formatTimestamp',
        timestamp: response.snapshot.timestamp
      });
      elSnapshotDate.textContent = tsResp?.formatted || response.snapshot.timestamp;

      showState(elStateFound);
      
      if (currentEngine === 'archiveIs') {
        elBtnLatest.textContent = 'Open in Archive.is';
      } else {
        elBtnLatest.textContent = 'Open Latest Snapshot';
      }

      enableActions(true);

      // Check auto-open preference
      const { autoOpen, defaultBehavior } = await chrome.storage.sync.get({
        autoOpen: false,
        defaultBehavior: 'latest'
      });

      if (autoOpen) {
        if (defaultBehavior === 'timeline') {
          openTimeline();
        } else {
          openLatest();
        }
      }
    } else if (response?.success && !response.snapshot) {
      showState(elStateNotFound);
      // Enable timeline and save even when no snapshot found
      elBtnLatest.disabled = true;
      elBtnTimeline.disabled = false;
      elBtnSave.disabled = false;
    } else {
      showError(response?.error || 'Failed to check archive.');
    }
  } catch (error) {
    showError(error.message || 'Could not connect to the archive service.');
  }
}

function showError(message) {
  // Make the error message user-friendly
  if (message.includes('AbortError') || message.includes('timed out')) {
    elErrorMsg.textContent = 'Request timed out — the archive service may be busy.';
  } else if (message.includes('unavailable')) {
    elErrorMsg.textContent = message;
  } else if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
    elErrorMsg.textContent = 'Network error — check your internet connection.';
  } else {
    elErrorMsg.textContent = message;
  }
  showState(elStateError);
  // Always enable timeline and save/archive buttons on error
  elBtnLatest.disabled = true;
  elBtnTimeline.disabled = false;
  elBtnSave.disabled = false;
}

// ─── Actions ────────────────────────────────────────────────────────────────
function openLatest() {
  if (currentSnapshot?.url) {
    chrome.tabs.create({ url: currentSnapshot.url });
    window.close();
  }
}

function openTimeline() {
  if (!currentTabUrl) return;
  chrome.runtime.sendMessage(
    { action: 'getTimelineUrl', url: currentTabUrl, archiveEngine: currentEngine },
    (resp) => {
      if (resp?.url) {
        chrome.tabs.create({ url: resp.url });
        window.close();
      }
    }
  );
}

async function archivePage() {
  if (!currentTabUrl) return;

  showState(elStateSaving);
  disableActions();

  try {
    const result = await chrome.runtime.sendMessage({
      action: 'saveToArchive',
      url: currentTabUrl,
      archiveEngine: currentEngine
    });

    if (result?.success) {
      if (result.newTabRequired && result.archiveUrl) {
        chrome.tabs.create({ url: result.archiveUrl });
        window.close();
      } else {
        showState(elStateSaveOk);
      }
    } else {
      elErrorMsg.textContent = result?.error || 'Failed to archive page.';
      showState(elStateError);
    }
  } catch (error) {
    elErrorMsg.textContent = error.message;
    showState(elStateError);
  }

  // Re-enable some buttons
  elBtnTimeline.disabled = false;
  elBtnSave.disabled = false;
}

// ─── Event Listeners ────────────────────────────────────────────────────────

elBtnLatest.addEventListener('click', openLatest);
elBtnTimeline.addEventListener('click', openTimeline);
elBtnSave.addEventListener('click', archivePage);

elSettingsBtn.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
  window.close();
});

// ─── Initialize ─────────────────────────────────────────────────────────────
init();
