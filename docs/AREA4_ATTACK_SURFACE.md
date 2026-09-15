# Phase 2 Area 4: Offline Booking Workflow - Attack Surface

**Date**: 2026-08-15  
**Status**: Enumeration Complete - Audit In Progress

---

## Complete Endpoint Inventory

### Provider/Instructor Endpoints

**1. POST /api/bookings/offline**
- **Purpose**: Create offline booking (cash/bank transfer)
- **File**: `app/api/bookings/offline/route.ts`
- **Lines**: 1-188
- **Authentication**: Required (session.user.providerId)
- **Authorization**: Subscription-based (PRO+), approval status check
- **Critical**: YES - Primary offline booking creation endpoint

**2. GET /api/bookings**
- **Purpose**: List provider's bookings (can filter by source: 'offline'/'platform')
- **File**: `app/api/bookings/route.ts`
- **Lines**: 821-896
- **Authentication**: Required (session.user.providerId)
- **Authorization**: Provider owns bookings
- **Critical**: MEDIUM - Read-only but exposes offline booking data

**3. POST /api/bookings/[id]/cancel**
- **Purpose**: Cancel booking (applies to both platform and offline)
- **File**: `app/api/bookings/[id]/cancel/route.ts`
- **Lines**: 1-180
- **Authentication**: Required
- **Authorization**: Provider/Client/Admin role check
- **Critical**: HIGH - Cancels offline bookings, triggers refund logic

**4. GET /api/instructor/earnings**
- **Purpose**: Provider earnings dashboard (includes scheduled offline bookings)
- **File**: `app/api/instructor/earnings/route.ts`
- **Lines**: 1-416
- **Authentication**: Required (session.user.providerId)
- **Authorization**: Provider owns data
- **Critical**: MEDIUM - Aggregates offline booking financial data

### Admin Endpoints

**5. GET /api/admin/booking-payment-status**
- **Purpose**: Admin dashboard - payment source breakdown (includes offline cash/bank transfer)
- **File**: `app/api/admin/booking-payment-status/route.ts`
- **Lines**: 1-148
- **Authentication**: Required
- **Authorization**: ADMIN/SUPER_ADMIN role
- **Critical**: LOW - Read-only analytics

