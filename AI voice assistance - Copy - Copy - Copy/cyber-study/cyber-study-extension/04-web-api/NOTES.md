# Notes — Advanced Web/API

## Authorization
Every sensitive server operation should determine whether the authenticated principal is allowed to perform the requested action on the target resource.

## Race conditions
A race can occur when two concurrent operations both pass a check before either commits the state change. Atomic database constraints and transactions can reduce this class of failure.

## Business logic
Security failures can arise even when individual endpoints are technically valid. Analyze complete state transitions and assumptions.

## SSRF
SSRF occurs when an application makes attacker-influenced outbound requests. Defenses include strict destination controls, network egress restrictions and careful URL parsing.

## Webhooks
A secure webhook design should authenticate the sender, validate the exact event, prevent unsafe replay, enforce idempotency and constrain state transitions.

## Payment mapping
Study DriveBook PaymentIntent creation, Stripe webhook processing, wallet ownership, immutable ledger behavior and payout destination ownership. Treat payment state as security-sensitive business logic.