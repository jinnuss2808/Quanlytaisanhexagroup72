import express from 'express';
import { getStorage } from 'firebase-admin/storage';
import { db } from './firebase.js';
import { isPrinterAsset } from './printer-core.js';
import {
  libError, libId, safeText, normalizeExternalUrl, normalizeLibraryFields,
  validateFile, buildStoragePath, SIGNED_URL_MS, getVisibleRow, hasPrinter,
} from './it-library-core.js';

// IMPORTANT: Mount behind requireIT in app.js. Do not expose this router publicly.
const router = express.Router();
const route = fn => (req,res,next) => Promise.resolve(fn(req,res,next)).catch(next);
const manager = (req,_res,next) => req.it?.role === 'manager' ? next() : next(libError(403,'Chỉ Admin IT được quản lý Thư viện IT.'));
const allRows = async path => (await db.ref(path).get()).val() || {};
const now = () => Date.now();
const nameOf = it => it.name || it.email || 'IT';
const AUDIT = 'itLibraryAudit';
const BKT_ERROR = 'Chưa cấu hình FIREBASE_STORAGE_BUCKET cho backend. Bạn vẫn có thể lưu liên kết HTTPS.';
function bucket() {
  const b = process.env.FIREBASE_STORAGE_BUCKET;
  if (!b || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{2,253}$/.test(b)) throw libError(503, BKT_ERROR);
  return getStorage().bucket(b);
}
const emitAudit = async (id, it, action, meta = {}) => {
  await db.ref(`${AUDIT}/${id}`).push({ action, byUid: it.uid, byName: nameOf(it), at: now(), ...meta });
};
async function verifyPrinters(ids) {
  for (const id of ids) {
    const snap = await db.ref(`assets/${id}`).get();
    if (!snap.exists() || snap.val().deletedAt || !isPrinterAsset(snap.val())) {
      throw libError(400, `Mã máy in không hợp lệ: ${id}`);
    }
  }
}
async function getItem(id, includeDeleted = false) {
  libId(id);
  const value = (await db.ref(`itLibraryItems/${id}`).get()).val();
  if (!value || (!includeDeleted && value.deletedAt)) throw libError(404, 'Không tìm thấy file trong Thư viện IT.');
  return value;
}
async function saveVersion(id, it, row, action) {
  const versionId = db.ref(`itLibraryVersions/${id}`).push().key;
  await db.ref(`itLibraryVersions/${id}/${versionId}`).set({
    at: now(), byUid: it.uid, byName: nameOf(it), action,
    version: row.version || '', filename: row.filename || '', size: row.size || null,
    kind: row.kind, externalUrl: row.kind === 'link' ? row.externalUrl : null,
    storagePath: row.kind === 'upload' ? row.storagePath : null,
  });
}

