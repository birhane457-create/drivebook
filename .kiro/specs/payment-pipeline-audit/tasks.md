# Implementation Plan: Payment Pipeline Audit System

## Overview

This implementation plan converts the Payment Pipeline Audit System design into actionable TypeScript development tasks. The system will be built as a modular Next.js application with layered architecture, integrating with the existing Prisma database schema and Stripe API. Tasks are organized to deliver core security validation first, followed by fraud detection, remediation, and reporting capabilities.

## Tasks

- [ ] 1. Set up audit system foundation and database schema
  - Create database schema extensions for AuditFinding, AuditExecution, and RemediationLog models in Prisma schema
  - Set up base directory structure: `lib/audit/` with subdirectories for validators, analyzers, remediation, reporting, and repositories
  - Create TypeScript type definitions for core data models (AuditFinding, WalletBalance, RefundCalculation, etc.)
  - Install and configure fast-check for property-based testing
  - _Requirements: 1.1, 1.2, 10.1, 16.7_

- [ ] 2. Implement data access layer repositories
  - [ ] 2.1 Create WalletRepository with wallet and transaction aggregation queries
    - Implement methods for fetching wallet data with transaction summaries
    - Add aggregation queries for CREDIT and DEBIT transactions by status
    - Include optimized queries with proper indexing for performance
    - _Requirements: 1.1, 1.2, 1.3, 8.5_

  - [ ] 2.2 Create BookingRepository with package relationship handling
    - Implement booking queries with wallet transaction joins
    - Add package booking specific queries (packageHours, packageHoursRemaining)
    - Include cancellation and refund data fetching methods
    - _Requirements: 5.1, 5.3, 14.1, 14.2_

  - [ ] 2.3 Create StripeRepository for payment verification
    - Implement Stripe API integration for refund verification
    - Add webhook event retrieval methods
    - Include charge and refund aggregation for reconciliation
    - _Requirements: 4.1, 4.6, 9.1, 9.2_

  - [ ] 2.4 Create AuditLogRepository for audit trail persistence
    - Implement methods to create and query AuditFinding records
    - Add methods for AuditExecution and RemediationLog tracking
    - Include filtering by severity, type, and date range
    - _Requirements: 10.1, 10.2, 15.4_

- [ ] 3. Build core wallet integrity validator
  - [ ] 3.1 Implement wallet balance calculation logic
    - Create validateWalletIntegrity function that aggregates CONFIRMED transactions
    - Calculate balance as sum(CREDIT) - sum(DEBIT)
    - Return WalletBalance model with computed balance and drift metrics
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ]* 3.2 Write property test for wallet balance calculation
    - **Property 1: Wallet Balance Calculation Correctness**
    - **Validates: Requirements 1.1, 1.2, 1.3**

  - [ ] 3.3 Implement balance drift detection
    - Compare computed balance against recorded balance (if exists)
    - Flag wallets with drift exceeding $0.01 threshold
    - Create AuditFinding records with severity based on drift magnitude
    - _Requirements: 1.4, 1.5_

  - [ ]* 3.4 Write property test for balance drift detection
    - **Property 2: Balance Drift Detection**
    - **Validates: Requirements 1.4, 1.5**

  - [ ] 3.5 Implement transaction status validation
    - Validate transaction status is one of CONFIRMED, PENDING, or FAILED
    - Flag transactions with invalid status values
    - Verify wallet ownership linkage for all transactions
    - _Requirements: 1.6, 1.7, 8.5_

  - [ ]* 3.6 Write unit tests for wallet integrity validator
    - Test balance calculation with various transaction combinations
    - Test drift detection at threshold boundaries
    - Test invalid status detection
    - _Requirements: 1.1-1.7_

- [ ] 4. Build double-credit exploit detector
  - [ ] 4.1 Implement package refund validation logic
    - Create validatePackageRefund function for cancelled package bookings
    - Check for existence of Stripe refund (stripeRefundId)
    - Verify wallet DEBIT transaction exists for refund
    - Compare Stripe refund amount with wallet DEBIT amount
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ]* 4.2 Write property test for double-credit prevention
    - **Property 3: Double-Credit Prevention**
    - **Validates: Requirements 2.1, 2.2, 2.3**

  - [ ] 4.3 Implement double-credit exploit detection
    - Detect wallet CREDIT transactions when DEBIT expected for refunds
    - Flag missing Stripe refund with package cancellation
    - Flag missing wallet DEBIT with Stripe refund present
    - Create CRITICAL severity findings for exploit patterns
    - _Requirements: 2.4, 2.5, 2.6_

  - [ ]* 4.4 Write property test for double-credit exploit detection
    - **Property 4: Double-Credit Exploit Detection**
    - **Validates: Requirements 2.4**

  - [ ]* 4.5 Write unit tests for double-credit detector
    - Test exploit detection with CREDIT instead of DEBIT
    - Test incomplete refund scenarios
    - Test amount matching validation
    - _Requirements: 2.1-2.6_

