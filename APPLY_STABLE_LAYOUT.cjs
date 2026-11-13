'use strict';
/**
 * HEXA: stable inventory layout, no dependencies and no Firebase writes.
 * Changes only frontend/src/AssetManagement.jsx and frontend/src/asset-management.css.
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const root = path.resolve(__dirname);
const src = path.join(root, 'frontend', 'src');
const jsxPath = path.join(src, 'AssetManagement.jsx');
const cssPath = path.join(src, 'asset-management.css');
const marker = '/* HEXA_STABLE_INVENTORY_LAYOUT_V1 */';
const begin = "    {(mode==='assets'||mode==='trash')&&<div className=\"am-card\">";
const end = '    {editing!==undefined&&<AssetForm';
const stage = 'className="am-tab-stage"';

const css = String.raw`
${marker}
/* Giữ bề rộng nội dung cố định dù chiều cao từng tab khác nhau. */
html { scrollbar-gutter: stable; }
.am-root {
  width: 100%;
  max-width: 100%;
  min-width: 0;
}
.am-root .am-section-head {
  min-height: 66px;
  align-items: center;
}
.am-root .am-head-actions {
  min-height: 40px;
}
.am-root .am-stats {
  width: 100%;
  min-width: 0;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  align-items: stretch;
  gap: 12px;
  margin: 18px 0;
}
.am-root .am-stat {
  width: 100%;
  min-width: 0;
  height: 126px;
  min-height: 126px;
  max-height: 126px;
  overflow: hidden;
  padding: 14px 16px;
}
.am-root .am-stat-icon {
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  margin-bottom: 7px;
}
.am-root .am-stat strong {
  font-variant-numeric: tabular-nums;
  line-height: 1.15;
  margin-top: 4px;
}
/* Thanh tab cao như nhau, không xuống dòng khi đổi phân hệ. */
.am-root .am-main-tabs {
  display: flex;
  width: 100%;
  max-width: 100%;
  height: 45px;
  min-height: 45px;
  flex-wrap: nowrap;
  align-items: center;
  overflow-x: auto;
  overflow-y: hidden;
  white-space: nowrap;
  scrollbar-width: none;
  margin-bottom: 14px;
}
.am-root .am-main-tabs::-webkit-scrollbar { display: none; }
.am-root .am-main-tabs button {
  display: inline-flex;
  flex: 0 0 auto;
  height: 36px;
  min-height: 36px;
  white-space: nowrap;
  transition: background-color 150ms ease, color 150ms ease, box-shadow 150ms ease;
}
/* Vùng nội dung giữ nguyên kích thước; chỉ cuộn bên trong. */
.am-root .am-tab-stage {
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  height: clamp(530px, calc(100dvh - 355px), 780px);
  min-height: 530px;
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-gutter: stable;
  overscroll-behavior: contain;
  position: relative;
}
.am-root .am-tab-stage > * {
  min-width: 0;
  max-width: 100%;
  animation: hexa-inventory-tab-enter 140ms ease-out both;
}
@keyframes hexa-inventory-tab-enter {
  from { opacity: .5; }
  to   { opacity: 1; }
}
/* Các tab kho và máy in dùng cùng lưới tiêu đề/nút thao tác. */
.am-root .am-tab-stage .pm-root,
.am-root .am-tab-stage .am-warehouse { width: 100%; min-width: 0; max-width: 100%; }
.am-root .am-tab-stage .pm-heading,
.am-root .am-tab-stage .am-warehouse > .am-split.am-heading {
  box-sizing: border-box;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-width: 0;
  height: 76px;
  min-height: 76px;
  max-height: 76px;
  margin: 0 0 11px;
}
.am-root .am-tab-stage .pm-heading-actions,
.am-root .am-tab-stage .am-warehouse > .am-split.am-heading .am-head-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  min-width: 0;
  flex-wrap: nowrap;
}
.am-root .am-tab-stage .pm-heading-actions .am-btn,
.am-root .am-tab-stage .am-warehouse > .am-split.am-heading .am-head-actions .am-btn {
  box-sizing: border-box;
  height: 38px;
  min-height: 38px;
  flex-shrink: 0;
}
.am-root .am-tab-stage .pm-heading-actions .am-btn.am-primary,
.am-root .am-tab-stage .am-warehouse > .am-split.am-heading .am-head-actions .am-btn.am-primary { width: 146px; }
.am-root .am-tab-stage .pm-heading-actions .am-btn.am-light,
.am-root .am-tab-stage .am-warehouse > .am-split.am-heading .am-head-actions .am-btn.am-light { width: 106px; }
.am-root .am-tab-stage .pm-tabs { min-height: 52px; }
.am-root .am-tab-stage .pm-tab-viewport {
  height: clamp(350px, calc(100dvh - 500px), 650px);
  min-height: 350px;
}
.am-root .am-tab-stage .am-warehouse-summary { min-height: 46px; align-items: center; }
.am-root .am-tab-stage .am-card { box-sizing: border-box; width: 100%; min-width: 0; }
.am-root .am-tab-stage .am-table-wrap { max-width: 100%; }
@media (max-width: 1050px) {
  .am-root .am-stats { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 650px) {
  .am-root .am-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .am-root .am-stat { height: 116px; min-height: 116px; max-height: 116px; padding: 12px; }
  .am-root .am-tab-stage { height: max(430px, calc(100dvh - 275px)); min-height: 430px; }
  .am-root .am-tab-stage .pm-heading,
  .am-root .am-tab-stage .am-warehouse > .am-split.am-heading {
    height: 113px; min-height: 113px; max-height: 113px;
    grid-template-columns: minmax(0, 1fr);
    gap: 7px;
    align-content: center;
  }
  .am-root .am-tab-stage .pm-heading-actions,
  .am-root .am-tab-stage .am-warehouse > .am-split.am-heading .am-head-actions { justify-content: flex-start; }
}
@media (prefers-reduced-motion: reduce) {
  .am-root .am-tab-stage > * { animation: none; }
  .am-root .am-main-tabs button { transition: none; }
}
`;

