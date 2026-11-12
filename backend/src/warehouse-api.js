import express from 'express';
import { db } from './firebase.js';
import { assetError, asText, assetUUID, keyForCode } from './asset-core.js';
import { normalizeStockItem, quantity, stockChange, movementRows, STOCK_CATEGORIES } from './warehouse-core.js';
import { transactExistingTicket as conditionalUpdate } from './ticket-transaction.js';

const router=express.Router();
const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
const validId=id=>{if(!/^[\w-]{1,128}$/.test(id||''))throw assetError(400,'ID không hợp lệ.');return id;};
const requireIT=(req,_res,next)=>['manager','agent'].includes(req.it?.role)&&req.it?.active===true?next():next(assetError(403,'Không có quyền quản lý kho.'));
const getItems=async()=> (await db.ref('warehouseStock').get()).val()||{};
const getItem=async id=>{const v=(await db.ref(`warehouseStock/${validId(id)}`).get()).val();if(!v||v.deletedAt)throw assetError(404,'Không tìm thấy mặt hàng.');return v;};
router.use(requireIT);
router.get('/',wrap(async(req,res)=>{
  const all=Object.values(await getItems()).filter(x=>!x.deletedAt);
  const kind=asText(req.query.category,30),q=asText(req.query.search,150).toLocaleLowerCase('vi');
  const list=all.filter(x=>(!kind||kind==='all'||x.category===kind)&&(!q||[x.sku,x.name,x.location,x.owner,x.note].some(v=>String(v||'').toLocaleLowerCase('vi').includes(q))));
  list.sort((a,b)=>String(a.name).localeCompare(String(b.name),'vi',{numeric:true}));
  const items=list.map(({movements,...row})=>({...row,movementCount:Object.keys(movements||{}).length}));
  res.json({items,total:items.length,alerts:items.filter(x=>x.quantity<=x.minQuantity).length,categories:STOCK_CATEGORIES});
}));
router.post('/',wrap(async(req,res)=>{
  const data=normalizeStockItem(req.body);const qty=quantity(req.body?.quantity??0,'Tồn đầu kỳ',{allowZero:true});
  const id='w_'+assetUUID();
  const idx=db.ref(`warehouseStockCodes/${keyForCode(data.sku)}`);
  const reserved=await idx.transaction(old=>old||id,undefined,false);
  if(reserved.snapshot.val()!==id)throw assetError(409,'Mã hàng đã tồn tại trong kho.');
  const now=Date.now();const opId='opening_'+assetUUID().replaceAll('-','');
  const item={id,...data,quantity:qty,createdAt:now,updatedAt:now,createdBy:req.it.uid,
    movements:qty?{[opId]:{id:opId,type:'opening',before:0,delta:qty,after:qty,recipient:'',reason:'Nhập tồn đầu kỳ',performedBy:req.it.name||req.it.email,at:now}}:{}};
  try{await db.ref(`warehouseStock/${id}`).set(item);}catch(err){await idx.remove().catch(()=>{});throw err;}
  res.status(201).json({...item,movements:undefined});
}));
router.patch('/:id',wrap(async(req,res)=>{
  const id=validId(req.params.id);const old=await getItem(id);
  const data=normalizeStockItem({...old,...req.body,sku:old.sku});
  if(req.body?.sku&&asText(req.body.sku,100).toUpperCase()!==old.sku)throw assetError(400,'Không sửa mã kho, hãy tạo mặt hàng mới.');
  const next=await conditionalUpdate(db.ref(`warehouseStock/${id}`),v=>v&&!v.deletedAt?{...v,...data,updatedAt:Date.now()}:undefined);
  if(!next.committed)throw assetError(409,'Mặt hàng vừa thay đổi.');
  res.json({...next.snapshot.val(),movements:undefined});
}));
router.post('/:id/movements',wrap(async(req,res)=>{
  const id=validId(req.params.id);await getItem(id);
  const type=asText(req.body?.type,20),opId='mv_'+assetUUID().replaceAll('-','');
  const input={type,amount:req.body?.amount,actualQuantity:req.body?.actualQuantity,recipient:req.body?.recipient,
    reason:req.body?.reason,assetId:req.body?.assetId,performedBy:req.it.name||req.it.email||req.it.uid,date:req.body?.date,opId};
  const tx=await conditionalUpdate(db.ref(`warehouseStock/${id}`),v=>stockChange(v,input));
  if(!tx.committed)throw assetError(409,'Không thể cập nhật kho, thử lại.');
  res.json({item:{...tx.snapshot.val(),movements:undefined},movement:tx.snapshot.val().movements[opId]});
}));
router.get('/:id/movements',wrap(async(req,res)=>res.json(movementRows(await getItem(req.params.id)))));
router.delete('/:id',wrap(async(req,res)=>{
  const id=validId(req.params.id),old=await getItem(id);
  if(old.quantity!==0)throw assetError(409,'Chỉ có thể xóa mặt hàng khi tồn kho bằng 0.');
  await db.ref(`warehouseStock/${id}`).update({deletedAt:Date.now(),updatedAt:Date.now()});
  // Keep code index to preserve audit identity; it can be restored by administrator in future.
  res.json({ok:true});
}));
export default router;