- [ ] 5. Checkpoint - Verify core validators are working
  - Run all tests for wallet integrity and double-credit validation
  - Ensure all tests pass, ask the user if questions arise

- [ ] 6. Implement tier-aware refund calculator
  - [ ] 6.1 Create tier discount calculation logic
    - Implement discount tier determination based on hours_used (not original packageHours)
    - Apply tier rates: 0-5 hours = 0%, 6-9 = 5%, 10-14 = 10%, 15+ = 12%
    - Calculate amount for used hours with tier-based discount
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 6.2 Write property test for tier-aware refund tier selection
    - **Property 5: Tier-Aware Refund Tier Selection**
    - **Validates: Requirements 3.1, 3.6**

  - [ ] 6.3 Implement refund calculation formula
    - Calculate refundable base as packageTotalPaid - amountForUsedHours
    - Apply timing-based refund percentage (48hrs = 100%, 24-48hrs = 50%, <24hrs = 0%)
    - Handle admin override amounts when present
    - Calculate final refund amount and compare with actual
    - _Requirements: 3.7, 3.9_

  - [ ]* 6.4 Write property test for refund calculation formula
    - **Property 6: Refund Calculation Formula**
    - **Validates: Requirements 3.7**

  - [ ] 6.5 Implement refund error detection
    - Compare calculated refund with actual refund amount
    - Flag discrepancies exceeding $0.01 when no admin override exists
    - Create AuditFinding with calculation details in metadata
    - _Requirements: 3.8_

  - [ ]* 6.6 Write property test for refund error detection
    - **Property 7: Refund Error Detection**
    - **Validates: Requirements 3.8**

  - [ ]* 6.7 Write unit tests for tier-aware refund calculator
    - Test tier selection boundaries (5, 6, 9, 10, 14, 15 hours)
    - Test refund formula with different pricing scenarios
    - Test timing-based refund percentages
    - Test admin override handling
    - _Requirements: 3.1-3.9_

- [ ] 7. Build Stripe webhook integrity validator
  - [ ] 7.1 Implement webhook processing validation
    - Validate checkout.session.completed events have corresponding wallet CREDIT
    - Verify transaction amounts match (Stripe amount_total / 100)
    - Check timestamp proximity (within 60 seconds)
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ]* 7.2 Write property test for webhook amount matching
    - **Property 8: Webhook Amount Matching**
    - **Validates: Requirements 4.1, 4.2**

  - [ ]* 7.3 Write property test for webhook timing validation
    - **Property 9: Webhook Timing Validation**
    - **Validates: Requirements 4.3**

  - [ ] 7.4 Implement unprocessed webhook detection
    - Detect Stripe events without corresponding wallet transactions
    - Flag duplicate transactions for same Stripe session
    - Verify stripeRefundId linkage for refunds
    - _Requirements: 4.4, 4.5, 4.6_

  - [ ]* 7.5 Write unit tests for webhook validator
    - Test webhook-to-transaction matching
    - Test duplicate detection
    - Test unprocessed event flagging
    - _Requirements: 4.1-4.6_

- [ ] 8. Implement booking payment status validator
  - [ ] 8.1 Create payment status consistency checks
    - Validate CONFIRMED bookings have isPaid = true
    - Validate PENDING_PAYMENT bookings have isPaid = false
    - Verify wallet DEBIT exists for paid bookings
    - Check DEBIT amount matches booking price
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ]* 8.2 Write property test for booking payment status consistency
    - **Property 10: Booking Payment Status Consistency**
    - **Validates: Requirements 5.1, 5.2**

  - [ ]* 8.3 Write property test for paid booking transaction linkage
    - **Property 11: Paid Booking Transaction Linkage**
    - **Validates: Requirements 5.3, 5.4**

  - [ ] 8.4 Implement package booking validation
    - Verify isPackageBooking flag consistency
    - Check required package fields are populated
    - Validate package metadata completeness
    - _Requirements: 5.6, 5.7_

  - [ ]* 8.5 Write unit tests for booking payment validator
    - Test status consistency checks
    - Test unpaid but confirmed detection
    - Test package metadata validation
    - _Requirements: 5.1-5.7_

