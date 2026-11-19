'use strict';
/**
 * Add client-side Vietnamese locale-aware employee sorting to the EXISTING HEXA
 * two-tab directory. No backend/Firebase changes, no sensitive data access.
 * Usage from the repository root:
 *   node CAP_NHAT_HEXA_SAP_XEP_NHAN_VIEN.cjs --check
 *   node CAP_NHAT_HEXA_SAP_XEP_NHAN_VIEN.cjs
 */
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const root=process.cwd();
const here=__dirname;
const marker='HEXA_EMPLOYEE_SORT_FILTER_20261119_V1';
const jsxRel='frontend/src/AttendanceManagement.jsx';
const cssRel='frontend/src/hexa-modules.css';
const helperRel='frontend/src/employee-directory-sort.mjs';

function guard(cond,message){if(!cond)throw new Error(message);}
function replaceOnce(source,from,to,what){
  const first=source.indexOf(from);
  guard(first>=0,`Không tìm thấy ${what}. Source có thể khác bản dự kiến; chưa sửa file.`);
  guard(source.indexOf(from,first+1)<0,`Có nhiều ${what}; chưa sửa file.`);
  return source.slice(0,first)+to+source.slice(first+from.length);
}
function replaceRegexOnce(source,regex,to,what){
  const matches=[...source.matchAll(new RegExp(regex.source,regex.flags.includes('g')?regex.flags:regex.flags+'g'))];
  guard(matches.length===1,`Cần đúng một ${what} (thực tế ${matches.length}). Source khác dự kiến; chưa sửa file.`);
  return source.replace(regex,to);
}
function transformJSX(orig){
  if(orig.includes(marker))return orig;
  guard(orig.includes('HEXA_EMPLOYEE_TWO_TABS_20261119_V1') && orig.includes('hm-roster-tabs'),
    'Chưa thấy bản chia 2 tab có mã NV / không mã NV. Hãy áp dụng bản chia 2 tab trước khi chạy bản sắp xếp.');
  let out=orig;
  out=replaceOnce(out,"import './hexa-modules.css';",`import './hexa-modules.css';\nimport {sortEmployeeDirectory} from './employee-directory-sort.mjs';\n// ${marker}`, 'import CSS');
  out=replaceOnce(out,
    "  const [rosterTab,setRosterTab]=useState('coded');",
    "  const [rosterTab,setRosterTab]=useState('coded');\n  const [employeeSortByTab,setEmployeeSortByTab]=useState({coded:'code-asc',uncoded:'name-asc'});\n  const activeEmployeeSort=employeeSortByTab[rosterTab]||(rosterTab==='coded'?'code-asc':'name-asc');",
    'state tab danh sách');
  out=replaceRegexOnce(out,
    /^  const visible=useMemo\(\(\)=>employees\.filter\([^\n]+\),\[employees,filter,rosterTab\]\);$/m,
    "  const filteredEmployees=useMemo(()=>employees.filter(x=>hasEmployeeCode(x)===(rosterTab==='coded') && `${x.employeeCode||''} ${x.name||''} ${x.company||''} ${x.email||''}`.toLocaleLowerCase('vi').includes(filter.toLocaleLowerCase('vi'))),[employees,filter,rosterTab]);\n  const visible=useMemo(()=>sortEmployeeDirectory(filteredEmployees,activeEmployeeSort),[filteredEmployees,activeEmployeeSort]);",
    'bộ lọc nhân viên hiện có');
  out=replaceOnce(out,
    '      <div className="hm-actions"><span className="hm-inline-count"><Users size={15}/> {employees.length} nhân viên</span>',
    `      <label className="hm-employee-sort-field" title="Sắp xếp danh sách đang xem">\n        <span className="hm-sort-label">Sắp xếp</span>\n        <select aria-label="Sắp xếp danh sách nhân viên" value={activeEmployeeSort} onChange={e=>setEmployeeSortByTab(current=>({...current,[rosterTab]:e.target.value}))}>\n          {rosterTab==='coded'&&<optgroup label="Mã nhân viên"><option value="code-asc">Mã NV: thấp → cao</option><option value="code-desc">Mã NV: cao → thấp</option></optgroup>}\n          <optgroup label="Họ tên"><option value="name-asc">Tên: A → Z</option><option value="name-desc">Tên: Z → A</option></optgroup>\n          <optgroup label="Công ty / Phòng"><option value="company-asc">Công ty: A → Z</option><option value="company-desc">Công ty: Z → A</option></optgroup>\n          <optgroup label="Email"><option value="email-asc">Email: A → Z</option><option value="email-desc">Email: Z → A</option></optgroup>\n        </select>\n      </label>\n      <div className="hm-actions"><span className="hm-inline-count" title="Số hồ sơ đang hiển thị / số hồ sơ trong tab"><Users size={15}/> {visible.length}/{rosterTab==='coded'?withCodeCount:withoutCodeCount} hồ sơ</span>`,
    'thanh công cụ danh sách');
  out=replaceOnce(out,
    "<td><strong>{p.employeeCode||'—'}</strong></td><td>{p.name||'—'}</td><td>{p.company||'—'}</td>",
    "<td><strong>{p.employeeCode||'—'}</strong></td><td>{p.name||'—'}</td><td><span className=\"hm-company-chip\">{p.company||'—'}</span></td>",
    'cột công ty');
  return out;
}
const cssBlock=`\n/* ${marker} — employee directory sorting and readability */\n.hm-roster.hm-compact-directory .hm-compact-toolbar{display:flex;align-items:center;gap:9px;row-gap:8px}\n.hm-roster.hm-compact-directory .hm-toolbar-search{min-width:180px;flex:1 1 245px}\n.hm-roster.hm-compact-directory .hm-employee-sort-field{display:inline-flex;align-items:center;gap:8px;min-width:0;flex:0 0 auto;padding:4px 5px 4px 10px;min-height:38px;border-radius:9px;border:1px solid #c5ddd6;background:#fff;color:#285e53}\n.hm-roster.hm-compact-directory .hm-sort-label{font-weight:800;font-size:11px;white-space:nowrap}\n.hm-roster.hm-compact-directory .hm-employee-sort-field select{font:inherit;font-size:11.5px;font-weight:750;color:#245b51;background:transparent;border:0;outline:0;cursor:pointer;width:165px;max-width:100%;padding:3px 18px 3px 0}\n.hm-roster.hm-compact-directory .hm-employee-sort-field:focus-within{outline:2px solid #0d9684;outline-offset:1px}\n.hm-roster.hm-compact-directory .hm-scroll th{color:#386b60;font-size:11px;font-weight:800}\n.hm-roster.hm-compact-directory .hm-scroll td{color:#2f5951;font-size:12px;line-height:1.5}\n.hm-roster.hm-compact-directory .hm-scroll td:nth-child(2){font-weight:700;color:#204e46}\n.hm-roster.hm-compact-directory .hm-scroll tbody tr:nth-child(even){background:rgba(17,112,96,.033)}\n.hm-roster.hm-compact-directory .hm-scroll tbody tr:hover{background:rgba(17,112,96,.085)}\n.hm-roster.hm-compact-directory .hm-scroll td,.hm-roster.hm-compact-directory .hm-scroll th{padding:10px 9px}\n.hm-roster.hm-compact-directory .hm-company-chip{display:inline-block;max-width:100%;padding:4px 7px;border-radius:6px;background:#edf5f2;color:#295f54;font-weight:750;overflow-wrap:anywhere;font-size:11px}\n.hm-roster.hm-compact-directory .hm-roster-scroll table{min-width:980px}\n.hm-roster.hm-compact-directory .hm-roster-scroll th:nth-child(1){width:10%}\n.hm-roster.hm-compact-directory .hm-roster-scroll th:nth-child(2){width:14%}\n.hm-roster.hm-compact-directory .hm-roster-scroll th:nth-child(3){width:9%}\n.hm-roster.hm-compact-directory .hm-roster-scroll th:nth-child(4){width:22%}\n.hm-roster.hm-compact-directory .hm-roster-scroll th:nth-child(5){width:14%}\n.hm-roster.hm-compact-directory .hm-roster-scroll th:nth-child(6){width:18%}\n.hm-roster.hm-compact-directory .hm-roster-scroll th:nth-child(7){width:13%}\nhtml[data-hexa-theme="dark"] .hm-roster.hm-compact-directory .hm-employee-sort-field{background:#203d34;border-color:#507568;color:#ddf5eb}\nhtml[data-hexa-theme="dark"] .hm-roster.hm-compact-directory .hm-employee-sort-field select{color:#def5ea}\nhtml[data-hexa-theme="dark"] .hm-roster.hm-compact-directory .hm-sort-label{color:#cceadd}\nhtml[data-hexa-theme="dark"] .hm-roster.hm-compact-directory .hm-company-chip{background:#2d5145;color:#d6f3e4}\nhtml[data-hexa-theme="dark"] .hm-roster.hm-compact-directory .hm-scroll tbody tr:nth-child(even){background:rgba(224,255,243,.03)}\nhtml[data-hexa-theme="dark"] .hm-roster.hm-compact-directory .hm-scroll tbody tr:hover{background:rgba(224,255,243,.09)}\nhtml[data-hexa-theme="dark"] .hm-roster.hm-compact-directory .hm-scroll td{color:#d0eee3}\nhtml[data-hexa-theme="dark"] .hm-roster.hm-compact-directory .hm-scroll td:nth-child(2){color:#e3faf0}\n@media(max-width:1100px){.hm-roster.hm-compact-directory .hm-toolbar-search{flex:1 1 100%}.hm-roster.hm-compact-directory .hm-employee-sort-field{margin-right:auto}}\n@media(max-width:600px){.hm-roster.hm-compact-directory .hm-employee-sort-field{width:100%;justify-content:space-between}.hm-roster.hm-compact-directory .hm-employee-sort-field select{width:70%}}\n`;
function transformCSS(orig){return orig.includes(marker)?orig:orig.trimEnd()+'\n'+cssBlock;}
function main(){
  const jsxPath=path.join(root,jsxRel), cssPath=path.join(root,cssRel),helperPath=path.join(root,helperRel);
  const templatePath=path.join(here,'employee-directory-sort.mjs');
  guard(fs.existsSync(templatePath),'Thiếu employee-directory-sort.mjs bên cạnh script. Hãy giải nén đủ 2 file.');
  guard(fs.existsSync(jsxPath)&&fs.existsSync(cssPath),'Hãy mở terminal trong thư mục gốc HEXA chứa frontend và backend.');
  const originalJSX=fs.readFileSync(jsxPath,'utf8'),originalCSS=fs.readFileSync(cssPath,'utf8');
  const newJSX=transformJSX(originalJSX),newCSS=transformCSS(originalCSS);
  const template=fs.readFileSync(templatePath,'utf8');
  const oldHelper=fs.existsSync(helperPath)?fs.readFileSync(helperPath,'utf8'):null;
  guard(oldHelper===null||oldHelper===template,'Tồn tại employee-directory-sort.mjs có nội dung khác. Hãy sao lưu/kiểm tra thủ công, chưa ghi đè.');
  const changes=[[jsxRel,jsxPath,originalJSX,newJSX],[cssRel,cssPath,originalCSS,newCSS],[helperRel,helperPath,oldHelper,template]].filter(x=>x[2]!==x[3]);
  console.log('HEXA – Bổ sung sắp xếp và cải thiện danh sách nhân viên');
  console.log('Thư mục:',root);
  if(!changes.length){console.log('Bản cập nhật đã có. Không ghi trùng.');return;}
  console.log('Sẽ cập nhật:',changes.map(x=>x[0]).join(', '));
  if(process.argv.includes('--check')){console.log('[OK] Kiểm tra thành công, CHƯA ghi file.');return;}
  const backupDir=fs.mkdtempSync(path.join(os.tmpdir(),'HEXA-employee-sort-backup-'));
  for(const [rel,dest,old] of changes){if(old!==null){const location=path.join(backupDir,rel);fs.mkdirSync(path.dirname(location),{recursive:true});fs.writeFileSync(location,old,'utf8');}}
  const committed=[];
  try{
    for(const [rel,dest,old,newData] of changes){fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,newData,'utf8');committed.push([dest,old]);}
  }catch(error){for(const [dest,old] of committed.reverse()){if(old===null)fs.rmSync(dest,{force:true});else fs.writeFileSync(dest,old,'utf8');}throw error;}
  console.log('[OK] Đã sửa giao diện và thêm bộ sắp xếp; không thay đổi backend/Firebase.');
  console.log('Sao lưu file cũ tại:',backupDir);
  console.log('Kiểm tra tiếp: cd frontend && npm run build');
}
try{main()}catch(err){console.error('[STOP]',err.message);process.exitCode=1;}
