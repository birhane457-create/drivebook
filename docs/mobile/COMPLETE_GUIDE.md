# DriveBook Mobile App - Complete Guide

## 🎯 Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│           Single Capacitor App Shell                │
│         (Wraps your Next.js website)                │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│              User Authentication                     │
│         (NextAuth with role detection)              │
└─────────────────────────────────────────────────────┘
                        ↓
        ┌───────────────┴───────────────┐
        ↓                               ↓
┌──────────────┐              ┌──────────────┐
│  INSTRUCTOR  │              │    CLIENT    │
│   Dashboard  │              │   Bookings   │
│   Check-in   │              │    Wallet    │
│   Earnings   │              │  Book Lesson │
│   Branding   │              │   Profile    │
└──────────────┘              └──────────────┘
        ↓                               ↓
┌─────────────────────────────────────────────────────┐
│           Dynamic Branding Layer                     │
│   (Fetches instructor colors/logo via API)         │
└─────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────┐
│           Native Features (Capacitor)                │
│  • Push Notifications (Booking alerts)              │
│  • GPS Check-in (Verify location)                   │
│  • Camera (Document upload)                         │
│  • Haptics (Feedback)                               │
│  • Local Notifications (Reminders)                  │
└─────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### 1. Install Capacitor
```bash
cd drivebook
install-capacitor.bat
```

Or manually:
```bash
npm install @capacitor/core @capacitor/cli
npm install @capacitor/ios @capacitor/android
npm install @capacitor/push-notifications @capacitor/geolocation @capacitor/camera
npx cap init
```

### 2. Build for Mobile
```bash
npm run mobile:build
```

This will:
- Generate Prisma client
- Build Next.js with static export
- Copy files to native projects

### 3. Open in Native IDE

**Android:**
```bash
npm run cap:android
```

**iOS (macOS only):**
```bash
npx cap add ios
npm run cap:ios
```

## 📱 Role-Based Navigation

### Instructor View
When a user logs in with `role: 'INSTRUCTOR'`, they see:
- Dashboard (earnings, stats)
- Bookings (upcoming lessons)
- Check-in (GPS-verified)
- Settings (branding, availability)

### Client View
When a user logs in with `role: 'CLIENT'`, they see:
- My Lessons (upcoming/past)
- Book (find instructors)
- Wallet (credits, transactions)
- Profile (settings)

### Admin View
When a user logs in with `role: 'ADMIN'`, they see:
- Full admin panel
- Instructor approvals
- Revenue tracking
- Support tickets

## 🎨 Dynamic Branding (White Label)

### How It Works
1. Client books with instructor (e.g., John)
2. App fetches: `GET /api/branding?instructorId=john123`
3. Response:
```json
{
  "primaryColor": "#4F46E5",
  "logo": "https://cloudinary.com/john-logo.png",
  "businessName": "John's Driving School"
}
```
4. App applies CSS variables dynamically
5. Client sees John's branded interface

### Adding Branding Fields to Database

Add to `prisma/schema.prisma`:
```prisma
model User {
  // ... existing fields
  brandingColor String? @default("#4F46E5")
  brandingLogo  String?
  businessName  String?
}
```

Then run:
```bash
npx prisma migrate dev --name add_branding_fields
```

## 🔔 Native Features

### 1. Push Notifications

**Setup:**
```typescript
import { setupPushNotifications } from '@/lib/capacitor/native-features';

// In your app initialization
useEffect(() => {
  setupPushNotifications();
}, []);
```

**Send from Backend:**
```typescript
// When a booking is created
await sendPushNotification({
  userId: instructorId,
  title: 'New Booking!',
  body: 'You have a new lesson request',
});
```

### 2. GPS Check-In

**Usage:**
```tsx
import CheckInButton from '@/components/mobile/CheckInButton';

<CheckInButton
  bookingId={booking.id}
  pickupLocation={{
    latitude: booking.pickupLatitude,
    longitude: booking.pickupLongitude,
  }}
  onSuccess={() => {
    // Refresh booking status
  }}
/>
```

**How It Works:**
1. Instructor arrives at pickup location
2. Taps "Check In" button
3. App gets GPS coordinates
4. Verifies within 100m of pickup point
5. Submits to backend with proof of location

### 3. Camera (Document Upload)

```typescript
import { takePicture } from '@/lib/capacitor/native-features';

const handleUploadDocument = async () => {
  const imageData = await takePicture();
  // Upload to Cloudinary
  await uploadToCloudinary(imageData);
};
```

### 4. Haptic Feedback

```typescript
import { hapticFeedback } from '@/lib/capacitor/native-features';

// On successful action
await hapticFeedback('medium');

// On error
await hapticFeedback('heavy');
```

## 🔧 Development Workflow

### Local Testing (Recommended)
```bash
# Terminal 1: Run Next.js dev server
npm run dev

# Terminal 2: Sync and run on device
npx cap sync
npx cap run android
```

Update `capacitor.config.ts` for development:
```typescript
server: {
  url: 'http://192.168.148.108:3000',
  cleartext: true,
}
```

### Production Build
```bash
npm run mobile:build
npx cap sync
npx cap open android  # Build APK in Android Studio
```

## 📦 App Store Deployment

### Android (Google Play)
1. Open in Android Studio: `npm run cap:android`
2. Build → Generate Signed Bundle/APK
3. Upload to Google Play Console
4. Cost: $25 one-time fee

### iOS (App Store)
1. Open in Xcode: `npm run cap:ios`
2. Product → Archive
3. Upload to App Store Connect
4. Cost: $99/year

## 🎯 Key Benefits of This Approach

✅ **Single Codebase**: One Next.js app for web + mobile
✅ **Role-Based**: Automatic UI switching based on user role
✅ **White Label**: Dynamic branding per instructor
✅ **Native Features**: GPS, push notifications, camera
✅ **Easy Maintenance**: Update once, deploy everywhere
✅ **Cost Effective**: One App Store listing ($99/year)

## 🐛 Troubleshooting

### "Cannot connect to server"
- Make sure dev server is running: `npm run dev`
- Check IP address matches in `capacitor.config.ts`
- Verify phone/emulator can reach your computer

### "Build failed"
- Run `npm run build:mobile` first
- Check `out/` directory exists
- Verify `next.config.mobile.js` is correct

### "Push notifications not working"
- Android: Configure Firebase Cloud Messaging
- iOS: Configure Apple Push Notification Service
- Register device token with backend

## 📚 Next Steps

1. ✅ Install Capacitor: `install-capacitor.bat`
2. ✅ Add branding fields to database
3. ✅ Test role-based navigation
4. ✅ Implement GPS check-in
5. ✅ Set up push notifications
6. ✅ Test on physical device
7. ✅ Build and deploy to stores

## 🔗 Resources

- [Capacitor Docs](https://capacitorjs.com/docs)
- [Next.js Static Export](https://nextjs.org/docs/app/building-your-application/deploying/static-exports)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [Google Play Console](https://play.google.com/console)
- [App Store Connect](https://appstoreconnect.apple.com)
