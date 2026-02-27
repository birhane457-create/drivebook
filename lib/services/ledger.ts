/**
 * FINANCIAL LEDGER SERVICE - Double-Entry Accounting
 * 
 * CRITICAL RULES:
 * 1. APPEND-ONLY: No updates, no deletes
 * 2. IDEMPOTENCY: Every entry has unique key
 * 3. DOUBLE-ENTRY: Every debit has a credit
 * 4. IMMUTABLE: Once written, never changed
 * 
 * Account Types:
 * - CLIENT_WALLET:{userId} - Client prepaid balance
 * - PLATFORM_ESCROW:platform - Temporary holding
 * - PLATFORM_REVENUE:platform - Commission earnings
 * - INSTRUCTOR_PAYABLE:{instructorId} - What we owe
 * - INSTRUCTOR_PAID:{instructorId} - What we've paid
 * - STRIPE_CLEARING:platform - Stripe reconciliation
 */

import { prisma } from '../prisma';
import { Prisma } from '@prisma/client';

// ============================================
// ACCOUNT TYPES
// ============================================

export enum AccountType {
  CLIENT_WALLET = 'CLIENT_WALLET',
  PLATFORM_ESCROW = 'PLATFORM_ESCROW',
  PLATFORM_REVENUE = 'PLATFORM_REVENUE',
  INSTRUCTOR_PAYABLE = 'INSTRUCTOR_PAYABLE',
  INSTRUCTOR_PAID = 'INSTRUCTOR_PAID',
  STRIPE_CLEARING = 'STRIPE_CLEARING',
}

export enum ReferenceType {
  BOOKING = 'BOOKING',
  PAYOUT = 'PAYOUT',
  REFUND = 'REFUND',
  WALLET_CREDIT = 'WALLET_CREDIT',
  ADMIN_ADJUSTMENT = 'ADMIN_ADJUSTMENT',
  COMMISSION = 'COMMISSION',
}

// ============================================
// LEDGER ENTRY INTERFACE
// ============================================

export interface LedgerEntry {
  debitAccount: string;
  creditAccount: string;
  amount: number;
  description: string;
  idempotencyKey: string;
  referenceType?: string;
  referenceId?: string;
  bookingId?: string;
  transactionId?: string;
  payoutId?: string;
  userId?: string;
  instructorId?: string;
  metadata?: any;
  createdBy?: string;
}

// ============================================
// CORE LEDGER FUNCTIONS
// ============================================

/**
 * Create a single ledger entry (with idempotency)
 */
export async function createLedgerEntry(entry: LedgerEntry) {
  try {
    // Validate amount is positive
    if (entry.amount <= 0) {
      throw new Error(`Ledger amount must be positive: ${entry.amount}`);
    }

    // Create entry
    const ledgerEntry = await prisma.financialLedger.create({
      data: {
        debitAccount: entry.debitAccount,
        creditAccount: entry.creditAccount,
        amount: entry.amount,
        description: entry.description,
        idempotencyKey: entry.idempotencyKey,
        bookingId: entry.bookingId,
        transactionId: entry.transactionId,
        payoutId: entry.payoutId,
        userId: entry.userId,
        instructorId: entry.instructorId,
        metadata: entry.metadata || {},
        createdBy: entry.createdBy || 'SYSTEM',
      },
    });

    return { success: true, entry: ledgerEntry };
  } catch (error: any) {
    // Check for duplicate idempotency key
    if (error.code === 'P2002' && error.meta?.target?.includes('idempotencyKey')) {
      // Already processed - return existing entry
      const existing = await prisma.financialLedger.findUnique({
        where: { idempotencyKey: entry.idempotencyKey },
      });
      return { success: true, entry: existing, duplicate: true };
    }
    throw error;
  }
}

/**
 * Create multiple ledger entries atomically (transaction)
 */
