/**
 * LEDGER OPERATIONS - Specific Money Flows
 * 
 * This file contains high-level operations that create
 * the correct ledger entries for each type of money movement.
 * 
 * Each operation follows the design in FINANCIAL_LEDGER_DESIGN.md
 */

import {
  createLedgerEntries,
  AccountType,
  buildAccount,
  LedgerEntry,
  ReferenceType,
  createLedgerEntriesIdempotently,
} from './ledger';
import { Prisma, Decimal } from '@prisma/client/runtime/library';
import {
  toDecimal,
  toNumber,
  addAmounts,
  subtractAmounts,
  calculatePercentage,
  divideAmount,
  multiplyAmount,
  roundAmount,
  isEqual,
  toFixed,
} from '@/lib/utils/decimal-helpers';

// ============================================
// BOOKING PAYMENT FLOW
// ============================================

/**
 * Record booking payment (3 entries)
 * 
 * Flow:
 * 1. Client wallet → Platform escrow (full amount)
 * 2. Platform escrow → Platform revenue (commission)
 * 3. Platform escrow → Instructor payable (payout)
 */
export async function recordBookingPayment(params: {
  bookingId: string;
  userId: string;
  providerId: string;
  totalAmount: number | Decimal;
  platformFee: number | Decimal;
  providerPayout: number | Decimal;
  transactionId?: string;
  createdBy?: string;
}) {
  const {
    bookingId,
    userId,
    providerId,
    totalAmount,
    platformFee,
    providerPayout,
    transactionId,
    createdBy = 'SYSTEM',
  } = params;

  // Convert to Decimal for validation
  const totalDec = toDecimal(totalAmount);
  const feeDec = toDecimal(platformFee);
  const payoutDec = toDecimal(providerPayout);
  const sumDec = addAmounts(feeDec, payoutDec);

  // Validate amounts using Decimal for exact comparison
  if (!isEqual(totalDec, sumDec)) {
    const totalNum = toNumber(totalDec);
    const feeNum = toNumber(feeDec);
    const payoutNum = toNumber(payoutDec);
    throw new Error(
      `Amount mismatch: ${totalNum} ≠ ${feeNum} + ${payoutNum}`
    );
  }

  // Convert to numbers for ledger (ledger uses number type)
  const totalNum = toNumber(totalDec);
  const feeNum = toNumber(feeDec);
  const payoutNum = toNumber(payoutDec);

  const entries: LedgerEntry[] = [
    // Entry 1: Client pays into escrow
    {
      debitAccount: buildAccount(AccountType.CLIENT_WALLET, userId),
      creditAccount: buildAccount(AccountType.PLATFORM_ESCROW),
      amount: totalNum,
      description: `Payment for booking #${bookingId}`,
      idempotencyKey: `booking-${bookingId}-payment`,
      bookingId,
      userId,
      providerId,
      transactionId,
      createdBy,
      metadata: { type: 'booking_payment', totalAmount: totalNum },
    },

    // Entry 2: Platform takes commission
    {
      debitAccount: buildAccount(AccountType.PLATFORM_ESCROW),
      creditAccount: buildAccount(AccountType.PLATFORM_REVENUE),
      amount: feeNum,
      description: `Platform commission for booking #${bookingId}`,
      idempotencyKey: `booking-${bookingId}-commission`,
      bookingId,
      userId,
      providerId,
      transactionId,
      createdBy,
      metadata: { 
        type: 'commission', 
        rate: toNumber(divideAmount(multiplyAmount(feeDec, 100), totalDec))
      },
    },

    // Entry 3: Instructor earns payout
    {
      debitAccount: buildAccount(AccountType.PLATFORM_ESCROW),
      creditAccount: buildAccount(AccountType.INSTRUCTOR_PAYABLE, providerId),
      amount: payoutNum,
      description: `Instructor payout for booking #${bookingId}`,
      idempotencyKey: `booking-${bookingId}-instructor-payout`,
      bookingId,
      userId,
      providerId,
      transactionId,
      createdBy,
      metadata: { type: 'instructor_payout', providerPayout: payoutNum },
    },
  ];

  return createLedgerEntriesIdempotently(entries);
}

