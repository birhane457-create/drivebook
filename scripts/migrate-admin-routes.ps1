# Migration Script: Admin routes - instructor to provider
# Fixes prisma.instructor and prisma.client references in admin API routes

Write-Host "Migrating admin API routes..." -ForegroundColor Cyan

# Get all TypeScript files in app/api/admin
$files = Get-ChildItem -Path "app\api\admin" -Filter "*.ts" -Recurse -File

$totalFixed = 0

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $originalContent = $content
    
    # Replace prisma model references
    $content = $content -replace 'prisma\.instructor', 'prisma.provider'
    $content = $content -replace 'prisma\.client(?!Wallet)', 'prisma.customer'
    
    # Replace include/select fields in booking queries
    $content = $content -replace "include:\s*\{\s*instructor:", "include: { provider:"
    $content = $content -replace "include:\s*\{\s*client:", "include: { customer:"
    $content = $content -replace "select:\s*\{\s*instructor:", "select: { provider:"
    $content = $content -replace "select:\s*\{\s*client:", "select: { customer:"
    
    if ($content -ne $originalContent) {
        Set-Content $file.FullName -Value $content -NoNewline
        Write-Host "  Fixed: $($file.Name)" -ForegroundColor Green
        $totalFixed++
    }
}

Write-Host ""
Write-Host "Fixed $totalFixed admin route files" -ForegroundColor Green
Write-Host "Note: Permission constant names and field references need manual review" -ForegroundColor Yellow