export async function createLedgerEntries(entries: LedgerEntry[]) {
  try {
    const results = await prisma.$transaction(
      entries.map((entry) =>
        prisma.financialLedger.create({
          data: {
            debitAccount: entry.debitAccount,
            creditAccount: entry.creditAccount,
            amount: entry.amount,
            description: entry.description,
            idempotencyKey: entry.idempotencyKey,
            bookingId: entry.bookingId,
            transactionId: entry.transactionId,
            payoutId: entry.payoutId,
            userId: entry.userId,
            instructorId: entry.instructorId,
            metadata: entry.metadata || {},
            createdBy: entry.createdBy || 'SYSTEM',
          },
        })
      )
    );

    return { success: true, entries: results };
  } catch (error: any) {
    // Check for duplicate idempotency key
    if (error.code === 'P2002') {
      throw new Error(`Duplicate ledger entry detected: ${error.meta?.target}`);
    }
    throw error;
  }
}

// ============================================
// ACCOUNT HELPERS
// ============================================

/**
 * Build account identifier
 */
export function buildAccount(type: AccountType, entityId?: string): string {
  if (type === AccountType.PLATFORM_ESCROW || 
      type === AccountType.PLATFORM_REVENUE || 
      type === AccountType.STRIPE_CLEARING) {
    return `${type}:platform`;
  }
  
  if (!entityId) {
    throw new Error(`Account type ${type} requires entityId`);
  }
  
  return `${type}:${entityId}`;
}

/**
 * Calculate account balance
 */
export async function getAccountBalance(account: string): Promise<number> {
  const result = await prisma.financialLedger.aggregate({
    where: {
      OR: [
        { creditAccount: account },
        { debitAccount: account },
      ],
    },
    _sum: {
      amount: true,
    },
  });

  // Get credits
  const credits = await prisma.financialLedger.aggregate({
    where: { creditAccount: account },
    _sum: { amount: true },
  });

  // Get debits
  const debits = await prisma.financialLedger.aggregate({
    where: { debitAccount: account },
    _sum: { amount: true },
  });

  const creditTotal = credits._sum.amount || 0;
  const debitTotal = debits._sum.amount || 0;

  // Balance = Credits - Debits
  return creditTotal - debitTotal;
}

/**
 * Get all balances for an account type
 */
export async function getAccountBalances(accountType: AccountType): Promise<Map<string, number>> {
  const entries = await prisma.financialLedger.findMany({
    where: {
      OR: [
        { creditAccount: { startsWith: `${accountType}:` } },
        { debitAccount: { startsWith: `${accountType}:` } },
      ],
    },
    select: {
      creditAccount: true,
      debitAccount: true,
      amount: true,
    },
  });

  const balances = new Map<string, number>();

  for (const entry of entries) {
    // Add to credit account
    if (entry.creditAccount.startsWith(`${accountType}:`)) {
      const current = balances.get(entry.creditAccount) || 0;
      balances.set(entry.creditAccount, current + entry.amount);
    }

    // Subtract from debit account
    if (entry.debitAccount.startsWith(`${accountType}:`)) {
      const current = balances.get(entry.debitAccount) || 0;
      balances.set(entry.debitAccount, current - entry.amount);
    }
  }

  return balances;
}

// ============================================
// BALANCE QUERIES
// ============================================

/**
 * Get client wallet balance
 */
export async function getClientWalletBalance(userId: string): Promise<number> {
  const account = buildAccount(AccountType.CLIENT_WALLET, userId);
  return getAccountBalance(account);
}

/**
 * Get instructor payable balance (what we owe)
 */
export async function getInstructorPayable(instructorId: string): Promise<number> {
  const account = buildAccount(AccountType.INSTRUCTOR_PAYABLE, instructorId);
  return getAccountBalance(account);
}

/**
 * Get instructor paid balance (what we've paid)
 */
export async function getInstructorPaid(instructorId: string): Promise<number> {
  const account = buildAccount(AccountType.INSTRUCTOR_PAID, instructorId);
  return getAccountBalance(account);
}

/**
 * Get platform revenue balance
 */
export async function getPlatformRevenue(): Promise<number> {
  const account = buildAccount(AccountType.PLATFORM_REVENUE);
  return getAccountBalance(account);
}

