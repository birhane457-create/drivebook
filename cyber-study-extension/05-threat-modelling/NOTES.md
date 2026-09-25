# Notes — Threat Modelling

## Assets
Examples include account identity, booking data, payment state, wallet balance, payout destination, audit records, secrets and AI operational data.

## Actors
Consider learners, instructors, administrators, service identities and external providers. Do not assume an authenticated actor is trusted for every action.

## Trust boundaries
A trust boundary exists where assumptions about identity, integrity or control change. Examples include browser/API, application/database, application/Stripe and application/AI-provider boundaries.

## STRIDE
STRIDE provides categories for systematic threat identification: spoofing, tampering, repudiation, information disclosure, denial of service and elevation of privilege.

## Threat register
A useful register connects threat → affected asset → precondition → control → verification → residual risk.

## DriveBook principle
Model complete state transitions rather than isolated endpoints. Payment, wallet and payout controls must preserve ownership and integrity across the entire chain.