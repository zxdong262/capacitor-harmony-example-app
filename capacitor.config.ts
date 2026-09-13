import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.example.harmonydemo',
  appName: 'HarmonyDemo',
  webDir: 'www',
  // NOTE: no `server.url` here — production loads from the local asset
  // server (http://localhost/ serving rawfile/www). A dev-server URL would
  // break the packaged app on-device (white screen when offline).
  harmony: {
    nodeEntry: 'main.js',
    autostartNode: true,
  },
};

export default config;
