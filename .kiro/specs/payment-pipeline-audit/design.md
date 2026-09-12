# Technical Design: Payment Pipeline Audit System

## Overview

The Payment Pipeline Audit System is a comprehensive security validation and monitoring framework designed to protect the driving lesson booking platform's payment infrastructure from financial fraud, calculation errors, and data inconsistencies. The system operates as a multi-layered validation engine that continuously monitors wallet transactions, Stripe payment flows, package refund calculations, and instructor payouts to ensure financial integrity across the complete payment lifecycle.

### Design Goals

1. **Security-First**: Prevent financial fraud, especially the critical double-credit exploit in package refunds
2. **Automated Detection**: Real-time validation of payment operations with immediate alerting
3. **Comprehensive Coverage**: Validate all financial touchpoints from customer purchase to instructor payout
4. **Audit Transparency**: Complete audit trails for regulatory compliance and dispute resolution
5. **Operational Efficiency**: Automated remediation for routine issues, escalation for complex problems
6. **Performance**: Sub-second validation for real-time operations, efficient batch processing for historical audits

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Audit System Architecture                    │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Payment Events  │────▶│  Audit Engine    │────▶│   Alerting   │
│  (Real-time)     │     │  (Validation)    │     │   System     │
└──────────────────┘     └──────────────────┘     └──────────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │  Remediation     │
                         │  Engine          │
                         └──────────────────┘
                                  │
                                  ▼
┌──────────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Scheduled Jobs  │────▶│  Batch Auditor   │────▶│   Reports    │
│  (02:00-05:00)   │     │  (Historical)    │     │   System     │
└──────────────────┘     └──────────────────┘     └──────────────┘
```

### Component Architecture

The system is organized into modular components following a layered architecture:

**Layer 1: Data Access Layer**
- `WalletRepository`: Wallet and transaction queries with optimized aggregations
- `BookingRepository`: Booking data access with package relationship handling
- `PayoutRepository`: Payout transaction data access
- `StripeRepository`: Stripe API integration for payment verification
- `AuditLogRepository`: Audit trail persistence

**Layer 2: Validation Layer**
- `WalletIntegrityValidator`: Balance calculations, drift detection
- `RefundValidator`: Tier-aware refund calculation verification
- `PayoutValidator`: Instructor payout calculation verification
- `WorkflowValidator`: Cancellation and approval workflow validation
- `LinkageValidator`: Referential integrity across tables

**Layer 3: Analysis Layer**
- `FraudDetectionEngine`: Pattern analysis for suspicious activities
- `ReconciliationEngine`: Cross-system financial reconciliation
- `ConsistencyChecker`: Data consistency validation
- `OrphanDetector`: Orphaned record identification

**Layer 4: Remediation Layer**
- `AutoRemediationEngine`: Automated fixes for routine issues
- `RemediationStrategy`: Pluggable remediation strategies
- `EscalationManager`: Manual review queue management

**Layer 5: Reporting Layer**
- `AlertManager`: Real-time alert generation and routing
- `ReportGenerator`: Comprehensive audit report creation
- `DashboardService`: Audit metrics and visualization

### Technology Stack

**Runtime**: Node.js (TypeScript)
- Existing Next.js application infrastructure
- TypeScript for type safety in financial calculations
- Async/await for concurrent validation operations

**Database**: PostgreSQL with Prisma ORM
- Existing schema with WalletTransaction, Booking, Transaction models
- Prisma for type-safe database queries
- Transaction support for ACID guarantees in remediation

**External Integrations**:
- Stripe API: Payment verification and webhook data
- Email Service (Nodemailer/Resend): Alert notifications
- Cron/Node-cron: Scheduled audit job execution

**Testing**: Property-Based Testing with fast-check
- Property-based tests for mathematical correctness (refund calculations, balance aggregations)
- Example-based tests for threshold checks and fraud pattern detection
- Integration tests for Stripe API interactions and reconciliation

## Core Data Models

### Audit Result Models

```typescript
// Validation result with severity levels
interface AuditFinding {
  id: string;
  findingType: FindingType;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  resourceType: 'WALLET' | 'BOOKING' | 'TRANSACTION' | 'PAYOUT';
  resourceId: string;
  description: string;
  metadata: Record<string, any>;
  detectedAt: Date;
  remediationAction?: RemediationAction;
  status: 'OPEN' | 'REMEDIATED' | 'ESCALATED' | 'DISMISSED';
}

