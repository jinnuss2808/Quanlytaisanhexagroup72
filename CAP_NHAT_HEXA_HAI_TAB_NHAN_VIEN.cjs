'use strict';
/** HEXA: split the existing employee directory into two UI-only tabs.
 * Run from existing HEXA root (next to backend/ and frontend/):
 *    node CAP_NHAT_HEXA_HAI_TAB_NHAN_VIEN.cjs --check
 *    node CAP_NHAT_HEXA_HAI_TAB_NHAN_VIEN.cjs
 * Safe: no Firebase changes, no rewriting other business modules; backs up first.
 */
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const root=process.cwd();
const jsRel='frontend/src/AttendanceManagement.jsx';
const cssRel='frontend/src/hexa-modules.css';
const marker='HEXA_EMPLOYEE_TWO_TABS_20261119_V1';
const jsxPath=path.join(root,jsRel);
const cssPath=path.join(root,cssRel);
function assertFound(condition,message){if(!condition)throw new Error(message);}
function exactlyOnce(source,anchor,description){
  const first=source.indexOf(anchor);
  assertFound(first>=0,`Không tìm thấy ${description}; phiên bản Chấm công khác dự kiến. Không sửa file.`);
  assertFound(source.indexOf(anchor,first+anchor.length)===-1,`Phát hiện ${description} nhiều lần. Không sửa file.`);
}
function replaceOne(source,from,to,name){exactlyOnce(source,from,name);return source.replace(from,to);}
function updateJSX(original){
  if(original.includes(marker))return original;
  assertFound(original.includes('attendance/admin/employees')&&original.includes('hm-compact-directory'),
    'AttendanceManagement.jsx chưa phải danh sách nhân viên gọn (cần cài bản Danh bạ gọn + Import Excel trước).');
  let text=original;
  text=replaceOne(text,"import './hexa-modules.css';",`import './hexa-modules.css';\n// ${marker}\n// Phân loại tại giao diện: không chuyển/xóa bất cứ bản ghi nào trên Firebase.\nconst hasEmployeeCode=person=>{\n  const code=String(person?.employeeCode??'').trim();\n  return Boolean(code)&&!(/^(?:[-–—]+|n\\/?a|chưa có|không có)$/i.test(code));\n};`,'điểm khai báo chức năng');
  text=replaceOne(text,
    "  const [employees,setEmployees]=useState([]),[mailLinks,setMailLinks]=useState([]);",
    "  const [employees,setEmployees]=useState([]),[mailLinks,setMailLinks]=useState([]);\n  const [rosterTab,setRosterTab]=useState('coded');",
    'state danh sách nhân viên');
  text=replaceOne(text,
    "  const visible=useMemo(()=>employees.filter(x=>`${x.employeeCode||''} ${x.name||''} ${x.company||''} ${x.email||''}`.toLocaleLowerCase('vi').includes(filter.toLocaleLowerCase('vi'))),[employees,filter]);",
    "  const withCodeCount=useMemo(()=>employees.filter(hasEmployeeCode).length,[employees]);\n  const withoutCodeCount=employees.length-withCodeCount;\n  const visible=useMemo(()=>employees.filter(x=>hasEmployeeCode(x)===(rosterTab==='coded') && `${x.employeeCode||''} ${x.name||''} ${x.company||''} ${x.email||''}`.toLocaleLowerCase('vi').includes(filter.toLocaleLowerCase('vi'))),[employees,filter,rosterTab]);",
    'bộ lọc nhân viên');
  text=replaceOne(text,
    "      setNotice(editing?'Đã cập nhật hồ sơ nhân viên.':'Đã thêm nhân viên vào danh sách theo dõi.');setShowForm(false);setEditing('');setForm(blank);await refresh();",
    "      setNotice(editing?'Đã cập nhật hồ sơ nhân viên.':'Đã thêm nhân viên vào danh sách theo dõi.');setRosterTab(hasEmployeeCode(form)?'coded':'uncoded');setRevealedPasswords({});setShowForm(false);setEditing('');setForm(blank);await refresh();",
    'lưu hồ sơ nhân viên');
  const markup=`    <div className="hm-roster-tabs" role="tablist" aria-label="Phân loại hồ sơ nhân viên">\n      <button type="button" role="tab" id="hm-tab-coded" aria-controls="hm-roster-table" aria-selected={rosterTab==='coded'} className={rosterTab==='coded'?'hm-roster-tab active':'hm-roster-tab'} onClick={()=>{setRosterTab('coded');setRevealedPasswords({});}}>\n        <Users size={16}/> Nhân viên có mã NV <span className="hm-roster-tab-count">{withCodeCount}</span>\n      </button>\n      <button type="button" role="tab" id="hm-tab-uncoded" aria-controls="hm-roster-table" aria-selected={rosterTab==='uncoded'} className={rosterTab==='uncoded'?'hm-roster-tab active':'hm-roster-tab'} onClick={()=>{setRosterTab('uncoded');setRevealedPasswords({});}} title="Các mail chưa cấp mã: tài khoản cũ, nhân viên HCM hoặc yêu cầu riêng">\n        <Mail size={16}/> Mail chưa có mã NV (cũ / HCM) <span className="hm-roster-tab-count">{withoutCodeCount}</span>\n      </button>\n    </div>\n`;
  text=replaceOne(text,'    {error&&<p className="hm-alert"',markup+'    {error&&<p className="hm-alert"','vị trí chèn tab');
  text=replaceOne(text,
    '    <div className="hm-panel hm-directory-panel"><div className="hm-scroll hm-roster-scroll"><table>',
    '    <div className="hm-panel hm-directory-panel" id="hm-roster-table" role="tabpanel" aria-labelledby={rosterTab===\'coded\'?\'hm-tab-coded\':\'hm-tab-uncoded\'}><div className="hm-scroll hm-roster-scroll"><table>',
    'bảng danh sách');
  text=replaceOne(text,
    '{!visible.length&&<tr><td colSpan={7}>Không tìm thấy nhân viên phù hợp.</td></tr>}',
    "{!visible.length&&<tr><td colSpan={7}>{filter?'Không tìm thấy hồ sơ phù hợp với từ khóa trong tab này.':rosterTab==='coded'?'Chưa có nhân viên có mã NV.':'Chưa có mail/nhân viên không có mã NV.'}</td></tr>}",
    'dòng danh sách trống');
  return text;
}
const cssBlock=`\n/* ${marker}: responsive coded / uncoded employee directory */\n.hm-roster.hm-compact-directory .hm-roster-tabs{display:flex;gap:8px;align-items:center;flex-wrap:nowrap;min-width:0;overflow-x:auto;padding:2px 0;scrollbar-width:thin}\n.hm-roster.hm-compact-directory .hm-roster-tab{display:inline-flex;align-items:center;gap:8px;white-space:nowrap;flex:0 0 auto;min-height:38px;padding:8px 13px;border:1px solid #d4e6e1;background:#f2f9f7;color:#336d63;border-radius:9px;font-size:12px;font-weight:750;cursor:pointer}\n.hm-roster.hm-compact-directory .hm-roster-tab.active{background:#006b60;color:#fff;border-color:#006b60}\n.hm-roster.hm-compact-directory .hm-roster-tab:focus-visible{outline:2px solid #159c8c;outline-offset:2px}\n.hm-roster.hm-compact-directory .hm-roster-tab-count{display:inline-grid;place-items:center;padding:2px 7px;min-width:22px;border-radius:7px;background:rgba(0,107,96,.1);font-variant-numeric:tabular-nums;font-size:11px;font-weight:850}\n.hm-roster.hm-compact-directory .hm-roster-tab.active .hm-roster-tab-count{background:rgba(255,255,255,.19);color:#fff}\n.hm-roster.hm-compact-directory .hm-roster-scroll{max-height:calc(100dvh - 230px)}\nhtml[data-hexa-theme="dark"] .hm-roster.hm-compact-directory .hm-roster-tab:not(.active){background:#254239;border-color:#4e7164;color:#d4efe3}\nhtml[data-hexa-theme="dark"] .hm-roster.hm-compact-directory .hm-roster-tab:not(.active) .hm-roster-tab-count{background:#315e51;color:#e1f8ee}\n@media(max-width:750px){.hm-roster.hm-compact-directory .hm-roster-scroll{max-height:calc(100dvh - 280px)!important}}\n`;
function updateCSS(original){return original.includes(marker)?original:original.trimEnd()+'\n'+cssBlock;}
function main(){
  assertFound(fs.existsSync(jsxPath)&&fs.existsSync(cssPath),
    'Không tìm thấy frontend/src/AttendanceManagement.jsx hoặc hexa-modules.css. Mở PowerShell tại thư mục gốc HEXA có frontend và backend.');
  const jsxOrig=fs.readFileSync(jsxPath,'utf8');
  const cssOrig=fs.readFileSync(cssPath,'utf8');
  const jsxNew=updateJSX(jsxOrig),cssNew=updateCSS(cssOrig);
  const changes=[[jsRel,jsxPath,jsxOrig,jsxNew],[cssRel,cssPath,cssOrig,cssNew]].filter(x=>x[2]!==x[3]);
  console.log('HEXA – Tách tab Nhân viên có mã NV / Mail chưa có mã NV');
  console.log('Project:',root);
  if(!changes.length){console.log('Hai tab đã được cài. Không có file phải sửa.');return;}
  console.log('File cần sửa:',changes.map(x=>x[0]).join(', '));
  if(process.argv.includes('--check')){console.log('OK: Kiểm tra thành công. Chưa ghi bất kỳ file nào.');return;}
  const backups=path.join(os.homedir(),'HEXA-code-backups');
  fs.mkdirSync(backups,{recursive:true});
  const backupDir=fs.mkdtempSync(path.join(backups,'two-employee-tabs-'));
  let written=[];
  try{
    for(const [rel,dest,old,newText] of changes){
      const destBackup=path.join(backupDir,rel);fs.mkdirSync(path.dirname(destBackup),{recursive:true});fs.writeFileSync(destBackup,old,'utf8');
      fs.writeFileSync(dest,newText,'utf8');written.push([dest,old]);
    }
  }catch(err){for(const [dest,old] of written.reverse())fs.writeFileSync(dest,old,'utf8');throw err;}
  console.log('Đã cập nhật. Sao lưu tại:',backupDir);
  console.log('Không sửa backend, Link mail, Firebase, mật khẩu hoặc dữ liệu nhân viên.');
  console.log('Kiểm tra: cd frontend; npm run build. Sau đó chỉ commit 2 file frontend và push main.');
}
try{main();}catch(err){console.error('[STOP]',err.message);process.exitCode=1;}
