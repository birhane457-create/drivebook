# Security Checklist: Test Verification & Documentation
**Version:** 1.0  
**Created:** 2026-09-28  
**Purpose:** Prevent credential exposure and ensure secure testing practices

## Overview

This checklist MUST be completed before:
- Creating test documentation for audit evidence
- Committing test results to version control
- Running integration tests against databases
- Publishing test reports or procedures

**Reference Incidents:**
- SEC-CRED-01: Database credential exposure in Git history (2026-09-28)

---

## Pre-Test Checklist

### Environment Configuration

- [ ] **Test database is separate from production**
  - Separate Supabase project, OR
  - Separate schema with access controls, OR
  - Transaction-based rollback testing
  
- [ ] **Environment variables properly configured**
  - `TEST_DATABASE_URL` set in `.env.test` (local only)
  - `.env.test` is in `.gitignore`
  - Verify: `git ls-files | grep .env.test` returns nothing
  
- [ ] **Credentials stored securely**
  - Passwords in password manager (1Password, LastPass, etc.)
  - NO credentials in code comments
  - NO credentials in shell history
  - NO credentials in screenshot filenames

### Test Isolation

- [ ] **Test fixtures use identifiable patterns**
  - IDs prefixed with `test-*` or similar
  - Distinct from any production ID patterns
  - Easy to identify and clean up

- [ ] **Cleanup mechanisms verified**
  - `afterEach` hooks execute successfully
  - Transaction rollback works (if used)
  - Verify cleanup: query for test-* records should return empty

- [ ] **External services mocked**
  - Email service mocked (no real emails sent)
  - Stripe API mocked (no real charges)
  - Third-party webhooks mocked
  - Document mocking approach in test file

### Credential Privileges

- [ ] **Test credentials have minimal access**
  - No DROP/TRUNCATE/ALTER privileges
  - No superuser or admin roles
  - READ access to required tables only
  - WRITE access to test schema/tables only (if applicable)

- [ ] **Connection limits enforced**
  - Maximum concurrent connections set
  - Timeout limits configured
  - Rate limiting if available

---

## During Test Execution

### Real-time Monitoring

- [ ] **Monitor test execution for leaks**
  - Check console output for credential fragments
  - Verify no credentials in error stack traces
  - Watch for connection strings in logs

- [ ] **Verify isolation**
  - Confirm tests are hitting test database
  - No production data modified
  - Test-* records only created

### Documentation Discipline

- [ ] **Take notes WITHOUT credentials**
  - Use placeholders: `<REDACTED>`, `***`, `<PASSWORD>`
  - Reference environment variables instead of values
  - Document connection format, not actual credentials

- [ ] **Screenshot safety**
  - Blur/redact credentials before capturing
  - Review screenshots for sensitive data
  - Use annotation tools to cover secrets

---

## Post-Test Checklist

### Documentation Review

- [ ] **Scan all test documentation for credentials**
  ```bash
  # Run these searches before committing:
  grep -r "password" docs/audit/*.md
  grep -r "@.*supabase.com" docs/audit/*.md
  grep -r "whsec_" docs/audit/*.md
  grep -r "sk_test_" docs/audit/*.md
  grep -r "://.*:.*@" docs/audit/*.md
  ```

- [ ] **Review test command examples**
  - Database URLs use `<REDACTED>` placeholders
  - API keys use `sk_test_<REDACTED>` format
  - Webhook secrets use `whsec_<REDACTED>` format

- [ ] **Check test output files**
  - Scan `test-*.txt` files for credentials
  - Verify logs don't contain connection strings
  - Remove or redact sensitive test output

### Version Control Safety

- [ ] **Review changes before commit**
  ```bash
  git diff           # Check unstaged changes
  git diff --cached  # Check staged changes
  git status         # Verify no .env files staged
  ```

- [ ] **.gitignore verification**
  ```bash
  # These should all return NOTHING:
  git ls-files | grep "\.env$"
  git ls-files | grep "\.env\.test$"
  git ls-files | grep "\.env\.local$"
  git ls-files | grep "credentials"
  ```

- [ ] **File exclusions working**
  - `.env*` files properly ignored (except `.env.example`)
  - Credential files not tracked
  - Test output files ignored if they contain sensitive data

### Pre-Commit Verification

- [ ] **Run secret detection (if available)**
  ```bash
  # If git-secrets installed:
  git secrets --scan
  
  # If pre-commit framework:
  pre-commit run --all-files
  ```

- [ ] **Manual final review**
  - Read through commit diff one more time
  - Look for patterns: `://`, `@`, `password`, `secret`, `key`
  - Verify all credentials redacted

---

## Audit Evidence Requirements

### Documentation Standards

