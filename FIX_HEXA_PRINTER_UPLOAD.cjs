'use strict';
// Idempotent patch: read-only validations first, then backup outside repository.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const root = __dirname;
const rel = {
  app: 'backend/src/app.js',
  core: 'backend/src/it-library-core.js',
  printer: 'frontend/src/PrinterManagement.jsx',
  css: 'frontend/src/printer-management.css',
  library: 'frontend/src/ITLibrary.jsx',
};
const marker = 'HEXA_UNIFIED_PRINTER_UPLOAD_20261113_V1';
const files = {};
function fail(message) { throw new Error(message); }
function need(value, message) { if (!value) fail(message); }
function replaceRequired(s, needle, value, label) {
  need(s.includes(needle), 'Không tìm thấy đoạn ' + label + ' của phiên bản tương thích. Chưa ghi file.');
  return s.replace(needle, value);
}
try {
  need(fs.existsSync(path.join(root,'backend/package.json')) && fs.existsSync(path.join(root,'frontend/package.json')),
    'Đặt BAT/CJS vào thư mục GỐC dự án HEXA (cùng cấp frontend và backend).');
  for (const [key, p] of Object.entries(rel)) {
    need(fs.existsSync(path.join(root,p)), 'Thiếu ' + p + '; hãy áp dụng bản Thư viện IT trước.');
    files[key] = fs.readFileSync(path.join(root,p),'utf8');
  }
  let {app,core,printer,css,library} = files;
  if (!app.includes('HEXA_ITLIB_500_EXPOSE_V1')) {
    need(app.includes("app.use((err, _req, res, _next) => {") || app.includes("app.use((err, req, res, _next) => {"),
      'Không tìm thấy bộ xử lý lỗi API Express.');
    app = app.replace('app.use((err, _req, res, _next) => {', 'app.use((err, req, res, _next) => {');
    const line = "  res.status(status).json({ error: status >= 500 ? 'Lỗi hệ thống. Vui lòng thử lại.' : err.message });";
    const block = `  // HEXA_ITLIB_500_EXPOSE_V1: only explicitly safe library errors may be shown.\n  const inLibrary = String(req.originalUrl || '').startsWith('/api/it-library/');\n  const safeLibraryMessage = inLibrary && err?.expose === true && typeof err.message === 'string';\n  const traceId = inLibrary && status >= 500 ? 'ITL-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2,6).toUpperCase() : '';\n  if (traceId) console.error('[IT_LIBRARY_TRACE]', { traceId, method: req.method, path: req.path, status, code: String(err?.code || 'unknown').slice(0,80) });\n  const publicMessage = status >= 500 && !safeLibraryMessage\n    ? (traceId ? 'Thư viện IT gặp lỗi tại API (mã ' + traceId + '). Xem log backend/Vercel theo mã lỗi này.' : 'Lỗi hệ thống. Vui lòng thử lại.')\n    : err.message;\n  res.status(status).json({ error: publicMessage });`;
    app = replaceRequired(app, line, block, 'lỗi HTTP 500');
  }
  if (!core.includes('HEXA_ITLIB_SAFE_ERROR_V1')) {
    core = replaceRequired(core,
      'export function libError(status, message) { return Object.assign(new Error(message), { status }); }',
      '// HEXA_ITLIB_SAFE_ERROR_V1: messages created by this module are suitable for clients.\nexport function libError(status, message) { return Object.assign(new Error(message), { status, expose: true }); }',
      'libError');
  }
  if (!printer.includes('pm-unified-toolbar')) {
    const func = printer.indexOf('export default function PrinterManagement(');
    need(func >= 0, 'Không thấy component PrinterManagement.');
    const start = printer.indexOf('    <div className="pm-heading">',func);
    const tabs = printer.indexOf('    <div className="pm-tabs" role="tablist"',func);
    const notice = printer.indexOf('    {notice&&',func);
    need(start >= 0 && tabs > start && notice > tabs, 'Không nhận diện được hai hàng điều khiển Máy in.');
    const heading = printer.slice(start,tabs);
    const actionStart = heading.indexOf('      <div className="pm-heading-actions">');
    const actionEnd = heading.indexOf('      </div>', actionStart) + '      </div>'.length;
    need(actionStart >= 0 && actionEnd > actionStart, 'Không thấy các nút Làm mới / Thêm máy in.');
    const actions = heading.slice(actionStart,actionEnd).trim();
    need(actions.includes('Làm mới') && actions.includes('Thêm máy in') && actions.includes('Thêm mực'), 'Các nút máy in không khớp bản tương thích.');
    const tabBlock = printer.slice(tabs,notice).trim();
    need(tabBlock.includes('Danh sách máy in') && tabBlock.includes('Mực trong kho') && tabBlock.endsWith('</div>'), 'Không thấy hai tab máy in và mực.');
    // Reuse existing event handlers and state (refresh, create, tabs) without touching business logic.
    const toolbar = `    {/* ${marker} */}\n    <div className="pm-unified-toolbar">\n      ${tabBlock}\n      ${actions}\n    </div>\n`;
    printer = printer.slice(0,start) + toolbar + printer.slice(notice);
  }
  if (!css.includes('HEXA_UNIFIED_PRINTER_TOOLBAR_V1')) {
    css += `\n/* HEXA_UNIFIED_PRINTER_TOOLBAR_V1 */\n/* Tabs, refresh and create controls share one row; mobile can scroll horizontally. */\n.pm-root .pm-unified-toolbar { display:flex; flex-wrap:nowrap; align-items:center; gap:12px; width:100%; min-width:0; max-width:100%; overflow-x:auto; overflow-y:hidden; scrollbar-width:thin; padding:2px 0; box-sizing:border-box; }\n.pm-root .pm-unified-toolbar > .pm-tabs { display:flex; flex:1 0 auto; min-width:max-content; width:auto; margin:0; flex-wrap:nowrap; overflow:visible; }\n.pm-root .pm-unified-toolbar > .pm-heading-actions { display:flex; flex:0 0 auto; width:auto; min-width:max-content; margin-left:auto; align-items:center; justify-content:flex-end; flex-wrap:nowrap; gap:9px; }\n.pm-root .pm-unified-toolbar .pm-heading-actions .am-btn { white-space:nowrap; flex-shrink:0; min-height:36px; }\n.pm-root .pm-unified-toolbar .pm-tabs button { white-space:nowrap; }\n.pm-root .pm-tab-viewport { height:clamp(680px, calc(100dvh - 210px), 980px); min-width:0; width:100%; }\n.pm-root .pm-tab-panel { width:100%; min-width:0; }\n.pm-root .pm-tab-panel > .am-card { display:flex; flex-direction:column; height:100%; width:100%; min-height:0; max-width:100%; }\n.pm-root .pm-tab-panel > .am-card > .pm-search { flex:0 0 auto; }\n.pm-root .pm-tab-panel > .am-card > .am-table-wrap { flex:1 1 auto; min-height:0; max-height:none; overflow:auto; width:100%; }\n@media (max-width:700px) {\n  .pm-root .pm-unified-toolbar { gap:8px; }\n  .pm-root .pm-unified-toolbar > .pm-tabs { flex:0 0 auto; }\n  .pm-root .pm-unified-toolbar > .pm-heading-actions { width:auto; justify-content:flex-start; }\n  .pm-root .pm-tab-viewport { height:clamp(550px, calc(100dvh - 200px), 850px); }\n}\n`;
  }
  if (!library.includes('HEXA_ITLIB_UPLOAD_STAGE_V1')) {
    library = replaceRequired(library, '  const save=async e=>{', '  // HEXA_ITLIB_UPLOAD_STAGE_V1\n  const save=async e=>{\n    let uploadStage = \'Chuẩn bị thông tin\';', 'save Thư viện IT');
    library = replaceRequired(library,
      "        setProgress('Đang tạo phiên upload an toàn...');",
      "        uploadStage='Khởi tạo phiên upload (POST /uploads)';\n        setProgress('Đang tạo phiên upload an toàn...');", 'stage đăng ký phiên');
    // Either older fetch flow or newer XHR flow may be present.
    if (library.includes("        setProgress('Đang tải file lên Firebase Storage... 0%');")) {
      library = library.replace("        setProgress('Đang tải file lên Firebase Storage... 0%');",
        "        uploadStage='Truyền file lên Firebase Storage (PUT)';\n        setProgress('Đang tải file lên Firebase Storage... 0%');");
    } else if (library.includes("        setProgress('Đang tải file lên Firebase Storage...');")) {
      library = library.replace("        setProgress('Đang tải file lên Firebase Storage...');",
        "        uploadStage='Truyền file lên Firebase Storage (PUT)';\n        setProgress('Đang tải file lên Firebase Storage...');");
    } else fail('Không nhận diện được bước tải Storage trong ITLibrary.jsx.');
    library = replaceRequired(library,
      "        setProgress('Đang xác nhận và lưu hồ sơ...');",
      "        uploadStage='Xác nhận và lưu hồ sơ (POST /complete)';\n        setProgress('Đang xác nhận và lưu hồ sơ...');",
      'stage xác nhận file');
    const pre = "    }catch(err){setError('Không thể lưu ";
    if (library.includes(pre)) {
      library=library.replace(pre,"    }catch(err){setError('['+uploadStage+'] '+'Không thể lưu ");
    } else if(library.includes('    }catch(err){setError(err.message)}finally{setWorking(false);setProgress(\'\');}')) {
      library=library.replace('    }catch(err){setError(err.message)}finally{setWorking(false);setProgress(\'\');}',
        "    }catch(err){setError('['+uploadStage+'] '+err.message)}finally{setWorking(false);setProgress('');}");
    } else fail('Không tìm thấy catch của nút Lưu Thư viện IT.');
  }
  const results = Object.entries(rel).map(([key,p])=>({p,old:files[key],next:({app,core,printer,css,library})[key]})).filter(x=>x.old!==x.next);
  if (!results.length) {console.log('[OK] Các bản vá đã được áp dụng từ trước.'); process.exit(0);}
  const stamp = new Date().toISOString().replace(/[:.]/g,'-');
  const backup = path.join(os.homedir(),'HEXA_SOURCE_BACKUPS','printer-it-library-'+stamp);
  for (const x of results) {
    const dst=path.join(backup,x.p);
    fs.mkdirSync(path.dirname(dst),{recursive:true});fs.writeFileSync(dst,x.old,'utf8');
  }
  const applied=[];
  try {for (const x of results) {fs.writeFileSync(path.join(root,x.p),x.next,'utf8');applied.push(x);}}
  catch(error){for (const x of applied) fs.writeFileSync(path.join(root,x.p),x.old,'utf8');throw error;}
  console.log('[OK] Đã chỉnh Thư viện IT và đưa tab/nút máy in cùng một hàng.');
  for (const x of results) console.log('  [UPDATED] '+x.p);
  console.log('[BACKUP] '+backup);
  console.log('[NEXT] Restart backend và build/deploy cả frontend lẫn backend trên Vercel.');
} catch(error) {console.error('[FAILED] '+error.message);process.exitCode=1;}
