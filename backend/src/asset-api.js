import express from 'express';
import { db } from './firebase.js';
import { getStorage } from 'firebase-admin/storage';
import { assetError, asText, normalizeAsset, keyForCode, assetUUID, enrichAsset, selectAssets, parseCSV, mapLegacyCSV, toCSV } from './asset-core.js';
import { transactExistingTicket as conditionalUpdate } from './ticket-transaction.js';
import { readAssetExcel,writeAssetExcel } from './asset-excel.js';
import { prepareExcelImport } from './asset-xlsx-import.js';
import { quantity,stockChange } from './warehouse-core.js';

const router = express.Router();
const wrap = fn => (req,res,next) => Promise.resolve(fn(req,res,next)).catch(next);
const validId = id => {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id || '')) throw assetError(400,'Mã định danh không hợp lệ.');
  return id;
};
const permitted = req => ['manager','agent'].includes(req.it?.role) && req.it?.active === true;
function requireAssetIT(req,_res,next){if(!permitted(req))return next(assetError(403,'Tài khoản không có quyền quản lý tài sản.'));next();}
function requireManager(req,_res,next){if(req.it?.role !== 'manager')return next(assetError(403,'Chỉ Admin được quản lý danh mục.'));next();}
async function obj(path){return (await db.ref(path).get()).val() || {};}
function array(obj){return Object.entries(obj||{}).map(([id,r])=>({id,...r}));}
async function catalogs(){const [cats,depts]=await Promise.all([obj('assetCategories'),obj('assetDepartments')]);return {cats,depts};}
async function assetById(id,allowDeleted=false){validId(id);const row=(await db.ref(`assets/${id}`).get()).val();if(!row || (row.deletedAt&&!allowDeleted)) throw assetError(404,'Không tìm thấy tài sản.');return row;}
async function addLog(id,action,user,meta={}){const key=db.ref(`assetHistory/${id}`).push().key;await db.ref(`assetHistory/${id}/${key}`).set({id:key,action,byUid:user.uid,byName:user.name||user.email||'IT',at:Date.now(),...meta});}
async function reserve(code,id){
  const ref=db.ref('assetCodeIndex/'+keyForCode(code));
  const tx=await ref.transaction(old=>old||id,undefined,false);
  if(tx.snapshot.val() !== id)throw assetError(409,'Mã tài sản đã tồn tại.');
}
async function checkCatalog(asset){
  if(asset.categoryId && !(await db.ref('assetCategories/'+validId(asset.categoryId)).get()).exists())throw assetError(400,'Loại tài sản chưa tồn tại.');
  if(asset.ownerDepartmentId && !(await db.ref('assetDepartments/'+validId(asset.ownerDepartmentId)).get()).exists())throw assetError(400,'Công ty sở hữu chưa tồn tại.');
}
async function edited(id,modify){
  let abortReason;
  const result=await conditionalUpdate(db.ref(`assets/${id}`),old=>{
    if(old.deletedAt){abortReason='Tài sản đã được đưa vào thùng rác.';return undefined;}
    try{return modify(old);}catch(e){abortReason=e.message;return undefined;}
  });
  if(!result.committed)throw assetError(409,abortReason||'Tài sản đã bị thay đổi hoặc không tồn tại.');
  return result.snapshot.val();
}

