# PR: Remove legacy `lessonPackages`

## Title
Remove legacy `lessonPackages` (schema, UI, docs) and ban instructor add-on payloads

## Summary
- Remove `lessonPackages` JSON field from the Prisma schema.
- Remove UI/types referring to `lessonPackages` and stop exposing it in booking flows.
- Update docs and analysis files to remove references to legacy instructor packages.
- Server already enforces rejection of instructor-provided add-on payloads in booking endpoints.

## Files changed (high level)
- `prisma/schema.prisma` — removed `lessonPackages` field
- `app/client-dashboard/page.tsx` — removed `lessonPackages` prop/type
- `components/subdomain/SubdomainPageShell.tsx` — removed `lessonPackages` prop/type
- `docs/DOCROLEBASE/03-instructor/PRICING.md` — updated to remove legacy references
- `BOOKING_PAYMENT_FLOW_ANALYSIS.md` — removed legacy lookup examples
- Other small UI/type cleanups

## Rationale
`lessonPackages` were a legacy instructor-controlled add-on mechanism. We now manage instructor test packages via PDA-config fields (`offersTestPackage`, `testPackagePrice`, ...). Keeping the legacy field risks client confusion and inconsistent pricing. The removal ensures the server and UI are aligned.

## Migration / DB note
- This change removes the `lessonPackages` column from the Prisma schema file. If you want to preserve existing records, run a backup/migration to move legacy data elsewhere before applying migrations to production.
- Since this project is new and you requested full removal, there is no archival step included here. If you later need to preserve historical data, restore from backups.

## Testing & Verification
1. Run `npm run build` — should complete without errors (done locally).
2. Verify booking flows reject legacy payloads (specialServiceId/customPackageId) — server returns 400.
3. Verify PDA test packages still show and price correctly.

## PR description (suggested)
Removes legacy instructor `lessonPackages` from the codebase and updates UI and docs accordingly.

- Removes `lessonPackages` from `prisma/schema.prisma` and updates related types.
- Cleans UI to avoid exposing legacy add-on selectors in booking flows.
- Updates docs to reflect removal and points to PDA test package fields for supported instructor-configured packages.

This change intentionally removes legacy fields and relies on the platform PDA fields for instructor-configured test packages. Frontend teams: stop sending `customPackageId`/`customPackagePrice`/`specialService*` fields in booking requests.

## Commands to create branch + PR
Run locally (replace `origin` if different):

```bash
git checkout -b remove-lessonpackages
git add -A
git commit -m "chore: remove legacy lessonPackages (schema, UI, docs); ban legacy add-on payloads"
git push -u origin remove-lessonpackages
# Create PR (GitHub CLI):
gh pr create --title "Remove legacy lessonPackages" --body-file docs/PR_REMOVE_LESSONPACKAGES.md --base main
```

If you want me to push and open the PR for you, grant me permission to run git commands in the workspace and confirm the remote name (`origin`) and base branch (`main` or `master`).
