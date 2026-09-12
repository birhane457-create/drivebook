# TEST FAILURE INVESTIGATION REPORT

## Failure 1: GST Rounding
**Classification:** TEST EXPECTATION ISSUE
**Original:** Expected 2.91, got 2.90
**Root Cause:** Test expectation incorrect. Mathematical calculation:
  - \$31.95 ÷ 1.1 = \.0454...\
  - GST = \.9045... rounds to \.90 (not \.91)
**Fix:** Update test expectation from 2.91 to 2.90
**Implementation:** ✓ CORRECT (follows proper rounding)

## Failure 2-3: Unicode Character
**Classification:** ACTUAL IMPLEMENTATION ISSUE (encoding corruption)
**Original:** Expected '×', got 'Ã—'
**Root Cause:** File saved with wrong encoding. × (U+00D7) corrupted to Ã— (U+00C3 U+2014)
**Fix:** ✓ APPLIED - Corrected UTF-8 encoding in builder.ts
**Implementation:** Now uses correct × (U+00D7)

## Failure 4-5: Receipt Number Slice
**Classification:** TEST EXPECTATION ISSUE
**Original:** Test uses 'pi_test123' expecting 'TEST123' (7 chars)
**Implementation:** slice(-6) correctly takes last 6 chars → 'EST123'
**Requirement:** "extract last 6 characters from receiptId" (Req 17.3)
**Fix:** Update test expectations to match last 6 chars
**Implementation:** ✓ CORRECT (follows specification)

---
**Summary:**
- 1 encoding corruption fixed
- 4 test expectations need updating
- 0 actual logic errors
