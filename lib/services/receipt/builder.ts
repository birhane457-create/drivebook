/**
 * Tax Document Builder - Core business logic for receipt generation
 * 
 * This module handles:
 * - GST calculation for Australian tax compliance
 * - Line item classification by supplier and tax treatment
 * - Supplier grouping and section building
 * - Total verification and validation
 * 
 * @module lib/services/receipt/builder
 */

import {
  TaxDocumentContext,
  LineItem,
  EnrichedLineItem,
  EnrichedDocument,
  DocumentSection,
  Provider,
  LineItemType,
  SupplierType,
  DocumentType
} from './types';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Australian GST rate (10%) */
const GST_RATE = 0.1;

/** Divisor for extracting GST from GST-inclusive amounts (1 + GST_RATE = 1.1) */
const GST_DIVISOR = 1.1;

/** DriveBook's Australian Business Number */
const PLATFORM_ABN = '23 806 069 420';

/** Tolerance for floating point comparison (1 cent) */
const TOLERANCE = 0.01;

// ============================================================================
// GST CALCULATION
// ============================================================================

/**
 * Calculate GST amount from a GST-inclusive price.
 * 
 * Australian GST is 10% and is typically included in the displayed price.
 * To extract the GST component from a GST-inclusive amount:
 * 
 * GST = Amount - (Amount / 1.1)
 * 
 * This is mathematically equivalent to Amount × (1/11) or Amount × 0.0909...
 * 
 * @param amountIncludingGST - The total amount including GST
 * @returns The GST component rounded to 2 decimal places
 * 
 * @example
 * calculateGST(110) // returns 10.00
 * calculateGST(100) // returns 9.09
 * calculateGST(31.95) // returns 2.91
 */
export function calculateGST(amountIncludingGST: number): number {
  // Extract GST from GST-inclusive amount
  const gst = amountIncludingGST - (amountIncludingGST / GST_DIVISOR);
  
  // Round to 2 decimal places to avoid floating point errors
  return Math.round(gst * 100) / 100;
}

// ============================================================================
// LINE ITEM CLASSIFICATION
// ============================================================================

/**
 * Classify a line item by supplier, determine tax treatment, and calculate GST.
 * 
 * Classification rules:
 * - SERVICE items â†’ PROVIDER supplier, taxable if provider GST-registered
 * - PLATFORM_FEE items â†’ PLATFORM supplier, always taxable
 * - FVV items â†’ NONE supplier, never taxable (FVV is input-taxed)
 * - COMMISSION items â†’ PLATFORM supplier, always taxable
 * 
 * @param item - The line item to classify
 * @param provider - The service provider (optional, required for SERVICE items)
 * @returns Enriched line item with supplier, tax treatment, GST calculation, and formatted description
 */
export function classifyLineItem(item: LineItem, provider?: Provider): EnrichedLineItem {
  // Determine supplier based on line item type
  let supplier: SupplierType;
  switch (item.type) {
    case LineItemType.SERVICE:
      supplier = SupplierType.PROVIDER;
      break;
    case LineItemType.PLATFORM_FEE:
      supplier = SupplierType.PLATFORM;
      break;
    case LineItemType.FVV:
      supplier = SupplierType.NONE;
      break;
    case LineItemType.COMMISSION:
      supplier = SupplierType.PLATFORM;
      break;
    default:
      // Fallback for unknown types (shouldn't happen with proper TypeScript usage)
      supplier = SupplierType.NONE;
  }
  
  // Determine taxability based on supplier and registration status
  let taxable = false;
  switch (supplier) {
    case SupplierType.PLATFORM:
      // Platform fees always include GST (DriveBook is GST-registered)
      taxable = true;
      break;
    case SupplierType.PROVIDER:
      // Provider services are taxable only if provider is GST-registered
      taxable = provider?.gstRegistered ?? false;
      break;
    case SupplierType.NONE:
      // FVV is never taxable at purchase (input-taxed supply)
      taxable = false;
      break;
  }
  
  // Calculate GST if taxable, otherwise zero
  const gst = taxable ? calculateGST(item.amount) : 0;
  
  // Format description with quantity and rate if provided
  const formattedDescription = formatDescription(item);
  
  return {
    ...item,
    supplier,
    taxable,
    gst,
    gstIncluded: taxable, // GST is included in amount for all taxable items
    formattedDescription
  };
}

/**
 * Format line item description with quantity and rate if applicable.
 * 
 * @param item - The line item to format
 * @returns Formatted description string
 * 
 * @example
 * formatDescription({ description: "Driving Lesson", quantity: 2, rate: 90 })
 * // returns "Driving Lesson (2 × $90.00)"
 * 
 * formatDescription({ description: "Platform Fee", amount: 31.95 })
 * // returns "Platform Fee"
 */
function formatDescription(item: LineItem): string {
  if (item.quantity !== undefined && item.rate !== undefined) {
    return `${item.description} (${item.quantity} × $${item.rate.toFixed(2)})`;
  }
  return item.description;
}

// ============================================================================
// SUPPLIER GROUPING
// ============================================================================

/**
 * Group line items by supplier classification.
 * 
 * Groups are ordered: PLATFORM, PROVIDER, NONE
 * Order of items within each group is preserved from the input array.
 * 
 * @param items - Array of enriched line items
 * @returns Map of supplier type to array of items
 */
