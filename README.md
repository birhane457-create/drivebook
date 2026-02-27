# DriveBook - Driving Instructor Marketplace Platform

A marketplace platform for driving instructors with escrow-based booking payments, automated weekly settlement, and double-entry financial ledger.

## Platform Overview

DriveBook is a multi-instructor marketplace that handles:
- Escrow-based payment processing
- Weekly payout settlement (Monday-Sunday cycles)
- Double-entry financial ledger
- Automated cancellation policy enforcement
- Instructor compliance and document verification
- Real-time availability management

**Architecture:** Marketplace with financial settlement engine  
**Status:** Production booking system with ongoing financial infrastructure upgrades

---

## Core Architecture

### Financial System
- **Escrow Model:** Client payments held until lesson completion
- **Double-Entry Ledger:** Append-only financial records
- **Idempotent Transactions:** Duplicate-safe payment processing
- **Weekly Payout Batching:** Monday-Sunday settlement with 48h review window
- **Automated Refunds:** Policy-driven refund calculations (48h/24h rules)
- **Reconciliation:** Daily balance verification against Stripe

### Booking Engine
- Real-time availability with 15-minute granularity
- Google Calendar sync with auto-blocking
- Waiting list with automatic notifications
- Multi-step booking flow with package support
- GPS-based service area matching

### Compliance System
- Document verification (license, insurance, background check)
- Expiry tracking and notifications
- Admin approval workflow
- Instructor status management

---

## System Status

| Component | Status | Notes |
|-----------|--------|-------|
| Booking System | ✅ Stable | Production-ready |
| Payment Processing | ✅ Stable | Stripe integration complete |
| Financial Ledger | 🟡 Partial | Dual-write migration in progress |
| Payout Engine | 🟡 In Progress | Batch processing being implemented |
| Refund Automation | ✅ Implemented | Ledger integration ongoing |
| Mobile App | 🟡 Beta | Instructor features complete |
| Admin Dashboard | ✅ Stable | Full management capabilities |

**Legend:** ✅ Stable | 🟡 In Progress | 🔴 Planned

---

## Financial Architecture

### Payment Flow
```
Client Payment → Escrow → [Commission Split] → Instructor Payable
                              ↓
                        Platform Revenue
```

### Payout Cycle
- **Period:** Monday 00:00 - Sunday 23:59
- **Review Window:** 48 hours (Monday-Tuesday)
- **Execution:** Tuesday evening (automated batch)
- **Settlement:** Stripe Connect payouts

### Cancellation Policy
- **>48 hours:** 100% refund to client
- **24-48 hours:** 50% refund, 50% to instructor
- **<24 hours:** No refund, full instructor payout
- **Instructor no-show:** 100% refund + penalty

### Financial Controls
- Append-only ledger (no updates/deletes)
- Idempotency keys on all transactions
- Balance verification after each operation
- Daily reconciliation against Stripe
- Audit logging on all financial operations

---

## Quick Start

### Prerequisites
- Node.js 18+
- MongoDB Atlas account
- Stripe account
- Google OAuth credentials (for calendar sync)

### Installation

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your credentials

# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# Start development server
npm run dev
```

Visit: `http://localhost:3000`

---

## Documentation

### Core Documentation
- **[START_HERE.md](START_HERE.md)** - Platform overview and quick start
- **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** - Production deployment

### Financial System
- **[docs/financial/FINANCIAL_LEDGER_DESIGN.md](docs/financial/FINANCIAL_LEDGER_DESIGN.md)** - Ledger architecture
- **[docs/financial/LEDGER_QUICK_REFERENCE.md](docs/financial/LEDGER_QUICK_REFERENCE.md)** - Developer guide
- **[docs/financial/MARKETPLACE_PLATFORM_ROADMAP.md](docs/financial/MARKETPLACE_PLATFORM_ROADMAP.md)** - Business rules
- **[docs/financial/PRODUCTION_GRADE_ARCHITECTURE.md](docs/financial/PRODUCTION_GRADE_ARCHITECTURE.md)** - A+ implementation plan

### Operations
- **[docs/operations/ADMIN_QUICK_REFERENCE.md](docs/operations/ADMIN_QUICK_REFERENCE.md)** - Daily admin operations
- **[docs/operations/PLATFORM_OWNER_GUIDE.md](docs/operations/PLATFORM_OWNER_GUIDE.md)** - Platform management

### Systems
- **[docs/systems/COMPLIANCE_SYSTEM.md](docs/systems/COMPLIANCE_SYSTEM.md)** - Document verification
- **[docs/systems/PAYMENT_SYSTEM_GUIDE.md](docs/systems/PAYMENT_SYSTEM_GUIDE.md)** - Payment processing
- **[docs/systems/COMPLETE_BOOKING_FLOW_SPECIFICATION.md](docs/systems/COMPLETE_BOOKING_FLOW_SPECIFICATION.md)** - Booking flow

### Mobile App
- **[mobile/README.md](mobile/README.md)** - Mobile app documentation

---

## Tech Stack

### Core
- **Framework:** Next.js 14 (App Router)
- **Database:** MongoDB with Prisma ORM
- **Authentication:** NextAuth.js with JWT
- **Payments:** Stripe Connect
- **Email:** Nodemailer (SMTP)

