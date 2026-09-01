# capacitor-harmony-example-app

A standalone demo app for [`capacitor-harmony`](https://github.com/zxdong262/capacitor-harmony).
It bundles a tiny WebView UI (`www/`) plus an embedded Node.js backend
(`node/main.js`) that serves a JSON API on `127.0.0.1:3000`. The WebView calls
that backend, so a working build proves the whole WebView + ArkWeb + embedded
Node.js stack of the lib.

## What CI does

Pushing to `main` / `build` / `dev` (or running the workflow manually) builds a
HAP and uploads it as the **`harmony-demo-hap`** artifact:

1. Checks out this app **and** `capacitor-harmony` at a pinned commit (`LIB_REF`
   in `.github/workflows/build.yml`).
2. Builds the lib (`npm run build`) and links it into the example.
3. `npx cap sync harmony` generates the `harmony/` native project.
4. Downloads `libnode.so` + Node headers, then builds + signs the HAP with the
   HarmonyOS Command Line Tools.
5. Uploads the HAP for you to download and run on a Huawei cloud-debug device.

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

Without the signing secrets the workflow still builds an **unsigned** HAP, but an
unsigned HAP cannot be installed on a device — add them to get a runnable build.

> ⚠️ The provision profile (`OHOS_PROFILE_B64`) is tied to a specific bundle
> name. Set `OHOS_BUNDLE_NAME` to that exact bundle, or change `appId` in
> `capacitor.config.ts` to match the profile.

## Test on Huawei 云调试真机

1. Open the Actions run → **Artifacts** → download `harmony-demo-hap`.
2. In DevEco / Huawei Cloud Debugging, upload the signed `.hap`.
3. Launch it; the demo shows Node status and lets you ping the backend.
   A successful `backend -> {...}` response confirms the lib works end-to-end.
