# DATABASE SCHEMA

**Purpose**: Define data models and relationships  
**Owner**: Technical Team  
**Last Updated**: March 22, 2026  
**Scope**: MongoDB schema via Prisma ORM  

---

## CORE MODELS

### User
**Purpose**: Authentication and role management

```prisma
model User {
  id               String    @id @default(auto()) @map("_id") @db.ObjectId
  email            String    @unique
  password         String?
  name             String?
  role             String    @default("CLIENT")  // CLIENT, INSTRUCTOR, ADMIN, SUPER_ADMIN
  instructorId     String?   @db.ObjectId
  resetToken       String?
  resetTokenExpiry DateTime?
  termsAcceptedAt  DateTime?
  termsVersion     String?   // e.g. "1.0"
  ageDeclaration   Boolean   @default(false)
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  clients    Client[]
  wallet     ClientWallet?
  instructor Instructor?
}
```

---

### Instructor
**Purpose**: Instructor profile, subscription, branding, and configuration

```prisma
model Instructor {
  id                   String  @id @default(auto()) @map("_id") @db.ObjectId
  userId               String? @unique @db.ObjectId
  user                 User?   @relation(...)
  name                 String
  phone                String
  hourlyRate           Float
  serviceAreas         String?
  copilotAgentEndpoint String?

  // Profile & vehicle
  bio             String?
  carMake         String?
  carModel        String?
  carYear         String?
  vehicleTypes    String?
  languages       String?
  baseAddress     String?
  serviceRadiusKm Float?
  isActive        Boolean @default(true)
  isVerified      Boolean @default(false)
  isFeatured      Boolean @default(false)
  averageRating   Float?
  totalReviews    Int     @default(0)

  // Subscription
  subscriptionTier   String    @default("BASIC")   // BASIC | PRO | BUSINESS
  subscriptionStatus String    @default("TRIAL")   // TRIAL | ACTIVE | PAST_DUE | CANCELLED
  trialEndsAt        DateTime?
  stripeCustomerId   String?
  stripeAccountId    String?
  maxInstructors     Int       @default(1)

  // Branding
  customDomain              String?
  brandedBookingPage        Boolean @default(false)
  brandLogo                 String?
  brandColorPrimary         String?
  brandColorSecondary       String?
  showBrandingOnBookingPage Boolean @default(false)

  // Documents
  licenseNumber          String?
  insuranceNumber        String?
  licenseImageFront      String?
  licenseImageBack       String?
  insurancePolicyDoc     String?
  policeCheckDoc         String?
  wwcCheckDoc            String?
  photoIdDoc             String?
  certificationDoc       String?
  vehicleRegistrationDoc String?
  profileImage           String?
  carImage               String?
  documentsVerified      Boolean   @default(false)
  documentsVerifiedAt    DateTime?
  licenseExpiry          DateTime?
  insuranceExpiry        DateTime?
  policeCheckExpiry      DateTime?
  wwcCheckExpiry         DateTime?
  approvalStatus         String    @default("PENDING")  // PENDING | APPROVED | REJECTED | SUSPENDED

  // Booking configuration
  workingHours         Json?
  policyExceptionCount Int     @default(0)
  allowedDurations     Json?
  bookingBufferMinutes Int?
  enableTravelTime     Boolean @default(false)
  travelTimeMinutes    Int?
  lessonPackages       Json?

  // Google Calendar
  syncGoogleCalendar Boolean   @default(false)
  googleTokenExpiry  DateTime?
  calendarBufferMode String?

  // Social / public profile
  whatsapp        String?
  instagram       String?
  facebook        String?
  yearsExperience Int?

  bookings      Booking[]
  clients       Client[]
  subscriptions Subscription[]
}
```

**Note**: `commissionRate` and `newStudentBonus` are NOT stored on the Instructor model. They are derived at runtime from `SUBSCRIPTION_PLANS[subscriptionTier]` in `lib/config/subscriptions.ts`.

---

### Client
**Purpose**: Booking clients (may or may not have a User account)

```prisma
model Client {
  id                    String     @id @default(auto()) @map("_id") @db.ObjectId
  userId                String?    @db.ObjectId
  user                  User?      @relation(...)
  instructorId          String     @db.ObjectId
  instructor            Instructor @relation(...)
  name                  String
  email                 String
  phone                 String
  preferredInstructorId String?    @db.ObjectId
  defaultPickupAddress  String?
  defaultPickupLat      Float?
  defaultPickupLng      Float?
  notes                 String?
  bookings              Booking[]
  createdAt             DateTime   @default(now())
  updatedAt             DateTime   @updatedAt
}
```

---

### Booking
**Purpose**: Time slot reservations

