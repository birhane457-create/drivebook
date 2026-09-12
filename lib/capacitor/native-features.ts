// @ts-nocheck
// Capacitor Native Features Helper
// This file provides a clean interface to native mobile features

import { Capacitor } from '@capacitor/core';

// Check if running in native app
export const isNative = () => {
  return Capacitor.isNativePlatform();
};

// Platform detection
export const getPlatform = () => {
  return Capacitor.getPlatform(); // 'ios', 'android', or 'web'
};

// Push Notifications
export const setupPushNotifications = async () => {
  if (!isNative()) return;

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    // Request permission
    const permission = await PushNotifications.requestPermissions();
    
    if (permission.receive === 'granted') {
      await PushNotifications.register();
      
      // Listen for registration
      PushNotifications.addListener('registration', (token) => {
        console.log('Push registration success, token:', token.value);
        // Send token to your backend
        sendTokenToBackend(token.value);
      });

      // Listen for push notifications
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('Push received:', notification);
      });

      // Handle notification tap
      PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log('Push action performed:', notification);
        // Navigate to relevant screen
      });
    }
  } catch (error) {
    console.error('Error setting up push notifications:', error);
  }
};

// Geolocation (for check-in)
export const getCurrentLocation = async () => {
  if (!isNative()) {
    // Fallback to web geolocation
    return new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
        reject
      );
    });
  }

  try {
    const { Geolocation } = await import('@capacitor/geolocation');
    const position = await Geolocation.getCurrentPosition();
    
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
  } catch (error) {
    console.error('Error getting location:', error);
    throw error;
  }
};

// Camera (for document upload)
export const takePicture = async () => {
  if (!isNative()) {
    throw new Error('Camera only available in native app');
  }

  try {
    const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
    
    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera,
    });

    return image.dataUrl;
  } catch (error) {
    console.error('Error taking picture:', error);
    throw error;
  }
};

// Haptic Feedback
export const hapticFeedback = async (type: 'light' | 'medium' | 'heavy' = 'medium') => {
  if (!isNative()) return;

  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    
    const style = {
      light: ImpactStyle.Light,
      medium: ImpactStyle.Medium,
      heavy: ImpactStyle.Heavy,
    }[type];

    await Haptics.impact({ style });
  } catch (error) {
    console.error('Error with haptic feedback:', error);
  }
};

// Local Notifications
export const scheduleNotification = async (title: string, body: string, date: Date) => {
  if (!isNative()) return;

  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    
    await LocalNotifications.schedule({
      notifications: [
        {
          title,
          body,
          id: Date.now(),
          schedule: { at: date },
        },
      ],
    });
  } catch (error) {
    console.error('Error scheduling notification:', error);
  }
};

// Helper to send push token to backend
const sendTokenToBackend = async (token: string) => {
  try {
    await fetch('/api/push/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, platform: getPlatform() }),
    });
  } catch (error) {
    console.error('Error sending token to backend:', error);
  }
};