function quit(message) { console.error('[FAILED] ' + message); process.exit(1); }
function normalized(s) { return s.replace(/\r\n/g, '\n'); }
if (!fs.existsSync(jsxPath) || !fs.existsSync(cssPath)) quit('Cần đặt BAT + CJS ở thư mục gốc HEXA (cùng cấp frontend, backend).');
const originalJsx = fs.readFileSync(jsxPath, 'utf8');
const originalCss = fs.readFileSync(cssPath, 'utf8');
let jsx = normalized(originalJsx);
const alreadyStage = jsx.includes(stage);
if (!alreadyStage) {
  const i = jsx.indexOf(begin);
  const j = jsx.indexOf(end);
  if (i < 0 || j < 0 || j <= i || jsx.indexOf(begin, i+begin.length) !== -1 || jsx.indexOf(end,j+end.length) !== -1) {
    quit('Cấu trúc AssetManagement.jsx đã khác phiên bản hỗ trợ. Không thay file; cần kiểm tra mã nguồn thực tế.');
  }
  jsx = jsx.slice(0, i) + '    <div className="am-tab-stage" key={mode} aria-label="Nội dung Quản lý tài sản">\n' + jsx.slice(i,j) + '    </div>\n' + jsx.slice(j);
}
const cssText = normalized(originalCss);
const hasCss = cssText.includes(marker);
if (alreadyStage && hasCss) { console.log('[OK] Bố cục đã được cập nhật, không cần sửa thêm.'); process.exit(0); }
if (alreadyStage && !hasCss) console.log('[INFO] Vùng tab đã có, chỉ bổ sung CSS còn thiếu.');
if (!alreadyStage && hasCss) console.log('[INFO] CSS đã có, chỉ bổ sung vùng tab còn thiếu.');
const changed = [];
if (!alreadyStage) changed.push([jsxPath, originalJsx, jsx.replace(/\n/g, originalJsx.includes('\r\n')?'\r\n':'\n')]);
if (!hasCss) changed.push([cssPath, originalCss, originalCss.replace(/\s*$/, '') + '\n\n' + css.trimStart() + '\n']);
const stamp = new Date().toISOString().replace(/[:.]/g,'-');
const out = path.join(process.env.LOCALAPPDATA || os.tmpdir(), 'HEXA-Layout-Backups', stamp + '-' + crypto.randomBytes(3).toString('hex'));
fs.mkdirSync(out,{recursive:true});
for (const [file,old] of changed) fs.writeFileSync(path.join(out,path.basename(file)),old,'utf8');
try {
  for (const [file,,next] of changed) fs.writeFileSync(file,next,'utf8');
} catch (error) {
  for (const [file,old] of changed) {
    try { fs.writeFileSync(file,old,'utf8'); } catch {}
  }
  quit('Không ghi được file, đã thử khôi phục backup: ' + error.message);
}
console.log('[OK] Đã cập nhật ' + changed.map(x=>path.relative(root,x[0])).join(', '));
console.log('[BACKUP] ' + out);
console.log('[SAFE] Không thay Firebase, API, .env, dữ liệu hoặc khóa riêng.');
