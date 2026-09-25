# 05 — Threat Modelling

## Objective
Turn application architecture into explicit security assumptions, threats and controls.

## Learning outcomes
- Identify assets, actors and trust boundaries.
- Draw data-flow diagrams.
- Define attack surfaces and abuse cases.
- Apply STRIDE as a structured threat-identification method.
- Build a threat register.
- Connect threats to controls and verification.
- Model the DriveBook booking/payment/wallet/payout chain.

## Sequence
1. Assets and actors
2. Trust boundaries
3. Data-flow diagrams
4. Attack surface
5. Abuse cases
6. STRIDE
7. Threat register
8. Control selection
9. Verification planning
10. Review and oral defence

## Core DriveBook flow

Learner → booking → payment → webhook → wallet/ledger → payout

Add authentication, authorization, external services, database and admin boundaries to the model.