router.get('/items', route(async(req,res)=>{
  const items = Object.values(await allRows('itLibraryItems'))
    .filter(row=>!row.deletedAt)
    .filter(row=>!req.query.category||row.category===req.query.category)
    .filter(row=>!req.query.printerId||hasPrinter(row, libId(req.query.printerId)))
    .sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0))
    .map(getVisibleRow);
  res.json({items});
}));
router.get('/items/:id/history', route(async(req,res)=>{
  const item = await getItem(req.params.id);
  const [versions, audit] = await Promise.all([
    allRows(`itLibraryVersions/${item.id}`), allRows(`${AUDIT}/${item.id}`),
  ]);
  res.json({versions: Object.entries(versions).map(([id,{storagePath,externalUrl,...rest}])=>({id,...rest,available:!!(storagePath||externalUrl)})).sort((a,b)=>b.at-a.at),
    audit: Object.values(audit).sort((a,b)=>b.at-a.at).slice(0,100)});
}));
router.post('/items/link', manager, route(async(req,res)=>{
  const input = normalizeLibraryFields(req.body), url = normalizeExternalUrl(req.body?.url);
  await verifyPrinters(input.printerIds);
  const id = db.ref('itLibraryItems').push().key, timestamp=now();
  const row={id,...input,kind:'link',externalUrl:url,filename:'',size:null,revision:1,createdAt:timestamp,updatedAt:timestamp,createdBy:req.it.uid};
  await db.ref(`itLibraryItems/${id}`).set(row);
  await saveVersion(id,req.it,row,'created');
  await emitAudit(id,req.it,'created_link');
  res.status(201).json(getVisibleRow(row));
}));
router.patch('/items/:id', manager, route(async(req,res)=>{
  const old = await getItem(req.params.id), fields=normalizeLibraryFields(req.body);
  await verifyPrinters(fields.printerIds);
  const next={...old,...fields,updatedAt:now(),updatedBy:req.it.uid};
  if(old.kind==='link' && req.body.url !== undefined){next.externalUrl=normalizeExternalUrl(req.body.url);}
  else if(req.body.url !== undefined){throw libError(400,'Không thể thay URL của một file đã upload.');}
  // Atomically protect against concurrent changes or deleted files.
  const result=await db.ref(`itLibraryItems/${old.id}`).transaction(row=>{
    if(!row || row.deletedAt || row.revision !== old.revision)return;
    return {...next,revision:row.revision+1};
  },undefined,false);
  if(!result.committed)throw libError(409,'File đã được người khác sửa. Vui lòng tải lại danh sách.');
  const saved=result.snapshot.val();
  await saveVersion(old.id,req.it,saved,'metadata_updated');
  await emitAudit(old.id,req.it,'updated_metadata');
  res.json(getVisibleRow(saved));
}));
router.delete('/items/:id', manager, route(async(req,res)=>{
  const old=await getItem(req.params.id);
  const result=await db.ref(`itLibraryItems/${old.id}`).transaction(row=>{
    if(!row || row.deletedAt)return;
    return {...row,deletedAt:now(),deletedBy:req.it.uid};
  },undefined,false);
  if(!result.committed)throw libError(409,'File đã bị xóa.');
  await emitAudit(old.id,req.it,'archived');
  res.json({ok:true});
}));

