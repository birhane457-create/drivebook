/**
 * Receipt Integration Bridge
 * Feature-flag based adapter for safe dev testing of new receipt system
 */

import { 
  createWalletTopUpContext,
  receiptService 
} from './receipt/index';

import {
  sendWalletTopUpReceipt as legacySendWalletTopUpReceipt,
  sendPackagePurchaseReceipt,
  sendSingleLessonReceipt,
  sendWalletLessonReceipt,
  sendCancellationReceipt,
  sendAdminCreditReceipt,
  sendAdminDeductionReceipt,
} from './receipt-email';

const USE_NEW_RECEIPTS = process.env.USE_NEW_RECEIPTS === 'true';

console.log(`[Receipt Bridge] Using ${USE_NEW_RECEIPTS ? 'NEW' : 'LEGACY'} receipt system`);

export async function sendWalletTopUpReceipt(data: {
  customerName: string;
  customerEmail: string;
  receiptId: string;
  paidAt: Date;
  amountAdded: number;
  walletBalanceBefore: number;
  walletBalanceAfter: number;
  hourlyRate?: number;
  stripeRef?: string;
  paymentMethod?: string;
}) {
  if (!USE_NEW_RECEIPTS) {
    return legacySendWalletTopUpReceipt(data);
  }

  const context = createWalletTopUpContext({
    transactionId: data.receiptId,
    customer: { name: data.customerName, email: data.customerEmail },
    payment: {
      total: data.amountAdded,
      method: data.paymentMethod || 'Card',
      stripePaymentIntentId: data.stripeRef,
    },
    topUpAmount: data.amountAdded,
    walletPreviousBalance: data.walletBalanceBefore,
    walletNewBalance: data.walletBalanceAfter,
  });

  return receiptService.generateAndSend(context);
}

export { sendPackagePurchaseReceipt, sendSingleLessonReceipt, sendWalletLessonReceipt, sendCancellationReceipt, sendAdminCreditReceipt, sendAdminDeductionReceipt };