// TEMPORARILY DISABLED FOR BUILD - Complex financial service with Prisma schema mismatches
// This service handles atomic refunds and needs schema updates to work properly

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

export async function processAtomicRefund(
  request: AtomicRefundRequest
): Promise<AtomicRefundResult> {
  throw new Error('Atomic refund service temporarily disabled - needs schema updates');
}

export async function recoverPartialRefund(stripeRefundId: string, staffId: string) {
  throw new Error('Atomic refund service temporarily disabled - needs schema updates');
}