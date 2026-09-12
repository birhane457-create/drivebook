/**
 * Context Factory Functions - Helper functions for creating Tax Document Contexts
 * 
 * This module provides factory functions that construct TaxDocumentContext objects
 * from domain entities (bookings, customers, providers, etc.). Each factory corresponds
 * to one of the seven receipt scenarios.
 * 
 * @module lib/services/receipt/context-factories
 */

import {
  TaxDocumentContext,
  DocumentType,
  BusinessModel,
  PaymentMode,
  LineItemType,
  SupplierType,
  Customer as ReceiptCustomer,
  Provider as ReceiptProvider,
  BookingContext,
  WalletContext,
  CancellationContext,
  PaymentDetails
} from './types';

// ============================================================================
// TYPES FOR DOMAIN ENTITIES (from existing codebase)
// ============================================================================

interface DomainCustomer {
  name: string;
  email: string;
  abn?: string;
}

interface DomainProvider {
  id: string;
  name: string;
  businessName?: string;
  abn: string;
  abnVerified: boolean;
  gstRegistered: boolean;
}

interface DomainBooking {
  id: string;
  startTime: Date;
  duration: number;
  pickupAddress?: string;
  serviceType?: string;
}

interface DomainPayment {
  total: number;
  method?: string;
  stripePaymentIntentId?: string;
  stripeChargeId?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Platform is GST-registered and charges GST on all platform fees.
 * This constant represents the platform identity's GST registration status.
 */
const PLATFORM_GST_REGISTERED = true;

/**
 * Platform fee rate for MARKETPLACE business model.
 * Calculated as 3.6% of the discounted package value.
 */
const MARKETPLACE_PLATFORM_FEE_RATE = 0.036;

// ============================================================================
// PACKAGE PURCHASE (Scenario 1)
// ============================================================================

/**
 * Create context for package purchase receipt.
 * 
 * Scenario: Customer purchases a package, books first lesson immediately.
 * Document type: MIXED_DOCUMENT (platform fee + service + wallet credit)
 * 
 * @param params - Package purchase parameters
 * @returns TaxDocumentContext ready for receipt generation
 * 
 * Requirements 19.1-19.7
 */
export function createPackagePurchaseContext(params: {
  transactionId: string;
  customer: DomainCustomer;
  provider: DomainProvider;
  booking: DomainBooking;
  payment: DomainPayment;
  discountedPackageValue: number;  // e.g., $855 after 5% discount
  firstLessonCost: number;         // e.g., $90
  walletCredited: number;          // e.g., $734.22
  walletPreviousBalance: number;
  walletNewBalance: number;
  providerHourlyRate?: number;
}): TaxDocumentContext {
  const platformFee = params.discountedPackageValue * MARKETPLACE_PLATFORM_FEE_RATE;

  return {
    documentType: DocumentType.MIXED_DOCUMENT,
    receiptId: params.transactionId,
    issuedDate: new Date(),
    businessModel: BusinessModel.MARKETPLACE,
    paymentMode: PaymentMode.PLATFORM,

    customer: {
      name: params.customer.name,
      email: params.customer.email,
      abn: params.customer.abn
    },

    provider: {
      id: params.provider.id,
      name: params.provider.name,
      businessName: params.provider.businessName,
      abn: params.provider.abn,
      abnVerified: params.provider.abnVerified,
      gstRegistered: params.provider.gstRegistered
    },

    items: [
      {
        description: 'Platform Service Fee',
        type: LineItemType.PLATFORM_FEE,
        amount: platformFee,
        supplier: SupplierType.PLATFORM,
        taxable: PLATFORM_GST_REGISTERED
      },
      {
        description: `Driving Lesson - ${params.booking.duration} minutes`,
        type: LineItemType.SERVICE,
        amount: params.firstLessonCost,
        quantity: params.booking.duration,
        supplier: SupplierType.PROVIDER,
        taxable: params.provider.gstRegistered
      },
      {
        description: 'Wallet Credits',
        type: LineItemType.FVV,
        amount: params.walletCredited,
        supplier: SupplierType.NONE,
        taxable: false
      }
    ],

    payment: {
      total: params.payment.total,
      method: params.payment.method,
      stripePaymentIntentId: params.payment.stripePaymentIntentId,
      stripeChargeId: params.payment.stripeChargeId
    },

    booking: {
      id: params.booking.id,
      startTime: params.booking.startTime,
      duration: params.booking.duration,
      pickupAddress: params.booking.pickupAddress,
      serviceType: params.booking.serviceType
    },

    wallet: {
      previousBalance: params.walletPreviousBalance,
      credited: params.walletCredited,
      debited: params.firstLessonCost,
      newBalance: params.walletNewBalance,
      hourlyRate: params.providerHourlyRate
    }
  };
}

// ============================================================================
// WALLET LESSON BOOKING (Scenario 2)
// ============================================================================

/**
 * Create context for wallet lesson booking receipt.
 * 
 * Scenario: Customer books lesson from existing wallet balance.
 * Document type: TAX_INVOICE (if provider GST-registered) or PAYMENT_RECEIPT
 * Payment total: $0 (paid from wallet)
 * 
 * @param params - Wallet lesson booking parameters
 * @returns TaxDocumentContext ready for receipt generation
 * 
 * Requirements 20.1-20.7
 */
export function createWalletLessonContext(params: {
  transactionId: string;
  customer: DomainCustomer;
  provider: DomainProvider;
  booking: DomainBooking;
  lessonCost: number;
  walletPreviousBalance: number;
  walletNewBalance: number;
  providerHourlyRate?: number;
}): TaxDocumentContext {
  // Requirement 20.1: TAX_INVOICE if provider GST-registered, otherwise PAYMENT_RECEIPT
  const documentType = params.provider.gstRegistered 
    ? DocumentType.TAX_INVOICE 
    : DocumentType.PAYMENT_RECEIPT;

  return {
    documentType,
    receiptId: params.transactionId,
    issuedDate: new Date(),
    businessModel: BusinessModel.MARKETPLACE,
    paymentMode: PaymentMode.PLATFORM,

    customer: {
      name: params.customer.name,
      email: params.customer.email,
      abn: params.customer.abn
    },

    provider: {
      id: params.provider.id,
      name: params.provider.name,
      businessName: params.provider.businessName,
      abn: params.provider.abn,
      abnVerified: params.provider.abnVerified,
      gstRegistered: params.provider.gstRegistered
    },

    items: [
      {
        description: `Driving Lesson - ${params.booking.duration} minutes`,
        type: LineItemType.SERVICE,
        amount: params.lessonCost,
        quantity: params.booking.duration,
        supplier: SupplierType.PROVIDER,
        taxable: params.provider.gstRegistered
      }
    ],

    payment: {
      total: 0  // Requirement 20.5: Zero payment (paid from wallet)
    },

    booking: {
      id: params.booking.id,
      startTime: params.booking.startTime,
      duration: params.booking.duration,
      pickupAddress: params.booking.pickupAddress,
      serviceType: params.booking.serviceType
    },

    wallet: {
      previousBalance: params.walletPreviousBalance,
      debited: params.lessonCost,
      newBalance: params.walletNewBalance,
      hourlyRate: params.providerHourlyRate
    }
  };
}

// ============================================================================
// SINGLE LESSON PURCHASE (Scenario 3)
// ============================================================================

/**
 * Create context for single lesson purchase receipt.
 * 
 * Scenario: Customer purchases and books a single lesson (no package).
 * Document type: TAX_INVOICE (Requirement 21.1)
 * Includes: Platform fee + lesson cost
 * 
 * @param params - Single lesson purchase parameters
 * @returns TaxDocumentContext ready for receipt generation
 * 
 * Requirements 21.1-21.7
 */
export function createSingleLessonContext(params: {
  transactionId: string;
  customer: DomainCustomer;
  provider: DomainProvider;
  booking: DomainBooking;
  payment: DomainPayment;
  lessonCost: number;
}): TaxDocumentContext {
  const platformFee = params.lessonCost * MARKETPLACE_PLATFORM_FEE_RATE;

  return {
    documentType: DocumentType.TAX_INVOICE,  // Requirement 21.1
    receiptId: params.transactionId,
    issuedDate: new Date(),
    businessModel: BusinessModel.MARKETPLACE,
    paymentMode: PaymentMode.PLATFORM,

    customer: {
      name: params.customer.name,
      email: params.customer.email,
      abn: params.customer.abn
    },

    provider: {
      id: params.provider.id,
      name: params.provider.name,
      businessName: params.provider.businessName,
      abn: params.provider.abn,
      abnVerified: params.provider.abnVerified,
      gstRegistered: params.provider.gstRegistered
    },

    items: [
      {
        description: 'Platform Service Fee',
        type: LineItemType.PLATFORM_FEE,
        amount: platformFee,
        supplier: SupplierType.PLATFORM,
        taxable: PLATFORM_GST_REGISTERED
      },
      {
        description: `Driving Lesson - ${params.booking.duration} minutes`,
        type: LineItemType.SERVICE,
        amount: params.lessonCost,
        quantity: params.booking.duration,
        supplier: SupplierType.PROVIDER,
        taxable: params.provider.gstRegistered
      }
    ],

    payment: {
      total: params.payment.total,
      method: params.payment.method,
      stripePaymentIntentId: params.payment.stripePaymentIntentId,
      stripeChargeId: params.payment.stripeChargeId
    },

    booking: {
      id: params.booking.id,
      startTime: params.booking.startTime,
      duration: params.booking.duration,
      pickupAddress: params.booking.pickupAddress,
      serviceType: params.booking.serviceType
    }
  };
}

// ============================================================================
// WALLET TOP-UP (Scenario 4)
// ============================================================================

/**
 * Create context for wallet top-up receipt.
 * 
 * Scenario: Customer adds credits to wallet (no immediate booking).
 * Document type: PAYMENT_RECEIPT
 * Only contains FVV line item (non-taxable at purchase).
 * 
 * @param params - Wallet top-up parameters
 * @returns TaxDocumentContext ready for receipt generation
 * 
 * Requirements 22.1-22.6
 */
export function createWalletTopUpContext(params: {
  transactionId: string;
  customer: DomainCustomer;
  payment: DomainPayment;
  topUpAmount: number;
  walletPreviousBalance: number;
  walletNewBalance: number;
}): TaxDocumentContext {
  return {
    documentType: DocumentType.PAYMENT_RECEIPT,  // Requirement 22.1
    receiptId: params.transactionId,
    issuedDate: new Date(),
    businessModel: BusinessModel.MARKETPLACE,
    paymentMode: PaymentMode.PLATFORM,

    customer: {
      name: params.customer.name,
      email: params.customer.email,
      abn: params.customer.abn
    },

    items: [
      {
        description: 'Wallet Credits',
        type: LineItemType.FVV,  // Requirement 22.2
        amount: params.topUpAmount,
        supplier: SupplierType.NONE,
        taxable: false  // FVV is non-taxable at purchase
      }
    ],

    payment: {
      total: params.payment.total,
      method: params.payment.method,
      stripePaymentIntentId: params.payment.stripePaymentIntentId,
      stripeChargeId: params.payment.stripeChargeId
    },

    wallet: {
      previousBalance: params.walletPreviousBalance,
      credited: params.topUpAmount,
      newBalance: params.walletNewBalance
    }
  };
}

// ============================================================================
// CANCELLATION (Scenario 5)
// ============================================================================

/**
 * Create context for booking cancellation receipt.
 * 
 * Scenario: Booking is cancelled with refund (full or partial based on 24-hour rule).
 * Document type: ADJUSTMENT_NOTE
 * Line items have negative amounts (refunds).
 * 
 * 24-hour binary cancellation rule:
 * - 24+ hours before: 100% refund
 * - Under 24 hours: 0% refund
 * 
 * @param params - Cancellation parameters
 * @returns TaxDocumentContext ready for receipt generation
 * 
 * Requirements: Cancellation handling, 24-hour binary rule
 */
export function createCancellationContext(params: {
  transactionId: string;
  customer: DomainCustomer;
  provider: DomainProvider;
  booking: DomainBooking;
  cancelledBy: 'student' | 'instructor' | 'admin';
  refundAmount: number;
  refundPercent: number;
  refundDestination: 'card' | 'wallet';
  refundReason?: string;
  walletBalanceBefore?: number;
  walletBalanceAfter?: number;
}): TaxDocumentContext {
  return {
    documentType: DocumentType.ADJUSTMENT_NOTE,
    receiptId: params.transactionId,
    issuedDate: new Date(),
    businessModel: BusinessModel.MARKETPLACE,
    paymentMode: PaymentMode.PLATFORM,

    customer: {
      name: params.customer.name,
      email: params.customer.email,
      abn: params.customer.abn
    },

    provider: {
      id: params.provider.id,
      name: params.provider.name,
      businessName: params.provider.businessName,
      abn: params.provider.abn,
      abnVerified: params.provider.abnVerified,
      gstRegistered: params.provider.gstRegistered
    },

    items: [
      {
        description: `Lesson Cancellation - ${params.refundPercent}% Refund`,
        type: LineItemType.SERVICE,
        amount: -params.refundAmount,  // Negative for refund
        supplier: SupplierType.PROVIDER,
        taxable: params.provider.gstRegistered
      }
    ],

    payment: {
      total: -params.refundAmount  // Negative total for refund
    },

    booking: {
      id: params.booking.id,
      startTime: params.booking.startTime,
      duration: params.booking.duration,
      pickupAddress: params.booking.pickupAddress
    },

    cancellation: {
      cancelledBy: params.cancelledBy,
      refundAmount: params.refundAmount,
      refundPercent: params.refundPercent,
      refundDestination: params.refundDestination,
      refundReason: params.refundReason
    },

    // Include wallet context if refund goes to wallet
    wallet: params.refundDestination === 'wallet' && params.walletBalanceBefore !== undefined
      ? {
          previousBalance: params.walletBalanceBefore,
          credited: params.refundAmount,
          newBalance: params.walletBalanceAfter!
        }
      : undefined
  };
}

// ============================================================================
// ADMIN CREDIT (Scenario 6)
// ============================================================================

/**
 * Create context for admin credit receipt.
 * 
 * Scenario: Admin adds credits to customer wallet (e.g., compensation, promotion).
 * Document type: PAYMENT_RECEIPT
 * Payment total: $0 (no charge to customer)
 * 
 * @param params - Admin credit parameters
 * @returns TaxDocumentContext ready for receipt generation
 * 
 * Requirements 23.1-23.6
 */
export function createAdminCreditContext(params: {
  transactionId: string;
  customer: DomainCustomer;
  creditAmount: number;
  creditReason: string;
  walletPreviousBalance: number;
  walletNewBalance: number;
}): TaxDocumentContext {
  return {
    documentType: DocumentType.PAYMENT_RECEIPT,  // Requirement 23.1
    receiptId: params.transactionId,
    issuedDate: new Date(),
    businessModel: BusinessModel.MARKETPLACE,
    paymentMode: PaymentMode.PLATFORM,

    customer: {
      name: params.customer.name,
      email: params.customer.email,
      abn: params.customer.abn
    },

    items: [
      {
        description: `Admin Credit - ${params.creditReason}`,  // Requirement 23.3
        type: LineItemType.FVV,
        amount: params.creditAmount,
        supplier: SupplierType.NONE,
        taxable: false
      }
    ],

    payment: {
      total: 0  // Requirement 23.6: No charge
    },

    wallet: {
      previousBalance: params.walletPreviousBalance,
      credited: params.creditAmount,
      newBalance: params.walletNewBalance
    }
  };
}

// ============================================================================
// ADMIN DEDUCTION (Scenario 7)
// ============================================================================

/**
 * Create context for admin deduction receipt.
 * 
 * Scenario: Admin removes credits from customer wallet (e.g., correction, policy violation).
 * Document type: ADJUSTMENT_NOTE
 * Payment total: $0 (no refund to customer)
 * 
 * @param params - Admin deduction parameters
 * @returns TaxDocumentContext ready for receipt generation
 * 
 * Requirements 24.1-24.6
 */
export function createAdminDeductionContext(params: {
  transactionId: string;
  customer: DomainCustomer;
  deductionAmount: number;
  deductionReason: string;
  walletPreviousBalance: number;
  walletNewBalance: number;
}): TaxDocumentContext {
  return {
    documentType: DocumentType.ADJUSTMENT_NOTE,  // Requirement 24.1
    receiptId: params.transactionId,
    issuedDate: new Date(),
    businessModel: BusinessModel.MARKETPLACE,
    paymentMode: PaymentMode.PLATFORM,

    customer: {
      name: params.customer.name,
      email: params.customer.email,
      abn: params.customer.abn
    },

    items: [
      {
        description: `Admin Deduction - ${params.deductionReason}`,  // Requirement 24.4
        type: LineItemType.FVV,
        amount: -params.deductionAmount,  // Negative for deduction
        supplier: SupplierType.NONE,
        taxable: false
      }
    ],

    payment: {
      total: 0  // No refund to customer
    },

    wallet: {
      previousBalance: params.walletPreviousBalance,
      debited: params.deductionAmount,
      newBalance: params.walletNewBalance
    }
  };
}
