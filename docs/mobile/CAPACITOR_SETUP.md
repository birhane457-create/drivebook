# Capacitor Setup Guide - DriveBook Mobile App

## Overview
This guide sets up Capacitor to wrap your existing Next.js app into a native mobile app with role-based navigation and dynamic branding.

## Architecture
```
Next.js App (Web) → Capacitor Wrapper → iOS/Android Native App
```

## Step 1: Install Capacitor

```bash
cd drivebook
npm install @capacitor/core @capacitor/cli
npm install @capacitor/ios @capacitor/android
```

## Step 2: Initialize Capacitor

```bash
npx cap init
```

When prompted:
- App name: `DriveBook`
- App ID: `com.drivebook.app` (or your domain reversed)
- Web asset directory: `out` (for Next.js static export)

## Step 3: Configure Next.js for Static Export

Capacitor needs static files. We'll create a separate build config for mobile.

## Step 4: Add Native Platforms

```bash
# Add iOS (requires macOS)
npx cap add ios

# Add Android
npx cap add android
```

## Step 5: Build and Sync

```bash
# Build Next.js for mobile
npm run build:mobile

# Copy web assets to native projects
npx cap sync
```

## Step 6: Open in Native IDEs

```bash
# Open in Xcode (iOS)
npx cap open ios

# Open in Android Studio
npx cap open android
```

## Native Features to Implement

### 1. Push Notifications
```bash
npm install @capacitor/push-notifications
```

### 2. Geolocation (for check-in)
```bash
npm install @capacitor/geolocation
```

### 3. Camera (for document upload)
```bash
npm install @capacitor/camera
```

### 4. Local Notifications
```bash
npm install @capacitor/local-notifications
```

### 5. Haptics (for feedback)
```bash
npm install @capacitor/haptics
```

## Role-Based Navigation

The app will automatically show the correct interface based on user role:
- **INSTRUCTOR**: Dashboard, Check-in, Earnings, Branding
- **CLIENT**: Bookings, Wallet, Book Lessons
- **ADMIN**: Admin panel

## Dynamic Branding

When a client books with an instructor, the app fetches branding:
```typescript
GET /api/branding?instructorId=xxx
{
  primaryColor: "#4F46E5",
  logo: "https://...",
  businessName: "John's Driving School"
}
```

The app applies this dynamically using CSS variables.

## Testing

### Development
```bash
# Run Next.js dev server
npm run dev

# In another terminal, sync changes
npx cap sync

# Open in simulator/emulator
npx cap run ios
npx cap run android
```

### Production
```bash
npm run build:mobile
npx cap sync
npx cap open ios    # Build in Xcode
npx cap open android # Build in Android Studio
```

## Next Steps

1. ✅ Install Capacitor dependencies
2. ✅ Configure Next.js for static export
3. ✅ Add native platforms
4. ✅ Create branding API
5. ✅ Implement native features
6. ✅ Test on physical devices
7. ✅ Submit to App Store / Play Store