- [ ] 9. Build payout transaction validator
  - [ ] 9.1 Implement payout calculation verification
    - Validate providerPayout = price - platformFee
    - Verify platformFee = price × commissionRate / 100
    - Check calculation accuracy within $0.01
    - _Requirements: 6.1, 6.2_

  - [ ]* 9.2 Write property test for payout calculation validation
    - **Property 12: Payout Calculation Validation**
    - **Validates: Requirements 6.1, 6.2**

  - [ ] 9.3 Implement payout status and linkage validation
    - Verify COMPLETED bookings have corresponding Transaction records
    - Validate WITHHELD payouts have documented reasons
    - Check no-show dispute data completeness
    - Verify PAID payouts have required fields populated
    - _Requirements: 6.3, 6.4, 6.5, 6.6, 6.7_

  - [ ]* 9.4 Write unit tests for payout validator
    - Test payout calculation verification
    - Test withheld payout validation
    - Test paid payout field checks
    - _Requirements: 6.1-6.7_

- [ ] 10. Checkpoint - Verify all core validators complete
  - Run full test suite for all validators
  - Verify integration with repositories
  - Ensure all tests pass, ask the user if questions arise

- [ ] 11. Implement cancellation workflow validator
  - [ ] 11.1 Create workflow enforcement checks
    - Validate cancellation status progression (PENDING → APPROVED/REJECTED)
    - Verify required fields at each status (timestamps, admin details)
    - Check admin review notes for rejections
    - Flag bypassed approval workflows
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ]* 11.2 Write property test for cancellation workflow enforcement
    - **Property 13: Cancellation Workflow Enforcement**
    - **Validates: Requirements 7.4**

  - [ ] 11.3 Implement cancellation timing validation
    - Calculate hours between cancellation request and booking date
    - Verify refund percentage matches timing policy
    - Validate admin overrides for <24 hour cancellations
    - _Requirements: 7.5, 7.6, 7.7, 7.8_

  - [ ]* 11.4 Write unit tests for cancellation workflow validator
    - Test workflow progression validation
    - Test timing-based refund verification
    - Test bypass detection
    - _Requirements: 7.1-7.8_

- [ ] 12. Build orphan transaction detector
  - [ ] 12.1 Implement transaction linkage validation
    - Validate wallet transactions with "Booking" description have valid bookingId
    - Verify Transaction records reference existing bookings
    - Check wallet ownership references are valid
    - Verify Stripe linkage (stripeRefundId) references exist
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [ ]* 12.2 Write property test for transaction referential integrity
    - **Property 14: Transaction Referential Integrity**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4**

  - [ ]* 12.3 Write unit tests for orphan detector
    - Test orphaned wallet transaction detection
    - Test orphaned ledger entry detection
    - Test Stripe linkage validation
    - _Requirements: 8.1-8.6_

- [ ] 13. Implement fraud detection engine
  - [ ] 13.1 Create excessive cancellations detector
    - Count package cancellations per user in 30-day window
    - Flag users exceeding 3 cancellations threshold
    - Create FraudPattern findings with appropriate severity
    - _Requirements: 11.1_

  - [ ] 13.2 Create high-value transaction monitor
    - Detect wallet credits exceeding $5000 in 24 hours
    - Flag for manual review
    - _Requirements: 11.2_

  - [ ] 13.3 Create no-show pattern detector
    - Count no-show disputes per instructor in 30-day window
    - Flag instructors exceeding 5 disputes
    - _Requirements: 11.3_

  - [ ] 13.4 Implement admin override abuse detector
    - Flag admin overrides exceeding 50% of calculated refund
    - _Requirements: 11.4_

  - [ ]* 13.5 Write property test for admin override threshold
    - **Property 16: Admin Override Threshold**
    - **Validates: Requirements 11.4**

  - [ ] 13.6 Create automated booking abuse detector
    - Detect >20 bookings from single account in 24 hours
    - Flag potential automated abuse
    - _Requirements: 11.5_

  - [ ] 13.7 Implement balance manipulation detector
    - Detect CREDIT/DEBIT pairs with same amount within 60 seconds
    - Flag potential manipulation attempts
    - _Requirements: 11.6_

  - [ ]* 13.8 Write property test for balance manipulation detection
    - **Property 17: Balance Manipulation Detection**
    - **Validates: Requirements 11.6**

  - [ ] 13.9 Create duplicate submission detector
    - Identify bookings with identical metadata except timestamp
    - Flag potential duplicate submission attacks
    - _Requirements: 11.7_

  - [ ]* 13.10 Write unit tests for fraud detection engine
    - Test all pattern detection thresholds
    - Test severity assignment logic
    - Test evidence capture
    - _Requirements: 11.1-11.7_