export async function recordPdaFundsHeld(params: {
  pdaBookingId: string;
  customerId: string;
  userId: string;
  providerId: string;
  walletTransactionId: string;
  amount: number | Decimal;
  currency?: string;
  createdBy?: string;
}) {
  const amount = toNumber(toDecimal(params.amount));
  if (amount <= 0) throw new Error('PDA funds-held amount must be positive');

  return createLedgerEntriesIdempotently([{
    debitAccount: buildAccount(AccountType.CLIENT_WALLET, params.userId),
    creditAccount: buildAccount(AccountType.PDA_FUNDS_HELD),
    amount,
    description: `PDA funds held for booking #${params.pdaBookingId}`,
    idempotencyKey: `pda-${params.pdaBookingId}-funds-held`,
    referenceType: ReferenceType.PDA_BOOKING,
    referenceId: params.pdaBookingId,
    pdaBookingId: params.pdaBookingId,
    walletTransactionId: params.walletTransactionId,
    customerId: params.customerId,
    userId: params.userId,
    providerId: params.providerId,
    entryType: 'PDA_FUNDS_HELD',
    status: 'HELD',
    currency: params.currency ?? 'AUD',
    metadata: {
      type: 'PDA_FUNDS_HELD',
      pdaBookingId: params.pdaBookingId,
      customerId: params.customerId,
      providerId: params.providerId,
      originalWalletTransactionId: params.walletTransactionId,
      amount,
      currency: params.currency ?? 'AUD',
    },
    createdBy: params.createdBy ?? 'SYSTEM',
  }])
}

export async function recordPdaFundsRefund(params: {
  refundId: string;
  pdaBookingId: string;
  customerId: string;
  userId: string;
  providerId: string;
  originalWalletTransactionId: string;
  refundWalletTransactionId: string;
  amount: number | Decimal;
  currency?: string;
  createdBy?: string;
}) {
  const amount = toNumber(toDecimal(params.amount));
  if (amount <= 0) throw new Error('PDA refund amount must be positive');

  return createLedgerEntriesIdempotently([{
    debitAccount: buildAccount(AccountType.PDA_FUNDS_HELD),
    creditAccount: buildAccount(AccountType.CLIENT_WALLET, params.userId),
    amount,
    description: `PDA refund for booking #${params.pdaBookingId}`,
    idempotencyKey: `pda-refund-${params.refundId}`,
    referenceType: ReferenceType.PDA_REFUND,
    referenceId: params.refundId,
    pdaBookingId: params.pdaBookingId,
    pdaRefundId: params.refundId,
    walletTransactionId: params.originalWalletTransactionId,
    customerId: params.customerId,
    userId: params.userId,
    providerId: params.providerId,
    entryType: 'PDA_REFUND',
    status: 'POSTED',
    currency: params.currency ?? 'AUD',
    metadata: {
      type: 'PDA_REFUND',
      pdaBookingId: params.pdaBookingId,
      pdaRefundId: params.refundId,
      customerId: params.customerId,
      providerId: params.providerId,
      originalWalletTransactionId: params.originalWalletTransactionId,
      refundWalletTransactionId: params.refundWalletTransactionId,
      amount,
      currency: params.currency ?? 'AUD',
    },
    createdBy: params.createdBy ?? 'SYSTEM',
  }])
}

// ============================================
// PAYOUT PROCESSING
// ============================================

/**
 * Record payout to instructor (1 entry)
 * 
 * Flow:
 * Instructor payable → Instructor paid
 */
