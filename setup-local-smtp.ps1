# Local SMTP Test Setup Script

Write-Output "=== Setting Up Local Receipt Testing ==="
Write-Output ""

# Option 1: Mailhog (recommended for local testing)
Write-Output "OPTION 1: Mailhog (Recommended)"
Write-Output "  - Lightweight SMTP server with web UI"
Write-Output "  - View emails in browser at http://localhost:8025"
Write-Output "  - Install: choco install mailhog (Windows)"
Write-Output "  - Or download: https://github.com/mailhog/MailHog/releases"
Write-Output "  - Run: mailhog.exe"
Write-Output "  - SMTP: localhost:1025"
Write-Output ""

# Option 2: Papercut SMTP
Write-Output "OPTION 2: Papercut SMTP (Windows)"
Write-Output "  - Windows desktop SMTP server"
Write-Output "  - Download: https://github.com/ChangemakerStudios/Papercut-SMTP"
Write-Output "  - Run .exe, auto-starts on port 25"
Write-Output "  - SMTP: localhost:25"
Write-Output ""

# Option 3: Gmail test account
Write-Output "OPTION 3: Gmail (Real emails)"
Write-Output "  - Use actual Gmail account"
Write-Output "  - Requires app password"
Write-Output "  - SMTP: smtp.gmail.com:587"
Write-Output ""

Write-Output "=== Current .env SMTP Configuration ==="
if (Test-Path ".env") {
  $env = Get-Content ".env" | Select-String "SMTP"
  if ($env) {
    $env | ForEach-Object { Write-Output "  $_" }
  } else {
    Write-Output "  No SMTP variables found in .env"
  }
} else {
  Write-Output "  .env file not found"
}
Write-Output ""
