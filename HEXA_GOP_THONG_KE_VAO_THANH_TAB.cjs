#!/usr/bin/env node
'use strict';
// HEXA – 19/11/2026: One-row stats/navigation + denser asset table.
// Run after HEXA_TINH_GON_GIAO_DIEN.cjs. No backend/Firebase mutation.
const fs = require('fs');
const path = require('path');
const os = require('os');
const ROOT=process.cwd();
const JS=path.join(ROOT,'frontend','src','AssetManagement.jsx');
const CSS=path.join(ROOT,'frontend','src','asset-management.css');
const MARK='HEXA_INLINE_ASSET_STATS_20261119_V2';
const CSSMARK='HEXA_INLINE_STATS_DENSE_TABLE_20261119_V2';
const isCheck=process.argv.includes('--check');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};
function patchJSX(text){
  if(text.includes(MARK))return {content:text,changed:false};
  assert(text.includes('HEXA_ASSET_DENSE_NAV_20261119_V1'),'Chua co giao dien gon lan truoc. Hay ap dung HEXA_TINH_GON_GIAO_DIEN.cjs truoc.');
  assert(text.includes('    <div className="am-tabs-toolbar">'), 'Khong tim thay am-tabs-toolbar mong doi.');
  assert(text.includes('  const [warehouseRefreshEpoch') || text.includes('warehouseRefreshEpoch,setWarehouseRefreshEpoch'),'Khong tim thay epoch dong bo kho.');
  let s=text;
  const statsLine=/^    <div className="am-stats">.*\r?\n/m;
  assert(statsLine.test(s),'Khong tim thay hang thong ke rieng, can kiem tra thay doi frontend.');
  s=s.replace(statsLine,'');
  const epochToken='  const isManager=user.role===\'manager\';';
  assert(s.includes(epochToken),'Khong tim thay state AssetManagement.');
  s=s.replace(epochToken,`  /* ${MARK}: number of inventory SKUs, not sum of mixed units. */\n  const [hexaWarehouseSkuCount, hexaSetWarehouseSkuCount] = useState(null);\n  const hexaRefreshWarehouseCount = useCallback(async () => {\n    try {\n      const result = await api('/warehouse');\n      const count = Number.isFinite(result?.total) ? result.total : Array.isArray(result?.items) ? result.items.length : null;\n      hexaSetWarehouseSkuCount(count);\n    } catch { hexaSetWarehouseSkuCount(null); }\n  }, []);\n  useEffect(() => { hexaRefreshWarehouseCount(); }, [hexaRefreshWarehouseCount,mode,warehouseRefreshEpoch]);\n${epochToken}`);
  // The general Refresh button refreshes inventory metric as well.
  const refreshToken='await Promise.all([load(),reloadCatalogs()]);';
  assert(s.includes(refreshToken),'Khong tim thay xu ly Lam moi.');
  s=s.replace(refreshToken,'await Promise.all([load(),reloadCatalogs(),hexaRefreshWarehouseCount()]);');
  const target='    <div className="am-tabs-toolbar">';
  s=s.replace(target,'    <div className="am-tabs-toolbar am-tabs-with-stats">');
  const actions='      <div className="am-tab-menu-actions">';
  assert(s.includes(actions),'Khong tim thay nhom nut menu.');
  const statMarkup=`      <div className="am-inline-stats" aria-label="Thống kê tài sản và kho">\n        <div className="am-inline-stat" title="Tổng số tài sản" aria-label={\`Tổng tài sản: \${stats.total}\`}><Boxes size={13}/><span>Tổng TS</span><strong>{stats.total}</strong></div>\n        <div className="am-inline-stat" title="Số tài sản đang có sẵn" aria-label={\`Có sẵn: \${stats.available}\`}><CheckCircle2 size={13}/><span>Có sẵn</span><strong>{stats.available}</strong></div>\n        <div className="am-inline-stat" title="Số mã vật tư đang quản lý trong kho (không cộng các đơn vị khác nhau)" aria-label={\`Tổng kho: \${hexaWarehouseSkuCount ?? 'chưa tải'}\`}><PackageSearch size={13}/><span>Tổng kho</span><strong>{hexaWarehouseSkuCount ?? '—'}</strong></div>\n      </div>\n`;
  s=s.replace(actions,statMarkup+actions);
  return {content:s,changed:true};
}
const cssText=String.raw`
/* HEXA_INLINE_STATS_DENSE_TABLE_20261119_V2 — frontend only */
.am-root .am-tabs-toolbar.am-tabs-with-stats{display:flex!important;align-items:center!important;flex-wrap:nowrap!important;gap:6px!important;height:40px!important;min-height:40px!important;margin:0 0 6px!important;overflow:visible!important}
.am-root .am-tabs-with-stats .am-main-tabs{flex:1 1 auto!important;min-width:0!important;width:0!important;max-width:100%!important;overflow-x:auto!important;scrollbar-width:none!important}
.am-root .am-inline-stats{display:flex;gap:4px;align-items:center;flex:0 0 auto;min-width:0}
.am-root .am-inline-stat{box-sizing:border-box;display:flex;align-items:center;justify-content:center;gap:4px;min-height:31px;height:31px;padding:2px 6px;border:1px solid #dceee9;background:#f4faf8;color:#4b7e74;border-radius:8px;white-space:nowrap;font-size:10px;line-height:1;font-weight:650;font-variant-numeric:tabular-nums}
.am-root .am-inline-stat svg{flex-shrink:0;color:#16776b}
.am-root .am-inline-stat strong{font-size:12px;color:#075b50;font-weight:850;line-height:1.1}
.am-root .am-tabs-with-stats .am-tab-menu-actions{flex:0 0 auto!important;gap:4px!important}
/* Use the viewport height freed by removing the entire statistics row. */
.am-root .am-tab-stage{height:clamp(520px,calc(100dvh - 145px),1300px)!important;min-height:0!important;max-height:none!important}
.am-root .am-card.am-asset-list-card{height:100%!important;max-height:none!important;min-height:0!important}
.am-root .am-asset-list-card .am-assets-table td{padding:5px 7px!important;font-size:11.5px!important;line-height:1.25!important}
.am-root .am-asset-list-card .am-assets-table td small{margin-top:2px!important;font-size:9.5px!important;line-height:1.3!important}
.am-root .am-asset-list-card .am-assets-table td b{font-size:11.5px!important;line-height:1.27!important}
.am-root .am-asset-list-card .am-assets-table .am-link{font-size:10px!important;line-height:1.2!important}
.am-root .am-asset-list-card .am-assets-table th{padding:7px 7px!important;font-size:9px!important}
.am-root .am-asset-list-card .am-assets-table .am-status{font-size:9px!important;padding:4px 5px!important}
.am-root .am-asset-list-card .am-assets-table .am-row-actions button{width:24px!important;height:24px!important;padding:4px!important}
.am-root .am-asset-list-card .am-assets-toolbar{padding:6px 8px!important}
.am-root .am-asset-list-card .am-pagination{padding:8px 11px!important}
html[data-hexa-theme="dark"] .am-root .am-inline-stat{background:#203b33!important;border-color:#45685b!important;color:#c3ded3!important}
html[data-hexa-theme="dark"] .am-root .am-inline-stat strong{color:#c9f3e3!important}
html[data-hexa-theme="dark"] .am-root .am-inline-stat svg{color:#7bd5b9!important}
@media(max-width:1120px){
 .am-root .am-inline-stat{gap:3px;padding:2px 5px;min-width:37px}
 .am-root .am-inline-stat span{display:none}
 .am-root .am-inline-stat strong{font-size:11px}
 .am-root .am-tabs-with-stats .am-main-tabs button{padding:5px 6px!important;font-size:10px!important}
 .am-root .am-tabs-with-stats .am-tab-settings-trigger{padding:4px 7px!important}
}
@media(max-width:740px){
 .am-root .am-tabs-toolbar.am-tabs-with-stats{height:auto!important;min-height:0!important;flex-wrap:wrap!important;row-gap:5px!important}
 .am-root .am-tabs-with-stats .am-main-tabs{order:0;flex:1 1 calc(100% - 200px)!important;width:auto!important;min-height:37px}
 .am-root .am-inline-stats{order:2;flex:1 1 100%;justify-content:flex-start}
 .am-root .am-inline-stat{flex:1 1 0;min-width:0}
 .am-root .am-inline-stat span{display:inline}
 .am-root .am-tabs-with-stats .am-tab-menu-actions{order:1}
 .am-root .am-tab-stage{height:clamp(480px,calc(100dvh - 190px),1100px)!important}
}
`;
function main(){
  assert(fs.existsSync(JS)&&fs.existsSync(CSS),'Chay trong thu muc goc HEXA, cung cap voi frontend va backend.');
  const j=patchJSX(fs.readFileSync(JS,'utf8'));
  const oldCss=fs.readFileSync(CSS,'utf8');
  assert(oldCss.includes('HEXA_ASSET_DENSE_CSS_20261119_V1'), 'Chua co CSS giao dien gon tu lan cap nhat truoc.');
  const c=oldCss.includes(CSSMARK)?{content:oldCss,changed:false}:{content:oldCss.trimEnd()+'\n\n'+cssText+'\n',changed:true};
  const changes=[{file:JS,...j},{file:CSS,...c}];
  for(const x of changes)console.log((x.changed?'[UPDATE] ':'[OK]     ')+path.relative(ROOT,x.file));
  if(!changes.some(x=>x.changed)){console.log('[OK] Da cai truoc do; khong thay doi gi.');return;}
  if(isCheck){console.log('[CHECK OK] Chua sua file.');return;}
  const backup=fs.mkdtempSync(path.join(os.tmpdir(),'HEXA_INLINE_STATS_BACKUP_'));
  const done=[];
  try {
    for(const x of changes.filter(x=>x.changed)) {
      const dest=path.join(backup,path.relative(ROOT,x.file));
      fs.mkdirSync(path.dirname(dest),{recursive:true});
      fs.copyFileSync(x.file,dest);
      fs.writeFileSync(x.file+'.hexa-tmp',x.content,'utf8');
      fs.renameSync(x.file+'.hexa-tmp',x.file);
      done.push({file:x.file,dest});
    }
  }catch(e){for(const x of done.reverse())fs.copyFileSync(x.dest,x.file);throw e;}
  console.log('[OK] Da cap nhat. Ban sao luu:',backup);
  console.log('Kiem tra: cd frontend ; npm run build ; npm run dev');
}
try{main()}catch(e){console.error('[STOP] '+e.message);process.exitCode=1;}
