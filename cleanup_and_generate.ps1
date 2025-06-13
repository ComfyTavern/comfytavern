# cleanup_and_generate.ps1
Write-Host "Step 1: Attempting to remove bun.lock..."
Remove-Item bun.lock -ErrorAction SilentlyContinue
If ($?) {
    Write-Host "bun.lock removal command executed (may or may not have existed)." -ForegroundColor Green
} Else {
    Write-Host "bun.lock removal command encountered an issue (Exit Code: $LASTEXITCODE)." -ForegroundColor Yellow
}

Write-Host "Step 2: Attempting to remove node_modules directory (this may take a moment)..."
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
If ($?) {
    Write-Host "node_modules removal command executed successfully." -ForegroundColor Green
} Else {
    Write-Host "node_modules removal command encountered an issue (Exit Code: $LASTEXITCODE)." -ForegroundColor Yellow
}

Write-Host "Step 3: Running bun install --registry https://registry.npmmirror.com ..."
bun install --registry https://registry.npmmirror.com
If (-Not $?) {
    Write-Host "bun install failed. Please check the output above." -ForegroundColor Red
    exit 1
}
Write-Host "bun install completed." -ForegroundColor Green

Write-Host "Step 4: Running bun run db:generate..."
bun run db:generate
If (-Not $?) {
    Write-Host "bun run db:generate failed. Please check the output above." -ForegroundColor Red
    exit 1
}
Write-Host "bun run db:generate command executed." -ForegroundColor Green
Write-Host "Script finished. Please review the output above for results of db:generate."