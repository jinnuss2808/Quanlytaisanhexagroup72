# HEXA: clean GitHub + Vercel deployment for Windows PowerShell 5.1+
# Never commit .env or Firebase Admin JSON. Only the API receives the service-account secret.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoName = 'ticket-asset-hexa'
$ApiProject = 'ticket-asset-hexa-api'
$FrontendProject = 'ticket-asset-hexa'
$VercelScope = 'trungs-projects' # Theo Vercel URL ma ban da gui; thay neu doi team
$ApiDomain = 'https://ticket-asset-hexa-api.vercel.app'
$WebDomain = 'https://ticket-asset-hexa.vercel.app'
$Work = Join-Path $env:TEMP ('hexa-clean-deploy-' + [guid]::NewGuid().ToString('N'))
$Repo = Join-Path $Work 'repo'

function Step([string]$message) { Write-Host "`n==== $message ====" -ForegroundColor Cyan }
function Require([string]$cmd, [string]$how) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { throw "Thieu $cmd. $how" }
}
function Run([string]$name, [string[]]$arguments) {
  # Windows PowerShell 5 can convert benign native stderr into terminating errors.
  $oldErrorPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    & $name @arguments
    $status = $LASTEXITCODE
  } finally { $ErrorActionPreference = $oldErrorPreference }
  if ($status -ne 0) { throw "Lenh that bai ($status): $name $($arguments -join ' ')" }
}
function Read-Env([string]$path) {
  if (-not (Test-Path -LiteralPath $path)) { throw "Thieu file cau hinh: $path" }
  $values = @{}
  foreach ($line in [IO.File]::ReadAllLines($path)) {
    if ($line -match '^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$') {
      $key = $matches[1]; $value = $matches[2].Trim()
      if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) {
        $value = $value.Substring(1, $value.Length - 2)
      }
      $values[$key] = $value
    }
  }
  return $values
}
function Is-Excluded([string]$rel) {
  $parts = $rel -split '[\\/]'
  foreach ($part in $parts) {
    if ($part -in @('node_modules','.git','.vercel','dist','coverage','build','.next')) { return $true }
  }
  $name = $parts[-1]
  if ($name -match '^\.env($|\.)' -and $name -ne '.env.example') { return $true }
  if ($name -match '(?i)(service[-_]?account|firebase[-_]?admin|serviceAccountKey)') { return $true }
  if ($name -match '(?i)(\.pem|\.p12|\.pfx|\.key|\.zip|\.7z|\.rar|\.log)$') { return $true }
  if ($name -match '(?i)\.bak-|^\.env\.local$') { return $true }
  if ($name -match '(?i)^(\.npmrc|\.pypirc|\.netrc|credentials\.json|token\.json|id_rsa)$') { return $true }
  return $false
}
# Only output paths that must NEVER be committed. This is intentionally separate
# from the copy filter: it checks the actual Git index and reports precise names.
# IMPORTANT: .env.example is a harmless template and MUST be allowed.
function Get-BlockedGitPaths([string[]]$paths) {
  foreach ($rawPath in $paths) {
    if ($null -eq $rawPath) { continue }
    $rel = ([string]$rawPath).Trim().Replace('\', '/')
    if ($rel.Length -eq 0) { continue }
    $parts = @($rel -split '/')
    $file = $parts[$parts.Length - 1]
    if ($file -ieq '.env.example') { continue }

    $blocked = $false
    if ($file -match '(?i)^\.env($|\.)') { $blocked = $true }
    if ($file -match '(?i)(service[-_]?account|firebase[-_]?admin|serviceAccountKey)') { $blocked = $true }
    if ($file -match '(?i)(\.pem|\.p12|\.pfx|\.key|\.zip|\.7z|\.rar|\.log)$') { $blocked = $true }
    if ($file -match '(?i)^(\.npmrc|\.pypirc|\.netrc|credentials\.json|token\.json|id_rsa)$') { $blocked = $true }
    foreach ($part in $parts) {
      if ($part -in @('node_modules','.vercel','dist','coverage','build','.next','.git','.ssh','.aws')) {
        $blocked = $true
      }
    }
    if ($blocked) { Write-Output $rel }
  }
}

function Copy-SafeProject([string]$from, [string]$to) {
  foreach ($folder in @('frontend','backend','firebase','docs')) {
    $source = Join-Path $from $folder
    if (-not (Test-Path -LiteralPath $source)) { continue }
    foreach ($item in Get-ChildItem -LiteralPath $source -Force -File -Recurse) {
      $relative = $item.FullName.Substring($from.Length).TrimStart([char]92,[char]47)
      if (Is-Excluded $relative) { continue }
      $dest = Join-Path $to $relative
      $destDir = Split-Path -Parent $dest
      if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Force -Path $destDir | Out-Null }
      Copy-Item -LiteralPath $item.FullName -Destination $dest -Force
    }
  }
  foreach ($name in @('.gitignore','README.md','DEPLOY_TICKET_ASSET_HEXA.bat','DEPLOY_TICKET_ASSET_HEXA.ps1','HUONG_DAN_DEPLOY.md')) {
    $source = Join-Path $from $name
    if (Test-Path -LiteralPath $source) { Copy-Item -LiteralPath $source -Destination (Join-Path $to $name) -Force }
  }
  $gitignore = Join-Path $to '.gitignore'
  Add-Content -LiteralPath $gitignore -Encoding UTF8 -Value "`n.env`n.env.*`n!.env.example`n**/.env`n**/.env.*`n!**/.env.example`n**/service-account.json`n**/*firebase-admin*.json`n**/*serviceAccountKey*.json`n**/node_modules/`n**/.vercel/`n**/dist/`n"
}
function Set-VercelVariable([string]$key, [string]$value, [string]$kind) {
  if ([string]::IsNullOrWhiteSpace($value)) { throw "Bien moi truong $key dang trong." }
  # Supply value through stdin, never as a command line argument or printed in terminal.
  $temp = Join-Path $env:TEMP ('hexa-env-' + [guid]::NewGuid().ToString('N') + '.txt')
  try {
    [IO.File]::WriteAllText($temp, $value, (New-Object System.Text.UTF8Encoding($false)))
    Write-Host "Cau hinh Vercel: $key ($kind)"
    $command = 'vercel env add ' + $key + ' production --type ' + $kind + ' --force --yes < "' + $temp + '"'
    & cmd.exe /d /c $command
    if ($LASTEXITCODE -ne 0) { throw "Vercel khong cap nhat duoc: $key" }
  } finally {
    if (Test-Path -LiteralPath $temp) { Remove-Item -LiteralPath $temp -Force }
  }
}
function Link-Vercel([string]$dir, [string]$name) {
  Push-Location $dir
  try { Run 'vercel' @('link','--yes','--project',$name,'--scope',$VercelScope,'--no-color') }
  finally { Pop-Location }
}
function Check-Api([string]$url) {
  try {
    $res = Invoke-WebRequest -Uri ($url.TrimEnd('/') + '/api/health') -UseBasicParsing -TimeoutSec 35 -MaximumRedirection 3
    $data = $res.Content | ConvertFrom-Json
    Write-Host ('API HTTP ' + [int]$res.StatusCode + ', ok=' + $data.ok)
    if ([int]$res.StatusCode -ne 200 -or $data.ok -ne $true) { throw 'Health check khong tra ve ok:true.' }
  } catch {
    $httpStatus = 'unknown'
    if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
      $httpStatus = [int]$_.Exception.Response.StatusCode
    }
    Write-Host ('API health FAILED. HTTP: ' + $httpStatus) -ForegroundColor Red
    Write-Host ('URL: ' + $url + '/api/health')
    Write-Host 'HTTP 404: kiem tra backend/index.js va Vercel Root Directory.'
    Write-Host 'HTTP 401/403: kiem tra Vercel Deployment Protection (Production).'
    Write-Host 'HTTP 500: xem Vercel Functions logs / service account / env.'
    throw
  }
}
try {
  Step '0. Kiem tra project va cong cu'
  foreach ($path in @('frontend/package.json','backend/package.json','backend/index.js','backend/service-account.json','frontend/.env','backend/.env')) {
    if (-not (Test-Path (Join-Path $Root $path))) { throw "Thieu $path trong thu muc $Root" }
  }
  Require 'git' 'Cai Git for Windows: https://git-scm.com/downloads/win'
  Require 'gh' 'Cai GitHub CLI: winget install --id GitHub.cli -e'
  Require 'node' 'Cai Node.js 22+'; Require 'npm' 'Cai npm'
  if (-not (Get-Command vercel -ErrorAction SilentlyContinue)) {
    Step 'Cai Vercel CLI'
    Run 'npm' @('install','-g','vercel@latest')
  }
  $backendEnv = Read-Env (Join-Path $Root 'backend/.env')
  $frontendEnv = Read-Env (Join-Path $Root 'frontend/.env')
  $accountPath = Join-Path $Root 'backend/service-account.json'
  $serviceRaw = [IO.File]::ReadAllBytes($accountPath)
  $serviceAccount = ([Text.Encoding]::UTF8.GetString($serviceRaw) | ConvertFrom-Json)
  if (-not $serviceAccount.project_id -or -not $serviceAccount.private_key) { throw 'Firebase Service Account JSON khong hop le.' }
  if ($backendEnv.FIREBASE_PROJECT_ID -ne $serviceAccount.project_id) { throw 'FIREBASE_PROJECT_ID khong khop Service Account.' }
  foreach ($key in @('VITE_FIREBASE_API_KEY','VITE_FIREBASE_AUTH_DOMAIN','VITE_FIREBASE_PROJECT_ID','VITE_FIREBASE_APP_ID','VITE_FIREBASE_DATABASE_URL')) {
    if (-not $frontendEnv[$key] -or $frontendEnv[$key] -match '(YOUR|DIEN_|123456789:web:abcd)') { throw "Thieu gia tri Firebase Web that: $key" }
  }
  if ($frontendEnv.VITE_FIREBASE_PROJECT_ID -ne $backendEnv.FIREBASE_PROJECT_ID) { throw 'Frontend va backend dang dung 2 Firebase project khac nhau.' }
  if (-not $backendEnv.FIREBASE_DATABASE_URL) { throw 'Thieu FIREBASE_DATABASE_URL.' }

  Step '1. Kiem tra logic backend va build React local'
  Push-Location (Join-Path $Root 'backend')
  try { Run 'npm' @('ci'); Run 'npm' @('test'); Run 'node' @('--check','index.js') }
  finally { Pop-Location }
  Push-Location (Join-Path $Root 'frontend')
  try { Run 'npm' @('ci'); Run 'npm' @('run','build') }
  finally { Pop-Location }

  Step '2. Dang nhap GitHub / Vercel'
  & cmd.exe /d /c 'gh auth status >NUL 2>NUL'
  if ($LASTEXITCODE -ne 0) { Run 'gh' @('auth','login','--web','--git-protocol','https') }
  Run 'gh' @('auth','setup-git')
  & cmd.exe /d /c 'vercel whoami --no-color >NUL 2>NUL'
  if ($LASTEXITCODE -ne 0) { Run 'vercel' @('login') }
  $owner = ((& gh api user --jq '.login') | Out-String).Trim()
  $id = ((& gh api user --jq '.id') | Out-String).Trim()
  if ($LASTEXITCODE -ne 0 -or -not $owner) { throw 'Khong lay duoc tai khoan GitHub.' }

  Step '3. Tao hoac cap nhat GitHub PRIVATE repository'
  & cmd.exe /d /c ('gh repo view ' + $owner + '/' + $RepoName + ' --json isPrivate >NUL 2>NUL')
  if ($LASTEXITCODE -ne 0) { Run 'gh' @('repo','create',($owner + '/' + $RepoName),'--private') }
  $info = ((& gh repo view ($owner + '/' + $RepoName) --json 'isPrivate') | Out-String | ConvertFrom-Json)
  if (-not $info.isPrivate) { throw 'GITHUB REPO DANG PUBLIC! Khong duoc day ma nguon/credential.' }
  New-Item -ItemType Directory -Force -Path $Work | Out-Null
  Run 'git' @('clone',('https://github.com/' + $owner + '/' + $RepoName + '.git'),$Repo)
  # Reject repositories that already committed credentials. Removing later commits cannot erase their history.
  $tracked = @(& git -C $Repo ls-files)
  if ($LASTEXITCODE -ne 0) { throw 'Khong doc duoc danh sach file Git cu.' }
  $trackedBlocked = @(Get-BlockedGitPaths $tracked)
  if ($trackedBlocked.Count -gt 0) {
    Write-Host '[SECURITY] Repo GitHub da theo doi cac file khong duoc push:' -ForegroundColor Red
    $trackedBlocked | ForEach-Object { Write-Host ('  - ' + $_) -ForegroundColor Red }
    throw 'GitHub repo cu dang track credential. KHONG push. Can xoa credential khoi history va thu hoi key neu da lo.'
  }
  Get-ChildItem -LiteralPath $Repo -Force | Where-Object { $_.Name -ne '.git' } | Remove-Item -Recurse -Force
  Copy-SafeProject $Root $Repo
  Run 'git' @('-C',$Repo,'config','user.name',$owner)
  Run 'git' @('-C',$Repo,'config','user.email',($id + '+' + $owner + '@users.noreply.github.com'))
  # LF/CRLF warnings from Git are informational, not fatal.
  # .gitattributes also keeps JS/CSS files consistent across Windows/Linux.
  $attrs = Join-Path $Repo '.gitattributes'
  [IO.File]::WriteAllText($attrs, "* text=auto`n*.js text eol=lf`n*.jsx text eol=lf`n*.json text eol=lf`n*.css text eol=lf`n*.sh text eol=lf`n*.bat text eol=crlf`n*.ps1 text eol=crlf`n", (New-Object System.Text.UTF8Encoding($false)))
  Run 'git' @('-C',$Repo,'add','-A')
  $staged = @(& git -C $Repo diff --cached --name-only)
  if ($LASTEXITCODE -ne 0) { throw 'Khong doc duoc Git staging.' }
  Write-Host ('Git staging: ' + $staged.Count + ' files. Dang kiem tra duong dan nhay cam...')
  $blocked = @(Get-BlockedGitPaths $staged)
  if ($blocked.Count -gt 0) {
    Write-Host '[SECURITY] Danh sach file bi chan:' -ForegroundColor Red
    $blocked | ForEach-Object { Write-Host ('  - ' + $_) -ForegroundColor Red }
    throw 'Phat hien file nhay cam trong Git staging. KHONG push. Kiem tra danh sach o tren.'
  }
  Write-Host '[OK] Git staging an toan; .env.example, .vercelignore va source code duoc cho phep.' -ForegroundColor Green
  # Safety net: scan staged files for an actual PEM private key block (not just a source-code variable name).
  foreach ($rel in $staged) {
    $p = Join-Path $Repo $rel
    if (-not (Test-Path -LiteralPath $p -PathType Leaf)) { continue }
    $info = Get-Item -LiteralPath $p
    if ($info.Length -gt 1048576) { continue }
    $raw = [IO.File]::ReadAllText($p)
    if ($raw -match '-----BEGIN (?:RSA )?PRIVATE KEY-----?
[A-Za-z0-9+/=]{16,}') {
      throw ('[SECURITY] File co noi dung private key: ' + $rel + '. Khong push.')
    }
  }
  & git -C $Repo diff --cached --quiet
  if ($LASTEXITCODE -ne 0) { Run 'git' @('-C',$Repo,'commit','-m','HEXA: rebuild Express API and robust React deployment') }
  Run 'git' @('-C',$Repo,'push','-u','origin','HEAD')
  Write-Host ('GITHUB: https://github.com/' + $owner + '/' + $RepoName) -ForegroundColor Green

  Step ('4. Vercel backend Express - project ' + $ApiProject)
  $apiDir = Join-Path $Repo 'backend'
  Link-Vercel $apiDir $ApiProject
  Push-Location $apiDir
  try {
    Set-VercelVariable 'NODE_ENV' 'production' 'config'
    Set-VercelVariable 'FIREBASE_PROJECT_ID' $backendEnv.FIREBASE_PROJECT_ID 'config'
    Set-VercelVariable 'FIREBASE_DATABASE_URL' $backendEnv.FIREBASE_DATABASE_URL 'config'
    Set-VercelVariable 'FIREBASE_SERVICE_ACCOUNT_BASE64' ([Convert]::ToBase64String($serviceRaw)) 'secret'
    Set-VercelVariable 'CLIENT_ORIGINS' $WebDomain 'config'
    foreach ($key in @('SMTP_HOST','SMTP_PORT','SMTP_SECURE','SMTP_USER','SMTP_PASSWORD','SMTP_FROM','IT_NOTIFICATION_EMAILS')) {
      if ($backendEnv.ContainsKey($key) -and -not [string]::IsNullOrWhiteSpace($backendEnv[$key])) {
        $kind = if ($key -eq 'SMTP_PASSWORD' -or $key -eq 'SMTP_USER') { 'secret' } else { 'config' }
        Set-VercelVariable $key $backendEnv[$key] $kind
      }
    }
    Run 'vercel' @('deploy','--prod','--yes','--no-color')
  } finally { Pop-Location }
  Step '5. Kiem tra API production truoc khi deploy frontend'
  Check-Api $ApiDomain

  Step '6. Deploy frontend React/Vite'
  $webDir = Join-Path $Repo 'frontend'
  Link-Vercel $webDir $FrontendProject
  Push-Location $webDir
  try {
    foreach ($key in @('VITE_FIREBASE_API_KEY','VITE_FIREBASE_AUTH_DOMAIN','VITE_FIREBASE_PROJECT_ID','VITE_FIREBASE_APP_ID','VITE_FIREBASE_DATABASE_URL')) {
      Set-VercelVariable $key $frontendEnv[$key] 'config'
    }
    Set-VercelVariable 'VITE_API_URL' $ApiDomain 'config'
    Run 'vercel' @('deploy','--prod','--yes','--no-color')
  } finally { Pop-Location }
  Write-Host "`nHOAN TAT" -ForegroundColor Green
  Write-Host ('Website: ' + $WebDomain + '/it')
  Write-Host ('API: ' + $ApiDomain + '/api/health')
  Write-Host ('Git: https://github.com/' + $owner + '/' + $RepoName)
  Write-Host 'Firebase Authentication > Authorized domains: them ticket-asset-hexa.vercel.app neu chua co.'
  Write-Host 'Can Cloud Functions (Firebase Blaze) de tu dong giao viec/nhac viec khi tat may Windows.'
  Write-Host 'Bat dau kiem tra tu /it va 250 tai san hien co. Du lieu Firebase khong bi xoa.'
} catch {
  Write-Host "`n[DEPLOY FAILED] $($_.Exception.Message)" -ForegroundColor Red
  Write-Host ('Thu muc tam de xem lai: ' + $Work)
  Write-Host 'Neu API 404/500: Vercel > ticket-asset-hexa-api > Logs va Settings > Root Directory.'
  exit 1
}
