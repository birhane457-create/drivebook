# Requirements Document

## Introduction

This specification defines security hardening requirements for the Stripe webhook endpoint (`/api/stripe/webhook`) to prevent unauthorized access, replay attacks, and financial fraud. The current implementation has signature verification, rate limiting, and idempotency protection, but requires enhancement to address additional attack vectors including timestamp validation, origin verification, event type validation, and comprehensive monitoring.

## Glossary

- **Webhook_Handler**: The Next.js API route (`/api/stripe/webhook/route.ts`) that receives and processes Stripe webhook events
- **Signature_Verifier**: The cryptographic validation component that verifies webhook authenticity using Stripe signatures
- **Idempotency_Guard**: The database-backed mechanism that prevents duplicate processing of the same webhook event
- **Rate_Limiter**: The component that restricts webhook processing frequency per event ID
- **Event_Processor**: The routing logic that directs webhook events to appropriate handler functions
- **Audit_Logger**: The system that records webhook processing attempts and outcomes for security analysis
- **Alert_Service**: The notification system that reports security violations and anomalies
- **Stripe_API**: The external Stripe service that sends webhook notifications
- **Webhook_Secret**: The cryptographic key stored in `STRIPE_WEBHOOK_SECRET` environment variable used to validate signatures
- **Replay_Attack**: An attack where a captured valid webhook is resent to trigger duplicate processing
- **Timestamp_Tolerance**: The maximum age in seconds that a webhook event timestamp can have before rejection

## Requirements

### Requirement 1: Webhook Signature Verification

**User Story:** As a platform operator, I want all incoming webhooks cryptographically verified, so that unauthorized requests cannot manipulate financial data

#### Acceptance Criteria

1. THE Webhook_Handler SHALL verify the Stripe signature before processing any webhook event
2. WHEN the `stripe-signature` header is missing, THE Signature_Verifier SHALL reject the request with HTTP 400 status
3. WHEN the `STRIPE_WEBHOOK_SECRET` environment variable is not configured, THE Signature_Verifier SHALL reject all webhook requests with HTTP 500 status
4. WHEN signature verification fails, THE Signature_Verifier SHALL reject the request with HTTP 400 status and log the failed verification attempt
5. THE Signature_Verifier SHALL use `stripe.webhooks.constructEvent()` to perform cryptographic validation
6. WHEN signature verification fails, THE Audit_Logger SHALL record the failure with IP address and timestamp

### Requirement 2: Timestamp Validation Against Replay Attacks

**User Story:** As a security engineer, I want old webhook events rejected, so that captured webhooks cannot be replayed to cause duplicate transactions

#### Acceptance Criteria

1. THE Webhook_Handler SHALL extract the timestamp from the webhook event object
2. WHEN a webhook event timestamp is older than the Timestamp_Tolerance, THE Webhook_Handler SHALL reject the event with HTTP 400 status
3. THE Timestamp_Tolerance SHALL be configurable via `STRIPE_WEBHOOK_TIMESTAMP_TOLERANCE` environment variable with default value of 300 seconds
4. WHEN a webhook is rejected due to expired timestamp, THE Audit_Logger SHALL record the rejection with event age and event ID
5. THE Webhook_Handler SHALL validate timestamp after signature verification but before rate limiting

### Requirement 3: Request Origin Verification

**User Story:** As a security engineer, I want webhook requests validated by origin, so that requests from unauthorized sources are blocked

#### Acceptance Criteria

1. WHEN the environment is production, THE Webhook_Handler SHALL validate that requests originate from Stripe IP ranges
2. THE Webhook_Handler SHALL extract the client IP from `x-forwarded-for` header or connection remote address
3. WHEN IP validation is enabled and the client IP is not in Stripe's published IP ranges, THE Webhook_Handler SHALL reject the request with HTTP 403 status
4. THE Webhook_Handler SHALL support IP allowlist override via `STRIPE_WEBHOOK_ALLOWED_IPS` environment variable for testing environments
5. WHEN an IP is rejected, THE Audit_Logger SHALL record the rejected IP address and event type
6. WHERE IP validation is enabled, THE Webhook_Handler SHALL refresh Stripe IP ranges from Stripe API at startup and every 24 hours

### Requirement 4: Event Type Allowlist Validation

**User Story:** As a platform operator, I want only expected webhook event types processed, so that malicious actors cannot exploit unhandled event types

#### Acceptance Criteria

1. THE Webhook_Handler SHALL maintain an allowlist of expected Stripe event types
2. WHEN a webhook event type is not in the allowlist, THE Webhook_Handler SHALL reject the event with HTTP 400 status
3. THE Event_Processor SHALL include these event types in the allowlist: `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.trial_will_end`, `invoice.payment_succeeded`, `invoice.payment_failed`, `account.updated`, `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`, `charge.refunded`, `transfer.failed`
4. WHEN an event type is rejected, THE Audit_Logger SHALL record the rejected event type and event ID
5. THE Webhook_Handler SHALL allow configuration of additional event types via `STRIPE_WEBHOOK_ALLOWED_EVENTS` environment variable

