# DriveBook Voice Service (Express Microservice)

This is a minimal Express.js microservice for handling Twilio voice webhooks.

## What This Service Does

- Handles incoming Twilio voice calls
- Provides webhook endpoints for voice interactions
- Runs on Railway (not Vercel)

## What's Deployed

**Railway runs:** `npm start` → `node server.js`

**Endpoints served:**
- `GET /api/health` - Health check
- `POST /api/voice/incoming` - Twilio incoming call webhook
- `POST /api/voice/voicemail` - Twilio voicemail webhook
- `POST /api/bookings` - Booking creation (Express route)
- `GET /api/instructor/lookup` - Instructor lookup by phone

## Important Notes

### ⚠️ Next.js Files Removed

This folder previously contained duplicate Next.js files (`app/`, `components/`, `lib/`, etc.) that were NOT used by Railway.

**They have been removed to avoid confusion.**

All Next.js API routes are now in the main app (`../`) which runs on Vercel.

### What Remains

```
drivebook-hybrid/
├── routes/          ✅ Express routes (used by server.js)
├── services/        ✅ Business logic
├── middleware/      ✅ Auth, logging
├── utils/           ✅ Config, logger
├── prisma/          ✅ Database schema (shared with main app)
├── server.js        ✅ Express server entry point
├── package.json     ✅ Dependencies
└── README.md        ✅ This file
```

### What Was Removed

```
❌ app/              (Next.js routes - moved to main app)
❌ components/       (React components - not used by Express)
❌ lib/              (Next.js utilities - not used by Express)
❌ types/            (TypeScript types - not used by Express)
❌ public/           (Static files - not served by Express)
❌ next.config.js    (Next.js config - not needed)
❌ tailwind.config.ts (Tailwind config - not needed)
❌ tsconfig.json     (TypeScript config - not needed)
❌ .vercelignore     (Vercel config - not needed)
❌ .prettierrc       (Prettier config - not needed)
❌ .eslintrc.json    (ESLint config - not needed)
❌ middleware.ts     (Next.js middleware - not needed)
```

## Architecture

### Before Cleanup
```
drivebook-hybrid/
├── server.js (Express)
├── routes/ (Express routes) ✅ Used
├── app/ (Next.js routes) ❌ NOT used
├── components/ (React) ❌ NOT used
└── ... (lots of unused Next.js files)
```

### After Cleanup
```
drivebook-hybrid/
├── server.js (Express) ✅ Used
├── routes/ (Express routes) ✅ Used
├── services/ ✅ Used
├── middleware/ ✅ Used
└── utils/ ✅ Used
```

## Main App vs Voice Service

### Main App (../) - Vercel
- Full Next.js application
- All web UI (admin, client, instructor portals)
- Next.js API routes (automatically served)
- Public website
- **URL:** https://drivebook.com.au

### Voice Service (this folder) - Railway
- Express.js microservice
- Twilio webhooks only
- No web UI
- Minimal API surface
- **URL:** https://drivebook-production-12ab.up.railway.app

## Development

### Run Locally
```bash
npm install
npm run dev
```

### Deploy to Railway
Railway automatically deploys when you push to the repository.

### Environment Variables
See `.env.example` for required environment variables.

## API Routes

All AI voice API routes are now in the main app:
- `/api/instructors/recommendations` - Main app (Vercel)
- `/api/locations/validate` - Main app (Vercel)
- `/api/packages` - Main app (Vercel)
- `/api/public/bookings/bulk` - Main app (Vercel)

This service only handles Twilio webhooks.

## Questions?

If you need to add new API routes for the AI voice service, add them to the **main app** (`../app/api/`), not here.

This service should remain minimal and focused on Twilio webhooks only.

---

**Last Updated:** March 6, 2026  
**Cleanup:** Removed unused Next.js files to avoid confusion