// Finding type enumeration
enum FindingType {
  BALANCE_DRIFT = 'BALANCE_DRIFT',
  DOUBLE_CREDIT_EXPLOIT = 'DOUBLE_CREDIT_EXPLOIT',
  REFUND_CALCULATION_ERROR = 'REFUND_CALCULATION_ERROR',
  ORPHAN_TRANSACTION = 'ORPHAN_TRANSACTION',
  MISSING_AUDIT_TRAIL = 'MISSING_AUDIT_TRAIL',
  WORKFLOW_BYPASS = 'WORKFLOW_BYPASS',
  INCONSISTENT_STATUS = 'INCONSISTENT_STATUS',
  FRAUD_PATTERN = 'FRAUD_PATTERN',
  RECONCILIATION_VARIANCE = 'RECONCILIATION_VARIANCE',
  INVALID_STATUS = 'INVALID_STATUS',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  PAYMENT_MISMATCH = 'PAYMENT_MISMATCH',
  STALE_PAYOUT = 'STALE_PAYOUT',
  PACKAGE_INCONSISTENCY = 'PACKAGE_INCONSISTENCY',
}

// Automated remediation action
interface RemediationAction {
  actionType: 'CORRECT_BALANCE' | 'UPDATE_STATUS' | 'LINK_TRANSACTION' | 'ESCALATE';
  executedAt?: Date;
  executedBy: 'SYSTEM' | string; // 'SYSTEM' or admin ID
  result: 'SUCCESS' | 'FAILED';
  errorMessage?: string;
  auditLogId: string;
}

// Audit execution tracking
interface AuditExecution {
  id: string;
  executionType: 'REAL_TIME' | 'SCHEDULED' | 'MANUAL';
  startedAt: Date;
  completedAt?: Date;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  validatorsRun: string[];
  findingsCount: number;
  remediationsCount: number;
  errorMessage?: string;
}
```

### Wallet Validation Models

```typescript
// Wallet balance computation result
interface WalletBalance {
  walletId: string;
  userId: string;
  computedBalance: number; // Sum(CREDIT) - Sum(DEBIT)
  recordedBalance?: number; // Deprecated field if exists
  balanceDrift: number; // Absolute difference
  lastTransactionAt: Date;
  confirmedCredits: number;
  confirmedDebits: number;
  pendingCredits: number;
  pendingDebits: number;
}

// Transaction validation result
interface TransactionValidation {
  transactionId: string;
  isValid: boolean;
  issues: string[];
  hasValidStatus: boolean;
  hasValidBookingLink: boolean;
  hasValidWalletLink: boolean;
  amountMatches: boolean;
}
```

### Refund Validation Models

```typescript
// Tier-aware refund calculation
interface RefundCalculation {
  bookingId: string;
  packageHours: number;
  packageHoursRemaining: number;
  hoursUsed: number;
  lockedHourlyRate: number;
  originalDiscountPct: number;
  usedTierDiscountPct: number; // Recalculated based on hours used
  amountForUsedHours: number;
  packageTotalPaid: number;
  refundableBase: number;
  timingRefundPct: number; // 0%, 50%, or 100% based on cancellation timing
  finalRefundAmount: number;
  actualRefundAmount: number;
  calculationError: number; // Difference between expected and actual
  hasAdminOverride: boolean;
}

// Package cancellation validation
interface CancellationValidation {
  bookingId: string;
  hasStripeRefund: boolean;
  stripeRefundAmount?: number;
  hasWalletDebit: boolean;
  walletDebitAmount?: number;
  amountsMatch: boolean;
  hasApprovalWorkflow: boolean;
  cancellationStatus?: string;
  adminReviewedAt?: Date;
  bypassedApproval: boolean;
  timingCalculation: {
    hoursNotice: number;
    expectedRefundPct: number;
    actualRefundPct: number;
  };
}
```

### Fraud Detection Models

```typescript
// Fraud pattern detection result
interface FraudPattern {
  patternType: FraudPatternType;
  userId?: string;
  instructorId?: string;
  walletId?: string;
  detectedAt: Date;
  windowStart: Date;
  windowEnd: Date;
  occurrenceCount: number;
  threshold: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  evidence: Record<string, any>;
}

