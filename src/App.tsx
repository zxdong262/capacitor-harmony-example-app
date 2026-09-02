import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Logo } from './Logo';

const isNative = Capacitor.isNativePlatform();
const HOME = '__home__';

type NodeStatusResult = { running: boolean; error: string; log: string; extract?: string };
type NodeInfoResult = { entry: string; entryPath: string; dir: string };

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
  const [nodeError, setNodeError] = useState('');
  const [nodeLog, setNodeLog] = useState('');
  const [nodeExtract, setNodeExtract] = useState('');
  const [nodeInfo, setNodeInfo] = useState<NodeInfoResult | null>(null);
  const [apiReply, setApiReply] = useState('');
  const [urlText, setUrlText] = useState('');
  const [current, setCurrent] = useState(HOME);
  const [history, setHistory] = useState<string[]>([HOME]);
  const [idx, setIdx] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // The boot log is the only evidence we get off a cloud-debug device, so keep
  // polling it while the backend is down and show it verbatim.
  const refreshNode = useCallback(async () => {
    if (!isNative) {
      return;
    }
    try {
      const r = await Capacitor.nativePromise<NodeStatusResult>('Node', 'getStatus');
      setNodeStatus(r.running ? 'running' : 'stopped');
      setNodeError(r.error || '');
      setNodeLog(r.log || '');
      setNodeExtract(r.extract || '');
    } catch (e) {
      setNodeStatus('error');
      setNodeError((e as Error).message || String(e));
    }
    try {
      setNodeInfo(await Capacitor.nativePromise<NodeInfoResult>('Node', 'getInfo'));
    } catch {
      /* info is optional */
    }
  }, []);

  useEffect(() => {
    if (!isNative) {
      setNodeStatus('n/a (browser preview)');
      return;
    }
    let alive: boolean = true;
    const tick = (): void => {
      if (!alive) {
        return;
      }
      void refreshNode();
    };
    tick();
    const timer: number = window.setInterval(tick, 2500);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [refreshNode]);

  const goto = useCallback(
    (raw: string) => {
      const u = normalize(raw);
      if (!u) return;
      setHistory((h) => [...h.slice(0, idx + 1), u]);
      setIdx((i) => i + 1);
      setCurrent(u);
      setUrlText(u === HOME ? '' : u);
    },
    [idx],
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

  const startNode = async () => {
    setNodeError('');
    try {
      await Capacitor.nativePromise('Node', 'start');
    } catch (e) {
      setNodeError((e as Error).message || String(e));
    }
    await refreshNode();
  };

  const stopNode = async () => {
    try {
      await Capacitor.nativePromise('Node', 'stop');
    } catch (e) {
      setNodeError((e as Error).message || String(e));
    }
    await refreshNode();
  };

  const testApi = async () => {
    setApiReply('loading…');
    try {
      // In the app, ArkWeb cannot open a socket to 127.0.0.1, so we proxy
      // through the native Node bridge. In the browser preview, Vite proxies
      // /api/* to the local backend.
      let text: string;
      if (isNative) {
        const r = await Capacitor.nativePromise<{ status: number; body: string }>(
          'Node',
          'callApi',
          { path: '/api/hello' },
        );
        let parsed: unknown = r.body;
        try {
          parsed = JSON.parse(r.body);
        } catch {
          /* keep raw body */
        }
        text = JSON.stringify({ status: r.status, body: parsed }, null, 2);
      } else {
        const res = await fetch('/api/hello');
        text = JSON.stringify(await res.json(), null, 2);
      }
      setApiReply(text);
    } catch (e) {
      setApiReply('call failed: ' + (e as Error).message);
      void refreshNode();
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
            <div className={`status ${nodeStatus === 'running' ? 'run' : 'stop'}`}>
              Node: <span>{nodeStatus}</span>
            </div>
            <div className="card">
              <h2>Node backend</h2>
              <div className="row">
                <button onClick={startNode}>Start</button>
                <button className="ghost" onClick={stopNode}>
                  Stop
                </button>
                <button className="ghost" onClick={() => void refreshNode()}>
                  Refresh
                </button>
                <button onClick={testApi}>Call /api/hello</button>
              </div>
              {nodeError && <pre className="error">{nodeError}</pre>}
              {apiReply && <pre>{apiReply}</pre>}
              {nodeInfo && (
                <pre className="meta">
                  {`dir:   ${nodeInfo.dir}\nentry: ${nodeInfo.entry}\npath:  ${nodeInfo.entryPath}`}
                </pre>
              )}
              {nodeExtract && <pre className="meta">{`extract: ${nodeExtract}`}</pre>}
              {nodeLog && <pre className="log">{nodeLog}</pre>}
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
