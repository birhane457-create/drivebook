# DriveBook - Driving Instructor Platform

A comprehensive platform for driving instructors and students to manage bookings, payments, and lessons.

## 🌟 Features

### For Instructors
- Dashboard with earnings and analytics
- Booking management
- GPS-verified check-in
- Custom branding (white label)
- Availability management
- Client management
- Document upload

### For Students
- Find and book instructors
- Wallet system with credits
- Booking history
- Reschedule lessons
- Progress tracking
- Review instructors

### For Admins
- Instructor approval system
- Revenue tracking
- Transaction management
- Support tickets
- Compliance monitoring

## 🚀 Quick Start

### Web Application

```bash
# Install dependencies
npm install

# Set up database
npx prisma migrate dev

# Run development server
npm run dev
```

Visit `http://localhost:3000`

### Mobile Application

See [docs/mobile/START_HERE.md](./docs/mobile/START_HERE.md) to get started with the mobile app.

```bash
# Install Capacitor
install-capacitor.bat

# Build for mobile
npm run mobile:build

# Open in Android Studio
npm run cap:android
```

## 📱 Mobile App Architecture

The mobile app uses **Capacitor** to wrap the Next.js web app into a native iOS/Android app.

**Key Features:**
- Single codebase for web + mobile
- Role-based navigation (Instructor/Client/Admin)
- Dynamic white-label branding per instructor
- Native features: GPS check-in, push notifications, camera

See [MOBILE_APP_GUIDE.md](./MOBILE_APP_GUIDE.md) for complete documentation.

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, React, TailwindCSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js
- **Payments**: Stripe
- **Mobile**: Capacitor
- **Maps**: Google Maps API
- **Storage**: Cloudinary
- **Email**: Resend/Nodemailer

## 📂 Project Structure

```
drivebook/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── admin/             # Admin dashboard
│   ├── dashboard/         # Instructor dashboard
│   └── client/            # Client pages
├── components/            # React components
│   ├── mobile/           # Mobile-specific components
│   └── ...
├── lib/                   # Utilities and helpers
│   ├── capacitor/        # Native features wrapper
│   └── ...
├── prisma/               # Database schema
├── public/               # Static assets
└── styles/               # CSS files
```

## 🔧 Configuration

### Environment Variables

Create `.env` file:

```env
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="http://localhost:3000"
STRIPE_SECRET_KEY="sk_test_..."
GOOGLE_MAPS_API_KEY="..."
CLOUDINARY_URL="cloudinary://..."
```

### Mobile Configuration

Update `capacitor.config.ts` for development:

```typescript
server: {
  url: 'http://YOUR_IP:3000',
  cleartext: true,
}
```

## 📚 Documentation

### Mobile App Documentation
- [Start Here](./docs/mobile/START_HERE.md) - Begin here for mobile setup
- [Quick Start](./docs/mobile/QUICK_START.md) - 5-minute setup guide
- [Complete Guide](./docs/mobile/COMPLETE_GUIDE.md) - Full documentation
- [Architecture](./docs/mobile/ARCHITECTURE.md) - System architecture
- [Implementation Checklist](./docs/mobile/IMPLEMENTATION_CHECKLIST.md) - Step-by-step guide
- [Why One App](./docs/mobile/WHY_ONE_APP.md) - Architecture decision
- [All Mobile Docs](./docs/mobile/) - Browse all mobile documentation

## 🧪 Testing

```bash
# Run tests
npm test

# Check types
npm run type-check

# Lint code
npm run lint
```

## 🚢 Deployment

### Web (Vercel)
```bash
npm run vercel-build
```

### Mobile (App Stores)

**Android:**
1. Build: `npm run mobile:build`
2. Open: `npm run cap:android`
3. Generate signed APK in Android Studio
4. Upload to Google Play Console

**iOS:**
1. Add iOS: `npx cap add ios`
2. Open: `npm run cap:ios`
3. Archive in Xcode
4. Upload to App Store Connect

## 📄 License

Proprietary - All rights reserved

## 🤝 Support

For support, email support@drivebook.com