enum FraudPatternType {
  EXCESSIVE_CANCELLATIONS = 'EXCESSIVE_CANCELLATIONS',
  HIGH_VALUE_TRANSACTIONS = 'HIGH_VALUE_TRANSACTIONS',
  NO_SHOW_PATTERN = 'NO_SHOW_PATTERN',
  ADMIN_OVERRIDE_ABUSE = 'ADMIN_OVERRIDE_ABUSE',
  AUTOMATED_BOOKING_ABUSE = 'AUTOMATED_BOOKING_ABUSE',
  BALANCE_MANIPULATION = 'BALANCE_MANIPULATION',
  DUPLICATE_SUBMISSION = 'DUPLICATE_SUBMISSION',
}
```

### Reconciliation Models

```typescript
// Financial reconciliation report
interface ReconciliationReport {
  periodStart: Date;
  periodEnd: Date;
  generatedAt: Date;
  
  // Stripe totals
  stripeCharges: number;
  stripeRefunds: number;
  stripeNetRevenue: number;
  
  // Wallet totals
  walletCredits: number;
  walletDebits: number;
  walletNetMovement: number;
  
  // Payout totals
  instructorPayouts: number;
  platformFees: number;
  
  // Reconciliation checks
  stripeToWalletVariance: number; // |stripeCharges - walletCredits|
  payoutReconciliationVariance: number; // |walletDebits - (payouts + fees)|
  
