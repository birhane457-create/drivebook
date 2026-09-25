# ICTICT443 — DriveBook Examples

## Documentation you already have (RPL evidence)

### Technical documentation
- `docs/DOCROLEBASE/` — role-based business rules, architecture, admin governance
- `docs/operations/` — operational runbooks
- `openapi-voice-booking.yaml` — formal API specification (OpenAPI/Swagger format)
- `drivebook-hybrid/openapi.yaml` — hybrid microservice API spec
- `COMBINED_AUDIT_REPORT.md` — security audit with findings and remediation

### Version control practice
Your GitHub/GitLab repositories show:
- Branching strategy (main/feature branches)
- Commit history with descriptive messages
- Separate repos for main app (Vercel) and hybrid service (Railway)

For the assessor: show a commit message like:
`"fix: prevent wallet double-debit when instructor books same slot twice — wrap in $transaction"`

This demonstrates professional commit messaging standards.

### Communication examples

**Technical to non-technical:**
Your `app/privacy/page.tsx` explains data handling in plain language for end users.
Your `app/terms/page.tsx` explains legal obligations in accessible language.

These are real examples of translating technical/legal concepts for a general audience.

### IP considerations in your project
- Your app code is proprietary (all rights reserved, not open source)
- You use MIT-licensed npm packages (Next.js, Prisma, etc.)
- Your obligation: you may use MIT packages freely but cannot claim you wrote them
- You cannot sublicense GPL code under a different licence

### Agile-style development
Your CHANGES.md and TODO.md show iterative development with prioritised backlogs,
which demonstrates agile principles even without a formal team structure.
