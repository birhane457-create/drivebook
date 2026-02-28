# DriveBook System Analysis - Complete Overview

**Generated:** February 28, 2026  
**Analysis Type:** Deep System Inspection  
**Status:** Production-Ready Marketplace Platform

---

## 🎯 WHAT IS DRIVEBOOK?

DriveBook is a **multi-instructor marketplace platform** for driving lessons with sophisticated financial management. Think of it as "Uber for Driving Lessons" but with escrow-based payments, automated settlements, and comprehensive compliance tracking.

### Core Value Proposition
- **For Clients:** Book driving lessons with verified instructors, secure payments, flexible scheduling
- **For Instructors:** Manage bookings, track earnings, automated payouts, calendar integration
- **For Platform Owner:** Automated financial operations, compliance management, fraud detection

---

## 🏗️ SYSTEM ARCHITECTURE

### Technology Stack

```
Frontend:
├── Next.js 14 (App Router) - React framework with server components
├── TypeScript - Type safety
├── Tailwind CSS - Styling
└── Lucide React - Icons

Backend:
├── Next.js API Routes - RESTful API
├── NextAuth.js - Authentication & sessions
├── Prisma ORM - Database abstraction
└── MongoDB - NoSQL database

Integrations:
├── Stripe Connect - Payment processing & payouts
├── Google Calendar API - Availability sync
├── Cloudinary - Document/image storage
├── Nodemailer - Email notifications
└── Twilio (optional) - SMS notifications
```

### Database Architecture (MongoDB + Prisma)

**Core Entities:**
1. **User** - Authentication (email/password, roles)
2. **Instructor** - Instructor profiles, settings, subscription
3. **Client** - Client profiles, preferences
4. **Booking** - Lesson bookings (lifecycle management)
5. **Transaction** - Financial ledger (double-entry)
6. **Payout** - Instructor payouts (weekly batches)
7. **ClientWallet** - Client credit system
8. **Task** - Staff task management
9. **Review** - Rating system
10. **AuditLog** - Compliance & forensics

---

## 💰 FINANCIAL SYSTEM - THE HEART OF THE PLATFORM

### Payment Flow Architecture

```
┌─────────────┐
│   CLIENT    │
│  Payment    │
└──────┬──────┘
       │ $100 (Stripe Charge)
       ↓
┌─────────────────────┐
│   ESCROW ACCOUNT    │ ← Money held until lesson completion
│  (Platform Stripe)  │
└──────┬──────────────┘
       │ After lesson completion
       ├─→ $15 Platform Commission
       └─→ $85 Instructor Payout (weekly batch)
```

### Double-Entry Ledger System

**Every financial transaction creates TWO entries:**

```typescript
// Example: Client pays $100 for lesson
Transaction 1: DEBIT  - Client Wallet    -$100
Transaction 2: CREDIT - Instructor Payable +$85
Transaction 3: CREDIT - Platform Revenue   +$15
```

**Key Features:**
- **Append-only:** No updates/deletes (immutable audit trail)
- **Idempotent:** Duplicate-safe with unique keys
- **Balanced:** Sum of debits = Sum of credits (always)
- **Reconciled:** Daily verification against Stripe

### Payout Engine

**Weekly Settlement Cycle:**
```
Monday 00:00 ────────────────────────────────→ Sunday 23:59
                    (Booking Week)

Monday-Tuesday ──────────────────────────────→ 48h Review Window
                    (Dispute period)

Tuesday Evening ─────────────────────────────→ Automated Batch Payout
                    (Stripe Connect transfer)
```

**Payout Calculation:**
```typescript
Instructor Earnings = Σ(Completed Bookings) - Platform Commission - Refunds - Penalties
```

### Cancellation Policy (Automated)

| Timeframe | Client Refund | Instructor Gets | Platform Action |
|-----------|---------------|-----------------|-----------------|
| >48 hours | 100% | 0% | Full refund |
| 24-48 hours | 50% | 50% | Split payment |
| <24 hours | 0% | 100% | No refund |
| Instructor no-show | 100% + penalty | -penalty | Instructor penalized |

---

## 📅 BOOKING SYSTEM

### Booking Lifecycle State Machine

```
PENDING → CONFIRMED → COMPLETED
   ↓          ↓           ↓
CANCELLED  CANCELLED   REVIEWED
```

