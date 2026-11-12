# HEXA: fix Firebase Auth diagnostics and resync frontend Firebase identifiers to Vercel.
# Runs only in the project root containing frontend/src/App.jsx and frontend/.env.
# Intentionally never touches backend/.env or Firebase Admin service account.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$front = Join-Path $root 'frontend'
$appFile = Join-Path $front 'src/App.jsx'
$envFile = Join-Path $front '.env'
$project = 'ticket-asset-hexa'
function Stop-Fix([string] $m) { Write-Host "[ERROR] $m" -ForegroundColor Red; exit 1 }
function Step([string] $m) { Write-Host "`n== $m ==" -ForegroundColor Cyan }
function Read-Env([string] $path) {
  $dict = @{}
  foreach ($raw in [IO.File]::ReadAllLines($path,[Text.Encoding]::UTF8)) {
    $line = $raw.Trim()
    if (-not $line -or $line.StartsWith('#')) { continue }
    $ix = $line.IndexOf('=')
    if ($ix -lt 1) { continue }
    $key = $line.Substring(0,$ix).Trim(); $val = $line.Substring($ix + 1).Trim()
    if ($val.Length -ge 2 -and (($val.StartsWith('"') -and $val.EndsWith('"')) -or ($val.StartsWith("'") -and $val.EndsWith("'")))) {
      $val = $val.Substring(1,$val.Length - 2)
    }
    $dict[$key]=$val
  }
  return $dict
}
try {
  Step 'Validate HEXA project'
  if (-not (Test-Path $appFile) -or -not (Test-Path $envFile)) {
    Stop-Fix 'Copy BOTH FIX_LOGIN_VERCEL.bat and FIX_LOGIN_VERCEL.ps1 to the HEXA project ROOT (next to frontend and backend).'
  }
  $vars = Read-Env $envFile
  $names = @('VITE_FIREBASE_API_KEY','VITE_FIREBASE_AUTH_DOMAIN','VITE_FIREBASE_PROJECT_ID','VITE_FIREBASE_APP_ID','VITE_FIREBASE_DATABASE_URL')
  foreach ($k in $names) {
    if (-not $vars.ContainsKey($k) -or [string]::IsNullOrWhiteSpace([string]$vars[$k])) { Stop-Fix "Missing $k in frontend/.env" }
  }
  if ($vars['VITE_FIREBASE_PROJECT_ID'] -ne 'tickethexaa') { Stop-Fix 'Unexpected Firebase project ID. Expected tickethexaa. Refusing to overwrite deployment.' }
  if ($vars['VITE_FIREBASE_AUTH_DOMAIN'] -ne 'tickethexaa.firebaseapp.com') { Stop-Fix 'Unexpected authDomain. Check Firebase Console first.' }
  if ($vars['VITE_FIREBASE_API_KEY'] -notmatch '^AIza[A-Za-z0-9_-]{25,}$') { Stop-Fix 'Firebase Web API key format is unexpected; verify frontend/.env.' }
  if ($vars['VITE_FIREBASE_APP_ID'] -notmatch '^1:[0-9]+:web:') { Stop-Fix 'Firebase Web App ID format is unexpected; verify frontend/.env.' }
  Write-Host 'Local Firebase web identifiers look valid (values NOT printed).'

  Step 'Patch login error reporting'
  $old = [IO.File]::ReadAllText($appFile,[Text.Encoding]::UTF8)
  $matchPattern = "catch\s*\{\s*setError\('Đăng nhập không thành công\. Kiểm tra email, mật khẩu và cấu hình Firebase\.'\);\s*\}"
  $new = @'
catch (err) {
      const code = err?.code || 'auth/unknown';
      const messages = {
        'auth/invalid-api-key': 'Firebase API Key không hợp lệ trên bản deploy.',
        'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'Firebase API Key không hợp lệ trên bản deploy.',
        'auth/operation-not-allowed': 'Chưa bật đăng nhập Email/Password trong Firebase Authentication.',
        'auth/user-disabled': 'Tài khoản đã bị khóa trong Firebase Authentication.',
        'auth/network-request-failed': 'Trình duyệt không kết nối được Firebase Authentication.',
        'auth/too-many-requests': 'Firebase tạm khóa đăng nhập do thử nhiều lần. Hãy thử lại sau.',
        'auth/invalid-credential': 'Firebase không chấp nhận email/mật khẩu trong project hiện tại. Hãy đối chiếu Firebase Authentication > Users.',
        'auth/wrong-password': 'Firebase báo mật khẩu không khớp với tài khoản trong project hiện tại.',
        'auth/user-not-found': 'Firebase không tìm thấy tài khoản trong project hiện tại.',
        'auth/unauthorized-domain': 'Tên miền web chưa được cho phép trong Firebase Authentication.',
        'auth/configuration-not-found': 'Firebase Authentication chưa có cấu hình đăng nhập Email/Password.'
      };
      console.error('[HEXA AUTH ERROR]', code);
      setError(`${messages[code] || 'Firebase Authentication không đăng nhập được.'} (Mã: ${code})`);
    }
'@
  if ([regex]::IsMatch($old,$matchPattern)) {
    $backup = "$appFile.bak-login-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    [IO.File]::WriteAllText($backup,$old,(New-Object Text.UTF8Encoding $false))
    $patched = [regex]::Replace($old,$matchPattern,[System.Text.RegularExpressions.MatchEvaluator]{param($m) $new},1)
    [IO.File]::WriteAllText($appFile,$patched,(New-Object Text.UTF8Encoding $false))
    Write-Host 'Patched login error handler. Existing JSX backed up.' -ForegroundColor Green
  } elseif ($old.Contains('[HEXA AUTH ERROR]')) {
    Write-Host 'Login handler already patched. Skipping.'
  } else {
    Stop-Fix 'Login source differs from expected HEXA version. Refusing to rewrite unknown code.'
  }

  Step 'Find Vercel CLI'
  $vercel = Get-Command vercel -ErrorAction SilentlyContinue
  if (-not $vercel) { Stop-Fix 'Vercel CLI is not installed. Run npm install -g vercel, then rerun this BAT.' }
  Push-Location $front
  try {
    & vercel link --yes --project $project
    if ($LASTEXITCODE -ne 0) { Stop-Fix 'Vercel link failed. Sign in with vercel login and confirm you have access to ticket-asset-hexa.' }
    Step 'Sync Firebase web settings to Production (never print values)'
    foreach ($k in $names) {
      $val = [string] $vars[$k]
      Write-Host "Updating $k ..."
      $val | & vercel env add $k --environment production --type config --force
      if ($LASTEXITCODE -ne 0) { Stop-Fix "Failed to update $k on Vercel. Check Vercel account permissions." }
    }
    # Deliberately DO NOT overwrite VITE_API_URL: local value may point to localhost.
    Step 'Deploy frontend to Vercel Production'
    & vercel deploy --prod --yes
    if ($LASTEXITCODE -ne 0) { Stop-Fix 'Vercel Production deploy failed. Review output above.' }
  } finally { Pop-Location }
  Write-Host "`nDONE. Reload deployed /it with Ctrl+Shift+R. If login still fails, screenshot ONLY the error code." -ForegroundColor Green
  Write-Host 'Note: this BAT only fixes Vercel frontend; to persist source changes, commit/push frontend/src/App.jsx to your private GitHub repo.' -ForegroundColor Yellow
} catch {
  Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
