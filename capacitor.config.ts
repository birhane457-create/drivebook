import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.drivebook.app',
  appName: 'DriveBook',
  webDir: 'out',
  server: {
    androidScheme: 'https',
    // For development, you can use your local server
    // url: 'http://192.168.148.108:3000',
    // cleartext: true,
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
