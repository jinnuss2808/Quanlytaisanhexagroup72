'use strict';
/**
 * HEXA - remove asset photo feature without touching Firebase data or QR label.
 * Run: node GO_CHUC_NANG_ANH_TAI_SAN_HEXA.cjs --check
 *      node GO_CHUC_NANG_ANH_TAI_SAN_HEXA.cjs
 * Uses source signatures of current HEXA asset pages, refuses unknown variants.
 */
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const MARK='HEXA_REMOVE_ASSET_PHOTOS_20261120';
const CHECK = process.argv.includes('--check');
const root=__dirname;
const relFrontend='frontend/src/AssetManagement.jsx';
const relBackend='backend/src/asset-api.js';
const relApp='backend/src/app.js';
const optionalFiles=['frontend/src/asset-photo-upload.js','backend/src/asset-photo-storage-diagnostics.mjs'];
function fail(msg){console.error('[STOP] '+msg);process.exitCode=1;throw new Error(msg);}
function required(p){const f=path.join(root,p);if(!fs.existsSync(f))fail('Khong thay '+p+'. Hay chep script vao thu muc goc HEXA, cung cap backend va frontend.');return fs.readFileSync(f,'utf8');}
function changeBlock(s,start,end,replacement='',label=''){
  const a=s.indexOf(start);
  if(a<0) return s;
  const b=s.indexOf(end,a+start.length);
  if(b<0)fail('Khong thay moc ket thuc '+label+' (file da thay doi). Khong ghi de.');
  return s.slice(0,a)+replacement+s.slice(b);
}
function patchFrontend(input){
  let s=input;
  if(s.includes('function AssetPhoto('))s=changeBlock(s,'function AssetPhoto(', 'function MaintenanceEditor(', '', 'AssetPhoto');
  s=s.replace(/^import\s*\{\s*prepareAssetPhoto\s*\}\s*from\s*['"]\.\/asset-photo-upload\.js['"];?\r?\n/m,'');
  s=s.replace(/\bImagePlus,\s*/g,'');
  s=s.replace(/,\[images,setImages\]=useState\(\[\]\)/g,'');
  s=s.replace(/^\s*const \[photoNotice,setPhotoNotice\]=useState\([^\n]*\);\s*\r?\n/gm,'');
  s=s.replace(/^\s*\/\/ HEXA_STORAGE_UPLOAD_DIAG_V1\s*\r?\n/gm,'');
  s=s.replace(/^\s*const \[storageStatus,setStorageStatus\]=useState\([^\n]*\);\s*\r?\n/gm,'');
  const oldReload=/if\s*\(!item\.deletedAt\)\s*\{\s*const\s*\[s,i\]\s*=\s*await\s+Promise\.all\(\[api\(`\/assets\/\$\{item\.id\}\/software`\),api\(`\/assets\/\$\{item\.id\}\/images`\)\]\);\s*setSoftware\(s\);\s*setImages\(i\);\s*\}/;
  s=s.replace(oldReload,"if(!item.deletedAt){const softwareItems=await api(`/assets/${item.id}/software`);setSoftware(softwareItems);}");
  // For source version that changed names, fail early rather than leave broken references.
  if(s.includes('const upload=async e=>{const file=e.target.files')){
    s=changeBlock(s,'  const upload=async e=>{const file=e.target.files','  const removeSoftware=', '', 'upload/removeImage');
  }
  s=s.replace(/,\['images','Hình ảnh'\]/g,'');
  if(s.includes("{tab==='images'&&"))s=changeBlock(s,"      {tab==='images'&&","      {tab==='qr'&&",'', 'photo JSX');
  s=s.replace(/Ảnh gửi lên quá lớn\. Hãy dùng ảnh nhỏ hơn\./g,'Dữ liệu gửi lên vượt giới hạn cho phép.');
  s=s.replace(/khi tải ảnh\./g,'khi gọi API.');
  const prohibited=["function AssetPhoto(","/assets/${item.id}/images", "{tab==='images'&&", "['images','Hình ảnh']", "prepareAssetPhoto", 'setImages(', 'ImagePlus', 'photoNotice','storageStatus','checkImageStorage','removeImage='];
  const remain=prohibited.filter(t=>s.includes(t));
  if(remain.length)fail('Frontend con tham chieu anh khong ro: '+remain.join(', '));
  return s;
}
function patchBackend(input){
  let s=input;
  s=s.replace(/^import\s*\{\s*getStorage\s*\}\s*from\s*['"]firebase-admin\/storage['"];?\s*\r?\n/m,'');
  s=s.replace(/^\/\/ HEXA_STORAGE_UPLOAD_DIAG_V1\s*\r?\n/gm,'');
  s=s.replace(/^import\s*\{\s*storageBucketName\s*,\s*classifyStorageFailure\s*\}\s*from\s*['"]\.\/asset-photo-storage-diagnostics\.mjs['"];?\s*\r?\n/m,'');
  if(s.includes('// Optional Firebase Storage images.')){
    const qrStart="router.get('/qr/:publicId/private'";
    if(s.indexOf(qrStart)>s.indexOf('// Optional Firebase Storage images.')){
      s=changeBlock(s,'// Optional Firebase Storage images.',qrStart,'', 'imageBucket/storage status');
    } else {
      s=changeBlock(s,'// Optional Firebase Storage images.','export async function publicAssetHandler','', 'asset image routes');
    }
  }
  if(s.includes("router.get('/:id/images'")){
    s=changeBlock(s,"router.get('/:id/images'",'export async function publicAssetHandler','', 'image endpoints');
  }
  const prohibited=['getStorage()', 'imageBucket(', 'assetImages/', "router.get('/:id/images'", "router.post('/:id/images'", 'photo-storage/status', 'classifyStorageFailure'];
  const remain=prohibited.filter(t=>s.includes(t));
  if(remain.length)fail('Backend con tham chieu anh: '+remain.join(', '));
  return s;
}
function patchApp(input){
  let s=input;
  if(s.includes('// HEXA_STORAGE_UPLOAD_DIAG_V1:')){
    s=changeBlock(s,'  // HEXA_STORAGE_UPLOAD_DIAG_V1:', '  const publicMessage =', '', 'app photo error handler');
    s=s.replace('status >= 500 && !safeLibraryMessage && !safePhotoMessage','status >= 500 && !safeLibraryMessage');
    s=s.replace(/: \(photoTraceId \? 'Lỗi xử lý ảnh \(mã '\+photoTraceId\+'\)\. Xem Vercel Runtime Logs theo mã này\.' : 'Lỗi hệ thống\. Vui lòng thử lại\.'\)/, ": 'Lỗi hệ thống. Vui lòng thử lại.'");
    s=s.replace('res.status(status).json({ error: publicMessage, ...(safePhotoMessage ? {code:err.publicCode} : {}), ...(photoTraceId ? {traceId:photoTraceId} : {}) });','res.status(status).json({ error: publicMessage });');
    s=s.replace('res.status(status).json({ error: publicMessage, ...(safePhotoMessage ? {code:err.publicCode} : {}), ...(photoTraceId ? {traceId:photoTraceId} : {}) });','res.status(status).json({ error: publicMessage });');
    s=s.replace(/res\.status\(status\)\.json\(\{ error: publicMessage,\s*\}\);/, 'res.status(status).json({ error: publicMessage });');
  }
  const prohibited=['safePhotoMessage','photoTraceId','isPhotoRequest'];
  const remain=prohibited.filter(t=>s.includes(t));
  if(remain.length)fail('app.js con su dung loi anh: '+remain.join(', '));
  return s;
}
function syntaxCheck(rel,text){
  if(rel.endsWith('.jsx')){
    let ts;
    try{ts=require('typescript');}catch{return;}
    const sf=ts.createSourceFile(rel,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);
    const ds=sf.parseDiagnostics||[];
    if(ds.length)fail('JSX syntax fail '+rel+': '+ds.map(d=>String(d.messageText)).join('; '));
  }else {
    const tmp=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'hexa-photo-'));
    const fn=path.join(tmp,'validate.mjs');
    try {fs.writeFileSync(fn,text);const r=cp.spawnSync(process.execPath,['--check',fn],{encoding:'utf8'});if(r.status!==0)fail('Backend syntax '+rel+': '+r.stderr);}finally{fs.rmSync(tmp,{recursive:true,force:true});}
  }
}
function main(){
  const before={}; const after={};
  for(const rel of [relFrontend,relBackend]) before[rel]=required(rel);
  if(fs.existsSync(path.join(root,relApp)))before[relApp]=required(relApp);
  after[relFrontend]=patchFrontend(before[relFrontend]);
  after[relBackend]=patchBackend(before[relBackend]);
  if(before[relApp])after[relApp]=patchApp(before[relApp]);
  for(const [rel,s] of Object.entries(after))syntaxCheck(rel,s);
  if(!after[relFrontend].includes("['qr','Mã QR / liên kết']"))fail('Khong tim thay tab QR, dung lai de bao ve QR.');
  const changes=Object.keys(after).filter(rel=>after[rel]!==before[rel]);
  const deletions=optionalFiles.filter(rel=>fs.existsSync(path.join(root,rel)));
  if(changes.length===0&&deletions.length===0){console.log('[OK] Chuc nang anh tai san da duoc go bo tu truoc.');return;}
  console.log((CHECK?'[CHECK OK] ':'[READY] ')+'Sua '+changes.length+' file: '+changes.join(', '));
  if(deletions.length)console.log('Don file chi phuc vu anh: '+deletions.join(', '));
  if(CHECK){console.log('Khong co file nao bi thay doi. Chay lai khong co --check de ap dung.');return;}
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  const backup=path.join(path.dirname(root),'HEXA_BACKUP_BO_ANH_'+stamp);
  fs.mkdirSync(backup,{recursive:true});
  for(const rel of [...changes,...deletions]){const dest=path.join(backup,rel);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,rel),dest);}
  try{
    for(const rel of changes)fs.writeFileSync(path.join(root,rel),after[rel]);
    for(const rel of deletions)fs.unlinkSync(path.join(root,rel));
  }catch(e){console.error('Ghi file loi, dang phuc hoi tu backup: '+e.message);for(const rel of [...changes,...deletions]){const dst=path.join(root,rel);fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(path.join(backup,rel),dst);}throw e;}
  console.log('[DONE] Da bo tab Hinh anh, upload/kiem tra Storage va API anh tai san. QR van giu nguyen.');
  console.log('Sao luu tai: '+backup);
  console.log('KHONG xoa du lieu assetImages tren Firebase hoac file cloud da ton tai.');
}
try{main();}catch(err){console.error('[FAILED] '+err.message);process.exitCode=1;}
