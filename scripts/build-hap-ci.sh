#!/usr/bin/env bash
#
# build-hap-ci.sh — build & (optionally) sign a capacitor-harmony APP package.
#
# Run from the example-app root. Generates an UNSIGNED build-profile, runs
# `hvigorw assembleApp` (same as electerm-harmony), then signs the .app with
# hap-sign-tool.jar when signing materials are present (SIGNING_ENABLED=true).
#
# Env:
#   PROJECT_ROOT        harmony project dir (default: harmony)
#   BUILD_MODE          release | debug (default: release)
#   COMMANDLINE_TOOLS   path to HarmonyOS Command Line Tools (required)
#   OHOS_SDK_HOME       SDK home (default: $COMMANDLINE_TOOLS/sdk)
#   SIGNING_ENABLED     true | false
#   SIGNING_DIR         dir with .p12/.cer/.p7b (default: signing)
#   KEYSTORE_FILE/CERT_FILE/PROFILE_FILE
#   KEY_ALIAS/KEY_PASSWORD/KEYSTORE_PASSWORD
#
# Writes to $GITHUB_OUTPUT:  hap_path, signed
set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-harmony}"
BUILD_MODE="${BUILD_MODE:-release}"
COMMANDLINE_TOOLS="${COMMANDLINE_TOOLS:?COMMANDLINE_TOOLS is required}"
OHOS_SDK_HOME="${OHOS_SDK_HOME:-${COMMANDLINE_TOOLS}/sdk}"
SIGNING_ENABLED="${SIGNING_ENABLED:-false}"
SIGNING_DIR="${SIGNING_DIR:-signing}"

echo "==> HarmonyOS build environment"
echo "    PROJECT_ROOT=$PROJECT_ROOT"
echo "    BUILD_MODE=$BUILD_MODE"
echo "    COMMANDLINE_TOOLS=$COMMANDLINE_TOOLS"
echo "    OHOS_SDK_HOME=$OHOS_SDK_HOME"

# Fix: project root package.json is "type":"module"; the Command Line Tools
# ship CommonJS .js (hvigorw.js). Add a CommonJS package.json so Node does not
# treat them as ES modules.
HVIGOR_DIR="${COMMANDLINE_TOOLS}/hvigor"
[ -d "$HVIGOR_DIR" ] && [ ! -f "$HVIGOR_DIR/package.json" ] && echo '{"type":"commonjs"}' > "$HVIGOR_DIR/package.json"
[ ! -f "$COMMANDLINE_TOOLS/package.json" ] && echo '{"type":"commonjs"}' > "$COMMANDLINE_TOOLS/package.json"

export OHOS_SDK_HOME
export PATH="$PATH:${COMMANDLINE_TOOLS}/bin:${COMMANDLINE_TOOLS}/hvigor/bin"
OHPM="${COMMANDLINE_TOOLS}/bin/ohpm"
HVIGORW="${COMMANDLINE_TOOLS}/bin/hvigorw"

# npm/ohpm registry for hvigor (HarmonyOS scoped packages)
cat > "${HOME}/.npmrc" <<'NPMRC'
@ohos:registry=https://repo.harmonyos.com/npm/
registry=https://registry.npmjs.org/
NPMRC

# --- Detect SDK version --------------------------------------------------
SDK_PKG_JSON="${OHOS_SDK_HOME}/default/sdk-pkg.json"
if [ -f "$SDK_PKG_JSON" ]; then
  SDK_API_VERSION="$(python3 -c "import json;print(json.load(open('$SDK_PKG_JSON'))['data']['apiVersion'])" 2>/dev/null || true)"
  SDK_DISPLAY_NAME="$(python3 -c "import json;print(json.load(open('$SDK_PKG_JSON'))['data']['displayName'])" 2>/dev/null || true)"
  SDK_VERSION="$(echo "${SDK_DISPLAY_NAME}" | sed -n 's/.*\([0-9]\+\.[0-9]\+\.[0-9]\+\).*/\1/p')"
  if [ -n "${SDK_API_VERSION}" ] && [ -n "${SDK_VERSION}" ]; then
    COMPILE_SDK_VERSION="${SDK_VERSION}(${SDK_API_VERSION})"
  else
    COMPILE_SDK_VERSION="5.0.1(13)"
  fi
