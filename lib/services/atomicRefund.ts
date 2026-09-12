/**
 * DEPRECATED: Atomic Refund Service
 * 
 * This service is deprecated and non-functional.
 * 
 * Refunds are now handled by:
 * - recordFullRefund() in lib/services/ledger-operations.ts
 * - Admin refund route: app/api/admin/transactions/[transactionId]/refund/route.ts
 * 
 * Do NOT import or use the functions below.
 * Kept only for type compatibility if needed during migration.
 */

export interface AtomicRefundRequest {
  bookingId: string;
  refundAmount: number;
  refundPercentage: number;
  reason: string;
  staffId: string;
  taskId?: string;
  forceRefund?: boolean;
}

export interface AtomicRefundResult {
  success: boolean;
  refundId?: string;
  stripeRefundId?: string;
  amount: number;
  actualStripeFee: number;
  ledgerEntryId?: string;
  pendingLedgerId?: string;
  stripeStatus?: string;
  error?: string;
  rollbackPerformed?: boolean;
}

/**
 * @deprecated Use recordFullRefund() from ledger-operations.ts instead
 */
export async function processAtomicRefund(
  request: AtomicRefundRequest
): Promise<AtomicRefundResult> {
  throw new Error(
    'processAtomicRefund is deprecated. Use recordFullRefund() from lib/services/ledger-operations.ts instead.'
  );
}

/**
 * @deprecated Use recordFullRefund() from ledger-operations.ts instead
 */
export async function recoverPartialRefund(stripeRefundId: string, staffId: string) {
  throw new Error(
    'recoverPartialRefund is deprecated. Use recordFullRefund() from lib/services/ledger-operations.ts instead.'
  );
}