/**
 * Legacy Receipt Adapters - Gradual Migration Layer
 * 
 * This module provides adapter functions that wrap the new unified receipt service
 * with legacy function signatures. This enables gradual migration from old receipt
 * generation code to the new tax-compliant system without breaking existing call sites.
 * 
 * @module lib/services/receipt/legacy-adapters
 */

import { ReceiptService } from './receipt-service';
import * as factories from './context-factories';

/**
 * Legacy Receipt Adapters - Wraps new receipt service with legacy signatures.
 * 
 * Each adapter method matches the signature of a legacy receipt function,
 * transforms parameters to TaxDocumentContext, and delegates to ReceiptService.
 */
export class LegacyReceiptAdapters {
  constructor(private receiptService: ReceiptService) {}

  /**
   * Legacy adapter for package purchase receipts.
   * Wraps createPackagePurchaseContext + generateAndSend.
   * 
   * Requirement 26.2
   */
  async sendPackagePurchaseReceipt(params: Parameters<typeof factories.createPackagePurchaseContext>[0]): Promise<void> {
    const context = factories.createPackagePurchaseContext(params);
    await this.receiptService.generateAndSend(context);
  }

  /**
   * Legacy adapter for wallet lesson booking receipts.
   * Wraps createWalletLessonContext + generateAndSend.
   * 
   * Requirement 26.3
   */
  async sendWalletLessonReceipt(params: Parameters<typeof factories.createWalletLessonContext>[0]): Promise<void> {
    const context = factories.createWalletLessonContext(params);
    await this.receiptService.generateAndSend(context);
  }

  /**
   * Legacy adapter for single lesson purchase receipts.
   * Wraps createSingleLessonContext + generateAndSend.
   * 
   * Requirement 26.4
   */
  async sendSingleLessonReceipt(params: Parameters<typeof factories.createSingleLessonContext>[0]): Promise<void> {
    const context = factories.createSingleLessonContext(params);
    await this.receiptService.generateAndSend(context);
  }

  /**
   * Legacy adapter for wallet top-up receipts.
   * Wraps createWalletTopUpContext + generateAndSend.
   * 
   * Requirement 26.5
   */
  async sendWalletTopUpReceipt(params: Parameters<typeof factories.createWalletTopUpContext>[0]): Promise<void> {
    const context = factories.createWalletTopUpContext(params);
    await this.receiptService.generateAndSend(context);
  }

  /**
   * Legacy adapter for cancellation receipts.
   * Wraps createCancellationContext + generateAndSend.
   * 
   * Requirement 26.6
   */
  async sendCancellationReceipt(params: Parameters<typeof factories.createCancellationContext>[0]): Promise<void> {
    const context = factories.createCancellationContext(params);
    await this.receiptService.generateAndSend(context);
  }

  /**
   * Legacy adapter for admin credit receipts.
   * Wraps createAdminCreditContext + generateAndSend.
   * 
   * Requirement 26.7
   */
  async sendAdminCreditReceipt(params: Parameters<typeof factories.createAdminCreditContext>[0]): Promise<void> {
    const context = factories.createAdminCreditContext(params);
    await this.receiptService.generateAndSend(context);
  }

  /**
   * Legacy adapter for admin deduction receipts.
   * Wraps createAdminDeductionContext + generateAndSend.
   * 
   * Requirement 26.8
   */
  async sendAdminDeductionReceipt(params: Parameters<typeof factories.createAdminDeductionContext>[0]): Promise<void> {
    const context = factories.createAdminDeductionContext(params);
    await this.receiptService.generateAndSend(context);
  }
}
