# Run on Windows: push code to origin
Set-Location $PSScriptRoot
git add -A
git status
$msg = if ($args[0]) { $args[0] } else { "Deploy" }
git commit -m $msg
git push origin main
Write-Host "Pushed. On VPS run: cd /root/Regaged && git pull && npm run build && pm2 restart regaged"