**States:**
1. **PENDING** - Created, awaiting payment
2. **CONFIRMED** - Paid, scheduled
3. **COMPLETED** - Lesson finished, check-in/out recorded
4. **CANCELLED** - Cancelled (refund processed based on policy)
5. **REVIEWED** - Client left review

### Availability Management

**Real-time Slot Calculation:**
```typescript
Available Slots = 
  Instructor Working Hours
  - Existing Bookings
  - Google Calendar Events (if synced)
  - Buffer Time (15 min default)
  - Travel Time (optional)
```

**Features:**
- 15-minute granularity
- GPS-based service area matching
- Automatic Google Calendar blocking
- Waiting list with auto-notifications
- Package booking support (bulk hours)

### Check-in/Check-out System

**Dispute Prevention:**
```
Lesson Start → Instructor Check-in (GPS + Photo)
             ↓
         Lesson Duration
             ↓
Lesson End → Instructor Check-out (GPS + Photo)
           ↓
      Calculate Actual Duration
```

**Tracked Data:**
- GPS coordinates
- Timestamp
- Photo evidence
- Actual duration vs booked duration

---

## 👥 USER ROLES & PERMISSIONS

### 1. CLIENT
**Can:**
- Browse instructors
- Book lessons (single or package)
- Manage wallet (add credit)
- Cancel bookings (with policy)
- Leave reviews
- View transaction history

**Dashboard:**
- Upcoming lessons
- Booking history
- Wallet balance
- Performance tracking

### 2. INSTRUCTOR
**Can:**
- Manage profile & availability
- View bookings & earnings
- Upload documents (license, insurance)
- Sync Google Calendar
- Configure booking settings
- View weekly receipts
- Manage subscription tier

**Dashboard:**
- Today's schedule
- Weekly earnings
- Pending payouts
- Client performance feedback
- Document status

### 3. ADMIN / SUPER_ADMIN
**Can:**
- Approve/reject instructors
- Verify documents
- Process payouts (manual override)
- View revenue reports
- Manage refunds
- Access audit logs
- Monitor platform health

**Dashboard:**
- Revenue analytics
- Instructor compliance
- Payout queue
- Fraud detection alerts
- System health metrics

### 4. STAFF
**Can:**
- Handle assigned tasks
- Process refund requests
- Respond to complaints
- Verify documents
- Manage support tickets

**Task Categories:**
- FINANCIAL (refunds, disputes)
- TECHNICAL (bugs, sync errors)
- SUPPORT (complaints, inquiries)

---

## 🔐 COMPLIANCE & SECURITY

### Document Verification System

**Required Documents:**
1. **Driving License** - Must be valid, not expired
2. **Insurance Certificate** - Vehicle insurance
3. **Background Check** - Criminal record check
4. **Vehicle Registration** - Car ownership proof

**Verification Workflow:**
```
Instructor Uploads → Admin Reviews → Approve/Reject
                                    ↓
                              Expiry Tracking
                                    ↓
                         Auto-notification (30 days)
                                    ↓
                         Auto-deactivation (expired)
```

### Fraud Detection System

**Monitored Patterns:**
1. **Same Card Across Accounts** - Card sharing detection
2. **Instructor Self-Booking** - IP/device fingerprinting
3. **Refund-Rebook Abuse** - Cancel-rebook cycles
4. **Velocity Anomalies** - Unusual booking frequency
5. **Risk Scoring** - Instructor risk assessment

**Auto-Actions:**
- High risk → Freeze payouts
- Medium risk → Flag for review
- Suspicious activity → Create task

### Security Measures

**Authentication:**
- bcrypt password hashing (10 rounds)
- JWT session tokens
- Password reset with expiry tokens
- Role-based access control (RBAC)

**Financial Security:**
- Append-only ledger (immutable)
- Idempotency keys (duplicate prevention)
- Balance verification (every transaction)
- Daily reconciliation (Stripe vs DB)
- Audit logging (all operations)

**Data Protection:**
- PII sanitization in logs
- HTTPS required (production)
- Input validation (Zod schemas)
- Rate limiting (API protection)
- SQL injection prevention (Prisma ORM)

---

## 🎫 TASK MANAGEMENT SYSTEM

### How Tasks Work

**Task Creation (Automated):**
```typescript
Event Trigger → Task Created → Auto-Assigned to Staff → Staff Resolves
```

**Task Types:**

