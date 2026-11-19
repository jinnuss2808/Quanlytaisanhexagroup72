#!/usr/bin/env node
'use strict';
/*
  HEXA - compact asset workspace / 19 Nov 2026
  Applies a small, verified patch to the user's existing frontend; does not
  replace entire files, touch Firebase, edit credentials or deploy anything.
*/
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const MARK = 'HEXA_ASSET_DENSE_NAV_20261119_V1';
const CSS_MARK = 'HEXA_ASSET_DENSE_CSS_20261119_V1';
const MODULE_MARK = 'HEXA_MODULES_DENSE_CSS_20261119_V1';
const checkMode = process.argv.includes('--check');
const sourceRoot = process.argv.find((a, i) => i > 1 && !a.startsWith('--')) || process.cwd();
const root = path.resolve(sourceRoot);
const jsxPath = path.join(root, 'frontend', 'src', 'AssetManagement.jsx');
const cssPath = path.join(root, 'frontend', 'src', 'asset-management.css');
const moduleCssPath = path.join(root, 'frontend', 'src', 'hexa-modules.css');
const assert = (ok, message) => { if (!ok) throw new Error(message); };

function patchJSX(original) {
  if (original.includes(MARK)) return {content:original,changed:false};
  let src = original;
  assert(src.includes('const hexaTabMenuRef = useRef(null);'), 'Khong tim thay state tab menu cua AssetManagement.jsx. Khong sua tu dong.');
  src = src.replace('  const hexaTabMenuRef = useRef(null);', `  const hexaTabMenuRef = useRef(null);
  const [hexaExtraMenuOpen, hexaSetExtraMenuOpen] = useState(false);
  const hexaExtraMenuRef = useRef(null);`);
  assert(src.includes('  const hexaToggleTab = id => {'), 'Khong tim thay hexaToggleTab.');
  src = src.replace('  const hexaToggleTab = id => {', `  useEffect(() => {
    if (!hexaExtraMenuOpen) return;
    const onPointer = event => { if (!hexaExtraMenuRef.current?.contains(event.target)) hexaSetExtraMenuOpen(false); };
    const onKey = event => { if (event.key === 'Escape') hexaSetExtraMenuOpen(false); };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onPointer); document.removeEventListener('keydown', onKey); };
  }, [hexaExtraMenuOpen]);
  const hexaToggleTab = id => {`);
  assert(/if \(id === 'assets'\) return;/.test(src), 'Khong tim thay chot tab assets.');
  src = src.replace("if (id === 'assets') return;", "if (['assets','warehouse','printers','trash'].includes(id)) return;");
  const modesStart = src.indexOf('  const modes=');
  const returnStart = src.indexOf('  return <div className="am-root">', modesStart);
  assert(modesStart !== -1 && returnStart !== -1 && returnStart > modesStart, 'Khong tim thay mang modes/tab root; ma nguon co the da doi.');
  const originalModes = src.slice(modesStart,returnStart);
  assert(originalModes.includes('stocktake') && originalModes.includes('hexaVisibleModes'), 'Cau truc modes moi khong khop, de bao ve source da dung.');
  src = src.slice(0, modesStart) + `  /* ${MARK}: reorganize navigation only; keep all asset data and operations. */
  const modes=[['assets','Danh sách tài sản',Boxes],['warehouse','Kho thiết bị',PackageSearch],['printers','Quản lý máy in',Wrench],['stock','Kho linh kiện',HardDrive],['reports','Báo cáo tài sản',Building2],['trash','Thùng rác',Trash2],...(isManager?[['catalogs','Danh mục',Tags],['import','Nhập dữ liệu',Upload],['backups','Sao lưu',Download]]:[])];
  const hexaPrimaryModes = modes.filter(([id]) => ['assets','warehouse','printers'].includes(id));
  const hexaOptionalModes = modes.filter(([id]) => !['assets','warehouse','printers','trash'].includes(id));
  const hexaExtraModes = hexaOptionalModes.filter(([id]) => !hexaHiddenTabs.includes(id));
  const hexaSelectMode = id => {
    setError(''); setNotice(''); setMode(id);
    setFilters(f => ({...f,page:1}));
    hexaSetExtraMenuOpen(false); hexaSetTabMenuOpen(false);
  };
` + src.slice(returnStart);
  const statLinePattern = /^    <div className="am-stats">[^\n]*$/m;
  assert(statLinePattern.test(src), 'Khong tim thay hang thong ke 5 o.');
  src = src.replace(statLinePattern, `    <div className="am-stats">{[[Boxes,'Tổng tài sản',stats.total],[CheckCircle2,'Có sẵn',stats.available],[Laptop,'Đang sử dụng',stats.using]].map(([Icon,label,value])=><div key={label} className="am-stat"><div className="am-stat-icon"><Icon size={18}/></div><span>{label}</span><strong>{value}</strong></div>)}</div>`);
  const toolbarStart = src.indexOf('    <div className="am-tabs-toolbar">');
  const errStart = src.indexOf('    {error&&', toolbarStart);
  assert(toolbarStart !== -1 && errStart > toolbarStart && (errStart - toolbarStart) < 6000, 'Khong tim thay thanh tab AssetManagement o vi tri du kien.');
  src = src.slice(0,toolbarStart) + `    <div className="am-tabs-toolbar">
      <div className="am-pill-tabs am-main-tabs" role="tablist" aria-label="Phân hệ thường dùng">
        {hexaPrimaryModes.map(([id,label,Icon])=><button key={id} type="button" role="tab" aria-selected={mode===id} className={mode===id?'active':''} onClick={()=>hexaSelectMode(id)}><Icon size={15}/>{label}</button>)}
      </div>
      <div className="am-tab-menu-actions">
        <div className="am-more-wrapper" ref={hexaExtraMenuRef}>
          <button type="button" className={'am-more-trigger'+(hexaExtraModes.some(([id])=>id===mode)?' active':'')} aria-expanded={hexaExtraMenuOpen} aria-controls="hexa-extra-tab-list" onClick={()=>{hexaSetExtraMenuOpen(open=>!open);hexaSetTabMenuOpen(false);}}><LayoutGrid size={15}/> Thêm <ChevronRight className="am-more-caret" size={13}/></button>
          {hexaExtraMenuOpen&&<div className="am-extra-dropdown" id="hexa-extra-tab-list" role="menu" aria-label="Các mục phụ">
            {hexaExtraModes.length?hexaExtraModes.map(([id,label,Icon])=><button type="button" role="menuitem" key={id} className={mode===id?'active':''} onClick={()=>hexaSelectMode(id)}><Icon size={15}/>{label}</button>):<p>Chưa bật mục phụ. Chọn “Tùy chọn” để bật.</p>}
          </div>}
        </div>
        <button type="button" title="Thùng rác" aria-label="Thùng rác" className={'am-trash-shortcut'+(mode==='trash'?' active':'')} onClick={()=>hexaSelectMode('trash')}><Trash2 size={17}/></button>
        <div className="am-tab-settings" ref={hexaTabMenuRef}>
          <button type="button" className="am-tab-settings-trigger" title="Ẩn hoặc hiện các mục phụ" aria-label="Ẩn hoặc hiện các mục phụ" aria-expanded={hexaTabMenuOpen} aria-controls="hexa-tab-visibility-panel" onClick={()=>{hexaSetTabMenuOpen(open=>!open);hexaSetExtraMenuOpen(false);}}><LayoutGrid size={15}/><span>Tùy chọn</span></button>
          {hexaTabMenuOpen&&<div className="am-tab-visibility-panel" id="hexa-tab-visibility-panel" role="group" aria-label="Tùy chỉnh các mục phụ">
            <div className="am-tab-visibility-head"><strong>Hiển thị trong “Thêm”</strong><button type="button" onClick={()=>hexaSetTabMenuOpen(false)} aria-label="Đóng"><X size={16}/></button></div>
            {hexaOptionalModes.map(([id,label,Icon])=><label className="am-tab-visibility-option" key={id}><input type="checkbox" checked={!hexaHiddenTabs.includes(id)} onChange={()=>hexaToggleTab(id)}/><Icon size={15}/><span>{label}</span></label>)}
            <button type="button" className="am-tab-visibility-reset" onClick={()=>hexaSetHiddenTabs([])}>Hiện tất cả mục phụ</button>
          </div>}
        </div>
      </div>
    </div>
` + src.slice(errStart);
  // The original arrow icon is already imported and rotated by CSS.
  assert(!src.includes('hexaVisibleModes'), 'Con mot tham chieu tabs cu; patch khong an toan.');
  return {content:src,changed:true};
}