### Financial
- **Ledger:** Double-entry accounting system
- **Idempotency:** Unique constraint enforcement
- **Reconciliation:** Automated daily checks
- **Audit:** Comprehensive logging

### Security
- **Authentication:** bcrypt password hashing, JWT sessions
- **Authorization:** Role-based access control (Admin, Instructor, Client)
- **Financial:** Append-only ledger, idempotency keys
- **Audit:** All financial operations logged
- **Rate Limiting:** API endpoint protection
- **Input Validation:** Zod schemas
- **Data Privacy:** PII sanitization in logs

---

## Environment Variables

Required variables:

```env
# Database
DATABASE_URL="mongodb+srv://..."

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"

# Stripe
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."

# Email
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
EMAIL_FROM="your-email@gmail.com"

# Google OAuth (optional - for calendar sync)
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GOOGLE_REDIRECT_URI="http://localhost:3000/api/calendar/callback"

# Cloudinary (for document uploads)
CLOUDINARY_CLOUD_NAME="..."
CLOUDINARY_API_KEY="..."
CLOUDINARY_API_SECRET="..."
```

See `.env.example` for complete list.

---

## Project Structure

```
app/
├── api/                    # API routes
│   ├── admin/             # Admin endpoints
│   ├── client/            # Client endpoints
│   ├── instructor/        # Instructor endpoints
│   └── public/            # Public endpoints
├── admin/                 # Admin dashboard
├── dashboard/             # Instructor dashboard
├── client-dashboard/      # Client dashboard
└── book/                  # Public booking flow

components/                # React components
lib/
├── services/             # Business logic
│   ├── ledger.ts        # Financial ledger
│   ├── ledger-operations.ts  # Ledger operations
│   ├── payment.ts       # Payment processing
│   ├── stripe.ts        # Stripe integration
│   ├── audit.ts         # Audit logging
│   └── email.ts         # Email service
└── prisma.ts            # Database client

prisma/
└── schema.prisma        # Database schema

docs/
├── financial/           # Financial system docs
├── operations/          # Operations guides
├── systems/             # System specifications
└── archive/             # Historical records

mobile/                  # React Native mobile app
```

---

## API Architecture

### Authentication
- `/api/auth/*` - NextAuth endpoints
- `/api/register` - User registration

### Public
- `/api/public/instructors` - Instructor directory
- `/api/public/bookings` - Public booking creation

### Client
- `/api/client/wallet` - Wallet management
- `/api/client/bookings` - Booking management
- `/api/client/profile` - Profile management

### Instructor
- `/api/instructor/profile` - Profile management
- `/api/instructor/earnings` - Earnings dashboard
- `/api/instructor/documents` - Document management

### Admin
- `/api/admin/instructors` - Instructor management
- `/api/admin/payouts` - Payout processing
- `/api/admin/revenue` - Revenue reporting
- `/api/admin/documents` - Document verification

---

## Development

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma db push

# Start development server
npm run dev

# View database
npx prisma studio

# Build for production
npm run build

# Start production server
npm start
```

---

## Testing

```bash
# Test mobile API connection
node scripts/test-mobile-api.js

# Check instructor documents
node scripts/check-instructor-documents.js

# Verify wallet balance
node scripts/check-wallet-deduction.js

# Test availability API
node scripts/test-availability-api.js
```

---

## Deployment

See **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** for:
- Environment setup
- Database configuration
- Stripe webhook setup
- Production checklist
- Monitoring and alerts

---

## Financial Policy

### Refund Rules
- Early cancellation (>48h): 100% refund
- Late cancellation (24-48h): 50% refund
- Very late (<24h): No refund
- Instructor no-show: 100% refund + penalty

### Payout Schedule
- Weekly cycle: Monday-Sunday
- Review window: 48 hours
- Execution: Tuesday evening
- Settlement: Stripe Connect

### Commission Structure
- Standard instructors: 15-20%
- Premium instructors: 10-12%
- New instructors: 20-25%

See **[docs/financial/MARKETPLACE_PLATFORM_ROADMAP.md](docs/financial/MARKETPLACE_PLATFORM_ROADMAP.md)** for complete policies.

---

## Security

### Financial Security
- Append-only ledger (immutable)
- Idempotency keys prevent duplicates
- Balance verification on every transaction
- Daily reconciliation
- Audit trail on all operations

### Application Security
- Password hashing (bcrypt)
- JWT session management
- Role-based access control
- Rate limiting on API endpoints
- Input validation (Zod)
- PII sanitization in logs
- HTTPS required in production

### Compliance
- Document verification workflow
- Expiry tracking
- Background check validation
- Insurance verification

---

## Support

For issues or questions:
1. Check documentation in `/docs`
2. Review audit logs for financial issues
3. Check Stripe dashboard for payment issues
4. Review Prisma Studio for data issues

---

## License

Private project - All rights reserved

---

**Last Updated:** February 24, 2026  
**Version:** 2.0 (Marketplace Platform)  
**Architecture Grade:** B+ (Financial core in progress)