// Two-phase signed upload avoids Vercel's 4.5 MB Function request limit.
router.post('/uploads', manager, route(async(req,res)=>{
  const fields=normalizeLibraryFields(req.body), file=validateFile(req.body?.file);
  await verifyPrinters(fields.printerIds);
  const replaceItemId=req.body?.replaceItemId ? libId(req.body.replaceItemId):null;
  const previous = replaceItemId ? await getItem(replaceItemId) : null;
  const id=db.ref('itLibraryPendingUploads').push().key;
  const storagePath=buildStoragePath(), expiresAt=now()+SIGNED_URL_MS;
  const pending={id,...fields,replaceItemId,replaceRevision:previous?.revision||null,storagePath,...file,createdAt:now(),expiresAt,ownerUid:req.it.uid,state:'pending'};
  const [signedUrl]=await bucket().file(storagePath).getSignedUrl({
    action:'write',version:'v4',expires:expiresAt,contentType:file.mime,
  });
  await db.ref(`itLibraryPendingUploads/${id}`).set(pending);
  res.status(201).json({uploadId:id,url:signedUrl,contentType:file.mime,expiresAt});
}));
router.post('/uploads/:uploadId/complete', manager, route(async(req,res)=>{
  const id=libId(req.params.uploadId);
  const uploadRef=db.ref(`itLibraryPendingUploads/${id}`);
  // Claim each upload once to prevent duplicate revisions when the browser retries.
  const claim=await uploadRef.transaction(old=>{
    if(!old || old.ownerUid!==req.it.uid || old.state==='done')return;
    if(old.state==='processing' && now()-(old.claimAt||0)<120_000)return;
    return {...old,state:'processing',claimAt:now()};
  },undefined,false);
  if(!claim.committed)throw libError(409,'Phiên upload đang được xác nhận hoặc đã hoàn tất.');
  const pending=claim.snapshot.val();
  try{
    if(now()>pending.expiresAt+60_000)throw libError(410,'Phiên upload đã hết hạn.');
    const storageFile=bucket().file(pending.storagePath);
    const [metadata]=await storageFile.getMetadata().catch(()=>{throw libError(409,'Chưa tải file lên Storage hoặc file không hợp lệ.');});
    if(Number(metadata.size)!==pending.length||metadata.contentType!==pending.mime){
      await storageFile.delete({ignoreNotFound:true}).catch(()=>{});
      throw libError(409,'Dung lượng hoặc loại file không khớp. File đã bị hủy.');
    }
    let row, action;
    if(pending.replaceItemId){
      const itemRef=db.ref(`itLibraryItems/${pending.replaceItemId}`);
      const result=await itemRef.transaction(old=>{
        if(!old||old.deletedAt||old.revision!==pending.replaceRevision)return;
        return { ...old,...normalizeLibraryFields(pending),kind:'upload',storagePath:pending.storagePath,
          filename:pending.filename,mimeType:pending.mime,size:pending.length,
          revision:old.revision+1,updatedAt:now(),updatedBy:req.it.uid };
      },undefined,false);
      if(!result.committed)throw libError(409,'File gốc đã thay đổi trong lúc upload. Hãy tải lại và thử lại.');
      row=result.snapshot.val();action='replaced_upload';
    } else {
      // Stable ID makes an upload retry idempotent; no duplicate entries.
      const itemId='lib_'+id;
      const itemRef=db.ref(`itLibraryItems/${itemId}`);
      const candidate={id:itemId,...normalizeLibraryFields(pending),kind:'upload',storagePath:pending.storagePath,
        filename:pending.filename,mimeType:pending.mime,size:pending.length,
        revision:1,createdAt:now(),updatedAt:now(),createdBy:req.it.uid,createdByName:nameOf(req.it)};
      const result=await itemRef.transaction(old=>old||candidate,undefined,false);
      row=result.snapshot.val();action='uploaded';
    }
    await saveVersion(row.id,req.it,row,action);
    await emitAudit(row.id,req.it,action,{filename:row.filename});
    await uploadRef.remove();
    res.status(201).json(getVisibleRow(row));
  }catch(error){
    await uploadRef.update({state:'pending',claimAt:null}).catch(()=>{});
    throw error;
  }
}));
// Allow viewing past file versions without disclosing private object paths.
router.get('/items/:id/versions/:versionId/download', route(async(req,res)=>{
  const item=await getItem(req.params.id),versionId=libId(req.params.versionId);
  const version=(await db.ref(`itLibraryVersions/${item.id}/${versionId}`).get()).val();
  if(!version)throw libError(404,'Phiên bản không tồn tại.');
  let url;
  if(version.kind==='link') url=version.externalUrl;
  else if(version.storagePath){
    [url]=await bucket().file(version.storagePath).getSignedUrl({action:'read',version:'v4',expires:now()+SIGNED_URL_MS});
  }else throw libError(404,'Phiên bản này chỉ thay đổi thông tin, không có file để tải.');
  await emitAudit(item.id,req.it,'download_version',{version:version.version||''});
  res.json({url});
}));
router.get('/items/:id/download', route(async(req,res)=>{
  const row=await getItem(req.params.id);
  let url;
  if(row.kind==='link') url=row.externalUrl;
  else {
    const safeFile = (row.filename || 'hexa-download').replace(/[^a-zA-Z0-9_.-]/g,'_').slice(0,100);
    [url] = await bucket().file(row.storagePath).getSignedUrl({action:'read',version:'v4',
      expires:now()+SIGNED_URL_MS,responseDisposition:`attachment; filename="${safeFile}"`});
  }
  await emitAudit(row.id,req.it,'download');
  res.json({url});
}));
export default router;