else
  COMPILE_SDK_VERSION="5.0.1(13)"
fi
echo "    compileSdkVersion=${COMPILE_SDK_VERSION}"

# Mirror electerm-harmony's proven config: compatibleSdkVersion equals
# compileSdkVersion (its .app packages install fine on cloud-debug devices
# with this exact pairing). Override with COMPATIBLE_SDK_VERSION if needed.
COMPATIBLE_SDK_VERSION="${COMPATIBLE_SDK_VERSION:-${COMPILE_SDK_VERSION}}"
echo "    compatibleSdkVersion=${COMPATIBLE_SDK_VERSION}"

# --- Generate build-profile.json5 (unsigned) -----------------------------
cat > "${PROJECT_ROOT}/build-profile.json5" <<EOF
{
  "app": {
    "signingConfigs": [],
    "products": [
      {
        "name": "default",
        "compatibleSdkVersion": "${COMPATIBLE_SDK_VERSION}",
        "compileSdkVersion": "${COMPILE_SDK_VERSION}",
        "runtimeOS": "HarmonyOS",
        "buildOption": {
          "nativeLib": {
            "collectAllLibs": true
          }
        }
      }
    ]
  },
  "modules": [
    {
      "name": "entry",
      "srcPath": "./entry",
      "targets": [
        {
          "name": "default",
          "applyToProducts": ["default"]
        }
      ]
    }
  ]
}
EOF
echo "    build-profile.json5 generated (unsigned)"

# --- Generate hvigor-config.json5 (use bundled plugin) --------------------
# Mirror electerm-harmony exactly: modelVersion 5.0.0. The previous demo
# value (5.0.2) made the bundled hvigor not register the 'assembleApp' task
# ("Task 'assembleApp' was not found in the project").
BUNDLED_PLUGIN_DIR="${COMMANDLINE_TOOLS}/hvigor/hvigor-ohos-plugin"
if [ -d "$BUNDLED_PLUGIN_DIR" ]; then
  cat > "${PROJECT_ROOT}/hvigor/hvigor-config.json5" <<HVIGORCFG
{
  "modelVersion": "5.0.0",
  "dependencies": {
    "@ohos/hvigor-ohos-plugin": "file:${BUNDLED_PLUGIN_DIR}"
  },
  "execution": {},
  "logging": {
    "level": "info"
  },
  "debugging": {
    "quiet": false
  }
}
HVIGORCFG
  echo "    hvigor-config.json5 generated (bundled plugin, modelVersion 5.0.0)"
  # electerm keeps root oh-package.json5 modelVersion in sync (5.0.0)
  OH_PACKAGE="${PROJECT_ROOT}/oh-package.json5"
  if [ -f "$OH_PACKAGE" ]; then
    if grep -q '"modelVersion"' "$OH_PACKAGE"; then
      sed -i 's/"modelVersion": "[^"]*"/"modelVersion": "5.0.0"/' "$OH_PACKAGE"
      echo "    oh-package.json5: modelVersion forced to 5.0.0"
    else
      sed -i 's/^{/{\n  "modelVersion": "5.0.0",/' "$OH_PACKAGE"
      echo "    oh-package.json5: modelVersion 5.0.0 added"
    fi
  fi
fi

# --- local.properties for hvigor ------------------------------------------
cat > "${PROJECT_ROOT}/local.properties" <<LOCPROP
sdk.dir=${OHOS_SDK_HOME}/default/openharmony
ohos.sdk.dir=${OHOS_SDK_HOME}
LOCPROP

# --- Install ohpm dependencies -------------------------------------------
echo "==> ohpm install"
( cd "$PROJECT_ROOT" && "$OHPM" install )

