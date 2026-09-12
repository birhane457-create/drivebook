# Requirements Document

## Introduction

The unified receipt generation system replaces the current multiple receipt email functions with a single, flexible architecture that handles all payment scenarios. The system must support multiple business models (MARKETPLACE and SAAS), payment modes (PLATFORM and DIRECT), and correctly handle Australian Tax Office (ATO) compliance requirements including Goods and Services Tax (GST), Recipient Created Tax Invoices (RCTI), and Financial Supply of Vouchers (FSV/FVV) regulations.

**RCTI Deferral**: RCTI support exists in the type system and template engine but is not currently activated by any context factory — no instructor has a signed RCTI agreement as of this version. Reactivating requires adding rctiAgreementStatus to the provider schema and gating documentType: RCTI on rctiAgreementStatus === 'ACTIVE'.

## Glossary

- **Receipt_Service**: The unified tax document generation system
- **Tax_Document_Context**: Input data structure containing transaction details, parties, and items
- **Tax_Document_Builder**: Core calculation and grouping logic for tax treatment
- **Receipt_Template_Engine**: HTML generation layer that renders formatted receipts
- **Provider**: Service supplier (instructor, tradie, tutor)
- **Platform**: DriveBook system entity
- **Customer**: Learner or service purchaser
- **RCTI**: Recipient Created Tax Invoice issued by platform on provider's behalf
- **FVV**: Financial Supply of Voucher (wallet credit) per ATO Division 100
- **GST**: Goods and Services Tax (10% in Australia)
- **ABN**: Australian Business Number
- **Line_Item**: Individual charge component in a receipt
- **Document_Section**: Grouped set of line items by supplier
- **PLATFORM_ABN**: DriveBook's Australian Business Number (23 806 069 420)

## Requirements

### Requirement 1: Tax Document Context Input

**User Story:** As a payment system, I want to provide comprehensive transaction data to the receipt system, so that correct tax documents are generated

#### Acceptance Criteria

1. THE Receipt_Service SHALL accept a Tax_Document_Context containing document metadata, business context, customer details, provider details, line items, payment details, optional booking context, and optional wallet context
2. THE Tax_Document_Context SHALL include document type as one of TAX_INVOICE, RCTI, PAYMENT_RECEIPT, MIXED_DOCUMENT, or ADJUSTMENT_NOTE
3. THE Tax_Document_Context SHALL include business model as either MARKETPLACE or SAAS
4. THE Tax_Document_Context SHALL include payment mode as either PLATFORM or DIRECT
5. WHEN provider details are included, THE Tax_Document_Context SHALL contain provider name, ABN number, ABN verification status, and GST registration status
6. THE Tax_Document_Context SHALL include customer name, email, and optional ABN for business-to-business transactions
7. THE Tax_Document_Context SHALL contain at least one line item with description, type, amount, supplier, and tax treatment

### Requirement 2: Line Item Classification

**User Story:** As the receipt system, I want to classify each line item by type and supplier, so that correct tax treatment is applied

#### Acceptance Criteria

1. THE Receipt_Service SHALL support line item types: SERVICE, FVV, PLATFORM_FEE, and COMMISSION
2. THE Receipt_Service SHALL classify line items by supplier as PROVIDER, PLATFORM, or NONE
3. WHEN a line item has type SERVICE, THE Receipt_Service SHALL assign supplier PROVIDER
4. WHEN a line item has type PLATFORM_FEE, THE Receipt_Service SHALL assign supplier PLATFORM
5. WHEN a line item has type FVV, THE Receipt_Service SHALL assign supplier NONE
6. THE Receipt_Service SHALL mark SERVICE items as taxable only when the provider is GST-registered
7. THE Receipt_Service SHALL mark PLATFORM_FEE items as taxable with GST included
8. THE Receipt_Service SHALL mark FVV items as non-taxable

### Requirement 3: GST Calculation

**User Story:** As a tax-compliant system, I want to calculate GST correctly based on supplier registration status, so that receipts meet ATO requirements

