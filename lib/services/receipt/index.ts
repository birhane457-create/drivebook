/**
 * Unified Receipt Generation System - Main Module Exports
 * 
 * This barrel export file provides a single entry point for the unified receipt
 * generation system. It exports all types, classes, factory functions, and
 * singleton instances.
 * 
 * @module lib/services/receipt
 */

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type {
  // Core types
  TaxDocumentContext,
  EnrichedDocument,
  EnrichedLineItem,
  DocumentSection,
  
  // Component types
  Customer,
  Provider,
  LineItem,
  PaymentDetails,
  BookingContext,
  WalletContext,
  CancellationContext,
  
  // Validation types
  ValidationResult
} from './types';

export {
  // Enums
  DocumentType,
  BusinessModel,
  PaymentMode,
  LineItemType,
  SupplierType,
  
  // Errors
  ValidationError
} from './types';

// ============================================================================
// CLASS EXPORTS
// ============================================================================

export { ContextValidator } from './validator';
export { TaxDocumentBuilder } from './builder';
export { ReceiptTemplateEngine } from './template-engine';
export { ReceiptService } from './receipt-service';
export { LegacyReceiptAdapters } from './legacy-adapters';

// ============================================================================
// FACTORY FUNCTION EXPORTS
// ============================================================================

export {
  createPackagePurchaseContext,
  createWalletLessonContext,
  createSingleLessonContext,
  createWalletTopUpContext,
  createCancellationContext,
  createAdminCreditContext,
  createAdminDeductionContext
} from './context-factories';

// ============================================================================
// SINGLETON INSTANCES
// ============================================================================

import { ReceiptService } from './receipt-service';
import { LegacyReceiptAdapters } from './legacy-adapters';

/**
 * Singleton receipt service instance.
 * 
 * Use this instance throughout the application for generating and sending receipts.
 * 
 * @example
 * ```typescript
 * import { receiptService } from '@/lib/services/receipt';
 * 
 * const html = receiptService.generateHTML(context);
 * await receiptService.generateAndSend(context);
 * ```
 * 
 * Requirement 1.7
 */
export const receiptService = new ReceiptService();

/**
 * Singleton legacy adapters instance.
 * 
 * Use this instance for gradual migration from legacy receipt functions.
 * 
 * @example
 * ```typescript
 * import { legacyReceiptAdapters } from '@/lib/services/receipt';
 * 
 * await legacyReceiptAdapters.sendPackagePurchaseReceipt({
 *   transactionId: '...',
 *   customer: {...},
 *   // ...
 * });
 * ```
 * 
 * Requirement 26.1
 */
export const legacyReceiptAdapters = new LegacyReceiptAdapters(receiptService);
