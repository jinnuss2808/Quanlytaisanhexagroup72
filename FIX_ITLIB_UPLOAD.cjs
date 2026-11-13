'use strict';
// HEXA: incremental, re-runnable repair for IT Library signed-url uploads.
// Does not modify Firebase data or credentials. Backs up original files outside the Git repository.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const base = __dirname;
const back = 'backend/src/it-library-api.js';
const front = 'frontend/src/ITLibrary.jsx';
const M1 = 'HEXA_ITLIB_UPLOAD_DIAGNOSTIC_V2';
const M2 = 'HEXA_ITLIB_UPLOAD_PROGRESS_V2';
const safeRead = f => fs.readFileSync(path.join(base,f),'utf8');
function need(ok, message) {if(!ok) throw new Error(message);}
function replaceOne(text, from, to, label) {
  need(text.includes(from), 'Không tìm thấy đoạn '+label+' trong phiên bản mã nguồn của bạn. Đã dừng mà chưa sửa file.');
  return text.replace(from,to);
}
try {
  need(fs.existsSync(path.join(base,'backend/package.json')) && fs.existsSync(path.join(base,'frontend/package.json')),
    'Đặt BAT/CJS tại thư mục gốc HEXA, cùng cấp frontend/ và backend/.');
  need(fs.existsSync(path.join(base,back)) && fs.existsSync(path.join(base,front)),
    'Thiếu API hoặc ITLibrary.jsx. Cần cài bản Thư viện IT trước.');
  const currentBack = safeRead(back), currentFront=safeRead(front);
  let b=currentBack, f=currentFront;
  if(!b.includes(M1)) {
    b=replaceOne(b,
      "const BKT_ERROR = 'Chưa cấu hình FIREBASE_STORAGE_BUCKET cho backend. Bạn vẫn có thể lưu liên kết HTTPS.';",
      `// ${M1}\nconst BKT_ERROR = 'Chưa cấu hình FIREBASE_STORAGE_BUCKET cho backend. Bạn vẫn có thể lưu liên kết HTTPS.';\nfunction libUploadTroubleshoot(error) {\n  const reason = String(error?.message || '');\n  const code = String(error?.code || '');\n  if (/iam\\.serviceAccounts\\.signBlob|signBlob|permission.*sign|cannot sign/i.test(reason+code))\n    return 'Service Account chưa có quyền ký URL Cloud Storage (iam.serviceAccounts.signBlob). Kiểm tra tài khoản dịch vụ hoặc khóa Firebase Admin SDK trên Vercel.';\n  if (/permission|access.?denied|forbidden|403|storage\\.objects/i.test(reason+code))\n    return 'Storage từ chối quyền truy cập. Kiểm tra quyền Storage Object của Service Account và quyền trên bucket.';\n  if (/bucket.*not.?found|not.?found.*bucket|No such bucket|404/i.test(reason+code))\n    return 'Không tìm thấy Storage bucket. Kiểm tra FIREBASE_STORAGE_BUCKET trên backend/Vercel.';\n  if (/credential|private.?key|client.?email|no signing/i.test(reason+code))\n    return 'Backend không ký được URL bằng thông tin Service Account. Kiểm tra cấu hình Firebase Admin SDK trên Vercel.';\n  return 'Không tạo được đường dẫn upload trên Storage. Admin hãy bấm Kiểm tra Storage và xem log API trên Vercel.';\n}\nfunction libUploadLog(phase,error) {\n  // No signed URLs, tokens, service-account keys or request bodies in logs.\n  console.error('[HEXA_IT_LIBRARY]['+phase+']', { code:String(error?.code||'unknown').slice(0,90), name:String(error?.name||'Error').slice(0,80) });\n}`,
      'thông báo thiếu Storage');
    b=replaceOne(b,
      "const allRows = async path => (await db.ref(path).get()).val() || {};",
      `const allRows = async path => {\n  try {return (await db.ref(path).get()).val() || {}; }\n  catch (error) {libUploadLog('database-read',error);throw libError(503,'Không đọc được Thư viện IT từ Realtime Database. Kiểm tra quyền Firebase Admin SDK và log backend.');}\n};`,
      'đọc danh sách thư viện');
    b=replaceOne(b,
      "router.get('/items', route(async(req,res)=>{",
      `// Admin diagnostics: read-only; never exposes secrets or signed URLs.\nrouter.get('/diagnostics', manager, route(async(_req,res)=>{\n  const report={database:{ok:false},storage:{configured:Boolean(process.env.FIREBASE_STORAGE_BUCKET),signing:false},note:'Kiểm tra ký URL không xác nhận CORS hoặc khả năng ghi file thực tế.'};\n  try {await db.ref('itLibraryItems').limitToFirst(1).get();report.database.ok=true;}\n  catch(error){libUploadLog('diagnostics-db',error);report.database.message='Realtime Database không đọc được';}\n  if(report.storage.configured){\n    try {\n      // Sign a short-lived request for a nonexistent object; do NOT write anything.\n      await bucket().file('it-library/diagnostics-only').getSignedUrl({action:'write',version:'v4',expires:Date.now()+60_000,contentType:'application/octet-stream'});\n      report.storage.signing=true;\n    }catch(error){libUploadLog('diagnostics-signing',error);report.storage.message=libUploadTroubleshoot(error);}\n  }else report.storage.message=BKT_ERROR;\n  res.json(report);\n}));\nrouter.get('/items', route(async(req,res)=>{`,
      'thêm endpoint chẩn đoán');
    b=replaceOne(b,
      "const storagePath=buildStoragePath(), expiresAt=now()+SIGNED_URL_MS;",
      `// Large drivers can need more than 10 minutes on a slow connection.\n  const storagePath=buildStoragePath(), expiresAt=now()+30*60*1000;`,
      'thời gian upload');
    b=replaceOne(b,
      `  const [signedUrl]=await bucket().file(storagePath).getSignedUrl({\n    action:'write',version:'v4',expires:expiresAt,contentType:file.mime,\n  });\n  await db.ref(\`itLibraryPendingUploads/\${id}\`).set(pending);`,
      `  let signedUrl;\n  try {\n    [signedUrl]=await bucket().file(storagePath).getSignedUrl({\n      action:'write',version:'v4',expires:expiresAt,contentType:file.mime,\n    });\n  }catch(error){libUploadLog('sign-upload-url',error);throw libError(503,libUploadTroubleshoot(error));}\n  try {await db.ref(\`itLibraryPendingUploads/\${id}\`).set(pending);}\n  catch(error){libUploadLog('save-upload-session',error);throw libError(503,'Đã ký URL nhưng không lưu được phiên upload vào Realtime Database.');}`,
      'ký URL và lưu phiên');
  }
  if(!f.includes(M2)) {
    const utility = `// ${M2}\nfunction uploadFileWithProgress({url, file, contentType, onProgress}) {\n  return new Promise((resolve,reject)=>{\n    const xhr=new XMLHttpRequest();\n    xhr.open('PUT',url,true);\n    xhr.timeout=29*60*1000;\n    xhr.setRequestHeader('Content-Type',contentType);\n    xhr.upload.onprogress=e=>{if(e.lengthComputable&&e.total>0)onProgress(Math.min(100,Math.round(e.loaded/e.total*100)));};\n    xhr.onload=()=>xhr.status>=200&&xhr.status<300?resolve():reject(new Error(\`Cloud Storage từ chối upload (HTTP \${xhr.status}). Kiểm tra bucket/IAM và Content-Type.\`));\n    xhr.onerror=()=>reject(new Error('Không kết nối được Cloud Storage. Kiểm tra CORS cho đúng tên miền HEXA, mạng và quyền bucket.'));\n    xhr.ontimeout=()=>reject(new Error('Upload vượt thời gian chờ. Thử mạng ổn định hơn hoặc dùng liên kết HTTPS cho file lớn.'));\n    xhr.onabort=()=>reject(new Error('Upload đã bị hủy.'));\n    xhr.send(file);\n  });\n}\n`;
    f=replaceOne(f,'function openDownload(url){',utility+'\nfunction openDownload(url){','thêm hiển thị tiến độ');
    f=replaceOne(f,
      "  const loadHistory=async row=>{",
      `  const checkStorage=async()=>{\n    setError('');setMsg('Đang kiểm tra quyền upload...');\n    try {\n      const d=await api('/it-library/diagnostics');\n      const dbOk=!!d.database?.ok,signOk=!!d.storage?.signing;\n      const message='Realtime Database: '+(dbOk?'OK':'LỖI')+' · Storage: '+(d.storage?.configured?'Đã cấu hình':'Chưa cấu hình')+' · Ký URL: '+(signOk?'OK':'LỖI');\n      setMsg(message);\n      if(!dbOk||!signOk)setError(d.storage?.message||d.database?.message||'Kiểm tra lại cấu hình Firebase.');\n    }catch(err){setMsg('');setError('Không chạy được chẩn đoán Storage: '+(err?.message||'Không xác định'));}\n  };\n  const loadHistory=async row=>{`,
      'thêm kiểm tra Storage');
    const uploadOld=`        setProgress('Đang tải file lên Firebase Storage...');\n        let response;\n        try{response=await fetch(session.url,{method:'PUT',headers:{'Content-Type':session.contentType},body:file});}\n        catch {throw new Error('Không tải lên được Storage. Kiểm tra cấu hình CORS và kết nối mạng.');}\n        if(!response.ok)throw new Error('Storage từ chối file (HTTP '+response.status+').');`;
    const uploadNew=`        setProgress('Đang tải file lên Firebase Storage... 0%');\n        await uploadFileWithProgress({url:session.url,file,contentType:session.contentType,\n          onProgress:percent=>setProgress('Đang tải file lên Firebase Storage... '+percent+'%')});`;
    f=replaceOne(f,uploadOld,uploadNew,'upload trực tiếp đến Storage');
    f=replaceOne(f,
      `      }else if(file){\n        setProgress('Đang tạo phiên upload an toàn...');`,
      `      }else if(file){\n        if(file.size>150*1024*1024)throw new Error('File vượt 150 MB. Hãy dùng liên kết HTTPS.');\n        setProgress('Đang tạo phiên upload an toàn...');`,
      'kiểm tra kích thước file');
    f=replaceOne(f,
      `    }catch(err){setError(err.message)}finally{setWorking(false);setProgress('');}`,
      `    }catch(err){setError('Không thể lưu '+(mode==='upload'?'file upload':'mục thư viện')+': '+(err?.message||'Lỗi chưa xác định')+(mode==='upload'?' · Bấm Kiểm tra Storage để xem cấu hình backend.':''))}finally{setWorking(false);setProgress('');}`,
      'thông báo upload');
    f=replaceOne(f,
      `      <div className="itl-actions"><button className="itl-btn ghost" type="button" onClick={reload}><RefreshCw size={15}/> Làm mới</button>`,
      `      <div className="itl-actions">{manager&&<button className="itl-btn ghost" type="button" onClick={checkStorage}><ShieldCheck size={15}/> Kiểm tra Storage</button>}<button className="itl-btn ghost" type="button" onClick={reload}><RefreshCw size={15}/> Làm mới</button>`,
      'nút kiểm tra Storage');
  }
  const updates=[];
  if(b!==currentBack)updates.push({file:back,content:b,original:currentBack});
  if(f!==currentFront)updates.push({file:front,content:f,original:currentFront});
  if(!updates.length){console.log('[OK] Bản sửa upload đã được áp dụng trước đó.');process.exit(0);}
  // Keep backups outside repository, so normal git add -A never stages old keys/data.
  const backup=path.join(os.homedir(),'HEXA_SOURCE_BACKUPS','it-library-upload-'+new Date().toISOString().replace(/[:.]/g,'-'));
  for (const u of updates){const target=path.join(backup,u.file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,u.original,'utf8');}
  const written=[];
  try {for(const u of updates){fs.writeFileSync(path.join(base,u.file),u.content,'utf8');written.push(u);}}
  catch(e){for(const u of written)fs.writeFileSync(path.join(base,u.file),u.original,'utf8');throw e;}
  console.log('[OK] Đã sửa đường upload & chẩn đoán; không thay đổi dữ liệu Firebase.');
  updates.forEach(u=>console.log('  '+u.file));
  console.log('[BACKUP] '+backup);
  console.log('[NEXT] Restart backend, refresh frontend. Kiểm tra nút "Kiểm tra Storage".');
} catch(e) {console.error('[FAILED] '+e.message);process.exitCode=1;}
