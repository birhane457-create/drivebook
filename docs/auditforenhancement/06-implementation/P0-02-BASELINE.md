# P0-02 BASELINE VERIFICATION — S-7 Middleware Defence-in-Depth

**Finding:** S-7 from Phase 4 audit  
**Severity:** MEDIUM  
**Issue:** Public `/api/auth` path too broad, could allow arbitrary routes under that prefix to bypass authentication

---

## ORIGINAL ISSUE (from Kiro Phase 4)

**Problem identified:** If public path matching used simple `startsWith('/api/auth')`, any developer-created route like `/api/auth/admin-secret` would:
1. Match public path check → allowed through
2. Skip protected API path check → no authentication required
3. Rely only on handler's `getServerSession()` call → edge protection bypassed

**Defence-in-depth gap:** Middleware should catch developer mistakes at the edge, not rely solely on individual route handlers.

---

## CURRENT STATE (audit/ai-enhancement-multimodel at 38ffd147)

**Implementation already applied:**

### 1. Protected paths checked BEFORE public short-circuit (lines 82-87)
```typescript
const isProtectedApiPath =
  url.pathname.startsWith('/api/admin/') ||
  url.pathname.startsWith('/api/instructor/') ||
  url.pathname.startsWith('/api/client/') ||
  url.pathname.startsWith('/api/bookings/')
```

### 2. Explicit NextAuth endpoint whitelist (lines 171-183)
```typescript
function isNextAuthPublicPath(pathname: string): boolean {
  if (pathname === '/api/auth') return true

  const match = pathname.match(/^\/api\/auth\/([^/]+)(?:\/.*)?$/)
  if (!match) return false

  const endpoint = match[1]
  return [
    'signin',
    'signout',
    'callback',
    'session',
    'csrf',
    'providers',
    'verify-request',
    'error',
  ].includes(endpoint)
}
```

### 3. Public path uses explicit whitelist (lines 141-162)
```typescript
export function isPublicMiddlewarePath(pathname: string): boolean {
  const publicPaths = [
    '/',
    '/login',
    '/register',
    // ... explicit paths
  ]

  const isPublicAuthPath = isNextAuthPublicPath(pathname)
  return (
    publicPaths.some(path => pathname === path || (path !== '/' && pathname.startsWith(`${path}/`))) ||
    isPublicAuthPath
  )
}
```

---

## VERIFICATION

### Attack vector 1: `/api/auth/admin-backdoor`
**Expected:** NOT public (doesn't match whitelist), requires authentication

**Logic:**
1. `isNextAuthPublicPath('/api/auth/admin-backdoor')` → `false` (endpoint 'admin-backdoor' not in whitelist)
2. `isPublicMiddlewarePath()` → `false`
3. `isProtectedApiPath` → `false` (doesn't start with `/api/admin/`)
4. Falls through to authentication check → **BLOCKED**

✅ **Correct behavior**

### Attack vector 2: `/api/admin/secret` (should be protected)
**Expected:** Requires authentication (protected API path)

**Logic:**
1. `isProtectedApiPath` → `true` (starts with `/api/admin/`)
2. `isPublicPath && !isProtectedApiPath` → `false` (protected override)
3. Falls through to authentication check → **BLOCKED**

✅ **Correct behavior**

### Legitimate NextAuth: `/api/auth/signin`
**Expected:** Public (in whitelist)

**Logic:**
1. `isNextAuthPublicPath('/api/auth/signin')` → `true` (endpoint 'signin' in whitelist)
2. `isPublicMiddlewarePath()` → `true`
3. `isProtectedApiPath` → `false`
4. Returns `NextResponse.next()` → **ALLOWED**

✅ **Correct behavior**

### Legitimate NextAuth: `/api/auth/callback/google`
**Expected:** Public (callback endpoint in whitelist)

**Logic:**
1. Regex match: `/^\/api\/auth\/([^/]+)(?:\/.*)?$/` extracts endpoint = 'callback'
2. 'callback' in whitelist → `true`
3. `isPublicMiddlewarePath()` → `true`
4. Returns `NextResponse.next()` → **ALLOWED**

✅ **Correct behavior**

---

## S-7 FIX STATUS

**Implementation:** ✅ COMPLETE (already applied on branch)  
**Fix approach:** Option A (narrow `/api/auth` to specific NextAuth endpoints)  
**Defence-in-depth:** ✅ RESTORED (protected paths checked before public short-circuit)  
**NextAuth compatibility:** ✅ VERIFIED (legitimate endpoints whitelisted)

**Remaining work:**
- [ ] Add automated regression test
- [ ] Run existing test suite
- [ ] Document commit SHA for GPT audit
- [ ] FIX-VERIFIED by GPT

---

**Baseline verified by:** Kiro  
**Date:** September 24, 2026  
**Branch:** audit/ai-enhancement-multimodel  
**Commit:** 38ffd147