  passesReconciliation: boolean;
  requiresManualReview: boolean;
  findings: AuditFinding[];
}
```

## Component Specifications

### 1. Wallet Integrity Validator

**Purpose**: Validate wallet balance calculations and detect balance drift

**Key Algorithm**: Wallet balance aggregation with drift detection

```typescript
async function validateWalletIntegrity(walletId: string): Promise<WalletBalance> {
  // Aggregate CONFIRMED CREDIT and DEBIT transactions
  const [credits, debits] = await Promise.all([
    prisma.walletTransaction.aggregate({
      where: { walletId, status: 'CONFIRMED', type: 'CREDIT' },
      _sum: { amount: true }
    }),
    prisma.walletTransaction.aggregate({
      where: { walletId, status: 'CONFIRMED', type: 'DEBIT' },
      _sum: { amount: true }
    })
  ]);
  
  const computedBalance = (credits._sum.amount ?? 0) - (debits._sum.amount ?? 0);
  
  // Detect balance drift if recorded balance exists
  const wallet = await prisma.clientWallet.findUnique({ where: { id: walletId }});
  const balanceDrift = wallet?.balance ? Math.abs(computedBalance - wallet.balance) : 0;
  
  // Flag drift exceeding threshold
  if (balanceDrift > 0.01) {
    await createFinding({
      findingType: FindingType.BALANCE_DRIFT,
      severity: balanceDrift > 10.00 ? 'CRITICAL' : 'WARNING',
      resourceType: 'WALLET',
      resourceId: walletId,
      metadata: { computedBalance, recordedBalance: wallet.balance, drift: balanceDrift }
    });
  }
  
  return { walletId, computedBalance, balanceDrift, /* ... */ };
}
```

### 2. Double-Credit Exploit Detector

**Purpose**: Prevent refunding package credits both to card and wallet

**Critical Validation**: For package cancellations:
- Stripe refund exists (money back to card)
- Wallet DEBIT exists (removes unused credits)
- Amounts match within $0.01

```typescript
async function validatePackageRefund(bookingId: string): Promise<CancellationValidation> {
  const booking = await getBookingWithTransactions(bookingId);
  
  if (!booking.isPackageBooking || booking.status !== 'CANCELLED') return;
  
  // Check Stripe refund
  const hasStripeRefund = !!booking.stripeRefundId;
  const stripeRefundAmount = hasStripeRefund ? await getStripeRefundAmount(booking.stripeRefundId) : 0;
  
  // Check wallet DEBIT (CRITICAL!)
  const refundTx = booking.walletTransactions.find(tx => 
    tx.createdAt >= booking.cancelledAt && tx.description.includes('refund')
  );
  
  const hasWalletDebit = refundTx?.type === 'DEBIT';
  
  // Detect double-credit exploit: CREDIT instead of DEBIT
  if (refundTx?.type === 'CREDIT') {
    await createFinding({
      findingType: FindingType.DOUBLE_CREDIT_EXPLOIT,
      severity: 'CRITICAL',
      description: 'Package refund used CREDIT instead of DEBIT - DOUBLE CREDIT EXPLOIT',
      metadata: { bookingId, transactionId: refundTx.id, amount: refundTx.amount }
    });
  }
  
  // Detect incomplete refund processing
  if (hasStripeRefund && !hasWalletDebit) {
    await createFinding({
      findingType: FindingType.DOUBLE_CREDIT_EXPLOIT,
      severity: 'CRITICAL',
      description: 'Stripe refund exists but no wallet debit - phantom credits'
    });
  }
  
  return { hasStripeRefund, hasWalletDebit, amountsMatch: Math.abs(stripeRefundAmount - refundTx?.amount) <= 0.01 };
}
```

### 3. Tier-Aware Refund Calculator

**Purpose**: Validate package refund calculations with tier-based discount recalculation

**Discount Tiers**:
- 0-5 hours: 0% discount
- 6-9 hours: 5% discount
- 10-14 hours: 10% discount
- 15+ hours: 12% discount

```typescript
function calculateTierAwareRefund(booking: PackageBooking): RefundCalculation {
  const hoursUsed = booking.packageHours - booking.packageHoursRemaining;
  
  // Determine tier based on hours USED (not original tier!)
  let usedTierDiscountPct = 0;
  if (hoursUsed >= 15) usedTierDiscountPct = 12;
  else if (hoursUsed >= 10) usedTierDiscountPct = 10;
  else if (hoursUsed >= 6) usedTierDiscountPct = 5;
  
  // Calculate amount for used hours with recalculated tier
  const amountForUsedHours = hoursUsed * booking.lockedHourlyRate * (1 - usedTierDiscountPct / 100);
  const refundableBase = booking.packageTotalPaid - amountForUsedHours;
  
  // Apply timing-based policy
  const hoursNotice = calculateHoursNotice(booking.cancellationRequestedAt, booking.bookingDate);
  let timingRefundPct = hoursNotice >= 48 ? 100 : (hoursNotice >= 24 ? 50 : 0);
  if (hoursNotice < 24 && booking.adminOverrideAmount) {
    timingRefundPct = (booking.adminOverrideAmount / refundableBase) * 100;
  }
  
  const finalRefundAmount = refundableBase * (timingRefundPct / 100);
  const actualRefundAmount = await getActualRefundAmount(booking);
  const calculationError = Math.abs(finalRefundAmount - actualRefundAmount);
  
  // Flag calculation errors
  if (calculationError > 0.01 && !booking.adminOverrideAmount) {
    await createFinding({
      findingType: FindingType.REFUND_CALCULATION_ERROR,
      severity: 'WARNING',
      description: `Refund error: expected $${finalRefundAmount}, actual $${actualRefundAmount}`,
      metadata: { expected: finalRefundAmount, actual: actualRefundAmount, error: calculationError }
    });
  }
  
  return { hoursUsed, usedTierDiscountPct, refundableBase, finalRefundAmount, calculationError, /* ... */ };
}
```

### 4. Fraud Detection Engine

**Purpose**: Detect suspicious patterns in real-time

```typescript
class FraudDetectionEngine {
  async detectExcessiveCancellations(userId: string): Promise<FraudPattern | null> {
    const count = await prisma.booking.count({
      where: {
        userId,
        status: 'CANCELLED',
        isPackageBooking: true,
        cancelledAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }
    });
    
    return count > 3 ? {
      patternType: FraudPatternType.EXCESSIVE_CANCELLATIONS,
      userId,
      occurrenceCount: count,
      threshold: 3,
      severity: count > 5 ? 'CRITICAL' : 'HIGH'
    } : null;
  }
  
