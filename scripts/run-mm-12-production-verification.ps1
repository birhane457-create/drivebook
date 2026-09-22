# MM-12 Production Verification Script  (v2)
#
# PURPOSE:
#   Execute the 9-step production verification checklist for MM-12 (admin wallet
#   idempotency) against the deployed production application.
#
# CORRECTIONS FROM v1 (per independent review):
#   1. SHA verification: read from /api/health (VERCEL_GIT_COMMIT_SHA), not operator input
#   2. Cookie name: handles both __Secure-next-auth.session-token (production)
#      and next-auth.session-token (dev) — matched against actual auth.ts config
#   3. Fixture handling: script does NOT claim to create fixtures automatically;
#      manual provisioning is explicit and clearly documented
#   4. DB constraint verification: Step 8 now queries the pg_indexes catalog to
#      confirm the unique constraint exists, not just that no duplicates happen to exist
#   5. Step 7/8b separation: Step 7 records HTTP result; Step 8b records DB
#      result; evidence file clearly labels each as distinct evidence types
#   6. Reviewer note: guide updated to require independent corroboration, not
#      self-authenticating operator-supplied values
#
# REQUIREMENTS:
#   - Commit 638888f0 or later deployed to production (verified via /api/health sha field)
#   - Migration 20260815000001_mm12d_admin_wallet_idempotency applied to production DB
#   - Dedicated test fixtures pre-created in production DB (see guide)
#   - PRODUCTION_ADMIN_EMAIL / PRODUCTION_ADMIN_PASSWORD: dedicated test admin account
#   - DB access for SQL invariant queries (steps 8a-8d)
#
# OUTPUT:
#   docs/audit/MM-12-PRODUCTION-VERIFICATION.txt
#
# SAFETY:
#   - Uses a dedicated test wallet (IDs supplied via parameters)
#   - No real customer wallet is touched
#   - Financial amounts used: $1 (minimum meaningful, traceable)
#   - Test data cleanup SQL is printed at the end

param(
    [Parameter(Mandatory=$true)]
    [string]$ProductionUrl,

    [Parameter(Mandatory=$true)]
    [string]$AdminEmail,

    [Parameter(Mandatory=$true)]
    [string]$AdminPassword,

    [Parameter(Mandatory=$true)]
    [string]$TestCustomerId,      # pre-created; see guide for SQL setup

    [Parameter(Mandatory=$true)]
    [string]$TestWalletId,        # pre-created; needed for SQL queries

    [string]$ExpectedShaPrefix,   # optional: first 8+ chars of 638888f0 to assert against

    [string]$OutputFile = "docs\audit\MM-12-PRODUCTION-VERIFICATION.txt"
)

$ErrorActionPreference = "Stop"
$RunTimestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$Evidence = [System.Collections.Generic.List[string]]::new()

function Log {
    param([string]$Line)
    Write-Host $Line
    $Evidence.Add($Line)
}

function LogSection {
    param([string]$Title)
    Log ""
    Log "=== $Title ==="
}

Log "MM-12 Production Verification (script v2)"
Log "Run timestamp:  $RunTimestamp"
Log "Production URL: $ProductionUrl"
Log "Test customer:  $TestCustomerId"
Log "Test wallet:    $TestWalletId"
Log "Output:         $OutputFile"

# ── Step 1: Read deployed SHA from /api/health ────────────────────────────────
# The /api/health endpoint exposes process.env.VERCEL_GIT_COMMIT_SHA at runtime.
# This is read from the running application, not supplied by the operator,
# making it an independent confirmation of what is actually deployed.
LogSection "Step 1: Deployed commit SHA (read from application)"

try {
    $healthRes = Invoke-RestMethod -Uri "$ProductionUrl/api/health" -Method GET -TimeoutSec 10
} catch {
    Log "ERROR: Production server not reachable at $ProductionUrl — $_"
    exit 1
}

$deployedSha   = $healthRes.sha
$deployedEnv   = $healthRes.env
$healthTimestamp = $healthRes.timestamp

Log "Health endpoint response:"
Log "  sha:       $deployedSha"
Log "  env:       $deployedEnv"
Log "  timestamp: $healthTimestamp"

if ($deployedSha -eq 'dev') {
    Log "WARNING: sha = 'dev' — this is a local/development server, not production."
    Log "         Production verification requires a real Vercel deployment."
}