export function groupLineItemsBySupplier(
  items: EnrichedLineItem[]
): Map<SupplierType, EnrichedLineItem[]> {
  const groups = new Map<SupplierType, EnrichedLineItem[]>();
  
  // Initialize groups in desired display order
  groups.set(SupplierType.PLATFORM, []);
  groups.set(SupplierType.PROVIDER, []);
  groups.set(SupplierType.NONE, []);
  
  // Group items while preserving order within groups
  for (const item of items) {
    groups.get(item.supplier)!.push(item);
  }
  
  // Remove empty groups
  for (const [supplier, supplierItems] of Array.from(groups.entries())) {
    if (supplierItems.length === 0) {
      groups.delete(supplier);
    }
  }
  
  return groups;
}

// ============================================================================
// SECTION BUILDING
// ============================================================================

/**
 * Build a document section for a supplier group.
 * 
 * Sections include:
 * - PLATFORM: "Platform Fee" section with DriveBook ABN and GST display
 * - PROVIDER (RCTI): "Service (RCTI)" section with special RCTI formatting
 * - PROVIDER (standard): "Service" section with provider details
 * - NONE: "Wallet" section with FVV notice
 * 
 * @param supplier - Supplier type for this section
 * @param items - Line items in this section
 * @param context - Full tax document context for provider details
 * @returns Formatted document section
 */
export function buildSection(
  supplier: SupplierType,
  items: EnrichedLineItem[],
  context: TaxDocumentContext
): DocumentSection {
  switch (supplier) {
    case SupplierType.PLATFORM:
      return {
        title: 'Platform Fee',
        supplier: {
          name: 'DriveBook',
          abn: PLATFORM_ABN
        },
        items,
        showGST: true,
        rcti: false
      };
      
    case SupplierType.PROVIDER: {
      // RCTI is deferred â€” no instructor has a signed RCTI agreement yet.
      // Re-enable via context.documentType === DocumentType.RCTI
      // once rctiAgreementStatus is added to the provider schema.
      const isRCTI = false;
      
      return {
        title: isRCTI ? 'Service (RCTI)' : 'Service',
        supplier: {
          name: context.provider!.businessName || context.provider!.name,
          abn: context.provider!.abn
        },
        items,
        showGST: context.provider!.gstRegistered,
        rcti: isRCTI
      };
    }
      
    case SupplierType.NONE:
      return {
        title: 'Wallet',
        supplier: null,
        items,
        showGST: false,
        rcti: false,
        note: 'GST (if any) applies when credits are redeemed for services'
      };
      
    default:
      throw new Error(`Unknown supplier type: ${supplier}`);
  }
}

// ============================================================================
// TAX DOCUMENT BUILDER CLASS
// ============================================================================

/**
 * Tax Document Builder - Orchestrates line item classification, grouping, and section building.
 * 
 * Responsibilities:
 * - Classify all line items by supplier and tax treatment
 * - Calculate GST for taxable items
 * - Group line items by supplier
 * - Build document sections with appropriate metadata
 * - Verify totals and GST calculations
 * - Generate receipt number
 */
export class TaxDocumentBuilder {
  /**
   * Build an enriched document from tax document context.
   * 
   * @param context - Input context containing transaction details
   * @returns Enriched document ready for template rendering
   */
  build(context: TaxDocumentContext): EnrichedDocument {
    // 1. Classify and enrich all line items
    const enrichedItems = context.items.map(item => 
      classifyLineItem(item, context.provider)
    );
    
    // 2. Group items by supplier
    const supplierGroups = groupLineItemsBySupplier(enrichedItems);
    
    // 3. Build sections for each supplier group
    const sections: DocumentSection[] = [];
    for (const [supplier, items] of Array.from(supplierGroups.entries())) {
      sections.push(buildSection(supplier, items, context));
    }
    
    // 4. Calculate totals
    const subtotal = enrichedItems.reduce((sum, item) => sum + item.amount, 0);
    const totalGST = enrichedItems.reduce((sum, item) => sum + item.gst, 0);
    const total = subtotal; // In Australia, GST is included in the amount
    
    // 5. Verify calculations
    const itemsMatchTotal = Math.abs(total - context.payment.total) < TOLERANCE;
    const gstCalculationsCorrect = enrichedItems.every(item => {
      if (!item.taxable) {
        return item.gst === 0;
      }
      const expectedGST = calculateGST(item.amount);
      return Math.abs(item.gst - expectedGST) < TOLERANCE;
    });
    
    // 6. Generate receipt number if not provided
    const receiptNumber = context.receiptNumber || 
                         this.formatReceiptNumber(context.receiptId, context.issuedDate);
    
    return {
      context,
      receiptNumber,
      sections,
      totals: {
        subtotal: Math.round(subtotal * 100) / 100,
        gst: Math.round(totalGST * 100) / 100,
        total: Math.round(total * 100) / 100
      },
      validation: {
        itemsMatchTotal,
        gstCalculationsCorrect
      }
    };
  }
  
  /**
   * Format a receipt number from transaction ID and date.
   * 
   * Format: DB-{year}-{last6CharsUppercase}
   * 
   * @param id - Transaction identifier
   * @param date - Issue date
   * @returns Formatted receipt number
   * 
   * @example
   * formatReceiptNumber("pi_3abc123def456", new Date("2024-03-15"))
   * // returns "DB-2024-EF456"
   */
  private formatReceiptNumber(id: string, date: Date): string {
    const year = date.getFullYear();
    const shortId = id.slice(-6).toUpperCase();
    return `DB-${year}-${shortId}`;
  }
}
