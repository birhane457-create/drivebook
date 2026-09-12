# Unified Receipt Architecture - Design Spec

**Status:** 🔵 DESIGN PHASE - Not yet implemented  
**Date:** September 4, 2026  
**Purpose:** Build receipt system that works for MARKETPLACE + SAAS, PLATFORM + DIRECT modes

---

## Goals

1. **Universal:** Works for all business models (MARKETPLACE/SAAS) and payment modes (PLATFORM/DIRECT)
2. **Compliant:** Meets ATO tax invoice requirements for all scenarios
3. **Flexible:** Easy to add new verticals (tradies, tutors, etc.)
4. **Maintainable:** Single source of truth, no duplicate receipt logic
5. **Correct:** Properly handles supplier identity, GST, FVV rules

---

## Core Concepts

### 1. Tax Document Types

| Type | When Used | Example |
|------|-----------|---------|
| **TAX_INVOICE** | Provider supplies service directly | Instructor provides lesson |
| **RCTI** | Platform issues invoice on provider's behalf | DriveBook issues for instructor |
| **PAYMENT_RECEIPT** | Non-taxable payment (FVV sale) | Wallet top-up |
| **MIXED_DOCUMENT** | Multiple suppliers in one transaction | Package purchase (platform fee + wallet credit) |
| **ADJUSTMENT_NOTE** | Refund, credit, correction | Cancellation refund |

### 2. Supplier Types

| Supplier | Who | When |
|----------|-----|------|
| **PROVIDER** | Instructor, tradie, tutor | The actual service delivery |
| **PLATFORM** | DriveBook | Platform fees, wallet credit facilitation |
| **MIXED** | Both | Package purchase with platform fee |

### 3. Item Types

| Type | Taxable? | Supplier | GST Treatment |
|------|----------|----------|---------------|
| **SERVICE** | Depends on provider GST status | PROVIDER | If provider GST-registered |
| **FVV** (Wallet credit) | No - taxed at redemption | None (yet) | Deferred per Div 100 |
| **PLATFORM_FEE** | Yes | PLATFORM | DriveBook always GST-registered |
| **COMMISSION** | Yes | PLATFORM | For provider's BAS, not customer-facing |

---

## Architecture

### Layer 1: Tax Document Context (Input)

```typescript
interface TaxDocumentContext {
  // Document metadata
  documentType: 'TAX_INVOICE' | 'RCTI' | 'PAYMENT_RECEIPT' | 'MIXED_DOCUMENT' | 'ADJUSTMENT_NOTE';
  receiptNumber: string;
  issuedDate: Date;
  
  // Business context
  businessModel: 'MARKETPLACE' | 'SAAS';
  paymentMode: 'PLATFORM' | 'DIRECT';
  
  // Customer
  customer: {
    name: string;
    email: string;
    abnNumber?: string;  // For B2B
    phone?: string;
  };
  
  // Provider (if applicable)
  provider?: {
    id: string;
    name: string;
    businessName?: string;
    abnNumber?: string;
    abnVerified: boolean;
    gstRegistered: boolean;
    legalName?: string;  // From ABN lookup
  };
  
  // Line items
  items: TaxDocumentItem[];
  
  // Payment details
  payment: {
    method?: string;  // "Visa ending in 4242"
    stripeRef?: string;
    total: number;
  };
  
  // Optional context
  booking?: {
    id: string;
    startTime: Date;
    duration: number;
    location?: string;
  };
  
  wallet?: {
    previousBalance?: number;
    credited?: number;
    debited?: number;
    newBalance?: number;
  };
}

interface TaxDocumentItem {
  description: string;
  type: 'SERVICE' | 'FVV' | 'PLATFORM_FEE' | 'COMMISSION';
  
  // Quantity/pricing
  quantity?: number;
  rate?: number;
  amount: number;
  
  // Tax treatment
  supplier: 'PROVIDER' | 'PLATFORM' | 'NONE';
  taxable: boolean;
  gstIncluded: boolean;
  gstAmount?: number;
  
  // Additional context
  notes?: string;
}
```

