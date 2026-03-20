# Mobile App - Quick Start 🚀

## What You Have

A **Capacitor mobile app** that connects to your **Next.js backend server**.

- ✅ Same API routes for web and mobile
- ✅ No code duplication
- ✅ Full Next.js features available

## Development (3 Steps)

### 1. Start Server
```bash
npm run mobile:dev
```
Server runs at `http://localhost:3000`

### 2. Open Mobile App
```bash
npm run cap:ios      # macOS only
npm run cap:android  # Requires Android Studio
```

### 3. Test
Mobile app loads from localhost:3000 and uses all your API routes.

## How It Works

```
┌─────────────────────┐
│  Mobile App         │
│  (Capacitor)        │
└──────────┬──────────┘
           │ HTTP
           ↓
┌─────────────────────┐
│  Next.js Server     │
│  localhost:3000     │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  API Routes         │
│  /app/api/*         │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  Database           │
│  (Prisma)           │
└─────────────────────┘
```

## Production

1. Deploy Next.js to Vercel: `vercel deploy`
2. Update `capacitor.config.ts` with your production URL
3. Build: `npm run mobile:build`
4. Open Xcode/Android Studio and publish

## Key Point

**The mobile app is just a native wrapper around your web app.** It connects to your Next.js server (local or deployed) and uses the exact same backend API as your web app.

No separate mobile backend needed! 🎉
