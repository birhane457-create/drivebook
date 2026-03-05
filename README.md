# DriveBook - Driving Instructor Platform

> **A controlled booking marketplace with a protected financial ledger**

A comprehensive marketplace platform connecting driving instructors with students, featuring AI voice booking, payment processing, and complete business management tools.

---

## 📚 DOCUMENTATION (NEW!)

**Complete foundation documentation now available!**

### 🎯 Quick Links
- 👉 **[INDEX.md](INDEX.md)** - Master index of all documentation
- 👉 **[docs/START_HERE.md](docs/START_HERE.md)** - Your entry point (60-minute learning path)
- 📋 **[CLEANUP_COMPLETE.md](CLEANUP_COMPLETE.md)** - Documentation cleanup summary

### 🏛️ Foundation (Read First)
- [CORE_ESSENCE.md](docs/00-foundation/CORE_ESSENCE.md) - What DriveBook is
- [SYSTEM_PRINCIPLES.md](docs/00-foundation/SYSTEM_PRINCIPLES.md) - 5 non-negotiable principles
- [FINANCIAL_DOCTRINE.md](docs/00-foundation/FINANCIAL_DOCTRINE.md) - Money flow rules
- [STATE_MACHINE.md](docs/00-foundation/STATE_MACHINE.md) - Booking states

### 📖 Quick Reference
- [What We Built Today](WHAT_WE_BUILT_TODAY.md) - Foundation summary
- [Foundation Complete](docs/FOUNDATION_COMPLETE.md) - Detailed overview
- [Production Hardening](PRODUCTION_HARDENING_FINAL.md) - Production readiness

---

## 🔴 THE 8 NON-NEGOTIABLES

1. No transaction updates - Only adjustments
2. No state skipping - Must follow progression
3. No payout without completion
4. Audit log required for money movements
5. Role-based access only
6. Daily wallet reconciliation
7. Refund after payout blocked (except admin override)
8. Atomic financial operations

---

## 💡 THE 5 PRINCIPLES

1. Financial History Is Immutable
2. Money Cannot Be Created or Destroyed
3. State Machine Control
4. After Start Time = Frozen
5. Every Financial Action Must Be Logged

---

## 🚀 Quick Start

**New to the project?** Follow this order:

1. **[START_HERE.md](START_HERE.md)** - 10-minute quick setup
2. **[DEV_GUIDE.md](DEV_GUIDE.md)** - Development workflow  
3. **[DEPLOYMENT.md](DEPLOYMENT.md)** - Production deployment
4. **[PLATFORM_RULES.md](PLATFORM_RULES.md)** - ⚠️ MANDATORY operational requirements

**Setup Guides:**
- [docs/STRIPE_SETUP_GUIDE.md](docs/STRIPE_SETUP_GUIDE.md) - Payment configuration
- [docs/TWILIO_SETUP_GUIDE.md](docs/TWILIO_SETUP_GUIDE.md) - SMS/Voice setup

---

## 📁 Project Structure

```
drivebook/
├── app/                          # Next.js 14 app (main platform)
├── drivebook-hybrid/             # Voice service microservice
│   ├── server.js                 # Express server
│   ├── routes/                   # Voice webhooks
│   ├── services/                 # Business logic
│   └── docs/                     # 📚 MAIN DOCUMENTATION
│       ├── ESSENTIAL_DOCS_INDEX.md
│       ├── ARCHITECTURE.md
│       ├── QUICK_REFERENCE.md
│       ├── financial/            # Financial system docs
│       ├── operations/           # Admin & ops guides
│       └── systems/              # System specifications
├── docs-archive/                 # Historical docs (reference only)
└── README.md                     # This file
```

---

## 📚 Essential Documentation

### Core Guides
- **[drivebook-hybrid/docs/ESSENTIAL_DOCS_INDEX.md](drivebook-hybrid/docs/ESSENTIAL_DOCS_INDEX.md)** - Documentation structure
- **[drivebook-hybrid/docs/ARCHITECTURE.md](drivebook-hybrid/docs/ARCHITECTURE.md)** - System architecture
- **[drivebook-hybrid/docs/QUICK_REFERENCE.md](drivebook-hybrid/docs/QUICK_REFERENCE.md)** - Developer quick reference

