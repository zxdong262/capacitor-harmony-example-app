// The `capacitor-harmony` runtime injects `Capacitor.nativePromise` from the
// native bridge (used to call native plugins such as the embedded Node
// runtime). `@capacitor/core` doesn't type it, so we augment the interface
// here. It only exists on the HarmonyOS platform — guard calls with
// `Capacitor.isNativePlatform()`.
import '@capacitor/core';

declare module '@capacitor/core' {
  interface CapacitorGlobal {
    nativePromise<T = unknown>(
      pluginName: string,
      methodName: string,
      options?: unknown
    ): Promise<T>;
  }
}
