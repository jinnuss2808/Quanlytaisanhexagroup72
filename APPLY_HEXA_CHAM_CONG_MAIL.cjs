/* HEXA Attendance & Mail links installer (additive, no .bat).
 * Run once from project root: node APPLY_HEXA_CHAM_CONG_MAIL.cjs --check
 *                          node APPLY_HEXA_CHAM_CONG_MAIL.cjs
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const root=process.cwd();
const payload=path.join(__dirname,'modules');
const frontRel='frontend/src/App.jsx';
const backRel='backend/src/app.js';
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
function replaceOnce(src,needle,updated,file){
 if(!src.includes(needle)) throw new Error(`${file}: không tìm thấy vị trí tích hợp ${JSON.stringify(needle.slice(0,75))}. Không ghi đè dự án. Hãy giữ source và gửi file này để cập nhật đúng phiên bản.`);
 return src.replace(needle,updated);
}
function modifyFrontend(src){
 if(src.includes("import AttendanceManagement from './AttendanceManagement.jsx';")) return src;
 src=replaceOnce(src,
   "import HeaderNetworkClock from './HeaderNetworkClock.jsx';",
   "import HeaderNetworkClock from './HeaderNetworkClock.jsx';\nimport AttendanceManagement from './AttendanceManagement.jsx';\nimport AttendanceClock from './AttendanceClock.jsx';\nimport MailLinks from './MailLinks.jsx';",
   frontRel);
 src=replaceOnce(src,
   "    { id: 'assets', label: 'Quản lý tài sản', icon: Boxes },",
   "    { id: 'assets', label: 'Quản lý tài sản', icon: Boxes },\n    ...(isManager ? [{ id: 'attendance', label: 'Chấm công', icon: CalendarDays }, { id: 'mail_links', label: 'Link mail', icon: Mail }] : []),",
   frontRel);
 src=replaceOnce(src,"assets: 'Quản lý tài sản' }[section]", "assets: 'Quản lý tài sản', attendance:'Chấm công', mail_links:'Link mail' }[section]",frontRel);
 const renderer="          {section === 'assets' && <AssetManagement";
 src=replaceOnce(src,renderer,"          {section === 'attendance' && isManager && <AttendanceManagement/>}\n          {section === 'mail_links' && isManager && <MailLinks/>}\n"+renderer,frontRel);
 const isIT="  const isIT = window.location.pathname === '/it' || window.location.pathname.startsWith('/it/');";
 src=replaceOnce(src,isIT,"  const isAttendance = window.location.pathname === '/attendance' || window.location.pathname === '/attendance/';\n"+isIT,frontRel);
 const asset="  if (assetPublicId) return <PublicAssetPage publicId={assetPublicId}/>;";
 src=replaceOnce(src,asset,asset+"\n  if (isAttendance) return <AttendanceClock/>;",frontRel);
 return src;
}
function modifyBackend(src){
 if(src.includes("import { attendanceAdminRouter, attendanceSelfRouter } from './attendance-api.js';")) return src;
 const importAnchor="import itLibraryRouter from './it-library-api.js';";
 src=replaceOnce(src,importAnchor,importAnchor+"\nimport { attendanceAdminRouter, attendanceSelfRouter } from './attendance-api.js';\nimport mailVaultRouter from './mail-vault-api.js';",backRel);
 const mountAnchor="app.use('/api/it-library', requireIT, itLibraryRouter);";
 src=replaceOnce(src,mountAnchor,mountAnchor+"\napp.use('/api/attendance/admin', requireIT, requireManager, attendanceAdminRouter);\napp.use('/api/attendance/self', attendanceSelfRouter);\napp.use('/api/mail-links', requireIT, requireManager, mailVaultRouter);",backRel);
 return src;
}
const additional=[
 'backend/src/attendance-core.js','backend/src/attendance-api.js',
 'backend/src/mail-vault-core.js','backend/src/mail-vault-api.js',
 'backend/test/attendance-mail.test.js',
 'frontend/src/AttendanceManagement.jsx','frontend/src/AttendanceClock.jsx',
 'frontend/src/MailLinks.jsx','frontend/src/hexa-modules.css'
];
function main(){
 for(const req of [frontRel,backRel,'backend/package.json','frontend/package.json']) if(!fs.existsSync(path.join(root,req))) throw new Error(`Không thấy ${req}. Mở CMD/PowerShell trong thư mục gốc dự án HEXA rồi chạy lại.`);
 const changes=new Map([[frontRel,modifyFrontend(read(frontRel))],[backRel,modifyBackend(read(backRel))]]);
 for(const f of additional){
   const input=path.join(payload,f),dest=path.join(root,f);
   if(!fs.existsSync(input)) throw new Error(`Gói ZIP thiếu file ${f}.`);
   const next=fs.readFileSync(input);
   if(fs.existsSync(dest)&&!fs.readFileSync(dest).equals(next)) throw new Error(`File ${f} đã tồn tại và có thay đổi riêng. Không ghi đè. Hãy sao lưu/đối chiếu trước.`);
   if(!fs.existsSync(dest)) changes.set(f,next);
 }
 for(const [f,next] of [...changes]) if(fs.existsSync(path.join(root,f)) && Buffer.from(read(f)).equals(Buffer.from(next))) changes.delete(f);
 console.log('HEXA — Tích hợp Chấm công & Link mail.');
 console.log('Project:',root);
 console.log('Số file cần thêm/chỉnh:',changes.size);
 for(const f of changes.keys()) console.log(' -',f);
 if(process.argv.includes('--check')){console.log('Đã kiểm tra. Chưa thay đổi file nào.');return;}
 if(changes.size===0){console.log('Không có thay đổi mới.');return;}
 const backup=fs.mkdtempSync(path.join(os.tmpdir(),'HEXA-ATTENDANCE-BACKUP-'));
 const installed=[];
 try{
   for(const [f,next] of changes){
     const dest=path.join(root,f);
     if(fs.existsSync(dest)){const saved=path.join(backup,f);fs.mkdirSync(path.dirname(saved),{recursive:true});fs.copyFileSync(dest,saved);}
     fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,next);installed.push(f);
   }
 }catch(err){for(const f of installed.reverse()){const old=path.join(backup,f),dest=path.join(root,f);if(fs.existsSync(old))fs.copyFileSync(old,dest);else fs.rmSync(dest,{force:true});}throw err;}
 console.log('Đã tích hợp thành công. Bản sao lưu ở:',backup);
 console.log('Tiếp theo: cd backend && npm test; cd ../frontend && npm run build.');
 console.log('Đặt MAIL_VAULT_KEY dạng hex 64 ký tự trong backend/.env và Vercel backend (Secret) để sử dụng kho mật khẩu.');
}
try{main();}catch(err){console.error('[STOP]',err.message);process.exitCode=1;}