### Layer 2: Tax Document Builder (Core Logic)

```typescript
// lib/services/tax-document-service.ts

class TaxDocumentService {
  /**
   * Main entry point - generates tax document from context
   */
  async generateDocument(context: TaxDocumentContext): Promise<TaxDocument> {
    // Validate context
    this.validateContext(context);
    
    // Calculate GST for each item
    const itemsWithGST = this.calculateGST(context.items, context);
    
    // Group items by supplier
    const grouped = this.groupBySupplier(itemsWithGST);
    
    // Build sections
    const sections = this.buildSections(grouped, context);
    
    // Generate HTML
    const html = this.renderHTML(sections, context);
    
    return {
      context,
      sections,
      html,
      totals: this.calculateTotals(itemsWithGST),
    };
  }
  
  /**
   * Calculate GST for each item based on context
   */
  private calculateGST(items: TaxDocumentItem[], context: TaxDocumentContext): TaxDocumentItem[] {
    return items.map(item => {
      if (!item.taxable) {
        return { ...item, gstAmount: 0, gstIncluded: false };
      }
      
      // GST calculation depends on supplier
      if (item.supplier === 'PLATFORM') {
        // DriveBook is always GST-registered
        const gstAmount = item.amount - (item.amount / 1.1);
        return { ...item, gstAmount, gstIncluded: true };
      }
      
      if (item.supplier === 'PROVIDER' && context.provider?.gstRegistered) {
        // Provider is GST-registered
        const gstAmount = item.amount - (item.amount / 1.1);
        return { ...item, gstAmount, gstIncluded: true };
      }
      
      // Provider not GST-registered - no GST
      return { ...item, gstAmount: 0, gstIncluded: false };
    });
  }
  
  /**
   * Group items by supplier for sectioning
   */
  private groupBySupplier(items: TaxDocumentItem[]): Map<string, TaxDocumentItem[]> {
    const groups = new Map<string, TaxDocumentItem[]>();
    
    for (const item of items) {
      const key = item.supplier;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }
    
    return groups;
  }
  
  /**
   * Build document sections based on grouped items
   */
  private buildSections(grouped: Map<string, TaxDocumentItem[]>, context: TaxDocumentContext): DocumentSection[] {
    const sections: DocumentSection[] = [];
    
    // Platform fee section (if exists)
    if (grouped.has('PLATFORM')) {
      sections.push({
        title: 'Platform Fee',
        supplier: {
          name: PLATFORM_IDENTITY.name,
          abn: PLATFORM_IDENTITY.abn,
          type: 'PLATFORM',
        },
        items: grouped.get('PLATFORM')!,
        showGST: true,
      });
    }
    
    // Provider service section (if exists)
    if (grouped.has('PROVIDER') && context.provider) {
      const isRCTI = context.documentType === 'RCTI';
      
      sections.push({
        title: isRCTI ? 'Service (RCTI)' : 'Service',
        supplier: {
          name: context.provider.businessName || context.provider.name,
          abn: context.provider.abnNumber,
          type: 'PROVIDER',
        },
        items: grouped.get('PROVIDER')!,
        showGST: context.provider.gstRegistered,
        rcti: isRCTI,
      });
    }
    
    // Wallet/FVV section (if exists)
    if (grouped.has('NONE')) {
      sections.push({
        title: 'Wallet',
        supplier: null,
        items: grouped.get('NONE')!,
        showGST: false,
        note: 'GST (if any) applies when credits are redeemed for services.',
      });
    }
    
    return sections;
  }
  
  /**
   * Render HTML from sections
   */
  private renderHTML(sections: DocumentSection[], context: TaxDocumentContext): string {
    // Build HTML using sections
    // (Implementation details in Layer 3)
    return buildReceiptHTML(sections, context);
  }
}

interface DocumentSection {
  title: string;
  supplier: {
    name: string;
    abn?: string;
    type: 'PLATFORM' | 'PROVIDER';
  } | null;
  items: TaxDocumentItem[];
  showGST: boolean;
  rcti?: boolean;
  note?: string;
}
```

