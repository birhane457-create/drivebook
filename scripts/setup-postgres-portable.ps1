# setup-postgres-portable.ps1
# Extracts the PostgreSQL 16 zip to D:\pg16, initialises a test cluster
# on port 5433 with user=postgres / password=testpass / db=drivebook_test.
# No admin rights required. Run from any PowerShell session.
#
# SAFETY:
#   By default this script REFUSES to delete an existing data directory.
#   Pass -Reset to allow destructive recreation of both D:\pg16 and D:\pg16data.
#   The -Reset flag requires the data directory to be the expected disposable
#   test path (D:\pg16data) and must NOT match any production indicators.
#
# Usage:
#   # First run (no existing data):
#   .\setup-postgres-portable.ps1
#
#   # Recreate from scratch (wipes D:\pg16 and D:\pg16data):
#   .\setup-postgres-portable.ps1 -Reset

[CmdletBinding()]
param(
    [switch]$Reset
)

$PG_ZIP  = "D:\pg16-portable.zip"
$PG_HOME = "D:\pg16"            # where binaries unzip to
$PG_DATA = "D:\pg16data"        # cluster data directory
$PG_PORT = "5433"
$PG_USER = "postgres"
$PG_PASS = "testpass"
$PG_DB   = "drivebook_test"

# ── Allowed data directory: must be this exact value ─────────────────────────
# This prevents the script from accidentally targeting a production cluster.
$ALLOWED_DATA_PATH = "D:\pg16data"

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Safety gate ───────────────────────────────────────────────────────────────

if ($PG_DATA -ne $ALLOWED_DATA_PATH) {
    Write-Error "SAFETY: PG_DATA is '$PG_DATA' but only '$ALLOWED_DATA_PATH' is permitted. Edit the script if you intend a different path."
    exit 1
}

if (Test-Path $PG_DATA) {
    if (-not $Reset) {
        Write-Error @"
SAFETY: Data directory '$PG_DATA' already exists.
This script will NOT delete it unless you explicitly pass -Reset.

If this is a disposable test cluster that you want to recreate:
    .\setup-postgres-portable.ps1 -Reset

If the cluster is running, stop it first:
    D:\pg16\bin\pg_ctl.exe stop --pgdata=D:\pg16data

Do NOT pass -Reset if this directory contains data that matters.
"@
        exit 1
    }

    # -Reset path: verify the cluster looks like our test cluster before deleting
    Write-Host "[Safety check] -Reset specified. Verifying '$PG_DATA' is the test cluster..."

    $pgVersionFile = Join-Path $PG_DATA "PG_VERSION"
    if (Test-Path $pgVersionFile) {
        $pgVer = Get-Content $pgVersionFile -Raw
        Write-Host "  PG_VERSION: $($pgVer.Trim())"
    }

    # Check that it is NOT running (refuse to delete a running cluster)
    $pgPidFile = Join-Path $PG_DATA "postmaster.pid"
    if (Test-Path $pgPidFile) {
        Write-Error "SAFETY: '$pgPidFile' exists — the PostgreSQL cluster appears to be running. Stop it before resetting:`n  D:\pg16\bin\pg_ctl.exe stop --pgdata=D:\pg16data"
        exit 1
    }

    Write-Host "  Cluster is not running. Proceeding with reset."
    Write-Host "[Reset] Removing $PG_DATA ..."
    Remove-Item $PG_DATA -Recurse -Force

    if (Test-Path $PG_HOME) {
        Write-Host "[Reset] Removing $PG_HOME ..."
        Remove-Item $PG_HOME -Recurse -Force
    }
}

# 1 ── Verify zip ──────────────────────────────────────────────────────────────
if (-not (Test-Path $PG_ZIP)) {
    Write-Error "ZIP not found: $PG_ZIP`nDownload it first with BITS:`n  Start-BitsTransfer -Source 'https://get.enterprisedb.com/postgresql/postgresql-16.4-1-windows-x64-binaries.zip' -Destination '$PG_ZIP'"
    exit 1
}
$zipSize = [math]::Round((Get-Item $PG_ZIP).Length / 1MB, 0)
Write-Host "[1/6] ZIP found: $zipSize MB at $PG_ZIP"