### Requirement 5: Enhanced Idempotency Protection

**User Story:** As a financial engineer, I want duplicate webhooks prevented at the database level, so that concurrent webhook deliveries cannot cause double-processing

#### Acceptance Criteria

1. THE Idempotency_Guard SHALL generate idempotency keys using format `{event.type}_{event.id}_{event.created}`
2. THE Idempotency_Guard SHALL check for existing webhook events before processing using `webhookEvent.findUnique()`
3. WHEN the idempotency check database query fails, THE Webhook_Handler SHALL return HTTP 500 status to trigger Stripe retry
4. THE Webhook_Handler SHALL record webhook events atomically within the same transaction as financial operations
5. WHEN a duplicate webhook is detected, THE Webhook_Handler SHALL return HTTP 200 with `{received: true, duplicate: true}` response
6. THE Idempotency_Guard SHALL use database unique constraint on `idempotencyKey` column to prevent race conditions
7. WHEN concurrent webhook deliveries create idempotency race condition, THE Webhook_Handler SHALL catch `DuplicateWebhookEventError` and return success response

### Requirement 6: Rate Limiting Per Event

**User Story:** As a platform operator, I want webhook processing rate-limited per event ID, so that webhook floods cannot overload the system

#### Acceptance Criteria

1. THE Rate_Limiter SHALL apply rate limiting using event ID as the rate limit key with format `stripe_webhook_{event.id}`
2. WHEN rate limit is exceeded, THE Webhook_Handler SHALL return HTTP 429 status with rate limit headers
3. THE Rate_Limiter SHALL use `checkRateLimitStrict()` function with `webhookRateLimit` configuration
4. THE Rate_Limiter SHALL perform rate limit check after signature verification but before idempotency check
5. WHEN rate limit is exceeded, THE Audit_Logger SHALL record the rate limit violation with event ID

### Requirement 7: Metadata Validation for Financial Operations

**User Story:** As a financial engineer, I want payment amounts validated against expected values, so that amount tampering attacks are prevented

#### Acceptance Criteria

1. WHEN processing wallet credit checkout events, THE Webhook_Handler SHALL validate that `amount_total` matches `metadata.expectedTotal`
2. WHEN processing wallet payment intents, THE Webhook_Handler SHALL validate that `amount_received` matches the sum of pending wallet transactions
3. WHEN amount validation fails, THE Webhook_Handler SHALL reject the webhook with HTTP 500 status and throw an error
4. WHEN amount mismatch is detected, THE Audit_Logger SHALL record the expected amount, received amount, and event ID
5. THE Webhook_Handler SHALL require `metadata.expectedTotal` to be present, finite, and non-negative for wallet credit events
6. WHEN `metadata.expectedTotal` is missing or invalid, THE Webhook_Handler SHALL throw an error and prevent wallet crediting

### Requirement 8: Payment Method Security Validation

**User Story:** As a fraud prevention specialist, I want prepaid cards and failed 3DS transactions blocked, so that high-risk payment methods cannot be used for wallet credits

#### Acceptance Criteria

1. WHEN `metadata.require_3ds_validation` is `true`, THE Webhook_Handler SHALL retrieve the PaymentIntent with expanded charges and payment method details
2. THE Webhook_Handler SHALL check if the payment method funding type is `prepaid`
3. THE Webhook_Handler SHALL check if 3D Secure authentication result is `failed`
4. WHEN the card is prepaid OR 3DS authentication failed, THE Webhook_Handler SHALL create a refund via Stripe API
5. WHEN payment is blocked, THE Webhook_Handler SHALL send notification email to customer explaining the reason
6. WHEN payment is blocked, THE Webhook_Handler SHALL NOT credit the wallet
7. WHEN 3DS validation throws an error, THE Alert_Service SHALL send a critical alert for manual review

### Requirement 9: Comprehensive Security Audit Logging

**User Story:** As a security analyst, I want all webhook security events logged, so that attack patterns can be identified and investigated

#### Acceptance Criteria

1. THE Audit_Logger SHALL log signature verification failures with IP address, timestamp, and error message
2. THE Audit_Logger SHALL log timestamp validation failures with event age, event ID, and event type
3. THE Audit_Logger SHALL log origin verification failures with rejected IP address and event type
4. THE Audit_Logger SHALL log event type allowlist violations with rejected event type and event ID
5. THE Audit_Logger SHALL log amount validation failures with expected amount, received amount, event ID, and user ID
6. THE Audit_Logger SHALL log rate limit violations with event ID and timestamp
7. THE Audit_Logger SHALL log payment method blocks with card type, 3DS result, and customer identifier
8. THE Audit_Logger SHALL use `logSubscriptionAction()` with `AuditAction.WEBHOOK_VERIFICATION_FAILED` for security violations

### Requirement 10: Security Alert Integration

**User Story:** As a platform operator, I want critical webhook security violations to trigger alerts, so that security incidents receive immediate attention

#### Acceptance Criteria