### Financial System
- **[drivebook-hybrid/docs/financial/FINANCIAL_LEDGER_DESIGN.md](drivebook-hybrid/docs/financial/FINANCIAL_LEDGER_DESIGN.md)** - Ledger architecture
- **[drivebook-hybrid/docs/financial/LEDGER_QUICK_REFERENCE.md](drivebook-hybrid/docs/financial/LEDGER_QUICK_REFERENCE.md)** - Developer reference
- **[drivebook-hybrid/docs/financial/MARKETPLACE_PLATFORM_ROADMAP.md](drivebook-hybrid/docs/financial/MARKETPLACE_PLATFORM_ROADMAP.md)** - Business rules

### Operations
- **[drivebook-hybrid/docs/operations/ADMIN_QUICK_REFERENCE.md](drivebook-hybrid/docs/operations/ADMIN_QUICK_REFERENCE.md)** - Admin daily operations
- **[drivebook-hybrid/docs/operations/PLATFORM_OWNER_GUIDE.md](drivebook-hybrid/docs/operations/PLATFORM_OWNER_GUIDE.md)** - Platform management

### System Specifications
- **[drivebook-hybrid/docs/systems/PAYMENT_SYSTEM_GUIDE.md](drivebook-hybrid/docs/systems/PAYMENT_SYSTEM_GUIDE.md)** - Payment & subscriptions
- **[drivebook-hybrid/docs/systems/COMPLETE_BOOKING_FLOW_SPECIFICATION.md](drivebook-hybrid/docs/systems/COMPLETE_BOOKING_FLOW_SPECIFICATION.md)** - Booking flow
- **[drivebook-hybrid/docs/systems/COMPLIANCE_SYSTEM.md](drivebook-hybrid/docs/systems/COMPLIANCE_SYSTEM.md)** - Document compliance

### Setup Guides
- **[docs/STRIPE_SETUP_GUIDE.md](docs/STRIPE_SETUP_GUIDE.md)** - Payment configuration
- **[docs/TWILIO_SETUP_GUIDE.md](docs/TWILIO_SETUP_GUIDE.md)** - SMS/Voice setup
- **[drivebook-hybrid/docs/AI_VOICE_RECEPTIONIST_GUIDE.md](drivebook-hybrid/docs/AI_VOICE_RECEPTIONIST_GUIDE.md)** - Voice AI setup

---

## 🎯 Key Features

- 📱 Customer booking portal
- 👨‍🏫 Instructor dashboard & management
- 💳 Stripe payment processing & subscriptions
- 📞 AI voice receptionist (Twilio + Copilot)
- � Email & SMS notifications
- 📊 Financial ledger & analytics
- 🔐 Secure authentication (NextAuth)
- 💰 Wallet system & package management

---

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript, TailwindCSS
- **Backend**: Next.js API Routes, Express.js (voice service)
- **Database**: MongoDB (main), SQLite (voice cache)
- **Payments**: Stripe
- **Communications**: Twilio (SMS/Voice), Resend (Email)
- **AI**: Microsoft Copilot Studio
- **Auth**: NextAuth.js
- **ORM**: Prisma

---

## 🔧 Development

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your credentials

# Generate Prisma client
npx prisma generate

# Start development server
npm run dev
```

Visit http://localhost:3000

**For detailed setup:** See [DEV_GUIDE.md](DEV_GUIDE.md)

---

## 🚀 Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete deployment instructions.

**Quick Deploy:**
- Main App → Vercel
- Voice Service → Railway/Heroku

---

## 📖 Documentation Philosophy

**What We Keep:**
- Standards we follow
- System architecture we implement
- Business rules we enforce
- Operational procedures we execute
- Technical specifications we build to

**What We Archive:**
- Historical "fix" documents → `docs-archive/`
- Session summaries → `docs-archive/`
- Investigation reports → `docs-archive/`
- Audit reports → `docs-archive/`

**Why:** The system IS the documentation. Code reflects current state. Standards guide future work.

---

## 📞 Support

**For Development Questions:**
1. Check [drivebook-hybrid/docs/QUICK_REFERENCE.md](drivebook-hybrid/docs/QUICK_REFERENCE.md)
2. Review [drivebook-hybrid/docs/ESSENTIAL_DOCS_INDEX.md](drivebook-hybrid/docs/ESSENTIAL_DOCS_INDEX.md)
3. Search `docs-archive/` for historical context

**For Operations:**
1. Use [drivebook-hybrid/docs/operations/ADMIN_QUICK_REFERENCE.md](drivebook-hybrid/docs/operations/ADMIN_QUICK_REFERENCE.md)
2. Refer to [PLATFORM_RULES.md](PLATFORM_RULES.md)

---

**Current Status:** Active Development  
**Last Updated:** March 3, 2026
