#!/usr/bin/env pwsh
<#
.SYNOPSIS
  One-command OJT Tracker deploy to Vercel.
  Run this and follow the prompts.
#>

$ErrorActionPreference = "Stop"

Write-Host "========================================"
Write-Host "  OJT TRACKER - DEPLOY TO VERCEL"
Write-Host "========================================"
Write-Host ""

# Config
$OJT_SHEET_ID = "1TELifh_DyzEQWd1OFQjPgFe_RYzrm0n0CogkScRoRC4"
$OJT_ADMIN_KEY = "AtzGAD6lzQkG7O5PmARdAusxIA1rOpfH"
$CREDS_FILE = "$env:USERPROFILE\Desktop\Shadow Stack\scripts\gradesheet-creds.json"

# Step 1 — Encode credentials
Write-Host "[1/4] Encoding credentials..."
if (Test-Path $CREDS_FILE) {
    $GOOGLE_SHEETS_CREDENTIALS = [Convert]::ToBase64String([IO.File]::ReadAllBytes($CREDS_FILE))
    Write-Host "  DONE ($($GOOGLE_SHEETS_CREDENTIALS.Length) chars)"
} elseif (Test-Path ".\GOOGLE_SHEETS_CREDENTIALS.txt") {
    $GOOGLE_SHEETS_CREDENTIALS = Get-Content ".\GOOGLE_SHEETS_CREDENTIALS.txt" -Raw
    Write-Host "  Loaded from file ($($GOOGLE_SHEETS_CREDENTIALS.Length) chars)"
} else {
    Write-Host "  CREDS NOT FOUND. Paste base64 manually:"
    $GOOGLE_SHEETS_CREDENTIALS = Read-Host "> "
}

# Step 2 — Vercel login
Write-Host "[2/4] Logging into Vercel..."
Write-Host "  (Browser will open - complete the login)"
vercel login
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Login failed. Try: vercel login"
    exit 1
}

# Step 3 — Deploy
Write-Host "[3/4] Deploying to Vercel..."
vercel --prod

# Step 4 — Set env vars
Write-Host "[4/4] Setting environment variables..."
@(
    @("OJT_SHEET_ID", $OJT_SHEET_ID),
    @("OJT_ADMIN_KEY", $OJT_ADMIN_KEY),
    @("GOOGLE_SHEETS_CREDENTIALS", $GOOGLE_SHEETS_CREDENTIALS)
) | ForEach-Object {
    $name = $_[0]
    $value = $_[1]
    Write-Host "  Setting $name..."
    $value | vercel env add $name --prod
}

Write-Host ""
Write-Host "================== DONE =================="
Write-Host "  Your app is live!"
Write-Host "  Admin Key: $OJT_ADMIN_KEY"
Write-Host "  Sheet ID:  $OJT_SHEET_ID"
Write-Host "=========================================="
