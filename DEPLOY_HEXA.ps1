# HEXA: one-time GitHub / Vercel setup (fixed unborn Git HEAD). Run via DEPLOY_HEXA.bat.
# Existing GitHub commits are preserved. Never pushes credentials or force-pushes.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoName = 'ticket-asset-hexa'
$apiName = 'ticket-asset-hexa-api'
$webName = 'ticket-asset-hexa'
$vercelScope = 'trungs-projects'  # Existing Vercel team shown in previous deployment logs.
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$work = Join-Path $env:TEMP ("hexa-deploy-check-" + [guid]::NewGuid().ToString('N'))

function Info([string]$message) { Write-Host "[HEXA] $message" -ForegroundColor Cyan }
function Good([string]$message) { Write-Host "[OK] $message" -ForegroundColor Green }
function Fail([string]$message) { throw $message }
function Require([string]$exe) {
  if (-not (Get-Command $exe -ErrorAction SilentlyContinue)) { Fail "Missing $exe. Install it first, restart terminal, and run BAT again." }
}
function Exec([string]$folder,[string]$exe,[string[]]$a) {
  Push-Location $folder
  try {
    & $exe @a
    if ($LASTEXITCODE -ne 0) { Fail "$exe $($a -join ' ') failed (exit $LASTEXITCODE)." }
  } finally { Pop-Location }
}
function EnvFile([string]$path) {
  $vars = @{}
  if (-not (Test-Path -LiteralPath $path)) { Fail "Missing configuration: $path" }
  foreach ($line in [System.IO.File]::ReadAllLines($path)) {
    if ($line -match '^\s*#' -or [string]::IsNullOrWhiteSpace($line)) { continue }
    if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
      $value = $Matches[2].Trim()
      if ($value.Length -ge 2 -and (($value[0] -eq '"' -and $value[-1] -eq '"') -or ($value[0] -eq "'" -and $value[-1] -eq "'"))) {
        $value = $value.Substring(1,$value.Length - 2)
      }
      $vars[$Matches[1]] = $value
    }
  }
  return $vars
}
function Require-Value($variables,[string]$key,[string]$context) {
  $v = [string]$variables[$key]
  if ([string]::IsNullOrWhiteSpace($v) -or $v -match '^your-|^DIEN_|^APP_ID_CUA_BAN') { Fail "Missing/placeholder $key in $context" }
  return $v
}
function Safe-Git-Paths([string]$folder,[string]$ref) {
  $items = @()
  Push-Location $folder
  try {
    if ($ref -eq 'staged') {
      # File deletions are safe; only new/modified tracked bytes can expose credentials.
      $items = @(& git diff --cached --name-status)
    } else {
      $items = @(& git ls-tree -r --name-only $ref)
    }
  } finally { Pop-Location }
  foreach ($item in $items) {
    $p = [string]$item
    if ($ref -eq 'staged') {
      $columns=$p -split "`t", 3
      if ($columns.Count -lt 2 -or $columns[0] -match '^D') { continue }
      $p=$columns[-1]
    }
    if (-not $p) { continue }
    # Existing patch directories / old BAT files may be deleted during cleanup.
    # For a remote snapshot they are legacy files; they do not contain a private key themselves.
    if ($p -match '(?i)(^|/)\.env($|\.(?!example$))|service.account.*\.json$|firebase.adminsdk.*\.json$|serviceAccountKey.*\.json$|(^|/)node_modules/|(^|/)\.vercel/|\.(?:pem|p12|pfx)$') {
      Fail "Sensitive/unwanted file found in Git $ref : $p. Stop and inspect it before pushing."
    }
    if ($ref -eq 'staged' -and $p -match '^(?i:patch|\.hexa-backups|\.hexa-deploy-backup)/') {
      Fail "Old patch/backup directory was staged for Git upload: $p"
    }
  }
}
function Get-ExitOutput([string]$folder,[string]$exe,[string[]]$a) {
  Push-Location $folder
  try {
    $result = & $exe @a 2>&1
    if ($LASTEXITCODE -ne 0) { Fail "$exe $($a -join ' ') failed: $($result | Out-String)" }
    return ($result | Out-String).Trim()
  } finally { Pop-Location }
}
function Ensure-GitHub {
  Info 'Checking GitHub authentication...'
  Exec $root 'gh' @('auth','status')
  $userName = (Get-ExitOutput $root 'gh' @('api','user','--jq','.login')).Trim()
  if (-not $userName) { Fail 'Cannot detect signed-in GitHub account.' }
  $script:githubUser = $userName
  $repository = "$userName/$repoName"
  Info "Using GitHub repository: $repository (PRIVATE)"
  # GitHub may not have the repository yet. A missing repo is expected and must
  # NOT terminate Windows PowerShell when ErrorActionPreference is Stop.
  $repoExists = $false
  $savedErrorPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    & gh repo view $repository --json name --jq '.name' 1>$null 2>$null
    $repoExists = ($LASTEXITCODE -eq 0)
  } finally { $ErrorActionPreference = $savedErrorPreference }
  if (-not $repoExists) { Exec $root 'gh' @('repo','create',$repository,'--private','--description','HEXA IT Ticket and Asset Management') }
  $url = "https://github.com/$repository.git"
  if (-not (Test-Path (Join-Path $root '.git'))) { Exec $root 'git' @('init','-b','main') }
  $remoteNames = @(& git -C $root remote)
  $remote = ''
  if ($remoteNames -contains 'origin') { $remote = (& git -C $root remote get-url origin | Out-String).Trim() }
  if (-not $remote) { Exec $root 'git' @('remote','add','origin',$url) }
  elseif (($remote -ne $url) -and ($remote -ne "git@github.com:$repository.git")) {
    Fail "Git origin points to $remote, expected $url. Refusing to silently replace it."
  }
  $branch = (& git -C $root branch --show-current | Out-String).Trim()
  if ($branch -and $branch -ne 'main') { Fail "Current Git branch '$branch' is not main. Switch to main manually and retry." }
  $author = (& git -C $root config user.name | Out-String).Trim()
  if (-not $author) { Exec $root 'git' @('config','user.name',$userName) }
  $email = (& git -C $root config user.email | Out-String).Trim()
  if (-not $email) { Exec $root 'git' @('config','user.email',"$userName@users.noreply.github.com") }

  Exec $root 'git' @('fetch','origin')
  & git -C $root show-ref --verify --quiet refs/remotes/origin/main
  $hasRemoteMain = ($LASTEXITCODE -eq 0)
  if ($hasRemoteMain) {
    Safe-Git-Paths $root 'origin/main'
    # On a freshly extracted ZIP, `git init -b main` creates an UNBORN branch.
    # `git rev-parse --verify HEAD` emits 'fatal: Needed a single revision'; in
    # Windows PowerShell 5.1 that stderr can terminate the whole script.
    # `git show-ref --quiet` checks an existing local branch without printing an error.
    & git -C $root show-ref --verify --quiet refs/heads/main
    $hasLocalMain = ($LASTEXITCODE -eq 0)
    if ($hasLocalMain) {
      $backupName = "hexa-backup-before-sync-$stamp"
      Exec $root 'git' @('branch',$backupName)
      Good "Local history backed up as branch $backupName"
    } else {
      Info 'No initial local commit. Starting from the existing GitHub origin/main safely.'
    }
    # SAFE: --soft changes only Git HEAD/index, NOT any source files or Firebase data.
    # No force-push: new commit will be based on the current remote main.
    Exec $root 'git' @('reset','--soft','origin/main')
  }
  Exec $root 'git' @('add','-A')
  Safe-Git-Paths $root 'staged'
  & git -C $root diff --cached --quiet
  if ($LASTEXITCODE -ne 0) { Exec $root 'git' @('commit','-m',"HEXA: clean source and Git-connected deployment ($stamp)") }
  # Another non-fatal check: a new repository may not have any commit yet.
  & git -C $root show-ref --verify --quiet refs/heads/main
  if ($LASTEXITCODE -ne 0) { Exec $root 'git' @('commit','--allow-empty','-m','Initialize HEXA repository') }
  Exec $root 'git' @('push','-u','origin','main')
  Good 'GitHub push succeeded without force.'
}
function Ensure-IgnoreFiles {
  # For users who copy just these two deploy files into an older HEXA directory.
  # Preserve existing ignore rules; append the mandatory safety rules.
  $gitIgnore = Join-Path $root '.gitignore'
  $required = @(
    '.env', '.env.*', '!.env.example', '**/.env', '**/.env.*', '!**/.env.example',
    '**/service-account.json', '**/*firebase-admin*.json', '**/*serviceAccountKey*.json',
    '**/node_modules/', '**/dist/', '**/.vercel/', '.hexa-deploy-backup/',
    '.hexa-backups/', 'HEXA_BACKUP_*/', 'patch/', '*.log', '*.zip', '*.7z', '*.pem'
  )
  $oldText = if (Test-Path $gitIgnore) { Get-Content -LiteralPath $gitIgnore -Raw -Encoding UTF8 } else { '' }
  $missing = @($required | Where-Object { $oldText -notmatch ('(?m)^' + [regex]::Escape($_) + '$') })
  if ($missing.Count) { Add-Content -LiteralPath $gitIgnore -Value ("`n# HEXA deploy safety rules`n" + ($missing -join "`n") + "`n") -Encoding UTF8 }
  foreach ($sub in @('frontend','backend')) {
    $ignoreFile = Join-Path $root "$sub/.vercelignore"
    $rules = if ($sub -eq 'backend') { @('node_modules','.env','.env.*','service-account.json','*firebase-admin*.json','.git') }
             else { @('node_modules','.env','.env.*','.git') }
    $cur = if (Test-Path $ignoreFile) { Get-Content -LiteralPath $ignoreFile -Raw -Encoding UTF8 } else { '' }
    $add = @($rules | Where-Object { $cur -notmatch ('(?m)^' + [regex]::Escape($_) + '$') })
    if ($add.Count) { Add-Content -LiteralPath $ignoreFile -Value ("`n" + ($add -join "`n") + "`n") -Encoding UTF8 }
  }
}
function Archive-LegacyScripts {
  # Do not delete user files. Move known obsolete installers/duplicated patches to a local ignored backup.
  $oldNames = @('SETUP_GITHUB_VERCEL.bat','SETUP_GITHUB_VERCEL.ps1',
    'DEPLOY_TICKET_ASSET_HEXA.bat','DEPLOY_TICKET_ASSET_HEXA.ps1',
    'DEPLOY_SCHEDULER_FIREBASE.bat','APPLY_HEXA_UPDATE.bat','APPLY_HEXA_UPDATE.ps1',
    'APPLY_HEXA_MAY_IN_MUC.bat','APPLY_HEXA_MAY_IN_MUC.ps1',
    'CAP_NHAT_THEM_MAY_IN.bat','CAP_NHAT_THEM_MAY_IN.ps1',
    'FIX_TEST_VA_DEPLOY_HEXA.bat','FIX_SECURITY_TEST.cjs','PATCH_REMOVE_PRIORITY.cjs')
  $target = Join-Path $root ".hexa-deploy-backup/$stamp"
  foreach ($filename in $oldNames) {
    $path=Join-Path $root $filename
    if (Test-Path -LiteralPath $path) {
      New-Item -ItemType Directory -Path $target -Force | Out-Null
      Move-Item -LiteralPath $path -Destination (Join-Path $target $filename) -Force
    }
  }
  foreach ($dirname in @('patch')) {
    $path=Join-Path $root $dirname
    if (Test-Path -LiteralPath $path) {
      New-Item -ItemType Directory -Path $target -Force | Out-Null
      Move-Item -LiteralPath $path -Destination (Join-Path $target $dirname) -Force
    }
  }
}
function Copy-For-Test([string]$sub,[string]$to) {
  New-Item -ItemType Directory -Path $to -Force | Out-Null
  foreach ($name in @('package.json','package-lock.json')) {
    Copy-Item -LiteralPath (Join-Path "$root/$sub" $name) -Destination $to
  }
  if ($sub -eq 'backend') {
    foreach ($name in @('src','test','index.js')) { Copy-Item -LiteralPath (Join-Path "$root/$sub" $name) -Destination $to -Recurse }
  } else {
    foreach ($name in @('src','index.html','vite.config.js')) { Copy-Item -LiteralPath (Join-Path "$root/$sub" $name) -Destination $to -Recurse }
    # Values are public Firebase web identifiers only; never copy backend credentials.
    Copy-Item -LiteralPath (Join-Path "$root/frontend" '.env') -Destination $to
  }
}
function Local-Tests {
  Info 'Running isolated tests/build; local node_modules are NOT touched.'
  New-Item -ItemType Directory -Path $work -Force | Out-Null
  $bt=Join-Path $work 'backend'; $ft=Join-Path $work 'frontend'
  Copy-For-Test 'backend' $bt; Copy-For-Test 'frontend' $ft
  $fireRules = Join-Path $work 'firebase'
  New-Item -ItemType Directory -Path $fireRules -Force | Out-Null
  Copy-Item -LiteralPath (Join-Path $root 'firebase/database.rules.json') -Destination $fireRules
  Exec $bt 'npm.cmd' @('ci','--no-audit','--no-fund')
  Exec $bt 'npm.cmd' @('test')
  Exec $ft 'npm.cmd' @('ci','--no-audit','--no-fund')
  Exec $ft 'npm.cmd' @('run','build')
  if (-not (Test-Path -LiteralPath (Join-Path $ft 'dist/index.html'))) { Fail 'Vite build reported success but dist/index.html was not created.' }
  Good 'Backend tests and Vite production build passed.'
}
function Api([string]$project,[string]$directory) {
  # The authenticated Vercel CLI API reads the existing login session; no access tokens are stored here.
  $json=Get-ExitOutput $root 'vercel' @('api',"/v9/projects/$project",'-X','PATCH','-F',"rootDirectory=$directory",'--scope',$vercelScope)
  try { $obj=($json | ConvertFrom-Json) }
  catch { Fail "Vercel returned non-JSON while setting $project Root Directory. Set it manually in Settings -> Build & Deployment: $directory" }
  if ($obj.rootDirectory -ne $directory) { Fail "Root Directory for $project is not '$directory'. Check Vercel Project Settings." }
  Good "$project Root Directory: $directory"
}
function Link-Vercel([string]$folder,[string]$name,[string]$directory) {
  Info "Linking Vercel project $name and GitHub repo..."
  Exec $folder 'vercel' @('link','--yes','--project',$name,'--scope',$vercelScope)
  $linkedFile=Join-Path $folder '.vercel/project.json'
  if (-not (Test-Path $linkedFile)) { Fail "Vercel linking did not create $linkedFile" }
  Api $name $directory
  $info=Get-ExitOutput $root 'vercel' @('api',"/v9/projects/$name",'--scope',$vercelScope)
  $projectInfo=$info | ConvertFrom-Json
  $existingRepo=[string]$projectInfo.link.repo
  if ($existingRepo -and $existingRepo -ne $repoName) {
    Fail "Vercel $name is already connected to another Git repo: $existingRepo. Fix it manually in Settings -> Git."
  }
  if (-not $existingRepo) {
    Exec $folder 'vercel' @('git','connect','--yes','--scope',$vercelScope)
    $info=Get-ExitOutput $root 'vercel' @('api',"/v9/projects/$name",'--scope',$vercelScope)
    $projectInfo=$info | ConvertFrom-Json
  }
  if ($null -eq $projectInfo.link -or -not $projectInfo.link.repo -or $projectInfo.link.repo -ne $repoName) {
    Fail "$name is not Git-linked to $repoName. Open Vercel -> $name -> Settings -> Git and connect the Private GitHub repository."
  }
  Good "$name connected to GitHub repository $($projectInfo.link.repo)"
}
function Env-Vercel([string]$dir,[string]$name,[string]$value,[string]$kind) {
  if ([string]::IsNullOrWhiteSpace($value)) { return }
  Info "Setting Vercel production environment: $name ($kind)"
  Push-Location $dir
  try {
    # Secret values are passed on stdin, NEVER as CLI command-line arguments or printed to logs.
    $value | & vercel env add $name production --type $kind --force --yes --scope $vercelScope 1>$null
    if ($LASTEXITCODE -ne 0) { Fail "Failed to set Vercel environment variable $name" }
  } finally { Pop-Location }
}
function Configure-Vercel {
  Info 'Using the production settings from existing .env files (without committing them).'
  $be=EnvFile (Join-Path $root 'backend/.env')
  $fe=EnvFile (Join-Path $root 'frontend/.env')
  $databaseUrl=Require-Value $be 'FIREBASE_DATABASE_URL' 'backend/.env'
  $projectId=Require-Value $be 'FIREBASE_PROJECT_ID' 'backend/.env'
  $keyfile=Join-Path $root 'backend/service-account.json'
  if (-not (Test-Path $keyfile)) { Fail 'Missing backend/service-account.json. Put your current private key there locally. Never commit it.' }
  $account=(Get-Content -LiteralPath $keyfile -Raw -Encoding UTF8 | ConvertFrom-Json)
  if ($account.project_id -ne $projectId) { Fail 'Service Account project ID mismatches FIREBASE_PROJECT_ID.' }
  $key64=[Convert]::ToBase64String([System.IO.File]::ReadAllBytes($keyfile))
  $backend=Join-Path $root 'backend'; $frontend=Join-Path $root 'frontend'
  Link-Vercel $backend $apiName 'backend'
  Link-Vercel $frontend $webName 'frontend'
  Env-Vercel $backend 'FIREBASE_PROJECT_ID' $projectId 'config'
  Env-Vercel $backend 'FIREBASE_DATABASE_URL' $databaseUrl 'config'
  Env-Vercel $backend 'NODE_ENV' 'production' 'config'
  Env-Vercel $backend 'CLIENT_ORIGINS' 'https://ticket-asset-hexa.vercel.app' 'config'
  Env-Vercel $backend 'FIREBASE_SERVICE_ACCOUNT_BASE64' $key64 'secret'
  # Optional SMTP configuration; never print or commit passwords.
  foreach ($n in @('SMTP_HOST','SMTP_PORT','SMTP_SECURE','SMTP_FROM','SMTP_USER','SMTP_PASSWORD','IT_NOTIFICATION_EMAILS')) {
    if ($be.ContainsKey($n) -and -not [string]::IsNullOrWhiteSpace($be[$n])) {
      $kind=if ($n -eq 'SMTP_PASSWORD') { 'secret' } else { 'config' }
      Env-Vercel $backend $n ([string]$be[$n]) $kind
    }
  }
  foreach ($n in @('VITE_FIREBASE_API_KEY','VITE_FIREBASE_AUTH_DOMAIN','VITE_FIREBASE_PROJECT_ID','VITE_FIREBASE_APP_ID','VITE_FIREBASE_DATABASE_URL')) {
    Env-Vercel $frontend $n (Require-Value $fe $n 'frontend/.env') 'config'
  }
  Env-Vercel $frontend 'VITE_API_URL' 'https://ticket-asset-hexa-api.vercel.app' 'config'
  Good 'Vercel Production environment variables configured.'
}
function Trigger-And-Verify {
  Info 'Triggering Git-connected Production deployment by an empty commit.'
  Exec $root 'git' @('commit','--allow-empty','-m',"deploy: trigger Git-connected Vercel builds ($stamp)")
  Exec $root 'git' @('push','origin','main')
  $healthUrl='https://ticket-asset-hexa-api.vercel.app/api/health'
  Info "Checking API: $healthUrl"
  $ok=$false
  for($i=1;$i -le 12;$i++) {
    try {
      $result=Invoke-RestMethod -Method Get -Uri $healthUrl -TimeoutSec 20 -ErrorAction Stop
      if ($result.ok -eq $true -and $result.database -eq 'firebase-realtime-database') { $ok=$true;break }
    } catch { Write-Host "[WAIT] API not ready yet ($i/12); check Vercel Deployments if this continues." -ForegroundColor Yellow }
    Start-Sleep -Seconds 15
  }
  if (-not $ok) { Fail "API did not return ok:true after deployment. Open Vercel $apiName -> Deployments -> latest -> Logs. Do not assume deployment succeeded." }
  Good 'Production API health returned ok:true.'
  Info 'Checking frontend Production URL...'
  $url='https://ticket-asset-hexa.vercel.app/it'
  try {
    $response=Invoke-WebRequest -Method Get -Uri $url -TimeoutSec 30 -UseBasicParsing -ErrorAction Stop
    if ($response.StatusCode -ne 200 -or $response.Content -notmatch '<html') { Fail 'Frontend did not return HTML.' }
    Good "Frontend HTTP $($response.StatusCode): $url"
  } catch { Fail "Frontend Production check failed. Check Vercel $webName -> Deployments and Build Logs. $($_.Exception.Message)" }
}