#### Acceptance Criteria

1. WHEN a line item is marked taxable and supplier is PLATFORM, THE Receipt_Service SHALL calculate GST as (amount - amount / 1.1)
2. WHEN a line item is marked taxable and supplier is PROVIDER with gstRegistered true, THE Receipt_Service SHALL calculate GST as (amount - amount / 1.1)
3. WHEN a line item supplier is PROVIDER with gstRegistered false, THE Receipt_Service SHALL set GST amount to zero
4. WHEN a line item is marked non-taxable, THE Receipt_Service SHALL set GST amount to zero
5. THE Receipt_Service SHALL set gstIncluded to true for all taxable line items where GST is calculated
6. THE Receipt_Service SHALL set gstIncluded to false for all non-taxable line items
7. THE Receipt_Service SHALL validate that total GST across all items equals sum of individual GST amounts

### Requirement 4: Line Item Grouping by Supplier

**User Story:** As the receipt system, I want to group line items by supplier, so that multi-supplier transactions display clearly

#### Acceptance Criteria

1. THE Receipt_Service SHALL group line items by supplier classification
2. THE Receipt_Service SHALL create separate groups for PLATFORM, PROVIDER, and NONE suppliers
3. WHEN multiple line items have the same supplier, THE Receipt_Service SHALL include them in the same group
4. THE Receipt_Service SHALL preserve line item order within each group
5. THE Receipt_Service SHALL output groups in order: PLATFORM, PROVIDER, NONE

### Requirement 5: Document Section Building

**User Story:** As the receipt system, I want to build structured sections for each supplier group, so that receipts are clear and compliant

#### Acceptance Criteria

1. WHEN a PLATFORM supplier group exists, THE Receipt_Service SHALL create a section with title "Platform Fee", supplier name as DriveBook, supplier ABN as PLATFORM_ABN, and showGST as true
2. WHEN a PROVIDER supplier group exists and document type is RCTI, THE Receipt_Service SHALL create a section with title "Service (RCTI)", supplier name from provider businessName or name, supplier ABN from provider, rcti flag as true, and showGST based on provider gstRegistered status
3. WHEN a PROVIDER supplier group exists and document type is not RCTI, THE Receipt_Service SHALL create a section with title "Service", supplier information from provider, and showGST based on provider gstRegistered status
4. WHEN a NONE supplier group exists, THE Receipt_Service SHALL create a section with title "Wallet", null supplier, showGST as false, and note "GST (if any) applies when credits are redeemed for services"
5. THE Receipt_Service SHALL include all line items from the corresponding supplier group in each section

### Requirement 6: Receipt Header Generation

**User Story:** As a customer, I want to see clear document identification in the receipt header, so that I understand what type of document I received

#### Acceptance Criteria

1. WHEN document type is TAX_INVOICE, THE Receipt_Template_Engine SHALL render header title as "Tax Receipt"
2. WHEN document type is RCTI, THE Receipt_Template_Engine SHALL render header title as "Tax Invoice (RCTI)"
3. WHEN document type is PAYMENT_RECEIPT, THE Receipt_Template_Engine SHALL render header title as "Payment Receipt"
4. WHEN document type is MIXED_DOCUMENT, THE Receipt_Template_Engine SHALL render header title as "Payment Receipt & Tax Invoice"
5. WHEN document type is ADJUSTMENT_NOTE, THE Receipt_Template_Engine SHALL render header title as "Booking Cancelled" with red gradient styling
6. THE Receipt_Template_Engine SHALL include platform branding and document subtitle in header

### Requirement 7: Receipt Metadata Table

**User Story:** As a customer, I want to see key transaction details at the top of the receipt, so that I can quickly identify the transaction

#### Acceptance Criteria

1. THE Receipt_Template_Engine SHALL render a metadata table containing receipt number, date, customer name, and customer email
2. THE Receipt_Template_Engine SHALL format the receipt number as "DB-{year}-{last6CharsOfId}"
3. THE Receipt_Template_Engine SHALL format date with day, month, year, and time in Australian timezone
4. WHEN booking context exists, THE Receipt_Template_Engine SHALL include booking start time and duration in metadata
5. THE Receipt_Template_Engine SHALL display all metadata in a styled information box

