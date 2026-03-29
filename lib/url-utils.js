/**
 * URL utility functions for normalization and validation.
 */

const TRACKING_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'gclsrc', 'dclid', 'msclkid',
  'mc_cid', 'mc_eid', 'ref', 'ref_src', 'ref_url',
  '_ga', '_gl', 'yclid', 'twclid', 'ttclid',
  'igshid', 'si', 'feature', 'spm', 'scm'
];

const NON_ARCHIVABLE_PROTOCOLS = [
  'chrome://', 'chrome-extension://', 'about:', 'data:',
  'file://', 'blob:', 'javascript:', 'devtools://',
  'edge://', 'brave://', 'opera://', 'vivaldi://'
];

/**
 * Normalize a URL by removing tracking parameters and cleaning up.
 * @param {string} url
 * @returns {string} Normalized URL
 */
export function normalizeUrl(url) {
  try {
    const parsed = new URL(url);

    // Remove tracking params
    TRACKING_PARAMS.forEach(param => {
      parsed.searchParams.delete(param);
    });

    // Remove trailing slash for consistency (unless root path)
    let normalized = parsed.toString();
    if (parsed.pathname !== '/' && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }

    // Remove hash fragment
    const hashIndex = normalized.indexOf('#');
    if (hashIndex !== -1) {
      normalized = normalized.slice(0, hashIndex);
    }

    return normalized;
  } catch {
    return url;
  }
}

/**
 * Check if a URL can be archived (valid http/https, not internal browser page).
 * @param {string} url
 * @returns {boolean}
 */
export function isArchivable(url) {
  if (!url || typeof url !== 'string') return false;

  // Must be http or https
  if (!url.startsWith('http://') && !url.startsWith('https://')) return false;

  // Not an internal browser page
  for (const protocol of NON_ARCHIVABLE_PROTOCOLS) {
    if (url.startsWith(protocol)) return false;
  }

  // Not localhost
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '[::1]' ||
      host.endsWith('.local')
    ) {
      return false;
    }
  } catch {
    return false;
  }

  return true;
}

/**
 * Build the timeline or search URL for a given page.
 * @param {string} url
 * @param {string} engine ('wayback' or 'archiveIs')
 * @returns {string}
 */
export function getTimelineUrl(url, engine = 'wayback') {
  const normalized = normalizeUrl(url);
  if (engine === 'archiveIs') {
    return `https://archive.is/${encodeURI(normalized)}`;
  }
  return `https://web.archive.org/web/*/${normalized}`;
}

/**
 * Build the direct snapshot URL from a Wayback Machine snapshot object.
 * @param {{ url: string, timestamp: string }} snapshot
 * @returns {string}
 */
export function getSnapshotUrl(snapshot) {
  if (!snapshot || !snapshot.url) return null;
  return snapshot.url;
}
