# Core Financial Engine - Architecture Specification

**Status:** 🔵 DESIGN PHASE - Foundation for all payment modes and verticals  
**Date:** September 4, 2026  
**Purpose:** Payment-mode-agnostic financial system for MARKETPLACE + SAAS, PLATFORM + DIRECT

---

## Vision

**Core is the financial foundation for DriveBook across all verticals (driving, plumbing, tutoring, etc.)**

Core owns:
- ✅ Financial events and money records
- ✅ Documents (receipts, tax invoices, settlement statements)
- ✅ Tax configuration and compliance
- ✅ Auditability and ledger
- ✅ Payment abstraction (PLATFORM vs DIRECT)

Verticals decide:
- 📦 What the service is (lesson, job, session)
- 📦 Booking/scheduling rules
- 📦 Service-specific attributes

Payment mode decides:
- 💳 How money moves (DriveBook vs provider's Stripe)

---

## Core Principle: Separation of Concerns

```
CUSTOMER SIDE (What customer pays)
───────────────────────────────────
Service fare              $180.00
DriveBook platform fee      $6.48
───────────────────────────────────
Customer pays             $186.48


PROVIDER SIDE (What provider earns)
───────────────────────────────────
Service fare              $180.00
DriveBook commission       -$18.00
───────────────────────────────────
Provider receives         $162.00


DRIVEBOOK SIDE (Platform economics)
───────────────────────────────────
Platform fee revenue        $6.48
Commission revenue         $18.00
───────────────────────────────────
DriveBook total           $24.48
```

**Key insight:** Platform fee ≠ Commission

- **Platform fee:** DriveBook → Customer (for using the platform)
- **Commission:** DriveBook → Provider (for marketplace facilitation)

---

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                        VERTICALS                             │
│  (Driving, Plumbing, Tutoring - define service types)       │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    PAYMENT ADAPTERS                          │
│     (PLATFORM mode vs DIRECT mode - handle money flow)      │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                   CORE FINANCIAL ENGINE                      │
│                                                              │
│  Financial Events → Ledger → Documents → Notifications      │
│                                                              │
│  • Money records (authoritative)                            │
│  • Tax treatment                                            │
│  • Document generation                                      │
│  • Audit trail                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Core Domain Models

### 1. Financial Transaction

```typescript
// lib/core/financial/transaction.ts

interface FinancialTransaction {
  id: string;
  type: TransactionType;
  createdAt: Date;
  
  // Money flow
  amount: number;
  currency: 'AUD';
  
  // Parties
  payer: Party;
  payee: Party;
  
  // Payment mode
  paymentMode: 'PLATFORM' | 'DIRECT';
  paymentAdapter: 'stripe-platform' | 'stripe-connect';
  
  // External references
  stripePaymentIntentId?: string;
  stripeChargeId?: string;
  
  // Line items (what the transaction is for)
  lineItems: LineItem[];
  
  // Status
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED';
  
  // Audit
  metadata: Record<string, any>;
}

type TransactionType = 
  | 'CUSTOMER_PAYMENT'      // Customer pays for service
  | 'WALLET_TOPUP'          // Customer adds wallet credit
  | 'WALLET_DEBIT'          // Wallet used for booking
  | 'PROVIDER_PAYOUT'       // DriveBook pays provider
  | 'REFUND'                // Money returned to customer
  | 'ADJUSTMENT';           // Manual correction

interface Party {
  type: 'CUSTOMER' | 'PROVIDER' | 'PLATFORM';
  id: string;
  name: string;
  
  // Tax details
  abnNumber?: string;
  gstRegistered: boolean;
}

interface LineItem {
  description: string;
  type: LineItemType;
  
  // Pricing
  quantity?: number;
  rate?: number;
  amount: number;
  
  // Supplier (for tax purposes)
  supplier: 'CUSTOMER' | 'PROVIDER' | 'PLATFORM' | 'NONE';
  
  // Tax treatment
  taxable: boolean;
  gstApplicable: boolean;
  gstAmount: number;
  
  // Context
  verticalType?: 'DRIVING' | 'PLUMBING' | 'TUTORING';
  serviceId?: string;  // Booking ID, Job ID, etc.
}

type LineItemType =
  | 'SERVICE_FARE'          // The actual service (lesson, job, session)
  | 'PLATFORM_FEE'          // DriveBook's platform fee
  | 'COMMISSION'            // DriveBook's commission from provider
  | 'WALLET_CREDIT'         // FVV (Face Value Voucher)
  | 'REFUND'
  | 'ADJUSTMENT';
```

### 2. Ledger Entry

```typescript
// lib/core/financial/ledger.ts

interface LedgerEntry {
  id: string;
  createdAt: Date;
  
  // What happened
  transactionId: string;
  eventType: LedgerEventType;
  
  // Money movement
  amount: number;
  currency: 'AUD';
  
  // Account impacted
  account: LedgerAccount;
  direction: 'DEBIT' | 'CREDIT';
  
  // Running balance (after this entry)
  balanceAfter: number;
  
  // Tax implications
  gstAmount?: number;
  taxPeriod?: string;  // "2026-Q3" for BAS reporting
  
  // Reconciliation
  reconciledAt?: Date;
  reconciledBy?: string;
  
  // Context
  metadata: Record<string, any>;
}

type LedgerEventType =
  | 'CUSTOMER_CHARGE'
  | 'PLATFORM_FEE_REVENUE'
  | 'SERVICE_FARE_RECEIVED'
  | 'COMMISSION_EARNED'
  | 'PROVIDER_PAYOUT'
  | 'REFUND_ISSUED'
  | 'WALLET_CREDIT_LOADED'
  | 'WALLET_DEBIT';

type LedgerAccount =
  | 'STRIPE_BALANCE'        // DriveBook's Stripe balance
  | 'CUSTOMER_WALLET'       // Customer's prepaid credits
  | 'PROVIDER_PAYABLE'      // Money owed to providers
  | 'PLATFORM_REVENUE'      // DriveBook's earnings
  | 'COMMISSION_REVENUE'    // DriveBook's commission earnings
  | 'GST_COLLECTED'         // GST collected from customers
  | 'GST_PAYABLE'           // GST owed to ATO
  | 'PROVIDER_ESCROW';      // Money held for providers (PLATFORM mode)
```

### 3. Document Request

```typescript
// lib/core/financial/documents.ts

interface DocumentRequest {
  type: DocumentType;
  
  // Financial context
  transaction: FinancialTransaction;
  
  // Document recipients
  recipients: {
    customer?: boolean;
    provider?: boolean;
    platform?: boolean;
  };
  
  // Tax treatment
  taxContext: {
    documentDate: Date;
    financialYear: string;
    taxPeriod: string;
  };
  
  // Business context
  businessModel: 'MARKETPLACE' | 'SAAS';
  vertical: 'DRIVING' | 'PLUMBING' | 'TUTORING' | string;
}

type DocumentType =
  | 'CUSTOMER_RECEIPT'           // Customer payment receipt
  | 'CUSTOMER_TAX_INVOICE'       // Tax invoice for customer
  | 'PROVIDER_SETTLEMENT'        // Provider earnings statement
  | 'PROVIDER_COMMISSION_INVOICE'// DriveBook → Provider commission invoice
  | 'ADJUSTMENT_NOTE'            // Refund/correction document
  | 'WALLET_STATEMENT';          // Wallet transaction history
```

---

## Payment Mode Abstraction

### Payment Adapter Interface

```typescript
// lib/core/financial/payment-adapter.ts

interface PaymentAdapter {
  mode: 'PLATFORM' | 'DIRECT';
  
  /**
   * Create a payment
   * Returns external payment ID (Stripe PI or Charge)
   */
  createPayment(request: PaymentRequest): Promise<PaymentResult>;
  
  /**
   * Process a refund
   */
  refundPayment(request: RefundRequest): Promise<RefundResult>;
  
  /**
   * Get payment status
   */
  getPaymentStatus(externalId: string): Promise<PaymentStatus>;
  
  /**
   * Calculate platform fees
   */
  calculateFees(amount: number): FeeBreakdown;
}

interface PaymentRequest {
  amount: number;
  currency: 'AUD';
  
  // Parties
  customerId: string;
  providerId?: string;
  
  // Line items (for receipt/invoice)
  lineItems: LineItem[];
  
  // Context
  description: string;
  metadata: Record<string, any>;
  
  // Idempotency
  idempotencyKey: string;
}

interface PaymentResult {
  success: boolean;
  externalPaymentId: string;  // Stripe PI or Charge ID
  
  // Money breakdown
  totalCharged: number;
  platformFeeAmount: number;
  serviceFareAmount: number;
  
  // Status
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED';
  
  // Core transaction
  transactionId: string;
}

interface FeeBreakdown {
  serviceFare: number;       // $180.00
  platformFee: number;       // $6.48 (3.6%)
  totalCustomerPays: number; // $186.48
  
  // Provider side
  providerGross: number;     // $180.00
  commission: number;        // $18.00 (10%)
  providerNet: number;       // $162.00
}
```

### PLATFORM Mode Adapter

```typescript
// lib/core/financial/adapters/platform-adapter.ts

class PlatformPaymentAdapter implements PaymentAdapter {
  mode = 'PLATFORM' as const;
  
  async createPayment(request: PaymentRequest): Promise<PaymentResult> {
    // Customer pays DriveBook
    // Money goes to DriveBook's Stripe account
    
    const fees = this.calculateFees(request.amount);
    
    // Create Stripe Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(fees.totalCustomerPays * 100),
      currency: 'aud',
      metadata: {
        ...request.metadata,
        serviceFare: fees.serviceFare,
        platformFee: fees.platformFee,
        commission: fees.commission,
      },
    });
    
    // Record in Core ledger
    const transaction = await this.recordTransaction({
      type: 'CUSTOMER_PAYMENT',
      amount: fees.totalCustomerPays,
      lineItems: [
        {
          description: 'Service fare',
          type: 'SERVICE_FARE',
          amount: fees.serviceFare,
          supplier: 'PROVIDER',
          taxable: true,  // If provider GST-registered
        },
        {
          description: 'Platform fee',
          type: 'PLATFORM_FEE',
          amount: fees.platformFee,
          supplier: 'PLATFORM',
          taxable: true,  // DriveBook is GST-registered
        },
      ],
      externalId: paymentIntent.id,
    });
    
    return {
      success: true,
      externalPaymentId: paymentIntent.id,
      totalCharged: fees.totalCustomerPays,
      platformFeeAmount: fees.platformFee,
      serviceFareAmount: fees.serviceFare,
      status: 'PENDING',
      transactionId: transaction.id,
    };
  }
  
  calculateFees(serviceFare: number): FeeBreakdown {
    const platformFeeRate = 0.036;  // 3.6%
    const commissionRate = 0.10;     // 10% (example, varies by tier)
    
    const platformFee = serviceFare * platformFeeRate;
    const commission = serviceFare * commissionRate;
    
    return {
      serviceFare,
      platformFee,
      totalCustomerPays: serviceFare + platformFee,
      providerGross: serviceFare,
      commission,
      providerNet: serviceFare - commission,
    };
  }
}
```

### DIRECT Mode Adapter

```typescript
// lib/core/financial/adapters/direct-adapter.ts

class DirectPaymentAdapter implements PaymentAdapter {
  mode = 'DIRECT' as const;
  
  async createPayment(request: PaymentRequest): Promise<PaymentResult> {
    // Customer pays provider directly via Stripe Connect
    // DriveBook takes application fee
    
    const fees = this.calculateFees(request.amount);
    const provider = await this.getProvider(request.providerId!);
    
    if (!provider.stripeConnectAccountId) {
      throw new Error('Provider has no Stripe Connect account');
    }
    
    // Create charge on connected account
    const charge = await stripe.charges.create({
      amount: Math.round(fees.serviceFare * 100),
      currency: 'aud',
      source: request.paymentMethodId,
      application_fee_amount: Math.round(fees.platformFee * 100),
      destination: provider.stripeConnectAccountId,
      metadata: request.metadata,
    });
    
    // Record in Core ledger
    const transaction = await this.recordTransaction({
      type: 'CUSTOMER_PAYMENT',
      amount: fees.serviceFare,
      lineItems: [
        {
          description: 'Service fare',
          type: 'SERVICE_FARE',
          amount: fees.serviceFare,
          supplier: 'PROVIDER',
          taxable: true,
        },
        {
          description: 'Platform fee (application fee)',
          type: 'PLATFORM_FEE',
          amount: fees.platformFee,
          supplier: 'PLATFORM',
          taxable: true,
        },
      ],
      externalId: charge.id,
    });
    
    return {
      success: true,
      externalPaymentId: charge.id,
      totalCharged: fees.serviceFare,
      platformFeeAmount: fees.platformFee,
      serviceFareAmount: fees.serviceFare,
      status: 'SUCCEEDED',
      transactionId: transaction.id,
    };
  }
  
  calculateFees(serviceFare: number): FeeBreakdown {
    const platformFeeRate = 0.036;  // 3.6%
    const platformFee = serviceFare * platformFeeRate;
    
    // In DIRECT mode:
    // - Customer pays service fare only
    // - Platform fee deducted as application fee
    // - Provider receives (serviceFare - platformFee)
    // - NO commission deducted (provider keeps full service fare minus platform fee)
    
    return {
      serviceFare,
      platformFee,
      totalCustomerPays: serviceFare,  // Customer doesn't pay extra
      providerGross: serviceFare,
      commission: 0,  // No commission in DIRECT mode
      providerNet: serviceFare - platformFee,
    };
  }
}
```

---

## Document Generation (Payment-Mode Agnostic)

```typescript
// lib/core/financial/document-service.ts

class DocumentService {
  async generateCustomerReceipt(transaction: FinancialTransaction): Promise<Document> {
    // Same logic regardless of payment mode
    
    const sections: DocumentSection[] = [];
    
    // Group line items by supplier
    const platformItems = transaction.lineItems.filter(i => i.supplier === 'PLATFORM');
    const providerItems = transaction.lineItems.filter(i => i.supplier === 'PROVIDER');
    
    // Platform fee section (if exists)
    if (platformItems.length > 0) {
      sections.push({
        title: 'Platform Fee',
        supplier: {
          name: 'DriveBook',
          abn: PLATFORM_IDENTITY.abn,
          type: 'PLATFORM',
        },
        items: platformItems,
        showGST: true,
      });
    }
    
    // Provider service section (if exists)
    if (providerItems.length > 0) {
      const provider = await this.getProvider(transaction.payee.id);
      
      sections.push({
        title: 'Service',
        supplier: {
          name: provider.businessName || provider.name,
          abn: provider.abnNumber,
          type: 'PROVIDER',
        },
        items: providerItems,
        showGST: provider.gstRegistered,
        rcti: transaction.paymentMode === 'PLATFORM',  // RCTI only for PLATFORM mode
      });
    }
    
    return this.buildDocument({
      type: 'CUSTOMER_RECEIPT',
      sections,
      transaction,
    });
  }
  
  async generateProviderSettlement(providerId: string, period: DateRange): Promise<Document> {
    // Provider sees their economics only
    
    const transactions = await this.getProviderTransactions(providerId, period);
    
    const summary = {
      totalServiceFare: 0,
      totalCommission: 0,
      totalPayable: 0,
    };
    
    for (const tx of transactions) {
      const serviceFare = tx.lineItems
        .filter(i => i.type === 'SERVICE_FARE')
        .reduce((sum, i) => sum + i.amount, 0);
      
      const commission = tx.lineItems
        .filter(i => i.type === 'COMMISSION')
        .reduce((sum, i) => sum + i.amount, 0);
      
      summary.totalServiceFare += serviceFare;
      summary.totalCommission += commission;
      summary.totalPayable += (serviceFare - commission);
    }
    
    return this.buildSettlementDocument({
      provider,
      period,
      transactions,
      summary,
    });
  }
}
```

---

## Implementation Phases

### Phase 1: Core Foundation (2 weeks)
- [ ] Create Core domain models (Transaction, LedgerEntry, Document)
- [ ] Implement payment adapter interface
- [ ] Build PLATFORM adapter
- [ ] Set up ledger recording
- [ ] Write comprehensive tests

### Phase 2: Document Engine (1 week)
- [ ] Extract document generation from receipt-email.ts
- [ ] Implement payment-mode-agnostic document builder
- [ ] Create template system (sectioned receipts)
- [ ] Test all document combinations

### Phase 3: Migration (1 week)
- [ ] Create adapter layer for existing booking flow
- [ ] Gradually route through Core
- [ ] Run parallel (old + new) for validation
- [ ] Switch to Core as primary

### Phase 4: DIRECT Mode (1 week)
- [ ] Implement DIRECT adapter
- [ ] Test DIRECT payment flow
- [ ] Document DIRECT mode setup
- [ ] Update admin UI for payment mode selection

### Phase 5: Provider Tax Details (1 week)
- [ ] Add ABN/GST fields to Provider schema
- [ ] Build ABN collection flow
- [ ] Integrate ABR API
- [ ] Update document generation with provider details

### Phase 6: Settlement & Reporting (1 week)
- [ ] Build provider settlement statements
- [ ] Create commission invoices (DriveBook → Provider)
- [ ] Implement GST reporting
- [ ] Build reconciliation tools

---

## Success Criteria

**Core is successful when:**

1. ✅ Same Core handles PLATFORM + DIRECT modes
2. ✅ Adding new vertical (plumbing) requires NO Core changes
3. ✅ Switching payment mode is configuration, not code rewrite
4. ✅ All financial events flow through single ledger
5. ✅ Documents generated from single engine
6. ✅ Tax compliance built-in
7. ✅ Audit trail complete
8. ✅ Reconciliation automated

---

## Next Steps

**Immediate priorities:**

1. **Review this spec** - Does the architecture make sense?
2. **Define Phase 1 tasks** - Break down Core foundation into implementable chunks
3. **Create schema changes** - What new models/fields needed?
4. **Plan migration** - How to transition from current receipt-email.ts to Core?

**What should we design next?**

A. Core domain models in detail (TypeScript interfaces)
B. Payment adapter implementations
C. Document engine architecture
D. Migration strategy from current system
E. Schema changes (database models)

Let me know and I'll create detailed specs for whichever area you want to tackle first!