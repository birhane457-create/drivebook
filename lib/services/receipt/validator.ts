/**
 * Context Validator - Input Validation for Receipt Generation
 * 
 * This module provides validation logic for Tax Document Context to ensure
 * all required fields are present and valid before processing. The validator
 * checks required fields, enum values, structural constraints, and conditional
 * requirements based on document type.
 * 
 * @module lib/services/receipt/validator
 */

import {
  TaxDocumentContext,
  ValidationResult,
  DocumentType,
  BusinessModel,
  PaymentMode,
  LineItemType,
  SupplierType,
} from './types';

/**
 * Validates Tax Document Context before processing.
 * 
 * Performs comprehensive validation including:
 * - Required field presence
 * - Enum value validity
 * - Conditional requirements (e.g., RCTI requires provider)
 * - Line item structure validation
 * 
 * Validation failures return descriptive error messages to aid debugging.
 */
export class ContextValidator {
  /**
   * Validate a Tax Document Context.
   * 
   * @param context - The context to validate
   * @returns ValidationResult with valid flag and error messages
   * 
   * @example
   * ```typescript
   * const validator = new ContextValidator();
   * const result = validator.validate(context);
   * if (!result.valid) {
   *   console.error('Validation failed:', result.errors);
   * }
   * ```
   */
  validate(context: TaxDocumentContext): ValidationResult {
    const errors: string[] = [];

    // -------------------------------------------------------------------------
    // Required Fields Validation (Requirement 18.1)
    // -------------------------------------------------------------------------
    
    if (!context.documentType) {
      errors.push('documentType is required');
    }
    
    if (!context.receiptId) {
      errors.push('receiptId is required');
    }
    
    if (!context.issuedDate) {
      errors.push('issuedDate is required');
    }
    
    // Customer validation (Requirement 18.5)
    if (!context.customer) {
      errors.push('customer is required');
    } else {
      if (!context.customer.name) {
        errors.push('customer.name is required');
      }
      if (!context.customer.email) {
        errors.push('customer.email is required');
      }
    }
    
    // Items validation (Requirement 18.3)
    if (!context.items || !Array.isArray(context.items)) {
      errors.push('items array is required');
    } else if (context.items.length === 0) {
      errors.push('At least one line item is required');
    }
    
    // Payment validation
    if (!context.payment) {
      errors.push('payment is required');
    } else {
      if (typeof context.payment.total !== 'number') {
        errors.push('payment.total must be a number');
      }
    }

    // -------------------------------------------------------------------------
    // Enum Validation (Requirements 1.2, 1.3, 1.4)
    // -------------------------------------------------------------------------
    
    if (context.documentType && !Object.values(DocumentType).includes(context.documentType)) {
      errors.push(`Invalid documentType: ${context.documentType}. Must be one of: ${Object.values(DocumentType).join(', ')}`);
    }
    
    if (context.businessModel && !Object.values(BusinessModel).includes(context.businessModel)) {
      errors.push(`Invalid businessModel: ${context.businessModel}. Must be one of: ${Object.values(BusinessModel).join(', ')}`);
    }
    
    if (context.paymentMode && !Object.values(PaymentMode).includes(context.paymentMode)) {
      errors.push(`Invalid paymentMode: ${context.paymentMode}. Must be one of: ${Object.values(PaymentMode).join(', ')}`);
    }

    // -------------------------------------------------------------------------
    // Conditional Validation (Requirement 18.2)
    // -------------------------------------------------------------------------
    
    // Provider required for tax invoices
    if (context.documentType) {
      const requiresProvider = [DocumentType.RCTI, DocumentType.TAX_INVOICE].includes(
        context.documentType
      );
      
      if (requiresProvider && !context.provider) {
        errors.push('Provider details required for tax invoices (TAX_INVOICE and RCTI)');
      }
    }
    
    // Provider completeness validation (Requirement 1.5)
    if (context.provider) {
      if (!context.provider.name) {
        errors.push('provider.name is required when provider is specified');
      }
      if (!context.provider.abn) {
        errors.push('provider.abn is required when provider is specified');
      }
      if (typeof context.provider.abnVerified !== 'boolean') {
        errors.push('provider.abnVerified must be a boolean when provider is specified');
      }
      if (typeof context.provider.gstRegistered !== 'boolean') {
        errors.push('provider.gstRegistered must be a boolean when provider is specified');
      }
    }

    // -------------------------------------------------------------------------
    // Line Item Validation (Requirement 18.4)
    // -------------------------------------------------------------------------
    
    if (context.items && Array.isArray(context.items)) {
      context.items.forEach((item, index) => {
        // Description required
        if (!item.description) {
          errors.push(`Item ${index}: description is required`);
        }
        
        // Type validation
        if (!item.type) {
          errors.push(`Item ${index}: type is required`);
        } else if (!Object.values(LineItemType).includes(item.type)) {
          errors.push(`Item ${index}: invalid type "${item.type}". Must be one of: ${Object.values(LineItemType).join(', ')}`);
        }
        
        // Amount validation
        if (typeof item.amount !== 'number') {
          errors.push(`Item ${index}: amount must be a number`);
        } else if (isNaN(item.amount)) {
          errors.push(`Item ${index}: amount must be a valid number`);
        }
        
        // Supplier validation (if provided)
        if (item.supplier && !Object.values(SupplierType).includes(item.supplier)) {
          errors.push(`Item ${index}: invalid supplier "${item.supplier}". Must be one of: ${Object.values(SupplierType).join(', ')}`);
        }
        
        // Quantity and rate consistency
        if (item.quantity !== undefined && typeof item.quantity !== 'number') {
          errors.push(`Item ${index}: quantity must be a number when provided`);
        }
        
        if (item.rate !== undefined && typeof item.rate !== 'number') {
          errors.push(`Item ${index}: rate must be a number when provided`);
        }
      });
    }

    // -------------------------------------------------------------------------
    // Return Validation Result
    // -------------------------------------------------------------------------
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