**FINANCIAL:**
- REFUND_REQUEST - Client requests refund
- PAYMENT_DISPUTE - Payment issue
- WALLET_ISSUE - Wallet balance problem
- PAYOUT_REQUEST - Manual payout request
- INVOICE_REQUEST - Invoice generation

**TECHNICAL:**
- TECHNICAL_ISSUE - System bug
- CALENDAR_SYNC_ERROR - Google Calendar sync failed
- APP_BUG - Mobile app issue
- INTEGRATION_ERROR - Third-party API failure

**SUPPORT:**
- GENERAL_INQUIRY - General question
- COMPLAINT - Client/instructor complaint
- DISPUTE - Booking dispute
- ACCOUNT_ISSUE - Account problem
- FEATURE_REQUEST - New feature suggestion

**DOCUMENTS:**
- DOCUMENT_VERIFICATION - New document uploaded
- DOCUMENT_EXPIRY - Document expiring soon
- LICENSE_ISSUE - License problem

**BOOKINGS:**
- BOOKING_ISSUE - Booking problem
- CANCELLATION_REQUEST - Cancellation request
- RESCHEDULE_REQUEST - Reschedule request
- NO_SHOW_REPORT - No-show incident

### Task Priority & Assignment

**Priority Levels:**
```
URGENT  → Due in 1 hour   (Red)
HIGH    → Due in 4 hours  (Orange)
NORMAL  → Due in 24 hours (Yellow)
LOW     → Due in 3 days   (Green)
```

**Auto-Assignment Algorithm:**
```typescript
1. Find staff in appropriate department (FINANCIAL/TECHNICAL/SUPPORT)
2. Filter by active status
3. Filter by capacity (currentLoad < maxCapacity)
4. Sort by current load (ascending)
5. Assign to staff with lowest load
6. Increment staff load counter
```

**Task Lifecycle:**
```
OPEN → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED
  ↓
ESCALATED (if overdue)
```

---

## 📊 SUBSCRIPTION TIERS

### Instructor Subscription Plans

| Feature | BASIC (Trial) | PRO | BUSINESS |
|---------|---------------|-----|----------|
| **Price** | Free (14 days) | $29/mo | $59/mo |
| **Commission** | 20% | 15% | 12% |
| **Instructors** | 1 | 1 | Unlimited |
| **Custom Subdomain** | ❌ | ✅ | ✅ |
| **Branded Booking** | ❌ | ✅ | ✅ |
| **Priority Support** | ❌ | ✅ | ✅ |
| **Analytics** | Basic | Advanced | Advanced |
| **Calendar Sync** | ✅ | ✅ | ✅ |

**Subscription Management:**
- Stripe Checkout for upgrades
- Automatic trial expiration
- Downgrade protection (current period)
- Billing portal access

---

## 🔄 KEY WORKFLOWS

### 1. Client Books a Lesson

```
1. Client browses instructors (filters: location, price, rating)
2. Selects instructor → Views availability
3. Chooses date/time slot
4. Enters pickup/dropoff locations
5. Reviews booking details
6. Enters payment (Stripe)
7. Payment held in escrow
8. Booking confirmed → Email sent
9. Google Calendar event created (if synced)
```

### 2. Lesson Completion & Payout

```
1. Instructor checks in (GPS + photo)
2. Lesson conducted
3. Instructor checks out (GPS + photo)
4. Booking marked COMPLETED
5. Transaction recorded in ledger
6. Instructor earnings calculated
7. Weekly payout batch (Tuesday)
8. Stripe Connect transfer
9. Instructor receives funds
```

### 3. Cancellation & Refund

```
1. Client cancels booking
2. System calculates refund based on policy
3. Refund transaction created
4. Stripe refund processed
5. Ledger updated (debit/credit)
6. Email notifications sent
7. Instructor payout adjusted
8. Audit log recorded
```

### 4. Document Verification

```
1. Instructor uploads document (Cloudinary)
2. Task created for admin
3. Admin reviews document
4. Admin approves/rejects
5. If approved: Instructor activated
6. If rejected: Reason provided
7. Expiry tracking enabled
8. Auto-notification (30 days before expiry)
```

### 5. Fraud Detection Scan

```
1. Cron job runs daily (or manual trigger)
2. Scan all transactions for patterns
3. Calculate instructor risk scores
4. Identify suspicious activities
5. Auto-freeze high-risk payouts
6. Create tasks for investigation
7. Send alerts to admin
8. Log results in audit trail
```

