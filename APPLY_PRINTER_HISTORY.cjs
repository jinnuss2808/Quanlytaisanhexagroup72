#!/usr/bin/env node
// Bản vá an toàn: chỉ sửa màn hình máy in và CSS, không đụng dữ liệu Firebase.
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const process=require('node:process');
const root=__dirname;
const src=path.join(root,'frontend','src');
const jsxPath=path.join(src,'PrinterManagement.jsx');
const cssPath=path.join(src,'printer-management.css');
const utilPath=path.join(src,'printer-history-utils.js');
const utilSource=path.join(root,'printer-history-utils.mjs');
const file=(p)=>fs.readFileSync(p,'utf8');
const ensure=(condition,message)=>{if(!condition)throw new Error(message);};
const once=(s,needle,replacement,label)=>{
 const pieces=s.split(needle);
 ensure(pieces.length===2,`Khong tim thay dung mot vi tri ${label}. File JSX khac phien ban. Da dung an toan.`);
 return pieces[0]+replacement+pieces[1];
};
const replaceSection=(whole,begin,end,fn)=>{
 const start=whole.indexOf(begin),stop=whole.indexOf(end,start+begin.length);
 ensure(start>=0 && stop>start,`Khong tim thay section ${begin}. Da dung an toan.`);
 return whole.slice(0,start)+fn(whole.slice(start,stop))+whole.slice(stop);
};
const replaceOnce=(whole,regex,to,message)=>{
 const matches=[...whole.matchAll(new RegExp(regex.source,regex.flags.includes('g')?regex.flags:regex.flags+'g'))];
 ensure(matches.length===1,`Khong khop ${message} (tim thay ${matches.length}). Da dung an toan.`);
 return whole.replace(regex,to);
};

