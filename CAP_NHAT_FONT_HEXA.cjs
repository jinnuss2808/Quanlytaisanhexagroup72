'use strict';
/**
 * HEXA Typography V1: standalone local update. No external file download.
 * Run from the project root or alongside this updater.
 * --check is read-only. Normal run makes a local temp backup and updates only frontend files.
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const dry = process.argv.includes('--check');
const roots = [process.cwd(), __dirname];
let root = roots.find(r => fs.existsSync(path.join(r,'frontend','src','main.jsx')) && fs.existsSync(path.join(r,'frontend','index.html')));
if (!root) {
  console.error('[STOP] Khong tim thay frontend/src/main.jsx va frontend/index.html.');
  console.error('Dat 2 file cap nhat vao thu muc goc HEXA (cung cap frontend), roi chay lai.');
  process.exit(2);
}
const mainPath = path.join(root,'frontend','src','main.jsx');
const htmlPath = path.join(root,'frontend','index.html');
const cssPath = path.join(root,'frontend','src','hexa-typography.css');
const bundleCss = path.join(__dirname,'hexa-typography.css');
if (!fs.existsSync(bundleCss)) {
  console.error('[STOP] Thieu hexa-typography.css can di kem file cap nhat.');
  process.exit(2);
}
const origMain = fs.readFileSync(mainPath,'utf8');
const origHtml = fs.readFileSync(htmlPath,'utf8');
const css = fs.readFileSync(bundleCss,'utf8');
const nl = origMain.includes('\r\n') ? '\r\n' : '\n';
const cssImport = "import './hexa-typography.css';";
let nextMain = origMain;
if (!nextMain.includes(cssImport)) {
  const match = [...nextMain.matchAll(/^import\s+.*?;\s*$/gm)];
  if (!match.length) {console.error('[STOP] Khong tim thay import trong main.jsx.');process.exit(2);}
  const last = match[match.length-1];
  const end = last.index + last[0].length;
  nextMain = nextMain.slice(0,end).replace(/[ \t]*\r?\n?$/,'') + nl + cssImport + nl + nextMain.slice(end).replace(/^\r?\n/,'');
}
let nextHtml = origHtml;
// Optional Google font with fallbacks already available locally (Manrope, DM Sans).
if (!/fonts\.googleapis\.com[^"']*family=Sora/.test(nextHtml)) {
  if (!/<\/head\s*>/i.test(nextHtml)) {console.error('[STOP] frontend/index.html thieu the head.'); process.exit(2);}
  nextHtml = nextHtml.replace(/<\/head\s*>/i, '    <link href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&amp;display=swap" rel="stylesheet" />\n  </head>');
}
const oldCss = fs.existsSync(cssPath) ? fs.readFileSync(cssPath,'utf8') : null;
const changes = [
  [mainPath,origMain,nextMain],
  [htmlPath,origHtml,nextHtml],
  [cssPath,oldCss,css]
].filter(([file,before,after]) => before !== after);
console.log('[HEXA] Project: '+root);
console.log('[HEXA] Font: DM Sans (noi dung) + Sora/Manrope (tieu de)');
console.log('[HEXA] '+ (dry ? 'CHECK - khong sua file' : 'CAP NHAT') +': '+changes.length+' file can thay doi.');
changes.forEach(([file]) => console.log('  '+path.relative(root,file)));
if(dry){ console.log('[CHECK OK] Khong can can thiep Firebase, backend hoac logo.');process.exit(0);}
if (!changes.length) {console.log('[OK] Da cap nhat tu truoc - khong can lam gi.');process.exit(0);}
const backup = path.join(os.tmpdir(), 'HEXA-FONT-BACKUP-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomBytes(3).toString('hex'));
try {
  fs.mkdirSync(backup,{recursive:true});
  for (const [file,before] of changes) {
    if (before === null) continue;
    const dest=path.join(backup,path.relative(root,file));
    fs.mkdirSync(path.dirname(dest),{recursive:true});
    fs.copyFileSync(file,dest);
  }
  for (const [file,,after] of changes) {
    fs.mkdirSync(path.dirname(file),{recursive:true});
    fs.writeFileSync(file,after,'utf8');
  }
  console.log('[OK] Cap nhat thanh cong. Backup: '+backup);
  console.log('Chay: cd frontend && npm run build && npm run dev');
} catch (e) {
  console.error('[LOI] '+e.message);
  for (const [file,before] of changes) {
    try { if(before === null){if(fs.existsSync(file)) fs.unlinkSync(file)} else {fs.writeFileSync(file,before,'utf8');} } catch {}
  }
  process.exit(1);
}
