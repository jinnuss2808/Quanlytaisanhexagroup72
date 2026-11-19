'use strict';
/** Updates an EXISTING HEXA project with Chấm công + Link mail, no database reset.
 * From project root: node CAP_NHAT_HEXA_DANH_BA_GON.cjs --check
 *                    node CAP_NHAT_HEXA_DANH_BA_GON.cjs
 */
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const root=process.cwd();
const payload=path.join(__dirname,'modules');
const v2Marker='/* HEXA LINK MAIL V2';
const rosterMarker='/* HEXA employee directory: tracking only, not clock-in/out */';
const compactMarker='/* HEXA_COMPACT_DIRECTORY_20261119_V1:';
const cssPath='frontend/src/hexa-modules.css';
const appPath='frontend/src/App.jsx';
const replaceFiles=[
  'frontend/src/AttendanceManagement.jsx',
  'frontend/src/MailLinks.jsx',
  'backend/src/attendance-api.js',
  'backend/src/mail-vault-api.js',
  'backend/src/mail-presets.js',
  'backend/test/mail-presets.test.js',
  'backend/src/employee-roster-core.js',
  'backend/src/asset-excel.js',
  'backend/test/employee-roster.test.js',
  'frontend/public/Mau_Nhap_Nhan_Vien_HEXA.xlsx',
];
function buf(rel){return fs.readFileSync(path.join(root,rel));}
function str(rel){return buf(rel).toString('utf8');}
function mod(rel){const f=path.join(payload,rel);if(!fs.existsSync(f))throw Error('Gói ZIP thiếu: '+rel);return fs.readFileSync(f);}
function validate(){
  for(const f of [appPath,cssPath,'backend/src/app.js','backend/src/mail-vault-api.js',
    'frontend/src/AttendanceManagement.jsx','frontend/src/MailLinks.jsx','backend/src/attendance-api.js',
    'backend/src/asset-excel.js','frontend/package.json','backend/package.json']){
    if(!fs.existsSync(path.join(root,f)))throw Error('Không thấy '+f+'. Chạy tại thư mục gốc HEXA (cùng cấp frontend/backend) đã cài Chấm công + Link mail.');
  }
  if(!str(appPath).includes("import AttendanceManagement from './AttendanceManagement.jsx'"))throw Error('App.jsx chưa có Chấm công — dừng để bảo vệ mã nguồn.');
  if(!str(appPath).includes("import MailLinks from './MailLinks.jsx'"))throw Error('App.jsx chưa có Link mail — dừng để bảo vệ mã nguồn.');
  if(!str('backend/src/app.js').includes("app.use('/api/attendance/admin'"))throw Error('Backend chưa tích hợp API nhân viên.');
  if(!str('backend/src/attendance-api.js').includes('attendanceEmployees'))throw Error('attendance-api.js không phải bản HEXA mong đợi.');
  if(!str('backend/src/asset-excel.js').includes('readAssetExcel'))throw Error('asset-excel.js không khớp project HEXA.');
  if(!str('frontend/src/MailLinks.jsx').includes('mail-links'))throw Error('MailLinks.jsx không phải danh bạ HEXA.');
  if(!str('frontend/src/AttendanceManagement.jsx').includes('attendance/admin/employees'))throw Error('AttendanceManagement.jsx không phải màn hình nhân viên HEXA.');
}
function main(){
  validate();
  const change=new Map();
  for(const rel of replaceFiles){const next=mod(rel);const dest=path.join(root,rel);
    if(!fs.existsSync(dest)||!fs.readFileSync(dest).equals(next))change.set(rel,next);
  }
  const original=str(cssPath);
  const fullCss=mod(cssPath).toString('utf8');
  let css=original;
  if(!css.includes(v2Marker)){
    const at=fullCss.indexOf(v2Marker),end=fullCss.indexOf(rosterMarker,at);
    if(at<0||end<0)throw Error('Thiếu CSS Link mail danh sách trong gói cập nhật.');
    css+='\n\n'+fullCss.slice(at,end).trimEnd()+'\n';
  }
  if(!css.includes(rosterMarker)){
    const at=fullCss.indexOf(rosterMarker);if(at<0)throw Error('Thiếu CSS danh sách nhân viên trong gói cập nhật.');
    const end=fullCss.indexOf(compactMarker,at);if(end<0)throw Error('Thiếu CSS giao diện gọn.');
    css+='\n\n'+fullCss.slice(at,end).trimEnd()+'\n';
  }
  if(!css.includes(compactMarker)){
    const at=fullCss.indexOf(compactMarker);if(at<0)throw Error('Thiếu mã CSS giao diện gọn.');
    css+='\n\n'+fullCss.slice(at).trim()+'\n';
  }
  if(css!==original)change.set(cssPath,Buffer.from(css));
  const oldApp=str(appPath);
  let nextApp=oldApp;
  const oldHeader="{section !== 'assets' && <div className=\"dash-heading\">";
  const newHeader="{!['assets','attendance','mail_links'].includes(section) && <div className=\"dash-heading\">";
  if(oldApp.includes(oldHeader))nextApp=oldApp.replace(oldHeader,newHeader);
  else if(!oldApp.includes(newHeader))throw Error('Không nhận diện được tiêu đề trang trong App.jsx. Không ghi đè.');
  if(nextApp!==oldApp)change.set(appPath,Buffer.from(nextApp));
  console.log('HEXA – Danh bạ nhân viên + Link mail gọn, có xem/copy mật khẩu theo quyền Admin');
  console.log('Nguồn:',root);
  console.log('Các file thay đổi:',change.size);
  for(const rel of change.keys())console.log(' - '+rel);
  if(process.argv.includes('--check')){console.log('OK: chỉ kiểm tra, chưa sửa file hoặc dữ liệu.');return;}
  if(!change.size){console.log('Bản cập nhật đã được áp dụng; không có file cần sửa.');return;}
  const backups=path.join(os.homedir(),'HEXA-code-backups');
  fs.mkdirSync(backups,{recursive:true});
  const backup=fs.mkdtempSync(path.join(backups,'directory-'));
  const touched=[];
  try{
    for(const [rel,next] of change){
      const dest=path.join(root,rel);
      if(fs.existsSync(dest)){const copy=path.join(backup,rel);fs.mkdirSync(path.dirname(copy),{recursive:true});fs.copyFileSync(dest,copy);}
      fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,next);touched.push(rel);
    }
  }catch(e){for(const rel of touched.reverse()){const old=path.join(backup,rel),dest=path.join(root,rel);if(fs.existsSync(old))fs.copyFileSync(old,dest);else fs.rmSync(dest,{force:true});}throw e;}
  console.log('HOÀN TẤT. Bản sao file trước sửa:',backup);
  console.log('Chạy npm test tại backend, npm run build tại frontend rồi commit đúng các file của chức năng.');
  console.log('Không sửa Firebase, MAIL_VAULT_KEY, .env hay dữ liệu nhân viên.');
}
try{main();}catch(e){console.error('[STOP]',e.message);process.exitCode=1;}