router.use(requireAssetIT);
router.get('/catalogs', wrap(async(_req,res)=>{
  const {cats,depts}=await catalogs();res.json({categories:array(cats),departments:array(depts)});
}));
router.post('/catalogs/:kind',requireManager,wrap(async(req,res)=>{
  const kind=req.params.kind==='categories'?'assetCategories':req.params.kind==='departments'?'assetDepartments':null;
  if(!kind)throw assetError(404,'Danh mục không tồn tại.');
  const code=asText(req.body?.code,50).toUpperCase(); const name=asText(req.body?.name,255);const description=asText(req.body?.description,500);
  if(!code||!name)throw assetError(400,'Phải nhập mã và tên.');
  const old=await obj(kind);
  if(Object.values(old).some(x=>x.code.toUpperCase()===code))throw assetError(409,'Mã danh mục đã tồn tại.');
  const id=db.ref(kind).push().key;
  const item={id,code,name,description,createdAt:Date.now()};await db.ref(`${kind}/${id}`).set(item);
  res.status(201).json(item);
}));
router.patch('/catalogs/:kind/:id',requireManager,wrap(async(req,res)=>{
  const kind=req.params.kind==='categories'?'assetCategories':req.params.kind==='departments'?'assetDepartments':null;
  if(!kind)throw assetError(404,'Danh mục không tồn tại.');
  const id=validId(req.params.id),current=(await db.ref(`${kind}/${id}`).get()).val();if(!current)throw assetError(404,'Không tìm thấy danh mục.');
  const code=asText(req.body?.code,50).toUpperCase(),name=asText(req.body?.name,255);
  if(!code||!name)throw assetError(400,'Phải nhập mã và tên.');
  const dict=await obj(kind);
  if(Object.entries(dict).some(([key,val])=>key!==id&&val.code.toUpperCase()===code))throw assetError(409,'Mã danh mục đã tồn tại.');
  const next={...current,code,name,description:asText(req.body?.description,500),updatedAt:Date.now()};await db.ref(`${kind}/${id}`).set(next);res.json(next);
}));
router.delete('/catalogs/:kind/:id',requireManager,wrap(async(req,res)=>{
  const kind=req.params.kind==='categories'?'assetCategories':req.params.kind==='departments'?'assetDepartments':null;
  if(!kind)throw assetError(404,'Danh mục không tồn tại.');
  const id=validId(req.params.id),current=(await db.ref(`${kind}/${id}`).get()).val();if(!current)throw assetError(404,'Không tìm thấy danh mục.');
  const rows=Object.values(await obj('assets'));
  if(rows.some(a=>!a.deletedAt&&(kind==='assetCategories'?a.categoryId:a.ownerDepartmentId)===id))throw assetError(409,'Danh mục đang được tài sản sử dụng.');
  await db.ref(`${kind}/${id}`).remove();res.json({ok:true});
}));

