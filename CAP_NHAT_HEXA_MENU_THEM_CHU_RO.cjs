#!/usr/bin/env node
'use strict';
// HEXA - 19/11/2026: one 'Thêm' menu and readable compact asset table.
// Non-destructive: only two frontend files, with --check, preflight and backup.
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const check=process.argv.includes('--check');
const dirArg=process.argv.slice(2).find(x=>!x.startsWith('--'));
const root=path.resolve(dirArg||process.cwd());
const jsPath=path.join(root,'frontend','src','AssetManagement.jsx');
const cssPath=path.join(root,'frontend','src','asset-management.css');
const JS_MARK='HEXA_ONE_MORE_MENU_READABLE_TABLE_20261119_V1';
const CSS_MARK='HEXA_ONE_MORE_MENU_TABLE_CSS_20261119_V1';
function assert(cond,msg){if(!cond)throw new Error(msg);}
function patchJsx(original){
  if(original.includes(JS_MARK))return {text:original,changed:false};
  const useCRLF=original.includes('\r\n');
  let src=original.replace(/\r\n/g,'\n');
  assert(src.includes('HEXA_ASSET_DENSE_NAV_20261119_V1'),'Chua tim thay ban Giao dien tinh gon tren AssetManagement.jsx. Khong ghi de.');
  assert(src.includes('HEXA_INLINE_ASSET_STATS_20261119_V2'),'Chua tim thay ban Thong ke cung hang moi nhat. Khong ghi de.');
  const ref='  const hexaTabMenuRef = useRef(null);\n';
  assert(src.includes(ref),'Khong thay hexaTabMenuRef; ma nguon co the da doi.');
  src=src.replace(ref,'');
  const oldEffect=`  useEffect(() => {
    if (!hexaTabMenuOpen) return;
    const onPointer = event => {if (!hexaTabMenuRef.current?.contains(event.target)) hexaSetTabMenuOpen(false);};
    const onKey = event => {if (event.key === 'Escape') hexaSetTabMenuOpen(false);};
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {document.removeEventListener('pointerdown', onPointer); document.removeEventListener('keydown', onKey);};
  }, [hexaTabMenuOpen]);
`;
  assert(src.includes(oldEffect),'Khong thay hook dong bang Tuy chon; source da thay doi.');
  src=src.replace(oldEffect,'');
  const start=src.indexOf('        <div className="am-more-wrapper" ref={hexaExtraMenuRef}>');
  const next=src.indexOf('      </div>\n    </div>\n    {error&&',start);
  assert(start>-1 && next>start && next-start<6000,'Khong thay thanh cong cu Thùng rác va Them mong doi.');
  const oldBlock=src.slice(start,next);
  assert(oldBlock.includes('am-tab-settings-trigger') && oldBlock.includes('am-more-trigger') && oldBlock.includes('am-trash-shortcut'),'Toolbar khong dung mau giao dien gan nhat.');
  const replacement=`        {/* ${JS_MARK}: keep all secondary modules and visibility controls in one menu. */}
        <div className="am-more-wrapper" ref={hexaExtraMenuRef}>
          <button type="button" className={'am-more-trigger'+(hexaExtraModes.some(([id])=>id===mode)?' active':'')} aria-expanded={hexaExtraMenuOpen} aria-controls="hexa-extra-tab-list" onClick={()=>{hexaSetExtraMenuOpen(open=>!open);hexaSetTabMenuOpen(false);}}><LayoutGrid size={15}/> Thêm <ChevronRight className="am-more-caret" size={13}/></button>
          {hexaExtraMenuOpen&&<div className="am-extra-dropdown am-more-unified" id="hexa-extra-tab-list" role="group" aria-label="Điều hướng và tùy chỉnh mục phụ">
            <div className="am-more-section-title">Công cụ khác</div>
            {hexaExtraModes.length?hexaExtraModes.map(([id,label,Icon])=><button type="button" key={id} className={mode===id?'active':''} onClick={()=>hexaSelectMode(id)}><Icon size={15}/>{label}</button>):<p>Chưa có mục phụ đang bật.</p>}
            <div className="am-more-divider"/>
            <button type="button" className="am-more-customize-trigger" aria-expanded={hexaTabMenuOpen} aria-controls="hexa-more-visibility" onClick={()=>hexaSetTabMenuOpen(open=>!open)}><LayoutGrid size={15}/> Hiện / ẩn mục <ChevronRight size={13} className={'am-more-customize-caret'+(hexaTabMenuOpen?' expanded':'')}/></button>
            {hexaTabMenuOpen&&<div className="am-more-visibility" id="hexa-more-visibility" role="group" aria-label="Chọn các công cụ trong menu Thêm">
              {hexaOptionalModes.map(([id,label,Icon])=><label key={id} className="am-more-visibility-item"><input type="checkbox" checked={!hexaHiddenTabs.includes(id)} onChange={()=>hexaToggleTab(id)}/><Icon size={15}/><span>{label}</span></label>)}
              <button type="button" className="am-more-show-all" onClick={()=>hexaSetHiddenTabs([])}>Hiện tất cả</button>
            </div>}
          </div>}
        </div>
        <button type="button" title="Thùng rác" aria-label="Thùng rác" className={'am-trash-shortcut'+(mode==='trash'?' active':'')} onClick={()=>hexaSelectMode('trash')}><Trash2 size={17}/></button>
`;
  src=src.slice(0,start)+replacement+src.slice(next);
  assert(!src.includes('am-tab-settings-trigger'),'Nut Tuy chon van ton tai.');
  assert(!src.includes('hexaTabMenuRef'),'Con tham chieu ref da xoa.');
  // The code was wrapping awkwardly; keep it readable and show full text on hover.
  const codeToken='<button className="am-link strong" onClick={()=>setDetail(item)}>{item.assetCode}</button>';
  assert(src.includes(codeToken),'Khong tim thay nut ma tai san de them title.');
  src=src.replace(codeToken,'<button className="am-link strong" title={item.assetCode} onClick={()=>setDetail(item)}>{item.assetCode}</button>');
  return {text:useCRLF?src.replace(/\n/g,'\r\n'):src,changed:true};
}
const addCss=String.raw`
/* HEXA_ONE_MORE_MENU_TABLE_CSS_20261119_V1 - merged menu + readable table */
/* Menu is one popover, with a collapsed visibility section. */
.am-root .am-tabs-with-stats .am-tab-menu-actions{gap:5px!important}
.am-root .am-extra-dropdown.am-more-unified{width:258px;min-width:238px;max-width:min(290px,calc(100vw - 28px));padding:7px!important;overflow-y:auto;max-height:min(65dvh,450px)}
.am-root .am-more-section-title{font-size:10px;letter-spacing:.035em;font-weight:800;color:#60887e;padding:6px 9px 4px}
.am-root .am-more-divider{height:1px;background:#e4efeb;margin:7px 4px}
.am-root .am-more-unified .am-more-customize-trigger{width:100%;display:flex;align-items:center;gap:8px;font-weight:750;text-align:left}
.am-root .am-more-unified .am-more-customize-caret{margin-left:auto;transform:rotate(90deg);transition:transform .15s}
.am-root .am-more-unified .am-more-customize-caret.expanded{transform:rotate(-90deg)}
.am-root .am-more-visibility{display:grid;gap:3px;border:1px solid #e3f0ec;border-radius:8px;padding:7px;background:#f7fcfa;margin-top:5px}
.am-root .am-more-visibility-item{display:flex;align-items:center;gap:9px;padding:6px 8px;min-height:31px;border-radius:6px;font-size:11px;font-weight:600;color:#35675e;cursor:pointer}
.am-root .am-more-visibility-item:hover{background:#e7f6f1}
.am-root .am-more-visibility-item input{width:15px;height:15px;min-width:15px;accent-color:#076b5d;margin:0}
.am-root .am-more-unified .am-more-show-all{font-size:10px;font-weight:800;justify-content:center;border:1px solid #d8ece6;background:#fff;margin-top:3px;min-height:30px}
/* Restore legibility while preserving a high row count. */
.am-root .am-asset-list-card .am-assets-table{width:100%!important;min-width:795px!important;table-layout:fixed!important}
.am-root .am-asset-list-card .am-assets-table th:nth-child(1){width:13%!important}
.am-root .am-asset-list-card .am-assets-table th:nth-child(2){width:21%!important}
.am-root .am-asset-list-card .am-assets-table th:nth-child(3){width:10%!important}
.am-root .am-asset-list-card .am-assets-table th:nth-child(4){width:12%!important}
.am-root .am-asset-list-card .am-assets-table th:nth-child(5){width:13%!important}
.am-root .am-asset-list-card .am-assets-table th:nth-child(6){width:11%!important}
.am-root .am-asset-list-card .am-assets-table th:nth-child(7){width:20%!important}
.am-root .am-asset-list-card .am-assets-table th{padding:9px 6px!important;font-size:10.5px!important;line-height:1.25!important;color:#5a7e76!important}
.am-root .am-asset-list-card .am-assets-table td{padding:7px 6px!important;font-size:12.75px!important;line-height:1.4!important;color:#355f58!important;vertical-align:middle}
.am-root .am-asset-list-card .am-assets-table td b{font-size:12.75px!important;line-height:1.35!important;color:#184f47!important}
.am-root .am-asset-list-card .am-assets-table td small{font-size:10.75px!important;line-height:1.3!important;margin-top:3px!important;color:#648a80!important}
.am-root .am-asset-list-card .am-assets-table td:first-child .am-link{display:block;max-width:100%;margin:0;font-size:11.75px!important;line-height:1.35!important;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left}
.am-root .am-asset-list-card .am-assets-table .am-status{font-size:10px!important;line-height:1.25!important;padding:5px 6px!important;max-width:100%;white-space:normal}
.am-root .am-asset-list-card .am-assets-table .am-row-actions{display:flex;flex-direction:row;flex-wrap:nowrap;align-items:center;gap:3px;max-width:100%;min-width:0}
.am-root .am-asset-list-card .am-assets-table .am-row-actions button{box-sizing:border-box;flex:0 0 26px!important;width:26px!important;height:27px!important;padding:4px!important}
.am-root .am-asset-list-card .am-assets-table tbody tr:nth-child(even){background:#f7fbfa}
.am-root .am-asset-list-card .am-assets-table tbody tr:hover{background:#eaf7f2!important}
.am-root .am-assets-table button:focus-visible,.am-root .am-more-trigger:focus-visible,.am-root .am-more-unified button:focus-visible,.am-root .am-more-visibility-item:focus-within{outline:2px solid #0b806f;outline-offset:2px}
/* Keep search and table headers in place while scrolling within the list. */
.am-root .am-asset-list-card > .am-table-wrap{min-height:0;overflow:auto;overscroll-behavior:contain;scrollbar-gutter:stable}
.am-root .am-asset-list-card .am-assets-table thead th{position:sticky;top:0;z-index:2}
html[data-hexa-theme="dark"] .am-root .am-more-section-title{color:#a9cfc1}
html[data-hexa-theme="dark"] .am-root .am-more-divider{background:#3f6256}
html[data-hexa-theme="dark"] .am-root .am-more-visibility{background:#1c332b;border-color:#416458}
html[data-hexa-theme="dark"] .am-root .am-more-visibility-item{color:#d0e7db}
html[data-hexa-theme="dark"] .am-root .am-more-visibility-item:hover{background:#305449}
html[data-hexa-theme="dark"] .am-root .am-more-unified .am-more-show-all{background:#29483d;border-color:#476c60;color:#e0f4eb}
html[data-hexa-theme="dark"] .am-root .am-asset-list-card .am-assets-table tbody tr:nth-child(even){background:#1b322b}
html[data-hexa-theme="dark"] .am-root .am-asset-list-card .am-assets-table tbody tr:hover{background:#29473c!important}
html[data-hexa-theme="dark"] .am-root .am-asset-list-card .am-assets-table td{color:#bcdad0!important}
html[data-hexa-theme="dark"] .am-root .am-asset-list-card .am-assets-table td b{color:#e1f2ea!important}
html[data-hexa-theme="dark"] .am-root .am-asset-list-card .am-assets-table td small{color:#a0c6b8!important}
html[data-hexa-theme="dark"] .am-root .am-asset-list-card .am-assets-table th{color:#b0d5c7!important}
@media(max-width:850px){
 .am-root .am-asset-list-card .am-assets-table{min-width:795px!important}
 .am-root .am-extra-dropdown.am-more-unified{right:0}
}
`;
function patchCss(original){
  if(original.includes(CSS_MARK))return {text:original,changed:false};
  assert(original.includes('HEXA_INLINE_STATS_DENSE_TABLE_20261119_V2'), 'Chua thay CSS Thong ke cung hang.');
  return {text:original.trimEnd()+'\n\n'+addCss+'\n',changed:true};
}
function main(){
  assert(fs.existsSync(jsPath)&&fs.existsSync(cssPath),'Phai chay tai thu muc goc HEXA chua frontend/src/AssetManagement.jsx.');
  const changes=[{path:jsPath,...patchJsx(fs.readFileSync(jsPath,'utf8'))},{path:cssPath,...patchCss(fs.readFileSync(cssPath,'utf8'))}];
  changes.forEach(x=>console.log((x.changed?'[UPDATE] ':'[OK]     ')+path.relative(root,x.path)));
  if(!changes.some(x=>x.changed)){console.log('[OK] Ban cap nhat nay da duoc ap dung.');return;}
  if(check){console.log('[CHECK OK] Khong ghi file.');return;}
  const backup=fs.mkdtempSync(path.join(os.tmpdir(),'HEXA_MORE_MENU_BACKUP_'));
  const done=[];
  try{
    for(const x of changes.filter(x=>x.changed)){
      const relative=path.relative(root,x.path),dest=path.join(backup,relative);
      fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(x.path,dest);
      const temp=x.path+'.hexa-new';fs.writeFileSync(temp,x.text,'utf8');fs.renameSync(temp,x.path);
      done.push({dest,path:x.path});
    }
  }catch(error){for(const x of done.reverse())fs.copyFileSync(x.dest,x.path);throw error;}
  console.log('[OK] Cap nhat xong. Sao luu:',backup);
  console.log('Kiem tra tiep: cd frontend; npm run build; npm run dev');
}
try{main();}catch(error){console.error('[STOP] '+error.message);process.exitCode=1;}