```prisma
model Booking {
  id                    String     @id @default(auto()) @map("_id") @db.ObjectId
  instructorId          String     @db.ObjectId
  instructor            Instructor @relation(...)
  clientId              String?    @db.ObjectId
  client                Client?    @relation(...)
  clientName            String?
  clientPhone           String?
  bookingType           String?

  status                String     @default("PENDING")
  // Valid statuses: PENDING | PENDING_PAYMENT | CONFIRMED | COMPLETED | CANCELLED | EXPIRED | NO_SHOW

  startTime             DateTime?
  endTime               DateTime?
  duration              Float?
  price                 Float      @default(0)
  platformFee           Float      @default(0)
  instructorPayout      Float      @default(0)
  commissionRate        Float      @default(0)

  isPaid                Boolean    @default(false)
  paidAt                DateTime?
  paymentCaptured       Boolean    @default(false)
  paymentCapturedAt     DateTime?
  paymentIntentId       String?

  pickupAddress         String?
  pickupLatitude        Float?
  pickupLongitude       Float?
  dropoffAddress        String?
  dropoffLatitude       Float?
  dropoffLongitude      Float?
  notes                 String?

  isFirstBooking        Boolean    @default(false)
  isPackageBooking      Boolean    @default(false)
  parentBookingId       String?    @db.ObjectId
  packageHours          Float?
  packageHoursUsed      Float      @default(0)
  packageHoursRemaining Float?
  packageTotalPaid      Float?
  packageExpiryDate     DateTime?
  packageStatus         String?

  createdBy             String?
  originalStartTime     DateTime?
  isNonRefundable       Boolean    @default(false)
  rescheduledFrom       Json?
  rescheduleCount       Int        @default(0)

  deletedAt             DateTime?  // soft delete
  deletedBy             String?

  // Lesson feedback
  lessonFeedback        Int[]      @default([])
  instructorNotes       String?
  feedbackGivenAt       DateTime?
  studentStrengths      Int[]      @default([])
  focusAreas            Int[]      @default([])
  performanceScore      Int?

  // Client review
  clientRating          Int?       // 1-5 stars
  clientReview          String?
  reviewGivenAt         DateTime?

  createdAt             DateTime   @default(now())
  updatedAt             DateTime   @updatedAt

  transactions          Transaction[]
}
```

**Note**: `googleCalendarEventId` is referenced in several API routes using `as any` casts but is NOT defined in the schema. It should be added as `googleCalendarEventId String?` when Google Calendar sync is fully implemented.

**States**: PENDING → PENDING_PAYMENT → CONFIRMED → COMPLETED → CANCELLED / EXPIRED / NO_SHOW

---

### Transaction (Immutable Ledger)
**Purpose**: Financial record keeping

```prisma
model Transaction {
  id                    String   @id @default(auto()) @map("_id") @db.ObjectId
  bookingId             String?  @db.ObjectId
  booking               Booking? @relation(...)
  instructorId          String   @db.ObjectId

  type                  String   // BOOKING_PAYMENT | BOOKING_ADJUSTMENT | REFUND | MANUAL_ADJUSTMENT
  amount                Float
  platformFee           Float    @default(0)
  instructorPayout      Float    @default(0)
  commissionRate        Float    @default(0)

  status                String   @default("PENDING")  // PENDING | COMPLETED | CANCELLED
  description           String?

  stripePaymentIntentId String?
  stripeChargeId        String?
  metadata              Json?

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}
```

**Rule**: NEVER update transactions, only create new ones. (Note: `updatedAt` exists in schema for technical reasons but the doctrine is append-only.)

---

### ClientWallet
**Purpose**: Client credit balance

```prisma
model ClientWallet {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  userId    String   @unique @db.ObjectId
  user      User     @relation(...)
  balance   Float    @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  transactions WalletTransaction[]
}
```

**Note**: Only `balance` is stored. There are no `creditsRemaining`, `totalPaid`, `totalSpent`, or `version` fields. Balance is updated directly on credit/debit operations.

---

### WalletTransaction
**Purpose**: Wallet activity log

```prisma
model WalletTransaction {
  id          String       @id @default(auto()) @map("_id") @db.ObjectId
  walletId    String       @db.ObjectId
  wallet      ClientWallet @relation(...)
  amount      Float
  type        String       // CREDIT | DEBIT
  description String?
  status      String       @default("PENDING")
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
}
```

---

### Subscription
**Purpose**: Instructor subscription record (Stripe-linked)

