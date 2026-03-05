# Generates a NEXTAUTH_SECRET you can paste into .env (Windows)
# Usage: .\scripts\generate-nextauth-secret.ps1

$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$secret = [Convert]::ToBase64String($bytes)

Write-Host ""
Write-Host "Add this line to your .env file:"
Write-Host ""
Write-Host "NEXTAUTH_SECRET=$secret"
Write-Host ""
Write-Host "Then save .env and redeploy if the app is already running."
Write-Host ""
