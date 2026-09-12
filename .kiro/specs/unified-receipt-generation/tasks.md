# Implementation Plan: Unified Receipt Generation System

## Overview

This implementation converts the 4-layer unified receipt generation design into production-ready TypeScript code. The system replaces 7 hardcoded receipt functions with a context-driven architecture that handles Australian tax compliance (GST, RCTI, FVV) across all payment scenarios.

**Architecture**: Receipt Service → Tax Document Builder → Template Engine → Email Service

**Key Features**:
- Type-safe TypeScript interfaces with discriminated unions
- Pure function GST calculations (amount - amount/1.1)
- Supplier-based line item grouping (PLATFORM/PROVIDER/NONE)
- Multi-supplier receipt support (mixed documents)
- Legacy adapter layer for gradual migration

## Tasks

- [x] 1. Create core TypeScript types and enums
  - Create `lib/services/receipt/types.ts` with all interfaces and enums
  - Define `DocumentType`, `BusinessModel`, `PaymentMode`, `LineItemType`, `SupplierType` enums
  - Define `TaxDocumentContext`, `LineItem`, `PaymentDetails`, `BookingContext`, `WalletContext`, `CancellationContext` interfaces
  - Define `EnrichedDocument`, `DocumentSection`, `EnrichedLineItem` interfaces for builder output
  - Define `ValidationResult` interface for validator
  - Export all types for use across the receipt system
  - _Requirements: 1.1-1.7, 2.1-2.2_

- [x] 2. Implement context validation logic
  - [x] 2.1 Create ContextValidator class in `lib/services/receipt/validator.ts`
    - Implement `validate(context: TaxDocumentContext): ValidationResult` method
    - Validate required fields: documentType, receiptId, issuedDate, customer, items, payment
    - Validate enum values for documentType, businessModel, paymentMode
    - Validate conditional requirements (RCTI/TAX_INVOICE requires provider details)
    - Validate line item structure (description, type, amount, supplier)
    - Return ValidationResult with boolean valid flag and error messages array
    - _Requirements: 18.1-18.6_

  - [ ]* 2.2 Write unit tests for ContextValidator
    - Test valid context passes validation
    - Test missing required fields trigger errors
    - Test invalid enum values trigger errors
    - Test RCTI without provider details triggers error
    - Test empty items array triggers error
    - _Requirements: 18.1-18.6_

- [x] 3. Implement GST calculation and line item classification
  - [x] 3.1 Create TaxDocumentBuilder class in `lib/services/receipt/builder.ts`
    - Define GST_RATE constant as 0.1 and GST_DIVISOR as 1.1
    - Implement `calculateGST(amountIncludingGST: number): number` using formula: amount - (amount / 1.1)
    - Round GST to 2 decimal places to avoid floating point errors
    - Implement `classifyLineItem(item: LineItem, provider?: Provider): EnrichedLineItem`
    - Map line item types to suppliers: SERVICE→PROVIDER, PLATFORM_FEE→PLATFORM, FVV→NONE
    - Set taxable=true for PLATFORM supplier (always GST-registered)
    - Set taxable based on provider.gstRegistered for PROVIDER supplier
    - Set taxable=false for NONE supplier (FVV non-taxable at purchase)
    - Calculate GST for taxable items, set to 0 for non-taxable
    - Format description with quantity/rate if applicable
    - _Requirements: 2.1-2.8, 3.1-3.6_

  - [ ]* 3.2 Write property test for GST calculation
    - **Property 1: GST calculation correctness**
    - **Validates: Requirements 3.1-3.2**
    - Generate random amounts between $1 and $10,000
    - Verify calculated GST equals amount × (1/11) within 0.01 tolerance
    - Verify amount = (amount - GST) + GST (reconstruction property)
    - Verify GST is always non-negative
    - _Requirements: 3.1-3.2_

  - [ ]* 3.3 Write unit tests for line item classification
    - Test SERVICE items assigned to PROVIDER supplier
    - Test PLATFORM_FEE items assigned to PLATFORM supplier
    - Test FVV items assigned to NONE supplier
    - Test SERVICE items taxable only when provider GST-registered
    - Test PLATFORM_FEE items always taxable
    - Test FVV items never taxable
    - Test description formatting with quantity and rate
    - _Requirements: 2.3-2.8_

