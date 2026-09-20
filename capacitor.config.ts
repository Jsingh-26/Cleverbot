import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jsingh26.cleverbot',
  appName: 'Cleverbot',
  webDir: 'dist',
  server: {
    url: 'https://cleverbot.netlify.app',
    cleartext: false,
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
  },
};

export default config;
