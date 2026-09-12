# Technical Design: Unified Receipt Generation System

## Overview

The unified receipt generation system provides a single, flexible architecture for generating tax-compliant receipts across all payment scenarios in the DriveBook platform. The system replaces seven separate receipt email functions with a context-driven design that handles Australian Tax Office (ATO) regulations including GST, RCTI, and Financial Supply of Vouchers.

**RCTI Deferral**: RCTI support exists in the type system and template engine but is not currently activated by any context factory — no instructor has a signed RCTI agreement as of this version. Reactivating requires adding rctiAgreementStatus to the provider schema and gating documentType: RCTI on rctiAgreementStatus === 'ACTIVE'.

### Design Principles

1. **Single Responsibility**: Each component handles one aspect of receipt generation (validation, calculation, rendering)
2. **Tax Compliance First**: ATO regulations drive the architecture, not business logic convenience
3. **Type Safety**: TypeScript interfaces ensure compile-time correctness
4. **Testability**: Pure functions enable property-based testing of tax calculations
5. **Maintainability**: Context-driven approach eliminates duplicate code

## Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      Receipt Service                        │
│                  (Orchestration Layer)                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Tax_Document_Context
                              │
                ┌─────────────┴─────────────┐
                │                           │
                ▼                           ▼
┌───────────────────────────┐   ┌──────────────────────────┐
│  Tax Document Builder     │   │  Context Validator       │
│  (Business Logic)         │   │  (Input Validation)      │
│                           │   │                          │
│  • Line item              │   │  • Required fields       │
│    classification         │   │  • Enum validation       │
│  • GST calculation        │   │  • Structural checks     │
│  • Supplier grouping      │   └──────────────────────────┘
│  • Section building       │
└───────────────────────────┘
                │
                │ Enriched_Context
                │
                ▼
┌───────────────────────────────────────────────────────────┐
│            Receipt Template Engine                        │
│            (Presentation Layer)                           │
│                                                           │
│  • Header generation                                      │
│  • Metadata rendering                                     │
│  • Line items table                                       │
│  • Supplier information                                   │
│  • GST summaries                                          │
│  • Wallet balance                                         │
│  • Payment details                                        │
│  • Footer & policies                                      │
└───────────────────────────────────────────────────────────┘
                │
                │ HTML
                │
                ▼
┌───────────────────────────────────────────────────────────┐
│              Email Service                                │
│              (External Integration)                       │
└───────────────────────────────────────────────────────────┘
```

## Data Models

### Core Types

```typescript
// Document types supported by the system
enum DocumentType {
  TAX_INVOICE = 'TAX_INVOICE',           // Provider issues tax invoice
  RCTI = 'RCTI',                         // Platform issues RCTI on provider's behalf
  PAYMENT_RECEIPT = 'PAYMENT_RECEIPT',   // Non-tax receipt (wallet top-up)
  MIXED_DOCUMENT = 'MIXED_DOCUMENT',     // Package with multiple suppliers
  ADJUSTMENT_NOTE = 'ADJUSTMENT_NOTE'    // Cancellation or refund
}

// Business model determines fee structure
enum BusinessModel {
  MARKETPLACE = 'MARKETPLACE',  // DriveBook charges platform fee
  SAAS = 'SAAS'                // Subscription-based model
}

// Payment routing
enum PaymentMode {
  PLATFORM = 'PLATFORM',  // Payment via DriveBook Stripe account
  DIRECT = 'DIRECT'       // Direct payment to provider
}

// Line item types
enum LineItemType {
  SERVICE = 'SERVICE',            // Provider's service delivery
  FVV = 'FVV',                   // Financial supply of voucher (wallet credit)
  PLATFORM_FEE = 'PLATFORM_FEE', // DriveBook's service fee
  COMMISSION = 'COMMISSION'       // Provider commission (future use)
}

// Supplier classification for grouping and tax treatment
enum SupplierType {
  PROVIDER = 'PROVIDER',   // Service provider (instructor)
  PLATFORM = 'PLATFORM',   // DriveBook platform
  NONE = 'NONE'           // No supplier (FVV)
}
```

### Tax Document Context

The input data structure containing all information needed to generate a receipt:

```typescript
interface TaxDocumentContext {
  // Document metadata
  documentType: DocumentType;
  receiptId: string;                    // Unique transaction identifier
  receiptNumber?: string;               // Formatted receipt number (generated if not provided)
  issuedDate: Date;
  
  // Business context
  businessModel: BusinessModel;
  paymentMode: PaymentMode;
  
  // Parties
  customer: {
    name: string;
    email: string;
    abn?: string;                       // For B2B transactions
  };
  
  provider?: {
    id: string;
    name: string;
    businessName?: string;              // Trading name if different from personal name
    abn: string;
    abnVerified: boolean;
    gstRegistered: boolean;
  };
  
  // Transaction details
  items: LineItem[];
  payment: PaymentDetails;
  
  // Optional context for specific receipt types
  booking?: BookingContext;
  wallet?: WalletContext;
  cancellation?: CancellationContext;
}

interface LineItem {
  description: string;
  type: LineItemType;
  amount: number;                       // Total amount in dollars
  quantity?: number;
  rate?: number;                        // Per-unit rate if quantity provided
  supplier: SupplierType;
  taxable: boolean;
  gst?: number;                         // Calculated GST amount
  gstIncluded?: boolean;                // Whether GST is included in amount
}