router.get('/summary',wrap(async(_req,res)=>{
  const assets=Object.values(await obj('assets')).filter(x=>!x.deletedAt);
  const tally=Object.fromEntries(['available','using','maintenance','broken','liquidated'].map(s=>[s,assets.filter(x=>x.status===s).length]));
  res.json({total:assets.length,...tally});
}));
router.get('/export.csv',wrap(async(req,res)=>{
  const {cats,depts}=await catalogs();
  const rows=Object.values(await obj('assets')).filter(x=>!x.deletedAt).map(x=>enrichAsset(x,cats,depts));
  const cols=[['AssetCode','assetCode'],['AssetName','assetName'],['CategoryCode','categoryCode'],['DepartmentCode','ownerDepartmentCode'],['AssignedTo','assignedTo'],['IpAddress','ipAddress'],['SerialNumber','serialNumber'],['PurchaseDate','purchaseDate'],['PurchasePrice','purchasePrice'],['Status','status'],['Description','description']];
  const csv='\uFEFF'+toCSV(rows,cols);
  res.set('Content-Type','text/csv; charset=utf-8');res.set('Content-Disposition','attachment; filename="hexa-assets.csv"');res.send(csv);
}));
router.post('/import.csv',requireManager,express.text({type:'text/csv',limit:'4mb'}),wrap(async(req,res)=>{
  if(typeof req.body!=='string')throw assetError(400,'Gửi file CSV theo Content-Type text/csv.');
  const rows=parseCSV(req.body);if(rows.length>5000)throw assetError(400,'Giới hạn 5.000 dòng mỗi lần nhập.');
  const {cats,depts}=await catalogs(),existing=await obj('assetCodeIndex');
  const seen=new Set(Object.keys(existing));const candidates=[],errors=[];let skipped=0;
  for(const row of rows){
    try{
      const data=mapLegacyCSV(row,depts,cats);
      const key=keyForCode(data.assetCode);
      if(seen.has(key)){skipped++;continue;}
      seen.add(key);candidates.push(data);
    }catch(err){errors.push({row:row.__row,message:err.message});}
  }
  // Reject invalid file before writing any records (duplicates simply skipped).
  if(errors.length)return res.status(422).json({error:'CSV có dòng không hợp lệ, chưa nhập dữ liệu.',errors:errors.slice(0,50),skipped});
  let created=0;
  for(const data of candidates){
    const id='a_'+assetUUID();
    await reserve(data.assetCode,id);
    const t=Date.now();const record={...data,id,publicId:assetUUID(),createdAt:t,updatedAt:t,createdBy:req.it.uid,legacyImported:true};
    try{await db.ref().update({[`assets/${id}`]:record,[`assetPublicIds/${record.publicId}`]:id});created++;}
    catch(err){await db.ref('assetCodeIndex/'+keyForCode(data.assetCode)).remove().catch(()=>{});throw err;}
  }
  res.json({created,skipped,errors:[]});
}));
// Import/export .xlsx theo Dung mẫu DanhSachTaiSan (8).xlsx, tự tạo danh mục còn thiếu.
router.get('/export.xlsx',wrap(async(_req,res)=>{
  const [{cats,depts},all]=await Promise.all([catalogs(),obj('assets')]);
  const rows=Object.values(all).filter(x=>!x.deletedAt).map(x=>enrichAsset(x,cats,depts))
    .sort((a,b)=>a.assetCode.localeCompare(b.assetCode,'vi',{numeric:true}));
  const bytes=writeAssetExcel(rows);
  res.set('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.set('Content-Disposition','attachment; filename="DanhSachTaiSan_HEXA.xlsx"');
  res.send(bytes);
}));
router.get('/template.xlsx',wrap(async(_req,res)=>{
  res.set('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.set('Content-Disposition','attachment; filename="Mau_Import_HEXA.xlsx"');
  res.send(writeAssetExcel([]));
}));
router.post('/import.xlsx',requireManager,express.raw({type:['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/octet-stream'],limit:'12mb'}),wrap(async(req,res)=>{
  if(!Buffer.isBuffer(req.body))throw assetError(400,'Vui lòng tải lên tệp Excel .xlsx.');
  const rows=readAssetExcel(req.body);
  const [{cats,depts},indices,oldAssets]=await Promise.all([catalogs(),obj('assetCodeIndex'),obj('assets')]);
  const known=new Set([...Object.keys(indices),...Object.values(oldAssets).map(x=>keyForCode(x.assetCode||''))]);
  const plan=prepareExcelImport(rows,cats,depts,known);
  if(plan.errors.length)return res.status(422).json({error:'Một số dòng Excel không hợp lệ, chưa nhập dữ liệu.',errors:plan.errors.slice(0,50),skipped:plan.skipped});
  const updates={};const reserved=[];
  for(const cat of plan.newCategories)updates[`assetCategories/${cat.id}`]=cat;
  for(const dept of plan.newDepartments)updates[`assetDepartments/${dept.id}`]=dept;
  let skipped=plan.skipped,created=0;
  for(const data of plan.assets){
    const id='a_'+assetUUID(),key=keyForCode(data.assetCode);
    const index=db.ref('assetCodeIndex/'+key);
    const tx=await index.transaction(old=>old||id,undefined,false);
    if(tx.snapshot.val()!==id){skipped++;continue;}
    reserved.push(key);
    const time=Date.now(),record={...data,id,publicId:assetUUID(),createdAt:time,updatedAt:time,createdBy:req.it.uid,legacyImported:true};
    updates[`assets/${id}`]=record;updates[`assetPublicIds/${record.publicId}`]=id;
    const log=db.ref(`assetHistory/${id}`).push().key;
    updates[`assetHistory/${id}/${log}`]={id:log,action:'imported',at:time,byUid:req.it.uid,byName:req.it.name||'Admin',summary:'Nhập từ Excel'};
    if(data.assignedTo){
      const assign=db.ref(`assetAssignments/${id}`).push().key;
      updates[`assetAssignments/${id}/${assign}`]={id:assign,assignedTo:data.assignedTo,date:new Date().toISOString().slice(0,10),note:'Ghi nhận từ file Excel',assignedAt:time,assignedBy:req.it.uid};
    }
    created++;
  }
  try{if(Object.keys(updates).length)await db.ref().update(updates);}
  catch(err){await Promise.all(reserved.map(key=>db.ref('assetCodeIndex/'+key).remove().catch(()=>{})));throw err;}
  res.json({created,skipped,categoriesCreated:plan.newCategories.length,departmentsCreated:plan.newDepartments.length,errors:[]});
}));
router.get('/',wrap(async(req,res)=>{
  const [items,{cats,depts}]=await Promise.all([obj('assets'),catalogs()]);
  res.json(selectAssets(Object.values(items).map(x=>enrichAsset(x,cats,depts)),req.query));
}));
router.post('/',wrap(async(req,res)=>{
  const data=normalizeAsset(req.body);await checkCatalog(data);
  // A first assignment must be made via /assign, so it is audit-trailed.
  if(data.assignedTo)throw assetError(400,'Hãy sử dụng chức năng Bàn giao để chỉ định người sử dụng.');
  if(data.status==='using')throw assetError(400,'Tài sản mới chưa bàn giao không thể ở trạng thái Đang sử dụng.');
  const id='a_'+assetUUID();await reserve(data.assetCode,id);
  const now=Date.now();const record={...data,id,publicId:assetUUID(),createdAt:now,updatedAt:now,createdBy:req.it.uid};
  try{await db.ref().update({[`assets/${id}`]:record,[`assetPublicIds/${record.publicId}`]:id});}
  catch(err){await db.ref('assetCodeIndex/'+keyForCode(data.assetCode)).remove().catch(()=>{});throw err;}
  await addLog(id,'created',req.it,{summary:`Đã tạo ${data.assetCode}`});res.status(201).json(record);
}));
router.get('/:id',wrap(async(req,res)=>{
  const [{cats,depts},a]=await Promise.all([catalogs(),assetById(req.params.id)]);res.json(enrichAsset(a,cats,depts));
}));
router.patch('/:id',wrap(async(req,res)=>{
  const id=validId(req.params.id),old=await assetById(id);
  const data=normalizeAsset({...old,...req.body,assignedTo:old.assignedTo});
  if(data.assignedTo!==old.assignedTo)throw assetError(409,'Để thay đổi người sử dụng, hãy Bàn giao/Thu hồi.');
  if(old.status==='using'&&data.status!=='using')throw assetError(409,'Hãy thu hồi tài sản trước khi đổi trạng thái.');
  if(old.status!=='using'&&data.status==='using')throw assetError(409,'Hãy bàn giao để chuyển sang Đang sử dụng.');
  // Keep company ownership immutable except via explicitly authorized manager update.
  if(req.it.role!=='manager'&&data.ownerDepartmentId!==old.ownerDepartmentId)throw assetError(403,'Chỉ Admin được thay đổi công ty sở hữu.');
  await checkCatalog(data);
  if(data.assetCode!==old.assetCode)await reserve(data.assetCode,id);
  let changed;
  try {changed=await edited(id,current=>{
      if(current.updatedAt!==old.updatedAt)throw assetError(409,'Tài sản vừa được người khác sửa.');
      return {...current,...data,assignedTo:current.assignedTo,updatedAt:Date.now()};
    });}
  catch(err){if(data.assetCode!==old.assetCode)await db.ref('assetCodeIndex/'+keyForCode(data.assetCode)).remove().catch(()=>{});throw err;}
  if(data.assetCode!==old.assetCode)await db.ref('assetCodeIndex/'+keyForCode(old.assetCode)).remove();
  await addLog(id,'updated',req.it,{summary:'Đã sửa thông tin tài sản'});res.json(changed);
}));
router.delete('/:id',wrap(async(req,res)=>{
  const id=validId(req.params.id),old=await assetById(id);
  if(old.status==='using')throw assetError(409,'Hãy thu hồi tài sản trước khi xóa.');
  const value=await edited(id,current=>{
    if(current.status==='using'||current.assignedTo)throw assetError(409,'Hãy thu hồi tài sản trước khi xóa.');
    return {...current,deletedAt:Date.now(),deletedBy:req.it.uid,updatedAt:Date.now()};
  });
  await addLog(id,'deleted',req.it,{summary:'Đưa vào thùng rác'});res.json(value);
}));
router.post('/:id/restore',wrap(async(req,res)=>{
  const id=validId(req.params.id),old=await assetById(id,true);
  if(!old.deletedAt)throw assetError(409,'Tài sản chưa bị xóa.');
  const result=await conditionalUpdate(db.ref(`assets/${id}`),current=>({...current,deletedAt:null,deletedBy:null,updatedAt:Date.now()}));
  if(!result.committed)throw assetError(409,'Không thể khôi phục tài sản.');
  await addLog(id,'restored',req.it,{summary:'Khôi phục tài sản'});res.json(result.snapshot.val());
}));
router.post('/:id/assign',wrap(async(req,res)=>{
  const id=validId(req.params.id);await assetById(id);
  const name=asText(req.body?.assignedTo,255),date=asText(req.body?.date,10),note=asText(req.body?.note,1000);
  if(!name)throw assetError(400,'Vui lòng nhập người nhận tài sản.');
  if(date&&!/^\d{4}-\d{2}-\d{2}$/.test(date))throw assetError(400,'Ngày bàn giao không hợp lệ.');
  const result=await edited(id,old=>{
    if(old.status==='using'||old.assignedTo)throw assetError(409,'Tài sản đang được sử dụng, hãy thu hồi trước.');
    if(old.status!=='available')throw assetError(409,'Chỉ được bàn giao tài sản ở trạng thái Có sẵn.');
    return {...old,status:'using',assignedTo:name,updatedAt:Date.now()};
  });
  const key=db.ref(`assetAssignments/${id}`).push().key;
  await db.ref(`assetAssignments/${id}/${key}`).set({id:key,assignedTo:name,date:date||new Date().toISOString().slice(0,10),note,assignedAt:Date.now(),assignedBy:req.it.uid});
  await addLog(id,'assigned',req.it,{summary:`Bàn giao cho ${name}`,note});res.json(result);
}));
router.post('/:id/return',wrap(async(req,res)=>{
  const id=validId(req.params.id);await assetById(id);
  const date=asText(req.body?.date,10),note=asText(req.body?.note,1000);
  let priorName;
  const result=await edited(id,old=>{
    if(old.status!=='using'||!old.assignedTo)throw assetError(409,'Tài sản chưa được bàn giao.');
    priorName=old.assignedTo;
    return {...old,status:'available',assignedTo:null,updatedAt:Date.now()};
  });
  const records=await obj(`assetAssignments/${id}`);
  const ongoing=Object.values(records).filter(x=>!x.returnedAt).sort((a,b)=>b.assignedAt-a.assignedAt)[0];
  if(ongoing)await db.ref(`assetAssignments/${id}/${ongoing.id}`).update({returnedAt:Date.now(),returnedDate:date||new Date().toISOString().slice(0,10),returnNote:note,returnedBy:req.it.uid});
  await addLog(id,'returned',req.it,{summary:`Thu hồi từ ${priorName}`,note});res.json(result);
}));
router.get('/:id/history',wrap(async(req,res)=>{
  const id=validId(req.params.id);await assetById(id,true);
  const [history,assignments,maintenance]=await Promise.all([obj(`assetHistory/${id}`),obj(`assetAssignments/${id}`),obj(`assetMaintenance/${id}`)]);
  res.json({history:array(history).sort((a,b)=>b.at-a.at),assignments:array(assignments).sort((a,b)=>b.assignedAt-a.assignedAt),maintenance:array(maintenance).sort((a,b)=>b.at-a.at)});
}));
// Lịch sử sửa chữa, bảo trì, thay linh kiện, sửa máy in và thay mực.
router.post('/:id/maintenance',wrap(async(req,res)=>{
  const id=validId(req.params.id),item=await assetById(id);
  const type=asText(req.body?.type,30);
  const kinds=['repair','maintenance','replace_part','printer_service','replace_toner'];
  if(!kinds.includes(type))throw assetError(400,'Loại bảo trì không hợp lệ.');
  const summary=asText(req.body?.summary,255),notes=asText(req.body?.notes,1500);
  if(!summary)throw assetError(400,'Vui lòng ghi mô tả công việc.');
  const cost=Number(req.body?.cost||0);
  if(!Number.isFinite(cost)||cost<0||cost>1e15)throw assetError(400,'Chi phí không hợp lệ.');
  const date=asText(req.body?.date,10)||new Date().toISOString().slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw assetError(400,'Ngày bảo trì không hợp lệ.');
  const performedBy=asText(req.body?.performedBy,200)||req.it.name||req.it.email;
  const eventId=db.ref(`assetMaintenance/${id}`).push().key;
  const stockItemId=asText(req.body?.stockItemId,128);
  let usedMovement=null;
  if(stockItemId){
    validId(stockItemId);
    const stockRef=db.ref(`warehouseStock/${stockItemId}`);
    const stocked=(await stockRef.get()).val();
    if(!stocked||stocked.deletedAt)throw assetError(404,'Vật tư/mực trong kho không tồn tại.');
    if(type==='replace_toner'&&stocked.category!=='ink')throw assetError(400,'Thay mực phải chọn mặt hàng thuộc loại Mực in.');
    const amount=quantity(req.body?.stockQuantity??1);
    const operation='consume_'+eventId.replace(/[^A-Za-z0-9_-]/g,'');
    const result=await conditionalUpdate(stockRef,old=>stockChange(old,{type:'issue',amount,recipient:`Bảo trì ${item.assetCode}`,
      reason:summary,assetId:id,performedBy,opId:operation,date}));
    if(!result.committed)throw assetError(409,'Không thể trừ vật tư từ kho.');
    usedMovement={stockItemId,stockSku:stocked.sku,stockName:stocked.name,stockQuantity:amount,inventoryOperationId:operation};
  }
  const now=Date.now();
  const event={id:eventId,type,summary,notes,date,cost,performedBy,serviceProvider:asText(req.body?.serviceProvider,200),
    replacedParts:asText(req.body?.replacedParts,500),ticketCode:asText(req.body?.ticketCode,100),
    byUid:req.it.uid,byName:req.it.name||req.it.email,at:now,...(usedMovement||{})};
  const key=db.ref(`assetHistory/${id}`).push().key;
  await db.ref().update({
    [`assetMaintenance/${id}/${eventId}`]:event,
    [`assetHistory/${id}/${key}`]:{id:key,action:type,summary,byUid:req.it.uid,byName:req.it.name||req.it.email,at:now,maintenanceId:eventId}
  });
  res.status(201).json(event);
}));
router.get('/:id/software',wrap(async(req,res)=>{const id=validId(req.params.id);await assetById(id);res.json(array(await obj(`assetSoftware/${id}`)));}));
router.post('/:id/software',wrap(async(req,res)=>{
  const id=validId(req.params.id);await assetById(id);
  const softwareName=asText(req.body?.softwareName,255);if(!softwareName)throw assetError(400,'Tên phần mềm là bắt buộc.');
  const sid=db.ref(`assetSoftware/${id}`).push().key;
  const data={id:sid,softwareName,version:asText(req.body?.version,100),publisher:asText(req.body?.publisher,255),installedDate:asText(req.body?.installedDate,10),notes:asText(req.body?.notes,500),createdAt:Date.now()};
  await db.ref(`assetSoftware/${id}/${sid}`).set(data);await addLog(id,'software_added',req.it,{summary:`Thêm phần mềm ${softwareName}`});res.status(201).json(data);
}));
router.delete('/:id/software/:softwareId',wrap(async(req,res)=>{
  const id=validId(req.params.id),sid=validId(req.params.softwareId);await assetById(id);
  await db.ref(`assetSoftware/${id}/${sid}`).remove();await addLog(id,'software_deleted',req.it,{summary:'Xóa phần mềm'});res.json({ok:true});
}));
// Optional Firebase Storage images. File contents are never written into Realtime Database.
function imageBucket(){
  if(!process.env.FIREBASE_STORAGE_BUCKET)throw assetError(501,'Chưa cấu hình FIREBASE_STORAGE_BUCKET để lưu hình ảnh.');
  return getStorage().bucket(process.env.FIREBASE_STORAGE_BUCKET);
}
router.get('/:id/images',wrap(async(req,res)=>{const id=validId(req.params.id);await assetById(id);res.json(array(await obj(`assetImages/${id}`)));}));
router.post('/:id/images',express.raw({type:['image/jpeg','image/png','image/webp'],limit:'5mb'}),wrap(async(req,res)=>{
  const id=validId(req.params.id);await assetById(id);const images=await obj(`assetImages/${id}`);
  if(Object.keys(images).length>=6)throw assetError(409,'Tối đa 6 ảnh cho mỗi tài sản.');
  const bytes=req.body;
  if(!Buffer.isBuffer(bytes)||!bytes.length)throw assetError(400,'Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP.');
  const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  const png=bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'));
  const webp=bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
  if(!jpeg&&!png&&!webp)throw assetError(400,'Tệp ảnh không hợp lệ.');
  const mime=jpeg?'image/jpeg':png?'image/png':'image/webp';
  const imageId=db.ref(`assetImages/${id}`).push().key;
  const path=`hexa-assets/${id}/${imageId}.${jpeg?'jpg':png?'png':'webp'}`;
  await imageBucket().file(path).save(bytes,{resumable:false,contentType:mime,metadata:{cacheControl:'private, max-age=0'}});
  const record={id:imageId,path,mime,size:bytes.length,primary:Object.keys(images).length===0,createdAt:Date.now()};
  await db.ref(`assetImages/${id}/${imageId}`).set(record);res.status(201).json(record);
}));
router.get('/:id/images/:imageId/file',wrap(async(req,res)=>{
  const id=validId(req.params.id),sid=validId(req.params.imageId);await assetById(id);
  const image=(await db.ref(`assetImages/${id}/${sid}`).get()).val();if(!image)throw assetError(404,'Không tìm thấy ảnh.');
  const [bytes]=await imageBucket().file(image.path).download();
  res.set('Content-Type',image.mime);res.set('Cache-Control','private, no-store');res.set('X-Content-Type-Options','nosniff');res.send(bytes);
}));
router.patch('/:id/images/:imageId/primary',wrap(async(req,res)=>{
  const id=validId(req.params.id),sid=validId(req.params.imageId);await assetById(id);
  const items=await obj(`assetImages/${id}`);if(!items[sid])throw assetError(404,'Không tìm thấy ảnh.');
  const updates={};for(const item of Object.values(items))updates[`assetImages/${id}/${item.id}/primary`]=item.id===sid;
  await db.ref().update(updates);res.json({ok:true});
}));
router.delete('/:id/images/:imageId',wrap(async(req,res)=>{
  const id=validId(req.params.id),sid=validId(req.params.imageId);await assetById(id);
  const items=await obj(`assetImages/${id}`);if(!items[sid])throw assetError(404,'Không tìm thấy ảnh.');
  await imageBucket().file(items[sid].path).delete({ignoreNotFound:true});await db.ref(`assetImages/${id}/${sid}`).remove();res.json({ok:true});
}));

export async function publicAssetHandler(req,res,next){
  try {
    const id=validId(req.params.publicId);
    const internal=(await db.ref(`assetPublicIds/${id}`).get()).val();
    if(!internal)throw assetError(404,'Không tìm thấy tài sản.');
    const asset=(await db.ref(`assets/${validId(internal)}`).get()).val();
    if(!asset||asset.deletedAt)throw assetError(404,'Không tìm thấy tài sản.');
    const {cats,depts}=await catalogs();
    const enriched=enrichAsset(asset,cats,depts);
    // Public QR explicitly excludes name of holder, IP address, serial, cost and internal notes.
    res.json({publicId:id,assetCode:enriched.assetCode,assetName:enriched.assetName,
      categoryName:enriched.categoryName,ownerDepartmentName:enriched.ownerDepartmentName,status:enriched.status});
  }catch(err){next(err);}
}
export default router;