### Requirement 8: Supplier Information Display

**User Story:** As a customer, I want to see clear supplier identification for each section, so that I understand who provided each service

#### Acceptance Criteria

1. WHEN a section has supplier with ABN and rcti is false, THE Receipt_Template_Engine SHALL display "Supplier: {name}" and "ABN: {abn}"
2. WHEN a section has supplier with ABN and rcti is true, THE Receipt_Template_Engine SHALL display "Recipient Created Tax Invoice (RCTI)", "Issued by DriveBook on behalf of:", "Supplier: {name}", and "ABN: {abn}"
3. WHEN a section has supplier without ABN, THE Receipt_Template_Engine SHALL display "Supplier: {name}" only
4. WHEN a section has null supplier, THE Receipt_Template_Engine SHALL not display supplier information
5. THE Receipt_Template_Engine SHALL style RCTI supplier blocks with distinctive formatting

### Requirement 9: Line Items Table Rendering

**User Story:** As a customer, I want to see itemized charges in a clear table format, so that I understand what I paid for

#### Acceptance Criteria

1. THE Receipt_Template_Engine SHALL render line items as a two-column table with description and amount
2. WHEN a line item has quantity and rate, THE Receipt_Template_Engine SHALL format description as "{description} ({quantity} × ${rate})"
3. WHEN a line item has only description and amount, THE Receipt_Template_Engine SHALL display description as-is
4. THE Receipt_Template_Engine SHALL format all amounts as currency with two decimal places
5. THE Receipt_Template_Engine SHALL right-align amounts in the table

### Requirement 10: GST Summary Display

**User Story:** As a customer, I want to see GST information clearly stated, so that I understand the tax treatment

#### Acceptance Criteria

1. WHEN a section has showGST true and total GST is greater than zero, THE Receipt_Template_Engine SHALL display "GST included: ${gstAmount} (Goods & Services Tax)"
2. WHEN a section has showGST true and total GST is zero, THE Receipt_Template_Engine SHALL display "This supplier is not GST-registered. No GST applies."
3. WHEN a section has showGST false, THE Receipt_Template_Engine SHALL not display GST summary
4. THE Receipt_Template_Engine SHALL calculate total GST for a section by summing GST amounts of all line items in that section
5. THE Receipt_Template_Engine SHALL format GST amounts as currency with two decimal places

### Requirement 11: Wallet Balance Display

**User Story:** As a customer, I want to see my wallet balance changes, so that I understand my remaining credits

#### Acceptance Criteria

1. WHEN wallet context is provided, THE Receipt_Template_Engine SHALL render a wallet balance section
2. WHEN wallet context includes previousBalance, THE Receipt_Template_Engine SHALL display "Previous balance: ${previousBalance}"
3. WHEN wallet context includes credited amount, THE Receipt_Template_Engine SHALL display "Credits added: +${credited}" in green
4. WHEN wallet context includes debited amount, THE Receipt_Template_Engine SHALL display "Lesson debit: -${debited}" in red
5. THE Receipt_Template_Engine SHALL display "New balance: ${newBalance}" with emphasis
6. WHEN hourly rate is available, THE Receipt_Template_Engine SHALL display approximate hours remaining as "(approx. {hours} hrs)"
7. THE Receipt_Template_Engine SHALL calculate approximate hours as newBalance divided by hourlyRate

### Requirement 12: Payment Details Section

**User Story:** As a customer, I want to see payment method and reference information, so that I can reconcile with my bank statement

#### Acceptance Criteria

1. THE Receipt_Template_Engine SHALL render total amount charged from payment context
2. WHEN payment method is provided, THE Receipt_Template_Engine SHALL display "Payment method: {method}"
3. WHEN stripe reference is provided, THE Receipt_Template_Engine SHALL display reference in monospace font
4. WHEN total is zero and wallet was debited, THE Receipt_Template_Engine SHALL display "Charged to card: $0.00" and "Paid from wallet: ${walletDebited}"
5. THE Receipt_Template_Engine SHALL format all payment amounts as currency with two decimal places

