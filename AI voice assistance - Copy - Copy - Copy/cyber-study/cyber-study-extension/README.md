# DriveBook Cybersecurity Study Extension

**Branch:** `feature/cyber-study-extension`  
**Purpose:** Self-directed cybersecurity extension work anchored to the DriveBook codebase.

## Boundary

This folder is a **study and evidence workspace**, not production application code.

The existing formal study material for the 22603VIC Certificate IV in Cyber Security remains separate. This extension covers deeper skills identified during the gap audit. It does **not** represent an accredited qualification or replace RTO assessment.

## Learning model

`LEARN → UNDERSTAND → LAB → APPLY → FIND → FIX → TEST → DOCUMENT → DEFEND`

A topic is not considered complete merely because notes exist. Practical evidence and explanation are required.

## Priority sequence

1. Operating systems and host security
2. Networking and traffic analysis
3. Identity and access management
4. Advanced web/API security
5. Threat modelling
6. Incident response and security operations
7. Vulnerability management
8. Cryptography and PKI
9. Cloud security
10. DevSecOps and software supply chain
11. Digital forensics
12. Security architecture and resilience

## DriveBook anchors

Study work may reference existing DriveBook systems including:

- authentication and sessions
- authorization and permissions
- booking lifecycle
- payment intents and Stripe webhooks
- wallet ownership and ledger controls
- instructor onboarding
- payout security
- Admin Copilot / AI-assisted operations
- audit logging
- Vercel, Railway, Supabase/PostgreSQL and external service integrations

**Security rule:** CODE IS AUTHORITATIVE. AI INTERPRETS AND ASSISTS.

## Evidence states

`PLANNED → LEARNING → LAB → EVIDENCE-READY → VERIFIED → REVIEW → COMPLETE`

Do not convert documentation into evidence of implementation. Do not treat a test harness as a verified result, or unit tests as production proof.

## Safety

All offensive exercises must use systems owned by the learner or explicitly authorized for testing. No uncontrolled production penetration testing.

## Handover rule

Another team should be able to enter this folder and immediately determine:

- what this work is
- why it exists
- what has been covered
- what remains
- what evidence exists
- which DriveBook components were used
- which branch contains the work
- what is study-only versus production-relevant