### Layer 3: Receipt Templates (HTML Generation)

```typescript
// lib/services/receipt-templates.ts

/**
 * Build complete receipt HTML from sections
 */
function buildReceiptHTML(sections: DocumentSection[], context: TaxDocumentContext): string {
  const header = buildHeader(context);
  const meta = buildMetaTable(context);
  const body = sections.map(s => buildSection(s, context)).join('\n');
  const footer = buildFooter(context);
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>${getStyles()}</style>
    </head>
    <body>
      <div class="wrap">
        ${header}
        <div class="body">
          ${meta}
          ${body}
        </div>
        ${footer}
      </div>
    </body>
    </html>
  `;
}

/**
 * Build document header (title, type, branding)
 */
function buildHeader(context: TaxDocumentContext): string {
  const title = getDocumentTitle(context.documentType);
  const subtitle = getDocumentSubtitle(context);
  
  return `
    <div class="header">
      <h1>🚗 ${PLATFORM_IDENTITY.name} — ${title}</h1>
      <p>${subtitle}</p>
    </div>
  `;
}

/**
 * Build meta table (receipt #, ABN, date, customer)
 */
function buildMetaTable(context: TaxDocumentContext): string {
  return `
    <div class="meta">
      <table>
        <tr><td>Receipt #</td><td>${context.receiptNumber}</td></tr>
        <tr><td>Date</td><td>${formatDate(context.issuedDate)}</td></tr>
        <tr><td>Customer</td><td>${context.customer.name}</td></tr>
        <tr><td>Email</td><td>${context.customer.email}</td></tr>
      </table>
    </div>
  `;
}

/**
 * Build individual section (platform fee, service, wallet)
 */
function buildSection(section: DocumentSection, context: TaxDocumentContext): string {
  const supplierInfo = section.supplier ? buildSupplierInfo(section.supplier, section.rcti) : '';
  const lineItems = buildLineItems(section.items);
  const gstSummary = section.showGST ? buildGSTSummary(section.items) : '';
  const note = section.note ? `<p class="section-note">${section.note}</p>` : '';
  
  return `
    <div class="section">
      <h3>${section.title}</h3>
      ${supplierInfo}
      <table class="line-items">
        ${lineItems}
      </table>
      ${gstSummary}
      ${note}
    </div>
  `;
}

/**
 * Build supplier information block
 */
function buildSupplierInfo(supplier: { name: string; abn?: string; type: string }, isRCTI: boolean): string {
  if (!supplier.abn) {
    return `<p class="supplier-info">Supplier: ${supplier.name}</p>`;
  }
  
  if (isRCTI) {
    return `
      <div class="supplier-info rcti">
        <p><strong>Recipient Created Tax Invoice (RCTI)</strong></p>
        <p>Issued by ${PLATFORM_IDENTITY.name} on behalf of:</p>
        <p><strong>Supplier:</strong> ${supplier.name}</p>
        <p><strong>ABN:</strong> ${supplier.abn}</p>
      </div>
    `;
  }
  
  return `
    <div class="supplier-info">
      <p><strong>Supplier:</strong> ${supplier.name}</p>
      <p><strong>ABN:</strong> ${supplier.abn}</p>
    </div>
  `;
}

/**
 * Build line items table rows
 */
function buildLineItems(items: TaxDocumentItem[]): string {
  return items.map(item => {
    const desc = item.quantity && item.rate 
      ? `${item.description} (${item.quantity} × ${fmt(item.rate)})`
      : item.description;
    
    return `<tr><td>${desc}</td><td>${fmt(item.amount)}</td></tr>`;
  }).join('\n');
}

