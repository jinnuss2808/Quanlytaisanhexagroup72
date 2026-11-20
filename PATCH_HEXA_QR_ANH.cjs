'use strict';
// HEXA QR + PHOTO update. Check-only and atomic per-file patch, no blind full overwrite.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const root = __dirname;
const checkOnly = process.argv.includes('--check');
const MARK = 'HEXA_QR_PHOTO_FIX_20261120';
const targets = ['frontend/src/AssetManagement.jsx','frontend/src/asset-management.css','backend/src/asset-api.js'];

function replaceOne(text, oldPart, newPart, where) {
  const matches = text.split(oldPart).length - 1;
  if (matches !== 1) throw new Error(`${where}: cần 1 vị trí tương thích, tìm thấy ${matches}. Không thay file.`);
  return text.replace(oldPart,newPart);
}
function insertBefore(text,needle,addition,where){return replaceOne(text,needle,addition+needle,where);}
function patchFrontend(src) {
  src=replaceOne(src,"import QRCode from 'qrcode';", "import QRCode from 'qrcode';\nimport { prepareAssetPhoto } from './asset-photo-upload.js';", 'import');
  src=replaceOne(src,
`  if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.error||\`HTTP \${response.status}\`);}`,
`  if(!response.ok){const data=await response.json().catch(()=>({}));const detail=data.error || (response.status===413?'Ảnh gửi lên quá lớn. Hãy dùng ảnh nhỏ hơn.':\`HTTP \${response.status} khi tải ảnh.\`);throw new Error(detail);}`,'rawRequest');
  const a=src.indexOf('function AssetPhoto({assetId,image}){');
  const b=src.indexOf('function MaintenanceEditor(',a);
  if(a<0||b<0)throw new Error('Không tìm được AssetPhoto / MaintenanceEditor');
  src=src.slice(0,a)+`function AssetPhoto({assetId,image}){\n  const [photo,setPhoto]=useState({src:'',loading:true,error:''});\n  const [retry,setRetry]=useState(0);\n  useEffect(()=>{let alive=true,url='';\n    setPhoto({src:'',loading:true,error:''});\n    (async()=>{\n      const blob=await rawRequest(\`/assets/\${assetId}/images/\${image.id}/file\`,{blob:true});\n      if(!blob.size)throw new Error('Dữ liệu ảnh trống.');\n      url=URL.createObjectURL(blob);\n      if(alive)setPhoto({src:url,loading:false,error:''});else URL.revokeObjectURL(url);\n    })().catch(err=>{if(alive)setPhoto({src:'',loading:false,error:err.message||'Không tải được ảnh.'});});\n    return()=>{alive=false;if(url)URL.revokeObjectURL(url);};\n  },[assetId,image.id,retry]);\n  if(photo.loading)return <div className="am-photo am-photo-empty" role="status">Đang tải ảnh...</div>;\n  if(photo.error)return <div className="am-photo am-photo-error" role="alert"><span>{photo.error}</span><button type="button" onClick={()=>setRetry(x=>x+1)}>Thử lại</button></div>;\n  return <img className="am-photo" src={photo.src} alt="Hình ảnh tài sản" onError={()=>setPhoto({src:'',loading:false,error:'Ảnh không thể hiển thị, hãy thử tải lại.'})}/>;\n}\n`+src.slice(b);
  src=replaceOne(src,"[addMaintenance,setAddMaintenance]=useState(false);", "[addMaintenance,setAddMaintenance]=useState(false);\n  const [photoNotice,setPhotoNotice]=useState('');", 'image notice');
  const u=src.indexOf('  const upload=async e=>{const file=e.target.files?.[0];e.target.value=\'\';if(!file)return;');
  const uEnd=src.indexOf('  const removeImage=async im=>',u);
  if(u<0||uEnd<0)throw new Error('Không tìm được image upload handler');
  src=src.slice(0,u)+`  const upload=async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;\n    setBusy(true);setMessage('');setPhotoNotice('Đang xử lý ảnh...');\n    try {\n      const ready=await prepareAssetPhoto(file);\n      setPhotoNotice('Đang tải ảnh lên Firebase Storage...');\n      const saved=await rawRequest(\`/assets/\${item.id}/images\`,{method:'POST',headers:{'Content-Type':ready.type},body:ready});\n      setImages(old=>[...old.filter(x=>x.id!==saved.id),saved]);\n      setPhotoNotice('Đã thêm ảnh thành công.');\n    } catch(err){setPhotoNotice('');setMessage(err.message||'Không thể tải ảnh lên.');}\n    finally{setBusy(false);}\n  };\n`+src.slice(uEnd);
  src=replaceOne(src,`        <div className="am-photo-grid">{images.map(img=>`, `        {photoNotice&&<p className="am-photo-notice" role="status">{photoNotice}</p>}\n        <div className="am-photo-grid">{images.map(img=>`, 'notice display');
  src=replaceOne(src,'Tối đa 6 ảnh, mỗi ảnh tối đa 5 MB. Cần cấu hình Firebase Storage.', 'Tối đa 6 ảnh. JPG/PNG/WebP, ảnh lớn sẽ tự nén dưới 2,8 MB trước khi tải. Cần Firebase Storage.', 'image help');
  src=replaceOne(src,
`      <strong>{item.assetCode}</strong><span>{item.assetName}</span>`,
`      <strong>{item.assetCode}</strong><span>{item.assetName}</span>\n      <div className="am-qr-meta"><div><small>Công ty sở hữu</small><b>{item.ownerDepartmentName||'Chưa cập nhật'}</b></div><div><small>Người đang sử dụng</small><b>{item.assignedTo||'Chưa bàn giao'}</b></div><div><small>Địa chỉ IP</small><b>{item.ipAddress||'Chưa cập nhật'}</b></div></div>`, 'QR label');
  src=replaceOne(src,'Quét mã để mở trang thông tin công khai của tài sản này. Mã QR được tạo trên máy, không cần dịch vụ bên ngoài.', 'Quét mã để mở hồ sơ tài sản. Người đã đăng nhập IT xem thêm IP và người sử dụng; người ngoài chỉ thấy thông tin cơ bản.', 'QR description');
  const p=src.indexOf('export function PublicAssetPage({publicId}){');
  if(p<0)throw new Error('Không tìm thấy PublicAssetPage');
  src=src.slice(0,p)+`// ${MARK}: QR public/basic; private detail only with authenticated IT token.\nexport function PublicAssetPage({publicId}){\n  const [item,setItem]=useState(null),[detail,setDetail]=useState(null),[error,setError]=useState(''),[privateError,setPrivateError]=useState('');\n  useEffect(()=>{let alive=true;setItem(null);setError('');\n    fetch(\`\${BASE}/api/public/assets/\${encodeURIComponent(publicId)}\`).then(async r=>{const data=await r.json();if(!r.ok)throw new Error(data.error||'Không tìm thấy tài sản.');return data;})\n      .then(data=>{if(alive)setItem(data);}).catch(e=>{if(alive)setError(e.message);});\n    return()=>{alive=false;};\n  },[publicId]);\n  useEffect(()=>{let alive=true;setDetail(null);setPrivateError('');\n    const unsubscribe=auth.onAuthStateChanged(user=>{\n      if(!user){if(alive){setDetail(null);setPrivateError('');}return;}\n      api(\`/assets/qr/\${encodeURIComponent(publicId)}/private\`)\n        .then(data=>{if(alive)setDetail(data);}).catch(e=>{if(alive)setPrivateError(e.message);});\n    });\n    return()=>{alive=false;unsubscribe();};\n  },[publicId]);\n  const display=detail?{...item,...detail}:item;\n  return <main className="am-public"><div className="am-public-card"><div className="am-eyebrow">HEXA GROUP · QUẢN LÝ TÀI SẢN</div><h1>Thông tin tài sản</h1>\n    {error?<p className="am-error">{error}</p>:display?<div className="am-detail-grid">{[\n      ['Mã tài sản',display.assetCode],['Tên tài sản',display.assetName],['Loại thiết bị',display.categoryName||'Chưa cập nhật'],\n      ['Công ty sở hữu',display.ownerDepartmentName||'Chưa cập nhật'],['Trạng thái',STATUS[display.status]||'Chưa cập nhật'],\n      ...(detail?[['Người đang sử dụng',detail.assignedTo||'Chưa bàn giao'],['Phòng ban sử dụng',detail.userDepartment||'Chưa cập nhật'],['Địa chỉ IP',detail.ipAddress||'Chưa cập nhật'],['Serial',detail.serialNumber||'Chưa cập nhật']]:[])\n    ].map(([k,v])=><div key={k}><small>{k}</small><strong>{v}</strong></div>)}</div>:<p>Đang tải...</p>}\n    {!detail&&item&&<p className="am-qr-login-note">IP, serial và người đang sử dụng chỉ hiển thị khi đăng nhập tài khoản IT tại <a href="/it">HEXA IT</a>. Sau khi đăng nhập, hãy quét hoặc mở lại QR.</p>}\n    {privateError&&<p className="am-muted">Thông tin nội bộ chưa hiển thị: {privateError}</p>}\n    <a className="am-btn am-primary" href="/it">Về trang quản lý IT</a>\n  </div></main>;\n}\n`;
  return src;
}
function patchBackend(src) {
  const route=`// ${MARK}: Protected QR detail, never exposed through public endpoint.\nrouter.get('/qr/:publicId/private',wrap(async(req,res)=>{\n  const publicId=validId(req.params.publicId);\n  const id=(await db.ref(\`assetPublicIds/\${publicId}\`).get()).val();\n  if(!id)throw assetError(404,'Không tìm thấy tài sản.');\n  const asset=await assetById(validId(id));\n  const {cats,depts}=await catalogs();\n  const info=enrichAsset(asset,cats,depts);\n  res.set('Cache-Control','private, no-store');\n  res.json({assetCode:info.assetCode,assetName:info.assetName,categoryName:info.categoryName,\n    ownerDepartmentName:info.ownerDepartmentName,status:info.status,\n    assignedTo:info.assignedTo||null,userDepartment:info.userDepartment||null,\n    ipAddress:info.ipAddress||null,serialNumber:info.serialNumber||null});\n}));\n`;
  src=insertBefore(src,"router.get('/:id/images',",route,'private qr API');
  src=replaceOne(src,`  const imageId=db.ref(\`assetImages/\${id}\`).push().key;`, `  if(bytes.length>3_500_000)throw assetError(413,'Ảnh vượt giới hạn tải lên. Hãy giảm ảnh dưới 2,8 MB.');\n  const imageId=db.ref(\`assetImages/\${id}\`).push().key;`, 'upload limit');
  src=replaceOne(src,"  if(!process.env.FIREBASE_STORAGE_BUCKET)throw assetError(501,'Chưa cấu hình FIREBASE_STORAGE_BUCKET để lưu hình ảnh.');", "  if(!process.env.FIREBASE_STORAGE_BUCKET)throw assetError(501,'Backend chưa cấu hình FIREBASE_STORAGE_BUCKET. Hãy thiết lập đúng tên bucket Firebase Storage rồi redeploy backend.');", 'bucket message');
  src=replaceOne(src,`  await imageBucket().file(path).save(bytes,{resumable:false,contentType:mime,metadata:{cacheControl:'private, max-age=0'}});`,
`  try {\n    await imageBucket().file(path).save(bytes,{resumable:false,contentType:mime,metadata:{cacheControl:'private, max-age=0'}});\n  } catch(err) {\n    const code=Number(err.code||err.statusCode||err.status);\n    if(code===403)throw assetError(503,'Firebase Storage từ chối ghi ảnh (403). Kiểm tra quyền Service Account trên bucket.');\n    if(code===404)throw assetError(503,'Không tìm thấy Firebase Storage bucket. Kiểm tra FIREBASE_STORAGE_BUCKET.');\n    throw assetError(503,'Lỗi lưu ảnh lên Firebase Storage. Kiểm tra bucket, quyền truy cập và Runtime Logs trên Vercel.');\n  }`, 'save storage');
  src=replaceOne(src,`  const [bytes]=await imageBucket().file(image.path).download();`,
`  let bytes;\n  try { [bytes]=await imageBucket().file(image.path).download(); }\n  catch(err) {\n    if(Number(err.code||err.statusCode)===404)throw assetError(404,'Ảnh đã được ghi trong danh sách nhưng tệp gốc không còn trong Firebase Storage.');\n    throw assetError(503,'Không thể đọc ảnh từ Firebase Storage. Kiểm tra quyền đọc và bucket.');\n  }`, 'download storage');
  return src;
}
function patchCss(s){return s+`\n/* ${MARK} */\n.am-photo-error{display:flex;flex-direction:column;gap:6px;align-items:center;justify-content:center;text-align:center;overflow-wrap:anywhere;padding:10px;color:#9d3142;background:#fff5f4;min-height:135px;font-size:11px}\n.am-photo-error button{background:white;color:#145e56;border:1px solid #b4dcd5;border-radius:7px;padding:5px 9px;cursor:pointer}\n.am-photo-notice{border:1px solid #c9e9df;background:#f1fbf7;color:#165d53;padding:9px 12px;border-radius:8px;font-size:12px}\n.am-qr-meta{width:100%;margin-top:9px;text-align:left;display:grid;gap:5px;border-top:1px solid #dcefeb;padding-top:10px}\n.am-qr-meta>div{display:flex;justify-content:space-between;gap:8px;align-items:start;font-size:11px;overflow-wrap:anywhere}\n.am-qr-meta small{color:#688880;flex:0 0 45%}\n.am-qr-meta b{font-weight:700;text-align:right;color:#215950;min-width:0}\n.am-qr-login-note{border:1px solid #d9ece8;background:#f6fbfa;color:#426861;border-radius:9px;padding:12px;font-size:12px;line-height:1.6}\n.am-qr-login-note a{font-weight:700;color:#086e60}\n`}