interface PaymentDetails {
  total: number;                        // Total charged to payment method
  method?: string;                      // e.g., "Visa ending in 4242"
  stripePaymentIntentId?: string;
  stripeChargeId?: string;
}

interface BookingContext {
  id: string;
  startTime: Date;
  duration: number;                     // Minutes
  pickupAddress?: string;
  serviceType?: string;                 // e.g., "Driving Lesson"
}

interface WalletContext {
  previousBalance: number;
  credited?: number;
  debited?: number;
  newBalance: number;
  hourlyRate?: number;                  // For calculating hours remaining
}

interface CancellationContext {
  cancelledBy: 'student' | 'instructor' | 'admin';
  refundAmount: number;
  refundPercent: number;
  refundDestination: 'card' | 'wallet';
  refundReason?: string;
}
```

### Enriched Document Structure

The output of Tax Document Builder, ready for rendering:

```typescript
interface EnrichedDocument {
  context: TaxDocumentContext;
  receiptNumber: string;                // Formatted: "DB-2024-ABC123"
  sections: DocumentSection[];
  totals: {
    subtotal: number;
    gst: number;
    total: number;
  };
  validation: {
    itemsMatchTotal: boolean;
    gstCalculationsCorrect: boolean;
  };
}

interface DocumentSection {
  title: string;                        // e.g., "Platform Fee", "Service (RCTI)", "Wallet"
  supplier: {
    name: string;
    abn?: string;
  } | null;
  items: EnrichedLineItem[];
  showGST: boolean;
  rcti: boolean;                        // RCTI flag for special rendering
  note?: string;                        // Additional context (e.g., FVV note)
}

