# HEXA React blank-screen repair + validated private GitHub/Vercel deploy.
# It reads existing local .env files, and NEVER commits .env or Firebase Admin keys.
# Requires user-approved browser login to GitHub/Vercel on the first run.
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string] $ProjectRoot
)
$ErrorActionPreference = 'Stop'
$ProjectRoot = [IO.Path]::GetFullPath($ProjectRoot.Trim('"').TrimEnd('\','/'))
$ScriptDir = Split-Path -Parent $PSCommandPath
$RepoName = 'ticket-asset-hexa'
$FrontendName = 'ticket-asset-hexa'
$BackendName = 'ticket-asset-hexa-api'
$script:Git = $null
$script:Gh = $null
$script:Vercel = $null
$script:Npm = $null
$script:Node = $null
$script:Firebase = $null

function Header([string] $title) {
  Write-Host "`n======= $title =======" -ForegroundColor Cyan
}
function Fail([string] $msg) { throw $msg }
function Find-Command([string[]] $names) {
  foreach ($n in $names) {
    $cmd = Get-Command $n -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($cmd) { return $cmd.Source }
  }
  return $null
}
function Run([string] $tool, [string[]] $arguments) {
  & $tool @arguments
  if ($LASTEXITCODE -ne 0) { Fail "Lenh that bai (exit $LASTEXITCODE): $([IO.Path]::GetFileName($tool)) $($arguments -join ' ')" }
}
function Try-Native([string] $tool, [string[]] $arguments) {
  $oldPref = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    $data = @(& $tool @arguments 2>$null)
    return @{ Data = $data; Code = $LASTEXITCODE }
  } finally { $ErrorActionPreference = $oldPref }
}
function Require-Files {
  foreach ($relative in @('frontend/package.json','frontend/.env','backend/package.json','backend/.env','backend/service-account.json')) {
    if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot $relative) -PathType Leaf)) {
      Fail "Thieu $relative. Hay dung ban HEXA da duoc cau hinh; KHONG can gui khoa JSON cho ai."
    }
  }
  if (-not (Test-Path (Join-Path $ProjectRoot 'frontend/vercel.json'))) {
    Fail 'Thieu frontend/vercel.json (cau hinh SPA).'
  }
  $candidate = (Resolve-Path -LiteralPath $ProjectRoot).Path
  if ($candidate -match '(^|[\\/])node_modules([\\/]|$)') { Fail 'Duong dan project khong hop le.' }
}
function Read-DotEnv([string] $path) {
  $out = @{}
  foreach ($raw in [IO.File]::ReadAllLines($path)) {
    $line = $raw.Trim()
    if ($line.Length -eq 0 -or $line.StartsWith('#')) { continue }
    if ($line -match '^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
      $name = $Matches[1]; $value = $Matches[2].Trim()
      if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) {
        $value = $value.Substring(1,$value.Length-2)
      }
      $out[$name] = $value
    }
  }
  return $out
}
function Install-By-Winget([string] $id) {
  $wg = Find-Command @('winget.exe','winget')
  if (-not $wg) { Fail "Thieu $id va khong co winget. Hay cai ung dung va chay lai BAT." }
  Write-Host "Dang cai $id qua winget (co the can xac nhan)..." -ForegroundColor Yellow
  Run $wg @('install','--id',$id,'--exact','--source','winget','--accept-package-agreements','--accept-source-agreements')
}
function Setup-Tools {
  Header '1. KIEM TRA CONG CU'
  $script:Node = Find-Command @('node.exe','node')
  $script:Npm = Find-Command @('npm.cmd','npm')
  if (-not $script:Node -or -not $script:Npm) { Fail 'Can Node.js 22+ va npm. Cai tai https://nodejs.org va chay lai.' }
  $v = (& $script:Node -v).Trim()
  if ($v -notmatch '^v(\d+)\.' -or [int]$Matches[1] -lt 22) { Fail "Can Node.js >=22; hien tai la $v." }

  $script:Git = Find-Command @('git.exe','git')
  if (-not $script:Git) {
    Install-By-Winget 'Git.Git'
    $script:Git = Find-Command @('git.exe','git')
    if (-not $script:Git -and (Test-Path "$env:ProgramFiles\Git\cmd\git.exe")) { $script:Git="$env:ProgramFiles\Git\cmd\git.exe" }
    if (-not $script:Git) { Fail 'Git da cai nhung chua vao PATH. Dong va mo lai CMD, sau do chay BAT.' }
  }

  $script:Gh = Find-Command @('gh.exe','gh')
  if (-not $script:Gh) {
    Install-By-Winget 'GitHub.cli'
    $script:Gh = Find-Command @('gh.exe','gh')
    if (-not $script:Gh -and (Test-Path "$env:ProgramFiles\GitHub CLI\gh.exe")) { $script:Gh="$env:ProgramFiles\GitHub CLI\gh.exe" }
    if (-not $script:Gh) { Fail 'GitHub CLI da cai nhung chua vao PATH. Mo lai CMD va chay BAT.' }
  }

  $script:Vercel = Find-Command @('vercel.cmd','vercel')
  if (-not $script:Vercel) {
    Write-Host 'Dang cai Vercel CLI...' -ForegroundColor Yellow
    Run $script:Npm @('install','--global','vercel')
    $script:Vercel = Find-Command @('vercel.cmd','vercel')
    if (-not $script:Vercel) {
      $npmPrefix = (& $script:Npm 'prefix' '--global' | Select-Object -Last 1).Trim()
      if ($npmPrefix -and (Test-Path (Join-Path $npmPrefix 'vercel.cmd'))) { $script:Vercel = Join-Path $npmPrefix 'vercel.cmd' }
    }
    if (-not $script:Vercel) { Fail 'Cai Vercel CLI xong nhung khong tim thay lenh vercel. Mo lai CMD va chay BAT.' }
  }
  Write-Host "Node $v / Git, GitHub CLI, Vercel CLI: OK" -ForegroundColor Green
}
function Authenticate {
  Header '2. DANG NHAP GITHUB + VERCEL'
  $ghCheck = Try-Native $script:Gh @('auth','status')
  if ($ghCheck.Code -ne 0) {
    Write-Host 'Chua dang nhap GitHub CLI, trinh duyet se yeu cau ban dang nhap...' -ForegroundColor Yellow
    Run $script:Gh @('auth','login','--hostname','github.com','--git-protocol','https','--web')
  }
  Run $script:Gh @('auth','setup-git')
  $vcCheck = Try-Native $script:Vercel @('whoami')
  if ($vcCheck.Code -ne 0) {
    Write-Host 'Chua dang nhap Vercel CLI, trinh duyet se yeu cau ban dang nhap...' -ForegroundColor Yellow
    Run $script:Vercel @('login')
  }
}
function Fix-And-Verify {
  Header '3. VA LOI TRANG TRANG + KIEM TRA BUILD'
  $patch = Join-Path $ScriptDir 'PATCH_HEXA_SAFE.cjs'
  if (-not (Test-Path -LiteralPath $patch)) { Fail 'Thieu PATCH_HEXA_SAFE.cjs ben canh file BAT.' }
  Run $script:Node @($patch,$ProjectRoot)
  $frontApp = [IO.File]::ReadAllText((Join-Path $ProjectRoot 'frontend/src/App.jsx'))
  if (-not $frontApp.Contains('class HexaErrorBoundary extends React.Component')) { Fail 'React ErrorBoundary chua duoc them.' }
  if ($frontApp -match 'equalTo\s*\(\s*user\.uid\s*\)') { Fail 'Truy van Firebase chua duoc bao ve.' }
  foreach ($folder in @('backend','frontend')) {
    $workdir = Join-Path $ProjectRoot $folder
    Push-Location $workdir
    try {
      if (-not (Test-Path 'node_modules')) {
        Write-Host "Dang cai npm dependencies cho $folder..." -ForegroundColor Yellow
        Run $script:Npm @('install','--no-audit','--no-fund')
      }
      if ($folder -eq 'backend') {
        Run $script:Node @('--check','src/app.js')
        Run $script:Npm @('test')
      } else {
        Run $script:Npm @('run','build')
        if (-not (Test-Path 'dist/index.html')) { Fail 'Frontend build khong tao dist/index.html.' }
      }
    } finally { Pop-Location }
  }
  Write-Host 'React build, backend syntax/test: PASS' -ForegroundColor Green
}

