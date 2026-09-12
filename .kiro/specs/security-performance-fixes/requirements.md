# Requirements Document

## Introduction

This document specifies the requirements for addressing critical security vulnerabilities and performance bottlenecks identified in the verified audit report. The scope covers five critical and high-severity issues that pose immediate risks to data security, financial accuracy, system stability, and application performance.

## Glossary

- **System**: The DriveBook instructor dashboard application (Next.js/React/Prisma stack)
- **Credentials_Manager**: The environment variable and secrets management subsystem
- **Database_Schema**: The Prisma schema defining all database models and field types
- **Error_Handler**: The React error boundary system that catches and handles component errors
- **Earnings_API**: The API endpoint at `/api/instructor/earnings` that retrieves transaction history
- **Wallet_Service**: The service layer responsible for calculating client wallet balances
- **Financial_Field**: Any database field storing monetary amounts (prices, fees, balances, transaction amounts)
- **Pagination_System**: The mechanism for loading data in discrete pages with cursor or offset-based navigation
- **Error_Boundary**: A React component that catches JavaScript errors in child component trees
- **Aggregate_Query**: A database query that performs calculations (sum, count, average) without loading individual records
- **Decimal_Type**: A precise numeric data type for financial calculations (Prisma Decimal / PostgreSQL NUMERIC)
- **Float_Type**: An imprecise floating-point data type unsuitable for financial calculations
- **Production_Credential**: Any secret key, password, token, or API key used for accessing external services or databases
- **Transaction_Record**: A database record in the Transaction model representing a financial transaction
- **Instructor**: A user with provider role who teaches driving lessons and earns money through the platform
- **Client**: A learner user who books lessons and may have a wallet for prepayment

## Requirements

### Requirement 1: Credential Security

**User Story:** As a platform administrator, I want all production credentials removed from version control and properly secured, so that unauthorized access to sensitive services is prevented.

#### Acceptance Criteria

1.1. WHEN the System starts, THE Credentials_Manager SHALL load all secrets from environment variables only, not from committed files

1.2. THE Credentials_Manager SHALL NOT contain any production credentials in files tracked by version control

1.3. WHERE the `.env` file exists in the repository, THE System SHALL prevent commits of this file through Git ignore rules

1.4. WHEN a new deployment environment is created, THE Credentials_Manager SHALL require explicit configuration of all required environment variables

1.5. THE System SHALL provide an example file (`.env.example`) that documents required environment variable names without containing actual credential values

1.6. WHEN the application detects missing required credentials, THE System SHALL fail to start and display clear error messages indicating which credentials are missing

### Requirement 2: Financial Data Precision

**User Story:** As a platform administrator, I want all financial amounts stored with exact precision, so that monetary calculations are accurate and compliant with accounting standards.

#### Acceptance Criteria

2.1. THE Database_Schema SHALL use Decimal_Type for all Financial_Fields

2.2. WHEN a Financial_Field is defined in the schema, THE Database_Schema SHALL specify precision and scale (minimum 10 digits precision, 2 decimal places)

2.3. THE Database_Schema SHALL NOT use Float_Type for any Financial_Field

2.4. WHEN performing financial calculations, THE System SHALL use decimal arithmetic libraries that maintain precision

2.5. THE Database_Schema SHALL apply Decimal_Type to the following models and fields:
   - Booking: price, platformFee, providerPayout
   - Transaction: amount, platformFee, providerPayout
   - ClientWallet: balance
   - WalletTransaction: amount
   - Package: price
   - PDATestBooking: price
   - Refund: amount
   - JournalEntry: amount
   - Quote: amount
   - Service: price

2.6. WHEN migrating from Float_Type to Decimal_Type, THE System SHALL preserve all existing financial data values without loss of precision

### Requirement 3: Error Resilience

**User Story:** As an instructor using the dashboard, I want component errors to be gracefully handled, so that one failing component doesn't crash the entire page.

#### Acceptance Criteria

3.1. THE Error_Handler SHALL catch all JavaScript errors that occur in React component trees

3.2. WHEN a component error occurs, THE Error_Handler SHALL display a user-friendly error message instead of a blank page or React stack trace

3.3. WHEN a component error occurs, THE Error_Handler SHALL log the error details including component stack trace for debugging purposes

3.4. THE Error_Handler SHALL provide a recovery mechanism (page refresh button or retry action) in the error UI

3.5. WHERE critical dashboard sections exist (navigation, main content, sidebar), THE System SHALL wrap each section in a separate Error_Boundary

3.6. WHEN an Error_Boundary catches an error, THE System SHALL allow other Error_Boundaries and their child components to continue functioning normally

3.7. THE Error_Handler SHALL integrate with error tracking services (when configured) to report errors with full context

3.8. WHEN a component recovers from an error state, THE Error_Handler SHALL reset the error boundary state and re-render the component tree

### Requirement 4: Earnings API Performance

**User Story:** As an instructor with extensive transaction history, I want my earnings page to load quickly, so that I can access my financial information without delays.

#### Acceptance Criteria

4.1. THE Earnings_API SHALL implement Pagination_System to limit records returned per request

4.2. WHEN a client requests earnings data without pagination parameters, THE Earnings_API SHALL default to returning the first page with a reasonable page size (20-50 records)

4.3. WHEN a client requests earnings data with pagination parameters, THE Earnings_API SHALL return only the requested page of results

4.4. THE Earnings_API SHALL accept pagination parameters including page number (or cursor) and page size

4.5. WHEN returning paginated results, THE Earnings_API SHALL include pagination metadata: current page, page size, total record count, total pages, and whether more pages exist

4.6. THE Earnings_API SHALL enforce a maximum page size limit (50 records) to prevent excessive data loading

4.7. WHEN the Earnings_API queries Transaction_Records, THE System SHALL use database-level pagination (LIMIT and OFFSET or cursor-based) rather than loading all records into memory

4.8. THE Earnings_API SHALL maintain existing sorting behavior (newest transactions first) across paginated requests

4.9. WHEN an Instructor has zero transactions, THE Earnings_API SHALL return an empty result set with valid pagination metadata indicating zero total records

### Requirement 5: Wallet Balance Efficiency

**User Story:** As a client booking a lesson, I want my wallet balance to be calculated efficiently, so that booking operations complete quickly even with extensive transaction history.

#### Acceptance Criteria

5.1. WHEN calculating a wallet balance, THE Wallet_Service SHALL use Aggregate_Query to compute totals rather than loading all transaction records into memory

5.2. THE Wallet_Service SHALL execute separate aggregation queries for credit transactions and debit transactions

5.3. WHEN calculating wallet balance, THE Wallet_Service SHALL filter transactions by CONFIRMED status only

5.4. THE Wallet_Service SHALL compute balance as: (sum of CREDIT amounts) minus (sum of DEBIT amounts)

5.5. WHEN a wallet has zero transactions, THE Wallet_Service SHALL return zero balance without executing unnecessary database queries

5.6. THE Wallet_Service SHALL NOT use Prisma `include` or `select` to load transaction records when only aggregate totals are needed

5.7. WHEN the aggregate query returns null (no matching transactions), THE Wallet_Service SHALL treat the result as zero

5.8. THE Wallet_Service SHALL complete balance calculation in constant time regardless of the number of historical transactions

5.9. WHEN a wallet balance is requested, THE Wallet_Service SHALL return a response containing: totalPaid, totalSpent, and balance fields
