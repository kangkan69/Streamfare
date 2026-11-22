// Streamfare server: serves the player from /public and relays stream
// requests through /proxy so we can send Referer, Origin etc. (Node 18+)

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const CORS = { 'Access-Control-Allow-Origin': '*' };

// query-string name -> header sent to the stream server
const FORWARDED_HEADERS = {
  referer: 'Referer',
  origin: 'Origin',
  ua: 'User-Agent',
  cookie: 'Cookie',
  auth: 'Authorization',
};

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

// ---------- static files ----------

function serveStatic(res, pathname) {
  const requested = pathname === '/' ? 'index.html' : pathname;
  const file = path.normalize(path.join(PUBLIC_DIR, requested));

  if (!file.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end();
  }

  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not found');
    }
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
}

// ---------- proxy ----------

function buildUpstreamHeaders(params, req) {
  const headers = {};
  for (const [param, headerName] of Object.entries(FORWARDED_HEADERS)) {
    if (params.get(param)) headers[headerName] = params.get(param);
  }
  if (req.headers.range) headers.Range = req.headers.range;
  return headers;
}

function isPlaylist(url, contentType) {
  return /\.m3u8/i.test(url) || contentType.includes('mpegurl');
}

// Point every segment / key in a playlist back at the proxy, keeping the same headers.
// Some CDNs (Akamai) want the auth token on every segment, so if the playlist URL
// carries an hdnea token and a segment has no query string, we copy the token over.
function rewritePlaylist(text, playlistUrl, params) {
  const base = new URL(playlistUrl);
  const carryToken = base.search.includes('hdnea');

  const forwarded = new URLSearchParams();
  for (const param of Object.keys(FORWARDED_HEADERS)) {
    if (params.get(param)) forwarded.set(param, params.get(param));
  }

  const toProxyUrl = (ref) => {
    const absolute = new URL(ref, base);
    if (carryToken && !absolute.search) absolute.search = base.search;
    const query = new URLSearchParams({ url: absolute.href });
    forwarded.forEach((value, key) => query.set(key, value));
    return '/proxy?' + query;
  };

  return text
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith('#')) {
        // tags like #EXT-X-KEY:URI="..." point at files too
        return line.replace(/URI="([^"]+)"/g, (_, uri) => `URI="${toProxyUrl(uri)}"`);
      }
      return toProxyUrl(trimmed);
    })
    .join('\n');
}

async function pipeBody(upstream, req, res) {
  const reader = upstream.body.getReader();
  req.on('close', () => reader.cancel().catch(() => {}));
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    res.write(value);
  }
  res.end();
}

async function handleProxy(req, res, params) {
  const target = params.get('url');
  if (!target) {
    res.writeHead(400, CORS);
    return res.end('Missing url parameter');
  }

  try {
    const upstream = await fetch(target, {
      headers: buildUpstreamHeaders(params, req),
      redirect: 'follow',
    });

    if (!upstream.ok) {
      console.log(`Upstream ${upstream.status}: ${target}`);
      res.writeHead(upstream.status, CORS);
      return res.end(`Stream server answered ${upstream.status}`);
    }

    const contentType = upstream.headers.get('content-type') || '';

    if (isPlaylist(upstream.url, contentType)) {
      const playlist = rewritePlaylist(await upstream.text(), upstream.url, params);
      res.writeHead(200, { ...CORS, 'Content-Type': 'application/vnd.apple.mpegurl' });
      return res.end(playlist);
    }

    const headers = { ...CORS, 'Content-Type': contentType };
    const range = upstream.headers.get('content-range');
    if (range) headers['Content-Range'] = range;
    res.writeHead(upstream.status, headers);
    await pipeBody(upstream, req, res);
  } catch (err) {
    console.log('Proxy error:', err.message);
    if (!res.headersSent) res.writeHead(502, CORS);
    res.end(String(err));
  }
}

// ---------- start ----------

http
  .createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname === '/proxy') return handleProxy(req, res, url.searchParams);
    serveStatic(res, url.pathname);
  })
  .listen(PORT, () => console.log(`Streamfare running at http://localhost:${PORT}`));
