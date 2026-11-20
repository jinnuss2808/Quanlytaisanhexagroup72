'use strict';
/*
 * HEXA - logo sidebar + reload current page.
 * This installer stores the 1Office image as a static public asset so the
 * production frontend does not depend on a signed 1Office URL.
 * Usage:
 *   node CAP_NHAT_LOGO_HEXA.cjs --check
 *   node CAP_NHAT_LOGO_HEXA.cjs
 *   node CAP_NHAT_LOGO_HEXA.cjs --file "C:\\path\\logo.png"
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const https = require('node:https');
const http = require('node:http');

const IMAGE_URL = 'https://hexagroup.1office.vn/f/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJmIjoic29jaWFsXC93YWxsc1wvQVwvYXZhdGFyXC8xMTM5ODE1MTI2NDkwMGIyNDk1MGNlMzMwMjYyMDA3LjE5LjA2LjIwMjMuYmlnLnBuZyIsInUiOjgwMiwiZSI6MH0.OfXP5o1G2GwsW47dCWsPCCyObqSs_Pw9iLSjVzBXKHA/11398151264900b24950ce330262007.19.06.2023.big.png';
const MARKER = 'HEXA_SIDEBAR_BRAND_IMAGE_20261120';
const checkOnly = process.argv.includes('--check');
const fileArgIndex = process.argv.indexOf('--file');
if (fileArgIndex >= 0 && !process.argv[fileArgIndex + 1]) {
  console.error('[STOP] Sau --file can truyen duong dan anh PNG tren may.'); process.exit(1);
}
const localImagePath = fileArgIndex >= 0 ? path.resolve(process.argv[fileArgIndex + 1]) : null;

function findProject(start) {
  const dirs = [];
  let at = path.resolve(start);
  for (let i = 0; i < 4; i++) { dirs.push(at); const up = path.dirname(at); if (up === at) break; at = up; }
  const snap = dirs.slice();
  for (const parent of snap) {
    let entries = [];
    try { entries = fs.readdirSync(parent, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.') || ['node_modules', 'backend', 'frontend'].includes(entry.name)) continue;
      dirs.push(path.join(parent, entry.name));
    }
  }
  for (const d of dirs) {
    if (fs.existsSync(path.join(d, 'frontend', 'src', 'App.jsx')) &&
        fs.existsSync(path.join(d, 'frontend', 'src', 'styles.css'))) return d;
  }
  return null;
}

function assertPNG(buf) {
  return buf.length >= 24 && buf.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
}

function downloadLogo(url, count = 0) {
  if (count >= 4) return Promise.reject(new Error('Qua nhieu chuyen huong khi tai anh.'));
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https:') ? https : http;
    const req = lib.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 HEXA/1.0', Accept: 'image/png,image/*;q=0.8' }, timeout: 12000 }, res => {
      const status = res.statusCode || 0;
      if ([301,302,303,307,308].includes(status) && res.headers.location) {
        res.resume();
        try {
          const newUrl = new URL(res.headers.location, url).href;
          if (!newUrl.startsWith('https://')) return reject(new Error('Link chuyen huong khong an toan.'));
          return downloadLogo(newUrl, count + 1).then(resolve, reject);
        } catch (err) { return reject(err); }
      }
      if (status !== 200) { res.resume(); return reject(new Error('HTTP ' + status + ' tu may chu 1Office.')); }
      const chunks = []; let size = 0;
      res.on('data', chunk => {
        size += chunk.length;
        if (size > 8 * 1024 * 1024) { req.destroy(new Error('Anh lon hon 8 MB.')); return; }
        chunks.push(chunk);
      });
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Khong the ket noi 1Office sau 12 giay.')));
  });
}

async function main() {
  const root = findProject(process.cwd());
  if (!root) throw new Error('Khong tim thay frontend/src/App.jsx va styles.css. Dat file nay vao thu muc HEXA, cung cap voi frontend va backend.');
  const appPath = path.join(root, 'frontend', 'src', 'App.jsx');
  const cssPath = path.join(root, 'frontend', 'src', 'styles.css');
  const publicDir = path.join(root, 'frontend', 'public');
  const outputImage = path.join(publicDir, 'hexa-sidebar-logo.png');
  const app = fs.readFileSync(appPath, 'utf8');
  const css = fs.readFileSync(cssPath, 'utf8');
  const oldBrand = /<div\s+className=["']side-brand["']>\s*<div\s+className=["']side-brand-name["']>HEXA<span>\.<\/span><\/div>\s*<\/div>/;
  const alreadyModified = app.includes('hexa-sidebar-brand-reload');
  if (!alreadyModified && !oldBrand.test(app)) {
    throw new Error('Khong tim thay logo HEXA. trong App.jsx. Chua sua bat ky file nao.');
  }
  if (checkOnly) {
    console.log('[CHECK OK] Project: ' + root);
    console.log('Logo: ' + (fs.existsSync(outputImage) ? 'da co anh local' : (localImagePath ? 'se copy anh tu --file' : 'se tai anh PNG tu 1Office')));
    console.log('App.jsx: ' + (alreadyModified ? 'da cap nhat' : 'co the cap nhat'));
    console.log('styles.css: ' + (css.includes(MARKER) ? 'da cap nhat' : 'co the cap nhat'));
    console.log('Khong xoa du lieu Firebase. Khong sua backend.');
    return;
  }

  // Fetch/validate the image BEFORE any project source file is modified.
  let logo;
  if (localImagePath) {
    logo = fs.readFileSync(localImagePath);
  } else if (fs.existsSync(outputImage)) {
    logo = fs.readFileSync(outputImage);
  } else {
    console.log('Dang tai anh logo tu 1Office ve frontend/public...');
    try { logo = await downloadLogo(IMAGE_URL); }
    catch (err) {
      throw new Error('Tai anh that bai: ' + err.message + '\n' +
        'Ban hay mo link anh 1Office trong Chrome, chuot phai > Save image as..., ' +
        'luu anh PNG, sau do chay lai: node CAP_NHAT_LOGO_HEXA.cjs --file "C:\\duong-dan\\logo.png"\n' +
        'Chua sua bat ky file ma nguon nao.');
    }
  }
  if (!assertPNG(logo)) throw new Error('File tai ve khong phai PNG hop le (co the la trang login 1Office). Chua sua ma nguon.');

  const replacement = `<div className="side-brand"><button type="button" className="hexa-sidebar-brand-reload" title="Tai lai trang HEXA" aria-label="Tai lai trang HEXA" onClick={() => window.location.reload()}><img className="hexa-sidebar-brand-image" src="/hexa-sidebar-logo.png" alt="Logo HEXA" /></button></div>`;
  const newApp = alreadyModified ? app : app.replace(oldBrand, replacement);
  const cssAppend = `\n\n/* ${MARKER}: Logo 1Office thay HEXA. & nut tai lai trang */\n.side-brand .hexa-sidebar-brand-reload {\n  display: flex; align-items: center; justify-content: flex-start;\n  width: 100%; min-width: 0; min-height: 52px;\n  padding: 0; margin: 0; border: 0; background: transparent;\n  border-radius: 10px; cursor: pointer; text-align: left;\n}\n.side-brand .hexa-sidebar-brand-reload:hover { opacity: .86; }\n.side-brand .hexa-sidebar-brand-reload:focus-visible { outline: 2px solid #0c8d7d; outline-offset: 4px; }\n.side-brand .hexa-sidebar-brand-image {\n  display: block; width: auto; height: 52px; max-width: 100%;\n  object-fit: contain; object-position: left center;\n}\n@media (min-width: 801px) {\n  .admin-root.sidebar-collapsed .side-brand .hexa-sidebar-brand-reload { width: 48px; min-height: 48px; justify-content: center; }\n  .admin-root.sidebar-collapsed .side-brand .hexa-sidebar-brand-image { height: 40px; max-width: 42px; object-position: center; }\n}\n`;
  const newCss = css.includes(MARKER) ? css : css + cssAppend;
  const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'HEXA-sidebar-logo-backup-'));
  fs.copyFileSync(appPath, path.join(backupDir, 'App.jsx'));
  fs.copyFileSync(cssPath, path.join(backupDir, 'styles.css'));
  try {
    fs.mkdirSync(publicDir, { recursive: true });
    fs.writeFileSync(outputImage, logo);
    fs.writeFileSync(appPath, newApp);
    fs.writeFileSync(cssPath, newCss);
  } catch (err) {
    fs.copyFileSync(path.join(backupDir, 'App.jsx'), appPath);
    fs.copyFileSync(path.join(backupDir, 'styles.css'), cssPath);
    throw err;
  }
  console.log('[OK] Da thay logo sidebar bang anh PNG.');
  console.log('[OK] Bam vao logo se tai lai trang hien tai (vi du /it).');
  console.log('[OK] Anh duoc luu local: ' + outputImage);
  console.log('[BACKUP] ' + backupDir);
  console.log('De day Git: git add frontend/src/App.jsx frontend/src/styles.css frontend/public/hexa-sidebar-logo.png');
}

main().catch(err => { console.error('[STOP] ' + err.message); process.exitCode = 1; });