  async detectBalanceManipulation(walletId: string): Promise<FraudPattern | null> {
    const recentTxs = await prisma.walletTransaction.findMany({
      where: { walletId },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    
    // Detect CREDIT followed by DEBIT of same amount within 60 seconds
    for (let i = 0; i < recentTxs.length - 1; i++) {
      const [tx1, tx2] = [recentTxs[i], recentTxs[i + 1]];
      const timeDiff = (tx1.createdAt.getTime() - tx2.createdAt.getTime()) / 1000;
      
      if (tx1.type === 'DEBIT' && tx2.type === 'CREDIT' &&
          Math.abs(tx1.amount - tx2.amount) < 0.01 && timeDiff <= 60) {
        return {
          patternType: FraudPatternType.BALANCE_MANIPULATION,
          walletId,
          severity: 'HIGH',
          evidence: { tx1: tx1.id, tx2: tx2.id, timeDiff }
        };
      }
    }
    return null;
  }
}
```

### 5. Automated Remediation Engine

**Purpose**: Auto-fix routine issues

```typescript
class AutoRemediationEngine {
  async remediateBalanceDrift(finding: AuditFinding): Promise<RemediationAction> {
    const { drift } = finding.metadata;
    
    // Only auto-fix small drifts (<$0.10)
    if (drift >= 0.10) return this.escalateToManualReview(finding);
    
    // Create corrective transaction
    await prisma.walletTransaction.create({
      data: {
        walletId: finding.resourceId,
        type: drift > 0 ? 'DEBIT' : 'CREDIT',
        amount: Math.abs(drift),
        status: 'CONFIRMED',
        description: `AUDIT_CORRECTION: Balance drift $${drift.toFixed(2)} corrected`
      }
    });
    
    // Verify fix
    const newBalance = await validateWalletIntegrity(finding.resourceId);
    return Math.abs(newBalance.balanceDrift) <= 0.01 
      ? { actionType: 'CORRECT_BALANCE', result: 'SUCCESS' }
      : this.escalateToManualReview(finding);
  }
  
  async remediateOrphanTransaction(finding: AuditFinding): Promise<RemediationAction> {
    // Try to infer booking from timestamp and amount
    const tx = await prisma.walletTransaction.findUnique({ where: { id: finding.resourceId }});
    const candidates = await prisma.booking.findMany({
      where: {
        price: tx.amount,
        createdAt: {
          gte: new Date(tx.createdAt.getTime() - 60000),
          lte: new Date(tx.createdAt.getTime() + 60000)
        }
      }
    });
    
    // Only auto-link if exactly one candidate
    if (candidates.length === 1) {
      await prisma.walletTransaction.update({
        where: { id: tx.id },
        data: { description: `${tx.description} [AUTO-LINKED: ${candidates[0].id}]` }
      });
      return { actionType: 'LINK_TRANSACTION', result: 'SUCCESS' };
    }
    
    return this.escalateToManualReview(finding);
  }
}
```

### 6. Financial Reconciliation Engine

**Purpose**: Cross-system validation of money movements

```typescript
async function generateReconciliationReport(startDate: Date, endDate: Date): Promise<ReconciliationReport> {
  // Aggregate Stripe, wallet, and payout data
  const stripeCharges = await calculateStripeCharges(startDate, endDate);
  const walletCredits = await aggregateWalletCredits(startDate, endDate);
  const payoutData = await aggregatePayouts(startDate, endDate);
  
  // Calculate variances
  const stripeToWalletVariance = Math.abs(stripeCharges - walletCredits);
  const payoutVariance = Math.abs(walletDebits - (payoutData.payouts + payoutData.fees));
  
  // Flag variances
  if (stripeToWalletVariance > 1.00) {
    await createFinding({
      findingType: FindingType.RECONCILIATION_VARIANCE,
      severity: stripeToWalletVariance > 100 ? 'CRITICAL' : 'WARNING',
      description: `Stripe vs wallet variance: $${stripeToWalletVariance.toFixed(2)}`
    });
  }
  
  return {
    stripeCharges,
    walletCredits,
    stripeToWalletVariance,
    passesReconciliation: stripeToWalletVariance <= 1.00 && payoutVariance <= 1.00,
    requiresManualReview: stripeToWalletVariance > 100 || payoutVariance > 100
  };
}
```

## API Design

### Real-Time Audit Endpoints

```typescript
// Audit specific wallet
POST /api/audit/wallet/:walletId
Response: { walletBalance: WalletBalance, findings: AuditFinding[] }

// Audit specific booking
POST /api/audit/booking/:bookingId
Response: { refundValidation: RefundCalculation, findings: AuditFinding[] }

// Run fraud detection
POST /api/audit/fraud/:userId
Response: { patterns: FraudPattern[], findings: AuditFinding[] }
```

### Batch Audit Endpoints

```typescript
// Run full system audit
POST /api/audit/full
Body: { validatorTypes?: string[], autoRemediate?: boolean }
Response: { executionId: string, status: string, findingsCount: number }

// Generate reconciliation report
POST /api/audit/reconciliation
Body: { startDate: string, endDate: string }
Response: ReconciliationReport
```

### Reporting Endpoints

```typescript
// Get audit findings dashboard
GET /api/audit/dashboard
Query: { severity?, status?, startDate?, endDate? }
Response: { findings: AuditFinding[], summary: {...} }

// Get comprehensive audit report
GET /api/audit/report
Query: { startDate: string, endDate: string }
Response: { violations: {...}, fraudPatterns: [...], remediations: number }
```

## Database Schema Extensions

```prisma
model AuditFinding {
  id            String   @id @default(cuid())
  findingType   String
  severity      String   // CRITICAL, WARNING, INFO
  resourceType  String   // WALLET, BOOKING, TRANSACTION, PAYOUT
  resourceId    String
  description   String
  metadata      Json
  detectedAt    DateTime @default(now())
  status        String   @default("OPEN")
  remediatedAt  DateTime?
  
  @@index([findingType, severity])
  @@index([resourceType, resourceId])
  @@index([detectedAt])
}

model AuditExecution {
  id               String   @id @default(cuid())
  executionType    String
  startedAt        DateTime @default(now())
  completedAt      DateTime?
  status           String
  validatorsRun    String[]
  findingsCount    Int      @default(0)
  remediationsCount Int     @default(0)
  
  @@index([executionType, startedAt])
}

model RemediationLog {
  id          String   @id @default(cuid())
  findingId   String
  actionType  String
  executedAt  DateTime @default(now())
  executedBy  String
  result      String
  
  @@index([findingId])
}
```

## Scheduled Jobs

```typescript
// Daily audit at 02:00 (low-traffic period)
async function runDailyFullAudit() {
  const execution = await createAuditExecution('SCHEDULED');
  
  // Process wallets in batches of 100
  const walletIds = await getAllWalletIds();
  for (let i = 0; i < walletIds.length; i += 100) {
    const batch = walletIds.slice(i, i + 100);
    await Promise.all(batch.map(id => runWalletAudit(id)));
  }
  
  // Generate and email daily report
  await generateAndStoreDailyReport();
  await sendAuditSummaryEmail();
}
```

## Alert System

### Priority Levels

- **CRITICAL**: Double-credit exploit, balance drift >$10, reconciliation variance >$100
- **WARNING**: Orphan transactions, refund errors, payout pending >7 days
- **INFO**: Automated remediations, audit completions

### Alert Channels

```typescript
class AlertManager {
  private channels = [new EmailAlertChannel(), new SlackAlertChannel()];
  
  async sendAlert(alert: Alert) {
    // Send critical alerts immediately
    if (alert.severity === 'CRITICAL') {
      await Promise.all(this.channels.map(c => c.sendAlert(alert)));
      return;
    }
    
    // Batch non-critical alerts (max 1 per 15 minutes)
    await this.batchAlert(alert);
  }
}
```

## Performance Optimization

- **Query Optimization**: Indexes on (walletId, status, type), (findingType, severity)
- **Batch Processing**: 100 concurrent wallet operations
- **Caching**: 5-minute cache for Stripe refund lookups
- **Execution Targets**:
  - Single wallet: < 5 seconds
  - Full audit (1000 wallets): < 300 seconds
  - Real-time fraud detection: < 2 seconds

## Error Handling

```typescript
async function runValidatorWithRetry(validator: Validator, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await validator.validate();
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      if (attempt < maxRetries) {
        await sleep(1000 * attempt); // Exponential backoff
        continue;
      }
      throw error;
    }
  }
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Wallet Balance Calculation Correctness
*For any* wallet with CONFIRMED transactions, the computed balance SHALL equal sum(CREDIT) - sum(DEBIT).
**Validates: Requirements 1.1, 1.2, 1.3**

### Property 2: Balance Drift Detection
*For any* wallet where |computed_balance - recorded_balance| > $0.01, the audit system SHALL flag reconciliation.
**Validates: Requirements 1.4, 1.5**

### Property 3: Double-Credit Prevention
*For any* cancelled package, both Stripe refund AND wallet DEBIT SHALL exist with matching amounts (±$0.01).
**Validates: Requirements 2.1, 2.2, 2.3**

### Property 4: Double-Credit Exploit Detection
*For any* package refund using wallet CREDIT instead of DEBIT, the audit system SHALL flag as exploit.
**Validates: Requirements 2.4**

### Property 5: Tier-Aware Refund Tier Selection
*For any* package refund, the discount tier SHALL be determined by hours_used, not original packageHours.
**Validates: Requirements 3.1, 3.6**

### Property 6: Refund Calculation Formula
*For any* package refund, refundable_base SHALL equal packageTotalPaid - (hours_used × rate × (1 - tier_discount/100)).
**Validates: Requirements 3.7**

### Property 7: Refund Error Detection
*For any* refund with |calculated - actual| > $0.01 and no admin override, SHALL flag calculation error.
**Validates: Requirements 3.8**

### Property 8: Webhook Amount Matching
*For any* checkout.session.completed webhook, wallet CREDIT amount SHALL equal stripe_amount ÷ 100.
**Validates: Requirements 4.1, 4.2**

### Property 9: Webhook Timing Validation
*For any* webhook-created transaction, |transaction.createdAt - webhook.created| SHALL be ≤ 60 seconds.
**Validates: Requirements 4.3**

### Property 10: Booking Payment Status Consistency
*For any* CONFIRMED booking, isPaid SHALL be true; for PENDING_PAYMENT, isPaid SHALL be false.
**Validates: Requirements 5.1, 5.2**

### Property 11: Paid Booking Transaction Linkage
*For any* booking with isPaid=true, wallet DEBIT SHALL exist with amount matching price (±$0.01).
**Validates: Requirements 5.3, 5.4**

### Property 12: Payout Calculation Validation
*For any* payout, providerPayout SHALL equal price - platformFee, and platformFee SHALL equal price × rate ÷ 100 (±$0.01).
**Validates: Requirements 6.1, 6.2**

### Property 13: Cancellation Workflow Enforcement
*For any* cancelled package with cancellationStatus ≠ APPROVED, SHALL flag as bypassing approval.
**Validates: Requirements 7.4**

### Property 14: Transaction Referential Integrity
*For any* transaction with bookingId reference, the booking SHALL exist in Booking table.
**Validates: Requirements 8.1, 8.2, 8.3, 8.4**

### Property 15: Reconciliation Wallet Consistency
*For any* period, sum(payouts) + sum(fees) SHALL equal sum(wallet_debits) within $1.00.
**Validates: Requirements 9.5, 9.6, 9.8**

### Property 16: Admin Override Threshold
*For any* admin override exceeding 50% of calculated refund, SHALL flag for senior review.
**Validates: Requirements 11.4**

### Property 17: Balance Manipulation Detection
*For any* wallet with CREDIT then DEBIT of same amount (±$0.01) within 60 seconds, SHALL flag manipulation.
**Validates: Requirements 11.6**

### Property 18: Split Dispute Calculation
*For any* split dispute resolution, splitRefund + splitPayout SHALL equal original amount (±$0.01).
**Validates: Requirements 13.7**

### Property 19: Package Hours Constraints
*For any* package, 0 ≤ packageHoursRemaining ≤ packageHours SHALL hold.
**Validates: Requirements 14.1, 14.2**

### Property 20: Manual Payout Net Calculation
*For any* manual payout, netAmount SHALL equal grossAmount - taxWithheld (±$0.01).
**Validates: Requirements 17.2**

## Testing Strategy

### Property-Based Testing (fast-check)

```typescript
import fc from 'fast-check';

describe('Property 1: Wallet Balance Calculation', () => {
  it('computed balance = sum(CREDIT) - sum(DEBIT)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({
          type: fc.constantFrom('CREDIT', 'DEBIT'),
          amount: fc.float({ min: 0.01, max: 1000 }),
          status: fc.constantFrom('CONFIRMED', 'PENDING')
        })),
        async (txs) => {
          const wallet = await createTestWallet();
          await createTransactions(wallet.id, txs);
          
          const result = await validateWalletIntegrity(wallet.id);
          
          const expectedCredits = txs.filter(t => t.type === 'CREDIT' && t.status === 'CONFIRMED')
            .reduce((sum, t) => sum + t.amount, 0);
          const expectedDebits = txs.filter(t => t.type === 'DEBIT' && t.status === 'CONFIRMED')
            .reduce((sum, t) => sum + t.amount, 0);
          
          expect(result.computedBalance).toBeCloseTo(expectedCredits - expectedDebits, 2);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 5: Tier-Aware Refund', () => {
  it('tier based on hours_used, not original packageHours', () => {
    fc.assert(
      fc.property(
        fc.record({
          packageHours: fc.integer({ min: 10, max: 20 }),
          packageHoursRemaining: fc.integer({ min: 1, max: 15 }),
          lockedHourlyRate: fc.float({ min: 50, max: 100 })
        }),
        (data) => {
          const hoursUsed = data.packageHours - data.packageHoursRemaining;
          
          const expectedTier = hoursUsed >= 15 ? 12 : hoursUsed >= 10 ? 10 : hoursUsed >= 6 ? 5 : 0;
          
          const result = calculateTierAwareRefund({
            ...data,
            packageTotalPaid: data.packageHours * data.lockedHourlyRate * 0.9
          });
          
          expect(result.usedTierDiscountPct).toBe(expectedTier);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Example-Based Testing

```typescript
describe('Balance Drift Threshold', () => {
  it('should flag drift >$0.01', async () => {
    const wallet = await createTestWallet();
    await createTransaction(wallet.id, 'CREDIT', 100.00);
    await setRecordedBalance(wallet.id, 100.02);
    
    const result = await validateWalletIntegrity(wallet.id);
    
    expect(result.balanceDrift).toBe(0.02);
    const findings = await getFindings(wallet.id);
    expect(findings[0].findingType).toBe('BALANCE_DRIFT');
  });
});

describe('Excessive Cancellations', () => {
  it('should flag 4+ cancellations in 30 days', async () => {
    const user = await createTestUser();
    for (let i = 0; i < 4; i++) {
      await createCancelledPackage(user.id);
    }
    
    const pattern = await fraudDetector.detectExcessiveCancellations(user.id);
    
    expect(pattern.patternType).toBe('EXCESSIVE_CANCELLATIONS');
    expect(pattern.threshold).toBe(3);
  });
});
```

## Implementation Phases

### Phase 1: Core Validators (Weeks 1-2)
- Wallet integrity validator
- Double-credit exploit detector
- Tier-aware refund calculator

### Phase 2: Fraud & Reconciliation (Weeks 3-4)
- Fraud detection engine
- Financial reconciliation
- Orphan detector

### Phase 3: Remediation & Reporting (Weeks 5-6)
- Auto-remediation engine
- Alert system
- Report generation
- Scheduled jobs

### Phase 4: Testing & Deployment (Weeks 7-8)
- Property-based test suite
- Integration tests
- Performance optimization
- Production deployment

## Deployment Architecture

```typescript
// Next.js API routes structure
app/
  api/
    audit/
      wallet/[id]/route.ts          // Real-time wallet audit
      booking/[id]/route.ts         // Real-time booking audit
      fraud/[userId]/route.ts       // Fraud detection
      full/route.ts                 // Full system audit
      reconciliation/route.ts       // Reconciliation report
      dashboard/route.ts            // Findings dashboard
      report/route.ts               // Comprehensive report

lib/
  audit/
    validators/
      WalletIntegrityValidator.ts
      RefundValidator.ts
      PayoutValidator.ts
      WorkflowValidator.ts
      LinkageValidator.ts
    analyzers/
      FraudDetectionEngine.ts
      ReconciliationEngine.ts
      OrphanDetector.ts
    remediation/
      AutoRemediationEngine.ts
      RemediationStrategies.ts
    reporting/
      AlertManager.ts
      ReportGenerator.ts
    repositories/
      WalletRepository.ts
      BookingRepository.ts
      PayoutRepository.ts
      StripeRepository.ts
    
scripts/
  audit-jobs/
    daily-full-audit.ts            // Cron job script
```

## Monitoring & Observability

- **Metrics**: Audit execution time, findings per category, remediation success rate
- **Logs**: Structured JSON logs for all audit operations
- **Alerts**: Critical findings trigger immediate notifications
- **Dashboard**: Real-time view of audit status, findings, and trends

## Security Considerations

- **Database Access**: Read-only replicas for historical audits to prevent impact on production
- **Admin Override Audit**: All admin overrides logged with justification
- **Remediation Authorization**: Automated fixes only for low-risk issues (<$0.10 drift)
- **Alert Access Control**: Audit findings visible only to admins and finance team
- **Data Retention**: Findings stored for 90 days, reports for 365 days

---

**Implementation Language**: TypeScript  
**Test Framework**: Jest with fast-check for property-based testing  
**Deployment**: Next.js API routes with scheduled cron jobs  
**Status**: Design complete, ready for implementation
