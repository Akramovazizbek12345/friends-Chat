import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'uz.friendspace.app',
  appName: 'FRIENDSPACE',
  webDir: '../public',
  server: {
    url: 'https://YOUR-FRIENDSPACE-URL.onrender.com',
    cleartext: false
  }
};

export default config;
