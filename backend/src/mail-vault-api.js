import express from 'express';
import { db } from './firebase.js';
import {encryptSecret,decryptSecret,safePortalURL} from './mail-vault-core.js';
import {MAIL_PRESET_MAP,listMailLinks,MAIL_CATEGORIES} from './mail-presets.js';
const router=express.Router();
const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res)).catch(next);
const error=(status,message)=>Object.assign(new Error(message),{status});
const trim=(value,n)=>typeof value==='string'?value.trim().slice(0,n):'';
const safe=r=>({id:r.id,title:r.title,url:r.url||'',category:r.category||'Quản trị mail',note:r.note||'',username:r.username||'',hasPassword:Boolean(r.sealed||r.hasPassword),isPreset:Boolean(r.isPreset),createdAt:r.createdAt,updatedAt:r.updatedAt});
const validCategory=s=>MAIL_CATEGORIES.includes(s)?s:'Quản trị mail';
function validUrl(value){
  if(value===null||value===undefined||value==='')return '';
  const parsed=safePortalURL(value);
  if(!parsed)throw error(400,'URL phải dùng HTTPS; địa chỉ IP nội bộ chưa có URL có thể để trống.');
  return parsed;
}
router.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});
router.get('/',wrap(async(_req,res)=>{
  const data=(await db.ref('mailVault').get()).val()||{};
  res.json(listMailLinks(data).map(safe));
}));
router.post('/',wrap(async(req,res)=>{
  const title=trim(req.body?.title,120),url=validUrl(req.body?.url),note=trim(req.body?.note,600);
  const username=trim(req.body?.username,180),category=validCategory(req.body?.category);
  if(!title||(!url&&!note))throw error(400,'Cần tên và địa chỉ HTTPS hoặc ghi chú địa chỉ nội bộ.');
  const sealed=req.body?.password?encryptSecret(req.body.password):null;
  const now=Date.now();const ref=db.ref('mailVault').push();
  await ref.set({title,url,category,note,username,sealed,createdAt:now,updatedAt:now,createdBy:req.it.uid});
  res.status(201).json(safe({id:ref.key,title,url,category,note,username,sealed,createdAt:now,updatedAt:now}));
}));
router.patch('/:id',wrap(async(req,res)=>{
  if(!/^[\w-]{1,128}$/.test(req.params.id))throw error(400,'ID không hợp lệ.');
  const ref=db.ref(`mailVault/${req.params.id}`),existing=(await ref.get()).val();
  if(existing?.deleted)throw error(404,'Liên kết đã được xóa.');
  const preset=MAIL_PRESET_MAP.get(req.params.id);
  if(!existing&&!preset)throw error(404,'Không tìm thấy liên kết.');
  const old=existing||preset;
  const title=req.body.title===undefined?old.title:trim(req.body.title,120);
  const username=req.body.username===undefined?(old.username||''):trim(req.body.username,180);
  const url=req.body.url===undefined?(old.url||''):validUrl(req.body.url);
  const note=req.body.note===undefined?(old.note||''):trim(req.body.note,600);
  const category=req.body.category===undefined?validCategory(old.category):validCategory(req.body.category);
  if(!title||(!url&&!note))throw error(400,'Tên, địa chỉ HTTPS hoặc ghi chú không hợp lệ.');
  const sealed=req.body.password?encryptSecret(req.body.password):(old.sealed||null);
  const updatedAt=Date.now();
  const record={title,username,url,note,category,sealed,updatedAt,createdAt:old.createdAt||updatedAt,createdBy:old.createdBy||req.it.uid};
  if(preset){record.isPreset=true;record.sortIndex=preset.sortIndex;}
  // set() is necessary for the first edit of a built-in virtual preset.
  await ref.set(record);
  res.json(safe({id:req.params.id,...record}));
}));
router.delete('/:id',wrap(async(req,res)=>{
  if(!/^[\w-]{1,128}$/.test(req.params.id))throw error(400,'ID không hợp lệ.');
  const ref=db.ref(`mailVault/${req.params.id}`);
  if(MAIL_PRESET_MAP.has(req.params.id)){
    // Tombstone prevents the built-in link from reappearing when the page reloads.
    await ref.set({deleted:true,updatedAt:Date.now(),deletedBy:req.it.uid});
  }else await ref.remove();
  res.json({ok:true});
}));
router.post('/:id/reveal',wrap(async(req,res)=>{
  if(!/^[\w-]{1,128}$/.test(req.params.id))throw error(400,'ID không hợp lệ.');
  const r=(await db.ref(`mailVault/${req.params.id}`).get()).val();
  if(!r?.sealed||r.deleted)throw error(404,'Chưa có mật khẩu được lưu.');
  const password=decryptSecret(r.sealed);
  await db.ref('mailVaultAudit').push({actorUid:req.it.uid,recordId:req.params.id,action:'reveal',at:Date.now()});
  res.json({password});
}));
export default router;
