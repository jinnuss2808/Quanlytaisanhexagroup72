'use strict';
/*
 * HEXA - rearrange asset, warehouse and printer action toolbars.
 * Run from the project root containing frontend/ and backend/.
 * Only edits React/CSS source; never calls APIs or touches Firebase data.
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const root = __dirname;
const marker = 'HEXA_INLINE_TOOLBARS_20261113_V3';
const dryRun = process.argv.includes('--dry-run');
const targets = {
  asset: 'frontend/src/AssetManagement.jsx',
  warehouse: 'frontend/src/WarehouseManagement.jsx',
  printer: 'frontend/src/PrinterManagement.jsx',
  assetCss: 'frontend/src/asset-management.css',
  printerCss: 'frontend/src/printer-management.css',
};
const fail = (message) => { throw new Error(message); };
function replaceOnce(s, before, after, label) {
  const i = s.indexOf(before);
  if (i === -1) fail('Không tìm thấy đoạn mã '+label+'. Chưa thay đổi file nào. Có thể phiên bản HEXA khác mã nguồn được hỗ trợ.');
  if (s.indexOf(before, i + before.length) !== -1) fail('Tìm thấy đoạn mã '+label+' nhiều lần; dừng để tránh sửa nhầm.');
  return s.slice(0, i) + after + s.slice(i + before.length);
}
function patchAsset(s) {
  if (s.includes('am-assets-toolbar') && s.includes('am-assets-table')) return s;
  // The old title and top-right buttons take a whole row. The buttons now live inside filter row.
  const start = '    <div className="am-split am-section-head">';
  const end = '\n    <div className="am-stats">';
  const a = s.indexOf(start), b = s.indexOf(end, a + start.length);
  if (a < 0 || b < 0 || b-a > 1600) fail('Không xác định được thanh tiêu đề trang Tài sản.');
  const originalHeader = s.slice(a, b);
  if (!originalHeader.includes('Thêm tài sản') || !originalHeader.includes('am-head-actions')) fail('Thanh tiêu đề Tài sản khác phiên bản dự kiến.');
  s = s.slice(0, a) + s.slice(b + 1);  // Keep .am-stats line.
  s = replaceOnce(s, '(mode===\'assets\'||mode===\'trash\')&&<div className="am-card">',
     '(mode===\'assets\'||mode===\'trash\')&&<div className="am-card am-asset-list-card">', 'asset card');
  s = replaceOnce(s, '<div className="am-filter-bar"><div className="am-search"><Search size={17}/>',
     '<div className="am-filter-bar am-assets-toolbar"><div className="am-search"><Search size={17}/>', 'asset filters');
  s = replaceOnce(s, '        <button className="am-btn am-light" onClick={xlsx}><Download size={15}/> Xuất Excel</button>\n      </div>',
     '        <button className="am-btn am-light" onClick={xlsx}><Download size={15}/> Xuất Excel</button>\n        <div className="am-toolbar-actions">\n          <button type="button" className="am-btn am-light" onClick={refresh} disabled={loading}><RefreshCw size={15}/> Làm mới</button>\n          {mode===\'assets\'&&<button type="button" className="am-btn am-primary" onClick={()=>setEditing(null)}><Plus size={15}/> Thêm tài sản</button>}\n        </div>\n      </div>', 'asset filter actions');
  s = replaceOnce(s, '<div className="am-table-wrap"><table className="am-table"><thead><tr><th>Mã tài sản</th>',
     '<div className="am-table-wrap"><table className="am-table am-assets-table"><thead><tr><th>Mã tài sản</th>', 'asset table');
  s = replaceOnce(s, '<td><b>{item.assetName}</b><small>{item.categoryName||\'Chưa phân loại\'}</small></td>',
     '<td><b title={item.assetName}>{item.assetName}</b><small>{item.categoryName||\'Chưa phân loại\'}</small></td>', 'asset name cell');
  return s;
}
function patchWarehouse(s) {
  if (s.includes('am-warehouse-toolbar') && s.includes('am-stock-table')) return s;
  const headingStart = ' {!embedded&&<div className="am-split am-heading">';
  const headingEnd = '\n <div className="am-warehouse-summary">';
  const a = s.indexOf(headingStart), b = s.indexOf(headingEnd, a + headingStart.length);
  if (a < 0 || b < 0 || b-a > 1300) fail('Không xác định được thanh nút riêng ở Kho thiết bị.');
  if(!s.slice(a,b).includes('setEditor(null)') || !s.slice(a,b).includes('reload')) fail('Nút thao tác kho không đúng mẫu.');
  s = s.slice(0,a)+s.slice(b+1);
  s = replaceOnce(s, '<div className="am-filter-bar am-warehouse-filter"><div className="am-search">',
     '<div className="am-filter-bar am-warehouse-filter am-warehouse-toolbar"><div className="am-search">', 'warehouse filters');
  const before = ' {!onlyInk&&<select value={category} onChange={e=>setCategory(e.target.value)}><option value="all">Tất cả nhóm</option>{Object.entries(CATEGORIES).filter(([k])=>kind===\'warehouse\'?k!==\'ink\':true).map(([k,v])=><option value={k} key={k}>{v}</option>)}</select>}\n </div>';
  const after = ' {!onlyInk&&<select value={category} onChange={e=>setCategory(e.target.value)}><option value="all">Tất cả nhóm</option>{Object.entries(CATEGORIES).filter(([k])=>kind===\'warehouse\'?k!==\'ink\':true).map(([k,v])=><option value={k} key={k}>{v}</option>)}</select>}\n {!embedded&&<div className="am-toolbar-actions">\n   <button type="button" className="am-btn am-light" onClick={reload} disabled={loading}><RefreshCw size={15}/> Làm mới</button>\n   <button type="button" className="am-btn am-primary" onClick={()=>setEditor(null)}><Plus size={15}/>{onlyInk?\'Thêm mực\':\'Thêm hàng\'}</button>\n </div>}\n </div>';
  s = replaceOnce(s, before, after, 'warehouse actions in filter bar');
  s = replaceOnce(s, '<div className="am-table-wrap"><table className="am-table"><thead><tr><th>Mã</th><th>Tài sản</th>',
     '<div className="am-table-wrap"><table className="am-table am-warehouse-devices-table"><thead><tr><th>Mã</th><th>Tài sản</th>', 'warehouse devices table');
  s = replaceOnce(s, '<div className="am-table-wrap"><table className="am-table"><thead><tr><th>Mã kho</th><th>Tên hàng</th>',
     '<div className="am-table-wrap"><table className="am-table am-stock-table"><thead><tr><th>Mã kho</th><th>Tên hàng</th>', 'stock table');
  s = replaceOnce(s, '<td><b>{item.assetName}</b></td><td>{item.categoryName||\'—\'}</td>',
     '<td><b title={item.assetName}>{item.assetName}</b></td><td>{item.categoryName||\'—\'}</td>', 'warehouse asset name');
  s = replaceOnce(s, '<td>{item.name}</td><td>{CATEGORIES[item.category]||item.category}</td>',
     '<td title={item.name}>{item.name}</td><td>{CATEGORIES[item.category]||item.category}</td>', 'warehouse stock name');
  return s;
}
function patchPrinter(s) {
  if (s.includes('pm-printers-table')) return s;
  s = replaceOnce(s, '<div className="am-table-wrap"><table className="am-table"><thead><tr><th>Mã máy in</th>',
     '<div className="am-table-wrap"><table className="am-table pm-printers-table"><thead><tr><th>Mã máy in</th>', 'printer table');
  s = replaceOnce(s, '<td>{p.assetName}<small>{p.serialNumber||\'\'}</small></td>',
     '<td title={p.assetName}>{p.assetName}<small>{p.serialNumber||\'\'}</small></td>', 'printer name');
  return s;
}
const assetCSS = `
/* ${marker} : horizontal single-line action toolbars and balanced column widths.
   Geometry only: dark/light theme colors remain controlled by existing styles. */
