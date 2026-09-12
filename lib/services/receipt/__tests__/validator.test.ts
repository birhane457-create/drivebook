/**
 * Context Validator Tests
 * 
 * Tests validation logic for Tax Document Context including:
 * - Required field validation
 * - Enum value validation
 * - Conditional requirements
 * - Line item structure validation
 */

import { describe, it, expect } from 'vitest';
import { ContextValidator } from '../validator';
import {
  TaxDocumentContext,
  DocumentType,
  BusinessModel,
  PaymentMode,
  LineItemType,
  SupplierType,
} from '../types';

describe('ContextValidator', () => {
  const validator = new ContextValidator();

  // Helper to create a valid minimal context
  const createValidContext = (): TaxDocumentContext => ({
    documentType: DocumentType.PAYMENT_RECEIPT,
    receiptId: 'test-123',
    issuedDate: new Date('2024-01-15'),
    businessModel: BusinessModel.MARKETPLACE,
    paymentMode: PaymentMode.PLATFORM,
    customer: {
      name: 'John Doe',
      email: 'john@example.com',
    },
    items: [
      {
        description: 'Test item',
        type: LineItemType.FVV,
        amount: 100,
        supplier: SupplierType.NONE,
        taxable: false,
      },
    ],
    payment: {
      total: 100,
    },
  });

  describe('Required Fields Validation', () => {
    it('should pass validation for a valid minimal context', () => {
      const context = createValidContext();
      const result = validator.validate(context);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when documentType is missing', () => {
      const context = createValidContext();
      delete (context as any).documentType;
      
      const result = validator.validate(context);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('documentType is required');
    });

    it('should fail when receiptId is missing', () => {
      const context = createValidContext();
      delete (context as any).receiptId;
      
      const result = validator.validate(context);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('receiptId is required');
    });

    it('should fail when issuedDate is missing', () => {
      const context = createValidContext();
      delete (context as any).issuedDate;
      
      const result = validator.validate(context);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('issuedDate is required');
    });

    it('should fail when customer is missing', () => {
      const context = createValidContext();
      delete (context as any).customer;
      
      const result = validator.validate(context);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('customer is required');
    });

    it('should fail when customer.name is missing', () => {
      const context = createValidContext();
      delete (context.customer as any).name;
      
      const result = validator.validate(context);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('customer.name is required');
    });

    it('should fail when customer.email is missing', () => {
      const context = createValidContext();
      delete (context.customer as any).email;
      
      const result = validator.validate(context);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('customer.email is required');
    });

    it('should fail when items array is missing', () => {
      const context = createValidContext();
      delete (context as any).items;
      
      const result = validator.validate(context);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('items array is required');
    });

    it('should fail when items array is empty', () => {
      const context = createValidContext();
      context.items = [];
      
      const result = validator.validate(context);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('At least one line item is required');
    });

    it('should fail when payment is missing', () => {
      const context = createValidContext();
      delete (context as any).payment;
      
      const result = validator.validate(context);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('payment is required');
    });

    it('should fail when payment.total is not a number', () => {
      const context = createValidContext();
      (context.payment as any).total = 'not a number';
      
      const result = validator.validate(context);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('payment.total must be a number');
    });
  });

  describe('Enum Validation', () => {
    it('should fail for invalid documentType', () => {
      const context = createValidContext();
      (context as any).documentType = 'INVALID_TYPE';
      
      const result = validator.validate(context);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid documentType'))).toBe(true);
    });

    it('should pass for all valid documentType values', () => {
      const documentTypes = [
        DocumentType.TAX_INVOICE,
        DocumentType.RCTI,
        DocumentType.PAYMENT_RECEIPT,
        DocumentType.MIXED_DOCUMENT,
        DocumentType.ADJUSTMENT_NOTE,
      ];

      documentTypes.forEach(docType => {
        const context = createValidContext();
        context.documentType = docType;
        
        // Add provider for TAX_INVOICE and RCTI
        if ([DocumentType.TAX_INVOICE, DocumentType.RCTI].includes(docType)) {
          context.provider = {
            id: 'provider-123',
            name: 'Test Provider',
            abn: '12345678901',
            abnVerified: true,
            gstRegistered: true,
          };
        }
        
        const result = validator.validate(context);
        expect(result.valid).toBe(true);
      });
    });

    it('should fail for invalid businessModel', () => {
      const context = createValidContext();
      (context as any).businessModel = 'INVALID_MODEL';
      
      const result = validator.validate(context);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid businessModel'))).toBe(true);
    });

    it('should pass for all valid businessModel values', () => {
      const businessModels = [BusinessModel.MARKETPLACE, BusinessModel.SAAS];

      businessModels.forEach(model => {
        const context = createValidContext();
        context.businessModel = model;
        
        const result = validator.validate(context);
        expect(result.valid).toBe(true);
      });
    });

    it('should fail for invalid paymentMode', () => {
      const context = createValidContext();
      (context as any).paymentMode = 'INVALID_MODE';
      
      const result = validator.validate(context);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid paymentMode'))).toBe(true);
    });

    it('should pass for PLATFORM paymentMode', () => {
      const context = createValidContext();
      context.paymentMode = PaymentMode.PLATFORM;
      
      const result = validator.validate(context);
      
      expect(result.valid).toBe(true);
    });

    it('should pass for DIRECT paymentMode', () => {
      const context = createValidContext();
      context.paymentMode = PaymentMode.DIRECT;
      
      const result = validator.validate(context);
      
      expect(result.valid).toBe(true);
    });
  });

  describe('Conditional Validation', () => {
    it('should require provider for TAX_INVOICE', () => {
      const context = createValidContext();
      context.documentType = DocumentType.TAX_INVOICE;
      
      const result = validator.validate(context);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Provider details required for tax invoices (TAX_INVOICE and RCTI)');
    });

    it('should require provider for RCTI', () => {
      const context = createValidContext();
      context.documentType = DocumentType.RCTI;
      
      const result = validator.validate(context);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Provider details required for tax invoices (TAX_INVOICE and RCTI)');
    });

    it('should not require provider for PAYMENT_RECEIPT', () => {
      const context = createValidContext();
      context.documentType = DocumentType.PAYMENT_RECEIPT;
      
      const result = validator.validate(context);
      
      expect(result.valid).toBe(true);
    });

    it('should validate provider completeness when provider is present', () => {
      const context = createValidContext();
      context.provider = {
        id: 'provider-123',
        name: '',
        abn: '',
        abnVerified: true,
        gstRegistered: false,
      };
      
      const result = validator.validate(context);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('provider.name is required when provider is specified');
      expect(result.errors).toContain('provider.abn is required when provider is specified');
    });

    it('should require provider.abnVerified to be a boolean', () => {
      const context = createValidContext();
      context.provider = {
        id: 'provider-123',
        name: 'Test Provider',
        abn: '12345678901',
        abnVerified: 'yes' as any,
        gstRegistered: true,
      };
      
      const result = validator.validate(context);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('provider.abnVerified must be a boolean when provider is specified');
    });

    it('should require provider.gstRegistered to be a boolean', () => {
      const context = createValidContext();
      context.provider = {
        id: 'provider-123',
        name: 'Test Provider',
        abn: '12345678901',
        abnVerified: true,
        gstRegistered: 'yes' as any,
      };
      
      const result = validator.validate(context);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('provider.gstRegistered must be a boolean when provider is specified');
    });

    it('should pass with complete provider details', () => {
      const context = createValidContext();
      context.documentType = DocumentType.TAX_INVOICE;
      context.provider = {
        id: 'provider-123',
        name: 'Test Provider',
        abn: '12345678901',
        abnVerified: true,
        gstRegistered: true,
      };
      
      const result = validator.validate(context);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Line Item Validation', () => {
    it('should fail when line item is missing description', () => {
      const context = createValidContext();
      delete (context.items[0] as any).description;
      
      const result = validator.validate(context);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Item 0: description is required');
    });

    it('should fail when line item is missing type', () => {
      const context = createValidContext();
      delete (context.items[0] as any).type;
      
      const result = validator.validate(context);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Item 0: type is required');
    });

    it('should fail when line item has invalid type', () => {
      const context = createValidContext();
      (context.items[0] as any).type = 'INVALID_TYPE';
      
      const result = validator.validate(context);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Item 0: invalid type'))).toBe(true);
    });

    it('should pass for all valid line item types', () => {
      const itemTypes = [
        LineItemType.SERVICE,
        LineItemType.FVV,
        LineItemType.PLATFORM_FEE,
        LineItemType.COMMISSION,
      ];

      itemTypes.forEach(type => {
        const context = createValidContext();
        context.items[0].type = type;
        
        const result = validator.validate(context);
        expect(result.valid).toBe(true);
      });
    });

    it('should fail when line item amount is not a number', () => {
      const context = createValidContext();
      (context.items[0] as any).amount = 'not a number';
      
      const result = validator.validate(context);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Item 0: amount must be a number');
    });

    it('should fail when line item amount is NaN', () => {
      const context = createValidContext();
      context.items[0].amount = NaN;
      
      const result = validator.validate(context);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Item 0: amount must be a valid number');
    });

    it('should fail when line item has invalid supplier', () => {
      const context = createValidContext();
      (context.items[0] as any).supplier = 'INVALID_SUPPLIER';
      
      const result = validator.validate(context);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Item 0: invalid supplier'))).toBe(true);
    });

    it('should fail when quantity is not a number', () => {
      const context = createValidContext();
      (context.items[0] as any).quantity = 'not a number';
      
      const result = validator.validate(context);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Item 0: quantity must be a number when provided');
    });

    it('should fail when rate is not a number', () => {
      const context = createValidContext();
      (context.items[0] as any).rate = 'not a number';
      
      const result = validator.validate(context);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Item 0: rate must be a number when provided');
    });

    it('should pass with quantity and rate as numbers', () => {
      const context = createValidContext();
      context.items[0].quantity = 2;
      context.items[0].rate = 50;
      
      const result = validator.validate(context);
      
      expect(result.valid).toBe(true);
    });

    it('should validate multiple line items', () => {
      const context = createValidContext();
      context.items.push({
        description: '',
        type: 'INVALID' as any,
        amount: NaN,
        supplier: SupplierType.PLATFORM,
        taxable: true,
      });
      
      const result = validator.validate(context);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Item 1: description is required');
      expect(result.errors.some(e => e.includes('Item 1: invalid type'))).toBe(true);
      expect(result.errors).toContain('Item 1: amount must be a valid number');
    });
  });

  describe('Multiple Errors', () => {
    it('should collect all validation errors', () => {
      const context = {
        documentType: 'INVALID' as any,
        receiptId: '',
        issuedDate: undefined as any,
        businessModel: 'INVALID' as any,
        paymentMode: PaymentMode.PLATFORM,
        customer: {
          name: '',
          email: '',
        },
        items: [],
        payment: {
          total: 'not a number' as any,
        },
      };
      
      const result = validator.validate(context);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(5);
    });
  });
});