- [ ] 14. Build financial reconciliation engine
  - [ ] 14.1 Implement Stripe aggregation queries
    - Calculate total charges for period
    - Calculate total refunds for period
    - Compute net revenue
    - _Requirements: 9.1, 9.2_

  - [ ] 14.2 Implement wallet aggregation queries
    - Calculate total credits for period
    - Calculate total debits for period
    - Compute net movement
    - _Requirements: 9.3, 9.4_

  - [ ] 14.3 Implement payout aggregation queries
    - Calculate total instructor payouts for period
    - Calculate total platform fees for period
    - _Requirements: 9.5, 9.6_

  - [ ] 14.4 Create reconciliation variance calculations
    - Compare Stripe charges vs wallet credits
    - Compare payout totals vs wallet debits
    - Flag variances exceeding $1.00 threshold
    - _Requirements: 9.7, 9.8, 9.9_

  - [ ]* 14.5 Write property test for reconciliation wallet consistency
    - **Property 15: Reconciliation Wallet Consistency**
    - **Validates: Requirements 9.5, 9.6, 9.8**

  - [ ]* 14.6 Write unit tests for reconciliation engine
    - Test aggregation calculations
    - Test variance detection at threshold
    - Test period filtering
    - _Requirements: 9.1-9.9_

- [ ] 15. Checkpoint - Verify fraud detection and reconciliation
  - Run tests for fraud detection and reconciliation engines
  - Test with sample data patterns
  - Ensure all tests pass, ask the user if questions arise

- [ ] 16. Implement package integrity validator
  - [ ] 16.1 Create package state consistency checks
    - Validate packageHoursRemaining ≤ packageHours
    - Validate packageHoursRemaining ≥ 0
    - Verify completed lesson count matches hours calculation
    - Flag inconsistent states (0 remaining but not COMPLETED/CANCELLED)
    - _Requirements: 14.1, 14.2, 14.3, 14.4_

  - [ ]* 16.2 Write property test for package hours constraints
    - **Property 19: Package Hours Constraints**
    - **Validates: Requirements 14.1, 14.2**

  - [ ] 16.3 Implement package pricing validation
    - Verify pricing calculation: hours × rate × (1 - discount/100) ≈ total
    - Check sum of individual bookings matches package total
    - Flag inconsistent package metadata
    - _Requirements: 14.5, 14.6, 14.7_

  - [ ]* 16.4 Write unit tests for package integrity validator
    - Test hours constraint validation
    - Test pricing verification
    - Test metadata consistency
    - _Requirements: 14.1-14.7_

- [ ] 17. Build dispute resolution tracker
  - [ ] 17.1 Implement dispute data validation
    - Verify required fields for no-show disputes
    - Validate noShowParty values
    - Check resolution action consistency
    - _Requirements: 13.1, 13.2_

  - [ ] 17.2 Create resolution action validators
    - Verify refund_client creates wallet CREDIT
    - Verify approve_for_payout changes status from WITHHELD
    - Verify charge_instructor creates deduction record
    - Validate split resolution calculations
    - _Requirements: 13.3, 13.4, 13.5, 13.6_

  - [ ]* 17.3 Write property test for split dispute calculation
    - **Property 18: Split Dispute Calculation**
    - **Validates: Requirements 13.7**

  - [ ] 17.4 Verify audit trail for dispute resolutions
    - Check AuditLog entries exist for financial movements
    - _Requirements: 13.8_

  - [ ]* 17.5 Write unit tests for dispute tracker
    - Test all resolution action validations
    - Test split calculation verification
    - Test audit trail checks
    - _Requirements: 13.1-13.8_

