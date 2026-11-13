'use strict';
// HEXA - printer list height + optional hide IT Library UI (no database mutation).
// Usage: node PATCH_HEXA_PRINTER_LIBRARY.cjs hide|keep
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const root = __dirname;
const mode = (process.argv[2] || 'hide').toLowerCase();
if (!['hide','keep'].includes(mode)) {console.error('Usage: node PATCH_HEXA_PRINTER_LIBRARY.cjs hide|keep');process.exit(2);}
const paths = {
  css: 'frontend/src/printer-management.css',
  printer: 'frontend/src/PrinterManagement.jsx',
  app: 'frontend/src/App.jsx',
};
const marker = 'HEXA_PRINTER_LONG_TABLE_20261113_V2';
function requireIt(value, message) {if(!value)throw Error(message);}
function replaceAllIfPresent(source, needle, replacement) {return source.includes(needle) ? source.split(needle).join(replacement) : source;}
function hideLibrary(app, printer) {
  const initialApp = app;
  const initialPrinter = printer;
  app=replaceAllIfPresent(app, "import ITLibrary from './ITLibrary';\n", '');
  app=replaceAllIfPresent(app, "import { FolderOpen } from 'lucide-react';\n", '');
  app=replaceAllIfPresent(app, "    { id: 'it_library', label: 'Thư viện IT', icon: FolderOpen },\n", '');
  app=replaceAllIfPresent(app, ", it_library: 'Thư viện IT'", '');
  app=replaceAllIfPresent(app, "!['assets','it_library'].includes(section)", "section !== 'assets'");
  app=replaceAllIfPresent(app, "          {section === 'it_library' && <ITLibrary user={user}/>}\n", '');
  printer=replaceAllIfPresent(printer, "import ITLibrary from './ITLibrary';\n", '');
  printer=replaceAllIfPresent(printer, "import { FolderOpen } from 'lucide-react';\n", '');
  printer=replaceAllIfPresent(printer, ",[ 'files','Driver & Tài liệu',FolderOpen]", '');
  printer=replaceAllIfPresent(printer, ",['files','Driver & Tài liệu',FolderOpen]", '');
  printer=replaceAllIfPresent(printer, "        {tab==='files'&&<ITLibrary user={user} printerId={printer.id} compact/>}\n", '');
  // Guard against silently leaving live entry points in unknown versions.
  requireIt(!app.includes("id: 'it_library'") && !app.includes("<ITLibrary") && !app.includes("import ITLibrary"),
    'Không ẩn được hết mục Thư viện IT trong App.jsx (phiên bản khác). Chưa sửa file.');
  requireIt(!printer.includes("<ITLibrary") && !printer.includes("'files','Driver & Tài liệu'") && !printer.includes("import ITLibrary"),
    'Không ẩn được hết tab Driver trong PrinterManagement.jsx. Chưa sửa file.');
  return {app, printer, changed:app!==initialApp || printer!==initialPrinter};
}

function addTableHeight(css) {
  if(css.includes(marker))return css;
  // Keep outside flow and sticky search bar; scroll only table rows.
  return css + `\n/* ${marker}: Tall printer table; user can drag bottom-right corner to resize. */\n.pm-root .pm-tab-viewport {\n  box-sizing: border-box;\n  min-height: 780px;\n  height: max(810px, calc(100dvh - 280px));\n  max-height: 1600px;\n  width: 100%;\n  resize: vertical;\n  overflow: hidden;\n}\n.pm-root .pm-tab-viewport > .pm-tab-panel {\n  box-sizing: border-box; height: 100%; min-height: 0; overflow: hidden;\n}\n.pm-root .pm-tab-panel > .am-card {\n  display: flex; flex-direction: column; width: 100%; height: 100%; min-height: 0;\n}\n.pm-root .pm-tab-panel > .am-card > .pm-search { flex: 0 0 auto; }\n.pm-root .pm-tab-panel > .am-card > .am-table-wrap {\n  display: block; flex: 1 1 auto; min-height: 0; max-height: none;\n  overflow-x: auto; overflow-y: auto; overscroll-behavior: contain;\n}\n.pm-root .pm-tab-panel .am-table-wrap thead th {\n  position: sticky; top: 0; z-index: 1;\n}\n.pm-root .pm-tab-panel .am-table td { padding-top: 11px; padding-bottom: 11px; }\n.pm-root .pm-tab-panel .pm-row-actions { display: flex; flex-wrap: nowrap; gap: 6px; }\n.pm-root .pm-tab-panel .pm-row-actions .am-btn { padding: 6px 8px; white-space: nowrap; }\n@media(max-width:740px) {\n  .pm-root .pm-tab-viewport { min-height: 560px; height: 620px; max-height: 1250px; }\n  .pm-root .pm-tab-panel .pm-row-actions { flex-wrap: wrap; }\n}\n`;
}

try {
  requireIt(fs.existsSync(path.join(root, 'frontend/package.json')),
    'Hãy chép BAT và CJS vào thư mục gốc dự án HEXA, cùng cấp frontend và backend.');
  const originals={};
  for (const [key,relative] of Object.entries(paths)) {
    requireIt(fs.existsSync(path.join(root,relative)), 'Không tìm thấy '+relative);
    originals[key]=fs.readFileSync(path.join(root,relative),'utf8');
  }
  let {css,printer,app}=originals;
  requireIt(css.includes('.pm-tab-viewport') && printer.includes('pm-tab-viewport'),
    'Không tìm thấy danh sách máy in tương thích. Chưa sửa file.');
  css=addTableHeight(css);
  if(mode==='hide')({app,printer}=hideLibrary(app,printer));
  const changed={css,printer,app};
  const updates=Object.keys(paths).map(key=>({key,relative:paths[key],old:originals[key],next:changed[key]})).filter(x=>x.old!==x.next);
  if(!updates.length){console.log('[OK] Thay đổi đã có trong dự án; không cần áp dụng lại.');process.exit(0);}
  const when=new Date().toISOString().replace(/[:.]/g,'-');
  const backupDir=path.join(os.homedir(),'HEXA_SOURCE_BACKUPS','printer-long-library-'+when);
  // Back up before mutating. Backups are OUTSIDE repo so they do not enter git staging.
  for(const u of updates){
    const dst=path.join(backupDir,u.relative);
    fs.mkdirSync(path.dirname(dst),{recursive:true});
    fs.writeFileSync(dst,u.old,'utf8');
  }
  const completed=[];
  try {
    for(const u of updates){fs.writeFileSync(path.join(root,u.relative),u.next,'utf8');completed.push(u);}
  } catch(err) {
    for(const u of completed)fs.writeFileSync(path.join(root,u.relative),u.old,'utf8');
    throw err;
  }
  console.log('[OK] Đã mở rộng bảng máy in xuống dưới (tối thiểu 780px trên desktop).');
  console.log(mode==='hide'?'[OK] Đã ẩn Thư viện IT và tab Driver trong giao diện. Không xóa dữ liệu.':'[OK] Đã giữ nguyên Thư viện IT.');
  for(const u of updates)console.log('  UPDATED '+u.relative);
  console.log('[BACKUP] '+backupDir);
  console.log('[NEXT] Chạy build và deploy lại frontend ticket-asset-hexa trên Vercel.');
} catch(err){console.error('[FAILED] '+err.message); process.exitCode=1;}
