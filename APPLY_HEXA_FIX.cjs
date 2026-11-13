'use strict';
// Update only targeted code regions. Keep all unrelated local enhancements.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const project = __dirname;
const src = path.join(project,'frontend','src');
const payload = path.join(project,'payload','frontend');
const TAG='HEXA_FILTER_MODAL_REFRESH_FIX_V1';
const fail = msg => { console.error('[ERROR] '+msg); process.exit(1); };
const files = ['WarehouseManagement.jsx','PrinterManagement.jsx','asset-management.css','printer-management.css','api.js'];
for(const f of files){if(!fs.existsSync(path.join(src,f))) fail('Khong tim thay frontend/src/'+f);}
if(!fs.existsSync(path.join(project,'backend','package.json'))) fail('Hay copy BAT, CJS va payload vao thu muc goc HEXA.');
if(!fs.existsSync(path.join(payload,'src','warehouse-category-utils.js')))fail('Thieu payload/frontend/src/warehouse-category-utils.js');

function once(s, old, repl, description){
  if (typeof old==='string'){
    if(!s.includes(old))throw Error('Khong nhan dien duoc: '+description);
    return s.replace(old,repl);
  }
  if(!old.test(s)) throw Error('Khong nhan dien duoc: '+description);
  return s.replace(old,repl);
}
const original={};const changed={};
for(const f of files)original[f]=fs.readFileSync(path.join(src,f),'utf8');
try{
  let w=original['WarehouseManagement.jsx'];
  if(!w.includes(TAG)){
    w=once(w,"from 'react';","from 'react';\nimport {useRef} from 'react';\nimport {createPortal} from 'react-dom';\nimport {loadAvailableAssets} from './warehouse-category-utils.js';",'Warehouse imports');
    if(!w.includes('function Dialog('))throw Error('Khong tim thay Dialog trong WarehouseManagement.jsx');
    w=once(w,/function Dialog\(\{title,onClose,children\}\)\{return <div className="am-overlay"([\s\S]*?)<\/div><\/div>\}/,
      (_,rest)=>`function Dialog({title,onClose,children}){return createPortal(<div className="am-overlay am-warehouse-dialog-overlay"${rest}</div></div>,document.body)}`,
      'Warehouse Dialog portal');
    const sortedVariant=w.includes('const [stockSort,setStockSort]');
    // Catalog lookup is necessary because stored assets use category IDs, not the stock category codes.
    w=once(w,
      " const [devicePage,setDevicePage]=useState(1),[devicePages,setDevicePages]=useState(1),[deviceTotal,setDeviceTotal]=useState(0),[debouncedSearch,setDebouncedSearch]=useState('');",
      " const [devicePage,setDevicePage]=useState(1),[devicePages,setDevicePages]=useState(1),[deviceTotal,setDeviceTotal]=useState(0),[debouncedSearch,setDebouncedSearch]=useState('');\n const [assetCatalogs,setAssetCatalogs]=useState([]),reloadSeq=useRef(0);",
      'Warehouse catalog state');
    const reloadExpr=/ const reload=useCallback\(async\(\)=>\{setLoading\(true\);try\{[\s\S]*?\}catch\(err\)\{setError\(err.message\)\}finally\{setLoading\(false\)\}\},\[[^\]]*\]\);/;
    const assetOptions=sortedVariant?",sortBy:deviceSort||'',sortDirection:'asc'":'';
    const deps=sortedVariant?'[kind,devicePage,debouncedSearch,category,assetCatalogs,deviceSort]':'[kind,devicePage,debouncedSearch,category,assetCatalogs]';
    const reloadReplacement=` const reload=useCallback(async()=>{const seq=++reloadSeq.current;setLoading(true);try{\n  const [list,assets]=await Promise.all([api('/warehouse'),kind==='warehouse'\n    ?loadAvailableAssets(api,{category,catalogs:assetCatalogs,page:devicePage,search:debouncedSearch${assetOptions}})\n    :Promise.resolve({items:[],total:0,totalPages:1})]);\n  if(seq!==reloadSeq.current)return false;\n  setStock({...list,items:Array.isArray(list?.items)?list.items:[]});\n  setDevices(Array.isArray(assets?.items)?assets.items:[]);setDevicePages(assets?.totalPages||1);setDeviceTotal(assets?.total||0);setError('');\n  return true;\n }catch(err){if(seq===reloadSeq.current)setError(err.message);return false;}finally{if(seq===reloadSeq.current)setLoading(false)}},${deps});`;
    w=once(w,reloadExpr,reloadReplacement,'Warehouse reload query');
    w=once(w," useEffect(()=>{const t=setTimeout(()=>{setDebouncedSearch(term);setDevicePage(1);},300);return()=>clearTimeout(t);},[term]);",
      " useEffect(()=>{const t=setTimeout(()=>{setDebouncedSearch(term);setDevicePage(1);},300);return()=>clearTimeout(t);},[term]);\n useEffect(()=>{if(kind!=='warehouse')return;let live=true;api('/assets/catalogs').then(result=>{if(live)setAssetCatalogs(Array.isArray(result?.categories)?result.categories:[])}).catch(err=>{if(live)setError(err.message)});return()=>{live=false}},[kind]);",
      'Warehouse catalogs load');
    w=once(w,'onChange={e=>setCategory(e.target.value)}','onChange={e=>{setCategory(e.target.value);setDevicePage(1)}}','Warehouse filter selection');
    // Keep notice separate from error state; visible even when data did not visually change.
    w=once(w," const saved=()=>{setEditor(undefined);setTransaction(null);reload()};",
      " const [refreshNotice,setRefreshNotice]=useState('');\n const manualRefresh=async()=>{setRefreshNotice('Đang tải dữ liệu mới...');const ok=await reload();setRefreshNotice(ok?'Đã làm mới dữ liệu kho.':'Không thể làm mới. Vui lòng kiểm tra kết nối API.')};\n const saved=()=>{setEditor(undefined);setTransaction(null);reload()};",
      'Warehouse manual refresh message');
    w=once(w,'onClick={reload}><RefreshCw size={15}/>Làm mới','onClick={manualRefresh} disabled={loading}><RefreshCw size={15}/>Làm mới','Warehouse refresh click');
    w=once(w,' {error&&<p className="am-error">{error}</p>}\n {kind===\'warehouse\'&&',
      ' {refreshNotice&&<p className="am-success" role="status">{refreshNotice}</p>}\n {error&&<p className="am-error">{error}</p>}\n {kind===\'warehouse\'&&',
      'Warehouse notice UI');
    // Stable column widths and isolated scrollable table regions.
    w=once(w,'{kind===\'warehouse\'&&<div className="am-card" style={{marginBottom:17}}>','{kind===\'warehouse\'&&<div className="am-card am-warehouse-device-list" style={{marginBottom:17}}>','Warehouse device panel');
    w=once(w,' <div className="am-card"><div className="am-padded"><h3>{onlyInk?',
      ' <div className="am-card am-warehouse-stock-list"><div className="am-padded"><h3>{onlyInk?',
      'Warehouse materials panel');
    w='// '+TAG+'\n'+w;
  }
  changed['WarehouseManagement.jsx']=w;

  let p=original['PrinterManagement.jsx'];
  if(!p.includes(TAG)){
    p=once(p,' }catch(e){setError(e.message)}finally{setLoading(false)}},[]);',
      '    return true;\n  }catch(e){setError(e.message);return false;}finally{setLoading(false)}},[]);',
      'Printer refresh success flag');
    p=once(p,'useEffect(()=>{refresh();},[refresh,refreshEpoch,refreshId]);',
      'useEffect(()=>{refresh();},[refresh,refreshEpoch]);',
      'Printer avoid duplicated refresh calls');
    p=once(p,'onClick={()=>setRefreshId(x=>x+1)}',
      "onClick={async()=>{setNotice('Đang làm mới dữ liệu...');const ok=await refresh();setRefreshId(x=>x+1);setNotice(ok?'Đã làm mới danh sách máy in và kho mực.':'Không thể làm mới danh sách máy in.')}} disabled={loading}",
      'Printer refresh button');
    p=once(p,'<div className="am-table-wrap"><table className="am-table"><thead>',
      '<div className="am-table-wrap"><table className="am-table pm-printer-table"><thead>',
      'Printer table class');
    p='// '+TAG+'\n'+p;
  }
  changed['PrinterManagement.jsx']=p;

  let api=original['api.js'];
  if(!api.includes(TAG)){
    api=once(api,'{ method, headers, body: body === undefined ? undefined : JSON.stringify(body) }',
      "{ method, headers, cache: method === 'GET' ? 'no-store' : 'default', body: body === undefined ? undefined : JSON.stringify(body) }",
      'API no-store refresh requests');
    api='// '+TAG+'\n'+api;
  }
  changed['api.js']=api;

  const assetCss=`/* ${TAG} — stable table viewport, stable input row and column proportions */
/* Only the table body scrolls; search/filter actions remain visible above it. */
.am-root .am-card:has(> .am-filter-bar){display:flex;flex-direction:column;min-width:0;height:clamp(460px,calc(100dvh - 305px),780px);max-height:780px;overflow:hidden}
.am-root .am-card:has(> .am-filter-bar) > .am-filter-bar{flex:0 0 auto;position:relative;z-index:2;background:var(--hexa-surface,#fff)}
.am-root .am-card:has(> .am-filter-bar) > .am-table-wrap{flex:1 1 auto;min-height:0;overflow:auto;overscroll-behavior:contain;scrollbar-gutter:stable}
.am-root .am-card:has(> .am-filter-bar) > .am-pagination{flex:0 0 auto;background:var(--hexa-surface,#fff);border-top:1px solid #e6efec}
.am-root .am-card:has(> .am-filter-bar) .am-table{table-layout:fixed;min-width:930px}
.am-root .am-card:has(> .am-filter-bar) .am-table th:nth-child(1){width:13%}
.am-root .am-card:has(> .am-filter-bar) .am-table th:nth-child(2){width:29%}
.am-root .am-card:has(> .am-filter-bar) .am-table th:nth-child(3){width:12%}
.am-root .am-card:has(> .am-filter-bar) .am-table th:nth-child(4){width:14%}
.am-root .am-card:has(> .am-filter-bar) .am-table th:nth-child(5){width:13%}
.am-root .am-card:has(> .am-filter-bar) .am-table th:nth-child(6){width:9%}
.am-root .am-card:has(> .am-filter-bar) .am-table th:nth-child(7){width:10%}
.am-root .am-card:has(> .am-filter-bar) .am-table td{white-space:normal;overflow-wrap:anywhere;line-height:1.5}
.am-root .am-card:has(> .am-filter-bar) .am-table th{position:sticky;top:0;z-index:1}
.am-warehouse-filter{position:sticky;top:0;z-index:8;background:var(--hexa-surface,#fff)!important;box-shadow:0 3px 8px rgba(0,50,44,.04)}
.am-warehouse .am-card.am-warehouse-device-list,.am-warehouse .am-card.am-warehouse-stock-list{min-width:0;max-width:100%;overflow:hidden;display:flex;flex-direction:column}
.am-warehouse .am-card.am-warehouse-device-list .am-table-wrap,.am-warehouse .am-card.am-warehouse-stock-list .am-table-wrap{max-height:min(48dvh,510px);overflow:auto;min-height:0;scrollbar-gutter:stable}
.am-warehouse .am-card.am-warehouse-device-list .am-table,.am-warehouse .am-card.am-warehouse-stock-list .am-table{table-layout:fixed;min-width:735px;width:100%}
.am-warehouse .am-card.am-warehouse-device-list .am-table th:nth-child(1){width:15%}
.am-warehouse .am-card.am-warehouse-device-list .am-table th:nth-child(2){width:38%}
.am-warehouse .am-card.am-warehouse-device-list .am-table th:nth-child(3){width:14%}
.am-warehouse .am-card.am-warehouse-device-list .am-table th:nth-child(4){width:13%}
.am-warehouse .am-card.am-warehouse-device-list .am-table th:nth-child(5){width:20%}
.am-warehouse .am-card.am-warehouse-stock-list .am-table th:nth-child(1){width:14%}
.am-warehouse .am-card.am-warehouse-stock-list .am-table th:nth-child(2){width:25%}
.am-warehouse .am-card.am-warehouse-stock-list .am-table th:nth-child(3){width:11%}
.am-warehouse .am-card.am-warehouse-stock-list .am-table th:nth-child(4){width:12%}
.am-warehouse .am-card.am-warehouse-stock-list .am-table th:nth-child(5){width:16%}
.am-warehouse .am-card.am-warehouse-stock-list .am-table th:nth-child(6){width:22%}
.am-warehouse .am-card.am-warehouse-device-list .am-table th,.am-warehouse .am-card.am-warehouse-stock-list .am-table th{position:sticky;top:0;z-index:2}
.am-warehouse .am-card.am-warehouse-device-list .am-table td,.am-warehouse .am-card.am-warehouse-stock-list .am-table td{white-space:normal;overflow-wrap:anywhere;line-height:1.45}
.am-warehouse .am-warehouse-actions{flex-wrap:nowrap;gap:4px}
.am-warehouse .am-warehouse-actions .am-btn{padding:5px 7px;white-space:nowrap}
.am-warehouse .am-warehouse-actions .am-icon-btn{flex-shrink:0}
.am-overlay.am-warehouse-dialog-overlay{position:fixed!important;inset:0!important;display:flex!important;align-items:center;justify-content:center;z-index:2147483100!important;background:rgba(10,34,30,.57)!important;padding:16px;isolation:isolate}
.am-overlay.am-warehouse-dialog-overlay>.am-modal{background:#fff!important;color:#24453f!important;opacity:1!important;position:relative;z-index:1;width:min(680px,calc(100vw - 32px));max-width:100%;max-height:calc(100dvh - 32px);overflow:auto;box-shadow:0 28px 75px rgba(0,24,18,.29)!important}
.am-overlay.am-warehouse-dialog-overlay .am-modal-header,.am-overlay.am-warehouse-dialog-overlay .am-form,.am-overlay.am-warehouse-dialog-overlay .am-detail-body{background:#fff!important}
html[data-hexa-theme="dark"] .am-overlay.am-warehouse-dialog-overlay>.am-modal,html[data-hexa-theme="dark"] .am-overlay.am-warehouse-dialog-overlay .am-modal-header,html[data-hexa-theme="dark"] .am-overlay.am-warehouse-dialog-overlay .am-form,html[data-hexa-theme="dark"] .am-overlay.am-warehouse-dialog-overlay .am-detail-body{background:#1b2f2a!important;color:#e1eee9!important}
html[data-hexa-theme="dark"] .am-overlay.am-warehouse-dialog-overlay input,html[data-hexa-theme="dark"] .am-overlay.am-warehouse-dialog-overlay select,html[data-hexa-theme="dark"] .am-overlay.am-warehouse-dialog-overlay textarea{background:#243b34!important;color:#e1eee9!important;border-color:#456057!important}
@media(max-width:700px){.am-root .am-card:has(> .am-filter-bar){height:clamp(420px,65dvh,730px)}.am-warehouse .am-card .am-table{min-width:700px}.am-warehouse-filter{top:0}}
`;
  const printerCss=`/* ${TAG} — fixed printer table columns and searchable header */
.pm-tab-panel > .am-card{height:100%;max-height:100%;min-height:0;display:flex;flex-direction:column;overflow:hidden}
.pm-tab-panel > .am-card > .pm-search{flex:0 0 auto;background:var(--hexa-surface,#fff);position:relative;z-index:2}
.pm-tab-panel > .am-card > .am-table-wrap{flex:1 1 auto;min-height:0;max-height:none;overflow:auto;scrollbar-gutter:stable}
.pm-printer-table{table-layout:fixed;min-width:820px;width:100%}
.pm-printer-table th:nth-child(1){width:14%}
.pm-printer-table th:nth-child(2){width:22%}
.pm-printer-table th:nth-child(3){width:17%}
.pm-printer-table th:nth-child(4){width:17%}
.pm-printer-table th:nth-child(5){width:12%}
.pm-printer-table th:nth-child(6){width:18%}
.pm-printer-table th{position:sticky;top:0;z-index:2}
.pm-printer-table td{white-space:normal;overflow-wrap:anywhere;line-height:1.45}
.pm-printer-table .pm-row-actions{flex-wrap:wrap;gap:5px}
`;
  for(const [filename,block] of [['asset-management.css',assetCss],['printer-management.css',printerCss]]){
    const old=original[filename];
    changed[filename]=old.includes(TAG)?old:old.replace(/\s*$/,'')+'\n\n'+block+'\n';
  }
}catch(err){fail(err.message+'; da dung, khong file nao bi sua.');}