interface EnrichedLineItem extends LineItem {
  gst: number;                          // Always calculated
  gstIncluded: boolean;                 // Always determined
  formattedDescription: string;         // With quantity/rate if applicable
}
```

## Component Details

### 1. Context Validator

**Purpose**: Validate input context before processing to fail fast on invalid data.

**Responsibilities**:
- Check required fields are present
- Validate enum values
- Verify structural constraints (e.g., RCTI requires provider details)
- Validate line item structure

**Implementation**:

```typescript
class ContextValidator {
  validate(context: TaxDocumentContext): ValidationResult {
    const errors: string[] = [];
    
    // Required fields
    if (!context.documentType) errors.push('documentType is required');
    if (!context.receiptId) errors.push('receiptId is required');
    if (!context.issuedDate) errors.push('issuedDate is required');
    if (!context.customer?.name) errors.push('customer.name is required');
    if (!context.customer?.email) errors.push('customer.email is required');
    if (!context.items || context.items.length === 0) {
      errors.push('At least one line item is required');
    }
    
    // Enum validation
    if (!Object.values(DocumentType).includes(context.documentType)) {
      errors.push('Invalid documentType');
    }
    if (!Object.values(BusinessModel).includes(context.businessModel)) {
      errors.push('Invalid businessModel');
    }
    if (!Object.values(PaymentMode).includes(context.paymentMode)) {
      errors.push('Invalid paymentMode');
    }
    
    // Conditional validation
    if ([DocumentType.RCTI, DocumentType.TAX_INVOICE].includes(context.documentType)) {
      if (!context.provider) {
        errors.push('Provider details required for tax invoices');
      }
    }
    
    // Line item validation
    context.items?.forEach((item, index) => {
      if (!item.description) {
        errors.push(`Item ${index}: description is required`);
      }
      if (!item.type || !Object.values(LineItemType).includes(item.type)) {
        errors.push(`Item ${index}: invalid type`);
      }
      if (typeof item.amount !== 'number') {
        errors.push(`Item ${index}: amount must be a number`);
      }
    });
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}
```

### 2. Tax Document Builder

**Purpose**: Core business logic for tax calculations, classification, and grouping.

**Responsibilities**:
- Classify line items by supplier
- Calculate GST amounts based on supplier registration status
- Group line items by supplier
- Build document sections with appropriate metadata
- Verify totals match

**Key Algorithms**:

#### Line Item Classification

```typescript
classifyLineItem(item: LineItem, provider?: Provider): EnrichedLineItem {
  // Determine supplier
  let supplier: SupplierType;
  switch (item.type) {
    case LineItemType.SERVICE:
      supplier = SupplierType.PROVIDER;
      break;
    case LineItemType.PLATFORM_FEE:
      supplier = SupplierType.PLATFORM;
      break;
    case LineItemType.FVV:
      supplier = SupplierType.NONE;
      break;
    case LineItemType.COMMISSION:
      supplier = SupplierType.PLATFORM;
      break;
  }
  
  // Determine taxability
  let taxable = false;
  switch (supplier) {
    case SupplierType.PLATFORM:
      taxable = true;  // Platform fees always include GST
      break;
    case SupplierType.PROVIDER:
      taxable = provider?.gstRegistered ?? false;
      break;
    case SupplierType.NONE:
      taxable = false;  // FVV is never taxable at purchase
      break;
  }
  
  // Calculate GST
  const gst = taxable ? calculateGST(item.amount) : 0;
  
  return {
    ...item,
    supplier,
    taxable,
    gst,
    gstIncluded: taxable,
    formattedDescription: formatDescription(item)
  };
}
```

#### GST Calculation

Australian GST is 10% and is typically included in the price. The formula to extract GST from a GST-inclusive amount is:

```
GST = Amount - (Amount / 1.1)
```

This is equivalent to `Amount × (1/11)` or approximately `Amount × 0.0909`.

```typescript
const GST_RATE = 0.1;
const GST_DIVISOR = 1 + GST_RATE; // 1.1

function calculateGST(amountIncludingGST: number): number {
  // Extract GST from GST-inclusive amount
  const gst = amountIncludingGST - (amountIncludingGST / GST_DIVISOR);
  // Round to 2 decimal places to avoid floating point errors
  return Math.round(gst * 100) / 100;
}
```

#### Supplier Grouping

```typescript
groupLineItemsBySupplier(items: EnrichedLineItem[]): Map<SupplierType, EnrichedLineItem[]> {
  const groups = new Map<SupplierType, EnrichedLineItem[]>();
  
  // Initialize groups in desired order
  groups.set(SupplierType.PLATFORM, []);
  groups.set(SupplierType.PROVIDER, []);
  groups.set(SupplierType.NONE, []);
  
  // Group items while preserving order within groups
  for (const item of items) {
    groups.get(item.supplier)!.push(item);
  }
  
  // Remove empty groups
  for (const [supplier, items] of groups.entries()) {
    if (items.length === 0) {
      groups.delete(supplier);
    }
  }
  
  return groups;
}
```

#### Section Building

```typescript
buildSection(
  supplier: SupplierType,
  items: EnrichedLineItem[],
  context: TaxDocumentContext
): DocumentSection {
  const PLATFORM_ABN = '23 806 069 420';
  
  switch (supplier) {
    case SupplierType.PLATFORM:
      return {
        title: 'Platform Fee',
        supplier: {
          name: 'DriveBook',
          abn: PLATFORM_ABN
        },
        items,
        showGST: true,
        rcti: false
      };
      
    case SupplierType.PROVIDER:
      const isRCTI = false; // RCTI deferred — no instructor has a signed agreement yet.
                             // Re-enable via context.documentType === DocumentType.RCTI
                             // once rctiAgreementStatus is added to the provider schema.
      return {
        title: isRCTI ? 'Service (RCTI)' : 'Service',
        supplier: {
          name: context.provider!.businessName || context.provider!.name,
          abn: context.provider!.abn
        },
        items,
        showGST: context.provider!.gstRegistered,
        rcti: isRCTI
      };
      
    case SupplierType.NONE:
      return {
        title: 'Wallet',
        supplier: null,
        items,
        showGST: false,
        rcti: false,
        note: 'GST (if any) applies when credits are redeemed for services'
      };
  }
}
```

### 3. Receipt Template Engine

**Purpose**: Generate HTML from enriched document structure.

**Responsibilities**:
- Render document header with appropriate title
- Generate metadata table
- Render sections with supplier information
- Display line items tables
- Show GST summaries
- Render wallet balance changes
- Display payment details
- Include footer with links and policies

**Design Pattern**: Template Method with component functions.

**Key Components**:

```typescript
class ReceiptTemplateEngine {
  generate(doc: EnrichedDocument): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          ${this.renderStyles()}
        </head>
        <body>
          <div class="receipt-container">
            ${this.renderHeader(doc)}
            ${this.renderMetadata(doc)}
            ${this.renderSections(doc)}
            ${this.renderWalletBalance(doc)}
            ${this.renderPaymentDetails(doc)}
            ${this.renderCancellationPolicy(doc)}
            ${this.renderFooter(doc)}
          </div>
        </body>
      </html>
    `;
  }
  
  private renderHeader(doc: EnrichedDocument): string {
    const titles = {
      [DocumentType.TAX_INVOICE]: 'Tax Receipt',
      [DocumentType.RCTI]: 'Tax Invoice (RCTI)',
      [DocumentType.PAYMENT_RECEIPT]: 'Payment Receipt',
      [DocumentType.MIXED_DOCUMENT]: 'Payment Receipt & Tax Invoice',
      [DocumentType.ADJUSTMENT_NOTE]: 'Booking Cancelled'
    };
    
    const title = titles[doc.context.documentType];
    const isAdjustment = doc.context.documentType === DocumentType.ADJUSTMENT_NOTE;
    const gradientClass = isAdjustment ? 'red-gradient' : 'blue-gradient';
    
    return `
      <div class="header ${gradientClass}">
        <h1>${title}</h1>
        <p class="subtitle">DriveBook Platform</p>
      </div>
    `;
  }
  
  private renderSection(section: DocumentSection): string {
    return `
      <div class="section">
        <h2>${section.title}</h2>
        ${this.renderSupplierInfo(section)}
        ${this.renderLineItemsTable(section.items)}
        ${this.renderGSTSummary(section)}
        ${section.note ? `<p class="note">${section.note}</p>` : ''}
      </div>
    `;
  }
  
  private renderSupplierInfo(section: DocumentSection): string {
    if (!section.supplier) return '';
    
    if (section.rcti) {
      return `
        <div class="rcti-block">
          <p class="rcti-label">Recipient Created Tax Invoice (RCTI)</p>
          <p>Issued by DriveBook on behalf of:</p>
          <p><strong>Supplier:</strong> ${section.supplier.name}</p>
          <p><strong>ABN:</strong> ${section.supplier.abn}</p>
        </div>
      `;
    }
    
    return `
      <div class="supplier-info">
        <p><strong>Supplier:</strong> ${section.supplier.name}</p>
        ${section.supplier.abn ? `<p><strong>ABN:</strong> ${section.supplier.abn}</p>` : ''}
      </div>
    `;
  }
  
  private renderLineItemsTable(items: EnrichedLineItem[]): string {
    const rows = items.map(item => `
      <tr>
        <td>${item.formattedDescription}</td>
        <td class="amount">$${item.amount.toFixed(2)}</td>
      </tr>
    `).join('');
    
    return `
      <table class="line-items">
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  }
  