**6. GET /api/admin/payouts/***
- **Purpose**: Payout processing (explicitly EXCLUDES offline bookings)
- **Files**: 
  - `app/api/admin/payouts/route.ts`
  - `app/api/admin/payouts/preview-all/route.ts`
  - `app/api/admin/payouts/process-all/route.ts`
- **Authentication**: Required
- **Authorization**: ADMIN role with PERM.OPERATIONS_PAYOUTS_*
- **Critical**: MEDIUM - Ensures offline bookings don't interfere with platform payouts

**7. GET /api/admin/bookings**
- **Purpose**: Admin booking list (includes offline bookings)
- **File**: `app/api/admin/bookings/route.ts`
- **Authentication**: Required
- **Authorization**: ADMIN role
- **Critical**: LOW - Read-only admin view

**8. GET /api/admin/export**
- **Purpose**: Data export (explicitly EXCLUDES offline bookings - exports only platform bookings)
- **File**: `app/api/admin/export/route.ts`
- **Lines**: 79-83
- **Authentication**: Required
- **Authorization**: ADMIN role
- **Critical**: LOW - Read-only export

### Background/System Endpoints

**9. POST /api/cron/lesson-reminders**
- **Purpose**: Automated lesson reminders (handles offline bookings via customerEmail/customerPhone)
- **File**: `app/api/cron/lesson-reminders/route.ts`
- **Lines**: 1-200
- **Authentication**: Cron secret
- **Authorization**: System-level
- **Critical**: LOW - Non-transactional, read-only for offline bookings

### Supporting Services

**10. lib/services/booking-service.ts - cancelBooking()**
- **Purpose**: Centralized booking cancellation logic (applies to all booking types)
- **File**: `lib/services/booking-service.ts`
- **Lines**: 815-925
- **Authentication**: Called by authenticated endpoints
- **Authorization**: Inherited from caller
- **Critical**: HIGH - Handles refund calculation, wallet credits, ledger entries

---

## Data Model

### Prisma Schema - Booking Model

**Offline-Specific Fields**:
```prisma
offlineAmountPaid     Decimal?      @db.Decimal(12, 2)  // Amount paid offline
offlinePaymentMethod  String?                           // 'cash' | 'bank_transfer' | 'other'
source                String        @default("platform") // 'platform' | 'offline'
```

**Shared Fields** (used by both platform and offline):
- `providerId` - Foreign key to Provider
- `customerName`, `customerPhone`, `customerEmail` - Contact info (no Customer FK for offline)
- `startTime`, `endTime`, `duration` - Scheduling
- `status` - Lifecycle state
- `price`, `platformFee`, `providerPayout` - Financial
- `isPaid`, `paidAt` - Payment status

**Critical Differences**:
- Offline bookings: `source = 'offline'`, no `customerId` FK, payment info in offline fields
- Platform bookings: `source = 'platform'`, has `customerId` FK, payment via Stripe/Wallet

---

## Financial Flow

### Offline Booking Financial Path

```
Provider creates offline booking
  ↓
offlineAmountPaid stored (client-supplied)
  ↓
price = offlineAmountPaid
platformFee = 0
providerPayout = offlineAmountPaid
commissionRate = 0
  ↓
isPaid = true (immediate)
  ↓
NO wallet transaction (cash/bank transfer external)
NO financial ledger entry (platform not involved in payment)
NO payout processing (offline bookings excluded from platform payouts)
  ↓
If cancelled:
  → NO refund (offline bookings don't go through refund logic)
  → Provider handles refund externally
```

### Platform Booking Financial Path (for comparison)

```
Customer creates booking
  ↓
Payment via Stripe/Wallet
  ↓
price = package or hourly rate
platformFee = price * commissionRate
providerPayout = price - platformFee
  ↓
Wallet deduction / Stripe charge
  ↓
FinancialLedger entry created
  ↓
Booking completion triggers payout eligibility
  ↓
Admin processes payout to provider
  ↓
If cancelled:
  → Refund calculated based on cancellation policy
  → Wallet credit issued
  → Ledger refund entry created
```

---

## State Machine

### Offline Booking Lifecycle

**Creation**:
- Status: `CONFIRMED` (created directly in CONFIRMED state)
- No PENDING/PENDING_PAYMENT states (payment already handled offline)

**Transitions**:
```
CONFIRMED
  ↓ (time passes)
COMPLETED (by check-out or auto-completion)
  
CONFIRMED
  ↓ (cancel)
CANCELLED
```

**Invalid Transitions**:
- ❌ CONFIRMED → PENDING_PAYMENT (offline bookings always paid)
- ❌ CANCELLED → CONFIRMED (no resurrection)
- ❌ COMPLETED → CONFIRMED (no reversal)

---

## Authorization Matrix

| Endpoint | Provider (owner) | Provider (other) | Client (booking owner) | Client (other) | Admin | Public |
|----------|------------------|------------------|----------------------|----------------|-------|--------|
| POST /api/bookings/offline | ✅ Create | ❌ | N/A | N/A | ❌ | ❌ |
| GET /api/bookings (own) | ✅ List | ❌ | ✅ List | ❌ | ❌ | ❌ |
| POST /api/bookings/[id]/cancel | ✅ Cancel | ❌ | ✅ Cancel | ❌ | ✅ Cancel | ❌ |
| GET /api/instructor/earnings | ✅ View | ❌ | N/A | N/A | ❌ | ❌ |
| GET /api/admin/booking-payment-status | ❌ | ❌ | ❌ | ❌ | ✅ View All | ❌ |
| GET /api/admin/payouts/* | ❌ | ❌ | ❌ | ❌ | ✅ Process | ❌ |

---

## Security Scope

### In-Scope for Area 4 Audit

**Primary Concerns**:
1. Can Provider A create offline bookings for Provider B? (IDOR)
2. Can Provider A view/cancel Provider B's offline bookings? (BOLA)
3. Can providers manipulate `offlineAmountPaid` to inflate earnings?
4. Can client-supplied financial amounts bypass validation?
5. Can offline bookings conflict with platform bookings (double-booking)?
6. Can offline bookings be created without subscription/approval checks?
7. Can platform clients be routed to offline bookings (revenue bypass)?
8. Are offline booking cancellations handled correctly (no inappropriate refunds)?
9. Can cancelled offline bookings be modified/resurrected?
10. Can offline bookings access wallet/ledger incorrectly?

**Financial Invariants to Verify**:
- ✅ Offline bookings: platformFee = 0, providerPayout = offlineAmountPaid
- ✅ Offline bookings: NOT included in platform payout calculations
- ✅ Offline bookings: NO wallet transactions created
- ✅ Offline bookings: NO financial ledger entries
- ✅ Offline booking cancellations: NO wallet refunds issued
- ✅ Price cannot be negative or excessive
- ✅ No duplicate bookings in same time slot

### Out-of-Scope

- Platform booking payment flow (covered in Area 3)
- Admin RBAC implementation (covered in Area 5)
- Webhook security (covered in Area 6)
- General authentication mechanisms (covered in Areas 1-3)

---

## Total Attack Surface

**Endpoints**: 10 (5 provider, 3 admin, 1 system, 1 shared service)  
**Critical Endpoints**: 3 (create, cancel, booking-service)  
**High-Risk Endpoints**: 2 (earnings aggregation, cancel)  
**Medium-Risk Endpoints**: 3 (list, admin analytics, admin payouts)  
**Low-Risk Endpoints**: 2 (admin read-only)

**Audit Status**: Enumeration complete, systematic security audit in progress