const helperTarget=path.join(src,'warehouse-category-utils.js');
const helperContent=fs.readFileSync(path.join(payload,'src','warehouse-category-utils.js'));
const savedHelper=fs.existsSync(helperTarget)?fs.readFileSync(helperTarget):null;
if(savedHelper && !savedHelper.equals(helperContent))fail('warehouse-category-utils.js da co noi dung khac; dung de tranh ghi de.');
const testTarget=path.join(project,'frontend','test','warehouse-filter.test.mjs');
if(fs.existsSync(testTarget) && fs.readFileSync(testTarget,'utf8') !== fs.readFileSync(path.join(payload,'test','warehouse-filter.test.mjs'),'utf8')) fail('Test kho da co thay doi rieng. Khong ghi de.');

const hasEdits=Object.keys(changed).some(f=>changed[f]!==original[f])||!savedHelper||!fs.existsSync(testTarget);
if(!hasEdits){console.log('[OK] Da ap dung ban sua nay truoc do, khong can cap nhat lai.');process.exit(0);}
const folder=path.join(os.homedir(),'HEXA_CODE_BACKUPS',path.basename(project),'warehouse_ui_'+new Date().toISOString().replace(/[:.]/g,'-'));
try{
 fs.mkdirSync(folder,{recursive:true});
 for(const f of files)if(changed[f]!==original[f])fs.writeFileSync(path.join(folder,f),original[f],'utf8');
 const updated=[];
 try{
  for(const f of files)if(changed[f]!==original[f]){fs.writeFileSync(path.join(src,f),changed[f]);updated.push(f);}
  if(!savedHelper){fs.writeFileSync(helperTarget,helperContent);updated.push('warehouse-category-utils.js');}
  if(!fs.existsSync(testTarget)){fs.mkdirSync(path.dirname(testTarget),{recursive:true});fs.copyFileSync(path.join(payload,'test','warehouse-filter.test.mjs'),testTarget);updated.push('warehouse-filter.test.mjs');}
 }catch(err){
  for(const f of updated){const target=f==='warehouse-filter.test.mjs'?testTarget:path.join(src,f);if(original[f]!==undefined)fs.writeFileSync(target,original[f]);else fs.rmSync(target,{force:true});}
  throw err;
 }
 console.log('[OK] Da sua:',updated.join(', '));
 console.log('[BACKUP]',folder);
}catch(err){fail('Khong ghi duoc code; da thu khoi phuc: '+err.message);}
console.log('[NEXT] cd frontend && node --test test/warehouse-filter.test.mjs');
console.log('[NEXT] git add frontend/src frontend/test/warehouse-filter.test.mjs');