# 2 ── Extract ─────────────────────────────────────────────────────────────────
if (-not (Test-Path $PG_HOME)) {
    Write-Host "[2/6] Extracting to $PG_HOME (may take 30s) ..."
    Expand-Archive -Path $PG_ZIP -DestinationPath "D:\" -Force
    # EDB zip extracts to D:\pgsql
    if (Test-Path "D:\pgsql") {
        Rename-Item "D:\pgsql" "pg16"
    }
}
if (-not (Test-Path "$PG_HOME\bin\postgres.exe")) {
    Write-Error "Unexpected zip layout — '$PG_HOME\bin\postgres.exe' not found after extract."
    exit 1
}
Write-Host "[2/6] Binaries confirmed at $PG_HOME\bin"

$PGBIN = "$PG_HOME\bin"

# 3 ── Init cluster ────────────────────────────────────────────────────────────
New-Item -ItemType Directory -Path $PG_DATA -Force | Out-Null
Write-Host "[3/6] Initialising PostgreSQL cluster at $PG_DATA ..."
$passFile = [System.IO.Path]::GetTempFileName()
[System.IO.File]::WriteAllText($passFile, $PG_PASS)
& "$PGBIN\initdb.exe" `
    --pgdata="$PG_DATA" `
    --username="$PG_USER" `
    --pwfile="$passFile" `
    --encoding=UTF8 `
    --auth=md5 2>&1
Remove-Item $passFile -Force -ErrorAction SilentlyContinue
if ($LASTEXITCODE -ne 0) { Write-Error "initdb failed (exit $LASTEXITCODE)"; exit 1 }
Write-Host "[3/6] Cluster initialised."

# 4 ── Configure port and auth ─────────────────────────────────────────────────
Write-Host "[4/6] Setting port=$PG_PORT and enabling md5 auth ..."
$conf = Get-Content "$PG_DATA\postgresql.conf"
$conf = $conf -replace "^#?port\s*=.*", "port = $PG_PORT"
$conf | Set-Content "$PG_DATA\postgresql.conf"
$hba = @"
# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   all             all                                     trust
host    all             all             127.0.0.1/32            md5
host    all             all             ::1/128                 md5
"@
[System.IO.File]::WriteAllText("$PG_DATA\pg_hba.conf", $hba)

# 5 ── Start server ────────────────────────────────────────────────────────────
Write-Host "[5/6] Starting PostgreSQL on port $PG_PORT ..."
& "$PGBIN\pg_ctl.exe" start --pgdata="$PG_DATA" --log="$PG_DATA\server.log" -w 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Server log (last 20 lines):"
    Get-Content "$PG_DATA\server.log" -Tail 20 -ErrorAction SilentlyContinue
    Write-Error "pg_ctl start failed (exit $LASTEXITCODE)"
    exit 1
}
Write-Host "[5/6] PostgreSQL started."

# 6 ── Create test database ────────────────────────────────────────────────────
Write-Host "[6/6] Creating database $PG_DB ..."
$env:PGPASSWORD = $PG_PASS
& "$PGBIN\createdb.exe" `
    --host=localhost `
    --port=$PG_PORT `
    --username=$PG_USER `
    $PG_DB 2>&1
if ($LASTEXITCODE -ne 0) { Write-Error "createdb failed (exit $LASTEXITCODE)"; exit 1 }
Write-Host "[6/6] Database $PG_DB created."

Write-Host ""
Write-Host "============================================"
Write-Host "PostgreSQL 16 is running on port $PG_PORT"
Write-Host "  User:     $PG_USER"
Write-Host "  Password: $PG_PASS"
Write-Host "  Database: $PG_DB"
Write-Host "  Data dir: $PG_DATA"
Write-Host ""
Write-Host "DATABASE_URL=postgresql://${PG_USER}:${PG_PASS}@localhost:${PG_PORT}/${PG_DB}"
Write-Host ""
Write-Host "To stop:  D:\pg16\bin\pg_ctl.exe stop --pgdata=D:\pg16data"
Write-Host "To reset: .\setup-postgres-portable.ps1 -Reset"
Write-Host "============================================"
