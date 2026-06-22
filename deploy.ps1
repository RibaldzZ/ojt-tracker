#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Deploy OJT Tracker to Vercel and set environment variables.
  Run this from PowerShell.
#>

$ErrorActionPreference = "Stop"

Write-Host "========================================"
Write-Host "  OJT TRACKER - DEPLOY SCRIPT"
Write-Host "========================================"
Write-Host ""

# --- Configuration ---
$PROJECT_DIR = "$env:USERPROFILE\Desktop\ojt-tracker"
$OJT_SHEET_ID = "1TELifh_DyzEQWd1OFQjPgFe_RYzrm0n0CogkScRoRC4"
$OJT_ADMIN_KEY = "AtzGAD6lzQkG7O5PmARdAusxIA1rOpfH"
$CREDS_FILE = "$env:USERPROFILE\Desktop\Shadow Stack\scripts\gradesheet-creds.json"

# Step 1: Verify files exist
Write-Host "[1/4] Verifying project files..."
if (-not (Test-Path "$PROJECT_DIR\api\ojt.mjs")) { Write-Host "ERROR: api/ojt.mjs not found!"; exit 1 }
if (-not (Test-Path "$PROJECT_DIR\index.html")) { Write-Host "ERROR: index.html not found!"; exit 1 }
Write-Host "  OK - Project files verified"

# Step 2: Base64 encode credentials
Write-Host "[2/4] Encoding service account credentials..."
if (Test-Path $CREDS_FILE) {
    $GOOGLE_SHEETS_CREDENTIALS = [Convert]::ToBase64String([IO.File]::ReadAllBytes($CREDS_FILE))
    Write-Host "  OK - Credentials encoded ($($GOOGLE_SHEETS_CREDENTIALS.Length) chars)"
} else {
    Write-Host "WARNING: Credentials file not found at $CREDS_FILE"
    Write-Host "Please provide the base64 of gradesheet-creds.json manually."
    $GOOGLE_SHEETS_CREDENTIALS = Read-Host "Paste base64 of credentials"
}

# Step 3: Deploy to Vercel
Write-Host "[3/4] Deploying to Vercel..."
Set-Location -LiteralPath $PROJECT_DIR
Write-Host "  Running: npx vercel --prod"
Write-Host "  (A browser may open for authentication - complete the login)"
npx vercel --prod
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Vercel deployment failed!" -ForegroundColor Red
    Write-Host "Try running 'npx vercel login' first, then re-run this script." -ForegroundColor Yellow
    exit 1
}

# Step 4: Set environment variables
Write-Host "[4/4] Setting environment variables..."
$DEPLOYED_URL = "https://ojt-tracker.vercel.app" # Update this if different

Write-Host ""
Write-Host "========================================"
Write-Host "  SET THESE ENV VARS IN VERECL DASHBOARD"
Write-Host "========================================"
Write-Host ""
Write-Host "1. Go to: https://vercel.com/YOUR_PROJECT/settings/environment-variables"
Write-Host "2. Add these variables:"
Write-Host ""
Write-Host "  OJT_SHEET_ID = $OJT_SHEET_ID"
Write-Host "  OJT_ADMIN_KEY = $OJT_ADMIN_KEY"
Write-Host "  GOOGLE_SHEETS_CREDENTIALS = (paste the base64 below)"
Write-Host ""
Write-Host "Base64 Credentials (first 80 chars):"
Write-Host "  $($GOOGLE_SHEETS_CREDENTIALS.Substring(0, [Math]::Min(80, $GOOGLE_SHEETS_CREDENTIALS.Length)))..."
Write-Host ""
Write-Host "Or set them via CLI:"
Write-Host "  cd $PROJECT_DIR"
Write-Host "  npx vercel env add OJT_SHEET_ID"
Write-Host "  npx vercel env add OJT_ADMIN_KEY"
Write-Host "  npx vercel env add GOOGLE_SHEETS_CREDENTIALS"
Write-Host "  npx vercel env pull"
Write-Host "  npx vercel --prod"
Write-Host ""
Write-Host "3. Your admin key for coordinator login:"
Write-Host "  $OJT_ADMIN_KEY"
Write-Host ""
Write-Host "========================================"
Write-Host "  DEPLOYMENT INSTRUCTIONS COMPLETE"
Write-Host "========================================"

# Save the base64 to a temp file for easy access
$envFile = "$PROJECT_DIR\.env.production"
@"
OJT_SHEET_ID=$OJT_SHEET_ID
OJT_ADMIN_KEY=$OJT_ADMIN_KEY
GOOGLE_SHEETS_CREDENTIALS=$GOOGLE_SHEETS_CREDENTIALS
"@ | Out-File -FilePath $envFile -Encoding ASCII
Write-Host ""
Write-Host "Env vars saved to: $envFile (for reference, delete after use)"
