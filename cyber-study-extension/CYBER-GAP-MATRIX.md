# Cybersecurity Extension Gap Matrix

**Branch:** `feature/cyber-study-extension`  
**Scope:** Post-baseline, self-directed extension of the existing DriveBook cybersecurity study.

## Status legend

| Status | Meaning |
|---|---|
| COVERED | Existing study material provides the required foundation |
| PARTIAL | Foundation exists but practical/deeper capability is missing |
| GAP | Material needs to be developed |
| EXTENSION | Deliberately beyond the formal Cert IV baseline |

## Matrix

| Domain | Current state | Extension focus | DriveBook anchor |
|---|---|---|---|
| Operating systems | GAP | Linux/Windows administration, permissions, processes, services, logs, Bash, PowerShell | Vercel/Railway/application runtime |
| Networking | PARTIAL | ARP, DHCP, NAT, routing, subnetting, VLANs, sockets, Wireshark, DNS/HTTP analysis, IDS/IPS | API, database and external-service traffic |
| IAM | PARTIAL | AuthN/AuthZ, RBAC/ABAC, least privilege, sessions, MFA, service accounts, secrets, OAuth/OIDC | NextAuth, permissions, Admin access |
| Web/API security | PARTIAL | BOLA/IDOR, privilege escalation, races, business logic, SSRF, uploads, path traversal, CORS/CSP, webhook security | Booking, wallet, payments, admin APIs |
| Threat modelling | PARTIAL | Assets, actors, trust boundaries, DFDs, STRIDE, abuse cases, attack trees | Booking → payment → webhook → wallet → payout |
| Incident response | GAP | Detection, triage, containment, eradication, recovery, evidence, timelines | Compromised admin / payment scenario |
| Security operations | GAP | SIEM concepts, telemetry, detections, IOC/IOA, alert triage, correlation | PostgreSQL/application AuditLog |
| Vulnerability management | GAP | CVE/CWE/CVSS, asset criticality, remediation, compensating controls, verification | Dependency and application findings |
| Cryptography/PKI | PARTIAL | Entropy, key lifecycle, signatures, HMAC, AEAD, certificates, TLS, KDFs | Auth tokens, webhooks, secrets |
| Cloud security | PARTIAL | IAM, network controls, storage, secrets, logging, workload isolation, serverless, containers | Vercel, Railway, Supabase |
| DevSecOps | GAP | SAST, dependency/secret scanning, security tests, DAST, CI/CD controls, supply chain | GitHub → build → deploy |
| Digital forensics | GAP | Evidence handling, logs, auth records, network evidence, timelines, IOCs | Security incidents and audit records |
| Security architecture | GAP | Defense in depth, Zero Trust concepts, segmentation, secure APIs, resilience, DR/backups | End-to-end DriveBook architecture |

## Required evidence gate

For each significant topic, record:

1. Concept understood
2. Safe practical lab completed
3. DriveBook mapping identified
4. Test or observation performed
5. Finding or design decision documented
6. Control or remediation documented
7. Verification performed
8. Evidence location recorded
9. Oral defence prepared

## Priority

### P0 — foundational gaps

- Operating systems
- Networking
- IAM
- Advanced web/API security
- Threat modelling

### P1 — operational capability

- Incident response
- Security operations
- Vulnerability management
- Cryptography/PKI
- Cloud security

### P2 — engineering/audit depth

- DevSecOps
- Digital forensics
- Security architecture and resilience

## Important separation

This matrix is a **learning roadmap**, not a certification assessment record. Formal qualification requirements must be confirmed with the relevant RTO and current training package/qualification documentation.
