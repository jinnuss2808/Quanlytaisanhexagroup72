'use strict';
/**
 * HEXA sidebar logo installer. Offline-only, idempotent, no npm dependencies.
 * Run via DOI_LOGO_HEXA_OFFLINE.bat or node CAP_NHAT_LOGO_LOCAL.cjs [--check].
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const ASSET_NAME = 'hexa-sidebar-logo.png';
const CSS_MARKER = 'HEXA_LOGO_OFFLINE_V2_20261120';
const checkOnly = process.argv.includes('--check');
const bundle = __dirname;
const sourceLogo = path.join(bundle, ASSET_NAME);
const PROJECT_FALLBACK = 'E:\\HEXA-Ticket-Asset-ONE-DEPLOY-CLEAN\\HEXA-Ticket-Asset-ONE-DEPLOY';

function isProject(p) {
  return fs.existsSync(path.join(p, 'frontend', 'src', 'App.jsx')) &&
    fs.existsSync(path.join(p, 'frontend', 'src', 'styles.css'));
}
function findRoot() {
  let candidates = [process.cwd(), bundle, PROJECT_FALLBACK];
  for (const start of [process.cwd(), bundle]) {
    let current = path.resolve(start);
    for (let depth = 0; depth < 5; depth++) {
      candidates.push(current);
      let subfolders;
      try { subfolders = fs.readdirSync(current, { withFileTypes: true }); } catch { subfolders=[]; }
      for (const item of subfolders) {
        if (!item.isDirectory() || item.name.startsWith('.') || ['node_modules','frontend','backend','build','dist'].includes(item.name)) continue;
        candidates.push(path.join(current, item.name));
      }
      const parent = path.dirname(current);
      if (parent===current) break;
      current=parent;
    }
  }
  // If multiple projects are found, prefer the BAT's current directory and ancestors.
  return [...new Set(candidates.map(p=>path.resolve(p)))].find(isProject) || null;
}
function requirePNG(file) {
  if(!fs.existsSync(file)) throw new Error('Khong tim thay anh PNG kem theo: ' + file);
  const buf = fs.readFileSync(file);
  const sig = Buffer.from([137,80,78,71,13,10,26,10]);
  if (buf.length < 40 || !buf.subarray(0,8).equals(sig)) throw new Error('File logo khong phai PNG hop le.');
  return buf;
}
const BRAND_REGEX = /<div\s+className\s*=\s*["']side-brand["']\s*>\s*<div\s+className\s*=\s*["']side-brand-name["']\s*>\s*HEXA\s*<span\s*>\.<\/span>\s*<\/div>\s*<\/div>/m;
const IMAGE_BRAND_REGEX = /<div\s+className\s*=\s*["']side-brand["']\s*>\s*<button\b[^>]*className\s*=\s*["']hexa-sidebar-brand-reload["'][\s\S]*?<\/button>\s*<\/div>/m;
const REPLACEMENT = '<div className="side-brand"><button type="button" className="hexa-sidebar-brand-reload" title="Tai lai trang HEXA" aria-label="Tai lai trang HEXA" onClick={() => window.location.reload()}><img className="hexa-sidebar-brand-image" src="/hexa-sidebar-logo.png" alt="HEXA Group" /></button></div>';
const CSS_APPEND = `\n\n/* ${CSS_MARKER}: logo local (khong can link 1Office) */\n.side-brand .hexa-sidebar-brand-reload{display:flex;align-items:center;justify-content:flex-start;width:100%;min-width:0;padding:0;margin:0;border:0;background:transparent;border-radius:8px;cursor:pointer}\n.side-brand .hexa-sidebar-brand-reload:focus-visible{outline:2px solid #0a786d;outline-offset:3px}\n.side-brand .hexa-sidebar-brand-reload:hover{opacity:.88}\n.side-brand .hexa-sidebar-brand-image{display:block;width:auto;height:48px;max-width:100%;object-fit:contain;object-position:left center}\n@media (min-width:801px){.admin-root.sidebar-collapsed .side-brand .hexa-sidebar-brand-reload{width:45px;justify-content:center}.admin-root.sidebar-collapsed .side-brand .hexa-sidebar-brand-image{height:auto;max-width:42px;max-height:38px;object-position:center}}\n`;

function main() {
  const root = findRoot();
  if (!root) throw new Error('Khong tim thay HEXA project (frontend/src/App.jsx + styles.css). Dat ZIP trong thu muc goc, hoac chay BAT ngay tai thu muc E:\\HEXA-Ticket-Asset-ONE-DEPLOY-CLEAN\\HEXA-Ticket-Asset-ONE-DEPLOY.');
  const img = requirePNG(sourceLogo);
  const appPath = path.join(root, 'frontend','src','App.jsx');
  const cssPath = path.join(root, 'frontend','src','styles.css');
  const outputImg = path.join(root,'frontend','public',ASSET_NAME);
  const originalApp = fs.readFileSync(appPath,'utf8');
  const originalCss = fs.readFileSync(cssPath,'utf8');
  let nextApp;
  let previousLogo = false;
  if (IMAGE_BRAND_REGEX.test(originalApp)) { nextApp = originalApp.replace(IMAGE_BRAND_REGEX, REPLACEMENT); previousLogo = true; }
  else if (BRAND_REGEX.test(originalApp)) nextApp = originalApp.replace(BRAND_REGEX,REPLACEMENT);
  else throw new Error('Khong tim thay logo HEXA. hoac nut logo da tao truoc do trong frontend/src/App.jsx. Khong ghi de de tranh mat code.');
  let nextCss = originalCss;
  if(!nextCss.includes(CSS_MARKER)) nextCss += CSS_APPEND;
  const sameImage = fs.existsSync(outputImg) && crypto.createHash('sha256').update(fs.readFileSync(outputImg)).digest('hex')===crypto.createHash('sha256').update(img).digest('hex');
  const changed = (nextApp!==originalApp || nextCss!==originalCss || !sameImage);
  console.log('[HEXA] Project : '+root);
  console.log('[HEXA] Source  : '+(previousLogo?'Da co nut logo - cap nhat anh local':'HEXA. -> Nut logo'));
  console.log('[HEXA] Image   : PNG kem theo, KHONG tai Internet');
  if(checkOnly){console.log('[CHECK OK] '+(changed?'Co thay doi can ap dung.':'Da cap nhat; khong can sua them.'));return;}
  if (!changed) {console.log('[OK] Logo da dung va da gan nut tai lai trang.');return;}
  const backupDir = fs.mkdtempSync(path.join(os.tmpdir(),'HEXA-logo-offline-backup-'));
  fs.copyFileSync(appPath,path.join(backupDir,'App.jsx'));
  fs.copyFileSync(cssPath,path.join(backupDir,'styles.css'));
  const oldLogo = fs.existsSync(outputImg) ? fs.readFileSync(outputImg) : null;
  try {
    fs.mkdirSync(path.dirname(outputImg),{recursive:true});
    fs.writeFileSync(outputImg,img);
    if(nextApp!==originalApp) fs.writeFileSync(appPath,nextApp,'utf8');
    if(nextCss!==originalCss) fs.writeFileSync(cssPath,nextCss,'utf8');
  } catch(err) {
    fs.copyFileSync(path.join(backupDir,'App.jsx'),appPath);
    fs.copyFileSync(path.join(backupDir,'styles.css'),cssPath);
    if(oldLogo)fs.writeFileSync(outputImg,oldLogo); else if(fs.existsSync(outputImg)) fs.unlinkSync(outputImg);
    throw err;
  }
  console.log('[OK] Da thay logo HEXA. bang PNG cung cap.');
  console.log('[OK] Click logo tai lai chinh trang dang mo.');
  console.log('[OK] Logo static: frontend/public/'+ASSET_NAME);
  console.log('[BACKUP] '+backupDir);
  console.log('[GIT] git add frontend/src/App.jsx frontend/src/styles.css frontend/public/'+ASSET_NAME);
}
try {main();}catch(err){console.error('[STOP] '+err.message);process.exitCode=1;}
