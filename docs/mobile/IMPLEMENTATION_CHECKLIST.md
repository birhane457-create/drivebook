# 📋 Mobile App Implementation Checklist

## Phase 1: Setup (Day 1)

### Installation
- [ ] Run `install-capacitor.bat`
- [ ] Verify Capacitor installed: `npx cap --version`
- [ ] Initialize Capacitor: `npx cap init`
- [ ] Add Android platform: `npx cap add android`
- [ ] (Optional) Add iOS platform: `npx cap add ios`

### Configuration
- [ ] Update `capacitor.config.ts` with your app details
- [ ] Configure `next.config.mobile.js` for static export
- [ ] Add mobile build scripts to `package.json` ✅
- [ ] Test build: `npm run mobile:build`

## Phase 2: Database & API (Day 1-2)

### Branding System
- [ ] Add branding fields to Prisma schema:
  ```prisma
  model User {
    brandingColor String? @default("#4F46E5")
    brandingLogo  String?
    businessName  String?
  }
  ```
- [ ] Run migration: `npx prisma migrate dev --name add_branding`
- [ ] Test branding API: `GET /api/branding?instructorId=xxx` ✅
- [ ] Create instructor branding settings page

### Push Notifications
- [ ] Create push token registration API: `POST /api/push/register`
- [ ] Add push token field to User model
- [ ] Set up Firebase Cloud Messaging (Android)
- [ ] Set up Apple Push Notification Service (iOS)
- [ ] Create notification sending service

## Phase 3: Mobile UI (Day 2-3)

### Role-Based Navigation
- [ ] Integrate `MobileLayout` component ✅
- [ ] Test instructor navigation
- [ ] Test client navigation
- [ ] Test admin navigation
- [ ] Add mobile-specific styling ✅

### Native Features Integration
- [ ] Implement GPS check-in ✅
- [ ] Test location permissions
- [ ] Test distance calculation
- [ ] Add haptic feedback ✅
- [ ] Test camera for document upload

### Branding Application
- [ ] Fetch branding on app load
- [ ] Apply CSS variables dynamically
- [ ] Test with multiple instructor brands
- [ ] Add fallback branding

## Phase 4: Testing (Day 3-4)

### Development Testing
- [ ] Test on Android emulator
- [ ] Test on iOS simulator (if macOS)
- [ ] Test on physical Android device
- [ ] Test on physical iOS device (if available)

### Feature Testing
- [ ] Login as instructor
- [ ] Login as client
- [ ] Login as admin
- [ ] Test GPS check-in within range
- [ ] Test GPS check-in out of range
- [ ] Test push notifications
- [ ] Test camera upload
- [ ] Test branding switching

### Edge Cases
- [ ] Test offline mode
- [ ] Test poor network conditions
- [ ] Test location permission denied
- [ ] Test camera permission denied
- [ ] Test with multiple users

## Phase 5: Polish (Day 4-5)

### UI/UX
- [ ] Add loading states
- [ ] Add error messages
- [ ] Add success feedback
- [ ] Optimize for different screen sizes
- [ ] Test on tablets
- [ ] Add splash screen
- [ ] Add app icon

### Performance
- [ ] Optimize image loading
- [ ] Minimize bundle size
- [ ] Test app startup time
- [ ] Profile memory usage
- [ ] Test battery impact

## Phase 6: Production Build (Day 5)

### Android
- [ ] Generate signing key
- [ ] Configure `build.gradle`
- [ ] Build signed APK
- [ ] Test signed APK on device
- [ ] Create Google Play listing
- [ ] Upload to Google Play Console
- [ ] Submit for review

### iOS (if applicable)
- [ ] Configure signing in Xcode
- [ ] Build archive
- [ ] Test on TestFlight
- [ ] Create App Store listing
- [ ] Upload to App Store Connect
- [ ] Submit for review

## Phase 7: Post-Launch

### Monitoring
- [ ] Set up crash reporting (Sentry/Firebase)
- [ ] Monitor app performance
- [ ] Track user analytics
- [ ] Monitor push notification delivery
- [ ] Track GPS check-in success rate

### Iteration
- [ ] Gather user feedback
- [ ] Fix reported bugs
- [ ] Add requested features
- [ ] Optimize based on analytics
- [ ] Plan next version

## Quick Commands Reference

```bash
# Development
npm run dev                    # Start dev server
npx cap sync                   # Sync changes
npx cap run android            # Run on Android

# Building
npm run mobile:build           # Build for mobile
npm run cap:sync              # Sync to native projects

# Opening IDEs
npm run cap:android           # Open Android Studio
npm run cap:ios               # Open Xcode

# Testing
npx cap run android           # Run on Android device
npx cap run ios               # Run on iOS device
```

## Estimated Timeline

- **Phase 1 (Setup)**: 2-4 hours
- **Phase 2 (Database & API)**: 4-6 hours
- **Phase 3 (Mobile UI)**: 8-12 hours
- **Phase 4 (Testing)**: 6-8 hours
- **Phase 5 (Polish)**: 4-6 hours
- **Phase 6 (Production)**: 4-6 hours
- **Total**: 28-42 hours (3.5-5 days)

## Success Criteria

✅ App installs and runs on Android/iOS
✅ Users can log in with their role
✅ Instructors see instructor dashboard
✅ Clients see client interface
✅ GPS check-in works within 100m
✅ Push notifications are received
✅ Branding changes per instructor
✅ App is submitted to stores

## Resources

- [Capacitor Docs](https://capacitorjs.com/docs)
- [Firebase Setup](https://firebase.google.com/docs/cloud-messaging)
- [Google Play Console](https://play.google.com/console)
- [App Store Connect](https://appstoreconnect.apple.com)

## Notes

- Start with Android (easier to test)
- iOS requires macOS and Apple Developer account ($99/year)
- Test on physical devices early
- Keep web and mobile in sync
- Use feature flags for mobile-only features
