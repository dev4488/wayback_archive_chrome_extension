/**
 * Background service worker for Wayback Archive Viewer.
 * Handles context menus, keyboard shortcuts, badge updates, and messaging.
 */

import { isArchivable, normalizeUrl, getTimelineUrl } from '../lib/url-utils.js';
import { fetchLatestSnapshot, saveToArchive, formatTimestamp } from '../lib/api.js';

// ─── Debounce Utility ───────────────────────────────────────────────────────

const _pendingLookups = new Map();

function debouncedLookup(url, fn, delayMs = 300) {
  if (_pendingLookups.has(url)) {
    clearTimeout(_pendingLookups.get(url));
  }
  return new Promise((resolve) => {
    const timer = setTimeout(async () => {
      _pendingLookups.delete(url);
      resolve(await fn());
    }, delayMs);
    _pendingLookups.set(url, timer);
  });
}

// ─── Context Menus ──────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'open-archived-version',
    title: 'Open archived version',
    contexts: ['page', 'link']
  });

  chrome.contextMenus.create({
    id: 'open-archive-timeline',
    title: 'Open archive timeline',
    contexts: ['page', 'link']
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const url = info.linkUrl || info.pageUrl || tab?.url;
  if (!url || !isArchivable(url)) return;

  const { archiveEngine } = await chrome.storage.sync.get({ archiveEngine: 'wayback' });

  if (info.menuItemId === 'open-archived-version') {
    try {
      const snapshot = await fetchLatestSnapshot(url, false, archiveEngine);
      if (snapshot?.url) {
        chrome.tabs.create({ url: snapshot.url });
      } else {
        chrome.tabs.create({ url: getTimelineUrl(url, archiveEngine) });
      }
    } catch {
      chrome.tabs.create({ url: getTimelineUrl(url, archiveEngine) });
    }
  } else if (info.menuItemId === 'open-archive-timeline') {
    chrome.tabs.create({ url: getTimelineUrl(url, archiveEngine) });
  }
});

// ─── Keyboard Shortcut ─────────────────────────────────────────────────────

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'archive-lookup') return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url || !isArchivable(tab.url)) return;

  // Read user's default preference and engine
  const { defaultBehavior, archiveEngine } = await chrome.storage.sync.get({
    defaultBehavior: 'latest',
    archiveEngine: 'wayback'
  });

  if (defaultBehavior === 'timeline') {
    chrome.tabs.create({ url: getTimelineUrl(tab.url, archiveEngine) });
    return;
  }

  try {
    const snapshot = await fetchLatestSnapshot(tab.url, false, archiveEngine);
    if (snapshot?.url) {
      chrome.tabs.create({ url: snapshot.url });
    } else {
      chrome.tabs.create({ url: getTimelineUrl(tab.url, archiveEngine) });
    }
  } catch {
    chrome.tabs.create({ url: getTimelineUrl(tab.url, archiveEngine) });
  }
});

// ─── Badge Updates ──────────────────────────────────────────────────────────

async function updateBadge(tabId, url) {
  if (!url || !isArchivable(url)) {
    chrome.action.setBadgeText({ text: '', tabId });
    return;
  }

  try {
    const snapshot = await debouncedLookup(
      `badge:${url}`,
      () => fetchLatestSnapshot(url),
      500
    );

    if (snapshot) {
      chrome.action.setBadgeText({ text: '✓', tabId });
      chrome.action.setBadgeBackgroundColor({ color: '#4CAF50', tabId });
      chrome.action.setTitle({
        title: `Archived: ${formatTimestamp(snapshot.timestamp)}`,
        tabId
      });
    } else {
      chrome.action.setBadgeText({ text: '', tabId });
      chrome.action.setTitle({ title: 'Wayback Archive Viewer', tabId });
    }
  } catch {
    chrome.action.setBadgeText({ text: '', tabId });
  }
}

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab?.url) updateBadge(tabId, tab.url);
  } catch { /* tab may have closed */ }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) {
    updateBadge(tabId, changeInfo.url);
  }
});

// ─── Message Handler (from popup / options) ─────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const { action, url } = message;

  if (action === 'getSnapshot') {
    const { archiveEngine } = message;
    fetchLatestSnapshot(url, false, archiveEngine)
      .then(snapshot => sendResponse({ success: true, snapshot }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // keep channel open for async response
  }

  if (action === 'saveToArchive') {
    const { archiveEngine } = message;
    saveToArchive(url, archiveEngine)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (action === 'getTimelineUrl') {
    const { archiveEngine } = message;
    sendResponse({ url: getTimelineUrl(url, archiveEngine) });
    return false;
  }

  if (action === 'formatTimestamp') {
    sendResponse({ formatted: formatTimestamp(message.timestamp) });
    return false;
  }
});
