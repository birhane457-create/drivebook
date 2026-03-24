# Custom Domain Setup

**Tier required:** BUSINESS  
**Field:** `Instructor.customDomain`

---

## Overview

BUSINESS tier instructors/schools can use a custom domain (e.g. `book.myschool.com.au`) instead of the default `[slug].drivebook.com.au` subdomain.

---

## Setup Steps

1. In `/dashboard/branding`, set your subdomain slug (e.g. `myschool`)
2. Your default URL is: `myschool.drivebook.com.au`
3. To use a custom domain:
   - Add a CNAME record in your DNS provider pointing your domain to `cname.vercel-dns.com`
   - Add the custom domain in the Vercel dashboard under the DriveBook project
   - Contact DriveBook support to link the domain to your instructor account

---

## DNS Configuration

Example DNS record:
```
Type:  CNAME
Name:  book  (or @ for root domain)
Value: cname.vercel-dns.com
TTL:   Auto
```

DNS propagation typically takes 24–48 hours.

---

## SSL

Vercel automatically provisions an SSL certificate for custom domains via Let's Encrypt. No manual SSL setup required.

---

## Limitations

- Custom domains are only available on BUSINESS tier
- One custom domain per school account
- The domain must be verified before it goes live

---

## Related

- [SETTINGS.md](./SETTINGS.md) — Business settings
- `docs/03-instructor/BRANDING.md` — Subdomain and branding
