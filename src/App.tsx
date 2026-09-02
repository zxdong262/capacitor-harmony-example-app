import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Logo } from './Logo';

const isNative = Capacitor.isNativePlatform();
const API_URL = isNative ? 'http://127.0.0.1:3000/api/hello' : '/api/hello';
const HOME = '__home__';

function normalize(raw: string): string {
  const u = raw.trim();
  if (!u) return '';
  if (u === HOME) return HOME;
  if (/^https?:\/\//i.test(u) || u.startsWith('about:') || u.startsWith('data:')) {
    return u;
  }
  return 'https://' + u;
}

export default function App() {
  const [nodeStatus, setNodeStatus] = useState('booting…');
  const [apiReply, setApiReply] = useState('');
  const [urlText, setUrlText] = useState('');
  const [current, setCurrent] = useState(HOME);
  const [history, setHistory] = useState<string[]>([HOME]);
  const [idx, setIdx] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (isNative) {
      Capacitor.nativePromise<{ running: boolean }>('Node', 'getStatus')
        .then((r) => setNodeStatus(r.running ? 'running' : 'stopped'))
        .catch((err) => setNodeStatus('error: ' + err));
    } else {
      setNodeStatus('n/a (browser preview)');
    }
  }, []);

  const goto = useCallback(
    (raw: string) => {
      const u = normalize(raw);
      if (!u) return;
      setHistory((h) => [...h.slice(0, idx + 1), u]);
      setIdx((i) => i + 1);
      setCurrent(u);
      setUrlText(u === HOME ? '' : u);
    },
    [idx]
  );

  const back = useCallback((): boolean => {
    if (idx <= 0) return false;
    const ni = idx - 1;
    setIdx(ni);
    const u = history[ni];
    setCurrent(u);
    setUrlText(u === HOME ? '' : u);
    return true;
  }, [idx, history]);

  const forward = useCallback((): boolean => {
    if (idx >= history.length - 1) return false;
    const ni = idx + 1;
    setIdx(ni);
    const u = history[ni];
    setCurrent(u);
    setUrlText(u === HOME ? '' : u);
    return true;
  }, [idx, history]);

  const refresh = useCallback(() => {
    if (current !== HOME) setReloadKey((k) => k + 1);
  }, [current]);

  // Expose to the native layer so the device hardware back button drives the
  // in-app (React) browsing history instead of the outer WebView.
  useEffect(() => {
    (window as unknown as { __browserBack?: () => boolean }).__browserBack = () => back();
    return () => {
      delete (window as unknown as { __browserBack?: () => boolean }).__browserBack;
    };
  }, [back]);

  const testApi = async () => {
    setApiReply('loading…');
    try {
      const res = await fetch(API_URL);
      const data = await res.json();
      setApiReply(JSON.stringify(data, null, 2));
    } catch (e) {
      setApiReply('fetch failed: ' + (e as Error).message);
    }
  };

  const canBack = idx > 0;
  const canFwd = idx < history.length - 1;

  return (
    <div className="browser">
      <div className="toolbar">
        <button className="tb" onClick={() => back()} disabled={!canBack} aria-label="back">
          ‹
        </button>
        <button className="tb" onClick={() => forward()} disabled={!canFwd} aria-label="forward">
          ›
        </button>
        <button
          className="tb"
          onClick={refresh}
          disabled={current === HOME}
          aria-label="refresh"
        >
          ↻
        </button>
        <button className="tb" onClick={() => goto(HOME)} aria-label="home">
          ⌂
        </button>
        <input
          className="url"
          value={urlText}
          placeholder="Search or enter URL"
          onChange={(e) => setUrlText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') goto(urlText);
          }}
        />
        <button className="tb go" onClick={() => goto(urlText)}>
          Go
        </button>
      </div>

      <div className="content">
        {current === HOME ? (
          <div className="home">
            <Logo className="logo" />
            <h1>capacitor-harmony</h1>
            <p>
              A HarmonyOS app: a native WebView hosts web content and an embedded
              Node.js runtime runs alongside it.
            </p>
            <div className="status">
              Node: <span>{nodeStatus}</span>
            </div>
            <div className="card">
              <h2>Node backend API</h2>
              <button onClick={testApi}>Call /api/hello</button>
              {apiReply && <pre>{apiReply}</pre>}
            </div>
            <p className="hint">Use the address bar above to browse the web inside this WebView.</p>
          </div>
        ) : (
          <iframe key={reloadKey} ref={iframeRef} className="frame" src={current} title="site" />
        )}
      </div>
    </div>
  );
}