### Requirement 13: Receipt Footer Links

**User Story:** As a customer, I want to access relevant actions from the receipt, so that I can manage my booking or account

#### Acceptance Criteria

1. THE Receipt_Template_Engine SHALL include footer links to support email, client dashboard, and login page
2. WHEN booking ID is provided, THE Receipt_Template_Engine SHALL include a "Manage booking" link with booking ID parameter
3. THE Receipt_Template_Engine SHALL display support email from environment variable ADMIN_EMAIL or default to support@drivebook.com.au
4. THE Receipt_Template_Engine SHALL include base URL from environment variable NEXTAUTH_URL or default to https://drivebook.com.au
5. THE Receipt_Template_Engine SHALL include note about automatic account creation for new customers

### Requirement 14: Cancellation Policy Display

**User Story:** As a customer, I want to see the cancellation policy on package and booking receipts, so that I understand refund rules

#### Acceptance Criteria

1. WHEN document type is MIXED_DOCUMENT or TAX_INVOICE with booking, THE Receipt_Template_Engine SHALL display cancellation policy
2. THE Receipt_Template_Engine SHALL display "48+ hours notice: full refund"
3. THE Receipt_Template_Engine SHALL display "24-48 hours notice: 50% refund"
4. THE Receipt_Template_Engine SHALL display "Under 24 hours: no refund"
5. THE Receipt_Template_Engine SHALL style cancellation policy in a yellow warning box

### Requirement 15: Email Integration

**User Story:** As the payment system, I want to send generated receipts via email, so that customers receive transaction confirmations

#### Acceptance Criteria

1. THE Receipt_Service SHALL provide a method to generate and send receipt emails
2. THE Receipt_Service SHALL set email from address as "DriveBook Payments <payments@drivebook.com.au>"
3. THE Receipt_Service SHALL set email to address from customer email in Tax_Document_Context
4. THE Receipt_Service SHALL generate email subject line containing receipt number and key transaction details
5. THE Receipt_Service SHALL use generated HTML as email body
6. THE Receipt_Service SHALL invoke email service with from, to, subject, and html parameters

### Requirement 16: Refund and Adjustment Receipts

**User Story:** As a customer, I want to receive clear receipts for cancellations and refunds, so that I understand what was refunded

#### Acceptance Criteria

1. WHEN document type is ADJUSTMENT_NOTE and refund amount is greater than zero, THE Receipt_Template_Engine SHALL display "Refund ({percent}%): +${amount}" in green
2. WHEN document type is ADJUSTMENT_NOTE and refund amount is zero, THE Receipt_Template_Engine SHALL display "Refund: None — {reason}" in red
3. THE Receipt_Template_Engine SHALL display who cancelled the booking: "You", "Your instructor", or "DriveBook support"
4. WHEN refund is credited to wallet, THE Receipt_Template_Engine SHALL display wallet balance section showing credited amount
5. THE Receipt_Template_Engine SHALL use red gradient header styling for cancellation receipts

### Requirement 17: Receipt Number Generation

**User Story:** As the system, I want to generate unique receipt numbers, so that each transaction can be identified and tracked

#### Acceptance Criteria

1. THE Receipt_Service SHALL generate receipt numbers using format "DB-{year}-{id}"
2. THE Receipt_Service SHALL extract year from current date
3. THE Receipt_Service SHALL extract last 6 characters from receiptId and convert to uppercase
4. THE Receipt_Service SHALL ensure receipt number is unique per transaction
5. THE Receipt_Service SHALL include receipt number in metadata table and footer

### Requirement 18: Context Validation

**User Story:** As the receipt system, I want to validate input context before processing, so that invalid data is rejected early

#### Acceptance Criteria

