param(
  [switch]$NoBuild
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

if (-not (Test-Path '.env.development')) {
  Copy-Item '.env.development.example' '.env.development'
  Write-Host 'Created .env.development. Review its local-only passwords before continuing.' -ForegroundColor Yellow
}

$composeArgs = @(
  'compose',
  '--env-file', '.env.development',
  '-f', 'docker-compose.yml',
  '-f', 'docker-compose.dev.yml'
)

if ($NoBuild) {
  & docker @composeArgs up -d --no-build
} else {
  & docker @composeArgs up -d --build
  if ($LASTEXITCODE -ne 0) {
    Write-Warning 'Image build or pull failed. Trying cached local images without rebuilding dependencies.'
    & docker @composeArgs up -d --no-build
  }
}

if ($LASTEXITCODE -ne 0) {
  throw 'Local Docker environment failed to start. Check Docker Desktop network/proxy settings and local image cache.'
}

& docker @composeArgs ps
Write-Host ''
Write-Host 'Local development is ready:' -ForegroundColor Green
Write-Host '  Admin login: http://127.0.0.1/admin/login.html?role=admin'
Write-Host '  Public site: http://127.0.0.1/public/'
Write-Host '  Policy admin: http://127.0.0.1/knowledge/policy-admin.html'
Write-Host 'Source files are mounted. Node services restart automatically after JS changes.'
if ($NoBuild) {
  Write-Host 'Started from cached images. Re-run without -NoBuild after package dependency changes.' -ForegroundColor Yellow
}
