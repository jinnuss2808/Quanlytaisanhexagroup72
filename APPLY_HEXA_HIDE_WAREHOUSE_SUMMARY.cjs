'use strict';
// HEXA: Hide the irrelevant material count and low-stock badges in the "Kho thiết bị" tab only.
// Keep low-stock indicators in "Kho linh kiện" and "Mực trong kho".
// No dependency installation or Firebase modification is required.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const root = __dirname;
const file = path.join(root, 'frontend', 'src', 'WarehouseManagement.jsx');
const projectCheck = path.join(root, 'frontend', 'package.json');
const backendCheck = path.join(root, 'backend', 'package.json');
function exitError(message) { console.error('[ERROR] ' + message); process.exit(1); }
if (![file,projectCheck,backendCheck].every(x => fs.existsSync(x))) {
  exitError('Please copy both BAT and CJS to the HEXA project root (beside frontend/ and backend/). No changes made.');
}
const old = fs.readFileSync(file, 'utf8');
if (!/function\s+WarehouseManagement\s*\(\s*\{[\s\S]{0,250}\bkind\s*=\s*['"]warehouse['"]/.test(old)) {
  exitError('WarehouseManagement structure not recognized. Stopped to protect your changes.');
}
const marker = '<div className="am-warehouse-summary">';
const first = old.indexOf(marker);
const second = old.indexOf(marker, first + marker.length);
if (first < 0) {
  console.log('[SKIP] Summary section is not present. No changes necessary.');
  process.exit(0);
}
if (second >= 0) exitError('Multiple warehouse summary elements found. Cannot safely patch automatically.');

// Find the matching closing </div> by scanning only div tags, allowing nested markup.
const tags = /<\/?div\b[^>]*>/g;
tags.lastIndex = first;
let depth = 0;
let end = -1;
let match;
while ((match = tags.exec(old)) !== null) {
  if (match[0].startsWith('</div')) depth--;
  else depth++;
  if (depth === 0) { end = tags.lastIndex; break; }
  if (depth < 0) break;
}
if (end < 0) exitError('Could not locate a matching closing tag. Nothing changed.');
const block = old.slice(first, end);
if (!block.includes('mã cần nhập thêm') || !block.includes('am-warehouse-summary')) {
  exitError('Warehouse summary format is unfamiliar. Stopped safely.');
}
const immediatelyBefore = old.slice(Math.max(0, first - 90), first);
const immediatelyAfter = old.slice(end, Math.min(old.length, end + 60));
if (/\{\s*kind\s*!==\s*['"]warehouse['"]\s*&&\s*$/.test(immediatelyBefore) && /^\s*\}/.test(immediatelyAfter)) {
  console.log('[SKIP] Kho thiet bi is already hiding the material summary.');
  process.exit(0);
}
// Wrap the existing summary rather than deleting it: other warehouse views retain alerts.
const replacement = `{kind !== 'warehouse' && ${block}}`;
const updated = old.slice(0, first) + replacement + old.slice(end);
if (updated === old) { console.log('[SKIP] No changes.'); process.exit(0); }

// Keep a backup *outside* the repository, so git add -A will not upload it.
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const safeProject = path.basename(root).replace(/[^a-z0-9_-]/gi, '_');
const backupFolder = path.join(os.homedir(), 'HEXA_CODE_BACKUPS', safeProject, 'warehouse-summary');
fs.mkdirSync(backupFolder, {recursive:true});
const backupPath = path.join(backupFolder, `WarehouseManagement_${stamp}.jsx`);
fs.writeFileSync(backupPath, old, 'utf8');
try { fs.writeFileSync(file, updated, 'utf8'); }
catch (error) { fs.writeFileSync(file, old, 'utf8'); exitError('Unable to write file; original restored: '+error.message); }
console.log('[OK] Kho thiet bi: removed 2 summary badges from the rendered UI.');
console.log('[OK] Kho linh kien and Muc trong kho: low-stock summary preserved.');
console.log('[BACKUP] '+backupPath);
console.log('[GIT] git add frontend/src/WarehouseManagement.jsx');
console.log('[GIT] git commit -m "Hide warehouse material summary in device stock"');
console.log('[GIT] git push origin main');