- [x] 4. Implement supplier grouping and section building
  - [x] 4.1 Add grouping and section methods to TaxDocumentBuilder
    - Implement `groupLineItemsBySupplier(items: EnrichedLineItem[]): Map<SupplierType, EnrichedLineItem[]>`
    - Initialize map with PLATFORM, PROVIDER, NONE in order
    - Group items by supplier while preserving order within groups
    - Remove empty groups from map
    - Implement `buildSection(supplier: SupplierType, items: EnrichedLineItem[], context: TaxDocumentContext): DocumentSection`
    - For PLATFORM: title="Platform Fee", supplier name="DriveBook", ABN="23 806 069 420", showGST=true
    - For PROVIDER with RCTI: title="Service (RCTI)", rcti=true, showGST based on gstRegistered
    - For PROVIDER without RCTI: title="Service", rcti=false, showGST based on gstRegistered
    - For NONE: title="Wallet", supplier=null, showGST=false, note about GST on redemption
    - Use provider.businessName if available, otherwise provider.name
    - _Requirements: 4.1-4.5, 5.1-5.5_

  - [ ]* 4.2 Write unit tests for supplier grouping
    - Test items grouped correctly by supplier type
    - Test groups maintain order: PLATFORM, PROVIDER, NONE
    - Test empty groups are removed
    - Test item order preserved within groups
    - _Requirements: 4.1-4.5_

  - [ ]* 4.3 Write unit tests for section building
    - Test PLATFORM section has correct title, supplier, and ABN
    - Test PROVIDER RCTI section has rcti=true and correct title
    - Test PROVIDER non-RCTI section has rcti=false
    - Test NONE section has null supplier and GST note
    - Test provider businessName used when available
    - _Requirements: 5.1-5.5_

- [x] 5. Implement main document building orchestration
  - [x] 5.1 Add build method to TaxDocumentBuilder
    - Implement `build(context: TaxDocumentContext): EnrichedDocument` method
    - Classify all line items using classifyLineItem
    - Group classified items by supplier
    - Build sections for each supplier group
    - Generate receipt number using format "DB-{year}-{last6chars}" if not provided
    - Calculate totals: subtotal (sum of amounts), GST (sum of GST), total (should match payment)
    - Validate totals match payment.total within 0.01 tolerance
    - Return EnrichedDocument with context, receiptNumber, sections, totals, validation results
    - _Requirements: 17.1-17.5, 27.1-27.5_

  - [ ]* 5.2 Write integration tests for document building
    - Test complete package purchase context builds correct sections
    - Test wallet lesson context creates RCTI section
    - Test single lesson creates PLATFORM and PROVIDER sections
    - Test wallet top-up creates only NONE section
    - Test totals calculated correctly across sections
    - Test receipt number generation format
    - _Requirements: 17.1-17.5, 27.1-27.5_