```prisma
model Subscription {
  id                   String     @id @default(auto()) @map("_id") @db.ObjectId
  instructorId         String     @db.ObjectId
  instructor           Instructor @relation(...)
  tier                 String     // BASIC | PRO | BUSINESS
  status               String     @default("ACTIVE")  // TRIAL | ACTIVE | PAST_DUE | CANCELLED
  billingCycle         String     @default("monthly")
  monthlyAmount        Float
  stripeSubscriptionId String?
  stripeCustomerId     String?
  currentPeriodStart   DateTime
  currentPeriodEnd     DateTime
  cancelAtPeriodEnd    Boolean    @default(false)
  trialEndsAt          DateTime?
  cancelledAt          DateTime?
  createdAt            DateTime   @default(now())
  updatedAt            DateTime   @updatedAt
}
```

---

### AuditLog
**Purpose**: Immutable action history

```prisma
model AuditLog {
  id           String   @id @default(auto()) @map("_id") @db.ObjectId
  action       String   // BOOKING_CREATED, BOOKING_CANCELLED, BOOKING_DELETED, etc.
  actorId      String
  actorRole    String   // CLIENT | INSTRUCTOR | ADMIN | SYSTEM
  targetType   String   // BOOKING | TRANSACTION | WALLET | USER
  targetId     String
  ipAddress    String?
  userAgent    String?
  metadata     Json?
  success      Boolean  @default(true)
  errorMessage String?
  createdAt    DateTime @default(now())
}
```

**Rule**: Never delete audit logs.

---

### Other Models

```prisma
model Message        // AI receptionist call messages
model Notification   // In-app notifications (userId, type, title, message, isRead)
model WebhookEvent   // Stripe webhook idempotency (idempotencyKey unique)
```

---

### PlatformSettings
**Purpose**: Admin-configurable platform rates and fees — singleton record (key = `"default"`)

```prisma
model PlatformSettings {
  id                          String   @id @default(auto()) @map("_id") @db.ObjectId
  key                         String   @unique @default("default")

  // Commission rates per subscription tier (%)
  basicCommissionRate         Float    @default(15)
  proCommissionRate           Float    @default(12)
  businessCommissionRate      Float    @default(10)

  // New student bonus per tier (%)
  basicNewStudentBonus        Float    @default(8)
  proNewStudentBonus          Float    @default(10)
  businessNewStudentBonus     Float    @default(12)

  // Platform fee on top of commission (%)
  platformFeePercentage       Float    @default(3.6)

  // Package discounts (%)
  package6Discount            Float    @default(5)
  package10Discount           Float    @default(10)
  package15Discount           Float    @default(12)
  discountPaidBy              String   @default("shared")  // platform | shared | instructor

  // Driving test package
  drivingTestPackagePrice     Float    @default(225)

  // Cancellation / no-show
  cancellationFee             Float    @default(0)
  lateCancellationWindowHours Float    @default(24)
  noShowPenaltyAmount         Float    @default(0)

  // Wallet limits
  walletTopUpMin              Float    @default(10)
  walletTopUpMax              Float    @default(500)

  // GST
  gstEnabled                  Boolean  @default(true)
  gstRate                     Float    @default(10)

  // Peak surcharge
  peakSurchargeEnabled        Boolean  @default(false)
  peakSurchargePercent        Float    @default(0)

  updatedAt                   DateTime @updatedAt
  updatedBy                   String?  // admin userId who last changed it
}
```

**Access pattern**:
- Admin UI → `POST /api/admin/pricing` → upserts singleton
- Payment intent creation → `lib/services/platform-pricing.ts` → `getCommissionRate(tier)` → reads from DB
- Falls back to hardcoded defaults if no DB record exists yet

---

```
User (1) ──→ (0..1) ClientWallet
User (1) ──→ (0..1) Instructor
User (1) ──→ (0..*) Client

Instructor (1) ──→ (0..*) Booking
Instructor (1) ──→ (0..*) Client
Instructor (1) ──→ (0..*) Subscription

Client (1) ──→ (0..*) Booking
Booking (1) ──→ (0..*) Transaction

ClientWallet (1) ──→ (0..*) WalletTransaction
```

---

## DATA INTEGRITY RULES

1. Transactions are append-only — never update financial records
2. Wallet balance updated atomically on each credit/debit
3. Bookings follow the state machine — no skipping states
4. Audit logs are append-only — never delete
5. Soft deletes for bookings — use `deletedAt` / `deletedBy`
6. `commissionRate` / `newStudentBonus` derived from config, never stored on Instructor

---

## RELATED DOCUMENTS

- `../00-foundation/FINANCIAL_DOCTRINE.md` - Transaction types
- `../00-foundation/STATE_MACHINE.md` - Booking states
- `../SUBSCRIPTION_SYSTEM.md` - Subscription tiers and config