When creating audit evidence documents:

✅ **DO:**
- Use connection string format examples: `postgresql://<USER>:<PASSWORD>@<HOST>:<PORT>/<DB>`
- Reference environment variable names: `$env:TEST_DATABASE_URL`
- Provide setup instructions that don't reveal secrets
- Include credential rotation reminders
- Add security incident references (e.g., "per SEC-CRED-01")

❌ **DON'T:**
- Include actual passwords or API keys
- Paste raw connection strings
- Screenshot dashboards with visible credentials
- Commit `.env` files for "convenience"
- Assume credential rotation will happen "later"

### Template: Safe Test Command Documentation

```markdown
## Test Execution

**Prerequisites:**
1. Configure test database credentials in `.env.test` (local only, gitignored)
2. Obtain credentials from secure password manager
3. Verify test database is isolated from production

**Command:**
\`\`\`powershell
# Set test database URL (replace <REDACTED> with actual credentials)
$env:TEST_DATABASE_URL="postgresql://<USER>:<PASSWORD>@<HOST>:5432/<DATABASE>"

# Run tests
npm test -- __tests__/integration/your-test.test.ts --reporter=verbose --run
\`\`\`

**Note:** Credentials redacted per security policy. Actual values available in [Password Manager Name].

**Security:** Ensure TEST_DATABASE_URL points to isolated test environment, NOT production.
```

---

## Emergency Response

### If Credential Accidentally Committed

**IMMEDIATE ACTIONS:**

1. **Stop all work** - Do not push if not yet pushed

2. **If not yet pushed:**
   ```bash
   # Undo the commit (keeps changes)
   git reset --soft HEAD~1
   
   # Remove credential from files
   # [manual edit]
   
   # Re-commit with redacted version
   git add <files>
   git commit -m "docs: Add test results (credentials redacted)"
   ```

3. **If already pushed:**
   - **IMMEDIATELY rotate the exposed credential**
   - Open security incident ticket
   - Follow SEC-CRED-01 incident response process
   - Notify team if shared repository

4. **Repository cleanup:**
   ```bash
   # Remove from Git history (USE WITH CAUTION)
   git filter-branch --force --index-filter \
     'git rm --cached --ignore-unmatch <file-with-secret>' \
     --prune-empty --tag-name-filter cat -- --all
   
   # Force push (coordinate with team)
   git push origin --force --all
   ```

5. **Document the incident:**
   - Create SEC-* finding document
   - Record timeline
   - Document remediation steps
   - Update this checklist with lessons learned

---

## Automated Prevention (Recommended)

### Git Hooks

Install `git-secrets` or `pre-commit` framework:

```bash
# Option 1: git-secrets
brew install git-secrets  # or: apt-get install git-secrets
git secrets --install
git secrets --register-aws
git secrets --add 'password.*=.*'
git secrets --add 'postgresql://[^<].*@'

# Option 2: pre-commit framework
pip install pre-commit
# Create .pre-commit-config.yaml with secret detection hooks
pre-commit install
```

### CI/CD Integration

Add to CI pipeline:

```yaml
# Example: GitHub Actions
- name: Secret Detection
  uses: trufflesecurity/trufflehog@main
  with:
    path: ./
    base: main
    head: HEAD
```

---

## Training & Awareness

### For New Team Members

- [ ] Review this security checklist
- [ ] Read SEC-CRED-01 incident report
- [ ] Understand credential storage policy
- [ ] Practice safe documentation techniques
- [ ] Know emergency response procedures

### Regular Reminders

**Monthly:**
- Review security incidents (if any)
- Audit `.gitignore` effectiveness
- Verify test isolation still valid

**Quarterly:**
- Rotate test credentials
- Review credential privileges
- Update security checklist with new patterns

**Annually:**
- Full security audit of test infrastructure
- Review and update all documentation
- Credential rotation for all environments

---

## Checklist Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-09-28 | 1.0 | Initial version created from SEC-CRED-01 lessons learned |

---

## Quick Reference Card

**Before documenting tests:**
1. ✅ Credentials in password manager, not code
2. ✅ `.env.test` in `.gitignore`
3. ✅ Test database isolated
4. ✅ Connection strings use `<REDACTED>` placeholders

**Before committing:**
1. ✅ `git diff` review for secrets
2. ✅ No `.env` files in `git status`
3. ✅ Test output redacted
4. ✅ Run `git secrets --scan` (if installed)

**If credential exposed:**
1. 🚨 Stop and rotate immediately
2. 🚨 Open security incident
3. 🚨 Remove from Git history if needed
4. 🚨 Notify team

---

**Remember:** When in doubt, redact. It's easier to share credentials securely later than to clean up after exposure.
