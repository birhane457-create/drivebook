# 🚀 DriveBook Mobile - Quick Start

## Install (5 minutes)

```bash
cd drivebook
install-capacitor.bat
```

## Build & Run (2 minutes)

```bash
# Build for mobile
npm run mobile:build

# Open Android Studio
npm run cap:android
```

## Development Mode

```bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Run on device
npx cap run android
```

Update `capacitor.config.ts`:
```typescript
server: {
  url: 'http://YOUR_IP:3000',  // Get from ipconfig
  cleartext: true,
}
```

## Key Files Created

```
drivebook/
├── capacitor.config.ts              # Capacitor configuration
├── next.config.mobile.js            # Mobile build config
├── install-capacitor.bat            # Installation script
├── app/api/branding/route.ts        # Branding API
├── components/mobile/
│   ├── MobileLayout.tsx             # Role-based navigation
│   └── CheckInButton.tsx            # GPS check-in
├── lib/capacitor/
│   └── native-features.ts           # Native APIs wrapper
└── styles/mobile.css                # Mobile-specific styles
```

## How It Works

1. **One App, Multiple Roles**
   - Login → Check user role
   - INSTRUCTOR → Dashboard, Check-in, Earnings
   - CLIENT → Bookings, Wallet, Book Lessons

2. **Dynamic Branding**
   - Fetch instructor branding via API
   - Apply colors/logo dynamically
   - Each instructor gets their own look

3. **Native Features**
   - Push notifications for bookings
   - GPS check-in verification
   - Camera for document upload
   - Haptic feedback

## Commands

```bash
# Install dependencies
install-capacitor.bat

# Build for mobile
npm run mobile:build

# Sync changes to native projects
npm run cap:sync

# Open Android Studio
npm run cap:android

# Open Xcode (macOS only)
npm run cap:ios

# Run on device
npx cap run android
npx cap run ios
```

## Testing Checklist

- [ ] Install Capacitor
- [ ] Build mobile app
- [ ] Test instructor login
- [ ] Test client login
- [ ] Test GPS check-in
- [ ] Test branding API
- [ ] Test on physical device
- [ ] Build production APK

## Production Deployment

### Android
1. `npm run mobile:build`
2. `npm run cap:android`
3. Build → Generate Signed Bundle
4. Upload to Google Play

### iOS
1. `npx cap add ios`
2. `npm run cap:ios`
3. Product → Archive
4. Upload to App Store

## Need Help?

See `MOBILE_APP_GUIDE.md` for detailed documentation.

## Architecture Diagram

```
┌──────────────────────────────────────┐
│     Single Next.js App (Web)         │
└──────────────────────────────────────┘
                 ↓
┌──────────────────────────────────────┐
│      Capacitor Wrapper (Native)      │
└──────────────────────────────────────┘
                 ↓
        ┌────────┴────────┐
        ↓                 ↓
┌──────────────┐  ┌──────────────┐
│  INSTRUCTOR  │  │    CLIENT    │
│   Dashboard  │  │   Bookings   │
└──────────────┘  └──────────────┘
```

## Benefits

✅ One codebase for web + mobile
✅ Role-based UI automatically
✅ White label branding per instructor
✅ Native features (GPS, push, camera)
✅ Easy maintenance
✅ One App Store listing
