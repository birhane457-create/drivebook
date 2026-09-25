# Weeks 15–22 — Elective Units

## Choosing your 8 electives

Your provider will offer a selection. Choose based on what's most relevant to DriveBook
and what you're weakest on from self-assessment.

**Recommended electives for a SaaS founder:**

| Priority | Unit | Why it matters for DriveBook |
|----------|------|------------------------------|
| ⭐⭐⭐ | Cloud security | Your entire stack is cloud-hosted (Vercel, Railway, Supabase, Cloudinary) |
| ⭐⭐⭐ | Authentication systems | You built auth — deepen it with MFA, OAuth, SAML |
| ⭐⭐⭐ | Encryption | Understand TLS internals, at-rest encryption, key management |
| ⭐⭐ | Security perimeter | Firewalls, WAF, network segmentation |
| ⭐⭐ | VPN technologies | Understand what protects service-to-service communication |
| ⭐⭐ | Server hardening | Applying CIS benchmarks to Linux servers |
| ⭐ | Wireless security | Less relevant for a web app |
| ⭐ | Digital forensics | Useful but lower priority than prevention |

---

## Cloud Security (most important for you)

### Cloud Responsibility Model
Who is responsible for securing what:

```
┌──────────────────────────────────────────────────────┐
│                    YOUR responsibility                │
│  Application code, data, user access, API keys       │
├──────────────────────────────────────────────────────┤
│                   SHARED responsibility               │
│  OS config, database encryption settings             │
├──────────────────────────────────────────────────────┤
│                  PROVIDER responsibility              │
│  Physical servers, network hardware, hypervisor      │
└──────────────────────────────────────────────────────┘
```

For DriveBook specifically:
- **Vercel** owns: physical infrastructure, TLS certificates, DDoS protection
- **You own**: your API routes, session security, secrets management, access controls
- **Supabase**: handles DB encryption at rest — you handle connection security and RLS

### Row Level Security (RLS) in Supabase
Even though DriveBook uses Prisma (which bypasses RLS), you should understand:
- RLS lets you define policies so database rows are only accessible to the right user
- Without RLS, a leaked DB connection string gives full access to all data
- With RLS + service role separation, even a leak only exposes what that role can see

### Secrets Management Best Practices
All your secrets are in `.env` — fine for development. Production concerns:
- `.env` is never committed to git (verified by `.gitignore`)
- Vercel encrypts env vars at rest
- Railway encrypts env vars at rest
- Rotate secrets periodically — especially after a staff departure
- Use least-privilege: each service gets only the secrets it needs

---

## Encryption

### Symmetric vs Asymmetric

| | Symmetric | Asymmetric |
|-|-----------|------------|
| Keys | One shared key | Public key + private key |
| Speed | Fast | Slower |
| Use case | Encrypting data at rest | Key exchange, digital signatures, TLS |
| Examples | AES-256, ChaCha20 | RSA-2048, ECDSA, Ed25519 |

### TLS (Transport Layer Security) — what happens on HTTPS
1. Client → Server: "ClientHello" (supported TLS versions, cipher suites)
2. Server → Client: "ServerHello" + certificate (public key)
3. Client verifies certificate against trusted CA
4. Client generates session key, encrypts it with server's public key, sends it
5. Server decrypts session key with its private key
6. Both now share a symmetric session key — all further traffic is encrypted with AES

**Why this matters for DriveBook:**
Vercel handles TLS termination. Your app code only sees plaintext HTTP internally.
But you must ensure `HTTPS=true` in production settings and your cookies are `Secure`.

### Hashing vs Encryption

| | Hashing | Encryption |
|-|---------|-----------|
| Reversible | No | Yes (with key) |
| Use case | Password storage, integrity | Data confidentiality |
| Examples | SHA-256, bcrypt | AES, RSA |

DriveBook uses **bcrypt** for passwords — a hashing function with built-in salt and work factor.
Never store passwords encrypted — always hash them.

---

## Authentication Deep Dive

### OAuth 2.0 Flow (for reference)
DriveBook uses credential auth (username/password), not OAuth.
But understanding OAuth matters because your instructors may want "Sign in with Google."

```
User → clicks "Sign in with Google"
App → redirects to Google with client_id, scope, redirect_uri
User → authenticates with Google
Google → redirects back with authorisation code
App → exchanges code for access token (server-side, secret included)
App → uses access token to call Google APIs or get user info
```

### JWT Structure
Your session tokens are JWTs. Structure:
```
header.payload.signature

header:  { "alg": "HS256", "typ": "JWT" }
payload: { "sub": "user123", "role": "INSTRUCTOR", "iat": 1234567890, "exp": 1234654290 }
signature: HMAC-SHA256(base64(header) + "." + base64(payload), secret)
```

The signature binds the header and payload to the secret.
If an attacker modifies the payload (e.g., changes role to ADMIN), the signature becomes invalid.
NextAuth verifies the signature on every request using `NEXTAUTH_SECRET`.

### MFA Types
| Type | How it works | Security level |
|------|--------------|----------------|
| SMS OTP | 6-digit code via SMS | Medium (SIM swap attack risk) |
| TOTP | Time-based code from app (Google Authenticator) | High |
| Hardware key | Physical device (YubiKey) | Very high |
| Biometric | Fingerprint, face | High (device-dependent) |

For DriveBook, adding TOTP (Google Authenticator) for instructor accounts would be
the highest-impact security improvement for lowest cost. Instructors control bank accounts
and access to student personal data — they're the highest-value target.

---

## Security Perimeter

### Defence in Depth
Multiple security layers so if one fails, others remain:

```
Internet
    │
Vercel DDoS protection + CDN
    │
HTTPS (TLS encryption)
    │
Rate limiting (Upstash Redis)
    │
Authentication (NextAuth JWT)
    │
Authorisation (role checks in each route)
    │
Input validation (Zod schemas)
    │
Parameterised queries (Prisma ORM)
    │
Database (Supabase, encrypted at rest)
```

Each layer is independent. Bypassing one layer doesn't automatically bypass the next.
This is the correct security architecture for a web application.

---

## Study Tips for Electives

1. **Cloud security** — read the AWS Well-Architected Security Pillar (free, excellent)
2. **Encryption** — TryHackMe "Cryptography" room (interactive, free tier)
3. **Authentication** — auth0.com/docs has outstanding explanations of OAuth, SAML, TOTP
4. **Networking** — Cisco Packet Tracer (free simulator) — practice subnetting and routing

All of these can be studied in 3–4 hours/day format with your schedule.