1. THE Receipt_Service SHALL validate that Tax_Document_Context contains required fields: documentType, receiptNumber, issuedDate, customer, items, and payment
2. WHEN documentType is RCTI or TAX_INVOICE, THE Receipt_Service SHALL validate that provider details are present
3. THE Receipt_Service SHALL validate that items array contains at least one line item
4. THE Receipt_Service SHALL validate that each line item contains description, type, amount, and supplier
5. THE Receipt_Service SHALL validate that customer contains name and email
6. WHEN validation fails, THE Receipt_Service SHALL throw an error with descriptive message

### Requirement 19: Package Purchase Receipt

**User Story:** As a customer who purchased a package, I want to receive a comprehensive receipt showing platform fee, first lesson booking, and wallet credit, so that I understand the transaction breakdown

#### Acceptance Criteria

1. WHEN generating a package purchase receipt, THE Receipt_Service SHALL create document type MIXED_DOCUMENT
2. THE Receipt_Service SHALL include a PLATFORM_FEE line item with platform fee amount as taxable
3. THE Receipt_Service SHALL include a SERVICE line item for the first lesson with provider as supplier
4. THE Receipt_Service SHALL include a FVV line item for wallet credit as non-taxable
5. THE Receipt_Service SHALL include booking context with first lesson details
6. THE Receipt_Service SHALL include wallet context showing credits loaded and first lesson debited
7. THE Receipt_Service SHALL display cancellation policy in the generated receipt

### Requirement 20: Wallet Lesson Booking Receipt

**User Story:** As a customer booking a lesson from wallet, I want to receive a receipt showing the lesson details and wallet deduction, so that I can track my credits

#### Acceptance Criteria

1. WHEN generating a wallet lesson receipt, THE Receipt_Service SHALL create document type TAX_INVOICE if the provider is GST-registered, otherwise PAYMENT_RECEIPT with supplier information shown
2. THE Receipt_Service SHALL include a SERVICE line item with lesson cost
3. THE Receipt_Service SHALL include booking context with lesson date, time, and location
4. THE Receipt_Service SHALL include wallet context showing balance before, debited amount, and balance after
5. THE Receipt_Service SHALL set payment total to zero
6. THE Receipt_Service SHALL display "Charged to card: $0.00" and "Paid from wallet: ${lessonCost}"
7. THE Receipt_Service SHALL display approximate hours remaining in wallet

### Requirement 21: Single Lesson Purchase Receipt

**User Story:** As a customer purchasing a single lesson, I want to receive a receipt showing the lesson details and charges, so that I understand what I paid

#### Acceptance Criteria

1. WHEN generating a single lesson receipt, THE Receipt_Service SHALL create document type TAX_INVOICE
2. THE Receipt_Service SHALL include a PLATFORM_FEE line item with platform fee amount
3. THE Receipt_Service SHALL include a SERVICE line item with lesson cost
4. THE Receipt_Service SHALL include booking context with lesson date, time, duration, and pickup address
5. THE Receipt_Service SHALL include payment details with stripe reference and payment method
6. THE Receipt_Service SHALL display an upsell message about package savings
7. THE Receipt_Service SHALL display cancellation policy in the generated receipt

### Requirement 22: Wallet Top-Up Receipt

**User Story:** As a customer adding credits to my wallet, I want to receive a receipt showing the top-up and new balance, so that I can confirm the transaction

#### Acceptance Criteria

1. WHEN generating a wallet top-up receipt, THE Receipt_Service SHALL create document type PAYMENT_RECEIPT
2. THE Receipt_Service SHALL include a FVV line item for the amount added
3. THE Receipt_Service SHALL include wallet context showing previous balance, amount added, and new balance
4. THE Receipt_Service SHALL include payment details with stripe reference and payment method
5. THE Receipt_Service SHALL display note that "GST (if any) applies when credits are redeemed for services"
6. THE Receipt_Service SHALL display note that "Credits never expire and can be used with any instructor on DriveBook"

### Requirement 23: Admin Credit Receipt

