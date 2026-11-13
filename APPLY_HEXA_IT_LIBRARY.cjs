'use strict';
// Safe, additive patcher for current HEXA source. No Firebase data is touched.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const project=__dirname, payload=path.join(project,'payload');
const files={
  app:'frontend/src/App.jsx',asset:'frontend/src/AssetManagement.jsx',printer:'frontend/src/PrinterManagement.jsx',backend:'backend/src/app.js',
};
const newFiles=[
  'backend/src/it-library-core.js','backend/src/it-library-api.js','backend/test/it-library-core.test.js',
  'frontend/src/ITLibrary.jsx','frontend/src/it-library.css',
];
function abort(text){throw Error(text)}
function replaceRequired(text,old,newText,label){
  if(!text.includes(old))abort('Khong tim thay diem chen: '+label+' (file da duoc sua khac ban). Chua thay doi ma nguon.');
  return text.replace(old,newText);
}
function ensureCount(text,needle,label){ if(!text.includes(needle)) abort('Khong tim thay '+label+'. Chua thay doi file nao.'); }
function patchApp(s){
  ensureCount(s,"from './AssetManagement'",'App import AssetManagement');
  s=replaceRequired(s,"from './AssetManagement';","from './AssetManagement';\nimport ITLibrary from './ITLibrary';\nimport { FolderOpen } from 'lucide-react';\n// HEXA_IT_LIBRARY_V1",'App import assets');
  const oldMenu="{ id: 'assets', label: 'Quản lý tài sản', icon: Boxes },";
  s=replaceRequired(s,oldMenu,oldMenu+"\n    { id: 'it_library', label: 'Thư viện IT', icon: FolderOpen },",'App side menu');
  s=replaceRequired(s,"assets: 'Quản lý tài sản'", "assets: 'Quản lý tài sản', it_library: 'Thư viện IT'",'App title map');
  const lines=s.split('\n');
  const assetIndex=lines.findIndex(line=>/\{section\s*===\s*'assets'\s*&&\s*<AssetManagement/.test(line));
  if(assetIndex<0)abort('Khong tim thay man hinh Quan ly tai san trong App.jsx.');
  lines.splice(assetIndex+1,0,"          {section === 'it_library' && <ITLibrary user={user}/>}");
  s=lines.join('\n');
  s=s.replace("section !== 'assets' &&", "!['assets','it_library'].includes(section) &&");
  return s;
}
function patchAsset(s){
  s='/* HEXA_IT_LIBRARY_V1 */\n'+s;
  const needle='<PrinterManagement refreshEpoch={warehouseRefreshEpoch}/>';
  return replaceRequired(s,needle,'<PrinterManagement user={user} refreshEpoch={warehouseRefreshEpoch}/>', 'AssetManagement printer props');
}
function patchPrinter(s){
  ensureCount(s,'function PrinterDetail','PrinterDetail');
  s="import ITLibrary from './ITLibrary';\nimport { FolderOpen } from 'lucide-react';\n// HEXA_IT_LIBRARY_V1\n"+s;
  s=replaceRequired(s,'function PrinterDetail({printer,onClose,onSaved})','function PrinterDetail({printer,onClose,onSaved,user})','PrinterDetail user props');
  s=replaceRequired(s,"['repair','Sửa chữa',Wrench]","['repair','Sửa chữa',Wrench],['files','Driver & Tài liệu',FolderOpen]",'PrinterDetail tabs');
  s=replaceRequired(s,'export default function PrinterManagement({refreshEpoch=0})','export default function PrinterManagement({user,refreshEpoch=0})','PrinterManagement user props');
  const start=s.indexOf('function PrinterDetail('),end=s.indexOf('export default function PrinterManagement(');
  if(start<0||end<=start)abort('Khong tim thay cau truc PrinterDetail.');
  let block=s.slice(start,end),last=block.lastIndexOf('</form>}');
  if(last<0||!block.includes('Lưu sửa chữa vào lịch sử'))abort('Khong tim thay form sua chua may in.');
  last+='</form>}'.length;
  block=block.slice(0,last)+"\n        {tab==='files'&&<ITLibrary user={user} printerId={printer.id} compact/>}"+block.slice(last);
  s=s.slice(0,start)+block+s.slice(end);
  s=replaceRequired(s,'onSaved={refresh}/>','onSaved={refresh} user={user}/>','PrinterDetail caller');
  return s;
}
function patchBackend(s){
  ensureCount(s,"from './asset-api.js'",'backend import asset-api');
  s="import itLibraryRouter from './it-library-api.js';\n// HEXA_IT_LIBRARY_V1\n"+s;
  s=replaceRequired(s,"app.use('/api/warehouse', requireIT, warehouseRouter);",
    "app.use('/api/warehouse', requireIT, warehouseRouter);\napp.use('/api/it-library', requireIT, itLibraryRouter);",'backend routes');
  return s;
}
try{
  for(const rel of Object.values(files))if(!fs.existsSync(path.join(project,rel)))abort('Thieu file nguon: '+rel);
  for(const rel of newFiles)if(!fs.existsSync(path.join(payload,rel)))abort('Thieu file payload: '+rel);
  if(!fs.existsSync(path.join(project,'frontend/package.json'))||!fs.existsSync(path.join(project,'backend/package.json')))
    abort('Dat BAT, CJS va thu muc payload cung cap voi frontend/ va backend/.');
  const mark=Object.values(files).map(r=>fs.readFileSync(path.join(project,r),'utf8').includes('HEXA_IT_LIBRARY_V1'));
  if(mark.every(Boolean)){
    if(newFiles.every(r=>fs.existsSync(path.join(project,r)))){
      console.log('[OK] Thư viện IT đã có trong project. Không áp dụng trùng.');process.exit(0);
    }
    abort('Project da sua mot phan. Can kiem tra thu cong truoc khi ap dung tiep.');
  }
  if(mark.some(Boolean))abort('Phat hien ma nguon da duoc ap dung mot phan. Khong ghi de.');
  for(const rel of newFiles)if(fs.existsSync(path.join(project,rel)))abort('File moi da ton tai, khong ghi de: '+rel);
  const modified=[
    [files.app,patchApp],[files.asset,patchAsset],[files.printer,patchPrinter],[files.backend,patchBackend],
  ].map(([rel,fn])=>({rel,original:fs.readFileSync(path.join(project,rel),'utf8'),fn}));
  for(const x of modified)x.next=x.fn(x.original);
  // Backups outside Git root to avoid accidentally publishing private code changes.
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  const backup=path.join(os.homedir(),'HEXA_SOURCE_BACKUPS','it_library_'+stamp);
  fs.mkdirSync(backup,{recursive:true});
  for(const x of modified){const out=path.join(backup,x.rel);fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,x.original);}
  const changed=[];
  try{
    for(const x of modified){fs.writeFileSync(path.join(project,x.rel),x.next);changed.push(x.rel);}
    for(const rel of newFiles){const dest=path.join(project,rel);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(payload,rel),dest);changed.push(rel);}
  }catch(e){
    for(const x of modified)fs.writeFileSync(path.join(project,x.rel),x.original);
    for(const rel of newFiles)if(changed.includes(rel))fs.rmSync(path.join(project,rel),{force:true});
    abort('Khong ghi duoc file, da khoi phuc: '+e.message);
  }
  console.log('[OK] Da them Thu vien IT va Driver & Tai lieu vao may in.');
  console.log('[OK] Da tao ' + newFiles.length + ' file va cap nhat ' + modified.length + ' file.');
  console.log('[BACKUP] '+backup);
  console.log('[GIT] Kiem tra local truoc, sau do git add frontend/src backend/src backend/test');
}catch(e){console.error('[FAILED] '+e.message);process.exit(1);}