  private renderGSTSummary(section: DocumentSection): string {
    if (!section.showGST) return '';
    
    const totalGST = section.items.reduce((sum, item) => sum + item.gst, 0);
    
    if (totalGST > 0) {
      return `
        <p class="gst-summary">
          GST included: $${totalGST.toFixed(2)} (Goods & Services Tax)
        </p>
      `;
    } else {
      return `
        <p class="gst-summary">
          This supplier is not GST-registered. No GST applies.
        </p>
      `;
    }
  }
}
```

### 4. Receipt Service (Orchestrator)

**Purpose**: Coordinate validation, building, rendering, and email sending.

**Public Interface**:

```typescript
class ReceiptService {
  private validator: ContextValidator;
  private builder: TaxDocumentBuilder;
  private templateEngine: ReceiptTemplateEngine;
  private emailService: EmailService;
  
  /**
   * Generate and send a receipt email
   */
  async generateAndSend(context: TaxDocumentContext): Promise<void> {
    // 1. Validate input
    const validation = this.validator.validate(context);
    if (!validation.valid) {
      throw new ValidationError(validation.errors.join(', '));
    }
    
    // 2. Build enriched document
    const enrichedDoc = this.builder.build(context);
    
    // 3. Verify calculations
    if (!enrichedDoc.validation.itemsMatchTotal) {
      console.warn('Line items total does not match payment total');
    }
    
    // 4. Generate HTML
    const html = this.templateEngine.generate(enrichedDoc);
    
    // 5. Send email
    const subject = this.buildEmailSubject(context);
    await this.emailService.send({
      from: 'DriveBook Payments <payments@drivebook.com.au>',
      to: context.customer.email,
      subject,
      html
    });
  }
  
  /**
   * Generate receipt HTML without sending email (for testing)
   */
  generateHTML(context: TaxDocumentContext): string {
    const validation = this.validator.validate(context);
    if (!validation.valid) {
      throw new ValidationError(validation.errors.join(', '));
    }
    
    const enrichedDoc = this.builder.build(context);
    return this.templateEngine.generate(enrichedDoc);
  }
  
  private buildEmailSubject(context: TaxDocumentContext): string {
    const receiptNum = context.receiptNumber || 
                       this.formatReceiptNumber(context.receiptId, context.issuedDate);
    
    switch (context.documentType) {
      case DocumentType.TAX_INVOICE:
      case DocumentType.RCTI:
        return `Receipt ${receiptNum} - Lesson Booked`;
      case DocumentType.MIXED_DOCUMENT:
        return `Receipt ${receiptNum} - Package Purchased`;
      case DocumentType.PAYMENT_RECEIPT:
        return `Receipt ${receiptNum} - Wallet Topped Up`;
      case DocumentType.ADJUSTMENT_NOTE:
        return `Cancellation ${receiptNum} - Lesson Cancelled`;
    }
  }
  