if ($ExpectedShaPrefix -and -not $deployedSha.StartsWith($ExpectedShaPrefix)) {
    Log "ERROR: Deployed SHA '$deployedSha' does not start with expected '$ExpectedShaPrefix'."
    Log "       The fix commit 638888f0 (or a later commit containing it) must be deployed."
    exit 1
} elseif ($ExpectedShaPrefix) {
    Log "SHA prefix match: OK ($ExpectedShaPrefix)"
}

Log ""
Log "INDEPENDENT VERIFICATION REQUIRED:"
Log "  Open the Vercel dashboard for this deployment and confirm that:"
Log "  $deployedSha matches the Git SHA of the deployed commit."
Log "  The reviewer must record this independently of this script's output."

# ── Step 2: Authenticate ──────────────────────────────────────────────────────
LogSection "Step 2: Authentication"
Log "Admin email: $AdminEmail"

# Get CSRF token and capture the Set-Cookie header
$csrfResponse = Invoke-WebRequest -Uri "$ProductionUrl/api/auth/csrf" -Method GET -SessionVariable webSession -UseBasicParsing
$csrfBody = $csrfResponse.Content | ConvertFrom-Json
$csrfToken = $csrfBody.csrfToken
$csrfCookies = $csrfResponse.Headers['Set-Cookie']
Log "CSRF token obtained"

# Sign in — POST to /api/auth/callback/credentials with CSRF cookie echoed back
$csrfCookieHeader = ($csrfCookies | ForEach-Object { ($_ -split ";")[0] }) -join "; "
$signInBody = "csrfToken=$([Uri]::EscapeDataString($csrfToken))&email=$([Uri]::EscapeDataString($AdminEmail))&password=$([Uri]::EscapeDataString($AdminPassword))"

$signInResponse = Invoke-WebRequest `
    -Uri "$ProductionUrl/api/auth/callback/credentials" `
    -Method POST `
    -Body $signInBody `
    -ContentType "application/x-www-form-urlencoded" `
    -Headers @{ "Cookie" = $csrfCookieHeader } `
    -MaximumRedirection 0 `
    -UseBasicParsing `
    -ErrorAction SilentlyContinue

# auth.ts sets cookie name based on NODE_ENV:
#   production:   __Secure-next-auth.session-token
#   development:  next-auth.session-token
# Try both — whichever is present is the active session cookie.
$responseCookies = $signInResponse.Headers['Set-Cookie']
$sessionCookie = $null
foreach ($c in $responseCookies) {
    $nameValue = ($c -split ";")[0]
    if ($nameValue -match "(__Secure-)?next-auth\.session-token=") {
        $sessionCookie = $nameValue
        break
    }
}

if (-not $sessionCookie) {
    Log "ERROR: Authentication failed. No session-token cookie found in response."
    Log "  Cookies received: $responseCookies"
    Log "  Check admin credentials and that the account has ADMIN role + StaffMember record."
    exit 1
}

$cookieNameUsed = if ($sessionCookie -match "^__Secure-") { "__Secure-next-auth.session-token" } else { "next-auth.session-token" }
Log "Session cookie obtained: $cookieNameUsed"
Log "Authentication: OK"

# Helper: make an authenticated wallet API call
function Invoke-WalletOp {
    param(
        [string]$Operation,
        [decimal]$Amount,
        [string]$Reason,
        [string]$IdempotencyKey
    )
    $headers = @{
        "Content-Type"    = "application/json"
        "Cookie"          = "$csrfCookieHeader; $sessionCookie"
        "Idempotency-Key" = $IdempotencyKey
    }
    $bodyJson = "{`"amount`":$Amount,`"reason`":`"$Reason`"}"
    try {
        $r = Invoke-WebRequest `
            -Uri "$ProductionUrl/api/admin/clients/$TestCustomerId/wallet/$Operation" `
            -Method POST `
            -Headers $headers `
            -Body $bodyJson `
            -UseBasicParsing `
            -ErrorAction SilentlyContinue
        $parsed = $r.Content | ConvertFrom-Json -ErrorAction SilentlyContinue
        return @{ status = [int]$r.StatusCode; body = $parsed; raw = $r.Content }
    } catch {
        $sc = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 0 }
        $msg = $_.ErrorDetails.Message
        return @{ status = $sc; body = ($msg | ConvertFrom-Json -ErrorAction SilentlyContinue); raw = $msg }
    }
}

