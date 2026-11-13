"use strict";
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const project = __dirname;
const base = path.join(project, "frontend", "src");
const marker = "/* HEXA_EXPAND_TABLE_HEIGHT_V1 */";
const required = [
  {
    name: "asset-management.css",
    signatures: [".am-root .am-card:has(> .am-filter-bar)", ".am-warehouse .am-card.am-warehouse-device-list"],
    block: `
${marker}
/* Tăng độ cao vùng bảng, không thay đổi chiều rộng cột hoặc hành vi tìm kiếm. */
@media (min-width: 701px) {
  .am-root .am-card:has(> .am-filter-bar) {
    height: clamp(560px, calc(100dvh - 205px), 900px);
    max-height: 900px;
  }
  .am-warehouse .am-card.am-warehouse-device-list .am-table-wrap,
  .am-warehouse .am-card.am-warehouse-stock-list .am-table-wrap {
    max-height: min(62dvh, 640px);
  }
}
@media (max-width: 700px) {
  .am-root .am-card:has(> .am-filter-bar) {
    height: clamp(470px, 75dvh, 800px);
    max-height: 800px;
  }
  .am-warehouse .am-card.am-warehouse-device-list .am-table-wrap,
  .am-warehouse .am-card.am-warehouse-stock-list .am-table-wrap {
    max-height: min(65dvh, 610px);
  }
}
`},
  {
    name: "printer-management.css",
    signatures: [".pm-tab-viewport", ".pm-tab-panel > .am-card"],
    block: `
${marker}
/* Cho xem thêm dòng máy in/mực; thanh tìm kiếm nằm ngoài vùng cuộn. */
@media (min-width: 701px) {
  .pm-tab-viewport { height: clamp(620px, calc(100dvh - 245px), 830px); }
}
@media (max-width: 700px) {
  .pm-tab-viewport { height: clamp(470px, calc(100dvh - 250px), 730px); }
}
`}
];
function stop(message) {console.error("[ERROR] " + message);process.exit(1);}
if (!fs.existsSync(path.join(project, "frontend", "package.json")) || !fs.existsSync(path.join(project, "backend", "package.json")))
  stop("Dat BAT va CJS trong thu muc HEXA co frontend/ va backend/.");
const edits=[];
for (const item of required){
  const file=path.join(base,item.name);
  if (!fs.existsSync(file))stop(`Khong tim thay ${file}. Chua sua file nao.`);
  const before=fs.readFileSync(file,"utf8");
  if (before.includes(marker)) {console.log("[SKIP] Da tang chieu cao: " + item.name); continue;}
  const absent=item.signatures.filter(s=>!before.includes(s));
  if(absent.length)stop(`CSS ${item.name} khac phien ban tuong thich (thieu ${absent.join(", ")}). Chua sua file nao.`);
  edits.push({file,name:item.name,before,after:before.replace(/\s*$/, "")+"\n\n"+item.block.trim()+"\n"});
}
if (!edits.length){console.log("[OK] Ban va da duoc cai tu truoc, khong can thay doi.");process.exit(0);}
const stamp=new Date().toISOString().replace(/[:.]/g,"-");
const backup=path.join(os.homedir(),"HEXA_TABLE_HEIGHT_BACKUPS",stamp);
fs.mkdirSync(backup,{recursive:true});
for (const e of edits) fs.writeFileSync(path.join(backup,e.name), e.before, "utf8");
try {
  for(const e of edits){fs.writeFileSync(e.file,e.after,"utf8");console.log("[UPDATED] "+e.name);}
}catch(err){for(const e of edits){fs.writeFileSync(e.file,e.before,"utf8");}stop(err.message+"; da hoan tac CSS goc.");}
console.log("[OK] Tang chieu cao bang Tai san, Kho va May in.");
console.log("[BACKUP] "+backup);
console.log("[NEXT] Ctrl+Shift+R de kiem tra tren trinh duyet.");