/**
 * Build GST summary line
 */
function buildGSTSummary(items: TaxDocumentItem[]): string {
  const totalGST = items.reduce((sum, item) => sum + (item.gstAmount || 0), 0);
  
  if (totalGST === 0) {
    return '<p class="gst-note">This supplier is not GST-registered. No GST applies.</p>';
  }
  
  return `
    <p class="gst-summary">
      <strong>GST included:</strong> ${fmt(totalGST)} (Goods &amp; Services Tax)
    </p>
  `;
}
```

---

## Usage Examples

### Example 1: Package Purchase (Book Now)

**Scenario:** Student buys 10-hour package, books 2 hours immediately

**Context:**
```typescript
const context: TaxDocumentContext = {
  documentType: 'MIXED_DOCUMENT',
  receiptNumber: 'DB-2026-A3B4C5',
  issuedDate: new Date(),
  businessModel: 'MARKETPLACE',
  paymentMode: 'PLATFORM',
  
  customer: {
    name: 'John Smith',
    email: 'john@example.com',
  },
  
  provider: {
    id: 'prov_123',
    name: 'Sarah Johnson',
    businessName: 'Drive Learn Co',
    abnNumber: '12 345 678 901',
    abnVerified: true,
    gstRegistered: true,
  },
  
  items: [
    {
      description: 'Platform fee',
      type: 'PLATFORM_FEE',
      amount: 32.40,
      supplier: 'PLATFORM',
      taxable: true,
      gstIncluded: true,
    },
    {
      description: 'Driving lesson - 2 hours',
      type: 'SERVICE',
      quantity: 2,
      rate: 90,
      amount: 180.00,
      supplier: 'PROVIDER',
      taxable: true,
      gstIncluded: true,
    },
    {
      description: 'Wallet credit',
      type: 'FVV',
      amount: 720.00,  // 8 hours remaining
      supplier: 'NONE',
      taxable: false,
      gstIncluded: false,
      notes: '8 hours remaining',
    },
  ],
  
  payment: {
    method: 'Visa ending in 4242',
    stripeRef: 'pi_3Abc123',
    total: 932.40,
  },
  
  booking: {
    id: 'book_456',
    startTime: new Date('2026-09-10T10:00:00'),
    duration: 2,
    location: '123 Main St, Melbourne',
  },
  
  wallet: {
    previousBalance: 0,
    credited: 900,
    debited: 180,
    newBalance: 720,
  },
};
```

**Generated Receipt:**
```
┌─────────────────────────────────────────────────┐
│ 🚗 DriveBook — Payment Receipt & Tax Invoice   │
│ Package Purchase with First Lesson              │
└─────────────────────────────────────────────────┘

Receipt #: DB-2026-A3B4C5
Date: 4 September 2026 at 2:30 PM
Customer: John Smith
Email: john@example.com

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PLATFORM FEE
────────────────────────────────────────────────
Supplier: DriveBook
ABN: 23 806 069 420

Platform fee (non-refundable)          $32.40

GST included: $2.95 (Goods & Services Tax)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LESSON BOOKED NOW (RCTI)
────────────────────────────────────────────────
Recipient Created Tax Invoice (RCTI)
Issued by DriveBook on behalf of:
  Supplier: Drive Learn Co
  ABN: 12 345 678 901

Driving lesson (2 × $90/hr)           $180.00
Monday, 10 September 2026 at 10:00 AM
📍 123 Main St, Melbourne

GST included: $16.36 (Goods & Services Tax)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WALLET
────────────────────────────────────────────────
Credit added (8 hours)                $720.00
Previous balance                         $0.00
Lesson booked now                     -$180.00
────────────────────────────────────────────────
New wallet balance                    $720.00