- [ ] 6. Create HTML template styles and base structure
  - [x] 6.1 Create ReceiptTemplateEngine class in `lib/services/receipt/template-engine.ts`
    - Implement `renderStyles(): string` method with embedded CSS
    - Define styles for: body, wrap, header (blue gradient), header (red gradient for adjustments)
    - Define styles for: meta table, section, line-items table, wallet-box, policy, footer
    - Use colors: blue gradient (#1d4ed8 to #2563eb), red for debits, green for credits
    - Implement `generate(doc: EnrichedDocument): string` method returning full HTML
    - Create HTML structure: doctype, head with styles, body with container div
    - Call render methods for each section: header, metadata, sections, wallet, payment, policy, footer
    - _Requirements: 25.1-25.7_

  - [ ]* 6.2 Write snapshot tests for CSS styles
    - Test blue gradient header renders correctly
    - Test red gradient header for adjustments
    - Test table layouts render properly
    - Test responsive styles work in email clients
    - _Requirements: 25.1-25.7_

- [ ] 7. Implement receipt header and metadata rendering
  - [~] 7.1 Add header and metadata methods to ReceiptTemplateEngine
    - Implement `renderHeader(doc: EnrichedDocument): string`
    - Map DocumentType to titles: TAX_INVOICE→"Tax Receipt", RCTI→"Tax Invoice (RCTI)", PAYMENT_RECEIPT→"Payment Receipt", MIXED_DOCUMENT→"Payment Receipt & Tax Invoice", ADJUSTMENT_NOTE→"Booking Cancelled"
    - Use blue gradient for standard receipts, red gradient for ADJUSTMENT_NOTE
    - Include platform name "DriveBook Platform" as subtitle
    - Implement `renderMetadata(doc: EnrichedDocument): string`
    - Display receipt number, date (Australian timezone), customer name, customer email
    - Format date with day, month, year, and time
    - Include booking start time and duration when booking context exists
    - Style metadata in light gray box with two-column table layout
    - _Requirements: 6.1-6.6, 7.1-7.5_

  - [ ]* 7.2 Write unit tests for header rendering
    - Test each document type renders correct title
    - Test ADJUSTMENT_NOTE uses red gradient
    - Test platform branding appears in header
    - _Requirements: 6.1-6.6_

  - [ ]* 7.3 Write unit tests for metadata rendering
    - Test receipt number displays correctly
    - Test date formatted in Australian timezone
    - Test customer name and email appear
    - Test booking details included when context present
    - _Requirements: 7.1-7.5_

- [ ] 8. Implement supplier information and line items rendering
  - [~] 8.1 Add supplier and line item methods to ReceiptTemplateEngine
    - Implement `renderSupplierInfo(section: DocumentSection): string`
    - For non-RCTI with supplier: display "Supplier: {name}" and "ABN: {abn}" if ABN exists
    - For RCTI sections: display "Recipient Created Tax Invoice (RCTI)", "Issued by DriveBook on behalf of:", "Supplier: {name}", "ABN: {abn}"
    - For null supplier: return empty string
    - Use distinctive formatting for RCTI blocks
    - Implement `renderLineItemsTable(items: EnrichedLineItem[]): string`
    - Create two-column table: description on left, amount on right
    - Format description as "{description} ({quantity} × ${rate})" when quantity/rate present
    - Format amounts as currency with two decimal places
    - Right-align amounts
    - _Requirements: 8.1-8.5, 9.1-9.5_

  - [ ]* 8.2 Write unit tests for supplier information rendering
    - Test standard supplier info renders name and ABN
    - Test RCTI supplier block has special formatting and labels
    - Test supplier without ABN only shows name
    - Test null supplier returns empty string
    - _Requirements: 8.1-8.5_

  - [ ]* 8.3 Write unit tests for line items table
    - Test line items render in two-column format
    - Test quantity and rate formatting in description
    - Test currency formatting with two decimals
    - Test amount right-alignment
    - _Requirements: 9.1-9.5_

- [ ] 9. Implement GST summary and section rendering
  - [~] 9.1 Add GST summary and section methods to ReceiptTemplateEngine
    - Implement `renderGSTSummary(section: DocumentSection): string`
    - When showGST=true and total GST > 0: display "GST included: ${gstAmount} (Goods & Services Tax)"
    - When showGST=true and total GST = 0: display "This supplier is not GST-registered. No GST applies."
    - When showGST=false: return empty string
    - Calculate total GST by summing gst amounts from all items in section
    - Format GST amounts as currency with two decimal places
    - Implement `renderSection(section: DocumentSection): string`
    - Render section title (h3), supplier info, line items table, GST summary, and optional note
    - Implement `renderSections(doc: EnrichedDocument): string`
    - Map over all sections and concatenate rendered HTML
    - _Requirements: 10.1-10.5_

  - [ ]* 9.2 Write unit tests for GST summary
    - Test GST included message when amount > 0
    - Test non-registered message when amount = 0 and showGST=true
    - Test no GST message when showGST=false
    - Test GST calculation across multiple items
    - Test currency formatting
    - _Requirements: 10.1-10.5_

- [ ] 10. Implement wallet balance and payment details rendering
  - [~] 10.1 Add wallet and payment methods to ReceiptTemplateEngine
    - Implement `renderWalletBalance(doc: EnrichedDocument): string`
    - Return empty string if no wallet context
    - Display "Previous balance: ${previousBalance}" if previousBalance exists
    - Display "Credits added: +${credited}" in green if credited exists
    - Display "Lesson debit: -${debited}" in red if debited exists
    - Display "New balance: ${newBalance}" with emphasis
    - Calculate and display approximate hours as "(approx. {hours} hrs)" when hourlyRate available
    - Calculate hours as newBalance / hourlyRate, format to 1 decimal
    - Style in light blue box with table layout
    - Implement `renderPaymentDetails(doc: EnrichedDocument): string`
    - Display "Total charged: ${payment.total}"
    - Display "Payment method: {method}" if method exists
    - Display Stripe reference in monospace font if stripePaymentIntentId exists
    - When total=0 and wallet debited: display "Charged to card: $0.00" and "Paid from wallet: ${debited}"
    - Format all amounts as currency with two decimal places
    - _Requirements: 11.1-11.7, 12.1-12.5_

  - [ ]* 10.2 Write unit tests for wallet balance rendering
    - Test all wallet fields display when present
    - Test credit amounts show in green
    - Test debit amounts show in red
    - Test approximate hours calculation and formatting
    - Test empty string when no wallet context
    - _Requirements: 11.1-11.7_

  - [ ]* 10.3 Write unit tests for payment details
    - Test total amount displays
    - Test payment method displays when present
    - Test Stripe reference formatting
    - Test $0 card charge with wallet payment message
    - _Requirements: 12.1-12.5_

- [ ] 11. Implement cancellation policy and footer rendering
  - [~] 11.1 Add cancellation policy and footer methods to ReceiptTemplateEngine
    - Implement `renderCancellationPolicy(doc: EnrichedDocument): string`
    - Return empty string unless documentType is MIXED_DOCUMENT or TAX_INVOICE with booking
    - Display "Cancellation Policy" heading in yellow warning box
    - List policy: "48+ hours notice: full refund", "24-48 hours notice: 50% refund", "Under 24 hours: no refund"
    - Implement `renderFooter(doc: EnrichedDocument): string`
    - Get support email from ADMIN_EMAIL env or default to support@drivebook.com.au
    - Get base URL from NEXTAUTH_URL env or default to https://drivebook.com.au
    - Include "Manage booking" link with booking ID if booking context exists
    - Include "Questions? {support email}" with mailto link
    - Include "View your dashboard" link to /client-dashboard
    - Include "Login to DriveBook" link to /login
    - Include note: "New to DriveBook? Your account was created automatically. Login at {base URL}/login using the email this receipt was sent to."
    - _Requirements: 13.1-13.5, 14.1-14.5_

  - [ ]* 11.2 Write unit tests for cancellation policy
    - Test policy displays for MIXED_DOCUMENT
    - Test policy displays for TAX_INVOICE with booking
    - Test policy does not display for other document types
    - Test all three policy rules appear
    - Test yellow warning box styling
    - _Requirements: 14.1-14.5_

  - [ ]* 11.3 Write unit tests for footer rendering
    - Test support email from environment variable
    - Test base URL from environment variable
    - Test manage booking link when booking ID present
    - Test all footer links present
    - Test account creation note appears
    - _Requirements: 13.1-13.5_

- [~] 12. Checkpoint - Verify template engine generates valid HTML
  - Manually test a sample context generates complete HTML
  - Verify HTML structure is valid (matching tags, proper nesting)
  - Test HTML displays correctly in browser
  - Ensure all tests pass, ask the user if questions arise

- [ ] 13. Implement Receipt Service orchestrator
  - [~] 13.1 Create ReceiptService class in `lib/services/receipt/receipt-service.ts`
    - Import ContextValidator, TaxDocumentBuilder, ReceiptTemplateEngine, and emailService
    - Create constructor that initializes validator, builder, and templateEngine instances
    - Implement `generateHTML(context: TaxDocumentContext): string` method
    - Call validator.validate and throw ValidationError if validation fails
    - Call builder.build to get enriched document
    - Call templateEngine.generate to get HTML string
    - Return HTML
    - Implement `generateAndSend(context: TaxDocumentContext): Promise<void>` method
    - Call generateHTML to get HTML string
    - Call buildEmailSubject to generate subject line
    - Call emailService.send with from, to, subject, html
    - Use "DriveBook Payments <payments@drivebook.com.au>" as from address
    - Use context.customer.email as to address
    - Log warning if enrichedDoc.validation.itemsMatchTotal is false
    - _Requirements: 15.1-15.6, 27.1-27.5_

  - [~] 13.2 Add email subject generation to ReceiptService
    - Implement `buildEmailSubject(context: TaxDocumentContext): string` private method
    - Get receipt number from context or generate using formatReceiptNumber
    - For TAX_INVOICE or RCTI: return "Receipt {receiptNum} - Lesson Booked"
    - For MIXED_DOCUMENT: return "Receipt {receiptNum} - Package Purchased"
    - For PAYMENT_RECEIPT: return "Receipt {receiptNum} - Wallet Topped Up"
    - For ADJUSTMENT_NOTE: return "Cancellation {receiptNum} - Lesson Cancelled"
    - Implement `formatReceiptNumber(id: string, date: Date): string` private method
    - Extract year from date
    - Extract last 6 characters from id and uppercase
    - Return format "DB-{year}-{shortId}"
    - _Requirements: 15.4, 17.1-17.5_

  - [ ]* 13.3 Write integration tests for ReceiptService
    - Test generateHTML returns valid HTML string
    - Test validation errors throw ValidationError
    - Test generateAndSend calls email service with correct parameters
    - Test email subject generation for each document type
    - Test receipt number formatting
    - Test warning logged when totals don't match
    - _Requirements: 15.1-15.6, 17.1-17.5, 27.3_

- [ ] 14. Create context factory helper functions
  - [~] 14.1 Create context factories in `lib/services/receipt/context-factories.ts`
    - Implement `createPackagePurchaseContext` for package purchase receipts
    - Implement `createWalletLessonContext` for wallet lesson booking receipts
    - Implement `createSingleLessonContext` for single lesson purchase receipts
    - Implement `createWalletTopUpContext` for wallet top-up receipts
    - Implement `createCancellationContext` for cancellation receipts
    - Implement `createAdminCreditContext` for admin credit receipts
    - Implement `createAdminDeductionContext` for admin deduction receipts
    - Each factory should accept relevant domain objects and construct TaxDocumentContext
    - Map provider data to provider fields (id, name, businessName, abn, abnVerified, gstRegistered)
    - Map customer data to customer fields (name, email, abn)
    - Calculate platform fee as 3.6% of discounted package value for MARKETPLACE model
    - Create appropriate line items for each scenario
    - Include booking/wallet/cancellation context as appropriate
    - _Requirements: 19.1-19.7, 20.1-20.7, 21.1-21.7, 22.1-22.6, 23.1-23.6, 24.1-24.6_

  - [ ]* 14.2 Write unit tests for context factories
    - Test each factory creates valid TaxDocumentContext
    - Test package purchase includes all three line items (fee, service, FVV)
    - Test wallet lesson has zero payment total and wallet context
    - Test single lesson includes platform fee and service
    - Test wallet top-up includes only FVV line item
    - Test cancellation has negative amounts for refunds
    - Test admin credit/deduction contexts have correct document types
    - _Requirements: 19.1-19.7, 20.1-20.7, 21.1-21.7, 22.1-22.6, 23.1-23.6, 24.1-24.6_

- [ ] 15. Create legacy adapter layer for gradual migration
  - [~] 15.1 Create LegacyReceiptAdapters class in `lib/services/receipt/legacy-adapters.ts`
    - Create constructor accepting ReceiptService instance
    - Implement `sendPackagePurchaseReceipt` adapter wrapping createPackagePurchaseContext + generateAndSend
    - Implement `sendWalletLessonReceipt` adapter wrapping createWalletLessonContext + generateAndSend
    - Implement `sendSingleLessonReceipt` adapter wrapping createSingleLessonContext + generateAndSend
    - Implement `sendWalletTopUpReceipt` adapter wrapping createWalletTopUpContext + generateAndSend
    - Implement `sendCancellationReceipt` adapter wrapping createCancellationContext + generateAndSend
    - Implement `sendAdminCreditReceipt` adapter wrapping createAdminCreditContext + generateAndSend
    - Implement `sendAdminDeductionReceipt` adapter wrapping createAdminDeductionContext + generateAndSend
    - Each adapter should match the signature of the corresponding legacy function in receipt-email.ts
    - _Requirements: 26.1-26.8_

  - [ ]* 15.2 Write integration tests for legacy adapters
    - Test each adapter calls receipt service correctly
    - Test parameter transformation from legacy format to context
    - Test email sent with correct content
    - _Requirements: 26.1-26.8_

- [ ] 16. Create receipt service singleton instance and exports
  - [~] 16.1 Add exports to receipt module
    - Create barrel export file `lib/services/receipt/index.ts`
    - Export all types from types.ts
    - Export ContextValidator from validator.ts
    - Export TaxDocumentBuilder from builder.ts
    - Export ReceiptTemplateEngine from template-engine.ts
    - Export ReceiptService from receipt-service.ts
    - Export all context factories from context-factories.ts
    - Export LegacyReceiptAdapters from legacy-adapters.ts
    - Create singleton instance: `export const receiptService = new ReceiptService()`
    - Create singleton adapter instance: `export const legacyReceiptAdapters = new LegacyReceiptAdapters(receiptService)`
    - _Requirements: 1.7_

  - [ ]* 16.2 Write smoke tests for exports
    - Test all types are exported
    - Test singleton instances exist
    - Test receiptService methods callable
    - Test legacyReceiptAdapters methods callable
    - _Requirements: 1.7_

- [ ] 17. Integrate getPlatformIdentity for platform ABN
  - [~] 17.1 Update TaxDocumentBuilder to use getPlatformIdentity
    - Import `getPlatformIdentity` from `@/lib/core/business-config`
    - Remove hardcoded PLATFORM_ABN constant
    - In buildSection for PLATFORM supplier, call getPlatformIdentity() to get platform identity
    - Use platformIdentity.abn for Platform ABN (should be "23 806 069 420")
    - Use platformIdentity.name for Platform name (should be "DriveBook")
    - Handle async nature by making buildSection async or caching platformIdentity in constructor
    - _Requirements: 5.1_

  - [ ]* 17.2 Write tests for platform identity integration
    - Test platform ABN retrieved correctly
    - Test platform name retrieved correctly
    - Test fallback behavior if getPlatformIdentity fails
    - _Requirements: 5.1_

- [~] 18. Checkpoint - Verify complete system integration
  - Create test contexts for all 7 receipt scenarios
  - Call receiptService.generateHTML for each scenario
  - Verify HTML output is correct and complete
  - Manually review HTML rendering in email client
  - Ensure all tests pass, ask the user if questions arise

- [ ] 19. Document migration plan and usage examples
  - [~] 19.1 Create migration documentation
    - Create `lib/services/receipt/MIGRATION.md` file
    - Document the 6-phase migration strategy
    - Phase 1: New service implemented (complete after these tasks)
    - Phase 2: Add adapter layer (complete after these tasks)
    - Phase 3: Update one receipt call at a time in existing code to use legacyReceiptAdapters
    - Phase 4: Test each receipt type in production
    - Phase 5: Remove old receipt-email.ts functions
    - Phase 6: Remove adapter layer, use context factories directly
    - Include rollback plan: keep old functions until all receipts tested
    - _Requirements: 26.1-26.8_

  - [~] 19.2 Create usage examples documentation
    - Create `lib/services/receipt/README.md` file
    - Document how to use ReceiptService directly with context factories
    - Provide code examples for each of the 7 receipt scenarios
    - Document all available types and enums
    - Document how to handle validation errors
    - Document how to extend for new receipt types
    - Include troubleshooting section for common issues
    - _Requirements: 1.1-1.7_

- [~] 20. Final checkpoint - Complete system verification
  - Run all unit tests and property tests
  - Run integration tests
  - Verify type checking passes with no errors
  - Review all code for consistency with design document
  - Verify GST calculations match expected results
  - Verify all 27 requirements are covered by implementation
  - Ensure all tests pass, ask the user if questions arise

## Notes

- Tasks marked with `*` are optional test tasks that can be skipped for faster MVP delivery
- The system is payment-mode-agnostic and works with PLATFORM or DIRECT payment modes
- GST calculation uses the formula: GST = amount - (amount / 1.1) for tax-inclusive amounts
- Platform fee is always 3.6% of discounted package value and is always GST-inclusive
- FVV (Financial Supply of Vouchers) credits are non-taxable at purchase time
- RCTI (Recipient Created Tax Invoice) is issued when platform collects on provider's behalf
- The dual ledger system (FinancialLedger + PlatformLedger) remains unchanged for now
- Schema migrations (paymentMode, abnNumber, gstRegisteredAt) are deferred to later work
- All receipts use Australian timezone for date/time formatting
- The implementation replaces 7 hardcoded functions in lib/services/receipt-email.ts
- Migration is gradual using adapter layer to minimize risk
- Each task references specific requirements from the requirements document for traceability

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "3.1"] },
    { "id": 2, "tasks": ["2.2", "3.2", "3.3", "4.1"] },
    { "id": 3, "tasks": ["4.2", "4.3", "5.1"] },
    { "id": 4, "tasks": ["5.2", "6.1"] },
    { "id": 5, "tasks": ["6.2", "7.1"] },
    { "id": 6, "tasks": ["7.2", "7.3", "8.1"] },
    { "id": 7, "tasks": ["8.2", "8.3", "9.1"] },
    { "id": 8, "tasks": ["9.2", "10.1"] },
    { "id": 9, "tasks": ["10.2", "10.3", "11.1"] },
    { "id": 10, "tasks": ["11.2", "11.3", "13.1"] },
    { "id": 11, "tasks": ["13.2"] },
    { "id": 12, "tasks": ["13.3", "14.1"] },
    { "id": 13, "tasks": ["14.2", "15.1"] },
    { "id": 14, "tasks": ["15.2", "16.1"] },
    { "id": 15, "tasks": ["16.2", "17.1"] },
    { "id": 16, "tasks": ["17.2", "19.1", "19.2"] }
  ]
}
```