  private formatReceiptNumber(id: string, date: Date): string {
    const year = date.getFullYear();
    const shortId = id.slice(-6).toUpperCase();
    return `DB-${year}-${shortId}`;
  }
}
```

## Receipt Type Implementations

### Package Purchase Receipt

**Scenario**: Customer purchases a package (e.g., 10 lessons) with immediate booking of first lesson.

**Context Construction**:

```typescript
function createPackagePurchaseContext(
  customer: Customer,
  provider: Provider,
  booking: Booking,
  packageDetails: PackageDetails,
  payment: PaymentDetails
): TaxDocumentContext {
  return {
    documentType: DocumentType.MIXED_DOCUMENT,
    receiptId: payment.id,
    issuedDate: new Date(),
    businessModel: BusinessModel.MARKETPLACE,
    paymentMode: PaymentMode.PLATFORM,
    
    customer: {
      name: customer.name,
      email: customer.email
    },
    
    provider: {
      id: provider.id,
      name: provider.name,
      businessName: provider.businessName,
      abn: provider.abn,
      abnVerified: provider.abnVerified,
      gstRegistered: provider.gstRegistered
    },
    
    items: [
      {
        description: 'Platform Service Fee',
        type: LineItemType.PLATFORM_FEE,
        amount: packageDetails.platformFee,
        supplier: SupplierType.PLATFORM,
        taxable: true
      },
      {
        description: `Driving Lesson with ${provider.name}`,
        type: LineItemType.SERVICE,
        amount: packageDetails.firstLessonCost,
        quantity: 1,
        rate: packageDetails.hourlyRate,
        supplier: SupplierType.PROVIDER,
        taxable: provider.gstRegistered
      },
      {
        description: 'Lesson Credits',
        type: LineItemType.FVV,
        amount: packageDetails.walletCredit,
        supplier: SupplierType.NONE,
        taxable: false
      }
    ],
    
    payment,
    
    booking: {
      id: booking.id,
      startTime: booking.startTime,
      duration: booking.duration,
      pickupAddress: booking.pickupAddress,
      serviceType: 'Driving Lesson'
    },
    
    wallet: {
      previousBalance: packageDetails.previousWalletBalance,
      credited: packageDetails.walletCredit,
      debited: packageDetails.firstLessonCost,
      newBalance: packageDetails.previousWalletBalance + 
                  packageDetails.walletCredit - 
                  packageDetails.firstLessonCost,
      hourlyRate: packageDetails.hourlyRate
    }
  };
}
```

### Wallet Lesson Booking Receipt

**Scenario**: Customer books lesson using existing wallet credits (no card charge).

```typescript
function createWalletLessonContext(
  customer: Customer,
  provider: Provider,
  booking: Booking,
  wallet: WalletTransaction
): TaxDocumentContext {
  return {
    documentType: provider.gstRegistered ? DocumentType.TAX_INVOICE : DocumentType.PAYMENT_RECEIPT,
    receiptId: booking.id,
    issuedDate: new Date(),
    businessModel: BusinessModel.MARKETPLACE,
    paymentMode: PaymentMode.PLATFORM,
    
    customer: {
      name: customer.name,
      email: customer.email
    },
    
    provider: {
      id: provider.id,
      name: provider.name,
      businessName: provider.businessName,
      abn: provider.abn,
      abnVerified: provider.abnVerified,
      gstRegistered: provider.gstRegistered
    },
    
    items: [
      {
        description: `Driving Lesson with ${provider.name}`,
        type: LineItemType.SERVICE,
        amount: wallet.debited,
        quantity: booking.duration / 60,
        rate: provider.hourlyRate,
        supplier: SupplierType.PROVIDER,
        taxable: provider.gstRegistered
      }
    ],
    
    payment: {
      total: 0,  // No card charge
      method: 'Wallet Credits'
    },
    
    booking: {
      id: booking.id,
      startTime: booking.startTime,
      duration: booking.duration,
      pickupAddress: booking.pickupAddress,
      serviceType: 'Driving Lesson'
    },
    
    wallet: {
      previousBalance: wallet.previousBalance,
      debited: wallet.debited,
      newBalance: wallet.newBalance,
      hourlyRate: provider.hourlyRate
    }
  };
}
```

### Single Lesson Purchase Receipt

**Scenario**: Customer purchases single lesson directly (no package).

```typescript
function createSingleLessonContext(
  customer: Customer,
  provider: Provider,
  booking: Booking,
  payment: PaymentDetails,
  fees: FeeBreakdown
): TaxDocumentContext {
  return {
    documentType: DocumentType.TAX_INVOICE,
    receiptId: payment.id,
    issuedDate: new Date(),
    businessModel: BusinessModel.MARKETPLACE,
    paymentMode: PaymentMode.PLATFORM,
    
    customer: {
      name: customer.name,
      email: customer.email
    },
    
    provider: {
      id: provider.id,
      name: provider.name,
      businessName: provider.businessName,
      abn: provider.abn,
      abnVerified: provider.abnVerified,
      gstRegistered: provider.gstRegistered
    },
    
    items: [
      {
        description: 'Platform Service Fee',
        type: LineItemType.PLATFORM_FEE,
        amount: fees.platformFee,
        supplier: SupplierType.PLATFORM,
        taxable: true
      },
      {
        description: `Driving Lesson with ${provider.name}`,
        type: LineItemType.SERVICE,
        amount: fees.lessonCost,
        quantity: booking.duration / 60,
        rate: provider.hourlyRate,
        supplier: SupplierType.PROVIDER,
        taxable: provider.gstRegistered
      }
    ],
    
    payment,
    
    booking: {
      id: booking.id,
      startTime: booking.startTime,
      duration: booking.duration,
      pickupAddress: booking.pickupAddress,
      serviceType: 'Driving Lesson'
    }
  };
}
```

### Wallet Top-Up Receipt

**Scenario**: Customer adds credits to wallet without booking.

```typescript
function createWalletTopUpContext(
  customer: Customer,
  wallet: WalletTransaction,
  payment: PaymentDetails
): TaxDocumentContext {
  return {
    documentType: DocumentType.PAYMENT_RECEIPT,
    receiptId: payment.id,
    issuedDate: new Date(),
    businessModel: BusinessModel.MARKETPLACE,
    paymentMode: PaymentMode.PLATFORM,
    
    customer: {
      name: customer.name,
      email: customer.email
    },
    
    items: [
      {
        description: 'Lesson Credits',
        type: LineItemType.FVV,
        amount: wallet.credited!,
        supplier: SupplierType.NONE,
        taxable: false
      }
    ],
    
    payment,
    
    wallet: {
      previousBalance: wallet.previousBalance,
      credited: wallet.credited,
      newBalance: wallet.newBalance
    }
  };
}
```

### Cancellation Receipt

**Scenario**: Booking is cancelled with partial or full refund.

```typescript
function createCancellationContext(
  customer: Customer,
  provider: Provider,
  booking: Booking,
  cancellation: CancellationDetails
): TaxDocumentContext {
  return {
    documentType: DocumentType.ADJUSTMENT_NOTE,
    receiptId: cancellation.id,
    issuedDate: new Date(),
    businessModel: BusinessModel.MARKETPLACE,
    paymentMode: PaymentMode.PLATFORM,
    
    customer: {
      name: customer.name,
      email: customer.email
    },
    
    provider: {
      id: provider.id,
      name: provider.name,
      businessName: provider.businessName,
      abn: provider.abn,
      abnVerified: provider.abnVerified,
      gstRegistered: provider.gstRegistered
    },
    
    items: [
      {
        description: `Lesson Cancellation - ${cancellation.refundPercent}% Refund`,
        type: LineItemType.SERVICE,
        amount: -cancellation.refundAmount,  // Negative for refund
        supplier: SupplierType.PROVIDER,
        taxable: provider.gstRegistered
      }
    ],
    
    payment: {
      total: -cancellation.refundAmount
    },
    
    booking: {
      id: booking.id,
      startTime: booking.startTime,
      duration: booking.duration,
      pickupAddress: booking.pickupAddress
    },
    
    cancellation: {
      cancelledBy: cancellation.cancelledBy,
      refundAmount: cancellation.refundAmount,
      refundPercent: cancellation.refundPercent,
      refundDestination: cancellation.refundDestination,
      refundReason: cancellation.refundReason
    },
    
    wallet: cancellation.refundDestination === 'wallet' ? {
      previousBalance: cancellation.walletBalanceBefore,
      credited: cancellation.refundAmount,
      newBalance: cancellation.walletBalanceAfter
    } : undefined
  };
}
```

## Migration Strategy

### Legacy Function Adapters

To enable gradual migration, provide adapter functions that wrap the new service:

```typescript
class LegacyReceiptAdapters {
  constructor(private receiptService: ReceiptService) {}
  