const compactCss = String.raw`
/* HEXA_ASSET_DENSE_CSS_20261119_V1 — display only; do not alter backend/data */
.am-root .am-stats{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:8px!important;margin:0 0 8px!important;overflow:visible}
.am-root .am-stat{height:65px!important;min-height:65px!important;max-height:65px!important;padding:8px 12px!important;display:grid!important;grid-template-columns:32px minmax(0,1fr);grid-template-rows:17px 23px;align-content:center;column-gap:9px;box-shadow:none!important}
.am-root .am-stat-icon{grid-column:1;grid-row:1/3;width:31px!important;height:31px!important;margin:0!important;align-self:center}
.am-root .am-stat-icon svg{width:16px;height:16px}
.am-root .am-stat span{grid-column:2;grid-row:1;margin:0;font-size:10.5px;line-height:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.am-root .am-stat strong{grid-column:2;grid-row:2;font-size:20px!important;line-height:23px;margin:0!important}
.am-root .am-tabs-toolbar{height:38px!important;min-height:38px!important;margin-bottom:8px!important;align-items:center!important;gap:6px!important;z-index:40}
.am-root .am-tabs-toolbar .am-main-tabs{height:38px!important;min-height:38px!important;gap:3px!important;padding:3px 5px;overflow-x:auto}
.am-root .am-tabs-toolbar .am-main-tabs button{height:30px!important;min-height:30px!important;padding:5px 9px!important;font-size:11px!important;gap:5px!important}
.am-root .am-tab-menu-actions{display:flex;align-items:center;justify-content:flex-end;gap:6px;flex:0 0 auto;min-width:0}
.am-root .am-more-wrapper{position:relative;z-index:44}
.am-root .am-more-trigger,.am-root .am-trash-shortcut{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:5px;height:34px;min-height:34px;border:1px solid #d4e8e3;border-radius:8px;background:#fff;color:#356e63;cursor:pointer;font:inherit;font-size:11px;font-weight:800;padding:5px 10px;white-space:nowrap}
.am-root .am-trash-shortcut{width:36px;padding:4px;flex:0 0 36px}
.am-root .am-more-trigger:hover,.am-root .am-trash-shortcut:hover,.am-root .am-more-trigger[aria-expanded="true"]{border-color:#8fcfc1;color:#006457;background:#effaf7}
.am-root .am-more-trigger.active,.am-root .am-trash-shortcut.active{border-color:#0b6b5e;background:#0b6b5e;color:#fff}
.am-root .am-more-caret{transform:rotate(90deg);transition:transform .15s}
.am-root .am-more-trigger[aria-expanded="true"] .am-more-caret{transform:rotate(-90deg)}
.am-root .am-extra-dropdown{position:absolute;top:calc(100% + 6px);right:0;z-index:120;min-width:205px;max-width:min(300px,calc(100vw - 32px));max-height:65dvh;overflow-y:auto;background:#fff;border:1px solid #daece7;border-radius:10px;box-shadow:0 12px 30px #12463b24;padding:6px}
.am-root .am-extra-dropdown button{display:flex;align-items:center;gap:10px;width:100%;min-height:35px;border:0;border-radius:7px;background:transparent;color:#32675e;font:inherit;font-size:12px;font-weight:700;padding:8px 10px;text-align:left;cursor:pointer;white-space:nowrap}
.am-root .am-extra-dropdown button:hover,.am-root .am-extra-dropdown button.active{background:#e8f7f2;color:#005b4e}
.am-root .am-extra-dropdown p{font-size:11px;line-height:1.5;padding:7px 9px;margin:0;color:#52786e}
.am-root .am-tab-menu-actions .am-tab-settings{flex:0 0 auto!important;position:relative;z-index:43}
.am-root .am-tab-settings-trigger{height:34px!important;min-height:34px!important;width:auto!important;padding:5px 10px!important;gap:6px!important;font-size:11px!important;white-space:nowrap}
.am-root .am-tab-settings-trigger span{display:inline}
.am-root .am-tab-visibility-panel{top:calc(100% + 7px);max-height:min(360px,70dvh)}
.am-root .am-tab-stage{height:clamp(480px,calc(100dvh - 205px),1200px)!important;min-height:0!important;max-height:none!important}
.am-root .am-card.am-asset-list-card{height:100%!important;min-height:0!important;max-height:none!important}
.am-root .am-assets-toolbar{padding:7px 8px!important;gap:6px!important}
.am-root .am-assets-toolbar .am-search{height:34px!important}
.am-root .am-assets-toolbar select{height:34px!important;font-size:11px}
.am-root .am-assets-toolbar .am-btn,.am-root .am-assets-toolbar .am-toolbar-actions .am-btn{min-height:34px!important;height:34px!important;padding:6px 8px!important;font-size:11px!important}
.am-root .am-asset-list-card .am-assets-table th{padding:9px 7px!important}
.am-root .am-asset-list-card .am-assets-table td{padding:9px 7px!important}
.am-root .am-asset-list-card .am-assets-table{min-width:840px}
.am-root .am-tab-stage .pm-root{gap:8px}
.am-root .am-tab-stage .pm-tab-viewport{height:clamp(480px,calc(100dvh - 265px),1100px)!important;min-height:0!important}
.am-root .am-tab-stage .am-warehouse{gap:8px}
.am-root .am-tab-stage .am-warehouse-summary{min-height:0!important;gap:6px!important}
.am-root .am-warehouse-summary>div{padding:7px 10px!important;min-height:33px;font-size:11px}
.am-root .am-warehouse .am-warehouse-filter{padding:8px!important}
.am-root .am-warehouse .am-card.am-warehouse-device-list .am-table-wrap,.am-root .am-warehouse .am-card.am-warehouse-stock-list .am-table-wrap{max-height:calc(100dvh - 290px)!important;min-height:230px}
.am-root .am-warehouse .am-table th{padding:10px 9px!important}
.am-root .am-warehouse .am-table td{padding:10px 9px!important}
html[data-hexa-theme="dark"] .am-more-trigger,html[data-hexa-theme="dark"] .am-trash-shortcut,html[data-hexa-theme="dark"] .am-tab-settings-trigger{background:#213d35!important;border-color:#46695d!important;color:#d2e7df!important}
html[data-hexa-theme="dark"] .am-more-trigger.active,html[data-hexa-theme="dark"] .am-trash-shortcut.active{background:#147e6d!important;color:#fff!important}
html[data-hexa-theme="dark"] .am-extra-dropdown,html[data-hexa-theme="dark"] .am-tab-visibility-panel{background:#20382f!important;border-color:#46695d!important}
html[data-hexa-theme="dark"] .am-extra-dropdown button{color:#d5ebe1!important}
html[data-hexa-theme="dark"] .am-extra-dropdown button:hover,html[data-hexa-theme="dark"] .am-extra-dropdown button.active{background:#2a5144!important}
html[data-hexa-theme="dark"] .am-extra-dropdown p{color:#b4d1c5!important}
@media(max-width:820px){
 .am-root .am-stats{grid-template-columns:repeat(3,minmax(0,1fr))!important}
 .am-root .am-tab-settings-trigger{width:36px!important;padding:5px!important}
 .am-root .am-tab-settings-trigger span{display:none}
 .am-root .am-tabs-toolbar .am-main-tabs button{padding:5px 7px!important}
 .am-root .am-tab-stage{height:clamp(460px,calc(100dvh - 195px),970px)!important}
}
@media(max-width:520px){
 .am-root .am-stats{gap:5px!important}
 .am-root .am-stat{padding:7px!important;grid-template-columns:minmax(0,1fr);grid-template-rows:18px 21px;row-gap:1px}
 .am-root .am-stat-icon{display:none}
 .am-root .am-stat span,.am-root .am-stat strong{grid-column:1}
 .am-root .am-stat span{grid-row:1;font-size:9px}
 .am-root .am-stat strong{grid-row:2;font-size:18px!important}
 .am-root .am-more-trigger{padding:5px 7px}
 .am-root .am-tabs-toolbar{gap:3px!important}
 .am-root .am-tab-menu-actions{gap:3px}
}
`;

