import express from 'express';
import { db } from './firebase.js';
import { assetError, asText, normalizeAsset, keyForCode, assetUUID, prepareAssetStatusEdit, enrichAsset, selectAssets, parseCSV, mapLegacyCSV, toCSV } from './asset-core.js';
import { transactExistingTicket as conditionalUpdate } from './ticket-transaction.js';
import { readAssetExcel,writeAssetExcel } from './asset-excel.js';
import { prepareExcelImport } from './asset-xlsx-import.js';
import { quantity,stockChange } from './warehouse-core.js';
import { isPrinterAsset, validatePrinterToner, normalizePrinterDetails } from './printer-core.js';
import { listPrinterActivity } from './printer-activity.js';
import { auditChanges, lowStockItems, assetReport, resolveStocktakeAsset, stocktakeProgress } from './asset-ops.js';
import { collectInventoryBackup, zippedInventoryBackup } from './asset-backup.js';
import { recordStockThreshold } from './stock-alerts.js';

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

// Reporting, stocktakes and backups: static endpoints must precede '/:id'.
router.get('/reports/summary',wrap(async(_req,res)=>{
 const [all,departments,categories]=await Promise.all([obj('assets'),obj('assetDepartments'),obj('assetCategories')]);
 res.json(assetReport(all,categories,departments));
}));
router.get('/stocktakes',wrap(async(_req,res)=>{
 const all=await obj('assetStocktakes');
 res.json({items:Object.values(all).map(x=>({...x,expected:undefined,scans:undefined,
   ...stocktakeProgress(x)})).map(x=>({...x,missingAssets:undefined,foundAssets:undefined}))
  .sort((a,b)=>b.createdAt-a.createdAt).slice(0,100)});
}));
router.post('/stocktakes',requireManager,wrap(async(req,res)=>{
 const ownerDepartmentId=asText(req.body?.ownerDepartmentId,128);
 const name=asText(req.body?.name,150)||`Kiểm kê ngày ${new Date().toLocaleDateString('vi-VN')}`;
 const rows=Object.values(await obj('assets')).filter(a=>a&&!a.deletedAt&&(!ownerDepartmentId||a.ownerDepartmentId===ownerDepartmentId));
 if(rows.length>10000)throw assetError(413,'Đợt kiểm kê tối đa 10.000 tài sản.');
 const id='st_'+assetUUID().replaceAll('-','');
 const expected=Object.fromEntries(rows.map(a=>[a.id,{assetCode:a.assetCode,assetName:a.assetName}]));
 const row={id,name,ownerDepartmentId:ownerDepartmentId||null,createdAt:Date.now(),createdBy:req.it.uid,createdByName:req.it.name||req.it.email,
  closedAt:null,expected,scans:{}};
 await db.ref(`assetStocktakes/${id}`).set(row);
 res.status(201).json({...row,...stocktakeProgress(row),expected:undefined,scans:undefined});
}));
router.get('/stocktakes/:id',wrap(async(req,res)=>{
 const id=validId(req.params.id),session=(await db.ref(`assetStocktakes/${id}`).get()).val();
 if(!session)throw assetError(404,'Không tìm thấy đợt kiểm kê.');
 res.json({...session,...stocktakeProgress(session,await obj('assets')),expected:undefined,scans:undefined});
}));
router.post('/stocktakes/:id/scan',wrap(async(req,res)=>{
 const id=validId(req.params.id),code=req.body?.code;
 // Resolve from server-side records; the client cannot claim an arbitrary asset as scanned.
 const [assets,publicIds,indices]=await Promise.all([obj('assets'),obj('assetPublicIds'),obj('assetCodeIndex')]);
 const asset=resolveStocktakeAsset(code,assets,publicIds,indices);
 const ref=db.ref(`assetStocktakes/${id}`);
 let reason='Không thể ghi nhận kiểm kê.';
 const tx=await conditionalUpdate(ref,old=>{
   if(!old){reason='Không tìm thấy đợt kiểm kê.';return undefined;}
   if(old.closedAt){reason='Đợt kiểm kê đã kết thúc.';return undefined;}
   if(!old.expected?.[asset.id]){reason='Tài sản không thuộc đợt kiểm kê này.';return undefined;}
   if(old.scans?.[asset.id]){reason='Tài sản này đã được kiểm kê.';return undefined;}
   return {...old,scans:{...(old.scans||{}),[asset.id]:{assetId:asset.id,at:Date.now(),byUid:req.it.uid,byName:req.it.name||req.it.email}}};
 });
 if(!tx.committed)throw assetError(409,reason);
 res.json({ok:true,asset:{id:asset.id,assetCode:asset.assetCode,assetName:asset.assetName},...stocktakeProgress(tx.snapshot.val())});
}));
router.post('/stocktakes/:id/close',requireManager,wrap(async(req,res)=>{
 const id=validId(req.params.id),ref=db.ref(`assetStocktakes/${id}`);
 const tx=await conditionalUpdate(ref,old=>old&&!old.closedAt?{...old,closedAt:Date.now(),closedBy:req.it.uid}:undefined);
 if(!tx.committed)throw assetError(409,'Không thể kết thúc đợt kiểm kê.');
 res.json({ok:true,...stocktakeProgress(tx.snapshot.val())});
}));
router.get('/backups/status',requireManager,wrap(async(_req,res)=>{
 res.json({lastRun:(await db.ref('inventoryBackupRuns/latest').get()).val()||null,
  autoBackupRequires:'Firebase Blaze, Cloud Functions Scheduler và HEXA_BACKUP_BUCKET'});
}));
router.get('/backups/download',requireManager,wrap(async(_req,res)=>{
 const archive=zippedInventoryBackup(await collectInventoryBackup(db));
 if(archive.length>8*1024*1024)throw assetError(413,'Bản sao lưu vượt kích thước tải trực tiếp. Dùng Cloud Backup vào Storage.');
 res.set('Content-Type','application/gzip');
 res.set('Content-Disposition',`attachment; filename="HEXA-Inventory-${new Date().toISOString().slice(0,10)}.json.gz"`);
 res.send(archive);
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
// Nhật ký tập trung cho tất cả máy in: chỉ đọc sự kiện đã lưu, không trừ kho lần nữa.
// Đặt trước các route động /:id để tránh xung đột với đường dẫn API.
router.get('/printers/activity',wrap(async(req,res)=>{
  const [assets,maintenance,{cats,depts}]=await Promise.all([
    obj('assets'),obj('assetMaintenance'),catalogs()
  ]);
  // Giữ lịch sử máy in đã đưa vào thùng rác để có thể tra cứu/audit.
  const printers=Object.values(assets).map(item=>enrichAsset(item,cats,depts)).filter(isPrinterAsset);
  const result=listPrinterActivity(printers,maintenance,{
    kind:req.query.kind,search:req.query.search,page:req.query.page,pageSize:req.query.pageSize
  });
  res.json(result);
}));

// Printer fleet is a view over existing asset records; no duplicated device database.
router.get('/printers',wrap(async(_req,res)=>{
  const [assets,{cats,depts}]=await Promise.all([obj('assets'),catalogs()]);
  const items=Object.values(assets).filter(a=>!a.deletedAt)
    .map(a=>enrichAsset(a,cats,depts)).filter(isPrinterAsset)
    .sort((a,b)=>String(a.assetCode).localeCompare(String(b.assetCode),'vi'));
  res.json({items,total:items.length});
}));
// Thêm máy in trực tiếp: vẫn là một tài sản dùng chung, tránh tạo hai nguồn dữ liệu.
router.post('/printers',wrap(async(req,res)=>{
  const body=req.body||{};
  const {cats,depts}=await catalogs();
  const inkId=asText(body.tonerStockItemId,128);
  let ink=null;
  if(inkId){
    validId(inkId);
    ink=(await db.ref(`warehouseStock/${inkId}`).get()).val();
    if(!ink||ink.deletedAt||ink.category!=='ink')throw assetError(400,'Loại mực đã chọn không còn trong kho.');
  }
  const details=normalizePrinterDetails({...body,tonerType:asText(body.tonerType,120)||ink?.name||''});
  const categoryId=asText(body.categoryId,128)||Object.entries(cats)
    .find(([,cat])=>isPrinterAsset({categoryName:cat.name,categoryCode:cat.code}))?.[0]||null;
  const assetCode=asText(body.assetCode,100)||('PRN-'+assetUUID().replaceAll('-','').slice(0,10).toUpperCase());
  const data=normalizeAsset({...details,assetCode,categoryId,status:'available',assignedTo:null});
  await checkCatalog(data);
  const id='a_'+assetUUID();
  await reserve(data.assetCode,id);
  const now=Date.now();
  const record={...data,id,publicId:assetUUID(),assetType:'printer',isPrinter:true,
    tonerType:details.tonerType,tonerStockItemId:details.tonerStockItemId,location:details.location,
    createdAt:now,updatedAt:now,createdBy:req.it.uid};
  try{await db.ref().update({[`assets/${id}`]:record,[`assetPublicIds/${record.publicId}`]:id});}
  catch(err){await db.ref('assetCodeIndex/'+keyForCode(data.assetCode)).remove().catch(()=>{});throw err;}
  await addLog(id,'created',req.it,{summary:`Thêm máy in ${data.assetCode}`,tonerType:details.tonerType});
  res.status(201).json(enrichAsset(record,cats,depts));
}));

// Sửa cấu hình máy in, giữ nguyên công ty sở hữu, mã tài sản và lịch sử.
router.patch('/printers/:id',wrap(async(req,res)=>{
  const id=validId(req.params.id);
  const old=await assetById(id);
  const {cats,depts}=await catalogs();
  if(!isPrinterAsset(enrichAsset(old,cats,depts)))throw assetError(400,'Tài sản này không phải máy in.');
  const inkId=asText(req.body?.tonerStockItemId,128);
  let ink=null;
  if(inkId){
    validId(inkId);
    ink=(await db.ref(`warehouseStock/${inkId}`).get()).val();
    if(!ink||ink.deletedAt||ink.category!=='ink')throw assetError(400,'Loại mực đã chọn không còn trong kho.');
  }
  const details=normalizePrinterDetails({...old,...req.body,tonerType:asText(req.body?.tonerType,120)||ink?.name||old.tonerType||''});
  if(details.ownerDepartmentId!==old.ownerDepartmentId && req.it.role!=='manager')
    throw assetError(403,'Chỉ Admin được thay đổi công ty sở hữu.');
  await checkCatalog({...old,...details});
  const updated=await edited(id,current=>{
    if(current.updatedAt!==old.updatedAt)throw assetError(409,'Máy in vừa được nhân viên khác cập nhật.');
    return {...current,...details,isPrinter:true,assetType:'printer',updatedAt:Date.now()};
  });
  await addLog(id,'updated',req.it,{summary:'Cập nhật thông tin máy in',changes:auditChanges(old,updated)});
  res.json(enrichAsset(updated,cats,depts));
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
  const previousAssignee=asText(old.assignedTo,255)||null;
  if (Object.prototype.hasOwnProperty.call(req.body||{},'assignedTo') &&
      (asText(req.body.assignedTo,255)||null)!==previousAssignee)
    throw assetError(409,'Để thay đổi người sử dụng, hãy Bàn giao/Thu hồi.');
  const transition=prepareAssetStatusEdit(old,data.status);
  // Keep company ownership immutable except via explicitly authorized manager update.
  if(req.it.role!=='manager'&&data.ownerDepartmentId!==old.ownerDepartmentId)throw assetError(403,'Chỉ Admin được thay đổi công ty sở hữu.');
  await checkCatalog(data);
  if(data.assetCode!==old.assetCode)await reserve(data.assetCode,id);
  let changed;
  try {changed=await edited(id,current=>{
      if(current.updatedAt!==old.updatedAt)throw assetError(409,'Tài sản vừa được người khác sửa.');
      return {...current,...data,assignedTo:transition.assignedTo,updatedAt:Date.now()};
    });}
  catch(err){if(data.assetCode!==old.assetCode)await db.ref('assetCodeIndex/'+keyForCode(data.assetCode)).remove().catch(()=>{});throw err;}
  if(data.assetCode!==old.assetCode)await db.ref('assetCodeIndex/'+keyForCode(old.assetCode)).remove();
  if(transition.recoveredAssignee){
    const records=await obj(`assetAssignments/${id}`);
    const ongoing=Object.values(records).filter(x=>!x.returnedAt)
      .sort((a,b)=>(b.assignedAt||0)-(a.assignedAt||0))[0];
    if(ongoing){
      await db.ref(`assetAssignments/${id}/${ongoing.id}`).update({
        returnedAt:Date.now(),returnedDate:new Date().toISOString().slice(0,10),
        returnedBy:req.it.uid,returnNote:'Thu hồi người sử dụng cũ khi khôi phục tài sản về Có sẵn'
      });
    }
  }
  await addLog(id,'updated',req.it,{summary:transition.recoveredAssignee
    ?'Khôi phục về Có sẵn và thu hồi người sử dụng cũ':'Đã sửa thông tin tài sản',
    changes:auditChanges(old,changed)});res.json(changed);
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
  const name=asText(req.body?.assignedTo,255),date=asText(req.body?.date,10),note=asText(req.body?.note,1000),userDepartment=asText(req.body?.userDepartment,100);
  if(!name)throw assetError(400,'Vui lòng nhập người nhận tài sản.');
  if(date&&!/^\d{4}-\d{2}-\d{2}$/.test(date))throw assetError(400,'Ngày bàn giao không hợp lệ.');
  const result=await edited(id,old=>{
    if(old.status==='using'||old.assignedTo)throw assetError(409,'Tài sản đang được sử dụng, hãy thu hồi trước.');
    if(old.status!=='available')throw assetError(409,'Chỉ được bàn giao tài sản ở trạng thái Có sẵn.');
    return {...old,status:'using',assignedTo:name,userDepartment:userDepartment||old.userDepartment||null,updatedAt:Date.now()};
  });
  const key=db.ref(`assetAssignments/${id}`).push().key;
  await db.ref(`assetAssignments/${id}/${key}`).set({id:key,assignedTo:name,date:date||new Date().toISOString().slice(0,10),note,userDepartment,assignedAt:Date.now(),assignedBy:req.it.uid});
  await addLog(id,'assigned',req.it,{summary:`Bàn giao cho ${name}`,note,userDepartment});res.json(result);
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
// Record an exactly-one-toner printer refill, with an idempotent inventory movement.
// An operationId repeated after an interrupted request will never decrement twice.
router.post('/:id/printer/toner',wrap(async(req,res)=>{
  const id=validId(req.params.id);
  const raw=await assetById(id), {cats,depts}=await catalogs();
  const printer=enrichAsset(raw,cats,depts);
  const operationId=asText(req.body?.operationId,100);
  const stockItemId=asText(req.body?.stockItemId,128);
  const movementId='printer_toner_'+operationId;
  const eventId='pt_'+operationId;
  const eventRef=db.ref(`assetMaintenance/${id}/${eventId}`);
  const done=(await eventRef.get()).val();
  if(done) return res.json({ok:true,alreadyProcessed:true,event:done});
  const stockRef=db.ref(`warehouseStock/${validId(stockItemId)}`);
  const stock=(await stockRef.get()).val();
  const input=validatePrinterToner({printer,stock,stockItemId,operationId,notes:req.body?.notes});
  const date=asText(req.body?.date,10)||new Date().toISOString().slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw assetError(400,'Ngày đổ mực không hợp lệ.');
  const now=Date.now();
  const tx=await conditionalUpdate(stockRef,old=>{
    if(!old || old.category!=='ink' || old.deletedAt) throw assetError(409,'Loại mực đã bị thay đổi trong kho.');
    if(old.movements?.[movementId] && old.movements[movementId].assetId !== id) {
      throw assetError(409,'Mã thao tác đã được dùng cho máy in khác.');
    }
    return stockChange(old,{type:'issue',amount:1,recipient:`Đổ mực máy in ${printer.assetCode}`,
      reason:'Đổ mực máy in '+printer.assetCode,assetId:id,performedBy:req.it.name||req.it.email,
      date,opId:movementId});
  });
  if(!tx.committed) throw assetError(409,'Không cập nhật được tồn kho, vui lòng thử lại.');
  const current=tx.snapshot.val();
  if(!current.movements?.[movementId]) throw assetError(409,'Không tìm thấy phiếu xuất mực.');
  await recordStockThreshold({...current,quantity:current.movements[movementId].before},current);
  // This multi-path write is idempotent and can be retried using the same operationId.
  const event={id:eventId,type:'replace_toner',summary:`Đổ 1 ${current.unit||'hộp'} ${current.name}`,
    notes:input.notes,date,cost:Number(current.unitPrice||0),performedBy:req.it.name||req.it.email,
    byUid:req.it.uid,byName:req.it.name||req.it.email,at:now,
    stockItemId,stockSku:current.sku,stockName:current.name,stockQuantity:1,
    inventoryOperationId:movementId};
  const logId='pr_'+operationId;
  await db.ref().update({
    [`assetMaintenance/${id}/${eventId}`]:event,
    [`assetHistory/${id}/${logId}`]:{id:logId,action:'replace_toner',summary:event.summary,
      byUid:req.it.uid,byName:req.it.name||req.it.email,at:now,maintenanceId:eventId}
  });
  res.status(201).json({ok:true,stockRemaining:current.quantity,event});
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
    const afterStock=result.snapshot.val();
    await recordStockThreshold({...afterStock,quantity:afterStock.movements?.[operation]?.before},afterStock);
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
router.get('/qr/:publicId/private',wrap(async(req,res)=>{
  const publicId=validId(req.params.publicId);
  const id=(await db.ref(`assetPublicIds/${publicId}`).get()).val();
  if(!id)throw assetError(404,'Không tìm thấy tài sản.');
  const asset=await assetById(validId(id));
  const {cats,depts}=await catalogs();
  const info=enrichAsset(asset,cats,depts);
  res.set('Cache-Control','private, no-store');
  res.json({assetCode:info.assetCode,assetName:info.assetName,categoryName:info.categoryName,
    ownerDepartmentName:info.ownerDepartmentName,status:info.status,
    assignedTo:info.assignedTo||null,userDepartment:info.userDepartment||null,
    ipAddress:info.ipAddress||null,serialNumber:info.serialNumber||null});
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
