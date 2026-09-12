/**
 * Tax Document Builder Tests
 * 
 * Tests for:
 * - GST calculation accuracy
 * - Line item classification by supplier and tax treatment
 * - Supplier grouping and section building
 * - Receipt number generation
 * - Total verification
 */

import { describe, it, expect } from 'vitest';
import {
  TaxDocumentBuilder,
  calculateGST,
  classifyLineItem,
  groupLineItemsBySupplier,
  buildSection
} from '../builder';
import {
  TaxDocumentContext,
  DocumentType,
  BusinessModel,
  PaymentMode,
  LineItemType,
  SupplierType,
  Provider,
  LineItem,
  EnrichedLineItem
} from '../types';

describe('TaxDocumentBuilder', () => {
  describe('calculateGST', () => {
    it('should calculate GST correctly for $110 (returns $10.00)', () => {
      const gst = calculateGST(110);
      expect(gst).toBe(10.00);
    });

    it('should calculate GST correctly for $100 (returns $9.09)', () => {
      const gst = calculateGST(100);
      expect(gst).toBe(9.09);
    });

    it('should calculate GST correctly for $31.95 (returns $2.91)', () => {
      const gst = calculateGST(31.95);
      expect(gst).toBe(2.90);
    });

    it('should calculate GST correctly for $885.78 (returns $80.53)', () => {
      const gst = calculateGST(885.78);
      expect(gst).toBe(80.53);
    });

    it('should handle zero amount', () => {
      const gst = calculateGST(0);
      expect(gst).toBe(0);
    });

    it('should round to 2 decimal places', () => {
      const gst = calculateGST(33.33);
      expect(gst).toBe(3.03); // 33.33 - (33.33/1.1) = 3.0299... rounds to 3.03
    });

    it('should handle small amounts correctly', () => {
      const gst = calculateGST(1.10);
      expect(gst).toBe(0.10);
    });

    it('should handle large amounts correctly', () => {
      const gst = calculateGST(10000);
      expect(gst).toBe(909.09);
    });

    it('should maintain precision for package pricing ($900 with 5% discount = $855)', () => {
      // Package: $900 with 5% discount = $855
      // Platform fee: 3.6% of $855 = $30.78
      // First lesson: $90 (1.5 hours @ $60/hr)
      // Wallet credit: $855 - $30.78 - $90 = $734.22
      // Total: $30.78 + $90 + $734.22 = $855
      
      const platformFeeGST = calculateGST(30.78);
      const lessonGST = calculateGST(90);
      const walletGST = calculateGST(734.22); // Should be 0, but testing formula
      
      expect(platformFeeGST).toBe(2.80); // 30.78 - (30.78/1.1)
      expect(lessonGST).toBe(8.18); // 90 - (90/1.1)
      expect(walletGST).toBe(66.75); // Formula works, but wallet items aren't taxable
    });
  });

  describe('classifyLineItem', () => {
    const gstRegisteredProvider: Provider = {
      id: 'provider-1',
      name: 'John Instructor',
      abn: '12345678901',
      abnVerified: true,
      gstRegistered: true
    };

    const nonGstProvider: Provider = {
      id: 'provider-2',
      name: 'Jane Instructor',
      abn: '98765432109',
      abnVerified: true,
      gstRegistered: false
    };

    describe('SERVICE items', () => {
      it('should classify SERVICE as PROVIDER supplier', () => {
        const item: LineItem = {
          description: 'Driving Lesson',
          type: LineItemType.SERVICE,
          amount: 90,
          supplier: SupplierType.PROVIDER, // Will be overridden
          taxable: false // Will be determined
        };

        const enriched = classifyLineItem(item, gstRegisteredProvider);

        expect(enriched.supplier).toBe(SupplierType.PROVIDER);
      });

      it('should mark SERVICE as taxable when provider is GST-registered', () => {
        const item: LineItem = {
          description: 'Driving Lesson',
          type: LineItemType.SERVICE,
          amount: 90,
          supplier: SupplierType.PROVIDER,
          taxable: false
        };

        const enriched = classifyLineItem(item, gstRegisteredProvider);

        expect(enriched.taxable).toBe(true);
        expect(enriched.gstIncluded).toBe(true);
        expect(enriched.gst).toBe(8.18);
      });

      it('should mark SERVICE as non-taxable when provider is not GST-registered', () => {
        const item: LineItem = {
          description: 'Driving Lesson',
          type: LineItemType.SERVICE,
          amount: 90,
          supplier: SupplierType.PROVIDER,
          taxable: false
        };

        const enriched = classifyLineItem(item, nonGstProvider);

        expect(enriched.taxable).toBe(false);
        expect(enriched.gstIncluded).toBe(false);
        expect(enriched.gst).toBe(0);
      });

      it('should handle SERVICE without provider (defaults to non-taxable)', () => {
        const item: LineItem = {
          description: 'Driving Lesson',
          type: LineItemType.SERVICE,
          amount: 90,
          supplier: SupplierType.PROVIDER,
          taxable: false
        };

        const enriched = classifyLineItem(item);

        expect(enriched.taxable).toBe(false);
        expect(enriched.gst).toBe(0);
      });
    });

    describe('PLATFORM_FEE items', () => {
      it('should classify PLATFORM_FEE as PLATFORM supplier', () => {
        const item: LineItem = {
          description: 'Platform Service Fee',
          type: LineItemType.PLATFORM_FEE,
          amount: 30.78,
          supplier: SupplierType.NONE, // Will be overridden
          taxable: false
        };

        const enriched = classifyLineItem(item);

        expect(enriched.supplier).toBe(SupplierType.PLATFORM);
      });

      it('should always mark PLATFORM_FEE as taxable', () => {
        const item: LineItem = {
          description: 'Platform Service Fee',
          type: LineItemType.PLATFORM_FEE,
          amount: 30.78,
          supplier: SupplierType.PLATFORM,
          taxable: false
        };

        const enriched = classifyLineItem(item);

        expect(enriched.taxable).toBe(true);
        expect(enriched.gstIncluded).toBe(true);
        expect(enriched.gst).toBe(2.80);
      });
    });

    describe('FVV items', () => {
      it('should classify FVV as NONE supplier', () => {
        const item: LineItem = {
          description: 'Lesson Credits',
          type: LineItemType.FVV,
          amount: 734.22,
          supplier: SupplierType.PROVIDER, // Will be overridden
          taxable: false
        };

        const enriched = classifyLineItem(item);

        expect(enriched.supplier).toBe(SupplierType.NONE);
      });

      it('should always mark FVV as non-taxable', () => {
        const item: LineItem = {
          description: 'Lesson Credits',
          type: LineItemType.FVV,
          amount: 734.22,
          supplier: SupplierType.NONE,
          taxable: false
        };

        const enriched = classifyLineItem(item);

        expect(enriched.taxable).toBe(false);
        expect(enriched.gstIncluded).toBe(false);
        expect(enriched.gst).toBe(0);
      });
    });

    describe('COMMISSION items', () => {
      it('should classify COMMISSION as PLATFORM supplier', () => {
        const item: LineItem = {
          description: 'Commission',
          type: LineItemType.COMMISSION,
          amount: 10,
          supplier: SupplierType.NONE,
          taxable: false
        };

        const enriched = classifyLineItem(item);

        expect(enriched.supplier).toBe(SupplierType.PLATFORM);
      });

      it('should mark COMMISSION as taxable', () => {
        const item: LineItem = {
          description: 'Commission',
          type: LineItemType.COMMISSION,
          amount: 10,
          supplier: SupplierType.PLATFORM,
          taxable: false
        };

        const enriched = classifyLineItem(item);

        expect(enriched.taxable).toBe(true);
        expect(enriched.gst).toBeGreaterThan(0);
      });
    });

    describe('Description formatting', () => {
      it('should format description with quantity and rate', () => {
        const item: LineItem = {
          description: 'Driving Lesson',
          type: LineItemType.SERVICE,
          amount: 90,
          quantity: 1.5,
          rate: 60,
          supplier: SupplierType.PROVIDER,
          taxable: false
        };

        const enriched = classifyLineItem(item, gstRegisteredProvider);

        expect(enriched.formattedDescription).toBe('Driving Lesson (1.5 Ã— $60.00)');
      });

      it('should leave description unchanged when quantity/rate not provided', () => {
        const item: LineItem = {
          description: 'Platform Fee',
          type: LineItemType.PLATFORM_FEE,
          amount: 30.78,
          supplier: SupplierType.PLATFORM,
          taxable: false
        };

        const enriched = classifyLineItem(item);

        expect(enriched.formattedDescription).toBe('Platform Fee');
      });

      it('should format integer quantities correctly', () => {
        const item: LineItem = {
          description: 'Driving Lesson',
          type: LineItemType.SERVICE,
          amount: 180,
          quantity: 3,
          rate: 60,
          supplier: SupplierType.PROVIDER,
          taxable: false
        };

        const enriched = classifyLineItem(item, gstRegisteredProvider);

        expect(enriched.formattedDescription).toBe('Driving Lesson (3 Ã— $60.00)');
      });
    });
  });

  describe('groupLineItemsBySupplier', () => {
    it('should group items by supplier type', () => {
      const items: EnrichedLineItem[] = [
        {
          description: 'Platform Fee',
          type: LineItemType.PLATFORM_FEE,
          amount: 30.78,
          supplier: SupplierType.PLATFORM,
          taxable: true,
          gst: 2.80,
          gstIncluded: true,
          formattedDescription: 'Platform Fee'
        },
        {
          description: 'Driving Lesson',
          type: LineItemType.SERVICE,
          amount: 90,
          supplier: SupplierType.PROVIDER,
          taxable: true,
          gst: 8.18,
          gstIncluded: true,
          formattedDescription: 'Driving Lesson'
        },
        {
          description: 'Lesson Credits',
          type: LineItemType.FVV,
          amount: 734.22,
          supplier: SupplierType.NONE,
          taxable: false,
          gst: 0,
          gstIncluded: false,
          formattedDescription: 'Lesson Credits'
        }
      ];

      const groups = groupLineItemsBySupplier(items);

      expect(groups.size).toBe(3);
      expect(groups.get(SupplierType.PLATFORM)).toHaveLength(1);
      expect(groups.get(SupplierType.PROVIDER)).toHaveLength(1);
      expect(groups.get(SupplierType.NONE)).toHaveLength(1);
    });

    it('should preserve order within groups', () => {
      const items: EnrichedLineItem[] = [
        {
          description: 'Service 1',
          type: LineItemType.SERVICE,
          amount: 50,
          supplier: SupplierType.PROVIDER,
          taxable: true,
          gst: 4.55,
          gstIncluded: true,
          formattedDescription: 'Service 1'
        },
        {
          description: 'Service 2',
          type: LineItemType.SERVICE,
          amount: 60,
          supplier: SupplierType.PROVIDER,
          taxable: true,
          gst: 5.45,
          gstIncluded: true,
          formattedDescription: 'Service 2'
        },
        {
          description: 'Service 3',
          type: LineItemType.SERVICE,
          amount: 70,
          supplier: SupplierType.PROVIDER,
          taxable: true,
          gst: 6.36,
          gstIncluded: true,
          formattedDescription: 'Service 3'
        }
      ];

      const groups = groupLineItemsBySupplier(items);
      const providerItems = groups.get(SupplierType.PROVIDER)!;

      expect(providerItems[0].description).toBe('Service 1');
      expect(providerItems[1].description).toBe('Service 2');
      expect(providerItems[2].description).toBe('Service 3');
    });

    it('should maintain group order: PLATFORM, PROVIDER, NONE', () => {
      const items: EnrichedLineItem[] = [
        {
          description: 'Wallet',
          type: LineItemType.FVV,
          amount: 100,
          supplier: SupplierType.NONE,
          taxable: false,
          gst: 0,
          gstIncluded: false,
          formattedDescription: 'Wallet'
        },
        {
          description: 'Service',
          type: LineItemType.SERVICE,
          amount: 90,
          supplier: SupplierType.PROVIDER,
          taxable: true,
          gst: 8.18,
          gstIncluded: true,
          formattedDescription: 'Service'
        },
        {
          description: 'Fee',
          type: LineItemType.PLATFORM_FEE,
          amount: 30,
          supplier: SupplierType.PLATFORM,
          taxable: true,
          gst: 2.73,
          gstIncluded: true,
          formattedDescription: 'Fee'
        }
      ];

      const groups = groupLineItemsBySupplier(items);
      const keys = Array.from(groups.keys());

      expect(keys).toEqual([SupplierType.PLATFORM, SupplierType.PROVIDER, SupplierType.NONE]);
    });

    it('should omit empty groups', () => {
      const items: EnrichedLineItem[] = [
        {
          description: 'Platform Fee',
          type: LineItemType.PLATFORM_FEE,
          amount: 30,
          supplier: SupplierType.PLATFORM,
          taxable: true,
          gst: 2.73,
          gstIncluded: true,
          formattedDescription: 'Platform Fee'
        }
      ];

      const groups = groupLineItemsBySupplier(items);

      expect(groups.size).toBe(1);
      expect(groups.has(SupplierType.PLATFORM)).toBe(true);
      expect(groups.has(SupplierType.PROVIDER)).toBe(false);
      expect(groups.has(SupplierType.NONE)).toBe(false);
    });
  });

  describe('buildSection', () => {
    const mockContext: TaxDocumentContext = {
      documentType: DocumentType.MIXED_DOCUMENT,
      receiptId: 'test-123',
      issuedDate: new Date('2024-01-15'),
      businessModel: BusinessModel.MARKETPLACE,
      paymentMode: PaymentMode.PLATFORM,
      customer: {
        name: 'John Doe',
        email: 'john@example.com'
      },
      provider: {
        id: 'provider-1',
        name: 'Jane Instructor',
        businessName: 'Jane\'s Driving School',
        abn: '12345678901',
        abnVerified: true,
        gstRegistered: true
      },
      items: [],
      payment: {
        total: 855
      }
    };

    const mockItems: EnrichedLineItem[] = [
      {
        description: 'Test Item',
        type: LineItemType.SERVICE,
        amount: 90,
        supplier: SupplierType.PROVIDER,
        taxable: true,
        gst: 8.18,
        gstIncluded: true,
        formattedDescription: 'Test Item'
      }
    ];

    it('should build PLATFORM section correctly', () => {
      const section = buildSection(SupplierType.PLATFORM, mockItems, mockContext);

      expect(section.title).toBe('Platform Fee');
      expect(section.supplier?.name).toBe('DriveBook');
      expect(section.supplier?.abn).toBe('23 806 069 420');
      expect(section.showGST).toBe(true);
      expect(section.rcti).toBe(false);
      expect(section.items).toEqual(mockItems);
    });

    it('should build PROVIDER section with GST-registered provider', () => {
      const section = buildSection(SupplierType.PROVIDER, mockItems, mockContext);

      expect(section.title).toBe('Service');
      expect(section.supplier?.name).toBe('Jane\'s Driving School');
      expect(section.supplier?.abn).toBe('12345678901');
      expect(section.showGST).toBe(true);
      expect(section.rcti).toBe(false);
    });

    it('should build PROVIDER section with non-GST provider', () => {
      const context = {
        ...mockContext,
        provider: {
          ...mockContext.provider!,
          gstRegistered: false
        }
      };

      const section = buildSection(SupplierType.PROVIDER, mockItems, context);

      expect(section.showGST).toBe(false);
    });

    it('should use provider name if businessName not provided', () => {
      const context = {
        ...mockContext,
        provider: {
          id: 'provider-1',
          name: 'Jane Instructor',
          abn: '12345678901',
          abnVerified: true,
          gstRegistered: true
        }
      };

      const section = buildSection(SupplierType.PROVIDER, mockItems, context);

      expect(section.supplier?.name).toBe('Jane Instructor');
    });

    it('should build NONE section (Wallet) correctly', () => {
      const section = buildSection(SupplierType.NONE, mockItems, mockContext);

      expect(section.title).toBe('Wallet');
      expect(section.supplier).toBeNull();
      expect(section.showGST).toBe(false);
      expect(section.rcti).toBe(false);
      expect(section.note).toBe('GST (if any) applies when credits are redeemed for services');
    });

    it('should mark RCTI section correctly (when RCTI is enabled)', () => {
      // Note: RCTI is currently deferred, but we test the structure
      // The actual isRCTI flag in the code is hardcoded to false
      // This test verifies the data structure is correct for when it's enabled
      
      const section = buildSection(SupplierType.PROVIDER, mockItems, mockContext);

      // Current implementation always sets rcti to false
      expect(section.rcti).toBe(false);
      expect(section.title).toBe('Service');
      
      // When RCTI is enabled in the future, this would be:
      // expect(section.title).toBe('Service (RCTI)');
      // expect(section.rcti).toBe(true);
    });
  });

  describe('TaxDocumentBuilder.build', () => {
    const builder = new TaxDocumentBuilder();

    it('should build complete enriched document for package purchase', () => {
      const context: TaxDocumentContext = {
        documentType: DocumentType.MIXED_DOCUMENT,
        receiptId: 'pi_test123',
        issuedDate: new Date('2024-03-15T10:30:00Z'),
        businessModel: BusinessModel.MARKETPLACE,
        paymentMode: PaymentMode.PLATFORM,
        customer: {
          name: 'John Student',
          email: 'john@example.com'
        },
        provider: {
          id: 'provider-1',
          name: 'Jane Instructor',
          businessName: 'Jane\'s Driving School',
          abn: '12345678901',
          abnVerified: true,
          gstRegistered: true
        },
        items: [
          {
            description: 'Platform Service Fee',
            type: LineItemType.PLATFORM_FEE,
            amount: 30.78,
            supplier: SupplierType.PLATFORM,
            taxable: true
          },
          {
            description: 'Driving Lesson with Jane Instructor',
            type: LineItemType.SERVICE,
            amount: 90,
            quantity: 1.5,
            rate: 60,
            supplier: SupplierType.PROVIDER,
            taxable: true
          },
          {
            description: 'Lesson Credits',
            type: LineItemType.FVV,
            amount: 734.22,
            supplier: SupplierType.NONE,
            taxable: false
          }
        ],
        payment: {
          total: 855,
          method: 'Visa ending in 4242',
          stripePaymentIntentId: 'pi_test123'
        }
      };

      const enriched = builder.build(context);

      // Verify receipt number generation
      expect(enriched.receiptNumber).toBe('DB-2024-EST123');

      // Verify sections created
      expect(enriched.sections).toHaveLength(3);
      expect(enriched.sections[0].title).toBe('Platform Fee');
      expect(enriched.sections[1].title).toBe('Service');
      expect(enriched.sections[2].title).toBe('Wallet');

      // Verify totals
      expect(enriched.totals.subtotal).toBe(855);
      expect(enriched.totals.total).toBe(855);
      expect(enriched.totals.gst).toBeCloseTo(10.98, 2); // 2.80 + 8.18 + 0

      // Verify validation
      expect(enriched.validation.itemsMatchTotal).toBe(true);
      expect(enriched.validation.gstCalculationsCorrect).toBe(true);
    });

    it('should generate receipt number when not provided', () => {
      const context: TaxDocumentContext = {
        documentType: DocumentType.PAYMENT_RECEIPT,
        receiptId: 'ch_1AbCdEfGhIjKlMnO',
        issuedDate: new Date('2024-12-25T15:45:00Z'),
        businessModel: BusinessModel.MARKETPLACE,
        paymentMode: PaymentMode.PLATFORM,
        customer: {
          name: 'Test User',
          email: 'test@example.com'
        },
        items: [
          {
            description: 'Wallet Top-up',
            type: LineItemType.FVV,
            amount: 100,
            supplier: SupplierType.NONE,
            taxable: false
          }
        ],
        payment: {
          total: 100
        }
      };

      const enriched = builder.build(context);

      expect(enriched.receiptNumber).toBe('DB-2024-JKLMNO');
    });

    it('should use provided receipt number', () => {
      const context: TaxDocumentContext = {
        documentType: DocumentType.PAYMENT_RECEIPT,
        receiptId: 'test-123',
        receiptNumber: 'CUSTOM-2024-XYZ',
        issuedDate: new Date('2024-01-15'),
        businessModel: BusinessModel.MARKETPLACE,
        paymentMode: PaymentMode.PLATFORM,
        customer: {
          name: 'Test User',
          email: 'test@example.com'
        },
        items: [
          {
            description: 'Test',
            type: LineItemType.FVV,
            amount: 100,
            supplier: SupplierType.NONE,
            taxable: false
          }
        ],
        payment: {
          total: 100
        }
      };

      const enriched = builder.build(context);

      expect(enriched.receiptNumber).toBe('CUSTOM-2024-XYZ');
    });

    it('should detect total mismatch', () => {
      const context: TaxDocumentContext = {
        documentType: DocumentType.PAYMENT_RECEIPT,
        receiptId: 'test-123',
        issuedDate: new Date('2024-01-15'),
        businessModel: BusinessModel.MARKETPLACE,
        paymentMode: PaymentMode.PLATFORM,
        customer: {
          name: 'Test User',
          email: 'test@example.com'
        },
        items: [
          {
            description: 'Test',
            type: LineItemType.FVV,
            amount: 100,
            supplier: SupplierType.NONE,
            taxable: false
          }
        ],
        payment: {
          total: 150 // Mismatch!
        }
      };

      const enriched = builder.build(context);

      expect(enriched.validation.itemsMatchTotal).toBe(false);
    });

    it('should allow small rounding differences in totals', () => {
      const context: TaxDocumentContext = {
        documentType: DocumentType.PAYMENT_RECEIPT,
        receiptId: 'test-123',
        issuedDate: new Date('2024-01-15'),
        businessModel: BusinessModel.MARKETPLACE,
        paymentMode: PaymentMode.PLATFORM,
        customer: {
          name: 'Test User',
          email: 'test@example.com'
        },
        items: [
          {
            description: 'Test',
            type: LineItemType.FVV,
            amount: 100.004, // Rounds to 100.00
            supplier: SupplierType.NONE,
            taxable: false
          }
        ],
        payment: {
          total: 100 // Within tolerance
        }
      };

      const enriched = builder.build(context);

      expect(enriched.validation.itemsMatchTotal).toBe(true);
    });

    it('should handle wallet lesson booking (no card charge)', () => {
      const context: TaxDocumentContext = {
        documentType: DocumentType.TAX_INVOICE,
        receiptId: 'booking-456',
        issuedDate: new Date('2024-02-20'),
        businessModel: BusinessModel.MARKETPLACE,
        paymentMode: PaymentMode.PLATFORM,
        customer: {
          name: 'Student Name',
          email: 'student@example.com'
        },
        provider: {
          id: 'provider-1',
          name: 'Instructor Name',
          abn: '12345678901',
          abnVerified: true,
          gstRegistered: false
        },
        items: [
          {
            description: 'Driving Lesson',
            type: LineItemType.SERVICE,
            amount: 80,
            quantity: 1,
            rate: 80,
            supplier: SupplierType.PROVIDER,
            taxable: false
          }
        ],
        payment: {
          total: 0, // Paid from wallet
          method: 'Wallet Credits'
        },
        wallet: {
          previousBalance: 200,
          debited: 80,
          newBalance: 120
        }
      };

      const enriched = builder.build(context);

      expect(enriched.sections).toHaveLength(1);
      expect(enriched.sections[0].title).toBe('Service');
      expect(enriched.sections[0].showGST).toBe(false);
      expect(enriched.totals.gst).toBe(0);
    });
  });
});
