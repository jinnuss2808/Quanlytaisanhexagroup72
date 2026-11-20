'use strict';
// Applies a small, CSS-only sidebar update to the EXISTING HEXA project.
// Check mode is read-only. Original frontend/src/main.jsx is backed up outside the project.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const checkOnly = process.argv.includes('--check');
const projectArg = process.argv.find(a => a.startsWith('--project='));
const candidates = [projectArg && projectArg.slice(10), process.cwd(), __dirname].filter(Boolean);
const root = candidates.find(dir => fs.existsSync(path.join(dir, 'frontend', 'src', 'main.jsx')) && fs.existsSync(path.join(dir, 'frontend', 'src', 'App.jsx')));
if (!root) {
  console.error('[STOP] Khong tim thay frontend/src/main.jsx va App.jsx.');
  console.error('Hay chay script trong THU MUC GOC HEXA (cung cap frontend va backend).');
  process.exit(2);
}
const mainPath = path.join(root, 'frontend', 'src', 'main.jsx');
const cssPath = path.join(root, 'frontend', 'src', 'hexa-sidebar-compact.css');
const bundledCssPath = path.join(__dirname, 'hexa-sidebar-compact.css');
if (!fs.existsSync(bundledCssPath)) {
  console.error('[STOP] Thieu hexa-sidebar-compact.css. Giai nen TOAN BO file ZIP.');
  process.exit(2);
}
const original = fs.readFileSync(mainPath, 'utf8');
const appText = fs.readFileSync(path.join(root, 'frontend', 'src', 'App.jsx'), 'utf8');
if (!/side-brand|side-link/.test(appText) || !/import\s+['"]\.\/styles\.css['"]/.test(original)) {
  console.error('[STOP] Khong phai frontend HEXA tuong thich. Khong sua file.');
  process.exit(2);
}
const importLine = "import './hexa-sidebar-compact.css';";
let updated = original;
if (!updated.includes(importLine)) {
  const matches = [...updated.matchAll(/^import\s+[^\n]+\b(?:styles|hexa-appearance|hexa-typography)\.css['"];?\s*$/gm)];
  if (!matches.length) {
    console.error('[STOP] Khong tim thay dong import CSS de chen an toan.');
    process.exit(2);
  }
  const last = matches[matches.length - 1];
  const insertion = last.index + last[0].length;
  updated = updated.slice(0, insertion).replace(/\s*$/, '') + (original.includes('\r\n') ? '\r\n' : '\n') + importLine + updated.slice(insertion);
}
const css = fs.readFileSync(bundledCssPath, 'utf8');
const priorCss = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : null;
const changes = [
  [mainPath, original, updated],
  [cssPath, priorCss, css]
].filter(([file, before, after]) => before !== after);
console.log('[HEXA] Project:', root);
console.log(checkOnly ? '[CHECK] Chi kiem tra, KHONG SUA FILE.' : '[APPLY] Thu gon sidebar HEXA.');
console.log('[HEXA] So file can cap nhat:', changes.length);
for (const [file] of changes) console.log(' -', path.relative(root, file));
if (checkOnly) { console.log('[CHECK OK] Giữ nguyên logo, menu, backend, Firebase.'); process.exit(0); }
if (!changes.length) { console.log('[OK] Da cap nhat, khong co thay doi moi.'); process.exit(0); }
const backupDir = path.join(os.tmpdir(), 'HEXA-SIDEBAR-BACKUP-' + new Date().toISOString().replace(/[:.]/g, '-') + '-' + crypto.randomBytes(3).toString('hex'));
try {
  for (const [file, before] of changes) {
    if (before === null) continue;
    const destination = path.join(backupDir, path.relative(root, file));
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(file, destination);
  }
  for (const [file,, after] of changes) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, after, 'utf8');
  }
  console.log('[OK] Da thu gon sidebar. Backup:', backupDir);
  console.log('Tiep theo: cd frontend ; npm run build ; npm run dev');
} catch (err) {
  console.error('[FAIL] ', err.message);
  for (const [file, before] of changes) {
    try {if (before === null) { if (fs.existsSync(file)) fs.unlinkSync(file); } else fs.writeFileSync(file, before, 'utf8');} catch {}
  }
  process.exit(1);
}