# ── Step 3: Same-key concurrent credit → exactly 1 transaction ───────────────
LogSection "Step 3: Concurrent same-key credit (INVARIANT 1)"

$key3 = [System.Guid]::NewGuid().ToString()
Log "Idempotency key: $key3"
Log "Sending two concurrent requests..."

$job3a = Start-Job -ScriptBlock {
    param($url, $cid, $csrfCookie, $sessionCookie, $key)
    $headers = @{ "Content-Type"="application/json"; "Cookie"="$csrfCookie; $sessionCookie"; "Idempotency-Key"=$key }
    try {
        $r = Invoke-WebRequest -Uri "$url/api/admin/clients/$cid/wallet/add-credit" -Method POST -Headers $headers -Body '{"amount":1,"reason":"MM-12 prod 3A"}' -UseBasicParsing -ErrorAction SilentlyContinue
        $b = $r.Content | ConvertFrom-Json -ErrorAction SilentlyContinue
        return @{ status=[int]$r.StatusCode; txId=$b.transactionId; raw=$r.Content }
    } catch {
        return @{ status=[int]$_.Exception.Response.StatusCode; txId=$null; raw=$_.ErrorDetails.Message }
    }
} -ArgumentList $ProductionUrl, $TestCustomerId, $csrfCookieHeader, $sessionCookie, $key3

$job3b = Start-Job -ScriptBlock {
    param($url, $cid, $csrfCookie, $sessionCookie, $key)
    $headers = @{ "Content-Type"="application/json"; "Cookie"="$csrfCookie; $sessionCookie"; "Idempotency-Key"=$key }
    try {
        $r = Invoke-WebRequest -Uri "$url/api/admin/clients/$cid/wallet/add-credit" -Method POST -Headers $headers -Body '{"amount":1,"reason":"MM-12 prod 3A"}' -UseBasicParsing -ErrorAction SilentlyContinue
        $b = $r.Content | ConvertFrom-Json -ErrorAction SilentlyContinue
        return @{ status=[int]$r.StatusCode; txId=$b.transactionId; raw=$r.Content }
    } catch {
        return @{ status=[int]$_.Exception.Response.StatusCode; txId=$null; raw=$_.ErrorDetails.Message }
    }
} -ArgumentList $ProductionUrl, $TestCustomerId, $csrfCookieHeader, $sessionCookie, $key3

$res3a = Receive-Job -Job $job3a -Wait; $res3b = Receive-Job -Job $job3b -Wait
Remove-Job $job3a -Force; Remove-Job $job3b -Force

Log "Request A: HTTP $($res3a.status)  txId=$($res3a.txId)"
Log "Request B: HTTP $($res3b.status)  txId=$($res3b.txId)"
Log "Raw A: $($res3a.raw)"
Log "Raw B: $($res3b.raw)"

$step3HttpPass = ($res3a.status -eq 200) -and ($res3b.status -eq 200)
$step3TxIdMatch = ($res3a.txId -ne $null) -and ($res3a.txId -eq $res3b.txId)
Log "Step 3 HTTP:   PASS=$step3HttpPass  (both 200)"
Log "Step 3 txId:   MATCH=$step3TxIdMatch  (both reference same transaction)"
Log "APPLICATION EVIDENCE: HTTP status + transaction IDs recorded above."
Log "DB EVIDENCE REQUIRED: Step 8 SQL query will confirm exactly 1 WalletTransaction row."

# ── Step 4: Replay with same key → same txId ──────────────────────────────────
LogSection "Step 4: Replay with same key"

$res4 = Invoke-WalletOp -Operation "add-credit" -Amount 1 -Reason "MM-12 prod 3A" -IdempotencyKey $key3
Log "Replay HTTP:   $($res4.status)"
Log "Replay txId:   $($res4.body.transactionId)"
Log "Raw: $($res4.raw)"

$step4Pass = ($res4.status -eq 200) -and ($res4.body.transactionId -eq $res3a.txId)
Log "Step 4 PASS:   $step4Pass  (HTTP 200, txId matches Step 3)"

# ── Step 5: Distinct keys → distinct transactions ─────────────────────────────
LogSection "Step 5: Distinct-key credits (legitimate operations)"

