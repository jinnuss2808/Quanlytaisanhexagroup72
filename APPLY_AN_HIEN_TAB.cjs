'use strict';
// HEXA: toggle navigation tabs of Asset Management. Edits only two frontend files.
// No Firebase access, no npm install, and no overwriting unrelated JSX.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const root = process.cwd();
const jsxFile = path.join(root, 'frontend', 'src', 'AssetManagement.jsx');
const cssFile = path.join(root, 'frontend', 'src', 'asset-management.css');
const MARK_JS = 'HEXA_ASSET_TAB_VISIBILITY_V1';
const MARK_CSS = '/* HEXA_ASSET_TAB_VISIBILITY_V1 */';
const assert = (condition, message) => {if (!condition) throw new Error(message);};

const helper = `// ${MARK_JS}: chỉ ẩn các TAB, không thay đổi dữ liệu Firebase.\nconst HEXA_DEFAULT_HIDDEN_ASSET_TABS = ['stock', 'stocktake', 'reports'];\nfunction hexaReadHiddenAssetTabs(storageKey) {\n  try {\n    const saved = window.localStorage.getItem(storageKey);\n    if (saved === null) return [...HEXA_DEFAULT_HIDDEN_ASSET_TABS];\n    const items = JSON.parse(saved);\n    return Array.isArray(items) ? items.filter(id => typeof id === 'string' && id !== 'assets') : [...HEXA_DEFAULT_HIDDEN_ASSET_TABS];\n  } catch {\n    return [...HEXA_DEFAULT_HIDDEN_ASSET_TABS];\n  }\n}\n`;

const hook = `  const hexaTabStorageKey = 'hexa.asset.hiddenTabs.v1:' + (user?.uid || user?.email || 'local');\n  const [hexaHiddenTabs, hexaSetHiddenTabs] = useState(() => hexaReadHiddenAssetTabs(hexaTabStorageKey));\n  const [hexaTabMenuOpen, hexaSetTabMenuOpen] = useState(false);\n  const hexaTabMenuRef = useRef(null);\n  useEffect(() => {\n    hexaSetHiddenTabs(hexaReadHiddenAssetTabs(hexaTabStorageKey));\n  }, [hexaTabStorageKey]);\n  useEffect(() => {\n    try { window.localStorage.setItem(hexaTabStorageKey, JSON.stringify(hexaHiddenTabs)); } catch {}\n  }, [hexaTabStorageKey, hexaHiddenTabs]);\n  useEffect(() => {\n    if (!hexaTabMenuOpen) return;\n    const onPointer = event => {if (!hexaTabMenuRef.current?.contains(event.target)) hexaSetTabMenuOpen(false);};\n    const onKey = event => {if (event.key === 'Escape') hexaSetTabMenuOpen(false);};\n    document.addEventListener('pointerdown', onPointer);\n    document.addEventListener('keydown', onKey);\n    return () => {document.removeEventListener('pointerdown', onPointer); document.removeEventListener('keydown', onKey);};\n  }, [hexaTabMenuOpen]);\n  const hexaToggleTab = id => {\n    if (id === 'assets') return; // Không ẩn mục chính để luôn có nơi quay về.\n    hexaSetHiddenTabs(previous => previous.includes(id) ? previous.filter(x => x !== id) : [...previous, id]);\n    if (mode === id && !hexaHiddenTabs.includes(id)) setMode('assets');\n  };\n`;

const nav = `    <div className="am-tabs-toolbar">\n      <div className="am-pill-tabs am-main-tabs" role="tablist" aria-label="Các phân hệ quản lý tài sản">\n        {hexaVisibleModes.map(([id,label,Icon])=><button key={id} type="button" role="tab" aria-selected={mode===id} className={mode===id?'active':''} onClick={()=>{setError('');setNotice('');setMode(id);setFilters(f=>({...f,page:1}));}}><Icon size={15}/>{label}</button>)}\n      </div>\n      <div className="am-tab-settings" ref={hexaTabMenuRef}>\n        <button type="button" className="am-tab-settings-trigger" aria-expanded={hexaTabMenuOpen} aria-controls="hexa-tab-visibility-panel" onClick={()=>hexaSetTabMenuOpen(open=>!open)}><LayoutGrid size={16}/> Ẩn/hiện mục</button>\n        {hexaTabMenuOpen&&<div className="am-tab-visibility-panel" id="hexa-tab-visibility-panel" role="group" aria-label="Tùy chỉnh các mục hiển thị">\n          <div className="am-tab-visibility-head"><strong>Chọn mục cần hiển thị</strong><button type="button" onClick={()=>hexaSetTabMenuOpen(false)} aria-label="Đóng"><X size={16}/></button></div>\n          {modes.map(([id,label,Icon])=><label className="am-tab-visibility-option" key={id}><input type="checkbox" checked={id==='assets'||!hexaHiddenTabs.includes(id)} disabled={id==='assets'} onChange={()=>hexaToggleTab(id)}/><Icon size={15}/><span>{label}</span>{id==='assets'&&<small>Cố định</small>}</label>)}\n          <button type="button" className="am-tab-visibility-reset" onClick={()=>hexaSetHiddenTabs([])}>Hiện tất cả mục</button>\n        </div>}\n      </div>\n    </div>`;

