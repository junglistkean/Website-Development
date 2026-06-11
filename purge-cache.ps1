# Purge the Cloudflare edge cache for ravenstaging.co.uk (purge everything).
# Run after every deploy that changes HTML/JS - Pages deploys do NOT clear the
# zone edge cache on the custom domain. See "Cache purging" in CLAUDE.md.
#
# Credentials live in .cloudflare-purge.txt next to this script (untracked,
# never commit): two lines, TOKEN=... and ZONE_ID=...
#
# NOTE: keep this file pure ASCII - Windows PowerShell 5.1 reads BOM-less
# files as ANSI and multi-byte characters corrupt the parse.

$ErrorActionPreference = 'Stop'

$credFile = Join-Path $PSScriptRoot '.cloudflare-purge.txt'
if (-not (Test-Path $credFile)) {
  Write-Host "ERROR: $credFile not found." -ForegroundColor Red
  Write-Host 'Create it with two lines:  TOKEN=<api token>  and  ZONE_ID=<zone id>'
  exit 1
}

$cred = @{}
foreach ($line in Get-Content $credFile) {
  if ($line -match '^\s*(TOKEN|ZONE_ID)\s*=\s*(\S+)\s*$') { $cred[$Matches[1]] = $Matches[2] }
}
if (-not $cred['TOKEN'] -or -not $cred['ZONE_ID']) {
  Write-Host 'ERROR: .cloudflare-purge.txt must contain TOKEN=... and ZONE_ID=... lines.' -ForegroundColor Red
  exit 1
}

# TLS 1.2 needed on Windows PowerShell 5.1
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$uri = "https://api.cloudflare.com/client/v4/zones/$($cred['ZONE_ID'])/purge_cache"
try {
  $resp = Invoke-RestMethod -Method Post -Uri $uri `
    -Headers @{ Authorization = "Bearer $($cred['TOKEN'])" } `
    -ContentType 'application/json' `
    -Body '{"purge_everything":true}'
} catch {
  Write-Host 'PURGE FAILED - Cloudflare API error:' -ForegroundColor Red
  if ($_.ErrorDetails -and $_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message }
  else { Write-Host $_.Exception.Message }
  exit 1
}

if ($resp.success) {
  Write-Host "PURGE OK - zone cache cleared (id: $($resp.result.id))" -ForegroundColor Green
  Write-Host 'Allow a few seconds, then hard-refresh the page to confirm.'
} else {
  Write-Host 'PURGE FAILED:' -ForegroundColor Red
  $resp.errors | ForEach-Object { Write-Host "  [$($_.code)] $($_.message)" }
  exit 1
}
