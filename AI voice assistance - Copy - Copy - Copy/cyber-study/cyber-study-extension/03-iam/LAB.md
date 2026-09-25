# Lab — IAM

## Synthetic accounts
Create:
- User A
- User B
- Admin/test operator

Use only non-production data.

## Tasks
1. Draw an AuthN/AuthZ request flow.
2. Map three DriveBook roles to permissions.
3. Test an authorized action for User A.
4. Test User A attempting to access User B's synthetic object.
5. Test a role without a required permission.
6. Test session expiry/invalidation behavior.
7. Document MFA and recovery threats without attacking a real account.
8. Review one service-to-service credential boundary.
9. Document one least-privilege improvement.

## Evidence requirement
For an authorization test, record request identity, resource owner, expected decision, HTTP result, server-side enforcement point and resulting data mutation. A denial test should also verify that no unauthorized state change occurred.