/**
 * Wayback Machine API wrapper.
 * Uses the CDX API as primary (more reliable) and availability API as fallback.
 */

import { normalizeUrl } from './url-utils.js';
import { snapshotCache } from './cache.js';

const CDX_API = 'https://web.archive.org/cdx/search/cdx';
const AVAILABILITY_API = 'https://archive.org/wayback/available';
const SAVE_URL_BASE = 'https://web.archive.org/save/';
const FETCH_TIMEOUT_MS = 10000; // 10 second timeout

/**
 * Fetch with a timeout via AbortController.
 */
function fetchWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

/**
 * Try CDX API first (more reliable), fall back to availability API.
 * Returns snapshot info { url, timestamp } or null if none found.
 * @param {string} url
 * @param {boolean} [skipCache=false]
 * @returns {Promise<{ url: string, timestamp: string }|null>}
 */
export async function fetchLatestSnapshot(url, skipCache = false) {
  const normalized = normalizeUrl(url);

  // Check cache first
  if (!skipCache) {
    const cached = snapshotCache.get(normalized);
    if (cached !== undefined) return cached;
  }

  // Try CDX API first
  try {
    const snapshot = await fetchViaCDX(normalized);
    snapshotCache.set(normalized, snapshot);
    return snapshot;
  } catch (cdxError) {
    console.warn('[Wayback] CDX API failed, trying availability API:', cdxError.message);
  }

  // Fallback to availability API
  try {
    const snapshot = await fetchViaAvailability(normalized);
    snapshotCache.set(normalized, snapshot);
    return snapshot;
  } catch (error) {
    console.error('[Wayback] Both APIs failed:', error.message);
    throw new Error('Archive service is currently unavailable. Please try again later.');
  }
}

/**
 * Fetch latest snapshot via CDX API.
 */
async function fetchViaCDX(normalizedUrl) {
  const params = new URLSearchParams({
    url: normalizedUrl,
    output: 'json',
    limit: '1',
    fl: 'timestamp,original,statuscode',
    filter: 'statuscode:200',
    sort: 'reverse'  // latest first
  });

  const response = await fetchWithTimeout(`${CDX_API}?${params}`);

  if (!response.ok) {
    throw new Error(`CDX API responded with status ${response.status}`);
  }

  const data = await response.json();

  // CDX returns array of arrays; first row is header, second is data
  if (Array.isArray(data) && data.length >= 2) {
    const [headers, row] = data;
    const timestampIdx = headers.indexOf('timestamp');
    const originalIdx = headers.indexOf('original');

    if (timestampIdx !== -1 && row[timestampIdx]) {
      const timestamp = row[timestampIdx];
      const originalUrl = originalIdx !== -1 ? row[originalIdx] : normalizedUrl;
      return {
        url: `https://web.archive.org/web/${timestamp}/${originalUrl}`,
        timestamp: timestamp
      };
    }
  }

  return null;
}

/**
 * Fetch latest snapshot via availability API.
 */
async function fetchViaAvailability(normalizedUrl) {
  const response = await fetchWithTimeout(
    `${AVAILABILITY_API}?url=${encodeURIComponent(normalizedUrl)}`
  );

  if (!response.ok) {
    throw new Error(`Availability API responded with status ${response.status}`);
  }

  const data = await response.json();

  if (
    data.archived_snapshots &&
    data.archived_snapshots.closest &&
    data.archived_snapshots.closest.available
  ) {
    return {
      url: data.archived_snapshots.closest.url,
      timestamp: data.archived_snapshots.closest.timestamp
    };
  }

  return null;
}

/**
 * Request the Wayback Machine to save/archive a URL.
 * @param {string} url
 * @returns {Promise<{ success: boolean, archiveUrl?: string, error?: string }>}
 */
export async function saveToArchive(url) {
  const normalized = normalizeUrl(url);

  try {
    const response = await fetchWithTimeout(
      `${SAVE_URL_BASE}${normalized}`,
      { method: 'GET', redirect: 'follow' },
      20000 // longer timeout for save operations
    );

    if (response.ok || response.status === 302) {
      // Invalidate any cached "no result"
      snapshotCache.remove(normalized);

      return {
        success: true,
        archiveUrl: response.url || `${SAVE_URL_BASE}${normalized}`
      };
    }

    return {
      success: false,
      error: `Save request failed (status ${response.status}). The Wayback Machine may be busy.`
    };
  } catch (error) {
    console.error('[Wayback] Error saving to archive:', error);
    return {
      success: false,
      error: error.name === 'AbortError'
        ? 'Request timed out. The Wayback Machine may be busy — try again later.'
        : error.message
    };
  }
}

/**
 * Format a Wayback Machine timestamp (YYYYMMDDHHmmss) to a readable string.
 * @param {string} timestamp
 * @returns {string}
 */
export function formatTimestamp(timestamp) {
  if (!timestamp || timestamp.length < 8) return 'Unknown date';

  const year = timestamp.slice(0, 4);
  const month = timestamp.slice(4, 6);
  const day = timestamp.slice(6, 8);
  const hour = timestamp.slice(8, 10) || '00';
  const minute = timestamp.slice(10, 12) || '00';

  const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:00Z`);

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });
}
