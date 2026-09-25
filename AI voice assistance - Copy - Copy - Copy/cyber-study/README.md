# 22603VIC Certificate IV in Cyber Security — Study Notes

**Student:** Debesay Weldegebriel Birhane  
**Provider:** North or your registered training organisation (RTO) (WA) — BGT15 subsidised  
**Duration:** ~22 weeks (3–4 hrs/day self-paced)  
**Real-world reference system:** DriveBook (drivebook.com.au) — your own platform

---

## How this folder works

Each unit gets its own folder. Inside every folder you'll find:

- `NOTES.md` — concept notes written in plain language
- `DRIVEBOOK-EXAMPLES.md` — how that unit's concepts map directly to your platform
- `QUESTIONS.md` — practice questions the your assessor is likely to ask
- `RPL-EVIDENCE.md` — what you already have in your codebase that proves competency

The DriveBook examples are not hypothetical — they reference actual files in your app.
You learn the theory, then immediately see it in a system you built.

---

## Study Schedule

| Week(s) | Unit Code | Unit Name |
|---------|-----------|-----------|
| 1 | BSBWHS309 | Contribute to WHS communication and consultation |
| 2 | ICTICT443 | Work collaboratively in the ICT industry |
| 3 | BSBINS401 | Analyse and present research information |
| 4–5 | VU23217 | Recognise the need for cyber security in an organisation |
| 6–7 | VU23213 | Network concepts and protocols for cyber security |
| 8–10 | VU23215 | Test concepts and procedures for cyber security |
| 11 | VU23223 | Cyber security legislation, privacy and ethical practices |
| 12–14 | VU23220 | Cyber security industry project |
| 15–22 | Electives | Cloud, VPN, encryption, auth, perimeter security |

---

## Quick Reference — DriveBook Tech Stack

Keep this in mind as you study. Every unit will reference this.

| Layer | Technology | File location (in drivebook repo) |
|-------|------------|-----------------------------------|
| Frontend | Next.js 14 / React / TypeScript | `app/` |
| API | Next.js Route Handlers | `app/api/` |
| Database | PostgreSQL (Supabase) via Prisma ORM | `prisma/schema.prisma` |
| Auth | NextAuth.js (JWT, HttpOnly cookie) | `lib/auth.ts` |
| Rate limiting | Upstash Redis (sliding window) | `lib/ratelimit.ts` |
| File storage | Cloudinary | `lib/services/cloudinary.ts` |
| Payments | Stripe (webhooks, Payment Intents) | `app/api/stripe/webhook/route.ts` |
| SMS | Twilio | `lib/services/sms.ts` |
| AI voice | VAPI + hybrid Node.js microservice | `drivebook-hybrid/server.js` |
| Hosting | Vercel (main app) + Railway (hybrid) | `.env` |
| Audit logs | PostgreSQL AuditLog table | `lib/services/auditLogger.ts` |

---

## RPL Pre-Assessment Summary

From Challenges 1–2 completed before enrolment:

| training provider Unit | Competency | Evidence file |
|-----------|------------|---------------|
| ICTPRG435 | Scripting & automation | `app/api/register/route.ts` |
| ICTDBS401 | Database design | `prisma/schema.prisma` |
| ICTICT426 | Threat identification | `lib/ratelimit.ts` |
| ICTNWK408 | Network security (partial) | `middleware.ts`, `lib/auth.ts` |

Gap to close before RPL claim: OSI model layers 3–4, stateful firewall concepts (2–3 hrs reading — covered in Week 6–7 notes).