/**
 * Get platform escrow balance (should be ~0)
 */
export async function getPlatformEscrow(): Promise<number> {
  const account = buildAccount(AccountType.PLATFORM_ESCROW);
  return getAccountBalance(account);
}

// ============================================
// AUDIT & HISTORY
// ============================================

/**
 * Get ledger entries for an account
 */
export async function getAccountLedger(
  account: string,
  options?: {
    limit?: number;
    startDate?: Date;
    endDate?: Date;
  }
) {
  return prisma.financialLedger.findMany({
    where: {
      OR: [
        { creditAccount: account },
        { debitAccount: account },
      ],
      ...(options?.startDate || options?.endDate
        ? {
            createdAt: {
              ...(options.startDate && { gte: options.startDate }),
              ...(options.endDate && { lte: options.endDate }),
            },
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: options?.limit || 100,
  });
}

/**
 * Get ledger entries for a booking
 */
export async function getBookingLedger(bookingId: string) {
  return prisma.financialLedger.findMany({
    where: { bookingId },
    orderBy: { createdAt: 'asc' },
  });
}

// ============================================
// RECONCILIATION
// ============================================

/**
 * Verify ledger integrity (debits = credits)
 */
export async function verifyLedgerIntegrity(): Promise<{
  valid: boolean;
  totalDebits: number;
  totalCredits: number;
  difference: number;
}> {
  const debits = await prisma.financialLedger.aggregate({
    _sum: { amount: true },
  });

  const credits = await prisma.financialLedger.aggregate({
    _sum: { amount: true },
  });

  const totalDebits = debits._sum.amount || 0;
  const totalCredits = credits._sum.amount || 0;
  const difference = Math.abs(totalDebits - totalCredits);

  return {
    valid: difference < 0.01, // Allow 1 cent rounding
    totalDebits,
    totalCredits,
    difference,
  };
}

/**
 * Get all instructor payables (for payout reconciliation)
 */
export async function getAllInstructorPayables(): Promise<
  Array<{ instructorId: string; payable: number; paid: number; balance: number }>
> {
  const payables = await getAccountBalances(AccountType.INSTRUCTOR_PAYABLE);
  const paid = await getAccountBalances(AccountType.INSTRUCTOR_PAID);

  const results: Array<{ instructorId: string; payable: number; paid: number; balance: number }> = [];

  // Combine payables and paid
  const allInstructors = new Set([
    ...Array.from(payables.keys()).map((k) => k.split(':')[1]),
    ...Array.from(paid.keys()).map((k) => k.split(':')[1]),
  ]);

  for (const instructorId of allInstructors) {
    const payableAccount = buildAccount(AccountType.INSTRUCTOR_PAYABLE, instructorId);
    const paidAccount = buildAccount(AccountType.INSTRUCTOR_PAID, instructorId);

    const payableBalance = payables.get(payableAccount) || 0;
    const paidBalance = paid.get(paidAccount) || 0;

    results.push({
      instructorId,
      payable: payableBalance,
      paid: paidBalance,
      balance: payableBalance - paidBalance,
    });
  }

  return results.filter((r) => r.balance > 0.01); // Only show positive balances
}

/**
 * Get platform financial summary
 */
export async function getPlatformFinancialSummary() {
  const [revenue, escrow, totalPayables, totalPaid] = await Promise.all([
    getPlatformRevenue(),
    getPlatformEscrow(),
    getAccountBalances(AccountType.INSTRUCTOR_PAYABLE),
    getAccountBalances(AccountType.INSTRUCTOR_PAID),
  ]);

  const payableTotal = Array.from(totalPayables.values()).reduce((sum, val) => sum + val, 0);
  const paidTotal = Array.from(totalPaid.values()).reduce((sum, val) => sum + val, 0);

  return {
    revenue,
    escrow,
    instructorPayables: payableTotal,
    instructorPaid: paidTotal,
    outstandingPayables: payableTotal - paidTotal,
  };
}