.am-root .am-assets-toolbar,
.am-root .am-warehouse .am-warehouse-toolbar {
  display:flex; flex-direction:row; flex-wrap:nowrap !important; align-items:center;
  gap:7px; padding:10px 12px; width:100%; min-width:0;
  overflow-x:auto; overflow-y:hidden; scrollbar-width:thin;
}
.am-root .am-assets-toolbar > .am-search,
.am-root .am-warehouse .am-warehouse-toolbar > .am-search {
  flex:1 1 190px; width:auto; min-width:170px; max-width:none; margin:0;
}
.am-root .am-assets-toolbar > select { flex:0 0 auto; width:108px; max-width:108px; min-width:0; }
.am-root .am-assets-toolbar > select:nth-of-type(2) { width:93px; max-width:93px; }
.am-root .am-assets-toolbar > select:nth-of-type(3) { width:110px; max-width:110px; }
.am-root .am-warehouse .am-warehouse-toolbar > select { flex:0 0 auto; width:128px; max-width:128px; min-width:0; }
.am-root .am-toolbar-actions { display:flex; align-items:center; justify-content:flex-end; gap:7px; flex:0 0 auto; flex-wrap:nowrap; margin-left:auto; }
.am-root .am-toolbar-actions .am-btn,
.am-root .am-assets-toolbar > .am-btn { flex:0 0 auto; flex-shrink:0; white-space:nowrap; min-height:36px; padding:7px 10px; font-size:11px; }
.am-root .am-toolbar-actions .am-btn svg { flex-shrink:0; }
.am-root .am-asset-list-card > .am-table-wrap { overflow-x:auto; max-width:100%; }
.am-root .am-assets-table { table-layout:fixed; width:100%; min-width:940px; }
.am-root .am-assets-table th:nth-child(1) { width:15%; }
.am-root .am-assets-table th:nth-child(2) { width:18%; }
.am-root .am-assets-table th:nth-child(3) { width:12%; }
.am-root .am-assets-table th:nth-child(4) { width:12%; }
.am-root .am-assets-table th:nth-child(5) { width:12%; }
.am-root .am-assets-table th:nth-child(6) { width:11%; }
.am-root .am-assets-table th:nth-child(7) { width:20%; }
.am-root .am-assets-table th,
.am-root .am-assets-table td { padding-left:10px; padding-right:10px; }
.am-root .am-assets-table td { white-space:normal; overflow-wrap:anywhere; }
.am-root .am-assets-table td:nth-child(2) b {
  display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2;
  line-clamp:2; overflow:hidden; max-width:100%; overflow-wrap:anywhere; white-space:normal;
}
.am-root .am-assets-table td:nth-child(7) { white-space:nowrap; overflow:visible; }
.am-root .am-assets-table .am-row-actions {
  display:flex; flex-direction:row; flex-wrap:nowrap !important; align-items:center;
  width:max-content; min-width:max-content; gap:5px; white-space:nowrap;
}
.am-root .am-assets-table .am-row-actions button { flex:0 0 29px; width:29px; height:29px; padding:5px; }
.am-root .am-warehouse .am-table-wrap { width:100%; max-width:100%; overflow-x:auto; }
.am-root .am-warehouse .am-warehouse-devices-table { table-layout:fixed; min-width:780px; width:100%; }
.am-root .am-warehouse .am-warehouse-devices-table th:nth-child(1) { width:17%; }
.am-root .am-warehouse .am-warehouse-devices-table th:nth-child(2) { width:32%; }
.am-root .am-warehouse .am-warehouse-devices-table th:nth-child(3) { width:15%; }
.am-root .am-warehouse .am-warehouse-devices-table th:nth-child(4) { width:15%; }
.am-root .am-warehouse .am-warehouse-devices-table th:nth-child(5) { width:21%; }
.am-root .am-warehouse .am-stock-table { table-layout:fixed; min-width:840px; width:100%; }
.am-root .am-warehouse .am-stock-table th:nth-child(1) { width:14%; }
.am-root .am-warehouse .am-stock-table th:nth-child(2) { width:23%; }
.am-root .am-warehouse .am-stock-table th:nth-child(3) { width:12%; }
.am-root .am-warehouse .am-stock-table th:nth-child(4) { width:12%; }
.am-root .am-warehouse .am-stock-table th:nth-child(5) { width:17%; }
.am-root .am-warehouse .am-stock-table th:nth-child(6) { width:22%; }
.am-root .am-warehouse :is(.am-stock-table,.am-warehouse-devices-table) th,
.am-root .am-warehouse :is(.am-stock-table,.am-warehouse-devices-table) td { padding-left:10px; padding-right:10px; }
.am-root .am-warehouse :is(.am-stock-table,.am-warehouse-devices-table) td { overflow-wrap:anywhere; white-space:normal; }
.am-root .am-warehouse .am-stock-table td:nth-child(2),
.am-root .am-warehouse .am-warehouse-devices-table td:nth-child(2) { max-width:0; overflow-wrap:anywhere; }
.am-root .am-warehouse .am-warehouse-actions { display:flex; align-items:center; flex-direction:row; flex-wrap:nowrap !important; white-space:nowrap; width:max-content; gap:5px; }
.am-root .am-warehouse .am-warehouse-actions > button { flex:0 0 auto; white-space:nowrap; }
@media (max-width:700px) {
  .am-root .am-assets-toolbar,
  .am-root .am-warehouse .am-warehouse-toolbar { flex-direction:row !important; align-items:center; }
  .am-root .am-assets-toolbar > .am-search,
  .am-root .am-warehouse .am-warehouse-toolbar > .am-search { flex:0 0 200px; min-width:200px; }
}
`;
const printerCSS = `
/* ${marker}: printer row actions occupy one line on both themes. */
.pm-root .pm-tab-panel .pm-printers-table { width:100%; min-width:925px; table-layout:fixed; }
.pm-root .pm-tab-panel .pm-printers-table th:nth-child(1) { width:17%; }
.pm-root .pm-tab-panel .pm-printers-table th:nth-child(2) { width:15%; }
.pm-root .pm-tab-panel .pm-printers-table th:nth-child(3) { width:17%; }
.pm-root .pm-tab-panel .pm-printers-table th:nth-child(4) { width:17%; }
.pm-root .pm-tab-panel .pm-printers-table th:nth-child(5) { width:10%; }
.pm-root .pm-tab-panel .pm-printers-table th:nth-child(6) { width:24%; }
.pm-root .pm-tab-panel .pm-printers-table th,
.pm-root .pm-tab-panel .pm-printers-table td { padding-left:9px; padding-right:9px; }
.pm-root .pm-tab-panel .pm-printers-table td { white-space:normal; overflow-wrap:anywhere; }
.pm-root .pm-tab-panel .pm-printers-table td:nth-child(2) { max-width:0; }
.pm-root .pm-tab-panel .pm-printers-table td:nth-child(6) { overflow:visible; white-space:nowrap; }
.pm-root .pm-tab-panel .pm-printers-table .pm-row-actions {
  display:flex; flex-direction:row !important; flex-wrap:nowrap !important;
  align-items:center; width:max-content; min-width:max-content; gap:5px; white-space:nowrap;
}
.pm-root .pm-tab-panel .pm-printers-table .pm-row-actions > button.am-btn {
  flex:0 0 auto; width:auto; max-width:none; white-space:nowrap;
  min-height:32px; padding:6px 8px; font-size:11px;
}
.pm-root .pm-tab-panel .pm-printers-table .pm-row-actions svg { flex-shrink:0; }
`;
try {
  if (!fs.existsSync(path.join(root,'frontend/package.json')) || !fs.existsSync(path.join(root,'backend'))) {
    fail('Đặt file CJS và BAT trong thư mục gốc HEXA, cùng cấp frontend/ và backend/.');
  }
  const previous = {};
  for (const [key, relative] of Object.entries(targets)) {
    const p = path.join(root,relative);
    if(!fs.existsSync(p)) fail('Không tìm thấy file: '+relative);
    previous[key] = fs.readFileSync(p,'utf8');
  }
  const next = {...previous};
  next.asset = patchAsset(next.asset);
  next.warehouse = patchWarehouse(next.warehouse);
  next.printer = patchPrinter(next.printer);
  if (!next.assetCss.includes(marker)) next.assetCss += assetCSS;
  if (!next.printerCss.includes(marker)) next.printerCss += printerCSS;
  const changed = Object.keys(targets).filter(k=>previous[k]!==next[k]);
  if(!changed.length) { console.log('[OK] Bản vá đã được áp dụng từ trước. Không sửa lại.'); process.exit(0); }
  if(dryRun) {console.log('[DRY RUN] Các file dự kiến thay đổi:'); changed.forEach(k=>console.log('  '+targets[k])); process.exit(0);}
  const stamp = new Date().toISOString().replace(/[:.]/g,'-');
  const backup = path.join(os.homedir(),'HEXA_SOURCE_BACKUPS','ui-toolbar-'+stamp);
  // Backups outside repository to prevent secrets/source copies being pushed with git.
  for(const k of changed){const p=path.join(backup,targets[k]);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,previous[k],'utf8');}
  const done=[];
  try {
    for(const k of changed){fs.writeFileSync(path.join(root,targets[k]),next[k],'utf8');done.push(k);}
  } catch(err){for(const k of done){fs.writeFileSync(path.join(root,targets[k]),previous[k],'utf8');}throw err;}
  console.log('[OK] Đã đặt Làm mới / Thêm tài sản cùng hàng tìm kiếm, lọc và Xuất Excel.');
  console.log('[OK] Đã đặt Làm mới / Thêm hàng cùng hàng tìm kiếm Kho thiết bị.');
  console.log('[OK] Đã giảm cột tên, giữ nút bảng tài sản/máy in/kho cùng hàng.');
  console.log('[OK] Giữ nguyên logic API, Firebase, dữ liệu, quyền và giao diện sáng/tối.');
  console.log('[BACKUP] '+backup);
  for(const k of changed)console.log('  UPDATED '+targets[k]);
  console.log('[NEXT] cd frontend && npm run build ; sau đó push Git và redeploy Vercel frontend.');
} catch (err) {console.error('[FAILED] '+err.message); process.exitCode=1;}