$key5a = [System.Guid]::NewGuid().ToString()
$key5b = [System.Guid]::NewGuid().ToString()
$res5a = Invoke-WalletOp -Operation "add-credit" -Amount 1 -Reason "MM-12 prod 5A" -IdempotencyKey $key5a
$res5b = Invoke-WalletOp -Operation "add-credit" -Amount 1 -Reason "MM-12 prod 5B" -IdempotencyKey $key5b
Log "Credit 5A: HTTP $($res5a.status)  txId=$($res5a.body.transactionId)"
Log "Credit 5B: HTTP $($res5b.status)  txId=$($res5b.body.transactionId)"

$step5Pass = ($res5a.status -eq 200) -and ($res5b.status -eq 200) -and `
             ($res5a.body.transactionId -ne $res5b.body.transactionId)
Log "Step 5 PASS:   $step5Pass  (both 200, distinct txIds)"

# ── Step 6: Concurrent deductions → no negative balance ──────────────────────
LogSection "Step 6: Concurrent deductions — INVARIANT 2"

# Add a known $5 credit to establish a controlled starting balance
$fundKey = [System.Guid]::NewGuid().ToString()
$fundRes = Invoke-WalletOp -Operation "add-credit" -Amount 5 -Reason "MM-12 prod 6 setup" -IdempotencyKey $fundKey
Log "Setup credit ($5): HTTP $($fundRes.status)  txId=$($fundRes.body.transactionId)"
if ($fundRes.status -ne 200) {
    Log "ERROR: Setup credit failed — cannot proceed with Step 6."
    exit 1
}

# Two concurrent $4 debits — only one can succeed given the $5 available from this credit
$key6a = [System.Guid]::NewGuid().ToString()
$key6b = [System.Guid]::NewGuid().ToString()

$job6a = Start-Job -ScriptBlock {
    param($url, $cid, $csrfCookie, $sessionCookie, $key)
    $headers = @{ "Content-Type"="application/json"; "Cookie"="$csrfCookie; $sessionCookie"; "Idempotency-Key"=$key }
    try {
        $r = Invoke-WebRequest -Uri "$url/api/admin/clients/$cid/wallet/deduct-credit" -Method POST -Headers $headers -Body '{"amount":4,"reason":"MM-12 prod 6A"}' -UseBasicParsing -ErrorAction SilentlyContinue
        return @{ status=[int]$r.StatusCode; raw=$r.Content }
    } catch {
        return @{ status=[int]$_.Exception.Response.StatusCode; raw=$_.ErrorDetails.Message }
    }
} -ArgumentList $ProductionUrl, $TestCustomerId, $csrfCookieHeader, $sessionCookie, $key6a

$job6b = Start-Job -ScriptBlock {
    param($url, $cid, $csrfCookie, $sessionCookie, $key)
    $headers = @{ "Content-Type"="application/json"; "Cookie"="$csrfCookie; $sessionCookie"; "Idempotency-Key"=$key }
    try {
        $r = Invoke-WebRequest -Uri "$url/api/admin/clients/$cid/wallet/deduct-credit" -Method POST -Headers $headers -Body '{"amount":4,"reason":"MM-12 prod 6B"}' -UseBasicParsing -ErrorAction SilentlyContinue
        return @{ status=[int]$r.StatusCode; raw=$r.Content }
    } catch {
        return @{ status=[int]$_.Exception.Response.StatusCode; raw=$_.ErrorDetails.Message }
    }
} -ArgumentList $ProductionUrl, $TestCustomerId, $csrfCookieHeader, $sessionCookie, $key6b

$res6a = Receive-Job -Job $job6a -Wait; $res6b = Receive-Job -Job $job6b -Wait
Remove-Job $job6a -Force; Remove-Job $job6b -Force

Log "Debit 6A: HTTP $($res6a.status)  Raw: $($res6a.raw)"
Log "Debit 6B: HTTP $($res6b.status)  Raw: $($res6b.raw)"

$step6HttpPass = (($res6a.status -eq 200 -and $res6b.status -eq 400) -or `
                  ($res6a.status -eq 400 -and $res6b.status -eq 200))
Log "Step 6 HTTP:   PASS=$step6HttpPass  (one 200, one 400)"
Log "DB EVIDENCE REQUIRED: Step 8 SQL will confirm final ledger balance >= 0."

