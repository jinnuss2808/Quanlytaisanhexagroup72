'use strict';
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const project=__dirname;
const rel={app:'backend/src/app.js',api:'backend/src/it-library-api.js',core:'backend/src/it-library-core.js',ui:'frontend/src/ITLibrary.jsx',client:'frontend/src/api.js'};
const marker='HEXA_ITLIB_404_DIAGNOSTIC_V1';
function error(message){throw new Error(message);}
function read(p){return fs.readFileSync(path.join(project,p),'utf8');}
function exists(p){return fs.existsSync(path.join(project,p));}
try{
  for(const p of [rel.app,rel.ui,rel.client,'backend/package.json','frontend/package.json'])
    if(!exists(p))error('Thiếu '+p+'. Hãy đặt BAT/CJS/payload ở thư mục gốc dự án đã cài Thư viện IT.');
  if(!/\/api['"]\s*\+\s*path|['"]\/api['"]\s*\+\s*path/.test(read(rel.client))) {
    console.log('[NOTE] API helper khác mẫu; giữ nguyên frontend/src/api.js.');
  }
  let app=read(rel.app), ui=read(rel.ui);
  const importExists=/import\s+itLibraryRouter\s+from\s+['"]\.\/it-library-api\.js['"]\s*;?/.test(app);
  const mountExists=/app\.use\s*\(\s*['"]\/api\/it-library['"]\s*,\s*requireIT\s*,\s*itLibraryRouter\s*\)/.test(app);
  let appNext=app;
  if(!importExists){
    if(!appNext.includes("import express from 'express';"))error('Không nhận diện được cấu trúc import Express trong backend/src/app.js. Không sửa tự động.');
    appNext=appNext.replace("import express from 'express';","import express from 'express';\nimport itLibraryRouter from './it-library-api.js';");
  }
  if(!mountExists){
    const anchor="app.use('/api/warehouse', requireIT, warehouseRouter);";
    if(!appNext.includes(anchor))error('Không thấy vị trí đăng ký /api/warehouse trong backend/src/app.js. Không sửa tự động.');
    appNext=appNext.replace(anchor,anchor+"\napp.use('/api/it-library', requireIT, itLibraryRouter);");
  }
  const missing=[rel.api,rel.core].filter(p=>!exists(p));
  for(const p of missing){
    if(!exists('payload/'+p))error('Bản vá thiếu file dự phòng: '+p);
  }
  let uiNext=ui;
  if(!ui.includes(marker)){
    if(!ui.includes("import { api } from './api';")||!ui.includes('const TYPE = {'))error('ITLibrary.jsx đã thay đổi khác bản hỗ trợ. Dừng để tránh ghi đè.');
    const helper=`// ${marker}\nasync function apiLibrary(path,options){\n  try{return await api(path,options);}\n  catch(err){\n    if(/^HTTP 404$/.test(String(err?.message||''))){\n      throw new Error('API Thư viện IT chưa có trên backend (HTTP 404). Khởi động lại backend Node.js hoặc deploy lại project Vercel ticket-asset-hexa-api; kiểm tra URL API trong VITE_API_URL.');\n    }\n    throw err;\n  }\n}\n`;
    uiNext=uiNext.replace('const TYPE = {',helper+'\nconst TYPE = {');
    uiNext=uiNext.replace(/\bapi\((['"])\/it-library\//g,'apiLibrary($1/it-library/');
  }
  const changes=[];
  if(appNext!==app)changes.push({path:rel.app,source:app,next:appNext});
  if(uiNext!==ui)changes.push({path:rel.ui,source:ui,next:uiNext});
  for(const p of missing)changes.push({path:p,source:null,next:fs.readFileSync(path.join(project,'payload',p),'utf8')});
  if(!changes.length){console.log('[OK] Route và UI đã đúng, không phải sửa mã nguồn.');}
  else {
    // Backup outside git workspace, with rollback on failed write.
    const stamp=new Date().toISOString().replace(/[:.]/g,'-');
    const backup=path.join(os.homedir(),'HEXA_SOURCE_BACKUPS','it-library-http404-'+stamp);
    for(const c of changes){if(c.source!==null){const dest=path.join(backup,c.path);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,c.source,'utf8');}}
    const done=[];
    try{for(const c of changes){const p=path.join(project,c.path);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,c.next,'utf8');done.push(c);}}
    catch(e){for(const c of done){const p=path.join(project,c.path);if(c.source===null)fs.rmSync(p,{force:true});else fs.writeFileSync(p,c.source,'utf8');}error('Không ghi được file, đã khôi phục: '+e.message);}
    console.log('[OK] Đã kiểm tra/sửa route + thông báo lỗi Thư viện IT.');
    for(const c of changes)console.log('    '+c.path);
    console.log('[BACKUP] '+backup);
  }
  console.log('[VERIFY] Backend import: '+(/import\s+itLibraryRouter\s+from\s+['"]\.\/it-library-api\.js['"]/.test(appNext)?'OK':'FAIL'));
  console.log('[VERIFY] Backend route: '+(/app\.use\s*\(\s*['"]\/api\/it-library['"]\s*,\s*requireIT\s*,\s*itLibraryRouter\s*\)/.test(appNext)?'OK':'FAIL'));
  console.log('[NEXT] Khởi động lại backend Node.js (phải restart, không chỉ refresh browser).');
  console.log('[NEXT] Nếu dùng Vercel: commit/push backend/src + frontend/src, xem Deployments của cả API và website.');
  console.log('[NOTE] Sau khi router hoạt động, lỗi Storage 503/403 nếu có sẽ cần cấu hình bucket/IAM riêng.');
}catch(e){console.error('[FAILED] '+e.message);process.exitCode=1;}
