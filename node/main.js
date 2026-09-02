// node/main.js
//
// Bundled into `rawfile/node/` and run by the embedded Node.js runtime inside
// the HarmonyOS app.  It serves a tiny JSON API on 127.0.0.1:3000.
//
// IMPORTANT: the WebView (ArkWeb) cannot open a socket to 127.0.0.1, so the web
// layer must NOT fetch this directly.  Instead the `Node.callApi` native plugin
// method proxies the request from the native side (which CAN reach the loopback)
// and returns the body to JS.  See assets/native-template .../plugins/Node.ets.
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
