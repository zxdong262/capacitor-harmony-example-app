# capacitor-harmony-example-app

A standalone demo app for [`capacitor-harmony`](https://github.com/zxdong262/capacitor-harmony).
It bundles a WebView UI (a Vite + React app under `src/`, built into `www/`)
plus an embedded Node.js backend (`node/main.js`) that serves a JSON API on
`127.0.0.1:3000`. The WebView calls that backend, so a working build proves the
whole WebView + ArkWeb + embedded Node.js stack of the lib.

## Local development

You don't need to build a `.app` to work on the frontend — preview it in a
browser with Vite:

```bash
npm install
npm start            # starts the Node backend AND the Vite dev server together
```

`npm start` launches both processes via `concurrently`:

- `node node/main.js` — the embedded Node backend on `http://127.0.0.1:3000`
- `vite` — the React dev server with HMR at `http://localhost:5173`

Vite proxies `/api/*` to the backend, so opening the preview and clicking
**Call /api/hello** returns a live response (the Node status pill and API card
both reflect the real backend).

The in-app browser (address bar, back/forward/refresh/home, browsing history)
is built in **React** (`src/App.tsx`) and runs in both places: the HarmonyOS
`Web` component and the browser preview — so you can develop and preview it
without building a `.app`. The Harmony device's hardware back button is wired to
the React history via `window.__browserBack`. Only the native bridge
(`Capacitor.nativePromise`, the embedded-Node calls) is unavailable in the
plain browser preview.

If you want to run just one half, use `npm run server` (backend only) or
`npm run web` (Vite only).

Build the production web bundle (what `cap sync harmony` copies into the app):

```bash
npm run build       # outputs to www/
```

## Run on HarmonyOS

The Capacitor CLI resolves the platform through `node_modules/harmony`, so
install the lib under that alias first (published on npm as
`capacitor-harmony` — install whatever version CI pins via `LIB_VERSION` in
`.github/workflows/build.yml`):

```bash
npm install --no-save harmony@npm:capacitor-harmony@0.1.2
# ...or from a local checkout of the lib, to test unreleased changes:
npm install --no-save harmony@file:../capacitor-harmony

npx cap add harmony    # first time only: scaffolds harmony/ from the template
npm run sync           # cap sync harmony — re-run after every web/config change
```

Then fetch the embedded Node binary and build (see
[`docs/BUILD.md`](https://github.com/zxdong262/capacitor-harmony/blob/main/docs/BUILD.md)
in the lib repo for the full flow and troubleshooting):

```bash
./harmony/scripts/prepare-node.sh arm64   # device; use `x64` for the emulator
cd harmony && hvigorw assembleHap --mode module -p product=default -p buildMode=debug --no-daemon
```

The debug HAP lands at
`harmony/entry/build/default/outputs/default/entry-default-unsigned.hap`
(unsigned HAPs install on the emulator; real devices need a signed build —
CI signs with your provision profile when the signing secrets are set).


## What CI does

Pushing to `main` / `build` / `dev` (or running the workflow manually) builds an
APP and uploads it as the **`harmony-demo-app`** artifact:

1. Checks out this app, then installs `capacitor-harmony` at the pinned
   version (`LIB_VERSION` in `.github/workflows/build.yml` — bump it after
   each lib release; set `LIB_REF` to a commit SHA to test unreleased source
   instead).
2. `npx cap add harmony` (first time) / `npx cap sync harmony` generates the
   `harmony/` native project.
3. Downloads `libnode.so`, then builds + signs the APP with the
   HarmonyOS Command Line Tools.
4. Uploads the APP for you to download and run on a Huawei cloud-debug device.

## Required GitHub secrets

Add these to the repo (**Settings → Secrets and variables → Actions**). They are
the same ones used by `electerm-harmony`.

| Secret | Purpose |
|--------|---------|
| `OHOS_CMDLINE_TOOLS_URL` | URL to the HarmonyOS Command Line Tools (~2 GB zip) |
| `OHOS_KEYSTORE_B64` | base64 of your `.p12` keystore |
| `OHOS_CERT_B64` | base64 of your `.cer` certificate |
| `OHOS_PROFILE_B64` | base64 of your `.p7b` provision profile |
| `OHOS_KEYSTORE_PASSWORD` | keystore password |
| `OHOS_KEY_PASSWORD` | key password |
| `OHOS_KEY_ALIAS` | key alias |
| `OHOS_BUNDLE_NAME` | *(optional)* bundle name — must match the profile; overrides `com.example.harmonydemo` |

Without the signing secrets the workflow still builds an **unsigned** `.app`, but an
unsigned package cannot be installed on a device — add them to get a runnable build.

> ⚠️ The provision profile (`OHOS_PROFILE_B64`) is tied to a specific bundle
> name. Set `OHOS_BUNDLE_NAME` to that exact bundle, or change `appId` in
> `capacitor.config.ts` to match the profile.

## Test on Huawei 云调试真机

1. Open the Actions run → **Artifacts** → download `harmony-demo-app`.
2. In DevEco / Huawei Cloud Debugging, upload the signed `.app`.
3. Launch it; the demo shows Node status and lets you ping the backend.
   A successful `backend -> {...}` response confirms the lib works end-to-end.