Note: GST (if any) applies when credits are 
redeemed for services.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PAYMENT
────────────────────────────────────────────────
Total charged                         $932.40
Payment method: Visa ending in 4242
Stripe ref: pi_3Abc123

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Questions? support@drivebook.com.au
Manage booking | View dashboard | Login
```

---

### Example 2: Wallet Lesson Booking (Book Later)

**Context:**
```typescript
const context: TaxDocumentContext = {
  documentType: 'RCTI',
  receiptNumber: 'DB-2026-B7C8D9',
  issuedDate: new Date(),
  businessModel: 'MARKETPLACE',
  paymentMode: 'PLATFORM',
  
  customer: {
    name: 'John Smith',
    email: 'john@example.com',
  },
  
  provider: {
    id: 'prov_123',
    name: 'Sarah Johnson',
    businessName: 'Drive Learn Co',
    abnNumber: '12 345 678 901',
    abnVerified: true,
    gstRegistered: true,
  },
  
  items: [
    {
      description: 'Driving lesson - 1.5 hours',
      type: 'SERVICE',
      quantity: 1.5,
      rate: 90,
      amount: 135.00,
      supplier: 'PROVIDER',
      taxable: true,
      gstIncluded: true,
    },
  ],
  
  payment: {
    total: 0,  // Paid from wallet
  },
  
  booking: {
    id: 'book_789',
    startTime: new Date('2026-09-12T14:00:00'),
    duration: 1.5,
    location: '123 Main St, Melbourne',
  },
  
  wallet: {
    previousBalance: 720,
    debited: 135,
    newBalance: 585,
  },
};
```

**Generated Receipt:**
```
┌─────────────────────────────────────────────────┐
│ 🚗 DriveBook — Tax Invoice (RCTI)              │
│ Lesson Booked from Wallet                       │
└─────────────────────────────────────────────────┘

Receipt #: DB-2026-B7C8D9
Date: 5 September 2026 at 3:15 PM
Customer: John Smith
Email: john@example.com

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LESSON
────────────────────────────────────────────────
Recipient Created Tax Invoice (RCTI)
Issued by DriveBook on behalf of:
  Supplier: Drive Learn Co
  ABN: 12 345 678 901

Driving lesson (1.5 × $90/hr)         $135.00
Wednesday, 12 September 2026 at 2:00 PM
📍 123 Main St, Melbourne

GST included: $12.27 (Goods & Services Tax)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WALLET
────────────────────────────────────────────────
Previous balance                      $720.00
Lesson cost                          -$135.00
────────────────────────────────────────────────
New wallet balance                    $585.00

Approx. 6.5 hours remaining at $90/hr

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PAYMENT
────────────────────────────────────────────────
Charged to card                          $0.00
Paid from wallet                       $135.00

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Questions? support@drivebook.com.au
```

---

### Example 3: Provider Without ABN (Below GST Threshold)

**Context:**
```typescript
const context: TaxDocumentContext = {
  documentType: 'MIXED_DOCUMENT',
  receiptNumber: 'DB-2026-C9D0E1',
  issuedDate: new Date(),
  businessModel: 'MARKETPLACE',
  paymentMode: 'PLATFORM',
  
  customer: {
    name: 'Jane Doe',
    email: 'jane@example.com',
  },
  
  provider: {
    id: 'prov_456',
    name: 'Mike Brown',
    businessName: null,
    abnNumber: null,  // No ABN
    abnVerified: false,
    gstRegistered: false,  // Below $75k threshold
  },
  
  items: [
    {
      description: 'Platform fee',
      type: 'PLATFORM_FEE',
      amount: 32.40,
      supplier: 'PLATFORM',
      taxable: true,
      gstIncluded: true,
    },
    {
      description: 'Driving lesson - 2 hours',
      type: 'SERVICE',
      quantity: 2,
      rate: 70,
      amount: 140.00,
      supplier: 'PROVIDER',
      taxable: false,  // Provider not GST-registered
      gstIncluded: false,
    },
    {
      description: 'Wallet credit',
      type: 'FVV',
      amount: 560.00,
      supplier: 'NONE',
      taxable: false,
      gstIncluded: false,
    },
  ],
  
  payment: {
    method: 'Visa ending in 1234',
    total: 732.40,
  },
  
  booking: {
    id: 'book_012',
    startTime: new Date('2026-09-11T09:00:00'),
    duration: 2,
  },
  
  wallet: {
    previousBalance: 0,
    credited: 700,
    debited: 140,
    newBalance: 560,
  },
};
```

**Generated Receipt:**
```
┌─────────────────────────────────────────────────┐
│ 🚗 DriveBook — Payment Receipt                 │
│ Package Purchase with First Lesson              │
└─────────────────────────────────────────────────┘

