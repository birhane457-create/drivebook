# setup-postgres-portable.ps1
# Extracts the PostgreSQL 16 zip to D:\pg16, initialises a test cluster
# on port 5433 with user=postgres / password=testpass / db=drivebook_test.
# No admin rights required. Run from any PowerShell session.

$PG_ZIP  = "D:\pg16-portable.zip"
$PG_HOME = "D:\pg16"         # where binaries unzip
$PG_DATA = "D:\pg16data"     # cluster data directory
$PG_PORT = "5433"
$PG_USER = "postgres"
$PG_PASS = "testpass"
$PG_DB   = "drivebook_test"

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# 1 ── Verify zip ──────────────────────────────────────────────────────────────
if (-not (Test-Path $PG_ZIP)) {
    Write-Error "ZIP not found: $PG_ZIP. Run BITS download first."
    exit 1
}
$zipSize = [math]::Round((Get-Item $PG_ZIP).Length / 1MB, 0)
Write-Host "[1/6] ZIP found: $zipSize MB at $PG_ZIP"

# 2 ── Extract ─────────────────────────────────────────────────────────────────
if (Test-Path $PG_HOME) {
    Write-Host "[2/6] Removing existing $PG_HOME ..."
    Remove-Item $PG_HOME -Recurse -Force
}
Write-Host "[2/6] Extracting to $PG_HOME (may take 30s) ..."
Expand-Archive -Path $PG_ZIP -DestinationPath "D:\" -Force
# EDB zip extracts to D:\pgsql
if (Test-Path "D:\pgsql") {
    Rename-Item "D:\pgsql" "pg16"
    Write-Host "[2/6] Extracted to $PG_HOME"
} else {
    Write-Error "Unexpected zip layout — D:\pgsql not found after extract"
    exit 1
}

$PGBIN = "$PG_HOME\bin"

# 3 ── Init cluster ────────────────────────────────────────────────────────────
if (Test-Path $PG_DATA) {
    Write-Host "[3/6] Removing existing data dir $PG_DATA ..."
    Remove-Item $PG_DATA -Recurse -Force
}
Write-Host "[3/6] Initialising PostgreSQL cluster at $PG_DATA ..."
$passFile = [System.IO.Path]::GetTempFileName()
Set-Content $passFile $PG_PASS
& "$PGBIN\initdb.exe" `
    --pgdata="$PG_DATA" `
    --username="$PG_USER" `
    --pwfile="$passFile" `
    --encoding=UTF8 `
    --auth=md5 2>&1
Remove-Item $passFile -Force
if ($LASTEXITCODE -ne 0) { Write-Error "initdb failed"; exit 1 }
Write-Host "[3/6] Cluster initialised."

# 4 ── Configure port & trust local ───────────────────────────────────────────
Write-Host "[4/6] Setting port=$PG_PORT and enabling md5 auth ..."
$conf = Get-Content "$PG_DATA\postgresql.conf"
$conf = $conf -replace "^#?port\s*=.*", "port = $PG_PORT"
$conf | Set-Content "$PG_DATA\postgresql.conf"
# Allow md5 auth from localhost
$hba = @"
# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   all             all                                     trust
host    all             all             127.0.0.1/32            md5
host    all             all             ::1/128                 md5
"@
Set-Content "$PG_DATA\pg_hba.conf" $hba

# 5 ── Start server ────────────────────────────────────────────────────────────
Write-Host "[5/6] Starting PostgreSQL on port $PG_PORT ..."
& "$PGBIN\pg_ctl.exe" start --pgdata="$PG_DATA" --log="$PG_DATA\server.log" -w 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "pg_ctl output:"
    Get-Content "$PG_DATA\server.log" -Tail 20
    Write-Error "pg_ctl start failed"
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
if ($LASTEXITCODE -ne 0) { Write-Error "createdb failed"; exit 1 }
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
Write-Host "============================================"
