$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot
docker compose --env-file .env.development -f docker-compose.yml -f docker-compose.dev.yml down