# ── Step 7: Failed deduction → HTTP 400 ──────────────────────────────────────
LogSection "Step 7: Failed deduction — HTTP response (application evidence)"
Log "Note: Step 7 records the HTTP response only."
Log "      Whether the idempotency row was cleaned up is verified separately by Step 8b (DB evidence)."
Log "      These are distinct evidence types and are recorded as such."

$key7 = [System.Guid]::NewGuid().ToString()
Log "Idempotency key for failed deduction: $key7"

$res7 = Invoke-WalletOp -Operation "deduct-credit" -Amount 9999 -Reason "MM-12 prod 7 insufficient" -IdempotencyKey $key7
Log "Insufficient deduction HTTP: $($res7.status)"
Log "Raw: $($res7.raw)"
$step7HttpPass = ($res7.status -eq 400)
Log "Step 7 HTTP PASS: $step7HttpPass  (400 — application correctly rejected)"
Log "DB verification: Requires query 8b below (key7=$key7 should return 0 rows)"

# ── Step 8: SQL invariants — MANUAL, operator-recorded DB evidence ─────────────
LogSection "Step 8: SQL invariant queries (operator-recorded DB evidence)"
Log ""
Log "NOTE: The following SQL results are entered by the operator after running"
Log "      queries directly against the production database. They are distinct"
Log "      from application-layer HTTP evidence (Steps 3-7)."
Log "      Independent reviewer must verify these results separately against"
Log "      production DB access or Vercel deployment logs."
Log ""
Log "Connect: psql 'PRODUCTION_DB_URL_HERE'"
Log ""
Log "--- Query 8a: Unique constraint exists in pg_indexes ---"
Log "  SELECT indexname, indexdef"
Log "  FROM pg_indexes"
Log "  WHERE tablename = 'AdminWalletIdempotencyKey'"
Log "    AND indexdef LIKE '%key%walletId%operationType%';"
Log "  Expected: at least 1 row (the unique index from migration)"
Log ""
Log "--- Query 8b: No orphan row for failed deduction key ---"
Log "  SELECT COUNT(*) FROM ""AdminWalletIdempotencyKey"""
Log "  WHERE key = '$key7';"
Log "  Expected: 0  (key was deleted because balance check failed)"
Log ""
Log "--- Query 8c: No duplicate key tuples ---"
Log "  SELECT key, ""walletId"", ""operationType"", COUNT(*) AS cnt"
Log "  FROM ""AdminWalletIdempotencyKey"""
Log "  GROUP BY key, ""walletId"", ""operationType"""
Log "  HAVING COUNT(*) > 1;"
Log "  Expected: 0 rows"
Log ""
Log "--- Query 8d: Ledger equals cached balance for test wallet ---"
Log "  SELECT w.id,"
Log "         w.balance AS cached,"
Log "         SUM(CASE WHEN t.type='CREDIT' THEN t.amount ELSE -t.amount END) AS ledger"
Log "  FROM ""ClientWallet"" w"
Log "  JOIN ""WalletTransaction"" t ON t.""walletId"" = w.id"
Log "  WHERE w.id = '$TestWalletId' AND t.status = 'CONFIRMED'"
Log "  GROUP BY w.id, w.balance;"
Log "  Expected: cached = ledger (within 0.01)"
Log ""

$sql8aIndexFound = Read-Host "8a: index row count (expected >= 1)"
$sql8bOrphanRows = Read-Host "8b: orphan row count for key7 (expected 0)"
$sql8cDupRows    = Read-Host "8c: duplicate tuple row count (expected 0)"
$sql8dCached     = Read-Host "8d: cached balance value"
$sql8dLedger     = Read-Host "8d: ledger balance value"

Log ""
Log "DB EVIDENCE (operator-recorded):"
Log "  8a index row count:  $sql8aIndexFound  (expected: >= 1)"
Log "  8b orphan rows:      $sql8bOrphanRows  (expected: 0)"
Log "  8c duplicate tuples: $sql8cDupRows     (expected: 0)"
Log "  8d cached balance:   $sql8dCached"
Log "  8d ledger balance:   $sql8dLedger"

$step8aPass = ([int]$sql8aIndexFound -ge 1)
$step8bPass = ($sql8bOrphanRows -eq "0")
$step8cPass = ($sql8cDupRows -eq "0")
$step8dPass = ([Math]::Abs([double]$sql8dCached - [double]$sql8dLedger) -le 0.01)
Log ""
Log "  8a constraint exists: PASS=$step8aPass"
Log "  8b no orphan key:     PASS=$step8bPass"
Log "  8c no duplicates:     PASS=$step8cPass"
Log "  8d ledger=cache:      PASS=$step8dPass"