# --- Build unsigned APP (assembleApp, mirrors electerm-harmony) -----------
# electerm-harmony builds cloud-debug-installable .app packages with exactly
# this invocation; the earlier assembleHap + app_packing_tool workaround
# produced .app packages that cloud debug rejected ("解析错误").
echo "==> Building unsigned APP (${BUILD_MODE})"
MODE_ARG="release"
[ "$BUILD_MODE" = "debug" ] && MODE_ARG="debug"
( cd "$PROJECT_ROOT" && "$HVIGORW" assembleApp \
    -p product=default \
    -p buildMode="$MODE_ARG" -p enableSignTask=false --no-daemon )

APP_OUTPUT_DIR="${PROJECT_ROOT}/build/outputs/default"
UNSIGNED_APP="$(find "${APP_OUTPUT_DIR}" -name '*.app' -type f 2>/dev/null | head -1)"
[ -z "$UNSIGNED_APP" ] && UNSIGNED_APP="$(find "${PROJECT_ROOT}" -name '*.app' -type f 2>/dev/null | head -1)"
if [ -z "$UNSIGNED_APP" ]; then
  echo "::error::No unsigned APP produced"
  exit 1
fi
echo "    ✓ Unsigned APP: ${UNSIGNED_APP} ($(du -h "${UNSIGNED_APP}" | cut -f1))"

# --- Sign APP ---------------------------------------------------------------
FINAL_APP="$UNSIGNED_APP"
SIGNED="false"
if [ "$SIGNING_ENABLED" = "true" ]; then
  echo "==> Signing APP with hap-sign-tool.jar (sign-app)"
  SIGN_TOOL_JAR="${OHOS_SDK_HOME}/default/openharmony/toolchains/lib/hap-sign-tool.jar"
  [ ! -f "$SIGN_TOOL_JAR" ] && SIGN_TOOL_JAR="$(find "$OHOS_SDK_HOME" -name hap-sign-tool.jar -type f 2>/dev/null | head -1)"
  if [ -z "${SIGN_TOOL_JAR:-}" ] || [ ! -f "$SIGN_TOOL_JAR" ]; then
    echo "::error::hap-sign-tool.jar not found in SDK"
    exit 1
  fi
  KEYSTORE_PATH="${SIGNING_DIR}/${KEYSTORE_FILE}"
  CERT_PATH="${SIGNING_DIR}/${CERT_FILE}"
  PROFILE_PATH="${SIGNING_DIR}/${PROFILE_FILE}"
  for f in "$KEYSTORE_PATH" "$CERT_PATH" "$PROFILE_PATH"; do
    [ -f "$f" ] || { echo "::error::signing material missing: $f"; exit 1; }
  done
  SIGNED_APP="${UNSIGNED_APP%.app}-signed.app"
  java -jar "$SIGN_TOOL_JAR" sign-app \
    -mode localSign \
    -keyAlias "${KEY_ALIAS}" \
    -keyPwd "${KEY_PASSWORD}" \
    -appCertFile "${CERT_PATH}" \
    -profileFile "${PROFILE_PATH}" \
    -inFile "${UNSIGNED_APP}" \
    -signAlg SHA256withECDSA \
    -keystoreFile "${KEYSTORE_PATH}" \
    -keystorePwd "${KEYSTORE_PASSWORD}" \
    -outFile "${SIGNED_APP}"
  if [ ! -f "$SIGNED_APP" ]; then
    echo "::error::APP signing failed"
    exit 1
  fi
  FINAL_APP="$SIGNED_APP"
  SIGNED="true"
  echo "    ✓ Signed APP: ${FINAL_APP} ($(du -h "${FINAL_APP}" | cut -f1))"
else
  echo "    (APP signing skipped — unsigned APP)"
fi

echo "app_path=${FINAL_APP}" >> "$GITHUB_OUTPUT"
echo "signed=${SIGNED}" >> "$GITHUB_OUTPUT"
echo "FINAL APP: ${FINAL_APP}"
