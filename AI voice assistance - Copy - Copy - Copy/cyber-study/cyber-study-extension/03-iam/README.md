# 03 — Identity & Access Management

## Objective
Develop deeper reasoning about authentication, authorization, sessions and privilege.

## Learning outcomes
- Separate authentication from authorization.
- Explain RBAC, ABAC and least privilege.
- Analyze sessions, cookies, tokens and invalidation.
- Understand MFA, recovery and service identities.
- Explain OAuth 2.0/OIDC at a practical level.
- Identify BOLA/IDOR and privilege-escalation conditions.
- Map IAM controls to DriveBook.

## Sequence
1. AuthN vs AuthZ
2. Roles and permissions
3. Least privilege
4. Sessions and cookies
5. MFA and recovery
6. Service accounts/secrets
7. OAuth/OIDC/SSO
8. Authorization testing
9. DriveBook permission model

## Security rule
Never test authorization against another real user's data. Use synthetic accounts in an isolated/staging environment.