export async function recordInstructorPayout(params: {
  payoutId: string;
  providerId: string;
  amount: number | Decimal;
  stripePayoutId?: string;
  processedBy: string;
}) {
  const { payoutId, providerId, amount, stripePayoutId, processedBy } = params;

  const entry: LedgerEntry = {
    debitAccount: buildAccount(AccountType.INSTRUCTOR_PAYABLE, providerId),
    creditAccount: buildAccount(AccountType.INSTRUCTOR_PAID, providerId),
    amount: toNumber(toDecimal(amount)),
    description: `Payout processed via Stripe`,
    idempotencyKey: stripePayoutId
      ? `payout-${payoutId}-stripe-${stripePayoutId}`
      : `payout-${payoutId}`,
    payoutId,
    providerId,
    createdBy: processedBy,
    metadata: {
      type: 'payout',
      stripePayoutId,
      processedAt: new Date().toISOString(),
    },
  };

  return createLedgerEntries([entry]);
}

// ============================================
// REFUND FLOWS
// ============================================

/**
 * Record full refund (3 entries - reverse original)
 * 
 * Flow:
 * 1. Instructor payable → Platform escrow (reverse payout)
 * 2. Platform revenue → Platform escrow (reverse commission)
 * 3. Platform escrow → Client wallet (refund to client)
 */
export async function recordFullRefund(params: {
  refundId: string;
  bookingId: string;
  userId: string;
  providerId: string;
  totalAmount: number | Decimal;
  platformFee: number | Decimal;
  providerPayout: number | Decimal;
  reason?: string;
  createdBy?: string;
}) {
  const {
    refundId,
    bookingId,
    userId,
    providerId,
    totalAmount,
    platformFee,
    providerPayout,
    reason,
    createdBy = 'SYSTEM',
  } = params;

  // Convert to numbers for ledger
  const totalNum = toNumber(toDecimal(totalAmount));
  const feeNum = toNumber(toDecimal(platformFee));
  const payoutNum = toNumber(toDecimal(providerPayout));

  const entries: LedgerEntry[] = [
    // Entry 1: Reverse instructor payout
    {
      debitAccount: buildAccount(AccountType.INSTRUCTOR_PAYABLE, providerId),
      creditAccount: buildAccount(AccountType.PLATFORM_ESCROW),
      amount: payoutNum,
      description: `Refund: Reverse instructor payout for booking #${bookingId}`,
      idempotencyKey: `refund-${refundId}-instructor`,
      bookingId,
      userId,
      providerId,
      createdBy,
      metadata: { type: 'refund_instructor', reason, percentage: 100 },
    },

    // Entry 2: Reverse platform commission
    {
      debitAccount: buildAccount(AccountType.PLATFORM_REVENUE),
      creditAccount: buildAccount(AccountType.PLATFORM_ESCROW),
      amount: feeNum,
      description: `Refund: Reverse commission for booking #${bookingId}`,
      idempotencyKey: `refund-${refundId}-commission`,
      bookingId,
      userId,
      providerId,
      createdBy,
      metadata: { type: 'refund_commission', reason, percentage: 100 },
    },

    // Entry 3: Refund to client
    {
      debitAccount: buildAccount(AccountType.PLATFORM_ESCROW),
      creditAccount: buildAccount(AccountType.CLIENT_WALLET, userId),
      amount: totalNum,
      description: `Refund for cancelled booking #${bookingId}`,
      idempotencyKey: `refund-${refundId}-client`,
      bookingId,
      userId,
      providerId,
      createdBy,
      metadata: { type: 'refund_client', reason, percentage: 100 },
    },
  ];

  return createLedgerEntries(entries);
}

/**
 * Record partial refund (3 entries - proportional reverse)
 */