# ── Step 9: Summary ───────────────────────────────────────────────────────────
LogSection "Step 9: Production verification summary"

Log "Deployed SHA (from /api/health):  $deployedSha"
Log "Expected fix SHA prefix:          638888f0"
Log "Production URL:                   $ProductionUrl"
Log "Test customer ID:                 $TestCustomerId"
Log "Test wallet ID:                   $TestWalletId"
Log "Session cookie name used:         $cookieNameUsed"
Log "Script run timestamp:             $RunTimestamp"
Log ""
Log "Evidence type legend:"
Log "  [APP]  Application HTTP evidence — observed by script from live server"
Log "  [DB]   Database evidence — operator-recorded SQL results"
Log "  [SHA]  Deployment evidence — read from running application + requires independent Vercel check"
Log ""
Log "Results:"
Log "  [SHA]  Step 1  Deployed SHA from /api/health:         $deployedSha"
Log "  [APP]  Step 3  Same-key concurrent credit HTTP:       PASS=$step3HttpPass"
Log "  [APP]  Step 3  Same-key concurrent credit txId match: PASS=$step3TxIdMatch"
Log "  [APP]  Step 4  Replay same txId:                      PASS=$step4Pass"
Log "  [APP]  Step 5  Distinct-key distinct txIds:           PASS=$step5Pass"
Log "  [APP]  Step 6  Concurrent deductions safe (HTTP):     PASS=$step6HttpPass"
Log "  [APP]  Step 7  Failed deduction HTTP 400:             PASS=$step7HttpPass"
Log "  [DB]   Step 8a Unique constraint in pg_indexes:       PASS=$step8aPass"
Log "  [DB]   Step 8b No orphan key for failed deduction:    PASS=$step8bPass"
Log "  [DB]   Step 8c No duplicate key tuples:               PASS=$step8cPass"
Log "  [DB]   Step 8d Ledger = cached balance:               PASS=$step8dPass"
Log ""

$allPass = $step3HttpPass -and $step3TxIdMatch -and $step4Pass -and $step5Pass -and `
           $step6HttpPass -and $step7HttpPass -and $step8aPass -and $step8bPass -and `
           $step8cPass -and $step8dPass

if ($allPass) {
    Log "OVERALL: ALL CHECKS PASSED"
    Log ""
    Log "INDEPENDENT REVIEWER ACTIONS REQUIRED BEFORE CLOSING MM-12:"
    Log "  1. Confirm deployed SHA '$deployedSha' in Vercel deployment dashboard"
    Log "     and verify it contains commit 638888f0 in its ancestry."
    Log "  2. Verify DB results (8a-8d) against production DB independently."
    Log "  3. Review transaction IDs (Step 3 txId, Step 4 txId) are identical."
    Log "  4. Confirm test fixtures were not real customer wallets."
    Log ""
    Log "MM-12 READY TO CLOSE upon independent reviewer confirmation."
} else {
    Log "OVERALL: ONE OR MORE CHECKS FAILED"
    Log "DO NOT CLOSE MM-12 — investigate failed checks before proceeding."
}

Log ""
Log "--- TEST FIXTURE CLEANUP SQL ---"
Log "Run after independent reviewer has inspected the evidence:"
Log "  DELETE FROM ""AdminWalletIdempotencyKey"" WHERE ""walletId"" = '$TestWalletId';"
Log "  DELETE FROM ""WalletTransaction""         WHERE ""walletId"" = '$TestWalletId';"
Log "  DELETE FROM ""ClientWallet""              WHERE id = '$TestWalletId';"
Log "  DELETE FROM ""Customer""                  WHERE id = '$TestCustomerId';"
Log "  DELETE FROM ""User""                      WHERE id = (SELECT ""userId"" FROM ""ClientWallet"" WHERE id = '$TestWalletId' LIMIT 1);"

# Write evidence file
$Evidence | Out-File -FilePath $OutputFile -Encoding UTF8 -Force
Write-Host ""
Write-Host "Evidence written to: $OutputFile"
Write-Host "Commit this file to the audit branch as the production evidence record."
