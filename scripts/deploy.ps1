#!/usr/bin/env pwsh
# Деплой LMS на pre-production або production.
#
# Використання (PowerShell):
#   ./scripts/deploy.ps1 dev    — пуш main → pre-production (deploy на pre.uimp.com.ua)
#   ./scripts/deploy.ps1 prod   — пуш main → main           (deploy на uimp.com.ua)
#   ./scripts/deploy.ps1 all    — спочатку dev, після підтвердження — prod
#
# Перевіряє:
#   - що ми на гілці main
#   - що working tree чистий (без незакомічених змін)
#   - що локальний main не відстає від origin/main
#
# Безпека:
#   - НЕ робить force-push.
#   - Перед prod-пушем питає підтвердження (Y/N).
#   - НЕ змінює git config, НЕ створює гілок, НЕ скидає локальні зміни.

param(
  [Parameter(Position = 0)]
  [ValidateSet('dev', 'prod', 'all')]
  [string]$Target
)

$ErrorActionPreference = 'Stop'

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Ok {
  param([string]$Message)
  Write-Host "✓ $Message" -ForegroundColor Green
}

function Fail {
  param([string]$Message)
  Write-Host ""
  Write-Host "✗ $Message" -ForegroundColor Red
  exit 1
}

function Confirm-Action {
  param([string]$Question)
  $answer = Read-Host "$Question [y/N]"
  return ($answer -match '^(y|yes)$')
}

if (-not $Target) {
  Write-Host "Використання: ./scripts/deploy.ps1 [dev|prod|all]" -ForegroundColor Yellow
  Write-Host ""
  Write-Host "  dev   — push main → pre-production (preview pre.uimp.com.ua)"
  Write-Host "  prod  — push main → main           (production uimp.com.ua)"
  Write-Host "  all   — dev, потім prod (з підтвердженням)"
  exit 1
}

# ---- Pre-flight checks --------------------------------------------------

Write-Step "Pre-flight перевірки"

$branch = (git rev-parse --abbrev-ref HEAD).Trim()
if ($branch -ne 'main') {
  Fail "Поточна гілка '$branch', а має бути 'main'. Переключися: git checkout main"
}
Write-Ok "Гілка: main"

$dirty = git status --porcelain
if ($dirty) {
  Write-Host $dirty
  Fail "Є незакомічені зміни. Закоміть або стеш перед деплоєм."
}
Write-Ok "Working tree чистий"

Write-Host "Fetch origin..." -ForegroundColor DarkGray
git fetch origin --quiet

$localSha  = (git rev-parse main).Trim()
$remoteSha = (git rev-parse origin/main).Trim()
$ahead  = [int](git rev-list --count "origin/main..main").Trim()
$behind = [int](git rev-list --count "main..origin/main").Trim()

if ($behind -gt 0) {
  Fail "Локальний main відстає від origin/main на $behind коміт(ів). Зроби 'git pull --ff-only' спочатку."
}
Write-Ok "Локальний main не відстає від origin/main (ahead: $ahead)"

# Список комітів, що задеплояться
if ($ahead -gt 0) {
  Write-Host ""
  Write-Host "Коміти, що увійдуть у деплой:" -ForegroundColor Yellow
  git log --oneline "origin/main..main"
  Write-Host ""
} else {
  Write-Host "На origin/main вже все актуальне (ahead: 0). Деплой пропхне ту саму голову на pre-production." -ForegroundColor DarkGray
}

# ---- Push functions -----------------------------------------------------

function Push-PreProduction {
  Write-Step "Деплой на pre-production (pre.uimp.com.ua)"
  git push origin main:pre-production
  Write-Ok "main → origin/pre-production"
  Write-Host ""
  Write-Host "Vercel почне build pre-production. Стеж за статусом тут:" -ForegroundColor DarkGray
  Write-Host "  https://vercel.com/dashboard"
  Write-Host "Перевіряй на: https://pre.uimp.com.ua" -ForegroundColor Yellow
}

function Push-Production {
  Write-Step "Деплой на PRODUCTION (uimp.com.ua)"
  if (-not (Confirm-Action "Точно пушити в prod?")) {
    Fail "Відмінено користувачем."
  }
  git push origin main
  Write-Ok "main → origin/main"
  Write-Host ""
  Write-Host "Vercel почне build prod. Стеж за статусом тут:" -ForegroundColor DarkGray
  Write-Host "  https://vercel.com/dashboard"
  Write-Host "Перевіряй на: https://uimp.com.ua" -ForegroundColor Green
}

# ---- Main flow ----------------------------------------------------------

switch ($Target) {
  'dev' {
    Push-PreProduction
  }
  'prod' {
    Push-Production
  }
  'all' {
    Push-PreProduction
    Write-Host ""
    Write-Host "Перевір pre.uimp.com.ua і коли все ок — натисни Y для prod." -ForegroundColor Yellow
    if (-not (Confirm-Action "Pre-prod ок? Пушити main → main?")) {
      Write-Host "Зупинено на pre-production. Запусти './scripts/deploy.ps1 prod' пізніше." -ForegroundColor Yellow
      exit 0
    }
    Push-Production
  }
}

Write-Host ""
Write-Host "Готово." -ForegroundColor Green
