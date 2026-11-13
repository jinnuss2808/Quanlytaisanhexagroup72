$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$projectRoot = $PSScriptRoot
$patchRoot = Join-Path $projectRoot 'patch'
$files = @(
 'frontend/src/AssetManagement.jsx',
 'frontend/src/PrinterManagement.jsx',
 'frontend/src/WarehouseManagement.jsx',
 'frontend/src/SortableHeader.jsx',
 'frontend/src/table-sort.js',
 'frontend/src/asset-management.css',
 'backend/src/asset-core.js',
 'backend/test/asset-column-sort.test.js',
 'frontend/test/table-sort.test.mjs'
)
function Join-ProjectPath($root,$relative) { Join-Path $root ($relative.Replace('/',[IO.Path]::DirectorySeparatorChar)) }

try {
  if (!(Test-Path -LiteralPath (Join-Path $projectRoot 'frontend/package.json')) -or
      !(Test-Path -LiteralPath (Join-Path $projectRoot 'backend/package.json'))) {
    throw 'Place these update files in the project root next to frontend and backend.'
  }
  foreach($rel in $files) {
    if(!(Test-Path -LiteralPath (Join-ProjectPath $patchRoot $rel))) {throw "Missing patch file: $rel"}
  }
  $expected = @{
    'frontend/src/AssetManagement.jsx'='export default function AssetManagement';
    'frontend/src/PrinterManagement.jsx'='export default function PrinterManagement';
    'frontend/src/WarehouseManagement.jsx'='export default function WarehouseManagement';
    'backend/src/asset-core.js'='export function selectAssets'
  }
  foreach($rel in $expected.Keys) {
    $target=Join-ProjectPath $projectRoot $rel
    if(!(Test-Path -LiteralPath $target)) {throw "Project source file not found: $rel"}
    if(!([IO.File]::ReadAllText($target).Contains($expected[$rel]))) {throw "Unexpected HEXA version: $rel. No changes made."}
  }
  $backupRoot=Join-Path $projectRoot ('.hexa-sort-backup\\'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
  Write-Host "Backup directory: $backupRoot" -ForegroundColor Cyan
  foreach($rel in $files) {
    $target=Join-ProjectPath $projectRoot $rel
    if(Test-Path -LiteralPath $target) {
      $backupTarget=Join-ProjectPath $backupRoot $rel
      New-Item -ItemType Directory -Path (Split-Path -Parent $backupTarget) -Force | Out-Null
      Copy-Item -LiteralPath $target -Destination $backupTarget -Force
    }
  }
  foreach($rel in $files) {
    $target=Join-ProjectPath $projectRoot $rel
    New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force | Out-Null
    Copy-Item -LiteralPath (Join-ProjectPath $patchRoot $rel) -Destination $target -Force
    Write-Host "Updated: $rel" -ForegroundColor Green
  }
  if(Get-Command node -ErrorAction SilentlyContinue) {
    Push-Location $projectRoot
    try {
      & node --test 'backend/test/asset-column-sort.test.js' 'frontend/test/table-sort.test.mjs'
      if ($LASTEXITCODE -ne 0) {throw 'Sort tests failed; old files can be recovered from backup directory.'}
    } finally {Pop-Location}
  } else {
    Write-Host 'Node not installed; automated local tests skipped.' -ForegroundColor Yellow
  }
  Write-Host '[OK] HEXA tables now support click-to-sort and click-again-to-clear.' -ForegroundColor Green
  Write-Host 'No .env, Firebase credentials, database entries or Git history were changed.'
  Write-Host 'Refresh browser with Ctrl+Shift+R (or restart Vite if needed).'
}
catch {
  Write-Host ('[ERROR] '+$_.Exception.Message) -ForegroundColor Red
  exit 1
}
