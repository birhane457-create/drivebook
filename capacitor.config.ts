import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.drivebook.app',
  appName: 'DriveBook',
  webDir: 'www',
  server: {
    androidScheme: 'https',
    // Your computer's IP on phone hotspot network
    url: process.env.CAPACITOR_SERVER_URL || 'http://192.168.148.108:3000',
    cleartext: true, // Allow HTTP for local development
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