1. WHEN signature verification fails three times from the same IP within 5 minutes, THE Alert_Service SHALL send a critical alert
2. WHEN timestamp validation detects an event older than 1 hour, THE Alert_Service SHALL send a warning alert
3. WHEN origin verification blocks an unauthorized IP, THE Alert_Service SHALL send a warning alert
4. WHEN amount validation detects a mismatch greater than 10%, THE Alert_Service SHALL send a critical alert
5. WHEN 3DS validation fails to execute, THE Alert_Service SHALL send a critical alert with payment details
6. THE Alert_Service SHALL include event ID, timestamp, violation type, and relevant metadata in all alerts
7. THE Alert_Service SHALL use `sendAlert()` function with appropriate severity levels (`CRITICAL` or `WARNING`)

### Requirement 11: Webhook Event Retention and Cleanup

**User Story:** As a platform operator, I want old webhook events cleaned up, so that the database does not grow unbounded

#### Acceptance Criteria

1. THE Webhook_Handler SHALL store webhook events in the `webhookEvent` table with idempotency key, event type, event ID, and metadata
2. THE Webhook_Handler SHALL record event processing timestamp in `processedAt` field
3. THE system SHALL provide a cleanup job that deletes webhook events older than 90 days
4. THE cleanup job SHALL run daily via cron schedule
5. THE cleanup job SHALL preserve webhook events associated with disputed charges or refunds
6. WHEN webhook events are deleted, THE Audit_Logger SHALL record the deletion count and date range

### Requirement 12: Error Handling and Stripe Retry Logic

**User Story:** As a platform operator, I want transient errors to trigger Stripe retries, so that temporary issues do not cause data loss

#### Acceptance Criteria

1. WHEN signature verification fails, THE Webhook_Handler SHALL return HTTP 400 status to prevent Stripe retry
2. WHEN timestamp validation fails, THE Webhook_Handler SHALL return HTTP 400 status to prevent Stripe retry
3. WHEN origin verification fails, THE Webhook_Handler SHALL return HTTP 403 status to prevent Stripe retry
4. WHEN event type allowlist validation fails, THE Webhook_Handler SHALL return HTTP 400 status to prevent Stripe retry
5. WHEN database operations fail, THE Webhook_Handler SHALL return HTTP 500 status to trigger Stripe retry
6. WHEN event handler throws an error, THE Webhook_Handler SHALL return HTTP 500 status to trigger Stripe retry
7. THE Webhook_Handler SHALL log all errors with sufficient context for debugging including event type, event ID, and error message

### Requirement 13: Testing and Validation Infrastructure

**User Story:** As a developer, I want webhook security features testable, so that security regressions are prevented

#### Acceptance Criteria

1. THE system SHALL provide test utilities for generating valid Stripe webhook signatures
2. THE system SHALL provide test utilities for generating expired timestamp webhooks
3. THE system SHALL provide test utilities for simulating webhooks from unauthorized IP addresses
4. THE system SHALL provide test utilities for generating webhooks with invalid event types
5. THE system SHALL provide test utilities for generating webhooks with amount mismatches
6. THE system SHALL support Stripe CLI webhook forwarding in development environments
7. THE system SHALL document security testing procedures in developer documentation

### Requirement 14: Configuration and Environment Management

**User Story:** As a DevOps engineer, I want webhook security configurable per environment, so that development and production have appropriate security levels

#### Acceptance Criteria

1. THE Webhook_Handler SHALL require `STRIPE_WEBHOOK_SECRET` environment variable in all environments
2. THE Webhook_Handler SHALL support `STRIPE_WEBHOOK_TIMESTAMP_TOLERANCE` with default 300 seconds
3. THE Webhook_Handler SHALL support `STRIPE_WEBHOOK_IP_VALIDATION_ENABLED` boolean flag with default `true` in production
4. THE Webhook_Handler SHALL support `STRIPE_WEBHOOK_ALLOWED_IPS` comma-separated list for test environments
5. THE Webhook_Handler SHALL support `STRIPE_WEBHOOK_ALLOWED_EVENTS` comma-separated list for allowlist extension
6. THE Webhook_Handler SHALL support `STRIPE_WEBHOOK_SECURITY_ALERTS_ENABLED` boolean flag with default `true`
7. THE system SHALL validate all required environment variables at application startup
8. WHEN required environment variables are missing, THE system SHALL log a fatal error and fail to start

### Requirement 15: Monitoring and Observability

**User Story:** As a site reliability engineer, I want webhook processing metrics available, so that performance and security issues are visible

#### Acceptance Criteria

1. THE Webhook_Handler SHALL emit metrics for webhook processing duration per event type
2. THE Webhook_Handler SHALL emit metrics for webhook success rate per event type
3. THE Webhook_Handler SHALL emit metrics for signature verification failures per hour
4. THE Webhook_Handler SHALL emit metrics for timestamp validation failures per hour
5. THE Webhook_Handler SHALL emit metrics for rate limit violations per hour
6. THE Webhook_Handler SHALL emit metrics for amount validation failures per hour
7. THE Webhook_Handler SHALL emit metrics for idempotency duplicate detections per hour
8. THE system SHALL provide dashboard visualization for webhook security metrics
