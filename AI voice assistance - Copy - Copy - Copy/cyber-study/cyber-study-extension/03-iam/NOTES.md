# Notes — IAM

## AuthN vs AuthZ
Authentication establishes identity. Authorization determines whether an identified principal may perform a requested action on a particular resource.

## RBAC and ABAC
RBAC grants permissions through roles. ABAC evaluates attributes such as user, resource, action or context. Both require server-side enforcement.

## Least privilege
Grant only the access required for the task, for the minimum useful scope and duration.

## Sessions and tokens
Security depends on issuance, storage, expiry, rotation/invalidation and server-side validation. A token's presence does not by itself prove authorization to a specific object.

## BOLA/IDOR
An endpoint can be vulnerable when a user can manipulate an object identifier and access an object without a server-side ownership/permission check.

## DriveBook mapping
Study NextAuth/session behavior, permissionEngine/usePermissions/PermissionGate, role boundaries, wallet ownership and admin permissions. The application must enforce authorization server-side; UI controls are not a security boundary.