export async function recordPartialRefund(params: {
  refundId: string;
  bookingId: string;
  userId: string;
  providerId: string;
  refundAmount: number | Decimal;
  refundPercentage: number;
  originalPlatformFee: number | Decimal;
  originalInstructorPayout: number | Decimal;
  reason?: string;
  createdBy?: string;
}) {
  const {
    refundId,
    bookingId,
    userId,
    providerId,
    refundAmount,
    refundPercentage,
    originalPlatformFee,
    originalInstructorPayout,
    reason,
    createdBy = 'SYSTEM',
  } = params;

  // Calculate proportional amounts using Decimal for exact precision
  const refundAmountDec = toDecimal(refundAmount);
  const percentDec = toDecimal(refundPercentage);
  
  const refundedPlatformFeeDec = roundAmount(
    calculatePercentage(toDecimal(originalPlatformFee), percentDec),
    2
  );
  const refundedInstructorPayoutDec = roundAmount(
    calculatePercentage(toDecimal(originalInstructorPayout), percentDec),
    2
  );

  // Validate - using Decimal for exact comparison
  const sumDec = addAmounts(refundedPlatformFeeDec, refundedInstructorPayoutDec);
  if (!isEqual(refundAmountDec, sumDec)) {
    const refundNum = toNumber(refundAmountDec);
    const feeNum = toNumber(refundedPlatformFeeDec);
    const payoutNum = toNumber(refundedInstructorPayoutDec);
    throw new Error(
      `Refund amount mismatch: ${refundNum} ≠ ${feeNum} + ${payoutNum}`
    );
  }

  // Convert to numbers for ledger
  const refundNum = toNumber(refundAmountDec);
  const feeNum = toNumber(refundedPlatformFeeDec);
  const payoutNum = toNumber(refundedInstructorPayoutDec);

  const entries: LedgerEntry[] = [
    // Entry 1: Reverse partial instructor payout
    {
      debitAccount: buildAccount(AccountType.INSTRUCTOR_PAYABLE, providerId),
      creditAccount: buildAccount(AccountType.PLATFORM_ESCROW),
      amount: payoutNum,
      description: `Partial refund (${refundPercentage}%): Instructor payout reversal`,
      idempotencyKey: `refund-${refundId}-instructor`,
      bookingId,
      userId,
      providerId,
      createdBy,
      metadata: { type: 'partial_refund_instructor', reason, percentage: refundPercentage },
    },

    // Entry 2: Reverse partial commission
    {
      debitAccount: buildAccount(AccountType.PLATFORM_REVENUE),
      creditAccount: buildAccount(AccountType.PLATFORM_ESCROW),
      amount: feeNum,
      description: `Partial refund (${refundPercentage}%): Commission reversal`,
      idempotencyKey: `refund-${refundId}-commission`,
      bookingId,
      userId,
      providerId,
      createdBy,
      metadata: { type: 'partial_refund_commission', reason, percentage: refundPercentage },
    },

    // Entry 3: Partial refund to client
    {
      debitAccount: buildAccount(AccountType.PLATFORM_ESCROW),
      creditAccount: buildAccount(AccountType.CLIENT_WALLET, userId),
      amount: refundNum,
      description: `Partial refund (${refundPercentage}%) for booking #${bookingId}`,
      idempotencyKey: `refund-${refundId}-client`,
      bookingId,
      userId,
      providerId,
      createdBy,
      metadata: { type: 'partial_refund_client', reason, percentage: refundPercentage },
    },
  ];

  return createLedgerEntries(entries);
}

// ============================================
// WALLET OPERATIONS
// ============================================

/**
 * Record wallet credit (Stripe payment)
 * 
 * Flow:
 * Stripe clearing → Client wallet
 */
export async function recordWalletCredit(params: {
  walletTransactionId: string;
  userId: string;
  amount: number | Decimal;
  stripePaymentIntentId?: string;
  createdBy?: string;
  txClient?: Prisma.TransactionClient;
}) {
  const { walletTransactionId, userId, amount, stripePaymentIntentId, createdBy = 'SYSTEM', txClient } =
    params;

  const entry: LedgerEntry = {
    debitAccount: buildAccount(AccountType.STRIPE_CLEARING),
    creditAccount: buildAccount(AccountType.CLIENT_WALLET, userId),
    amount: toNumber(toDecimal(amount)),
    description: `Wallet credit added via Stripe`,
    idempotencyKey: stripePaymentIntentId
      ? `wallet-credit-${stripePaymentIntentId}`
      : `wallet-credit-${walletTransactionId}`,
    userId,
    transactionId: walletTransactionId,
    createdBy,
    metadata: {
      type: 'wallet_credit',
      stripePaymentIntentId,
      paymentMethod: 'card',
    },
  };

  return createLedgerEntries([entry], txClient);
}

