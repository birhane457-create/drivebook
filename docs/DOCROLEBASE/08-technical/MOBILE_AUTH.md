# Mobile Authentication (JWT)

**Status:** ✅ AS IS (Implementation exists) | ⏳ AS IT SHOULD BE (Enhancements recommended)

**File:** `app/api/auth/mobile-login/route.ts`  
**Route:** `POST /api/auth/mobile-login`

---

## 🔵 AS IS (Current Implementation)

### Overview

Mobile apps authenticate via JWT tokens instead of NextAuth sessions. The endpoint generates a 30-day JWT token that mobile clients include in subsequent requests.

### Authentication Flow

**1. Mobile Login Request**

```bash
POST /api/auth/mobile-login
Content-Type: application/json

{
  "email": "instructor@example.com",
  "password": "secure_password"
}
```

**2. Server Response (Success)**

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_123",
    "email": "instructor@example.com",
    "role": "INSTRUCTOR",
    "name": "John Smith",
    "instructor": {
      "id": "instr_456",
      "name": "John Smith",
      "phone": "+61412345678",
      "profileImage": "https://..."
    }
  }
}
```

**Status Code:** 200 OK

**3. Server Response (Failure)**

```json
{
  "error": "Invalid email or password"
}
```

**Status Code:** 401 Unauthorized

### Token Details

**JWT Payload:**
```json
{
  "userId": "user_123",
  "email": "instructor@example.com",
  "role": "INSTRUCTOR",
  "instructorId": "instr_456"
}
```

**Token Signing:**
- Algorithm: HS256 (HMAC SHA-256)
- Secret: `NEXTAUTH_SECRET` environment variable
- Expiry: 30 days (`expiresIn: '30d'`)

### Using the Token

**Mobile clients include token in Authorization header:**

```bash
GET /api/instructor/earnings/this-week
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

**API endpoints verify token:**
- Extract token from `Authorization: Bearer <token>` header
- Verify signature using `NEXTAUTH_SECRET`
- Check expiry
- Use decoded payload for user context

### Error Handling

| Error | HTTP Status | Reason |
|-------|-------------|--------|
| Missing email/password | 400 | Required fields not provided |
| User not found | 401 | Email doesn't exist in system |
| Invalid password | 401 | Password doesn't match |
| OAuth-only account | 401 | User registered via Google/GitHub (no password) |
| Server error | 500 | JWT signing failed or database error |

### Security Features