Receipt #: DB-2026-C9D0E1
Date: 4 September 2026 at 4:20 PM
Customer: Jane Doe
Email: jane@example.com

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PLATFORM FEE
────────────────────────────────────────────────
Supplier: DriveBook
ABN: 23 806 069 420

Platform fee (non-refundable)          $32.40

GST included: $2.95 (Goods & Services Tax)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LESSON BOOKED NOW
────────────────────────────────────────────────
Supplier: Mike Brown

Driving lesson (2 × $70/hr)           $140.00
Tuesday, 11 September 2026 at 9:00 AM

This supplier is not GST-registered. No GST applies.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WALLET
────────────────────────────────────────────────
Credit added (8 hours)                $560.00
Previous balance                         $0.00
Lesson booked now                     -$140.00
────────────────────────────────────────────────
New wallet balance                    $560.00

Note: GST (if any) applies when credits are 
redeemed for services.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PAYMENT
────────────────────────────────────────────────
Total charged                         $732.40
Payment method: Visa ending in 1234

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Implementation Plan

### Phase 1: Core Service (Week 1)
- [ ] Create `lib/services/tax-document-service.ts`
- [ ] Implement `TaxDocumentContext` interface
- [ ] Implement `calculateGST()` logic
- [ ] Implement `groupBySupplier()` logic
- [ ] Write unit tests for core calculations

### Phase 2: Schema Changes (Week 1)
- [ ] Add ABN fields to Provider model
- [ ] Add migration script
- [ ] Update Provider type definitions
- [ ] Add validation rules

### Phase 3: Templates (Week 2)
- [ ] Create `lib/services/receipt-templates.ts`
- [ ] Implement HTML builders
- [ ] Update CSS styles for new sections
- [ ] Test rendering all scenarios

### Phase 4: Integration (Week 2)
- [ ] Update `sendPackagePurchaseReceipt()`
- [ ] Update `sendWalletLessonReceipt()`
- [ ] Update `sendSingleLessonReceipt()`
- [ ] Create `sendCommissionInvoice()` (new)
- [ ] Deprecate old receipt functions

### Phase 5: ABN Collection (Week 3)
- [ ] Add ABN field to instructor onboarding
- [ ] Integrate ABR Lookup API
- [ ] Add RCTI agreement checkbox
- [ ] Build ABN verification admin UI

### Phase 6: Testing & Launch (Week 4)
- [ ] Test all receipt combinations
- [ ] Review with accountant
- [ ] Document in DOCROLEBASE
- [ ] Production deployment

---

## Next Steps

**What do you think of this architecture?**

Key decisions to confirm:
1. ✅ Three-layer approach (Context → Builder → Templates)
2. ✅ RCTI model for marketplace providers
3. ✅ Sectioned receipts (platform fee + service + wallet)
4. ✅ Conditional GST based on provider status
5. ❓ Timeline acceptable? (4 weeks for full implementation)

**Should I:**
A. Proceed with implementation (start with Phase 1 core service)
B. Refine the design further based on your feedback
C. Create detailed schema migration plan first
D. Build prototype/mockup to visualize receipts

What would you like to focus on next?