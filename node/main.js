// node/main.js
//
// Bundled into `rawfile/node/` and run by the embedded Node.js runtime inside
// the HarmonyOS app.  It serves a tiny JSON API on 127.0.0.1:3000 — the WebView
// reaches it with `fetch('http://127.0.0.1:3000/...')`.
//
// Files under the same directory are available via `require()` and `fs`, since
// the runtime unpacks `rawfile/node/**` into the app's writable filesDir.

const http = require('http');

const PORT = 3000;

// The WebView reaches this backend cross-origin (from file:// or
// http://localhost), so CORS headers are required or the fetch is blocked.
function setCors(res, req) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return true; // handled
  }
  return false;
}

const server = http.createServer((req, res) => {
  if (setCors(res, req)) return;
  res.setHeader('Content-Type', 'application/json');
  if (req.url === '/api/hello') {
    res.end(JSON.stringify({ ok: true, platform: 'harmony', node: process.version, time: Date.now() }));
    return;
  }
  res.statusCode = 404;
  res.end(JSON.stringify({ error: 'not found' }));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[demo] node backend listening on http://127.0.0.1:${PORT}`);
});