- ✅ Password hashed with bcrypt before storage
- ✅ Password verified with bcrypt.compare (constant-time)
- ✅ JWT signed with server secret
- ✅ 30-day expiry prevents indefinite access
- ✅ OAuth-only accounts rejected (no password set)
- ✅ Error messages generic (don't reveal if email exists)

---

## 🟡 AS IT SHOULD BE (Recommendations)

### Current Limitations

**1. No Token Refresh**
- Tokens expire after 30 days with no refresh mechanism
- Users must re-login after 30 days
- **Recommendation:** Implement refresh token pattern

**2. No Token Revocation**
- Logged-out tokens remain valid until expiry
- **Recommendation:** Add token blacklist or server-side session tracking

**3. Single Secret for All Tokens**
- Uses `NEXTAUTH_SECRET` for both web sessions and mobile JWT
- **Recommendation:** Separate JWT signing key

**4. No Rate Limiting on Login**
- Endpoint vulnerable to brute force attacks
- **Recommendation:** Add rate limiting per IP/email

**5. No Token Rotation**
- Same token used for entire 30-day period
- **Recommendation:** Rotate tokens periodically

### Recommended Implementation

**Enhanced Authentication Flow:**

```typescript
// 1. Login returns both access and refresh tokens
{
  "success": true,
  "accessToken": "...",        // 15-minute expiry
  "refreshToken": "...",        // 30-day expiry
  "expiresIn": 900,             // seconds
  "tokenType": "Bearer",
  "user": { ... }
}

// 2. Mobile client stores refresh token securely
// 3. When access token expires, call refresh endpoint
POST /api/auth/mobile-refresh
{
  "refreshToken": "..."
}

// 4. Server returns new access token
// 5. Old refresh token invalidated (one-time use)
```

**New Endpoints Needed:**

- `POST /api/auth/mobile-refresh` — Refresh access token
- `POST /api/auth/mobile-logout` — Invalidate refresh token
- `POST /api/auth/mobile-verify` — Verify token validity

**Database Changes:**

- `RefreshToken` table (tracking issued refresh tokens)
- `TokenBlacklist` table (tracking revoked tokens)
- Token issued/revoked timestamps

### Token Refresh Pattern

**Advantages:**
- Short-lived access tokens reduce compromise exposure
- Long-lived refresh tokens provide convenience
- Refresh token rotation prevents reuse attacks
- Server can revoke tokens instantly via blacklist

**Implementation in Mobile Client:**

```typescript
// Intercept all API calls
async function apiCall(endpoint: string, options: RequestInit) {
  let token = getStoredAccessToken();
  
  // Try request with current token
  let response = await fetch(endpoint, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });

  // If 401 (token expired), refresh and retry
  if (response.status === 401) {
    token = await refreshAccessToken();
    response = await fetch(endpoint, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    });
  }

  return response;
}
```

### Security Best Practices

**Mobile Client Storage:**
- ❌ Don't store tokens in localStorage (vulnerable to XSS)
- ❌ Don't store tokens in SharedPreferences (can be read if device compromised)
- ✅ Store in Secure Enclave (iOS) / Keystore (Android)
- ✅ Use HttpOnly cookies where possible (not applicable for mobile apps)

**Token Lifecycle:**
- Access tokens: 15-60 minutes
- Refresh tokens: 7-30 days
- Both should expire regardless of usage (no "sliding window")

**HTTP Headers:**
- `Authorization: Bearer <token>` for API requests
- Remove token from logs and error messages
- Use HTTPS only (token exposed in plaintext on HTTP)

---

## 🔧 Implementation Checklist

**Priority 1 (Critical):**
- [ ] Add refresh token endpoint
- [ ] Implement token rotation
- [ ] Add rate limiting to login endpoint
- [ ] Add logout endpoint (token blacklist)

**Priority 2 (Important):**
- [ ] Separate JWT signing key from `NEXTAUTH_SECRET`
- [ ] Add token expiry to user interface (show when re-login needed)
- [ ] Implement client-side token refresh logic
- [ ] Add monitoring for token-related errors

**Priority 3 (Nice to Have):**
- [ ] Multi-device token management (revoke specific devices)
- [ ] Audit log for token generation/revocation
- [ ] Support for OAuth mobile login (Apple/Google sign-in)
- [ ] Biometric authentication support

---

## 📊 Comparison: Current vs Recommended

| Aspect | Current | Recommended |
|--------|---------|-------------|
| **Token Lifespan** | 30 days | 15 min (access) + 30 days (refresh) |
| **Logout Support** | ❌ No | ✅ Yes (token blacklist) |
| **Token Revocation** | ❌ No | ✅ Yes (server-side) |
| **Rate Limiting** | ❌ No | ✅ Yes (per IP/email) |
| **Token Rotation** | ❌ No | ✅ Yes (per refresh) |
| **Refresh Mechanism** | ❌ No | ✅ Yes (refresh token) |
| **Multi-Device Tracking** | ❌ No | ✅ Yes (optional) |

---

## 📚 Related Documentation

- [WEBHOOKS.md](./WEBHOOKS.md) — Stripe webhook authentication (uses same NEXTAUTH_SECRET)
- `06-payments/STRIPE.md` — Stripe token handling
- Security guidelines in SECURITY_ASSESSMENT.md

---

## Summary

**Current State (AS IS):**
- ✅ Basic JWT authentication working
- ✅ 30-day token expiry
- ✅ Password-hashed securely
- ✅ Role-based token payload
- ❌ No refresh mechanism
- ❌ No logout/revocation
- ❌ No rate limiting

**Recommended (AS IT SHOULD BE):**
- ✅ Add refresh token pattern
- ✅ Implement token blacklist
- ✅ Add rate limiting
- ✅ Separate JWT signing key
- ✅ Add logout endpoint
- ✅ Client-side token rotation

**Effort to Implement:** 8-12 hours (3-4 backend endpoints + client-side integration)

**Security Impact:** High (critical for production mobile apps)

**User Impact:** None (backwards compatible until old tokens expire)
