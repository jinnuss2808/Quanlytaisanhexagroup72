/* Safe, incremental updater. It NEVER uploads keys or modifies Firebase data. */
const fs=require('node:fs'), path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=__dirname;
const payload=JSON.parse(fs.readFileSync(path.join(root,'payload','patches.json'),'utf8'));
function fail(message){console.error('\n[STOP] '+message);process.exitCode=1;}
if(!fs.existsSync(path.join(root,'frontend','src','AssetManagement.jsx')) ||
   !fs.existsSync(path.join(root,'backend','src','asset-api.js'))){
 fail('Hãy đặt BAT + CJS + thư mục payload vào THƯ MỤC GỐC HEXA (cùng cấp frontend, backend).');
 return;
}
const changes=[],issues=[];
const encode=content=>content.replace(/\r\n/g,'\n');
const relPath=rel=>path.join(root,...rel.split('/'));
for(const p of payload.patches){
 const abs=relPath(p.path);
 if(!fs.existsSync(abs)){issues.push(`${p.path}: file gốc không tồn tại`);continue;}
 const content=fs.readFileSync(abs,'utf8'); const hadCRLF=content.includes('\r\n');
 let output=encode(content);
 // Preserve existing user-added column sorting in the warehouse table.
 if(p.path==='frontend/src/WarehouseManagement.jsx' && output.includes('stockSort')){
  const replaceUnique=(a,b)=>{
    if(output.includes(b))return;
    const pos=output.indexOf(a);
    if(pos<0 || output.indexOf(a,pos+1)!==-1)throw Error('Bản này thay đổi ở vị trí sắp xếp, không thể ghép an toàn.');
    output=output.slice(0,pos)+b+output.slice(pos+a.length);
  };
  try{
    replaceUnique(' const [editor,setEditor]=', ' const [onlyLow,setOnlyLow]=useState(false),[editor,setEditor]=');
    replaceUnique('&&(!term||[x.sku', '&&(!onlyLow||Number(x.quantity)<=Number(x.minQuantity??0))&&(!term||[x.sku');
    replaceUnique('[safeItems,kind,category,term]);','[safeItems,kind,category,term,onlyLow]);');
    const oldSummary="<div className=\"am-warehouse-summary\"><div><Boxes size={18}/> {visibleTotal} mã {onlyInk?'mực':'vật tư'}</div><div><AlertTriangle size={18}/> {visibleAlerts} mã cần nhập thêm</div></div>";
    const newSummary="<div className=\"am-warehouse-summary\"><div><Boxes size={18}/> {visibleTotal} mã {onlyInk?'mực':'vật tư'}</div><button type=\"button\" className={onlyLow?'am-btn am-primary':'am-btn am-light'} onClick={()=>setOnlyLow(v=>!v)}><AlertTriangle size={18}/> {visibleAlerts} mã cần nhập thêm {onlyLow?'· Đang lọc':''}</button></div>";
    const newAlert=" {visibleAlerts>0&&<div className=\"am-alert-line\" role=\"status\"><AlertTriangle size={16}/> Cảnh báo tồn kho: {safeItems.filter(x=>(onlyInk?x.category==='ink':kind==='warehouse'?x.category!=='ink':true)&&Number(x.quantity)<=Number(x.minQuantity??0)).slice(0,5).map(x=>`${x.sku} (${x.quantity}/${x.minQuantity||0})`).join(' · ')}. Nhấn nhãn cảnh báo để lọc.</div>}\n";
    replaceUnique(oldSummary,newSummary);
    if(!output.includes('className="am-alert-line"'))replaceUnique(newSummary+'\n',newSummary+'\n'+newAlert);
    if(hadCRLF)output=output.replace(/\n/g,'\r\n');
    if(output!==content)changes.push({rel:p.path,original:content,newContent:output});
  }catch(e){issues.push(p.path+': '+e.message);}
  continue;
 }
 for(let i=0;i<p.hunks.length;i++){
  const h=p.hunks[i],before=encode(h.before),after=encode(h.after);
  if(after && output.includes(after))continue;
  const pos=output.indexOf(before);
  if(pos<0){issues.push(`${p.path}: vùng cập nhật ${i+1} không còn khớp mã nguồn trên máy`);break;}
  if(before===after)continue;
  if(output.indexOf(before,pos+1)>=0){issues.push(`${p.path}: vùng cập nhật ${i+1} bị trùng, không dám ghi đè`);break;}
  output=output.slice(0,pos)+after+output.slice(pos+before.length);
 }
 if(hadCRLF)output=output.replace(/\n/g,'\r\n');
 if(output!==content)changes.push({rel:p.path,original:content,newContent:output});
}
for(const rel of payload.added){
 const current=relPath(rel),template=path.join(root,'payload','new',...rel.split('/'));
 if(!fs.existsSync(template)){issues.push(`Thiếu mã nguồn bổ sung: ${rel}`);continue;}
 const newContent=fs.readFileSync(template);
 if(fs.existsSync(current)){
  if(!fs.readFileSync(current).equals(newContent))issues.push(`File mới ${rel} đã tồn tại với nội dung khác, dừng để bảo vệ thay đổi của bạn.`);
 }else changes.push({rel,original:null,newContent});
}
if(issues.length){console.error('\nCác vị trí xung đột:');issues.forEach(x=>console.error(' - '+x));fail('KHÔNG thay đổi bất kỳ file nào. Hãy gửi App/AssetManagement hoặc file nêu trên để ghép đúng phiên bản.');return;}
if(!changes.length){console.log('[OK] Các chức năng đã được áp dụng trước đó, không cần cập nhật lại.');return;}
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const backupDir=path.resolve(root,'..','HEXA_BACKUP_5_FEATURES_'+stamp);
fs.mkdirSync(backupDir,{recursive:true});
let written=[];
try{
 for(const change of changes){
  const target=relPath(change.rel);
  if(change.original!==null){const backup=path.join(backupDir,...change.rel.split('/'));fs.mkdirSync(path.dirname(backup),{recursive:true});fs.writeFileSync(backup,change.original);}
 }
 for(const change of changes){
  const target=relPath(change.rel);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,change.newContent);written.push(change);
  console.log('[UPDATED] '+change.rel);
 }
 // No network, no npm install, no Firebase mutation. Built-in Node test runner only.
 const result=cp.spawnSync(process.platform==='win32'?'npm.cmd':'npm',['test'],{
   cwd:path.join(root,'backend'),stdio:'inherit',shell:process.platform==='win32',timeout:180000
 });
 if(result.status!==0)throw new Error('Backend tests không đạt sau cập nhật.');
 console.log('\n[OK] Cập nhật thành công. Backup code tại:',backupDir);
 console.log('Chạy lại backend/frontend nếu cần; kiểm tra tính năng local trước khi git push.');
}catch(err){
 console.error('[ERROR]',err.message,'\nĐang khôi phục toàn bộ file cũ...');
 for(const change of written.reverse()){
  const target=relPath(change.rel);
  if(change.original===null)fs.rmSync(target,{force:true});
  else fs.writeFileSync(target,change.original);
 }
 fail('Cập nhật được hoàn tác. Backup tại '+backupDir);
}
