import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bon.gestion',
  appName: 'BON',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;