- [ ] 18. Implement manual payout validator
  - [ ] 18.1 Create manual payout field validation
    - Verify required fields are populated (payoutRef, provider, amounts)
    - Validate netAmount = grossAmount - taxWithheld
    - Check status-dependent field requirements
    - _Requirements: 17.1, 17.2, 17.3_

  - [ ]* 18.2 Write property test for manual payout net calculation
    - **Property 20: Manual Payout Net Calculation**
    - **Validates: Requirements 17.2**

  - [ ] 18.3 Implement sent/confirmed validation
    - Verify bankReference when marked as sent
    - Check sentAt timestamp proximity to current time
    - Validate status progression to PAID
    - Flag overdue transfers (>7 days)
    - _Requirements: 17.4, 17.5, 17.6, 17.8_

  - [ ] 18.4 Verify payout transaction totals
    - Validate sum of transactions equals grossAmount
    - _Requirements: 17.7_

  - [ ]* 18.5 Write unit tests for manual payout validator
    - Test field validation
    - Test calculation verification
    - Test overdue detection
    - _Requirements: 17.1-17.8_

- [ ] 19. Build audit trail validator
  - [ ] 19.1 Implement audit log completeness checks
    - Verify AuditLog entry exists for financial operations
    - Validate required fields (action, actor, target, metadata)
    - Check metadata contains transaction IDs and amounts
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [ ] 19.2 Create operation-specific audit validators
    - Verify cancellation audit trail (REQUESTED, APPROVED/REJECTED)
    - Verify payout audit trail (creation, sent, confirmed)
    - Flag incomplete audit trails
    - _Requirements: 10.6, 10.7, 10.8_

  - [ ]* 19.3 Write unit tests for audit trail validator
    - Test completeness checking
    - Test operation-specific validation
    - Test missing trail detection
    - _Requirements: 10.1-10.8_

- [ ] 20. Checkpoint - Verify all validators are complete
  - Run full test suite for all validators
  - Verify all properties and unit tests pass
  - Ensure all tests pass, ask the user if questions arise

- [ ] 21. Implement automated remediation engine
  - [ ] 21.1 Create balance drift remediation strategy
    - Auto-fix drifts < $0.10 with corrective transaction
    - Verify fix resolves issue after creation
    - Escalate larger drifts to manual review
    - _Requirements: 15.1, 15.5, 15.6_

  - [ ] 21.2 Create orphan transaction remediation strategy
    - Infer bookingId from timestamp and amount when unique match
    - Update transaction with correct linkage
    - Escalate ambiguous cases
    - _Requirements: 15.2_

  - [ ] 21.3 Create booking status remediation strategy
    - Update isPaid flag when wallet DEBIT exists
    - Verify correction resolves finding
    - _Requirements: 15.3_

  - [ ] 21.4 Implement remediation logging
    - Create AuditLog entries for all remediation actions
    - Include "AUDIT_CORRECTION" marker in descriptions
    - _Requirements: 15.4, 15.7_

  - [ ]* 21.5 Write unit tests for remediation engine
    - Test each remediation strategy
    - Test escalation logic
    - Test audit logging
    - _Requirements: 15.1-15.7_

- [ ] 22. Build alert management system
  - [ ] 22.1 Create alert severity classification
    - Implement severity assignment based on finding type and magnitude
    - Define CRITICAL thresholds (double-credit, large drift, reconciliation variance)
    - Define WARNING thresholds (orphans, stale payouts)
    - _Requirements: 12.2, 12.3, 12.4, 12.5_

  - [ ] 22.2 Implement alert delivery system
    - Create email alert channel integration
    - Send CRITICAL alerts within 60 seconds
    - Batch non-critical alerts (max 1 per 15 minutes)
    - Include relevant IDs and amounts in alert messages
    - _Requirements: 12.1, 12.6, 12.7, 12.8, 16.6_

  - [ ]* 22.3 Write unit tests for alert manager
    - Test severity classification
    - Test delivery timing
    - Test batching logic
    - _Requirements: 12.1-12.8_