function Protect-Git {
  Header '3. KIEM TRA AN TOAN GIT'
  $ignore = Join-Path $ProjectRoot '.gitignore'
  $content = if (Test-Path $ignore) { [IO.File]::ReadAllText($ignore) } else { '' }
  $newPatterns = @(
    '# HEXA: protect private credentials',
    '.env', '.env.*', '!.env.example', '**/.env', '**/.env.*', '!**/.env.example',
    '**/service-account.json', '**/*firebase-admin*.json', '**/*serviceAccountKey*.json',
    '**/*.pem', '**/*.p12', '**/*.pfx', '**/id_rsa',
    '.vercel/', '**/.vercel/', '**/node_modules/', '**/dist/', '*.zip', '*.7z', '*.rar'
  )
  if ($content -notmatch '(?m)^# HEXA: protect private credentials\s*$') {
    Add-Content -LiteralPath $ignore -Value ([Environment]::NewLine + ($newPatterns -join [Environment]::NewLine)) -Encoding UTF8
  }
  Push-Location $ProjectRoot
  try {
    $gitCheck = Try-Native $script:Git @('rev-parse','--show-toplevel')
    if ($gitCheck.Code -eq 0) {
      $gitTop = [string]($gitCheck.Data | Select-Object -Last 1)
      if ([IO.Path]::GetFullPath($gitTop.Trim()) -ne [IO.Path]::GetFullPath($ProjectRoot)) {
        Fail 'Project nam trong mot Git repository khac. Dung lai de tranh push nham repo.'
      }
    } else {
      Run $script:Git @('init','-b','main')
    }
    # A previously tracked key may leak even if it is ignored now.
    $history = @( (Try-Native $script:Git @('log','--all','--name-only','--pretty=format:')).Data )
    $tracked = @(& $script:Git ls-files)
    foreach ($p in ($history + $tracked)) {
      if ($p -and (Is-SecretPath $p)) { Fail "Git history/index da co file nhay cam: $p. Hay xoa khoi lich su va thu hoi khoa truoc khi push." }
    }
    $branch = (& $script:Git branch --show-current | Select-Object -Last 1)
    if ($branch -and $branch.Trim() -ne 'main') {
      Fail "Nhanh Git hien tai la '$branch', script chi push main. Hay doi sang main truoc khi deploy."
    }
    Run $script:Git @('add','-A')
    $staged = @(& $script:Git diff --cached --name-only)
    foreach ($p in $staged) {
      if ($p -and (Is-SecretPath $p)) { Run $script:Git @('reset'); Fail "Chan push vi file nhay cam: $p" }
    }
    & $script:Git diff --cached --quiet
    if ($LASTEXITCODE -ne 0) {
      $author = (& $script:Git config user.name)
      $email = (& $script:Git config user.email)
      if (-not $author -or -not $email) {
        # Configure local (not global) Git author with GitHub's private noreply address.
        $login = (& $script:Gh api user --jq '.login' | Select-Object -Last 1).Trim()
        $userId = (& $script:Gh api user --jq '.id' | Select-Object -Last 1).Trim()
        if (-not $login -or $userId -notmatch '^\d+$') { Fail 'Khong lay duoc GitHub login/id de cau hinh Git author.' }
        if (-not $author) { Run $script:Git @('config','--local','user.name',$login) }
        if (-not $email) { Run $script:Git @('config','--local','user.email',"$userId+$login@users.noreply.github.com") }
        Write-Host 'Da tu cau hinh Git author (GitHub noreply) chi cho repo nay.'
      }
      Run $script:Git @('commit','-m','Deploy HEXA ticket + asset to Vercel')
    } else {
      Write-Host 'Khong co thay doi Git moi.'
    }
  } finally { Pop-Location }
}
function Is-SecretPath([string]$p) {
  $p = $p.Replace('\','/')
  if ($p -match '(?i)(^|/)(\.env(?:\..*)?|service-account\.json|id_rsa)$' -and $p -notmatch '(?i)(^|/)\.env\.example$') { return $true }
  if ($p -match '(?i)(^|/)[^/]*(?:firebase-admin|serviceaccountkey)[^/]*\.json$') { return $true }
  if ($p -match '(?i)\.(pem|p12|pfx|zip|7z|rar)$') { return $true }
  if ($p -match '(?i)(^|/)(\.vercel|node_modules|dist)/') { return $true }
  return $false
}
function Push-GitHub {
  Header '4. GIT PUSH -> PRIVATE GITHUB'
  Push-Location $ProjectRoot
  try {
    $owner = (& $script:Gh api user --jq '.login' | Select-Object -Last 1).Trim()
    if ($LASTEXITCODE -ne 0 -or -not $owner) { Fail 'Khong lay duoc tai khoan GitHub.' }
    $full = "$owner/$RepoName"
    $remoteCheck = Try-Native $script:Git @('remote','get-url','origin')
    if ($remoteCheck.Code -eq 0) {
      $origin = [string]($remoteCheck.Data | Select-Object -Last 1)
      if ($origin -notmatch '(?i)github\.com[:/].+/ticket-asset-hexa(?:\.git)?$') {
        Fail "Origin dang tro toi repo khac: $origin. Khong tu dong ghi de."
      }
    } else {
      $repoCheck = Try-Native $script:Gh @('repo','view',$full,'--json','name')
      if ($repoCheck.Code -eq 0) {
        Run $script:Git @('remote','add','origin',"https://github.com/$full.git")
      } else {
        Run $script:Gh @('repo','create',$full,'--private','--source',$ProjectRoot,'--remote','origin')
      }
    }
    # Confirm it is private; do not change an existing public repository automatically.
    $visibility = (& $script:Gh repo view $full --json visibility --jq '.visibility' | Select-Object -Last 1).Trim()
    if ($LASTEXITCODE -ne 0 -or $visibility -notin @('PRIVATE','private')) {
      Fail "Repo $full khong PRIVATE. Dung lai de tranh lo ma nguon."
    }
    # No --force: refuse to overwrite work on GitHub.
    Run $script:Git @('push','-u','origin','HEAD:main')
    Write-Host "Da push private repo: https://github.com/$full" -ForegroundColor Green
  } finally { Pop-Location }
}
function Link-Project([string]$directory,[string]$name) {
  Push-Location $directory
  try {
    Write-Host "Lien ket Vercel Project: $name"
    Run $script:Vercel @('link','--yes','--project',$name)
    $linked = Join-Path $directory '.vercel/project.json'
    if (-not (Test-Path $linked)) { Fail "Vercel CLI chua tao lien ket o $directory. Kiem tra thong bao phia tren." }
  } finally { Pop-Location }
}
function Set-VercelEnv([string]$directory,[string]$key,[string]$value,[bool]$sensitive=$false) {
  if ([string]::IsNullOrWhiteSpace($value)) { return }
  if ($value -match '\r|\n') { Fail "Bien $key co xuong dong, khong the nhap tu dong an toan." }
  Push-Location $directory
  try {
    # Vercel CLI 2026 requires an explicit Config/Secret type.
    # VITE_* values are bundled into browser JavaScript, so they MUST be Config.
    # Backend credential values stay Secret and are never exposed as VITE_*.
    if ($key.StartsWith('VITE_') -and $sensitive) {
      Fail "Khong the dat $key lam Secret: ten VITE_ se duoc nhung vao bundle frontend."
    }
    $type = if ($sensitive) { 'secret' } else { 'config' }
    $envArgs = @('env','add',$key,'--environment','production','--type',$type,'--force')
    # Send the value only through stdin. Never echo secrets or use --build-env CLI args.
    $value | & $script:Vercel @envArgs
    if ($LASTEXITCODE -ne 0) { Fail "Khong the cap nhat bien Vercel $key. Kiem tra quyen Vercel/plan." }
  } finally { Pop-Location }
}
function Deploy-Vercel([string]$directory,[string]$name) {
  Push-Location $directory
  try {
    Header "DEPLOY $name"
    $lines = @(& $script:Vercel deploy --prod --yes --no-color)
    $result = $LASTEXITCODE
    foreach ($line in $lines) { if ($line) { Write-Host $line } }
    if ($result -ne 0) { Fail "Vercel deploy $name that bai (exit $result)." }
    $url = ''
    foreach ($line in $lines) {
      $m = [regex]::Matches([string]$line,'https://[A-Za-z0-9][A-Za-z0-9.-]*\.vercel\.app(?:/[^\s]*)?')
      foreach ($mm in $m) { $url = $mm.Value.TrimEnd('/').Split('?')[0] }
    }
    if (-not $url) {
      Fail "Vercel deploy hoan thanh nhung khong lay duoc URL project $name tu terminal. Dung lai de tranh ghi sai VITE_API_URL."
    }
    return $url
  } finally { Pop-Location }
}
function Deploy-Cloud {
  Header '5. DEPLOY NODE API TREN VERCEL'
  $backendDir = Join-Path $ProjectRoot 'backend'
  $frontendDir = Join-Path $ProjectRoot 'frontend'
  $backEnv = Read-DotEnv (Join-Path $backendDir '.env')
  $frontEnv = Read-DotEnv (Join-Path $frontendDir '.env')
  foreach ($key in @('FIREBASE_PROJECT_ID','FIREBASE_DATABASE_URL')) {
    if (-not $backEnv[$key]) { Fail "backend/.env thieu $key" }
  }
  foreach ($key in @('VITE_FIREBASE_API_KEY','VITE_FIREBASE_AUTH_DOMAIN','VITE_FIREBASE_PROJECT_ID','VITE_FIREBASE_APP_ID','VITE_FIREBASE_DATABASE_URL')) {
    if (-not $frontEnv[$key] -or $frontEnv[$key] -match '^(API_KEY_CUA_BAN|DIEN_|your-|your_-)') { Fail "frontend/.env chua co gia tri that: $key" }
  }
  $keyfile = Join-Path $backendDir 'service-account.json'
  $keyJson = Get-Content -LiteralPath $keyfile -Raw -Encoding UTF8 | ConvertFrom-Json
  if ($keyJson.project_id -ne $backEnv['FIREBASE_PROJECT_ID']) { Fail 'FIREBASE_PROJECT_ID khong khop voi service-account.json.' }
  $key64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($keyfile))

  Link-Project $backendDir $BackendName
  Set-VercelEnv $backendDir 'FIREBASE_PROJECT_ID' $backEnv['FIREBASE_PROJECT_ID']
  Set-VercelEnv $backendDir 'FIREBASE_DATABASE_URL' $backEnv['FIREBASE_DATABASE_URL']
  Set-VercelEnv $backendDir 'FIREBASE_SERVICE_ACCOUNT_BASE64' $key64 $true
  Set-VercelEnv $backendDir 'CLIENT_ORIGINS' "https://$FrontendName.vercel.app"
  # Optional email notifications - never print SMTP_PASSWORD.
  foreach ($k in @('SMTP_HOST','SMTP_PORT','SMTP_SECURE','SMTP_USER','SMTP_PASSWORD','SMTP_FROM','IT_NOTIFICATION_EMAILS')) {
    if ($backEnv.ContainsKey($k) -and $backEnv[$k]) {
      Set-VercelEnv $backendDir $k $backEnv[$k] ($k -eq 'SMTP_PASSWORD')
    }
  }
  $apiUrl = Deploy-Vercel $backendDir $BackendName
  if ($apiUrl -notmatch '^https://') { Fail 'API Vercel URL khong hop le.' }
  Write-Host "API URL: $apiUrl" -ForegroundColor Green
  # Before shipping a frontend, verify the API is not a 404/500 page.
  try {
    $apiHealth = Invoke-RestMethod -Uri ($apiUrl.TrimEnd('/') + '/api/health') -TimeoutSec 30
    if ($apiHealth.ok -ne $true) { Fail 'API /api/health khong tra ok=true. Khong deploy frontend.' }
    Write-Host 'API health OK.' -ForegroundColor Green
  } catch { Fail ('API khong hoat dong tren Vercel: ' + $_.Exception.Message) }


  Header '6. DEPLOY REACT FRONTEND TREN VERCEL'
  Link-Project $frontendDir $FrontendName
  foreach ($k in @('VITE_FIREBASE_API_KEY','VITE_FIREBASE_AUTH_DOMAIN','VITE_FIREBASE_PROJECT_ID','VITE_FIREBASE_APP_ID','VITE_FIREBASE_DATABASE_URL')) {
    Set-VercelEnv $frontendDir $k $frontEnv[$k]
  }
  Set-VercelEnv $frontendDir 'VITE_API_URL' $apiUrl
  $webUrl = Deploy-Vercel $frontendDir $FrontendName
  Write-Host "WEB URL: $webUrl" -ForegroundColor Green

  Header '7. CAP NHAT CORS CHO VERCEL WEB'
  $origins = "$($webUrl.TrimEnd('/')),https://$FrontendName.vercel.app"
  Set-VercelEnv $backendDir 'CLIENT_ORIGINS' $origins
  $apiUrl = Deploy-Vercel $backendDir $BackendName

  Write-Host "`n=== WEBSITE: $webUrl ===" -ForegroundColor Green
  Write-Host "=== API:     $apiUrl ===" -ForegroundColor Green
  try {
    $health = Invoke-RestMethod -Uri ($apiUrl.TrimEnd('/') + '/api/health') -TimeoutSec 25
    if ($health.ok -eq $true) { Write-Host 'API health: OK' -ForegroundColor Green }
    else { Write-Host 'API health khong tra ok=true; xem Vercel API logs.' -ForegroundColor Yellow }
  } catch { Write-Host "Khong the xac nhan API health. Kiem tra URL/Logs: $($_.Exception.Message)" -ForegroundColor Yellow }
  $webHost = ([Uri]$webUrl).Host
  Write-Host "`nCAN LAM THEM: Firebase Console > Authentication > Settings > Authorized domains > them domain $webHost" -ForegroundColor Yellow
}
function Optional-Functions {
  if (-not (Test-Path (Join-Path $ProjectRoot 'firebase/functions/index.js'))) { return }
  Header '8. LICH TU PHAN CONG/NHAC VIEC (TUY CHON)'
  Write-Host 'Firebase Cloud Functions can goi Blaze va co the phat sinh phi.' -ForegroundColor Yellow
  $ans = Read-Host 'Ban co muon deploy Cloud Functions lap lich ngay bay gio? (y/N)'
  if ($ans -notin @('y','Y','yes','YES')) { Write-Host 'Bo qua Cloud Functions. Website/API van online, nhung lich auto 5 phut/nhac viec CHUA duoc bat tren cloud.' -ForegroundColor Yellow; return }
  $script:Firebase = Find-Command @('firebase.cmd','firebase')
  if (-not $script:Firebase) {
    Run $script:Npm @('install','--global','firebase-tools')
    $script:Firebase = Find-Command @('firebase.cmd','firebase')
    if (-not $script:Firebase) {
      $npmPrefix = (& $script:Npm 'prefix' '--global' | Select-Object -Last 1).Trim()
      if (Test-Path (Join-Path $npmPrefix 'firebase.cmd')) { $script:Firebase = Join-Path $npmPrefix 'firebase.cmd' }
    }
    if (-not $script:Firebase) { Fail 'Khong tim thay firebase CLI. Mo lai Terminal.' }
  }
  & $script:Firebase projects:list 1>$null 2>$null
  if ($LASTEXITCODE -ne 0) { Run $script:Firebase @('login') }
  $functions = Join-Path $ProjectRoot 'firebase/functions'
  Push-Location $functions
  try { Run $script:Npm @('install') } finally { Pop-Location }
  Push-Location (Join-Path $ProjectRoot 'firebase')
  try { Run $script:Firebase @('deploy','--only','functions','--project','tickethexaa') }
  finally { Pop-Location }
  Write-Host 'Cloud scheduler da deploy. Dong backend local de tranh lich chay trung.' -ForegroundColor Green
}

try {
  Header 'HEXA TICKET ASSET / REPAIR + GITHUB + VERCEL'
  Require-Files
  Setup-Tools
  Authenticate
  Fix-And-Verify
  Protect-Git
  Push-GitHub
  Deploy-Cloud
  Optional-Functions
  Write-Host "`nDONE. WEBSITE: https://$FrontendName.vercel.app/it" -ForegroundColor Green
  exit 0
} catch {
  Write-Host "`n[DEPLOY FAILED] $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