  async sendPackagePurchaseReceipt(
    customer: any,
    provider: any,
    booking: any,
    packageDetails: any,
    payment: any
  ): Promise<void> {
    const context = createPackagePurchaseContext(
      customer, provider, booking, packageDetails, payment
    );
    await this.receiptService.generateAndSend(context);
  }
  
  async sendWalletLessonReceipt(
    customer: any,
    provider: any,
    booking: any,
    wallet: any
  ): Promise<void> {
    const context = createWalletLessonContext(
      customer, provider, booking, wallet
    );
    await this.receiptService.generateAndSend(context);
  }
  
  // ... similar adapters for other receipt types
}
```

### Migration Steps

1. **Phase 1**: Implement new Receipt Service alongside existing functions
2. **Phase 2**: Add adapter layer that calls new service
3. **Phase 3**: Update one receipt type at a time to use adapters
4. **Phase 4**: Test each receipt type in production
5. **Phase 5**: Remove old receipt functions once all types are migrated
6. **Phase 6**: Remove adapter layer and use context constructors directly

## Error Handling

### Validation Errors

```typescript
class ValidationError extends Error {
  constructor(public errors: string[]) {
    super(`Validation failed: ${errors.join(', ')}`);
    this.name = 'ValidationError';
  }
}
```

**Handling**:
- Log validation errors with full context
- Return 400 Bad Request if validation fails in API handler
- Alert monitoring system for repeated validation failures

### Calculation Mismatches

When line item totals don't match payment total:

```typescript
if (Math.abs(calculatedTotal - paymentTotal) > 0.01) {
  console.warn('Receipt total mismatch', {
    receiptId: context.receiptId,
    calculated: calculatedTotal,
    payment: paymentTotal,
    difference: calculatedTotal - paymentTotal
  });
  // Continue processing but flag for review
}
```

### Email Failures

```typescript
try {
  await emailService.send(emailParams);
} catch (error) {
  // Log error with context
  logger.error('Receipt email failed', {
    receiptId: context.receiptId,
    customer: context.customer.email,
    error: error.message
  });
  
  // Queue for retry
  await retryQueue.add({
    type: 'receipt-email',
    context,
    attemptCount: 1
  });
  
  // Don't throw - payment succeeded even if email failed
}
```

## Testing Strategy

### Property-Based Tests

Test universal properties that should hold for all receipts:

1. **GST Calculation Accuracy**: For any taxable line item, GST should equal `amount - amount/1.1` within rounding tolerance
2. **Total Preservation**: For any receipt, sum of line items should equal payment total within $0.01
3. **Supplier Grouping**: For any set of line items, grouping should preserve all items with no duplicates
4. **Enum Validation**: For any context with valid enum values, validation should pass
5. **Tax Treatment Consistency**: For any GST-registered provider service, item should be marked taxable
6. **Receipt Number Format**: For any receipt ID and date, generated number should match format `DB-YYYY-XXXXXX`
7. **Section Ordering**: For any receipt with multiple suppliers, sections should appear in order PLATFORM, PROVIDER, NONE

### Example-Based Tests

Test specific scenarios with known expected outputs:

1. Package purchase with GST-registered instructor
2. Package purchase with non-GST-registered instructor
3. Wallet lesson booking
4. Single lesson purchase
5. Wallet top-up
6. Full refund cancellation
7. Partial refund cancellation
8. No refund cancellation
9. Admin credit
10. Admin deduction

### Integration Tests

Test end-to-end with real email service (using test email addresses):

1. Generate and send each receipt type
2. Verify email is received
3. Verify HTML renders correctly in email clients
4. Verify all links are functional

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Context Enum Validation

*For any* Tax_Document_Context with document type from {TAX_INVOICE, RCTI, PAYMENT_RECEIPT, MIXED_DOCUMENT, ADJUSTMENT_NOTE}, business model from {MARKETPLACE, SAAS}, and payment mode from {PLATFORM, DIRECT}, the context validation SHALL pass the enum validation checks.

**Validates: Requirements 1.2, 1.3, 1.4**

### Property 2: Provider Details Completeness

*For any* Tax_Document_Context that includes provider details, the provider object SHALL contain name, abn, abnVerified, and gstRegistered fields.

**Validates: Requirements 1.5**

### Property 3: Line Item Type to Supplier Mapping

*For any* line item with type SERVICE, the supplier SHALL be classified as PROVIDER; for any line item with type PLATFORM_FEE, the supplier SHALL be PLATFORM; for any line item with type FVV, the supplier SHALL be NONE.

**Validates: Requirements 2.3, 2.4, 2.5**

### Property 4: Tax Treatment by Item Type

*For any* line item with type SERVICE and GST-registered provider, taxable SHALL be true; for any line item with type PLATFORM_FEE, taxable SHALL be true; for any line item with type FVV, taxable SHALL be false.

**Validates: Requirements 2.6, 2.7, 2.8**

### Property 5: GST Calculation Accuracy

*For any* taxable line item with amount A, the calculated GST SHALL equal (A - A/1.1) within $0.01 rounding tolerance.

**Validates: Requirements 3.1, 3.2**

### Property 6: GST Zero for Non-Taxable Items

*For any* line item marked non-taxable OR with non-GST-registered provider, the GST amount SHALL be zero.

**Validates: Requirements 3.3, 3.4**

### Property 7: GST Included Flag Consistency

*For any* line item, gstIncluded SHALL be true if and only if the item is taxable and GST > 0.

**Validates: Requirements 3.5, 3.6**

### Property 8: GST Total Integrity

*For any* receipt, the sum of individual line item GST amounts SHALL equal the total GST amount.

**Validates: Requirements 3.7**

### Property 9: Supplier Grouping Completeness

*For any* set of line items, grouping by supplier SHALL result in all items appearing in exactly one group with no items lost or duplicated.

**Validates: Requirements 4.1, 4.2, 4.3**

### Property 10: Line Item Order Preservation

*For any* ordered list of line items with the same supplier, the grouping operation SHALL preserve their relative order.

**Validates: Requirements 4.4**

### Property 11: Supplier Group Ordering

*For any* receipt containing multiple supplier groups, the groups SHALL appear in order: PLATFORM, then PROVIDER, then NONE.

**Validates: Requirements 4.5**

### Property 12: Platform Section Structure

*For any* receipt with PLATFORM supplier group, the generated section SHALL have title "Platform Fee", supplier name "DriveBook", supplier ABN "23 806 069 420", and showGST true.

**Validates: Requirements 5.1**

### Property 13: RCTI Section Structure

*For any* receipt with document type RCTI and PROVIDER supplier group, the generated section SHALL have title "Service (RCTI)", rcti flag true, and supplier information from the provider details.

**Validates: Requirements 5.2**

### Property 14: Standard Service Section Structure

*For any* receipt with document type other than RCTI and PROVIDER supplier group, the generated section SHALL have title "Service", supplier information from provider, and showGST based on provider gstRegistered status.

**Validates: Requirements 5.3**

### Property 15: Wallet Section Structure

*For any* receipt with NONE supplier group, the generated section SHALL have title "Wallet", null supplier, showGST false, and note about GST applying when credits are redeemed.

**Validates: Requirements 5.4**

### Property 16: Section Item Completeness

*For any* receipt, all line items SHALL appear in exactly one section based on their supplier classification.

**Validates: Requirements 5.5**

### Property 17: Document Type to Header Title Mapping

*For any* document type, the rendered header title SHALL be "Tax Receipt" for TAX_INVOICE, "Tax Invoice (RCTI)" for RCTI, "Payment Receipt" for PAYMENT_RECEIPT, "Payment Receipt & Tax Invoice" for MIXED_DOCUMENT, and "Booking Cancelled" for ADJUSTMENT_NOTE.

**Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**

### Property 18: Receipt Number Format

*For any* receipt ID and issue date, the generated receipt number SHALL match format "DB-{year}-{last6CharsUppercase}".

**Validates: Requirements 17.1, 17.2, 17.3, 17.4, 17.5**

### Property 19: Metadata Completeness

*For any* Tax_Document_Context, the rendered metadata table SHALL contain receipt number, formatted date, customer name, and customer email.

**Validates: Requirements 7.1, 7.2, 7.3, 7.5**

### Property 20: RCTI Supplier Display

*For any* section with rcti flag true and supplier with ABN, the rendered output SHALL contain "Recipient Created Tax Invoice (RCTI)", "Issued by DriveBook on behalf of:", supplier name, and supplier ABN.

**Validates: Requirements 8.2**

### Property 21: Line Item Description Formatting

*For any* line item with quantity and rate, the formatted description SHALL be "{description} ({quantity} × ${rate})"; for any line item without quantity, description SHALL be unchanged.

**Validates: Requirements 9.2, 9.3**

### Property 22: GST Summary Display Logic

*For any* section with showGST true and total GST > 0, the rendered output SHALL display "GST included: ${gstAmount}"; for any section with showGST true and total GST = 0, output SHALL display "This supplier is not GST-registered. No GST applies."; for any section with showGST false, no GST summary SHALL be displayed.

**Validates: Requirements 10.1, 10.2, 10.3**

### Property 23: Wallet Balance Calculation

*For any* wallet context, the displayed new balance SHALL equal previousBalance + credited - debited, and approximate hours SHALL equal newBalance / hourlyRate when hourlyRate is provided.

**Validates: Requirements 11.2, 11.3, 11.4, 11.5, 11.7**

### Property 24: Total Calculation Verification

*For any* receipt, the sum of all line item amounts SHALL equal the payment total within $0.01 tolerance.

**Validates: Requirements 27.1, 27.2, 27.3**

### Property 25: Context Required Fields Validation

*For any* Tax_Document_Context submitted for validation, if any required field (documentType, receiptId, issuedDate, customer.name, customer.email, items array with at least one item) is missing, validation SHALL fail with descriptive error.

**Validates: Requirements 18.1, 18.3, 18.4, 18.5**

### Property 26: Tax Invoice Provider Requirement

*For any* Tax_Document_Context with document type TAX_INVOICE or RCTI, if provider details are not present, validation SHALL fail with error "Provider details required for tax invoices".

**Validates: Requirements 18.2**

## Implementation Notes

### Language and Framework

- **Language**: TypeScript 4.9+
- **Framework**: Next.js 13+ (React Server Components)
- **Email**: Existing email service integration (assumed Resend or similar)
- **Testing**: Vitest for unit tests, fast-check for property-based tests

### Code Structure

```
lib/
  services/
    receipt/
      types.ts              # All TypeScript interfaces and enums
      validator.ts          # ContextValidator class
      builder.ts            # TaxDocumentBuilder class
      template-engine.ts    # ReceiptTemplateEngine class
      receipt-service.ts    # ReceiptService orchestrator
      context-factories.ts  # Helper functions to create contexts
      legacy-adapters.ts    # Migration adapters
      __tests__/
        validator.test.ts
        builder.test.ts
        template-engine.test.ts
        receipt-service.test.ts
        properties.test.ts  # Property-based tests