**User Story:** As a customer receiving admin credits, I want to receive a receipt showing the credit reason and new balance, so that I understand why credits were added

#### Acceptance Criteria

1. WHEN generating an admin credit receipt, THE Receipt_Service SHALL create document type PAYMENT_RECEIPT
2. THE Receipt_Service SHALL include a FVV line item for the credited amount
3. THE Receipt_Service SHALL display credit reason in line items table
4. THE Receipt_Service SHALL include wallet context showing previous balance, amount added, and new balance
5. THE Receipt_Service SHALL display "Issued by: DriveBook Support" in metadata
6. THE Receipt_Service SHALL set payment total to zero

### Requirement 24: Admin Deduction Receipt

**User Story:** As a customer with wallet deductions, I want to receive a receipt showing the deduction reason and new balance, so that I understand why credits were removed

#### Acceptance Criteria

1. WHEN generating an admin deduction receipt, THE Receipt_Service SHALL create document type ADJUSTMENT_NOTE
2. THE Receipt_Service SHALL use red gradient header with title "Wallet Adjustment"
3. THE Receipt_Service SHALL include transaction ID in metadata table
4. THE Receipt_Service SHALL display deduction reason in line items table
5. THE Receipt_Service SHALL include wallet context showing previous balance, deducted amount, and new balance
6. THE Receipt_Service SHALL display contact instructions with transaction ID for dispute

### Requirement 25: Receipt Styling

**User Story:** As a customer, I want receipts to be visually appealing and easy to read, so that I can quickly find information

#### Acceptance Criteria

1. THE Receipt_Template_Engine SHALL apply consistent CSS styles across all receipt types
2. THE Receipt_Template_Engine SHALL use blue gradient header for standard receipts
3. THE Receipt_Template_Engine SHALL use red gradient header for cancellation and deduction receipts
4. THE Receipt_Template_Engine SHALL style line items table with two columns and clear spacing
5. THE Receipt_Template_Engine SHALL use light blue background for wallet balance sections
6. THE Receipt_Template_Engine SHALL use green color for credit amounts and red color for debit amounts
7. THE Receipt_Template_Engine SHALL ensure receipt is responsive and readable in email clients

### Requirement 26: Migration from Legacy Functions

**User Story:** As a developer, I want to migrate from existing receipt functions to the unified system, so that all receipts use consistent logic

#### Acceptance Criteria

1. THE Receipt_Service SHALL provide adapter methods for existing receipt function signatures
2. WHEN sendPackagePurchaseReceipt is called, THE Receipt_Service SHALL transform parameters to Tax_Document_Context and call generateDocument
3. WHEN sendWalletLessonReceipt is called, THE Receipt_Service SHALL transform parameters to Tax_Document_Context and call generateDocument
4. WHEN sendSingleLessonReceipt is called, THE Receipt_Service SHALL transform parameters to Tax_Document_Context and call generateDocument
5. WHEN sendWalletTopUpReceipt is called, THE Receipt_Service SHALL transform parameters to Tax_Document_Context and call generateDocument
6. WHEN sendCancellationReceipt is called, THE Receipt_Service SHALL transform parameters to Tax_Document_Context and call generateDocument
7. WHEN sendAdminCreditReceipt is called, THE Receipt_Service SHALL transform parameters to Tax_Document_Context and call generateDocument
8. WHEN sendAdminDeductionReceipt is called, THE Receipt_Service SHALL transform parameters to Tax_Document_Context and call generateDocument

### Requirement 27: Total Calculation Verification

**User Story:** As the receipt system, I want to verify that line item totals match the payment total, so that receipts are mathematically correct

#### Acceptance Criteria

1. THE Receipt_Service SHALL calculate total by summing all line item amounts
2. THE Receipt_Service SHALL compare calculated total to payment total from context
3. WHEN calculated total does not match payment total within 0.01 tolerance, THE Receipt_Service SHALL log a warning
4. THE Receipt_Service SHALL include calculated totals in output for verification
5. THE Receipt_Service SHALL validate that GST calculations match expected amounts
