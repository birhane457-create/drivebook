import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.drivebook.app',
  appName: 'DriveBook',
  webDir: 'www',
  server: {
    androidScheme: 'https',
    // Production: loads from the live DriveBook web app
    // For local dev: set CAPACITOR_SERVER_URL=http://YOUR_LAN_IP:3000 before running `npx cap sync`
    url: process.env.CAPACITOR_SERVER_URL || 'https://drivebook.com.au',
    // Only needed for local dev over HTTP — harmless when using HTTPS
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#4F46E5',
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
