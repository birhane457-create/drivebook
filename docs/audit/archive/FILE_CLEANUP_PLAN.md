# File Cleanup Plan - Post Integration Testing

## Files Created During Integration Testing

### ✅ KEEP - Permanent Automated Tests

**File:** `test-instructor-risk-direct.mjs`
- **Classification:** Reusable integration test
- **Action:** Move to `__tests__/integration/` directory
- **Reason:** Provides direct database integration testing for instructor-risk API
- **Value:** Can be run as part of CI/CD pipeline

### ✅ KEEP - Documentation

**File:** `docs/INTEGRATION_TEST_REPORT.md`
- **Classification:** Historical documentation
- **Action:** Keep in `docs/` directory
- **Reason:** Detailed test report showing 21/21 tests passed
- **Value:** Audit trail for bug fix verification

**File:** `DEV_INTEGRATION_COMPLETE.md`
- **Classification:** Current checkpoint documentation
- **Action:** Keep at root (temporary) or move to `docs/`
- **Reason:** Quick reference for Phase 1 completion
- **Consideration:** May consolidate into CONTEXT_AUDIT_FIXES.md after Phase 2

### 🗑️ DELETE - Temporary Diagnostic Scripts

**File:** `test-instructor-risk.mjs` (original, buggy version)
- **Classification:** Temporary diagnostic script
- **Action:** DELETE
- **Reason:** Has Prisma syntax errors, replaced by `-direct.mjs` version
- **No longer needed**

### 📂 CONSOLIDATE - Existing Test Reports

Root directory currently has multiple test reports:
- `DEV_RECEIPT_TESTING.md`
- `EMAIL_INTEGRATION_FIX_REPORT.md`
- `FINAL_COMPLETION_REPORT.md`
- `FINAL_TEST_RESOLUTION_REPORT.md`
- `RECEIPT_VERIFICATION_REPORT.md`
- `TEST_FAILURE_ANALYSIS.md`
- `WEBHOOK_COMPARISON_REPORT.md`

**Recommendation:** Consider moving historical test reports to:
- `docs/test-reports/` or
- `docs/DOCROLEBASE/test-reports/`

This keeps the root directory clean while preserving audit trails.

### ✅ KEEP - Other Test Scripts (Already Existed)

These existed before and should remain:
- `test-db-connection.mjs` - Database connectivity check
- `test-gst.mjs` - GST calculation verification
- `verify-*.mjs` - Various verification scripts
- `check-instructors.mjs` - Provider data checks

## Security Check: No Password Exposure ✅

**Checked:** Documentation files for hardcoded passwords
**Result:** No actual passwords found
**Note:** References to "test123" are test IDs (e.g., `pi_test123`), not passwords

## Recommended Actions

### Immediate (Before Phase 2)

1. ✅ Delete `test-instructor-risk.mjs` (buggy version)
2. ✅ Move `test-instructor-risk-direct.mjs` → `__tests__/integration/instructor-risk.test.mjs`
3. ⏳ Decide: Keep `DEV_INTEGRATION_COMPLETE.md` at root or move to `docs/`

### After Phase 2

4. Consolidate all test reports into `docs/test-reports/` or `docs/DOCROLEBASE/`
5. Create a single `TESTING_HISTORY.md` index pointing to all reports
6. Update `.gitignore` if needed to exclude future temp test files

### Long Term

7. Add `__tests__/integration/` directory to test suite
8. Document integration test running instructions in `docs/DEVELOPER_ONBOARDING.md`
9. Consider CI/CD integration for database integration tests

## File Structure After Cleanup

```
drivebook/
├── __tests__/
│   └── integration/
│       └── instructor-risk.test.mjs  ← MOVED
├── docs/
│   ├── INTEGRATION_TEST_REPORT.md    ← KEPT
│   ├── CONTEXT_AUDIT_FIXES.md        ← KEPT (updated)
│   └── test-reports/                 ← NEW (consolidate others)
│       ├── receipt-testing.md
│       ├── email-integration.md
│       └── ...
├── DEV_INTEGRATION_COMPLETE.md       ← KEPT (for now)
└── test-instructor-risk.mjs          ← DELETED
```

---

**Status:** Ready for cleanup execution
**Next:** Execute cleanup, then proceed to Phase 2 Security Audit
