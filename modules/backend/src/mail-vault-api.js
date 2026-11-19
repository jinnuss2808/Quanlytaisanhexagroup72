import express from 'express';
import { db } from './firebase.js';
import {encryptSecret,decryptSecret,safePortalURL} from './mail-vault-core.js';
const router=express.Router();
const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res)).catch(next);
const error=(status,message)=>Object.assign(new Error(message),{status});
const safe=r=>({id:r.id,title:r.title,url:r.url,username:r.username,hasPassword:!!r.sealed,createdAt:r.createdAt,updatedAt:r.updatedAt});
const trim=(value,n)=>typeof value==='string'?value.trim().slice(0,n):'';
router.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});
router.get('/',wrap(async(_req,res)=>{
  const data=(await db.ref('mailVault').get()).val()||{};
  res.json(Object.entries(data).map(([id,r])=>safe({id,...r})).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0)));
}));
router.post('/',wrap(async(req,res)=>{
  const title=trim(req.body?.title,120), username=trim(req.body?.username,180),url=safePortalURL(req.body?.url);
  if(!title||!username||!url||typeof req.body?.password!=='string'||!req.body.password) throw error(400,'Cần tên, URL HTTPS, tài khoản và mật khẩu.');
  const sealed=encryptSecret(req.body.password);
  const now=Date.now();const ref=db.ref('mailVault').push();
  await ref.set({title,username,url,sealed,createdAt:now,updatedAt:now,createdBy:req.it.uid});
  res.status(201).json(safe({id:ref.key,title,username,url,sealed,createdAt:now,updatedAt:now}));
}));
router.patch('/:id',wrap(async(req,res)=>{
  if(!/^[\w-]{1,128}$/.test(req.params.id)) throw error(400,'ID không hợp lệ.');
  const ref=db.ref(`mailVault/${req.params.id}`);const old=(await ref.get()).val();
  if(!old) throw error(404,'Không tìm thấy liên kết.');
  const title=req.body.title===undefined?old.title:trim(req.body.title,120);
  const username=req.body.username===undefined?old.username:trim(req.body.username,180);
  const url=req.body.url===undefined?old.url:safePortalURL(req.body.url);
  if(!title||!username||!url) throw error(400,'Tên, URL HTTPS và tài khoản không hợp lệ.');
  const sealed=req.body.password?encryptSecret(req.body.password):old.sealed;
  await ref.update({title,username,url,sealed,updatedAt:Date.now()});
  res.json(safe({id:req.params.id,title,username,url,sealed,createdAt:old.createdAt,updatedAt:Date.now()}));
}));
router.delete('/:id',wrap(async(req,res)=>{
  if(!/^[\w-]{1,128}$/.test(req.params.id)) throw error(400,'ID không hợp lệ.');
  await db.ref(`mailVault/${req.params.id}`).remove();res.json({ok:true});
}));
router.post('/:id/reveal',wrap(async(req,res)=>{
  if(!/^[\w-]{1,128}$/.test(req.params.id)) throw error(400,'ID không hợp lệ.');
  const r=(await db.ref(`mailVault/${req.params.id}`).get()).val();
  if(!r?.sealed) throw error(404,'Không có mật khẩu được lưu.');
  const password=decryptSecret(r.sealed);
  await db.ref('mailVaultAudit').push({actorUid:req.it.uid,recordId:req.params.id,action:'reveal',at:Date.now()});
  res.json({password});
}));
export default router;
