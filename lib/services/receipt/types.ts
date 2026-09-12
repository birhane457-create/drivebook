/**
 * Unified Receipt Generation System - Core Types
 * 
 * This module defines all TypeScript interfaces and enums for the unified receipt
 * generation system. The system handles Australian Tax Office (ATO) compliance
 * including GST, RCTI, and Financial Supply of Vouchers (FVV).
 * 
 * @module lib/services/receipt/types
 */

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Document types supported by the receipt system.
 * Each type determines the header title and presentation format.
 */
export enum DocumentType {
  /** Provider issues tax invoice (provider GST-registered) */
  TAX_INVOICE = 'TAX_INVOICE',
  
  /** Platform issues RCTI on provider's behalf (requires RCTI agreement) */
  RCTI = 'RCTI',
  
  /** Non-tax receipt (wallet top-up, admin credits) */
  PAYMENT_RECEIPT = 'PAYMENT_RECEIPT',
  
  /** Package with multiple suppliers (platform fee + service + wallet credit) */
  MIXED_DOCUMENT = 'MIXED_DOCUMENT',
  
  /** Cancellation or refund adjustment note */
  ADJUSTMENT_NOTE = 'ADJUSTMENT_NOTE'
}

/**
 * Business model determines fee structure and payment flow.
 */
export enum BusinessModel {
  /** DriveBook charges platform fee (3.6% of discounted package value) */
  MARKETPLACE = 'MARKETPLACE',
  
  /** Subscription-based model (future use) */
  SAAS = 'SAAS'
}

/**
 * Payment routing mode.
 * 
 * Note: Only PLATFORM mode is currently implemented.
 * DIRECT mode exists in the type system for future expansion but has no implementation.
 */
export enum PaymentMode {
  /** Payment via DriveBook Stripe account (✅ Implemented) */
  PLATFORM = 'PLATFORM',
  
  /** Direct payment to provider (❌ Type only, no implementation) */
  DIRECT = 'DIRECT'
}

/**
 * Line item types for different charge components.
 */
export enum LineItemType {
  /** Provider's service delivery (driving lesson, etc.) */
  SERVICE = 'SERVICE',
  
  /** Financial supply of voucher - wallet credit (non-taxable at purchase) */
  FVV = 'FVV',
  
  /** DriveBook's platform service fee (always GST-inclusive) */
  PLATFORM_FEE = 'PLATFORM_FEE',
  
  /** Provider commission (future use) */
  COMMISSION = 'COMMISSION'
}

/**
 * Supplier classification for grouping and tax treatment.
 */
export enum SupplierType {
  /** Service provider (instructor, tradie, tutor) */
  PROVIDER = 'PROVIDER',
  
  /** DriveBook platform */
  PLATFORM = 'PLATFORM',
  
  /** No supplier (FVV wallet credits) */
  NONE = 'NONE'
}

// ============================================================================
// INPUT CONTEXT INTERFACES
// ============================================================================

/**
 * Customer information for receipt generation.
 */
export interface Customer {
  /** Customer's full name */
  name: string;
  
  /** Customer's email address */
  email: string;
  
  /** Australian Business Number (for B2B transactions) */
  abn?: string;
}

/**
 * Provider (service supplier) information.
 * Required for TAX_INVOICE and RCTI document types.
 */
export interface Provider {
  /** Provider's unique identifier */
  id: string;
  
  /** Provider's personal name */
  name: string;
  
  /** Trading name if different from personal name */
  businessName?: string;
  
  /** Australian Business Number */
  abn: string;
  
  /** Whether ABN has been verified via ABN Lookup */
  abnVerified: boolean;
  
  /** Whether provider is registered for GST */
  gstRegistered: boolean;
}

/**
 * Individual line item (charge component) in a receipt.
 */
export interface LineItem {
  /** Human-readable description of the charge */
  description: string;
  
  /** Type of line item (determines supplier and tax treatment) */
  type: LineItemType;
  
  /** Total amount in dollars (GST-inclusive if taxable) */
  amount: number;
  
  /** Optional quantity (e.g., number of lessons, hours) */
  quantity?: number;
  
  /** Optional per-unit rate (displayed as "{quantity} × ${rate}") */
  rate?: number;
  
  /** Supplier classification (auto-assigned by builder based on type) */
  supplier: SupplierType;
  
  /** Whether this item is subject to GST */
  taxable: boolean;
  
  /** Calculated GST amount (set by builder) */
  gst?: number;
  
  /** Whether GST is included in the amount (set by builder) */
  gstIncluded?: boolean;
}

/**
 * Payment details for the transaction.
 */
export interface PaymentDetails {
  /** Total amount charged to payment method (in dollars) */
  total: number;
  
  /** Payment method description (e.g., "Visa ending in 4242") */
  method?: string;
  
  /** Stripe PaymentIntent ID for reference */
  stripePaymentIntentId?: string;
  
  /** Stripe Charge ID for reference */
  stripeChargeId?: string;
}

/**
 * Booking context for lesson/service bookings.
 * Included when receipt is for a booking.
 */
export interface BookingContext {
  /** Booking unique identifier */
  id: string;
  
  /** Scheduled start time of the service */
  startTime: Date;
  
  /** Duration in minutes */
  duration: number;
  
  /** Pickup/meeting address (optional) */
  pickupAddress?: string;
  