try {
 ensure(fs.existsSync(jsxPath)&&fs.existsSync(cssPath),'Dat BAT + CJS + file .mjs vao thu muc goc HEXA (ngang frontend/backend).');
 ensure(fs.existsSync(utilSource),'Thieu file printer-history-utils.mjs trong bo cap nhat.');
 let jsx=file(jsxPath),css=file(cssPath);
 const already=jsx.includes('getPrinterRepairTotals') && jsx.includes('createPortal(') && css.includes('HEXA_PRINTER_HISTORY_OVERLAY_V2');
 if(already){console.log('[OK] Giao dien may in da duoc cap nhat; khong sua lap.');process.exit(0);}
 ensure(!jsx.includes('getPrinterRepairTotals')&&!css.includes('HEXA_PRINTER_HISTORY_OVERLAY_V2'),'Da phat hien file duoc sua mot phan. Khong tiep tuc de tranh xung dot.');
 ensure(jsx.includes('function PrinterForm(') && jsx.includes('function PrinterDetail(') && jsx.includes('export default function PrinterManagement('),'Khong nhan dien dung component may in.');

 jsx=replaceOnce(jsx,/from 'react';/,"from 'react';\nimport {createPortal} from 'react-dom';",'React import');
 jsx=once(jsx,"import {api} from './api';","import {api} from './api';\nimport {formatPrinterDate,formatPrinterMoney,getPrinterRepairTotals} from './printer-history-utils.js';",'API import');

 // Mọi modal phải được render trên document.body để không nằm dưới stacking context của thanh tabs.
 for(const [begin,end] of [
   ['function PrinterForm(', 'function PrinterDetail('],
   ['function PrinterDetail(', 'export default function PrinterManagement(']
 ]){
   jsx=replaceSection(jsx,begin,end,(part)=>{
     part=replaceOnce(part,/return\s+<div className="pm-overlay"/, 'return createPortal(<div className="pm-overlay"','portal open');
     part=replaceOnce(part,/<\/div>;\s*\n}\s*$/, '</div>, document.body);\n}\n','portal close');
     return part;
   });
 }
 jsx=replaceSection(jsx,'function PrinterDetail(', 'export default function PrinterManagement(',part=>{
   part=once(part,"const [tab,setTab]=useState('history'),[historyKind,setHistoryKind]=useState('all');",
   "const [tab,setTab]=useState('history'),[historyKind,setHistoryKind]=useState('all');\n  const [expandedHistoryId,setExpandedHistoryId]=useState(null);",'state expanded');
   part=once(part,"  const visibleHistory=history.filter(h=>historyKind==='all'||(historyKind==='toner'?h.type==='replace_toner':h.type!=='replace_toner'));",
   "  const visibleHistory=history.filter(h=>historyKind==='all'||(historyKind==='toner'?h.type==='replace_toner':h.type!=='replace_toner'));\n  const repairTotals=getPrinterRepairTotals(history);",'repair total');
   const begin="        {tab==='history'&&";
   const end="        {tab==='toner'&&";
   const at=part.indexOf(begin),to=part.indexOf(end,at);
   ensure(at>=0&&to>at,'Khong thay khung lich su de sua.');
   const replacement=`        {tab==='history'&&<div className="pm-history-view">
          <p className="pm-help">Lịch sử gắn với hồ sơ máy in này. Bấm <b>Xem chi tiết</b> để xem ngày sửa, người sửa, linh kiện, chi phí và kết quả xử lý.</p>
          <div className="pm-history-filters">{[['all',\`Tất cả (\${history.length})\`],['toner',\`Đổ mực (\${tonerCount})\`],['repair',\`Sửa chữa (\${repairCount})\`]].map(([key,label])=><button key={key} type="button" className={historyKind===key?'active':''} onClick={()=>{setHistoryKind(key);setExpandedHistoryId(null);}}>{label}</button>)}</div>
          <div className="pm-history">
            {visibleHistory.map(h=>{
              const isToner=h.type==='replace_toner';
              const expanded=expandedHistoryId===h.id;
              return <article className="pm-history-row" key={h.id}>
                <div className="pm-history-row-top"><strong>{actions[h.type]||h.type}: {h.summary||'Không có mô tả'}</strong>
                  {!isToner&&<span className="pm-cost-tag">{formatPrinterMoney(h.cost)}</span>}
                </div>
                <div className="pm-history-meta">
                  <span>Ngày {isToner?'đổ mực':'sửa'}: <b>{formatPrinterDate(h.date,h.at)}</b></span>
                  <span>Người thực hiện: <b>{h.byName||h.performedBy||'IT'}</b></span>
                </div>
                <button type="button" className="pm-history-expand" aria-expanded={expanded} onClick={()=>setExpandedHistoryId(expanded?null:h.id)}>{expanded?'Thu gọn chi tiết':'Xem chi tiết'}</button>
                {expanded&&<dl className="pm-history-details">
                  <div><dt>Loại công việc</dt><dd>{actions[h.type]||h.type}</dd></div>
                  <div><dt>Ngày thực hiện</dt><dd>{formatPrinterDate(h.date,h.at)}</dd></div>
                  <div><dt>Thời gian ghi nhận</dt><dd>{when(h.at)}</dd></div>
                  <div><dt>Người thực hiện</dt><dd>{h.byName||h.performedBy||'IT'}</dd></div>
                  {!isToner&&<div><dt>Chi phí sửa chữa</dt><dd className="pm-repair-price">{formatPrinterMoney(h.cost)}</dd></div>}
                  {h.replacedParts&&<div className="pm-full"><dt>Linh kiện thay thế</dt><dd>{h.replacedParts}</dd></div>}
                  {h.stockName&&<div className="pm-full"><dt>Mực / vật tư sử dụng</dt><dd>{h.stockName} (số lượng: {h.stockQuantity||1})</dd></div>}
                  {h.serviceProvider&&<div className="pm-full"><dt>Đơn vị sửa chữa</dt><dd>{h.serviceProvider}</dd></div>}
                  {h.ticketCode&&<div><dt>Ticket tham chiếu</dt><dd>{h.ticketCode}</dd></div>}
                  <div className="pm-full"><dt>Kết quả xử lý / ghi chú</dt><dd>{h.notes||'Chưa có ghi chú'}</dd></div>
                </dl>}
              </article>;
            })}
            {!visibleHistory.length&&<p className="pm-help">Chưa có nhật ký trong nhóm này.</p>}
          </div>
          <div className="pm-repair-total" aria-label="Tổng chi phí sửa chữa máy in">
            <div><strong>Tổng chi phí sửa chữa</strong><span>{repairTotals.count} lần sửa chữa · không tính tiền mực</span>
            {repairTotals.unknown>0&&<small>{repairTotals.unknown} lần chưa ghi chi phí, không cộng vào tổng.</small>}</div>
            <output>{formatPrinterMoney(repairTotals.total)}</output>
          </div>
        </div>}
`;
   part=part.slice(0,at)+replacement+part.slice(to);
   return part;
 });

 css += `
/* HEXA_PRINTER_HISTORY_OVERLAY_V2: portal trên toàn trang, không bị thanh tab che */
.pm-overlay{z-index:2147483000!important;isolation:isolate;}
.pm-overlay .pm-modal{position:relative;z-index:1;max-width:calc(100vw - 32px);}
.pm-history-view{display:flex;flex-direction:column;min-height:100%;gap:10px;}
.pm-history-row{gap:11px;overflow-wrap:anywhere;}
.pm-history-row-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;}
.pm-history-row-top strong{flex:1;min-width:0;line-height:1.6;}
.pm-cost-tag{display:inline-flex;align-items:center;flex:0 0 auto;font-weight:800;font-size:12px;color:#166b51;background:#e6f6ef;border-radius:7px;padding:6px 9px;}
.pm-history-meta{display:flex;gap:8px 20px;flex-wrap:wrap;color:#71819b;font-size:11px;}
.pm-history-meta b{color:#3f5270;}
.pm-history-expand{justify-self:start;cursor:pointer;border:1px solid #cfe0fa;background:#f5f8ff;border-radius:7px;padding:7px 10px;color:#2964cf;font-size:11px;font-weight:800;}
.pm-history-expand:hover{background:#e9f1ff;}
.pm-history-details{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:2px 0 0;padding:15px;background:#f7f9fd;border:1px solid #e7edf8;border-radius:8px;}
.pm-history-details>div{min-width:0;}
.pm-history-details .pm-full{grid-column:1/-1;}
.pm-history-details dt{color:#8796ab;font-size:10px;margin-bottom:5px;}
.pm-history-details dd{margin:0;font-size:12px;color:#2f4261;font-weight:700;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.5;}
.pm-history-details .pm-repair-price{color:#15825e;}
.pm-repair-total{position:sticky;bottom:-20px;display:flex;justify-content:space-between;align-items:center;gap:16px;margin-top:auto;padding:16px 14px;background:#f4f8ff;border:1px solid #ccdcf5;border-radius:10px;box-shadow:0 -4px 14px #132a5412;}
.pm-repair-total>div{display:grid;gap:4px;}
.pm-repair-total strong{font-size:13px;color:#243a5b;}
.pm-repair-total span,.pm-repair-total small{color:#7184a2;font-size:11px;}
.pm-repair-total output{color:#165db4;font-size:18px;font-weight:900;white-space:nowrap;font-variant-numeric:tabular-nums;}
@media(max-width:640px){.pm-history-row-top{flex-wrap:wrap}.pm-history-details{grid-template-columns:1fr}.pm-history-details .pm-full{grid-column:auto}.pm-repair-total{align-items:flex-start;flex-direction:column}.pm-repair-total output{font-size:17px}}
`;

 // Giữ nguyên khi chưa thực hiện đầy đủ kiểm tra.
 const backup=path.join(os.tmpdir(),`HEXA_PRINTER_HISTORY_BACKUP_${new Date().toISOString().replace(/[:.]/g,'-')}`);
 fs.mkdirSync(backup,{recursive:true});
 fs.writeFileSync(path.join(backup,'PrinterManagement.jsx'),file(jsxPath));
 fs.writeFileSync(path.join(backup,'printer-management.css'),file(cssPath));
 if(fs.existsSync(utilPath))fs.copyFileSync(utilPath,path.join(backup,'printer-history-utils.js'));
 fs.writeFileSync(jsxPath,jsx,'utf8');
 fs.writeFileSync(cssPath,css,'utf8');
 fs.writeFileSync(utilPath,file(utilSource),'utf8');
 console.log('[OK] Da cap nhat giao dien may in, xem chi tiet sua chua va tong chi phi.');
 console.log('[OK] Sao luu file cu:',backup);
 console.log('[OK] Khong thay doi .env, backend hoac Firebase.');
} catch(e){console.error('[FAILED]',e.message);process.exitCode=1;}
