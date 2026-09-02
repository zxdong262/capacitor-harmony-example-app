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
//
// Everything this file does is logged: when the backend does not come up, the
// log lines are the only evidence we get off a cloud-debug device.

const http = require('http');

const PORT = Number(process.env.PORT || 3000);

// First line out the door — proves V8 + node booted at all.
console.log(
  `[demo] boot node=${process.version} pid=${process.pid} cwd=${process.cwd()} argv=${JSON.stringify(process.argv)}`,
);

// Never die silently: an uncaught throw would end the runtime (and the app's
// UI would just say "stopped") with no clue about what went wrong.
process.on('uncaughtException', (err) => {
  console.error('[demo] uncaughtException: ' + (err && err.stack ? err.stack : String(err)));
});
process.on('unhandledRejection', (err) => {
  console.error('[demo] unhandledRejection: ' + (err && err.stack ? err.stack : String(err)));
});
process.on('exit', (code) => {
  console.log(`[demo] exit code=${code}`);
});
['SIGTERM', 'SIGINT', 'SIGHUP'].forEach((sig) => {
  process.on(sig, () => console.log(`[demo] signal ${sig}`));
});

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
    res.end(
      JSON.stringify({
        ok: true,
        platform: 'harmony',
        node: process.version,
        time: Date.now(),
      }),
    );
    return;
  }
  res.statusCode = 404;
  res.end(JSON.stringify({ error: 'not found' }));
});

server.on('error', (err) => {
  console.error(`[demo] server error: ${err && err.code ? err.code : ''} ${err && err.message ? err.message : String(err)}`);
});

// The app sandbox may refuse to bind 127.0.0.1 (EACCES / EPERM). Fall back
// through the loopback variants so a sandbox quirk shows up as a working
// server on another address instead of a dead backend.
const HOSTS = ['127.0.0.1', 'localhost', '::1', '0.0.0.0'];

function listen(index) {
  if (index >= HOSTS.length) {
    console.error(`[demo] could not bind any of ${HOSTS.join(', ')} on port ${PORT} — giving up`);
    return;
  }
  const host = HOSTS[index];
  const onError = (err) => {
    console.error(`[demo] listen ${host}:${PORT} failed: ${err && err.code ? err.code : ''} ${err && err.message ? err.message : String(err)}`);
    server.removeListener('error', onError);
    try {
      server.close();
    } catch (e) {
      /* not listening */
    }
    listen(index + 1);
  };
  server.once('error', onError);
  server.listen(PORT, host, () => {
    server.removeListener('error', onError);
    const addr = server.address();
    console.log(`[demo] node backend listening on http://${host}:${PORT} (${JSON.stringify(addr)})`);
  });
}

listen(0);