```

### Environment Variables

```
ADMIN_EMAIL=support@drivebook.com.au
NEXTAUTH_URL=https://drivebook.com.au
PLATFORM_ABN=23 806 069 420
```

### Performance Considerations

- Receipt generation should complete in < 100ms
- Email sending is async and doesn't block payment processing
- Template rendering uses string concatenation (fast) over JSX (slower)
- GST calculations are pure functions (easily cached if needed)

### Security Considerations

- Never log full payment details (card numbers, CVV)
- Sanitize user-provided descriptions to prevent XSI in emails
- Validate ABN format before display
- Use parameterized email templates to prevent injection

### Accessibility

- HTML emails should render correctly in text-only email clients
- Use semantic HTML structure
- Include plain text fallback for critical information

## Future Enhancements

1. **PDF Generation**: Add PDF attachment option alongside HTML email
2. **Internationalization**: Support multiple currencies and tax systems
3. **Receipt History**: Store generated receipts in database for reprinting
4. **Bulk Receipt Generation**: Process multiple receipts in batch
5. **Custom Branding**: Support white-label branding for SAAS model
6. **Advanced Analytics**: Track receipt open rates and engagement

## Appendix: Australian Tax Regulations

### GST (Goods and Services Tax)

- Rate: 10% included in price
- Registration threshold: $75,000 annual turnover
- Suppliers below threshold can voluntarily register
- GST-inclusive pricing is standard in Australia

### RCTI (Recipient Created Tax Invoice)

Requirements for valid RCTI:
1. Written agreement between supplier and recipient
2. Supplier must be GST-registered
3. Supplier must not issue tax invoice for the same supply
4. Document must clearly state "Recipient Created Tax Invoice"
5. Must include supplier's ABN and name

DriveBook issues RCTIs for GST-registered instructors under marketplace agreement.

### FVV (Financial Supply of Voucher)

Under ATO Division 100:
- Purchase of voucher/credit is input-taxed (no GST at purchase)
- GST applies when voucher is redeemed for taxable supply
- Receipt must note that GST applies at redemption
- Wallet credits are treated as FVV

### ABN Verification

- Validate ABN format: 11 digits, valid check digit
- Verify ABN is active via ABN Lookup API
- Check GST registration status via ABN Lookup API
- Store verification timestamp for audit trail

---

**Design Version**: 1.0  
**Language**: TypeScript  
**Author**: Kiro Spec Workflow Agent  
**Last Updated**: 2024