try{
  const files={};
  for(const rel of targets){const file=path.join(root,rel);if(!fs.existsSync(file))throw new Error(`Thiếu ${rel}; đặt script cùng cấp frontend và backend.`);files[rel]=fs.readFileSync(file,'utf8');}
  const already=targets.every(rel=>files[rel].includes(MARK));
  const partial=targets.some(rel=>files[rel].includes(MARK));
  if(already){console.log('[OK] QR/Ảnh đã cập nhật trước đó.');process.exit(0);}
  if(partial)throw new Error('Phát hiện bản vá đã áp dụng một phần. Không ghi đè, hãy kiểm tra thủ công.');
  const next={
    'frontend/src/AssetManagement.jsx':patchFrontend(files['frontend/src/AssetManagement.jsx']),
    'frontend/src/asset-management.css':patchCss(files['frontend/src/asset-management.css']),
    'backend/src/asset-api.js':patchBackend(files['backend/src/asset-api.js'])
  };
  const photoSrc=fs.readFileSync(path.join(__dirname,'asset-photo-upload.js'),'utf8');
  const photoPath=path.join(root,'frontend/src/asset-photo-upload.js');
  if(fs.existsSync(photoPath))throw new Error('frontend/src/asset-photo-upload.js đã tồn tại. Không ghi đè.');
  if(checkOnly){console.log('[CHECK OK] Có thể cập nhật 3 file và tạo file xử lý ảnh; không thay đổi dữ liệu.');process.exit(0);}
  const backup=path.join(os.homedir(),'HEXA-PATCH-BACKUPS','QR-ANH-'+new Date().toISOString().replace(/[:.]/g,'-'));
  fs.mkdirSync(backup,{recursive:true});
  targets.forEach(rel=>{const file=path.join(backup,rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,files[rel]);});
  try{
    for(const [rel,val] of Object.entries(next))fs.writeFileSync(path.join(root,rel),val,'utf8');
    fs.writeFileSync(photoPath,photoSrc,'utf8');
  }catch(e){for(const rel of targets)fs.writeFileSync(path.join(root,rel),files[rel],'utf8');try{fs.unlinkSync(photoPath)}catch{}throw e;}
  console.log('[OK] Cập nhật QR và ảnh. Sao lưu: '+backup);console.log('Tiếp theo: npm test (backend), npm run build (frontend), kiểm tra trên local trước khi push.');
}catch(err){console.error('[STOP] '+err.message);process.exitCode=1;}