const css = String.raw`
${MARK_CSS}
/* Một hàng menu chiều cao cố định; nội dung cuộn ngang không làm các ô thống kê co giãn. */
.am-root .am-tabs-toolbar {
  display: flex;
  align-items: stretch;
  gap: 8px;
  width: 100%;
  min-width: 0;
  height: 45px;
  min-height: 45px;
  margin-bottom: 14px;
  position: relative;
  z-index: 20;
}
.am-root .am-tabs-toolbar .am-main-tabs {
  flex: 1 1 auto;
  width: auto;
  min-width: 0;
  max-width: 100%;
  display: flex;
  flex-wrap: nowrap;
  height: 45px;
  min-height: 45px;
  margin: 0;
  align-items: center;
  overflow-x: auto;
  overflow-y: hidden;
  white-space: nowrap;
  scrollbar-width: none;
}
.am-root .am-tabs-toolbar .am-main-tabs::-webkit-scrollbar { display: none; }
.am-root .am-tabs-toolbar .am-main-tabs button {
  flex: 0 0 auto;
  height: 36px;
  min-height: 36px;
  white-space: nowrap;
}
.am-root .am-tab-settings { flex: 0 0 145px; position: relative; z-index: 30; min-width: 0; }
.am-root .am-tab-settings-trigger {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  gap: 7px;
  width: 100%;
  height: 45px;
  min-height: 45px;
  border: 1px solid #dce6f5;
  border-radius: 9px;
  background: #fff;
  color: #385a87;
  font-size: 11px;
  font-weight: 800;
  white-space: nowrap;
}
.am-root .am-tab-settings-trigger:hover,
.am-root .am-tab-settings-trigger[aria-expanded="true"] { border-color: #7ca3ef; color: #2363d8; background: #f7faff; }
.am-root .am-tab-visibility-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: min(306px, calc(100vw - 32px));
  max-height: min(460px, 70dvh);
  overflow-y: auto;
  background: #fff;
  border: 1px solid #e0e8f5;
  border-radius: 12px;
  box-shadow: 0 16px 36px #19325224;
  padding: 11px;
  z-index: 110;
}
.am-root .am-tab-visibility-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 9px; gap: 8px; padding: 0 4px 6px; border-bottom: 1px solid #eff2f7; }
.am-root .am-tab-visibility-head strong { font-size: 12px; color: #2a405d; }
.am-root .am-tab-visibility-head button { border: 0; background: transparent; color: #8192aa; padding: 4px; display: grid; place-items: center; }
.am-root .am-tab-visibility-option { width: 100%; display: flex; align-items: center; min-height: 35px; gap: 9px; font-size: 12px; color: #465e80; padding: 6px 7px; border-radius: 7px; cursor: pointer; }
.am-root .am-tab-visibility-option:hover { background: #f2f6fe; }
.am-root .am-tab-visibility-option input { accent-color: #2c68e0; width: 15px; height: 15px; flex: 0 0 auto; }
.am-root .am-tab-visibility-option svg { color: #6d89b0; flex: 0 0 auto; }
.am-root .am-tab-visibility-option span { flex: 1; }
.am-root .am-tab-visibility-option small { color: #96a5b7; font-size: 10px; }
.am-root .am-tab-visibility-reset { display: block; margin-top: 8px; padding: 9px 12px; width: 100%; border: 1px solid #dfebfa; border-radius: 7px; background: #f7faff; color: #2764d9; font-weight: 800; font-size: 11px; }
@media (max-width: 640px) {
  .am-root .am-tab-settings { flex-basis: 48px; }
  .am-root .am-tab-settings-trigger { font-size: 0; gap: 0; }
  .am-root .am-tab-settings-trigger svg { width: 17px; height: 17px; }
}
`;