- [ ] 23. Create API endpoints for real-time audits
  - [ ] 23.1 Implement POST /api/audit/wallet/[walletId]
    - Execute wallet integrity validation
    - Return WalletBalance and findings
    - _Requirements: 1.1-1.7, 16.1_

  - [ ] 23.2 Implement POST /api/audit/booking/[bookingId]
    - Execute refund validation and booking checks
    - Return RefundCalculation and findings
    - _Requirements: 3.1-3.9, 5.1-5.7, 16.1_

  - [ ] 23.3 Implement POST /api/audit/fraud/[userId]
    - Execute fraud detection patterns
    - Return FraudPattern array and findings
    - _Requirements: 11.1-11.7, 16.3_

  - [ ]* 23.4 Write integration tests for real-time audit endpoints
    - Test each endpoint with sample data
    - Verify response formats
    - Test error handling
    - _Requirements: 16.1, 16.3_

- [ ] 24. Create API endpoints for batch audits
  - [ ] 24.1 Implement POST /api/audit/full
    - Accept validator types and auto-remediate flag
    - Create AuditExecution tracking record
    - Process wallets in batches of 100
    - Return execution ID and summary
    - _Requirements: 16.2, 16.5_

  - [ ] 24.2 Implement POST /api/audit/reconciliation
    - Accept date range parameters
    - Generate ReconciliationReport
    - Return comprehensive reconciliation data
    - _Requirements: 9.1-9.9, 16.2_

  - [ ]* 24.3 Write integration tests for batch audit endpoints
    - Test full audit execution
    - Test reconciliation report generation
    - Verify batch processing logic
    - _Requirements: 16.2, 16.5_

- [ ] 25. Create reporting and dashboard endpoints
  - [ ] 25.1 Implement GET /api/audit/dashboard
    - Accept filter parameters (severity, status, date range)
    - Return filtered findings with summary statistics
    - _Requirements: 18.1-18.6_

  - [ ] 25.2 Implement GET /api/audit/report
    - Accept date range parameters
    - Generate comprehensive audit report with all categories
    - Include reconciliation variance and remediation counts
    - _Requirements: 18.1-18.8, 16.7_

  - [ ]* 25.3 Write integration tests for reporting endpoints
    - Test dashboard filtering
    - Test report generation
    - Verify summary calculations
    - _Requirements: 18.1-18.8_

- [ ] 26. Implement scheduled audit job
  - [ ] 26.1 Create daily full audit cron job script
    - Set up cron schedule for 02:00 (low-traffic period)
    - Execute full audit with all validators
    - Process all wallets in batches
    - _Requirements: 16.4, 16.5_

  - [ ] 26.2 Implement daily report generation and emailing
    - Generate comprehensive audit report
    - Store report with retention policy (365 days)
    - Send summary email to admin/finance team
    - _Requirements: 16.7, 18.8_

  - [ ]* 26.3 Write tests for scheduled job execution
    - Test job execution flow
    - Test report generation and storage
    - Mock email delivery
    - _Requirements: 16.4, 16.7_

- [ ] 27. Add performance optimizations
  - [ ] 27.1 Create database indexes
    - Add index on WalletTransaction (walletId, status, type)
    - Add index on AuditFinding (findingType, severity)
    - Add index on AuditFinding (resourceType, resourceId)
    - Add index on AuditFinding (detectedAt)
    - _Requirements: 16.1, 16.2_

  - [ ] 27.2 Implement query result caching
    - Add 5-minute cache for Stripe refund lookups
    - Cache wallet balance calculations for repeated audits
    - _Requirements: 16.1, 16.2_

  - [ ]* 27.3 Write performance benchmark tests
    - Verify single wallet audit completes < 5 seconds
    - Verify fraud detection completes < 2 seconds
    - Test batch processing efficiency
    - _Requirements: 16.1, 16.2, 16.3_

- [ ] 28. Implement error handling and retry logic
  - [ ] 28.1 Create validator retry wrapper
    - Implement exponential backoff (1s, 2s, 3s)
    - Handle transient errors (network, database)
    - Propagate ValidationError immediately
    - Max 3 retry attempts
    - _Requirements: 15.6_

  - [ ] 28.2 Add comprehensive error logging
    - Log all validation errors with context
    - Log remediation failures
    - Log alert delivery failures
    - _Requirements: 15.6_

  - [ ]* 28.3 Write tests for error handling
    - Test retry logic
    - Test error propagation
    - Test logging coverage
    - _Requirements: 15.6_

