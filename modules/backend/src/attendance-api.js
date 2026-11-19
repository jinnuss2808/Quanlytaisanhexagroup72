import express from 'express';
import {db,adminAuth} from './firebase.js';
import {localDayKeys} from './attendance-core.js';
import {cleanRosterProfile,EMPLOYEE_EXCEL_HEADERS,planRosterImport,matchesRosterIdentity,compareRosterProfiles} from './employee-roster-core.js';
import {readExcelTable} from './asset-excel.js';
import {encryptSecret,decryptSecret,safePortalURL} from './mail-vault-core.js';
import {MAIL_PRESET_MAP} from './mail-presets.js';

const adminRouter=express.Router();
const selfRouter=express.Router(); // Legacy routes retained for existing accounts; NOT used by new directory UI.
const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
const error=(status,message)=>Object.assign(new Error(message),{status});
const validateId=id=>{if(!/^[\w-]{1,128}$/.test(id||''))throw error(400,'ID nhân viên không hợp lệ.');return id;};
const summary=(p,id)=>({uid:id,employeeCode:p.employeeCode,name:p.name,company:p.company,email:p.email,active:p.active!==false,
  mailLinkId:p.mailLinkId||'',hasPassword:Boolean(p.sealed),directoryOnly:Boolean(p.directoryOnly),createdAt:p.createdAt||null});
async function checkMailLink(id){
  if(!id)return '';
  if(!/^[\w-]{1,128}$/.test(id))throw error(400,'Mã Link mail không hợp lệ.');
  const entry=(await db.ref(`mailVault/${id}`).get()).val();
  if(entry?.deleted || (!entry&&!MAIL_PRESET_MAP.has(id)))throw error(400,'Liên kết mail đã bị xóa hoặc không tồn tại.');
  const link=entry||MAIL_PRESET_MAP.get(id);
  if(!safePortalURL(link.url))throw error(400,'Link mail đã chọn chưa có URL HTTPS được xác minh.');
  return id;
}
adminRouter.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});
adminRouter.get('/employees',wrap(async(_req,res)=>{
  const data=(await db.ref('attendanceEmployees').get()).val()||{};
  res.json({employees:Object.entries(data).map(([id,p])=>summary(p,id)).sort(compareRosterProfiles)});
}));
adminRouter.post('/employees',wrap(async(req,res)=>{
  const profile=cleanRosterProfile(req.body);
  await checkMailLink(profile.mailLinkId);
  const password=req.body?.password===undefined?'':String(req.body.password||'');
  if(password.length>512)throw error(400,'Mật khẩu tối đa 512 ký tự.');
  const data=(await db.ref('attendanceEmployees').get()).val()||{};
  if(Object.values(data).some(p=>matchesRosterIdentity(p,profile)))
    throw error(409,'Mã NV hoặc email đã tồn tại.');
  const ref=db.ref('attendanceEmployees').push();
  const record={...profile,active:true,directoryOnly:true,createdAt:Date.now(),createdBy:req.it.uid};
  if(password)record.sealed=encryptSecret(password);
  await ref.set(record);
  res.status(201).json(summary(record,ref.key));
}));
adminRouter.post('/employees/import.xlsx',express.raw({type:['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/octet-stream'],limit:'8mb'}),wrap(async(req,res)=>{
  if(!Buffer.isBuffer(req.body))throw error(400,'Hãy chọn file Excel .xlsx.');
  const mailLinkId=await checkMailLink(typeof req.query.mailLinkId==='string'?req.query.mailLinkId:'');
  const rows=readExcelTable(req.body,EMPLOYEE_EXCEL_HEADERS,{maxRows:1000});
  const existing=Object.values((await db.ref('attendanceEmployees').get()).val()||{});
  const plan=planRosterImport(rows,existing,mailLinkId);
  // Import valid records even if other rows lack a usable code/email. Never echo passwords.
  // Duplicate rows are skipped without touching existing records.
  const now=Date.now(),updates={};
  for(const {profile,password} of plan.prepared){
    const id=db.ref('attendanceEmployees').push().key;
    const value={...profile,active:true,directoryOnly:true,createdAt:now,createdBy:req.it.uid,importedFrom:'xlsx'};
    if(password)value.sealed=encryptSecret(password);
    updates[`attendanceEmployees/${id}`]=value;
  }
  if(Object.keys(updates).length)await db.ref().update(updates);
  res.json({created:plan.prepared.length,skipped:plan.skipped,invalid:plan.errors.length,errors:plan.errors.slice(0,50)});
}));
adminRouter.patch('/employees/:uid',wrap(async(req,res)=>{
  const uid=validateId(req.params.uid);
  if(typeof req.body?.active!=='boolean')throw error(400,'Trạng thái không hợp lệ.');
  const ref=db.ref(`attendanceEmployees/${uid}`),p=(await ref.get()).val();
  if(!p)throw error(404,'Không tìm thấy nhân viên.');
  // Old accounts created with Firebase Auth remain manageable for backwards compatibility.
  if(!p.directoryOnly){await adminAuth.updateUser(uid,{disabled:!req.body.active});if(!req.body.active)await adminAuth.revokeRefreshTokens(uid);}
  await ref.update({active:req.body.active,updatedAt:Date.now()});
  res.json({ok:true,active:req.body.active});
}));
adminRouter.patch('/employees/:uid/profile',wrap(async(req,res)=>{
  const uid=validateId(req.params.uid),ref=db.ref(`attendanceEmployees/${uid}`),p=(await ref.get()).val();
  if(!p)throw error(404,'Không tìm thấy nhân viên.');
  const profile=cleanRosterProfile(req.body);
  await checkMailLink(profile.mailLinkId);
  const data=(await db.ref('attendanceEmployees').get()).val()||{};
  if(Object.entries(data).some(([id,x])=>id!==uid && matchesRosterIdentity(x,profile)))
    throw error(409,'Mã NV hoặc email đã tồn tại.');
  // Don't silently alter the Firebase Authentication login of legacy accounts.
  if(!p.directoryOnly && profile.email!==p.email)throw error(409,'Email tài khoản chấm công cũ không thể đổi tại danh bạ.');
  const password=req.body?.password===undefined?'':String(req.body.password||'');
  if(password.length>512)throw error(400,'Mật khẩu tối đa 512 ký tự.');
  const change={...profile,updatedAt:Date.now()};
  if(password)change.sealed=encryptSecret(password);
  await ref.update(change);
  res.json(summary({...p,...change},uid));
}));
adminRouter.post('/employees/:uid/reveal',wrap(async(req,res)=>{
  const uid=validateId(req.params.uid);
  const p=(await db.ref(`attendanceEmployees/${uid}`).get()).val();
  if(!p?.sealed)throw error(404,'Nhân viên này chưa được lưu mật khẩu trong danh bạ.');
  const password=decryptSecret(p.sealed);
  await db.ref('attendanceEmployeeAudit').push({actorUid:req.it.uid,employeeId:uid,action:'reveal',at:Date.now()});
  res.json({password});
}));