function patchJsx(original) {
  if (original.includes(MARK_JS)) return {updated: original, already: true};
  assert(/import React,\s*\{[^}]*\}\s*from\s*['"]react['"]/.test(original), 'Không tìm thấy import React phù hợp; dừng để không ghi đè mã nguồn.');
  assert(/export default function AssetManagement\(\{user,/.test(original), 'Không tìm thấy component AssetManagement mong đợi.');
  assert(original.includes("const isManager=user.role==='manager';"), 'Không tìm thấy điểm chèn trạng thái trong AssetManagement.');
  assert(original.includes('  const modes=[['), 'Không tìm thấy danh sách tab.');
  assert(original.includes('className="am-pill-tabs am-main-tabs"'), 'Không tìm thấy thanh tab hiện tại.');
  assert(original.includes('LayoutGrid') && original.includes('<X size='), 'Không tìm thấy icon LayoutGrid/X.');
  let result = original.replace(/import React,\s*\{([^}]*)\}\s*from\s*['"]react['"];?/, (full, names) => {
    if (names.split(',').map(x => x.trim()).includes('useRef')) return full;
    return full.replace(names, names.trimEnd() + ', useRef');
  });
  const assetStart = 'export default function AssetManagement({user,initialTicket=null,onClearInitialTicket=()=>{}}){';
  result = result.replace(assetStart, helper + assetStart);
  const managerLine = "  const isManager=user.role==='manager';";
  result = result.replace(managerLine, managerLine + '\n' + hook);
  // Only append derived visible mode list directly after modes declaration.
  const modeLineMatches = [...result.matchAll(/^\s*const modes=\[\[/gm)];
  assert(modeLineMatches.length === 1, 'Không xác định duy nhất danh sách tab.');
  result = result.replace(/(^\s*const modes=\[\[.*;)(\r?\n)/m, "$1$2  const hexaVisibleModes = modes.filter(([id]) => id === 'assets' || !hexaHiddenTabs.includes(id));$2");
  const oldNav = /^\s*<div className="am-pill-tabs am-main-tabs">[^\n]*<\/div>/gm;
  const hits = [...result.matchAll(oldNav)];
  assert(hits.length === 1 && hits[0][0].includes('modes.map('), 'Không tìm thấy thanh tab duy nhất phù hợp; dừng an toàn.');
  result = result.replace(oldNav, '\n' + nav);
  assert(result.includes(MARK_JS) && result.includes('hexaVisibleModes.map') && result.includes('am-tab-visibility-panel'), 'Không thể kiểm chứng nội dung đã chèn.');
  return {updated: result, already: false};
}
function patchCss(original) {
  if (original.includes(MARK_CSS)) return {updated:original, already:true};
  assert(original.includes('.am-pill-tabs') && original.includes('.am-root'), 'CSS của dự án không đúng phiên bản HEXA.');
  return {updated: original.trimEnd() + '\n' + css + '\n', already:false};
}

try {
  assert(fs.existsSync(jsxFile) && fs.existsSync(cssFile), 'Hãy đặt 2 file BAT/CJS ở thư mục gốc HEXA (có frontend/src).');
  const beforeJsx=fs.readFileSync(jsxFile,'utf8');
  const beforeCss=fs.readFileSync(cssFile,'utf8');
  const jsx=patchJsx(beforeJsx); const stylesheet=patchCss(beforeCss);
  assert(jsx.already === stylesheet.already, 'JSX/CSS đang ở hai phiên bản khác nhau. Chưa sửa file nào; cần kiểm tra lại.');
  if (jsx.already) {
    console.log('[OK] Chức năng ẩn/hiện đã có, không cập nhật lại.');
    process.exit(0);
  }
  // Leave backups outside the repository, so git add -A cannot accidentally include them.
  const now = new Date().toISOString().replace(/[:.]/g, '-');
  const backupBase = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), '.hexa'), 'HEXA', 'source-backups', 'asset-tabs-' + now);
  fs.mkdirSync(backupBase, {recursive:true});
  fs.copyFileSync(jsxFile, path.join(backupBase,'AssetManagement.jsx'));
  fs.copyFileSync(cssFile, path.join(backupBase,'asset-management.css'));
  try {
    fs.writeFileSync(jsxFile,jsx.updated,'utf8');
    fs.writeFileSync(cssFile,stylesheet.updated,'utf8');
  } catch (e) {
    fs.writeFileSync(jsxFile,beforeJsx,'utf8');
    fs.writeFileSync(cssFile,beforeCss,'utf8');
    throw e;
  }
  console.log('[OK] Mặc định ẩn Kho linh kiện, Kiểm kê QR, Báo cáo tài sản.');
  console.log('[OK] Có nút Ẩn/hiện mục để bật lại, lưu lựa chọn theo tài khoản trên trình duyệt.');
  console.log('[OK] Chỉ sửa 2 file frontend. Backup:',backupBase);
  console.log('[OK] Git có thể theo dõi thay đổi từ frontend/src.');
} catch (error) {
  console.error('[FAILED]',error.message);
  process.exitCode=1;
}