- [ ] 29. Final checkpoint - Integration testing
  - Run full end-to-end tests with realistic data
  - Test scheduled job execution
  - Verify alert delivery
  - Test remediation actions on real scenarios
  - Ensure all tests pass, ask the user if questions arise

- [ ] 30. Production deployment preparation
  - [ ] 30.1 Configure environment variables
    - Set up Stripe API keys
    - Configure email service credentials
    - Set alert notification channels
    - _Requirements: 12.1_

  - [ ] 30.2 Set up monitoring and observability
    - Configure structured JSON logging
    - Set up metrics collection (execution time, findings count)
    - Create dashboard for audit status visualization
    - _Requirements: 16.1, 16.2, 16.3_

  - [ ] 30.3 Configure data retention policies
    - Set 90-day retention for AuditFinding records
    - Set 365-day retention for audit reports
    - _Requirements: 16.7, 18.8_

  - [ ]* 30.4 Write deployment verification tests
    - Test production configuration
    - Verify database schema migrations
    - Test scheduled job triggers
    - _Requirements: 16.4_

## Notes

- Tasks marked with `*` are optional testing tasks and can be skipped for faster MVP
- All property-based tests use fast-check library with 100 test runs minimum
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation before moving to next phase
- Core security validators (wallet integrity, double-credit, refund calculation) are prioritized in early tasks
- Batch processing uses 100 concurrent operations for optimal performance
- Database indexes should be created before production deployment
- Alert system requires email service configuration (Nodemailer or Resend)
- Scheduled jobs use node-cron or similar for execution
- All monetary calculations maintain $0.01 precision threshold
- Property tests validate universal correctness properties from design
- Unit tests validate specific examples, thresholds, and edge cases

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3", "2.4"] },
    { "id": 2, "tasks": ["3.1", "3.3", "3.5"] },
    { "id": 3, "tasks": ["3.2", "3.4", "3.6", "4.1", "4.3"] },
    { "id": 4, "tasks": ["4.2", "4.4", "4.5"] },
    { "id": 5, "tasks": ["6.1", "6.3", "6.5"] },
    { "id": 6, "tasks": ["6.2", "6.4", "6.6", "6.7"] },
    { "id": 7, "tasks": ["7.1", "7.4"] },
    { "id": 8, "tasks": ["7.2", "7.3", "7.5", "8.1", "8.4"] },
    { "id": 9, "tasks": ["8.2", "8.3", "8.5", "9.1", "9.3"] },
    { "id": 10, "tasks": ["9.2", "9.4"] },
    { "id": 11, "tasks": ["11.1", "11.3"] },
    { "id": 12, "tasks": ["11.2", "11.4", "12.1"] },
    { "id": 13, "tasks": ["12.2", "12.3", "13.1", "13.2", "13.3", "13.4", "13.6", "13.7", "13.9"] },
    { "id": 14, "tasks": ["13.5", "13.8", "13.10"] },
    { "id": 15, "tasks": ["14.1", "14.2", "14.3", "14.4"] },
    { "id": 16, "tasks": ["14.5", "14.6"] },
    { "id": 17, "tasks": ["16.1", "16.3"] },
    { "id": 18, "tasks": ["16.2", "16.4", "17.1", "17.2", "17.4"] },
    { "id": 19, "tasks": ["17.3", "17.5", "18.1", "18.3", "18.4"] },
    { "id": 20, "tasks": ["18.2", "18.5", "19.1", "19.2"] },
    { "id": 21, "tasks": ["19.3"] },
    { "id": 22, "tasks": ["21.1", "21.2", "21.3", "21.4"] },
    { "id": 23, "tasks": ["21.5", "22.1", "22.2"] },
    { "id": 24, "tasks": ["22.3", "23.1", "23.2", "23.3"] },
    { "id": 25, "tasks": ["23.4", "24.1", "24.2"] },
    { "id": 26, "tasks": ["24.3", "25.1", "25.2"] },
    { "id": 27, "tasks": ["25.3", "26.1", "26.2"] },
    { "id": 28, "tasks": ["26.3", "27.1", "27.2"] },
    { "id": 29, "tasks": ["27.3", "28.1", "28.2"] },
    { "id": 30, "tasks": ["28.3"] },
    { "id": 31, "tasks": ["30.1", "30.2", "30.3"] },
    { "id": 32, "tasks": ["30.4"] }
  ]
}
```