---

## 📱 MOBILE APP INTEGRATION

**Platform:** React Native (iOS + Android)

**Features:**
- Instructor dashboard
- Booking management
- Earnings tracking
- Document upload
- Calendar sync
- Push notifications

**API Endpoints:**
- `/api/*/mobile/*` - Mobile-optimized endpoints
- Reduced payload size
- Optimized queries
- Mobile-specific responses

---

## 🚨 MONITORING & ALERTS

### Health Checks

**System Monitoring:**
- `/api/health` - Basic health check
- Database connectivity
- Stripe API status
- Email service status

**Financial Monitoring:**
- Daily balance reconciliation
- Payout queue monitoring
- Refund processing status
- Liquidity status

**Compliance Monitoring:**
- Document expiry tracking
- Instructor approval queue
- Fraud detection alerts
- Task backlog monitoring

### Audit Logging

**All Critical Operations Logged:**
```typescript
{
  action: 'PROCESS_PAYOUT',
  actorId: 'admin-user-id',
  actorRole: 'ADMIN',
  targetType: 'PAYOUT',
  targetId: 'payout-id',
  metadata: { amount, instructorId, ... },
  ipAddress: '...',
  userAgent: '...',
  timestamp: '...'
}
```

**Audit Log Uses:**
- Forensic investigation
- Compliance reporting
- Dispute resolution
- Security analysis
- Performance tracking

---

## 🎯 BUSINESS RULES

### Commission Structure
- New instructors: 20-25%
- Standard instructors: 15-20%
- Premium instructors: 10-12%
- First booking bonus: +8% to instructor

### Refund Policy
- Early (>48h): 100% refund
- Late (24-48h): 50% refund
- Very late (<24h): No refund
- Instructor no-show: 100% + penalty

### Payout Rules
- Weekly cycle (Mon-Sun)
- 48h review window
- Minimum payout: $50
- Maximum hold: 90 days
- Frozen if high fraud risk

### Booking Rules
- Minimum duration: 30 minutes
- Maximum duration: 4 hours
- Buffer time: 15 minutes (default)
- Service radius: 20 km (default)
- Advance booking: 2 hours minimum

---

## 🔧 MAINTENANCE & OPERATIONS

### Daily Operations
1. Check payout queue
2. Review fraud alerts
3. Process refund requests
4. Verify new documents
5. Monitor system health

### Weekly Operations
1. Process payout batch (Tuesday)
2. Review revenue reports
3. Check instructor compliance
4. Analyze booking trends
5. Update pricing if needed

### Monthly Operations
1. Reconcile all accounts
2. Generate financial reports
3. Review subscription renewals
4. Analyze platform metrics
5. Plan improvements

---

## 📈 SCALABILITY & PERFORMANCE

### Current Capacity
- **Instructors:** Unlimited
- **Bookings:** ~10,000/month
- **Transactions:** ~50,000/month
- **API Requests:** ~1M/month

### Optimization Strategies
- Database indexing (Prisma)
- API route caching
- Image optimization (Cloudinary)
- Lazy loading (React)
- Server-side rendering (Next.js)

### Future Scaling
- Redis caching layer
- CDN for static assets
- Database sharding
- Microservices architecture
- Load balancing

---

## 🎓 SUMMARY

**DriveBook is a comprehensive marketplace platform that:**

1. **Connects** clients with verified driving instructors
2. **Manages** complex booking lifecycles with real-time availability
3. **Processes** payments securely with escrow-based protection
4. **Automates** weekly payouts with sophisticated financial ledger
5. **Enforces** cancellation policies with automated refunds
6. **Tracks** compliance with document verification and expiry
7. **Detects** fraud with pattern recognition and risk scoring
8. **Assigns** tasks automatically to staff for resolution
9. **Integrates** with Google Calendar for seamless scheduling
10. **Provides** multi-tier subscriptions for instructor growth

**Key Strengths:**
- ✅ Production-grade financial system
- ✅ Automated operations (minimal manual work)
- ✅ Comprehensive audit trail
- ✅ Fraud detection and prevention
- ✅ Scalable architecture
- ✅ Mobile app support

**Architecture Grade:** B+ (Financial core solid, some features in progress)

---

**Last Updated:** February 28, 2026  
**Version:** 2.0 (Marketplace Platform)  
**Status:** Production Ready