// Legacy attendance records endpoint intentionally left available for existing historical data.
adminRouter.get('/records',wrap(async(req,res)=>{
  const month=String(req.query.month||'');
  if(!/^20\d\d-(0[1-9]|1[0-2])$/.test(month))throw error(400,'Tháng phải có định dạng YYYY-MM.');
  const [people,records]=await Promise.all([db.ref('attendanceEmployees').get(),db.ref(`attendanceRecords/${month}`).get()]);
  const users=people.val()||{},results=[];
  for(const [uid,days] of Object.entries(records.val()||{}))for(const [day,entry] of Object.entries(days||{})){
    const p=users[uid]||{};
    results.push({uid,date:day,employeeCode:p.employeeCode||'—',name:p.name||'Nhân viên cũ',company:p.company||'—',checkInAt:entry.checkInAt||null,checkOutAt:entry.checkOutAt||null});
  }
  results.sort((a,b)=>b.date.localeCompare(a.date));
  res.json({month,records:results});
}));

async function requireEmployee(req,res,next){
  try{
    const token=req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if(!token)throw error(401,'Hãy đăng nhập tài khoản chấm công.');
    let decoded;try{decoded=await adminAuth.verifyIdToken(token,true);}catch{throw error(401,'Phiên đăng nhập không hợp lệ.');}
    const p=(await db.ref(`attendanceEmployees/${decoded.uid}`).get()).val();
    if(!p||p.directoryOnly||p.active!==true||p.email!==decoded.email)throw error(403,'Tài khoản không có quyền chấm công.');
    req.employee={uid:decoded.uid,...summary(p,decoded.uid)};next();
  }catch(e){next(e);}
}
selfRouter.use(requireEmployee);
selfRouter.get('/today',wrap(async(req,res)=>{
  const {month,date}=localDayKeys(),rec=(await db.ref(`attendanceRecords/${month}/${req.employee.uid}/${date}`).get()).val()||{};
  res.json({employee:req.employee,date,checkInAt:rec.checkInAt||null,checkOutAt:rec.checkOutAt||null});
}));
selfRouter.post('/check-in',wrap(async(req,res)=>{
  const {month,date}=localDayKeys(),ref=db.ref(`attendanceRecords/${month}/${req.employee.uid}/${date}`);
  const result=await ref.transaction(old=>old?.checkInAt?undefined:{checkInAt:Date.now()},undefined,false);
  if(!result.committed)throw error(409,'Hôm nay đã ghi nhận giờ vào.');
  res.json({date,...result.snapshot.val()});
}));
selfRouter.post('/check-out',wrap(async(req,res)=>{
  const {month,date}=localDayKeys(),ref=db.ref(`attendanceRecords/${month}/${req.employee.uid}/${date}`);
  const result=await ref.transaction(old=>!old?.checkInAt||old.checkOutAt?undefined:{...old,checkOutAt:Date.now()},undefined,false);
  if(!result.committed)throw error(409,'Cần ghi nhận giờ vào trước hoặc đã ghi nhận giờ ra.');
  res.json({date,...result.snapshot.val()});
}));
export {adminRouter as attendanceAdminRouter,selfRouter as attendanceSelfRouter};
