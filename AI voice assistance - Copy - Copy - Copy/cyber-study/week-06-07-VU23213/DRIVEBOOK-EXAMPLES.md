# VU23213 — DriveBook Network Examples

## How DriveBook traffic flows (with OSI layers)

```
Student browser
    │
    │  Layer 7: HTTPS request to drivebook.com.au
    │
Vercel Edge Network (CDN)
    │
    │  Layer 3/4: TLS terminated at edge, forwarded to Next.js serverless function
    │
Next.js API Route (Vercel)
    │
    │  Layer 7: API calls to Supabase (PostgreSQL)
    │  Uses DATABASE_URL with pgbouncer (connection pooling)
    │
Supabase PostgreSQL (AWS ap-northeast-1)
```

## Railway IPv6 (from your logs)

In the Railway logs you saw:
```
"upstreamAddress":"http://[fd12:edf3:d9c7:1:9000:5e:bedc:9f5e]:3001"
```

`fd12:...` is an **IPv6 link-local address** within Railway's internal network.
- `fd` prefix = **Unique Local Address (ULA)** — like a private IPv4 range but for IPv6
- This is not routable on the public internet — only accessible within Railway's network
- Port `3001` = your Node.js hybrid service

This is real networking knowledge from your own deployment. Use it in assessments.

## Port numbers in your stack

| Service | Protocol | Port | Notes |
|---------|----------|------|-------|
| DriveBook (Vercel) | HTTPS | 443 | TLS encrypted |
| DriveBook (dev) | HTTP | 3000 | Local only |
| Hybrid service (Railway) | HTTP | 3001 | Internal, behind Railway proxy |
| PostgreSQL (Supabase) | TCP | 5432 | Direct connection (migrations) |
| PostgreSQL (Supabase pgbouncer) | TCP | 6543 | Pooled connection (production) |
| Redis (Upstash) | HTTPS | 443 | REST API, not raw Redis port |
| Twilio SMS | HTTPS | 443 | Outbound webhooks |
| Stripe webhooks | HTTPS | 443 | Inbound to your server |

## Your firewall situation

**Vercel** acts as your application-layer firewall:
- All traffic goes through Vercel's edge first
- DDoS protection built-in
- Automatic HTTPS (port 443 only — port 80 redirects to 443)
- `X-Forwarded-For` header rewritten by Vercel (prevents IP spoofing)

**Railway** (hybrid service):
- Only accessible via Railway's internal proxy
- `verifyVapiSecret` middleware in `drivebook-hybrid/middleware/auth.js` acts as an application-layer gate
- Only VAPI with the correct secret can call the hybrid

## DNS for drivebook.com.au

Your domain goes through Vercel's DNS:
1. Browser looks up `drivebook.com.au`
2. DNS returns Vercel's edge IP (e.g., `76.76.21.21`)
3. Browser connects to Vercel on port 443
4. TLS handshake — browser verifies the certificate is valid for `drivebook.com.au`
5. If an attacker DNS-poisoned the cache, step 4 would fail because they can't get a valid certificate for your domain — this is HTTPS's protection against DNS poisoning

## The X-Forwarded-For issue (from your RPL gap)

Your rate limiter uses:
```typescript
req.headers.get('x-forwarded-for')
```

**Why it's safe on Vercel:**
Vercel's edge removes any client-supplied `X-Forwarded-For` header and replaces it with
the actual client IP. The header your API receives is set by Vercel, not the client.
This means IP spoofing via this header is not possible in your deployment.

**One-line improvement to add** (shows assessor you understand the attack):
```typescript
const rawIp = req.headers.get('x-forwarded-for') || 'unknown';
const ip = rawIp.split(',')[0].trim(); // take leftmost IP only
```
