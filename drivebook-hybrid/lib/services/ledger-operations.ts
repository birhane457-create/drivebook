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
} from './ledger';

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
  instructorId: string;
  totalAmount: number;
  platformFee: number;
  instructorPayout: number;
  transactionId?: string;
  createdBy?: string;
}) {
  const {
    bookingId,
    userId,
    instructorId,
    totalAmount,
    platformFee,
    instructorPayout,
    transactionId,
    createdBy = 'SYSTEM',
  } = params;

  // Validate amounts
  if (Math.abs(totalAmount - (platformFee + instructorPayout)) > 0.01) {
    throw new Error(
      `Amount mismatch: ${totalAmount} ≠ ${platformFee} + ${instructorPayout}`
    );
  }

  const entries: LedgerEntry[] = [
    // Entry 1: Client pays into escrow
    {
      debitAccount: buildAccount(AccountType.CLIENT_WALLET, userId),
      creditAccount: buildAccount(AccountType.PLATFORM_ESCROW),
      amount: totalAmount,
      description: `Payment for booking #${bookingId}`,
      idempotencyKey: `booking-${bookingId}-payment`,
      bookingId,
      userId,
      instructorId,
      transactionId,
      createdBy,
      metadata: { type: 'booking_payment', totalAmount },
    },

    // Entry 2: Platform takes commission
    {
      debitAccount: buildAccount(AccountType.PLATFORM_ESCROW),
      creditAccount: buildAccount(AccountType.PLATFORM_REVENUE),
      amount: platformFee,
      description: `Platform commission for booking #${bookingId}`,
      idempotencyKey: `booking-${bookingId}-commission`,
      bookingId,
      userId,
      instructorId,
      transactionId,
      createdBy,
      metadata: { type: 'commission', rate: (platformFee / totalAmount) * 100 },
    },

    // Entry 3: Instructor earns payout
    {
      debitAccount: buildAccount(AccountType.PLATFORM_ESCROW),
      creditAccount: buildAccount(AccountType.INSTRUCTOR_PAYABLE, instructorId),
      amount: instructorPayout,
      description: `Instructor payout for booking #${bookingId}`,
      idempotencyKey: `booking-${bookingId}-instructor-payout`,
      bookingId,
      userId,
      instructorId,
      transactionId,
      createdBy,
      metadata: { type: 'instructor_payout', instructorPayout },
    },
  ];

  return createLedgerEntries(entries);
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
  instructorId: string;
  amount: number;
  stripePayoutId?: string;
  processedBy: string;
}) {
  const { payoutId, instructorId, amount, stripePayoutId, processedBy } = params;

  const entry: LedgerEntry = {
    debitAccount: buildAccount(AccountType.INSTRUCTOR_PAYABLE, instructorId),
    creditAccount: buildAccount(AccountType.INSTRUCTOR_PAID, instructorId),
    amount,
    description: `Payout processed via Stripe`,
    idempotencyKey: stripePayoutId
      ? `payout-${payoutId}-stripe-${stripePayoutId}`
      : `payout-${payoutId}`,
    payoutId,
    instructorId,
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
  instructorId: string;
  totalAmount: number;
  platformFee: number;
  instructorPayout: number;
  reason?: string;
  createdBy?: string;
}) {
  const {
    refundId,
    bookingId,
    userId,
    instructorId,
    totalAmount,
    platformFee,
    instructorPayout,
    reason,
    createdBy = 'SYSTEM',
  } = params;

  const entries: LedgerEntry[] = [
    // Entry 1: Reverse instructor payout
    {
      debitAccount: buildAccount(AccountType.INSTRUCTOR_PAYABLE, instructorId),
      creditAccount: buildAccount(AccountType.PLATFORM_ESCROW),
      amount: instructorPayout,
      description: `Refund: Reverse instructor payout for booking #${bookingId}`,
      idempotencyKey: `refund-${refundId}-instructor`,
      bookingId,
      userId,
      instructorId,
      createdBy,
      metadata: { type: 'refund_instructor', reason, percentage: 100 },
    },

    // Entry 2: Reverse platform commission
    {
      debitAccount: buildAccount(AccountType.PLATFORM_REVENUE),
      creditAccount: buildAccount(AccountType.PLATFORM_ESCROW),
      amount: platformFee,
      description: `Refund: Reverse commission for booking #${bookingId}`,
      idempotencyKey: `refund-${refundId}-commission`,
      bookingId,
      userId,
      instructorId,
      createdBy,
      metadata: { type: 'refund_commission', reason, percentage: 100 },
    },

    // Entry 3: Refund to client
    {
      debitAccount: buildAccount(AccountType.PLATFORM_ESCROW),
      creditAccount: buildAccount(AccountType.CLIENT_WALLET, userId),
      amount: totalAmount,
      description: `Refund for cancelled booking #${bookingId}`,
      idempotencyKey: `refund-${refundId}-client`,
      bookingId,
      userId,
      instructorId,
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
  instructorId: string;
  refundAmount: number;
  refundPercentage: number;
  originalPlatformFee: number;
  originalInstructorPayout: number;
  reason?: string;
  createdBy?: string;
}) {
  const {
    refundId,
    bookingId,
    userId,
    instructorId,
    refundAmount,
    refundPercentage,
    originalPlatformFee,
    originalInstructorPayout,
    reason,
    createdBy = 'SYSTEM',
  } = params;

  // Calculate proportional amounts
  const refundedPlatformFee = (originalPlatformFee * refundPercentage) / 100;
  const refundedInstructorPayout = (originalInstructorPayout * refundPercentage) / 100;

  // Validate
  if (Math.abs(refundAmount - (refundedPlatformFee + refundedInstructorPayout)) > 0.01) {
    throw new Error(
      `Refund amount mismatch: ${refundAmount} ≠ ${refundedPlatformFee} + ${refundedInstructorPayout}`
    );
  }

  const entries: LedgerEntry[] = [
    // Entry 1: Reverse partial instructor payout
    {
      debitAccount: buildAccount(AccountType.INSTRUCTOR_PAYABLE, instructorId),
      creditAccount: buildAccount(AccountType.PLATFORM_ESCROW),
      amount: refundedInstructorPayout,
      description: `Partial refund (${refundPercentage}%): Instructor payout reversal`,
      idempotencyKey: `refund-${refundId}-instructor`,
      bookingId,
      userId,
      instructorId,
      createdBy,
      metadata: { type: 'partial_refund_instructor', reason, percentage: refundPercentage },
    },

    // Entry 2: Reverse partial commission
    {
      debitAccount: buildAccount(AccountType.PLATFORM_REVENUE),
      creditAccount: buildAccount(AccountType.PLATFORM_ESCROW),
      amount: refundedPlatformFee,
      description: `Partial refund (${refundPercentage}%): Commission reversal`,
      idempotencyKey: `refund-${refundId}-commission`,
      bookingId,
      userId,
      instructorId,
      createdBy,
      metadata: { type: 'partial_refund_commission', reason, percentage: refundPercentage },
    },

    // Entry 3: Partial refund to client
    {
      debitAccount: buildAccount(AccountType.PLATFORM_ESCROW),
      creditAccount: buildAccount(AccountType.CLIENT_WALLET, userId),
      amount: refundAmount,
      description: `Partial refund (${refundPercentage}%) for booking #${bookingId}`,
      idempotencyKey: `refund-${refundId}-client`,
      bookingId,
      userId,
      instructorId,
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
  amount: number;
  stripePaymentIntentId?: string;
  createdBy?: string;
}) {
  const { walletTransactionId, userId, amount, stripePaymentIntentId, createdBy = 'SYSTEM' } =
    params;

  const entry: LedgerEntry = {
    debitAccount: buildAccount(AccountType.STRIPE_CLEARING),
    creditAccount: buildAccount(AccountType.CLIENT_WALLET, userId),
    amount,
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

  return createLedgerEntries([entry]);
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
  amount: number;
  isCredit: boolean;
  reason: string;
  adminId: string;
  approvedBy?: string;
}) {
  const { adjustmentId, userId, amount, isCredit, reason, adminId, approvedBy } = params;

  const entry: LedgerEntry = isCredit
    ? {
        // Credit: Platform pays
        debitAccount: buildAccount(AccountType.PLATFORM_REVENUE),
        creditAccount: buildAccount(AccountType.CLIENT_WALLET, userId),
        amount,
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
        amount,
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
  totalAmount: number,
  platformFee: number,
  instructorPayout: number
): { valid: boolean; error?: string } {
  const sum = platformFee + instructorPayout;
  const difference = Math.abs(totalAmount - sum);

  if (difference > 0.01) {
    return {
      valid: false,
      error: `Amount mismatch: ${totalAmount} ≠ ${platformFee} + ${instructorPayout} (diff: ${difference})`,
    };
  }

  if (totalAmount <= 0 || platformFee < 0 || instructorPayout < 0) {
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
  originalTotal: number,
  originalPlatformFee: number,
  originalInstructorPayout: number,
  refundPercentage: number
): {
  refundAmount: number;
  refundedPlatformFee: number;
  refundedInstructorPayout: number;
} {
  const refundAmount = (originalTotal * refundPercentage) / 100;
  const refundedPlatformFee = (originalPlatformFee * refundPercentage) / 100;
  const refundedInstructorPayout = (originalInstructorPayout * refundPercentage) / 100;

  return {
    refundAmount: Math.round(refundAmount * 100) / 100,
    refundedPlatformFee: Math.round(refundedPlatformFee * 100) / 100,
    refundedInstructorPayout: Math.round(refundedInstructorPayout * 100) / 100,
  };
}
