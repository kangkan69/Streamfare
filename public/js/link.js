// Helpers for turning what the user pastes into something we can play.

// Form fields that map to headers (same names the server expects)
export const HEADER_FIELDS = ['referer', 'origin', 'ua', 'cookie', 'auth'];

// Header names as they appear in "url|User-Agent=...&Referer=..." links
const LINK_HEADER_NAMES = {
  'user-agent': 'ua',
  referer: 'referer',
  referrer: 'referer',
  origin: 'origin',
  cookie: 'cookie',
  authorization: 'auth',
};

// Split "https://host/a.m3u8|Referer=x&Origin=y" into the url and its headers.
// Line breaks are removed because links copied from a wrapped terminal contain them.
export function parseStreamLink(input) {
  const cleaned = input.replace(/[\r\n]+/g, '').trim();
  const pipeAt = cleaned.indexOf('|');
  if (pipeAt === -1) return { url: cleaned, headers: {} };

  const headers = {};
  for (const pair of cleaned.slice(pipeAt + 1).split('&')) {
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    const field = LINK_HEADER_NAMES[pair.slice(0, eq).trim().toLowerCase()];
    if (field) headers[field] = pair.slice(eq + 1).trim();
  }
  return { url: cleaned.slice(0, pipeAt), headers };
}

// Which player engine a URL needs
export function detectStreamType(url) {
  if (/\.m3u8(\?|$)/i.test(url)) return 'hls';
  if (/\.flv(\?|$)/i.test(url)) return 'flv';
  if (/\.ts(\?|$)/i.test(url)) return 'mpegts';
  return 'native';
}

// /proxy?url=...&referer=...  (server.js reads these)
export function buildProxyUrl(url, headers) {
  const params = new URLSearchParams({ url });
  for (const [name, value] of Object.entries(headers)) {
    if (value) params.set(name, value);
  }
  return '/proxy?' + params;
}