const moduleCss = String.raw`
/* HEXA_MODULES_DENSE_CSS_20261119_V1: compact Attendance & Link mail safely */
.hm-compact-directory{gap:8px!important}
.hm-compact-directory .hm-compact-toolbar{gap:7px!important}
.hm-compact-directory .hm-toolbar-search{min-height:34px!important}
.hm-compact-directory .hm-toolbar-search input{min-height:32px!important}
.hm-compact-directory .hm-btn-tight{min-height:33px!important;padding:6px 9px!important}
.hm-compact-directory .hm-panel.hm-directory-panel{border-radius:10px}
.hm-compact-directory .hm-scroll th{padding:10px 9px!important}
.hm-compact-directory .hm-scroll td{padding:8px 9px!important}
.hm-roster.hm-compact-directory .hm-roster-scroll{max-height:calc(100dvh - 155px)!important}
.hm-mail-v2.hm-compact-directory .hm-mail-table-scroll{max-height:calc(100dvh - 155px)!important}
@media(max-width:650px){.hm-compact-directory .hm-compact-toolbar{align-items:stretch}}
`;

function addMarkedCss(src, text, marker) {
  if (src.includes(marker)) return {content:src,changed:false};
  return {content:src.trimEnd() + '\n\n' + text.trim() + '\n',changed:true};
}
function main() {
  console.log('HEXA - Compact UI | Project:',root);
  assert(fs.existsSync(jsxPath), 'Khong tim thay frontend/src/AssetManagement.jsx trong thu muc nay.');
  assert(fs.existsSync(cssPath), 'Khong tim thay frontend/src/asset-management.css trong thu muc nay.');
  const changes=[];
  const j=patchJSX(fs.readFileSync(jsxPath,'utf8'));
  const c=addMarkedCss(fs.readFileSync(cssPath,'utf8'),compactCss,CSS_MARK);
  changes.push({file:jsxPath,...j},{file:cssPath,...c});
  if(fs.existsSync(moduleCssPath)) {
    const m=addMarkedCss(fs.readFileSync(moduleCssPath,'utf8'),moduleCss,MODULE_MARK);
    changes.push({file:moduleCssPath,...m});
  }
  for(const item of changes) console.log((item.changed ? '[UPDATE] ' : '[OK]     ') + path.relative(root,item.file));
  if(!changes.some(item=>item.changed)){console.log('Da cap nhat truoc do; khong can sua them.');return;}
  if(checkMode){console.log('[CHECK OK] Khop cau truc; chua ghi bat ky file nao.');return;}
  const backupDir=fs.mkdtempSync(path.join(os.tmpdir(),'HEXA_UI_COMPACT_BACKUP_'));
  const written=[];
  try{
    for(const item of changes.filter(item=>item.changed)){
      const relative=path.relative(root,item.file);
      const destination=path.join(backupDir,relative);
      fs.mkdirSync(path.dirname(destination),{recursive:true});
      fs.copyFileSync(item.file,destination);
      const tempFile=item.file+'.hexa-pending-'+process.pid;
      fs.writeFileSync(tempFile,item.content,'utf8');
      fs.renameSync(tempFile,item.file);
      written.push({item,destination});
    }
  } catch(err) {
    for (const x of written.reverse()) fs.copyFileSync(x.destination,x.item.file);
    throw err;
  }
  console.log('[OK] Cap nhat thanh cong. Backup (ngoai thu muc Git):',backupDir);
  console.log('Tiep theo: cd frontend ; npm run build ; npm run dev');
  console.log('Chi commit cac file frontend/src da kiem tra, khong can sua backend hay Firebase.');
}
try{main();}catch(err){console.error('[STOP] '+err.message);process.exitCode=1;}
