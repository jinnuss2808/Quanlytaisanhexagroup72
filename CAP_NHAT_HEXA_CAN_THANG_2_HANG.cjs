#!/usr/bin/env node
'use strict';
/**
 * HEXA: align summary/navigation toolbar with asset filter row.
 * Apply after the 19/11/2026 merged Thêm menu update.
 * Edits frontend/src/asset-management.css only. No credentials or Firebase writes.
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const ROOT = path.resolve(process.argv.find((x,i) => i>1 && !x.startsWith('--')) || process.cwd());
const FILE = path.join(ROOT,'frontend','src','asset-management.css');
const JSX = path.join(ROOT,'frontend','src','AssetManagement.jsx');
const check = process.argv.includes('--check');
const MARK = 'HEXA_SHARED_GRID_ASSET_TOOLBARS_20261119_V1';
const block = String.raw`
/* HEXA_SHARED_GRID_ASSET_TOOLBARS_20261119_V1
   Equal tracks for the navigation/summary row and the asset filter row.
   Columns: tabs/search | total/company | available/type | warehouse/status |
            blank/export | blank/refresh | More+trash/Add asset.
   Uses container query so a narrow sidebar layout can gracefully wrap.
*/
.am-root{
  --hexa-tools-gap:6px;
  --hexa-tools-columns:minmax(355px,3.55fr) minmax(92px,1fr) minmax(86px,.94fr) minmax(102px,1.10fr) minmax(90px,1fr) minmax(83px,.90fr) minmax(116px,1.22fr);
  container:hexa-toolbar / inline-size;
}
/* Upper toolbar is offset by 9px to match the asset card border (1px) + inner padding (8px). */
.am-root .am-tabs-toolbar.am-tabs-with-stats{
  display:grid!important;
  grid-template-columns:var(--hexa-tools-columns)!important;
  align-items:center!important;
  column-gap:var(--hexa-tools-gap)!important;
  padding:0 9px!important;
  height:42px!important;
  min-height:42px!important;
  width:100%!important;
  box-sizing:border-box!important;
  overflow:visible!important;
}
.am-root .am-tabs-with-stats .am-main-tabs{
  grid-column:1!important;grid-row:1!important;
  display:flex!important;align-items:center;justify-content:space-between;
  width:100%!important;min-width:0!important;height:34px!important;min-height:34px!important;
  flex:none!important;margin:0!important;padding:2px 3px!important;
  gap:1px!important;overflow:hidden!important;
}
.am-root .am-tabs-with-stats .am-main-tabs button{
  flex:0 1 auto!important;min-width:0;white-space:nowrap;
  font-size:10.5px!important;padding:5px 5px!important;gap:4px!important;
  overflow:hidden;text-overflow:ellipsis;
}
/* display:contents places three statistics directly into columns 2/3/4 */
.am-root .am-tabs-with-stats .am-inline-stats{display:contents!important}
.am-root .am-tabs-with-stats .am-inline-stat{
  box-sizing:border-box;grid-row:1!important;
  width:100%!important;min-width:0!important;max-width:100%!important;
  height:34px!important;min-height:34px!important;
  padding:3px 4px!important;gap:3px!important;
  font-size:10px!important;overflow:hidden;white-space:nowrap!important;
}
.am-root .am-tabs-with-stats .am-inline-stat:nth-child(1){grid-column:2!important}
.am-root .am-tabs-with-stats .am-inline-stat:nth-child(2){grid-column:3!important}
.am-root .am-tabs-with-stats .am-inline-stat:nth-child(3){grid-column:4!important}
.am-root .am-tabs-with-stats .am-inline-stat svg{width:12px;height:12px;flex:0 0 12px}
.am-root .am-tabs-with-stats .am-inline-stat span{display:inline!important;min-width:0;overflow:hidden;text-overflow:ellipsis}
.am-root .am-tabs-with-stats .am-inline-stat strong{font-size:12px!important;flex:none}
.am-root .am-tabs-with-stats .am-tab-menu-actions{
  grid-column:7!important;grid-row:1!important;
  display:flex!important;align-items:center!important;
  justify-content:stretch!important;
  width:100%!important;min-width:0!important;gap:5px!important;
  flex:none!important;
}
.am-root .am-tabs-with-stats .am-tab-menu-actions .am-more-wrapper{
  flex:1 1 auto!important;min-width:0!important;
}
.am-root .am-tabs-with-stats .am-more-trigger{
  width:100%!important;height:34px!important;min-height:34px!important;
  padding:5px 5px!important;font-size:10.5px!important;gap:3px!important;
}
.am-root .am-tabs-with-stats .am-trash-shortcut{
  flex:0 0 34px!important;width:34px!important;
  height:34px!important;min-height:34px!important;
}
/* The second row shares exactly the same grid tracks and inter-column gaps. */
.am-root .am-asset-list-card .am-assets-toolbar{
  box-sizing:border-box!important;
  display:grid!important;grid-template-columns:var(--hexa-tools-columns)!important;
  align-items:center!important;column-gap:var(--hexa-tools-gap)!important;
  width:100%!important;padding:7px 8px!important;min-width:0!important;
}
.am-root .am-asset-list-card .am-assets-toolbar > .am-search{
  grid-column:1!important;grid-row:1!important;
  width:100%!important;min-width:0!important;max-width:none!important;
  height:34px!important;flex:none!important;
}
.am-root .am-asset-list-card .am-assets-toolbar > select{
  grid-row:1!important;width:100%!important;min-width:0!important;
  max-width:none!important;height:34px!important;box-sizing:border-box!important;
  padding:0 5px!important;font-size:10.5px!important;
  overflow:hidden;text-overflow:ellipsis;
}
.am-root .am-asset-list-card .am-assets-toolbar > select:nth-of-type(1){grid-column:2!important}
.am-root .am-asset-list-card .am-assets-toolbar > select:nth-of-type(2){grid-column:3!important}
.am-root .am-asset-list-card .am-assets-toolbar > select:nth-of-type(3){grid-column:4!important}
.am-root .am-asset-list-card .am-assets-toolbar > .am-btn{
  grid-column:5!important;grid-row:1!important;
  width:100%!important;min-width:0!important;
}
/* Flatten the button group only at desktop widths to align Refresh and Add in tracks 6 and 7. */
.am-root .am-asset-list-card .am-assets-toolbar > .am-toolbar-actions{display:contents!important}
.am-root .am-asset-list-card .am-assets-toolbar .am-toolbar-actions > .am-btn:first-child{
  grid-column:6!important;grid-row:1!important;width:100%!important;min-width:0!important;
}
.am-root .am-asset-list-card .am-assets-toolbar .am-toolbar-actions > .am-btn:nth-child(2){
  grid-column:7!important;grid-row:1!important;width:100%!important;min-width:0!important;
}
.am-root .am-asset-list-card .am-assets-toolbar .am-btn{
  box-sizing:border-box!important;height:34px!important;min-height:34px!important;
  font-size:10.5px!important;padding:6px 5px!important;gap:4px!important;
  white-space:nowrap!important;
}
@container hexa-toolbar (max-width:980px){
  .am-root .am-tabs-toolbar.am-tabs-with-stats{
    display:flex!important;flex-wrap:wrap!important;height:auto!important;min-height:40px!important;
    padding:0!important;gap:6px!important;
  }
  .am-root .am-tabs-with-stats .am-main-tabs{
    flex:1 1 330px!important;width:auto!important;max-width:100%!important;
    justify-content:flex-start!important;overflow-x:auto!important;
  }
  .am-root .am-tabs-with-stats .am-inline-stats{
    display:flex!important;order:2!important;flex:1 1 100%!important;
    min-width:0!important;gap:6px!important;
  }
  .am-root .am-tabs-with-stats .am-inline-stat{flex:1 1 0!important;min-width:0!important}
  .am-root .am-tabs-with-stats .am-tab-menu-actions{width:auto!important;flex:0 0 auto!important;order:1!important}
  .am-root .am-tabs-with-stats .am-tab-menu-actions .am-more-wrapper{flex:none!important}
  .am-root .am-tabs-with-stats .am-more-trigger{min-width:82px!important}
  .am-root .am-asset-list-card .am-assets-toolbar{
    display:flex!important;flex-wrap:wrap!important;gap:6px!important;
  }
  .am-root .am-asset-list-card .am-assets-toolbar > .am-search{flex:1 1 100%!important}
  .am-root .am-asset-list-card .am-assets-toolbar > select{flex:1 1 110px!important;width:auto!important}
  .am-root .am-asset-list-card .am-assets-toolbar > .am-btn{flex:0 0 auto!important;width:auto!important}
  .am-root .am-asset-list-card .am-assets-toolbar > .am-toolbar-actions{
    display:flex!important;flex:0 0 auto!important;gap:6px!important;margin-left:auto!important;
  }
  .am-root .am-asset-list-card .am-assets-toolbar .am-toolbar-actions > .am-btn{width:auto!important}
}
@container hexa-toolbar (max-width:600px){
  .am-root .am-tabs-with-stats .am-main-tabs{flex:1 1 100%!important;order:0!important}
  .am-root .am-tabs-with-stats .am-tab-menu-actions{order:1!important;margin-left:auto!important}
  .am-root .am-tabs-with-stats .am-inline-stats{order:2!important}
  .am-root .am-asset-list-card .am-assets-toolbar > select{flex:1 1 calc(33.333% - 6px)!important}
  .am-root .am-asset-list-card .am-assets-toolbar .am-toolbar-actions{flex:1 1 auto!important;justify-content:flex-end}
}
`;
function main(){
  if(!fs.existsSync(FILE)||!fs.existsSync(JSX))throw Error('Khong tim thay frontend/src/AssetManagement.jsx hoac asset-management.css. Chay trong thu muc goc project HEXA.');
  const jsx=fs.readFileSync(JSX,'utf8');
  if(!jsx.includes('am-tabs-toolbar am-tabs-with-stats')||!jsx.includes('am-inline-stats')||!jsx.includes('am-assets-toolbar')||!jsx.includes('am-more-trigger'))throw Error('Cau truc frontend khong khop ban giao dien ngay 19/11. Dung lai, khong ghi de.');
  const old=fs.readFileSync(FILE,'utf8');
  if(!old.includes('HEXA_ONE_MORE_MENU_TABLE_CSS_20261119_V1')||!old.includes('HEXA_INLINE_STATS_DENSE_TABLE_20261119_V2'))throw Error('Chua ap dung 2 ban giao dien tinh gon + Menu Them truoc do; CSS khong khop.');
  if(old.includes(MARK)){console.log('[OK] Bo cuc da duoc can thang, khong ghi de.');return;}
  const text=old.trimEnd()+'\n\n'+block+'\n';
  console.log('[UPDATE] frontend/src/asset-management.css');
  if(check){console.log('[CHECK OK] Khong thay doi file.');return;}
  const backup=path.join(os.tmpdir(),'HEXA_LAYOUT_BACKUP_'+new Date().toISOString().replace(/[:.]/g,'-'));
  fs.mkdirSync(backup,{recursive:true});
  fs.copyFileSync(FILE,path.join(backup,'asset-management.css'));
  const temp=FILE+'.hexa-layout-temp';
  try{fs.writeFileSync(temp,text,'utf8');fs.renameSync(temp,FILE)}catch(error){if(fs.existsSync(temp))fs.unlinkSync(temp);throw error;}
  console.log('[OK] Can luoi 7 cot, cac o thong ke thang bo loc.');
  console.log('[BACKUP]',backup);
  console.log('Tiep theo: cd frontend; npm run build; npm run dev');
}
try{main()}catch(error){console.error('[STOP]',error.message);process.exitCode=1}
