# 🏗️ DriveBook Mobile Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER DEVICES                              │
│  📱 iOS App          📱 Android App         💻 Web Browser      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    CAPACITOR WRAPPER                             │
│  • Wraps Next.js app in native shell                            │
│  • Provides access to native APIs                               │
│  • Handles platform-specific features                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    NEXT.JS APPLICATION                           │
│  • Server-side rendering (dev)                                  │
│  • Static export (production mobile)                            │
│  • API routes for backend logic                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   AUTHENTICATION LAYER                           │
│  NextAuth.js → Check user role → Route to correct interface     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
        ┌─────────────────────┼─────────────────────┐
        ↓                     ↓                     ↓
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  INSTRUCTOR  │    │    CLIENT    │    │    ADMIN     │
│   INTERFACE  │    │  INTERFACE   │    │  INTERFACE   │
└──────────────┘    └──────────────┘    └──────────────┘
        ↓                     ↓                     ↓
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ • Dashboard  │    │ • Bookings   │    │ • Approvals  │
│ • Check-in   │    │ • Book       │    │ • Revenue    │
│ • Earnings   │    │ • Wallet     │    │ • Support    │
│ • Branding   │    │ • Profile    │    │ • Settings   │
└──────────────┘    └──────────────┘    └──────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    NATIVE FEATURES LAYER                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ Push Notify  │  │ Geolocation  │  │   Camera     │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Haptics    │  │ Local Notify │  │ Splash Screen│         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND SERVICES                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  PostgreSQL  │  │    Stripe    │  │  Cloudinary  │         │
│  │   Database   │  │   Payments   │  │   Storage    │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ Google Maps  │  │   Firebase   │  │    Resend    │         │
│  │     API      │  │     FCM      │  │    Email     │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow Examples

### 1. User Login Flow

```
User enters credentials
        ↓
NextAuth validates
        ↓
Check user role in database
        ↓
    ┌───┴───┐
    ↓       ↓
INSTRUCTOR  CLIENT
    ↓       ↓
Dashboard   Bookings
```

### 2. GPS Check-In Flow

```
Instructor taps "Check In"
        ↓
Capacitor Geolocation API
        ↓
Get current GPS coordinates
        ↓
Calculate distance to pickup
        ↓
    ┌───┴───┐
    ↓       ↓
< 100m    > 100m
    ↓       ↓
Success   Error
    ↓
POST /api/bookings/[id]/check-in
    ↓
Update booking status
    ↓
Send push notification to client
```

### 3. Dynamic Branding Flow

```
Client books with Instructor A
        ↓
App detects instructorId in URL
        ↓
GET /api/branding?instructorId=A
        ↓
Receive: { color: "#FF0000", logo: "..." }
        ↓
Apply CSS variables
        ↓
App UI changes to red theme
        ↓
Client sees Instructor A's branding
```

### 4. Push Notification Flow

```
New booking created
        ↓
Backend triggers notification
        ↓
Firebase Cloud Messaging
        ↓
    ┌───┴───┐
    ↓       ↓
  iOS     Android
    ↓       ↓
APNS      FCM
    ↓       ↓
Device receives notification
        ↓
User taps notification
        ↓
App opens to booking details
```

## Component Architecture

```
app/
├── layout.tsx (Root layout)
│   └── MobileLayout.tsx (Detects Capacitor)
│       ├── Role detection
│       ├── Branding fetch
│       └── Navigation
│
├── (instructor)/
│   ├── dashboard/
│   │   └── page.tsx
│   ├── bookings/
│   │   └── [id]/
│   │       └── CheckInButton.tsx (GPS)
│   └── earnings/
│       └── page.tsx
│
├── (client)/
│   ├── bookings/
│   │   └── page.tsx
│   ├── wallet/
│   │   └── page.tsx
│   └── book/
│       └── [instructorId]/
│           └── page.tsx (Branding applied)
│
└── api/
    ├── branding/
    │   └── route.ts
    ├── push/
    │   └── register/
    │       └── route.ts
    └── bookings/
        └── [id]/
            └── check-in/
                └── route.ts
```

## Native Features Integration

### Geolocation
```typescript
import { Geolocation } from '@capacitor/geolocation';

const position = await Geolocation.getCurrentPosition();
// Returns: { coords: { latitude, longitude } }
```

### Push Notifications
```typescript
import { PushNotifications } from '@capacitor/push-notifications';

await PushNotifications.register();
// Receives token → Send to backend
```

### Camera
```typescript
import { Camera } from '@capacitor/camera';

const photo = await Camera.getPhoto({
  resultType: CameraResultType.DataUrl
});
// Returns: base64 image data
```

### Haptics
```typescript
import { Haptics } from '@capacitor/haptics';

await Haptics.impact({ style: ImpactStyle.Medium });
// Provides tactile feedback
```

## Build Process

### Development
```
npm run dev
    ↓
Next.js dev server (port 3000)
    ↓
Capacitor points to localhost
    ↓
Live reload on device
```

### Production
```
npm run mobile:build
    ↓
Next.js static export → out/
    ↓
npx cap sync
    ↓
Copy to ios/ and android/
    ↓
Open in Xcode/Android Studio
    ↓
Build native app
    ↓
Submit to App Store / Play Store
```

## Security Considerations

1. **API Authentication**
   - All API calls use NextAuth session
   - JWT tokens for mobile auth
   - Secure token storage

2. **Location Privacy**
   - GPS only used for check-in
   - Location not stored permanently
   - User consent required

3. **Push Notifications**
   - Tokens encrypted in transit
   - User can opt-out
   - No sensitive data in notifications

4. **Branding**
   - Validated instructor IDs
   - Sanitized CSS injection
   - Rate limiting on API

## Performance Optimization

1. **Static Export**
   - Pre-rendered pages
   - Faster initial load
   - Reduced server load

2. **Image Optimization**
   - Cloudinary CDN
   - Responsive images
   - Lazy loading

3. **Code Splitting**
   - Route-based splitting
   - Dynamic imports
   - Smaller bundles

4. **Caching**
   - Service worker (PWA)
   - API response caching
   - Asset caching

## Scalability

- **Horizontal Scaling**: Multiple Next.js instances
- **Database**: PostgreSQL with connection pooling
- **CDN**: Cloudinary for images, Vercel for static assets
- **Push**: Firebase handles millions of devices
- **Monitoring**: Sentry for error tracking

## Future Enhancements

- [ ] Offline mode with local storage
- [ ] Background location tracking for lessons
- [ ] In-app messaging between instructor/client
- [ ] Video call integration
- [ ] Advanced analytics dashboard
- [ ] Multi-language support
- [ ] Dark mode
- [ ] Accessibility improvements
