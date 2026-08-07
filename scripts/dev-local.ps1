$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

if (-not (Test-Path '.env.development')) {
  Copy-Item '.env.development.example' '.env.development'
  Write-Host 'Created .env.development. Review its local-only passwords before continuing.' -ForegroundColor Yellow
}

docker compose --env-file .env.development -f docker-compose.yml -f docker-compose.dev.yml up -d --build
if ($LASTEXITCODE -ne 0) { throw 'Local Docker environment failed to start.' }

docker compose --env-file .env.development -f docker-compose.yml -f docker-compose.dev.yml ps
Write-Host ''
Write-Host 'Local development is ready:' -ForegroundColor Green
Write-Host '  Admin login: http://127.0.0.1/admin/login.html?role=admin'
Write-Host '  Public site: http://127.0.0.1/public/'
Write-Host '  Policy admin: http://127.0.0.1/knowledge/policy-admin.html'
Write-Host 'Source files are mounted. Node services restart automatically after JS changes.'
