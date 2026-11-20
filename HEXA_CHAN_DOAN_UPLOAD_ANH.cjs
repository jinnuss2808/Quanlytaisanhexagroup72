'use strict';
// HEXA asset-photo storage diagnostics. Target: project containing frontend/ and backend/.
// Check-only mode is read-only. Idempotent. Backups are outside of the Git working tree.
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const root=__dirname;
const check=process.argv.includes('--check');
const MARK='HEXA_STORAGE_UPLOAD_DIAG_V1';
const sourceNames=['backend/src/asset-api.js','backend/src/app.js','frontend/src/AssetManagement.jsx'];
const helperRel='backend/src/asset-photo-storage-diagnostics.mjs';
const helperSource=path.join(__dirname,'asset-photo-storage-diagnostics.mjs');
function replaceOne(src,old,replacement,label){
 const n=src.split(old).length-1;if(n!==1)throw Error(`${label}: tìm được ${n} vị trí (cần đúng 1), không ghi đè.`);
 return src.replace(old,replacement);
}
function addBackend(src){
 const header=`// ${MARK}\nimport { storageBucketName, classifyStorageFailure } from './asset-photo-storage-diagnostics.mjs';\n`;
 if(!src.includes("import { getStorage } from 'firebase-admin/storage';"))throw Error('Không thấy Firebase Storage import trong backend/src/asset-api.js');
 src=src.replace("import { getStorage } from 'firebase-admin/storage';", "import { getStorage } from 'firebase-admin/storage';\n"+header);
 const rex=/function imageBucket\(\)\{[\s\S]*?\n\}/;
 if(!rex.test(src))throw Error('Không tìm thấy hàm imageBucket() trong backend/src/asset-api.js');
 const bucket=`function imageBucket(){
  return getStorage().bucket(storageBucketName(process.env.FIREBASE_STORAGE_BUCKET));
}
// Only authenticated HEXA managers can check bucket metadata; never writes data.
router.get('/photo-storage/status',requireManager,wrap(async(_req,res)=>{
  try {
    const bucket=imageBucket();
    await bucket.getMetadata();
    res.set('Cache-Control','no-store');
    res.json({ok:true,code:'STORAGE_BUCKET_ACCESSIBLE',message:'Đã kiểm tra: bucket tồn tại và backend có quyền đọc metadata. Quyền ghi ảnh cần thử bằng upload thực tế.'});
  } catch(err){
    const safe=classifyStorageFailure(err,'check');
    console.error('[HEXA_PHOTO_STORAGE_CHECK]',{code:safe.publicCode,sourceCode:String(err?.code??err?.statusCode??'').slice(0,40)});
    throw safe;
  }
}));`;
 src=src.replace(rex,bucket);
 const a=src.indexOf("router.post('/:id/images',");
 const b=src.indexOf("router.get('/:id/images/:imageId/file',",a);
 if(a<0||b<0)throw Error('Không tìm được POST images hoặc GET image file');
 let upload=src.slice(a,b);
 const hasWrappedSave=/try\s*\{\s*await imageBucket\(\)\.file\(path\)\.save\(/.test(upload);
 if(hasWrappedSave){
   const r=/  try \{\s*await imageBucket\(\)\.file\(path\)\.save\(bytes,\{resumable:false,contentType:mime,metadata:\{cacheControl:'private, max-age=0'\}\}\);\s*\} catch\(err\) \{[\s\S]*?\n  \}/;
   if(!r.test(upload))throw Error('Đã có try/catch ảnh, nhưng cấu trúc khác; dừng an toàn.');
   upload=upload.replace(r,`  try {
    await imageBucket().file(path).save(bytes,{resumable:false,contentType:mime,metadata:{cacheControl:'private, max-age=0'}});
  } catch(err) {
    const safe=classifyStorageFailure(err,'write');
    console.error('[HEXA_PHOTO_STORAGE_WRITE]',{code:safe.publicCode,sourceCode:String(err?.code??err?.statusCode??'').slice(0,40)});
    throw safe;
  }`);
 } else {
   upload=replaceOne(upload,"  await imageBucket().file(path).save(bytes,{resumable:false,contentType:mime,metadata:{cacheControl:'private, max-age=0'}});",`  try {
    await imageBucket().file(path).save(bytes,{resumable:false,contentType:mime,metadata:{cacheControl:'private, max-age=0'}});
  } catch(err) {
    const safe=classifyStorageFailure(err,'write');
    console.error('[HEXA_PHOTO_STORAGE_WRITE]',{code:safe.publicCode,sourceCode:String(err?.code??err?.statusCode??'').slice(0,40)});
    throw safe;
  }`,'save Storage');
 }
 src=src.slice(0,a)+upload+src.slice(b);
 const d=src.indexOf("router.get('/:id/images/:imageId/file',");
 const e=src.indexOf("router.patch('/:id/images/:imageId/primary',",d);
 if(d<0||e<0)throw Error('Không tìm được GET image download');
 let dl=src.slice(d,e);
 const oldTry=/  let bytes;\s*try \{ \[bytes\]=await imageBucket\(\)\.file\(image\.path\)\.download\(\); \}\s*catch\(err\) \{[\s\S]*?\n  \}/;
 if(oldTry.test(dl)){
   dl=dl.replace(oldTry,`  let bytes;
  try { [bytes]=await imageBucket().file(image.path).download(); }
  catch(err) { throw classifyStorageFailure(err,'read'); }`);
 } else if(dl.includes("  const [bytes]=await imageBucket().file(image.path).download();")) {
   dl=replaceOne(dl,"  const [bytes]=await imageBucket().file(image.path).download();",`  let bytes;
  try { [bytes]=await imageBucket().file(image.path).download(); }
  catch(err) { throw classifyStorageFailure(err,'read'); }`,'download Storage');
 } else throw Error('Không tìm được đoạn download ảnh, dừng an toàn.');
 src=src.slice(0,d)+dl+src.slice(e);
 return src;
}
function addErrorHandler(src){
 if(!src.includes('const safeLibraryMessage ='))throw Error('Không tìm được lỗi tập trung trong app.js');
 src=replaceOne(src,
   '  const publicMessage = status >= 500 && !safeLibraryMessage',
   `  // ${MARK}: Allow only known-safe photo-storage messages for authenticated asset API.
  const isPhotoRequest = new RegExp('^/api/assets/(?:[^/]+/images(?:/|$)|photo-storage/status(?:/|$))').test(String(req.originalUrl||''));
  const safePhotoMessage = isPhotoRequest && err?.expose === true;
  const photoTraceId = isPhotoRequest && status >= 500 ? 'IMG-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2,6).toUpperCase() : '';
  if (photoTraceId) console.error('[HEXA_IMAGE_TRACE]', {traceId:photoTraceId, status, code:String(err?.publicCode||err?.code||'unknown').slice(0,60)});
  const publicMessage = status >= 500 && !safeLibraryMessage && !safePhotoMessage`, 'app.js error exposure');
 src=replaceOne(src, "? (traceId ? 'Thư viện IT gặp lỗi tại API (mã ' + traceId + '). Xem log backend/Vercel theo mã lỗi này.' : 'Lỗi hệ thống. Vui lòng thử lại.')", "? (traceId ? 'Thư viện IT gặp lỗi tại API (mã ' + traceId + '). Xem log backend/Vercel theo mã lỗi này.' : (photoTraceId ? 'Lỗi xử lý ảnh (mã '+photoTraceId+'). Xem Vercel Runtime Logs theo mã này.' : 'Lỗi hệ thống. Vui lòng thử lại.'))", 'app.js trace text');
 src=replaceOne(src,'  res.status(status).json({ error: publicMessage });',`  res.status(status).json({ error: publicMessage, ...(safePhotoMessage ? {code:err.publicCode} : {}), ...(photoTraceId ? {traceId:photoTraceId} : {}) });`,'app.js JSON response');
 return src;
}
function addFrontend(src){
 const anchor="  const [photoNotice,setPhotoNotice]=useState('');";
 if(src.includes(anchor))src=replaceOne(src,anchor,anchor+`\n  // ${MARK}\n  const [storageStatus,setStorageStatus]=useState('');`,'storageStatus state');
 else {
   const x="  const [name,setName]=useState(''),[version,setVersion]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[addMaintenance,setAddMaintenance]=useState(false);";
   src=replaceOne(src,x,x+`\n  // ${MARK}\n  const [storageStatus,setStorageStatus]=useState('');`,'storageStatus state');
 }
 const before="  const removeImage=async im=>";
 src=replaceOne(src,before,`  const checkImageStorage=async()=>{
    setStorageStatus('Đang kiểm tra Firebase Storage...');
    try {const state=await api('/assets/photo-storage/status');setStorageStatus(state.message||'Firebase Storage đã sẵn sàng.');}
    catch(err){setStorageStatus(err.message||'Không kiểm tra được Firebase Storage.');}
  };
`+before,'check Storage action');
 const label='<label className="am-btn am-primary"><ImagePlus size={15}/> Thêm ảnh';
 src=replaceOne(src,label,`<button className="am-btn am-light" type="button" onClick={checkImageStorage} disabled={busy}>Kiểm tra Storage</button>`+label,'image tab button');
 const grid='<div className="am-photo-grid">{images.map(img=>';
 src=replaceOne(src,grid,`{storageStatus&&<p className="am-photo-notice" role="status" style={{margin:'8px 0',padding:'9px 12px',borderRadius:8,background:'#eef9f5',color:'#125a51',fontWeight:600}}>{storageStatus}</p>}\n        `+grid,'photo status display');
 return src;
}
try{
 if(!fs.existsSync(helperSource))throw Error('Thiếu asset-photo-storage-diagnostics.mjs trong cùng thư mục script');
 const old={};for(const rel of sourceNames){const file=path.join(root,rel);if(!fs.existsSync(file))throw Error(`Không thấy ${rel}. Hãy giải nén cả ZIP vào thư mục gốc HEXA.`);old[rel]=fs.readFileSync(file,'utf8');}
 const done=sourceNames.every(n=>old[n].includes(MARK))&&fs.existsSync(path.join(root,helperRel));
 if(done){console.log('[OK] Mã chẩn đoán upload ảnh đã được cập nhật.');process.exit(0);}
 if(sourceNames.some(n=>old[n].includes(MARK))||fs.existsSync(path.join(root,helperRel)))throw Error('Mã đã được cập nhật một phần. Không tự ghi đè; cần kiểm tra thủ công.');
 const next={
 'backend/src/asset-api.js':addBackend(old['backend/src/asset-api.js']),
 'backend/src/app.js':addErrorHandler(old['backend/src/app.js']),
 'frontend/src/AssetManagement.jsx':addFrontend(old['frontend/src/AssetManagement.jsx'])
 };
 if(check){console.log('[CHECK OK] Có thể sửa backend/src/{asset-api,app}.js, frontend/src/AssetManagement.jsx và thêm module chẩn đoán Storage.');process.exit(0);}
 const backup=path.join(os.homedir(),'HEXA-PATCH-BACKUPS','STORAGE-ANH-'+new Date().toISOString().replace(/[:.]/g,'-'));
 fs.mkdirSync(backup,{recursive:true});for(const rel of sourceNames){const out=path.join(backup,rel);fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,old[rel]);}
 try{
   for(const rel of sourceNames)fs.writeFileSync(path.join(root,rel),next[rel],'utf8');
   fs.copyFileSync(helperSource,path.join(root,helperRel));
 }catch(e){for(const rel of sourceNames)fs.writeFileSync(path.join(root,rel),old[rel],'utf8');try{fs.unlinkSync(path.join(root,helperRel))}catch{}throw e;}
 console.log('[OK] Cập nhật chẩn đoán Storage. Đã sao lưu: '+backup);
 console.log('Chạy npm test/backend và npm run build/frontend, deploy backend trước frontend.');
}catch(e){console.error('[STOP] '+e.message);process.exitCode=1;}
