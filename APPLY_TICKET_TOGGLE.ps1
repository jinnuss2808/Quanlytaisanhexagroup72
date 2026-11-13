$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$patch = Join-Path $root 'HEXA-TICKET-TOGGLE.patch'
$targets = @(
  'backend/src/app.js',
  'backend/src/ticket-module.js',
  'backend/test/ticket-module.test.js',
  'backend/src/remind.js',
  'firebase/functions/worker/remind.js',
  'frontend/src/App.jsx'
)
$applied = $false
$backup = $null
$existing = @{}

try {
  if (-not (Test-Path (Join-Path $root 'frontend/src/App.jsx')) -or -not (Test-Path (Join-Path $root 'backend/src/app.js'))) {
    throw 'Hay dat BAT, PS1 va file PATCH cung cap voi frontend va backend trong thu muc goc HEXA.'
  }
  if (-not (Test-Path $patch)) { throw 'Thieu file HEXA-TICKET-TOGGLE.patch' }
  if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'Khong tim thay Git. Hay cai Git for Windows truoc.' }
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Khong tim thay Node.js 22+.' }

  # Applying again should do nothing. Existing uncommitted changes are kept.
  & git -C $root apply --reverse --check --whitespace=nowarn $patch 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) {
    Write-Host '[OK] Chuc nang bat/tat Ticket da co san. Khong can ap dung lai.' -ForegroundColor Green
    exit 0
  }

  Write-Host '[1/4] Kiem tra ban HEXA hien tai...' -ForegroundColor Cyan
  & git -C $root apply --check --whitespace=nowarn $patch
  if ($LASTEXITCODE -ne 0) {
    throw 'Khong khop phien ban code. Script da dung de bao ve thay doi tren may. Khong tu dong ghi de.'
  }

  $backup = Join-Path (Split-Path $root -Parent) ('HEXA_BACKUP_TICKET_' + (Get-Date -Format 'yyyyMMdd_HHmmss'))
  New-Item -Path $backup -ItemType Directory -Force | Out-Null
  foreach ($path in $targets) {
    $file = Join-Path $root $path
    $existing[$path] = Test-Path $file
    if ($existing[$path]) {
      $to = Join-Path $backup $path
      New-Item -Path (Split-Path $to -Parent) -ItemType Directory -Force | Out-Null
      Copy-Item -LiteralPath $file -Destination $to -Force
    }
  }
  Write-Host ('[2/4] Backup: ' + $backup)
  & git -C $root apply --whitespace=nowarn $patch
  if ($LASTEXITCODE -ne 0) { throw 'Git apply khong thanh cong.' }
  $applied = $true

  Write-Host '[3/4] Kiem tra backend va frontend...' -ForegroundColor Cyan
  foreach ($file in @('backend/src/app.js','backend/src/remind.js','backend/src/ticket-module.js','firebase/functions/worker/remind.js')) {
    & node --check (Join-Path $root $file)
    if ($LASTEXITCODE -ne 0) { throw ('Loi cu phap: ' + $file) }
  }
  & npm --prefix (Join-Path $root 'backend') test
  if ($LASTEXITCODE -ne 0) { throw 'Backend tests that bai.' }

  $vite = Join-Path $root 'frontend/node_modules/.bin/vite.cmd'
  if (Test-Path $vite) {
    Write-Host '[INFO] Dang build frontend bang Vite...' -ForegroundColor Cyan
    & npm --prefix (Join-Path $root 'frontend') run build
    if ($LASTEXITCODE -ne 0) { throw 'Frontend build that bai.' }
  } else {
    Write-Host '[INFO] Frontend chua cai node_modules: bo qua build tai may nay. Chay npm install va npm run build truoc deploy.' -ForegroundColor Yellow
  }
  Write-Host '[4/4] Hoan tat! Ticket OFF se an menu, chan API ghi ticket va tam dung nhac viec.' -ForegroundColor Green
  Write-Host 'Git changes:' -ForegroundColor Cyan
  & git -C $root status --short
  Write-Host 'Neu Firebase Cloud Functions dang chay, hay deploy lai functions de pause nhac viec tren cloud.' -ForegroundColor Yellow
  exit 0
}
catch {
  if ($applied -and $backup) {
    foreach ($path in $targets) {
      $dest = Join-Path $root $path
      $old = Join-Path $backup $path
      if ($existing[$path] -and (Test-Path $old)) {
        Copy-Item -LiteralPath $old -Destination $dest -Force
      } elseif (-not $existing[$path] -and (Test-Path $dest)) {
        Remove-Item -LiteralPath $dest -Force
      }
    }
    Write-Host '[ROLLBACK] Da khoi phuc cac file cu.' -ForegroundColor Yellow
  }
  Write-Host ('[ERROR] ' + $_.Exception.Message) -ForegroundColor Red
  exit 1
}
