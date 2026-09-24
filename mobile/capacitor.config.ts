import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'uz.friendspace.app',
  appName: 'FRIENDSPACE',
  webDir: '..',
  server: {
    url: 'https://friends-chat-obei.onrender.com',
    cleartext: false
  }
};

export default config;