  /** Type of service (e.g., "Driving Lesson") */
  serviceType?: string;
}

/**
 * Wallet context for transactions affecting wallet balance.
 * Included when receipt shows wallet credits or debits.
 */
export interface WalletContext {
  /** Wallet balance before this transaction */
  previousBalance: number;
  
  /** Amount credited to wallet (if any) */
  credited?: number;
  
  /** Amount debited from wallet (if any) */
  debited?: number;
  
  /** Wallet balance after this transaction */
  newBalance: number;
  
  /** Provider's hourly rate (for calculating approximate hours remaining) */
  hourlyRate?: number;
}

/**
 * Cancellation context for booking cancellations and refunds.
 * Included when receipt is for a cancellation.
 */
export interface CancellationContext {
  /** Who initiated the cancellation */
  cancelledBy: 'student' | 'instructor' | 'admin';
  
  /** Refund amount in dollars */
  refundAmount: number;
  
  /** Refund percentage (0-100) */
  refundPercent: number;
  
  /** Where refund was sent */
  refundDestination: 'card' | 'wallet';
  
  /** Optional reason for cancellation */
  refundReason?: string;
}

/**
 * Tax Document Context - Complete input data for receipt generation.
 * 
 * This is the main input structure that contains all information needed
 * to generate a compliant tax receipt.
 */
export interface TaxDocumentContext {
  // -------------------------------------------------------------------------
  // Document Metadata
  // -------------------------------------------------------------------------
  
  /** Type of document to generate */
  documentType: DocumentType;
  
  /** Unique transaction identifier (used to generate receipt number) */
  receiptId: string;
  
  /** Formatted receipt number (generated if not provided) */
  receiptNumber?: string;
  
  /** Date and time the receipt was issued */
  issuedDate: Date;
  
  // -------------------------------------------------------------------------
  // Business Context
  // -------------------------------------------------------------------------
  
  /** Business model (determines fee structure) */
  businessModel: BusinessModel;
  
  /** Payment routing mode (only PLATFORM is implemented) */
  paymentMode: PaymentMode;
  
  // -------------------------------------------------------------------------
  // Parties
  // -------------------------------------------------------------------------
  
  /** Customer receiving the receipt */
  customer: Customer;
  
  /** Service provider (required for TAX_INVOICE and RCTI) */
  provider?: Provider;
  
  // -------------------------------------------------------------------------
  // Transaction Details
  // -------------------------------------------------------------------------
  
  /** Line items (charges) in the receipt */
  items: LineItem[];
  
  /** Payment information */
  payment: PaymentDetails;
  
  // -------------------------------------------------------------------------
  // Optional Context (scenario-specific)
  // -------------------------------------------------------------------------
  
  /** Booking details (for lesson/service bookings) */
  booking?: BookingContext;
  
  /** Wallet transaction details (for wallet top-ups or debits) */
  wallet?: WalletContext;
  
  /** Cancellation details (for refunds) */
  cancellation?: CancellationContext;
}

// ============================================================================
// OUTPUT/ENRICHED INTERFACES
// ============================================================================

/**
 * Enriched line item with calculated GST and formatted description.
 * Output from TaxDocumentBuilder.
 */
export interface EnrichedLineItem extends LineItem {
  /** Calculated GST amount (always present after enrichment) */
  gst: number;
  
  /** Whether GST is included in amount (always determined after enrichment) */
  gstIncluded: boolean;
  
  /** Formatted description with quantity/rate if applicable */
  formattedDescription: string;
}

/**
 * Document section representing a group of line items by supplier.
 */
export interface DocumentSection {
  /** Section title (e.g., "Platform Fee", "Service", "Wallet") */
  title: string;
  
  /** Supplier information (null for FVV wallet credits) */
  supplier: {
    name: string;
    abn?: string;
  } | null;
  
  /** Line items in this section */
  items: EnrichedLineItem[];
  
  /** Whether to show GST summary for this section */
  showGST: boolean;
  
  /** Whether this is an RCTI section (special rendering) */
  rcti: boolean;
  
  /** Additional note to display (e.g., FVV GST notice) */
  note?: string;
}

/**
 * Enriched document ready for rendering.
 * Output from TaxDocumentBuilder.build().
 */
export interface EnrichedDocument {
  /** Original input context */
  context: TaxDocumentContext;
  
  /** Formatted receipt number (e.g., "DB-2024-ABC123") */
  receiptNumber: string;
  
  /** Grouped sections by supplier */
  sections: DocumentSection[];
  
  /** Calculated totals */
  totals: {
    /** Sum of all line item amounts (before GST extraction) */
    subtotal: number;
    
    /** Total GST across all items */
    gst: number;
    
    /** Total amount (should match payment.total) */
    total: number;
  };
  
  /** Validation results */
  validation: {
    /** Whether line items total matches payment total (within $0.01) */
    itemsMatchTotal: boolean;
    
    /** Whether all GST calculations are correct */
    gstCalculationsCorrect: boolean;
  };
}

// ============================================================================
// VALIDATION INTERFACES
// ============================================================================

/**
 * Result of context validation.
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  
  /** Array of error messages (empty if valid) */
  errors: string[];
}

/**
 * Custom error thrown when context validation fails.
 */
export class ValidationError extends Error {
  constructor(public errors: string[]) {
    super(`Validation failed: ${errors.join(', ')}`);
    this.name = 'ValidationError';
  }
}