/**
 * Record admin wallet adjustment (manual credit/debit)
 * 
 * Flow:
 * Platform revenue → Client wallet (credit)
 * OR
 * Client wallet → Platform revenue (debit)
 */
export async function recordAdminWalletAdjustment(params: {
  adjustmentId: string;
  userId: string;
  amount: number | Decimal;
  isCredit: boolean;
  reason: string;
  adminId: string;
  approvedBy?: string;
}) {
  const { adjustmentId, userId, amount, isCredit, reason, adminId, approvedBy } = params;

  const amountNum = toNumber(toDecimal(amount));

  const entry: LedgerEntry = isCredit
    ? {
        // Credit: Platform pays
        debitAccount: buildAccount(AccountType.PLATFORM_REVENUE),
        creditAccount: buildAccount(AccountType.CLIENT_WALLET, userId),
        amount: amountNum,
        description: `Admin adjustment: ${reason}`,
        idempotencyKey: `adjustment-${adjustmentId}`,
        userId,
        createdBy: adminId,
        metadata: {
          type: 'admin_credit',
          reason,
          approvedBy,
          adjustedAt: new Date().toISOString(),
        },
      }
    : {
        // Debit: Platform receives
        debitAccount: buildAccount(AccountType.CLIENT_WALLET, userId),
        creditAccount: buildAccount(AccountType.PLATFORM_REVENUE),
        amount: amountNum,
        description: `Admin adjustment: ${reason}`,
        idempotencyKey: `adjustment-${adjustmentId}`,
        userId,
        createdBy: adminId,
        metadata: {
          type: 'admin_debit',
          reason,
          approvedBy,
          adjustedAt: new Date().toISOString(),
        },
      };

  return createLedgerEntries([entry]);
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Validate booking amounts before recording
 */
export function validateBookingAmounts(
  totalAmount: number | Decimal,
  platformFee: number | Decimal,
  providerPayout: number | Decimal
): { valid: boolean; error?: string } {
  // Use Decimal for exact validation
  const totalDec = toDecimal(totalAmount);
  const feeDec = toDecimal(platformFee);
  const payoutDec = toDecimal(providerPayout);
  const sumDec = addAmounts(feeDec, payoutDec);

  if (!isEqual(totalDec, sumDec)) {
    const totalNum = toNumber(totalDec);
    const feeNum = toNumber(feeDec);
    const payoutNum = toNumber(payoutDec);
    const difference = toNumber(subtractAmounts(totalDec, sumDec));
    return {
      valid: false,
      error: `Amount mismatch: ${totalNum} ≠ ${feeNum} + ${payoutNum} (diff: ${Math.abs(difference)})`,
    };
  }

  if (toNumber(totalDec) <= 0 || toNumber(feeDec) < 0 || toNumber(payoutDec) < 0) {
    return {
      valid: false,
      error: 'All amounts must be positive',
    };
  }

  return { valid: true };
}

/**
 * Calculate refund amounts based on percentage
 */
export function calculateRefundAmounts(
  originalTotal: number | Decimal,
  originalPlatformFee: number | Decimal,
  originalInstructorPayout: number | Decimal,
  refundPercentage: number
): {
  refundAmount: number;
  refundedPlatformFee: number;
  refundedInstructorPayout: number;
} {
  // Use Decimal for exact percentage calculations
  const percentDec = toDecimal(refundPercentage);
  
  const refundAmountDec = roundAmount(
    calculatePercentage(toDecimal(originalTotal), percentDec),
    2
  );
  const refundedPlatformFeeDec = roundAmount(
    calculatePercentage(toDecimal(originalPlatformFee), percentDec),
    2
  );
  const refundedInstructorPayoutDec = roundAmount(
    calculatePercentage(toDecimal(originalInstructorPayout), percentDec),
    2
  );

  return {
    refundAmount: toNumber(refundAmountDec),
    refundedPlatformFee: toNumber(refundedPlatformFeeDec),
    refundedInstructorPayout: toNumber(refundedInstructorPayoutDec),
  };
}