try {
  Set-Location $root
  Info "Project directory: $root"
  foreach ($dir in @('frontend','backend','firebase')) { if (-not (Test-Path (Join-Path $root $dir))) { Fail "Missing project folder: $dir" } }
  foreach ($x in @('node','npm.cmd','git','gh','vercel')) { Require $x }
  $nodeVersion=(Get-ExitOutput $root 'node' @('--version')).TrimStart('v').Split('.')[0]
  if ([int]$nodeVersion -lt 22) { Fail 'Node.js 22+ is required.' }
  Info 'The BAT will run tests, push a PRIVATE GitHub repository, and configure two Vercel projects.'
  Info "Vercel team: $vercelScope | GitHub repo: $repoName"
  Write-Host 'Press ENTER to continue (N to cancel): ' -NoNewline -ForegroundColor Yellow
  $confirm=Read-Host
  if ($confirm -match '^[nN]') { Fail 'Cancelled by user before any push.' }
  Ensure-IgnoreFiles
  Archive-LegacyScripts
  Local-Tests
  Ensure-GitHub
  Info 'Checking Vercel login...'
  Exec $root 'vercel' @('whoami')
  Configure-Vercel
  Trigger-And-Verify
  Write-Host ''
  Good 'HEXA GitHub + Vercel initial setup finished.'
  Write-Host "GitHub: https://github.com/$script:githubUser/$repoName"
  Write-Host 'Future updates: git add -A ; git commit -m "Update HEXA" ; git push origin main'
  Write-Host 'Firebase Auth: add ticket-asset-hexa.vercel.app to Authorized domains if needed.'
  exit 0
} catch {
  Write-Host ''
  Write-Host "[DEPLOY FAILED] $($_.Exception.Message)" -ForegroundColor Red
  Write-Host 'No force-push was used. No Firebase database entries were deleted.' -ForegroundColor Yellow
  exit 1
} finally {
  if (Test-Path $work) { Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue }
}
