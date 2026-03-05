# DATABASE SCHEMA

**Purpose**: Define data models and relationships  
**Owner**: Technical Team  
**Last Updated**: March 4, 2026  
**Scope**: MongoDB schema via Prisma ORM  

---

## CORE MODELS

### User
**Purpose**: Authentication and role management

```prisma
model User {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  email     String   @unique
  password  String?
  name      String?
  role      String   @default("CLIENT")  // CLIENT, INSTRUCTOR, ADMIN, SUPER_ADMIN
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  // Relations
  clients      Client[]
  wallet       ClientWallet?
  instructor   Instructor?
}
```

**Roles**:
- CLIENT - Learner booking lessons
- INSTRUCTOR - Teacher providing lessons
- ADMIN - Platform administrator
- SUPER_ADMIN - Full platform access

---

### Booking
**Purpose**: Time slot reservations

```prisma
model Booking {
  id                String   @id @default(auto()) @map("_id") @db.ObjectId
  instructorId      String   @db.ObjectId
  clientId          String?  @db.ObjectId
  clientName        String?
  clientEmail       String?
  clientPhone       String?
  
  status            String   @default("PENDING")  // PENDING, CONFIRMED, COMPLETED, CANCELLED
  startTime         DateTime?
  endTime           DateTime?
  duration          Float?
  price             Float    @default(0)
  
  platformFee       Float    @default(0)
  instructorPayout  Float    @default(0)
  commissionRate    Float    @default(0)
  
  isPaid            Boolean  @default(false)
  paidAt            DateTime?
  paymentIntentId   String?
  
  pickupAddress     String?
  notes             String?
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  // Relations
  instructor        Instructor @relation(fields: [instructorId], references: [id])
  client            Client?    @relation(fields: [clientId], references: [id])
  transactions      Transaction[]
  reviews           Review[]
}
```

**States**: PENDING → CONFIRMED → COMPLETED → CANCELLED

---

### Transaction (Immutable Ledger)
**Purpose**: Financial record keeping

```prisma
model Transaction {
  id                    String   @id @default(auto()) @map("_id") @db.ObjectId
  bookingId             String?  @db.ObjectId
  instructorId          String   @db.ObjectId
  
  type                  String   // BOOKING_PAYMENT, BOOKING_ADJUSTMENT, REFUND, MANUAL_ADJUSTMENT
  amount                Float
  platformFee           Float    @default(0)
  instructorPayout      Float    @default(0)
  commissionRate        Float    @default(0)
  
  status                String   @default("PENDING")  // PENDING, COMPLETED, PAID, CANCELLED
  description           String?
  
  stripePaymentIntentId String?
  stripeChargeId        String?
  metadata              Json?
  
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  
  // Relations
  booking               Booking? @relation(fields: [bookingId], references: [id])
}
```

**Types**:
- BOOKING_PAYMENT - Original payment
- BOOKING_ADJUSTMENT - Price change
- REFUND - Cancellation refund
- MANUAL_ADJUSTMENT - Admin adjustment

**Rule**: NEVER update transactions, only create new ones

---

### ClientWallet
**Purpose**: Client credit balance

```prisma
model ClientWallet {
  id                String   @id @default(auto()) @map("_id") @db.ObjectId
  userId            String   @unique @db.ObjectId
  
  balance           Float    @default(0)
  creditsRemaining  Float    @default(0)
  totalPaid         Float    @default(0)
  totalSpent        Float    @default(0)
  version           Int      @default(0)  // Optimistic locking
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  // Relations
  user              User     @relation(fields: [userId], references: [id])
  transactions      WalletTransaction[]
}
```

**Formula**: `balance = totalPaid - totalSpent`

---

### WalletTransaction
**Purpose**: Wallet activity log

```prisma
model WalletTransaction {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  walletId    String   @db.ObjectId
  
  amount      Float
  type        String   // CREDIT, DEBIT
  description String?
  status      String   @default("PENDING")
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  // Relations
  wallet      ClientWallet @relation(fields: [walletId], references: [id])
}
```

**Types**:
- CREDIT - Money added to wallet
- DEBIT - Money deducted from wallet

---

### Instructor
**Purpose**: Instructor profile and settings

```prisma
model Instructor {
  id                     String   @id @default(auto()) @map("_id") @db.ObjectId
  userId                 String?  @unique @db.ObjectId
  name                   String
  phone                  String
  email                  String?
  
  hourlyRate             Float
  commissionRate         Float    @default(0.15)
  newStudentBonus        Float    @default(0.05)
  
  approvalStatus         String   @default("PENDING")  // PENDING, APPROVED, REJECTED
  isActive               Boolean  @default(false)
  isVerified             Boolean  @default(false)
  
  workingHours           Json?
  
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt
  
  // Relations
  user                   User?    @relation(fields: [userId], references: [id])
  bookings               Booking[]
  clients                Client[]
  reviews                Review[]
}
```

---

### AuditLog
**Purpose**: Immutable action history

```prisma
model AuditLog {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  action      String   // BOOKING_CREATED, WALLET_CREDIT_ADDED, etc.
  actorId     String   @db.ObjectId
  actorRole   String   // INSTRUCTOR, CLIENT, ADMIN, SYSTEM
  targetType  String   // BOOKING, TRANSACTION, WALLET, etc.
  targetId    String   @db.ObjectId
  
  ipAddress   String?
  userAgent   String?
  metadata    Json?
  success     Boolean  @default(true)
  errorMessage String?
  
  createdAt   DateTime @default(now())
  
  @@index([actorId])
  @@index([targetId])
  @@index([action])
  @@index([createdAt])
}
```

**Rule**: Never delete audit logs

---

## RELATIONSHIPS

```
User (1) ──→ (0..1) ClientWallet
User (1) ──→ (0..1) Instructor
User (1) ──→ (0..*) Client

Instructor (1) ──→ (0..*) Booking
Client (1) ──→ (0..*) Booking
Booking (1) ──→ (0..*) Transaction

ClientWallet (1) ──→ (0..*) WalletTransaction
```

---

## INDEXES

**Performance Critical**:
- User.email (unique)
- Booking.instructorId
- Booking.clientId
- Booking.status
- Booking.startTime
- Transaction.bookingId
- Transaction.instructorId
- Transaction.status
- AuditLog.actorId
- AuditLog.targetId
- AuditLog.createdAt

---

## DATA INTEGRITY RULES

1. **Transactions are immutable** - Never update
2. **Wallet balance must reconcile** - Daily check
3. **Bookings follow state machine** - No skipping
4. **Audit logs are append-only** - Never delete
5. **Soft deletes for financial records** - Mark as CANCELLED

---

## RELATED DOCUMENTS

- `../00-foundation/CORE_ESSENCE.md` - Core entities
- `../00-foundation/FINANCIAL_DOCTRINE.md` - Transaction types
- `../00-foundation/STATE_MACHINE.md` - Booking states

