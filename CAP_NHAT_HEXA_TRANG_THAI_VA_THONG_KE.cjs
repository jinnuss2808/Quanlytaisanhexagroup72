#!/usr/bin/env node
// HEXA - targeted status transition and toolbar metrics fix.
// Patches only the required source files, preserving the rest of your project.
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');

const TAG='HEXA_STATUS_AND_STATS_20261119_V1';
const root=process.cwd();
const check=process.argv.includes('--check');
const paths={
  core:'backend/src/asset-core.js',
  api:'backend/src/asset-api.js',
  view:'frontend/src/AssetManagement.jsx',
  style:'frontend/src/asset-management.css',
  test:'backend/test/asset-status-recovery.test.js'
};
const full=(key)=>path.join(root,...paths[key].split('/'));
const fail=(message)=>{console.error('[STOP] '+message);process.exitCode=1;};
const requireOnce=(s,needle,file)=>{
  if(!s.includes(needle))throw Error(file+': Khong tim thay doan code can thay. Khong ghi de - kiem tra phien ban HEXA.');
  if(s.indexOf(needle)!==s.lastIndexOf(needle))throw Error(file+': Doan code xuat hien nhieu lan - can kiem tra thu cong.');
};
const helper=`\n// ${TAG}: keep legacy null/undefined assignee values equivalent.\nexport function prepareAssetStatusEdit(oldAsset, targetStatus) {\n  const originalAssignee = asText(oldAsset?.assignedTo,255) || null;\n  const previousStatus = asText(oldAsset?.status,30);\n  if (previousStatus === 'using' && targetStatus !== 'using')\n    throw assetError(409,'Hãy thu hồi tài sản trước khi đổi trạng thái.');\n  if (previousStatus !== 'using' && targetStatus === 'using')\n    throw assetError(409,'Hãy bàn giao để chuyển sang Đang sử dụng.');\n  // Imported legacy data sometimes retains a previous assignee on a broken asset.\n  // Marking that asset available closes the stale assignment and adds to audit.\n  const recoveredAssignee = originalAssignee && previousStatus !== 'available' &&\n    previousStatus !== 'using' && targetStatus === 'available' ? originalAssignee : null;\n  return {assignedTo: recoveredAssignee ? null : originalAssignee, recoveredAssignee};\n}\n`;
const apiBefore=`  const data=normalizeAsset({...old,...req.body,assignedTo:old.assignedTo});\n  if(data.assignedTo!==old.assignedTo)throw assetError(409,'Để thay đổi người sử dụng, hãy Bàn giao/Thu hồi.');\n  if(old.status==='using'&&data.status!=='using')throw assetError(409,'Hãy thu hồi tài sản trước khi đổi trạng thái.');\n  if(old.status!=='using'&&data.status==='using')throw assetError(409,'Hãy bàn giao để chuyển sang Đang sử dụng.');`;
const apiAfter=`  const data=normalizeAsset({...old,...req.body,assignedTo:old.assignedTo});\n  const previousAssignee=asText(old.assignedTo,255)||null;\n  if (Object.prototype.hasOwnProperty.call(req.body||{},'assignedTo') &&\n      (asText(req.body.assignedTo,255)||null)!==previousAssignee)\n    throw assetError(409,'Để thay đổi người sử dụng, hãy Bàn giao/Thu hồi.');\n  const transition=prepareAssetStatusEdit(old,data.status);`;
const style=`\n/* ${TAG}\n   Span the three readable metrics from Company filter through Refresh;\n   keep the More/Trash controls aligned with Add Asset in column 7. */\n@container hexa-toolbar (min-width:991px){\n  .am-root .am-tabs-toolbar.am-tabs-with-stats .am-inline-stats{\n    display:grid!important;grid-column:2/7!important;grid-row:1!important;\n    grid-template-columns:repeat(3,minmax(0,1fr))!important;\n    column-gap:var(--hexa-tools-gap,6px)!important;\n    width:100%!important;min-width:0!important;align-items:center!important;\n  }\n  .am-root .am-tabs-toolbar.am-tabs-with-stats .am-inline-stat:nth-child(n){\n    grid-column:auto!important;grid-row:auto!important;\n    display:flex!important;justify-content:center!important;align-items:center!important;\n    min-width:0!important;width:100%!important;height:34px!important;\n    padding:4px 9px!important;gap:7px!important;\n    font-size:12.5px!important;font-weight:700!important;\n  }\n  .am-root .am-tabs-toolbar.am-tabs-with-stats .am-inline-stat svg{\n    width:15px!important;height:15px!important;flex:0 0 15px!important;\n  }\n  .am-root .am-tabs-toolbar.am-tabs-with-stats .am-inline-stat span{\n    font-size:12.5px!important;line-height:1.3!important;overflow:hidden;text-overflow:ellipsis;\n  }\n  .am-root .am-tabs-toolbar.am-tabs-with-stats .am-inline-stat strong{\n    font-size:16px!important;font-weight:800!important;font-variant-numeric:tabular-nums;\n  }\n}\n@container hexa-toolbar (max-width:990px){\n  .am-root .am-tabs-with-stats .am-inline-stats{\n    width:100%!important;justify-content:space-between!important;gap:7px!important;\n  }\n  .am-root .am-tabs-with-stats .am-inline-stat{\n    justify-content:center!important;font-size:12px!important;gap:6px!important;\n  }\n  .am-root .am-tabs-with-stats .am-inline-stat strong{font-size:15px!important}\n  .am-root .am-tabs-with-stats .am-inline-stat svg{width:14px!important;height:14px!important}\n}\n`;
const testContent=`import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport {prepareAssetStatusEdit} from '../src/asset-core.js';\n\ntest('broken legacy asset without assignedTo can become available',()=>{\n assert.deepEqual(prepareAssetStatusEdit({status:'broken'},'available'),{assignedTo:null,recoveredAssignee:null});\n});\ntest('maintenance legacy asset with null assignedTo can become available',()=>{\n assert.deepEqual(prepareAssetStatusEdit({status:'maintenance',assignedTo:null},'available'),{assignedTo:null,recoveredAssignee:null});\n});\ntest('broken legacy asset with stale user releases old assignee',()=>{\n assert.deepEqual(prepareAssetStatusEdit({status:'broken',assignedTo:'Nguyen Van A'},'available'),{assignedTo:null,recoveredAssignee:'Nguyen Van A'});\n});\ntest('active assignment must use return endpoint',()=>{\n assert.throws(()=>prepareAssetStatusEdit({status:'using',assignedTo:'A'},'available'),/thu hồi/);\n});\ntest('cannot assign by changing status directly',()=>{\n assert.throws(()=>prepareAssetStatusEdit({status:'available'},'using'),/bàn giao/);\n});\ntest('no user data lost when editing a non-using state without recovery',()=>{\n assert.deepEqual(prepareAssetStatusEdit({status:'broken',assignedTo:'A'},'broken'),{assignedTo:'A',recoveredAssignee:null});\n});\n`;
const matchStatus=`      return {...current,...data,assignedTo:current.assignedTo,updatedAt:Date.now()};`;
const statusReplace=`      return {...current,...data,assignedTo:transition.assignedTo,updatedAt:Date.now()};`;
const historyBefore=`  await addLog(id,'updated',req.it,{summary:'Đã sửa thông tin tài sản',changes:auditChanges(old,changed)});res.json(changed);`;
const historyAfter=`  if(transition.recoveredAssignee){\n    const records=await obj(\`assetAssignments/\${id}\`);\n    const ongoing=Object.values(records).filter(x=>!x.returnedAt)\n      .sort((a,b)=>(b.assignedAt||0)-(a.assignedAt||0))[0];\n    if(ongoing){\n      await db.ref(\`assetAssignments/\${id}/\${ongoing.id}\`).update({\n        returnedAt:Date.now(),returnedDate:new Date().toISOString().slice(0,10),\n        returnedBy:req.it.uid,returnNote:'Thu hồi người sử dụng cũ khi khôi phục tài sản về Có sẵn'\n      });\n    }\n  }\n  await addLog(id,'updated',req.it,{summary:transition.recoveredAssignee\n    ?'Khôi phục về Có sẵn và thu hồi người sử dụng cũ':'Đã sửa thông tin tài sản',\n    changes:auditChanges(old,changed)});res.json(changed);`;
const assignmentBefore=`<button title={item.status==='using'?'Thu hồi':'Bàn giao'} onClick={()=>setAssigning(item)}><ArrowRightLeft size={15}/></button>`;
const assignmentAfter=`<button title={item.status==='using'?'Thu hồi':item.status==='available'?'Bàn giao':'Chuyển về Có sẵn trước khi bàn giao'} onClick={()=>{if(item.status==='using'||item.status==='available')setAssigning(item);else{setEditing(item);setNotice('Hãy chuyển tài sản về Có sẵn, lưu lại rồi mới bàn giao.');}}}><ArrowRightLeft size={15}/></button>`;
const noteBefore=`      <div className="am-note"><Info size={15}/> Công ty sở hữu không tự thay đổi khi bàn giao. Chỉnh người sử dụng qua chức năng “Bàn giao / Thu hồi” để lưu lịch sử.</div>`;
const noteAfter=noteBefore+`\n      {edit && item?.assignedTo && item.status!=='available' && item.status!=='using' && form.status==='available' &&\n        <div className="am-note"><Info size={15}/> Tài sản còn người sử dụng cũ: <b>{item.assignedTo}</b>. Khi lưu về Có sẵn, hệ thống sẽ thu hồi người sử dụng cũ và ghi lịch sử.</div>}`;
function patch(){
  const files={};
  for(const k of ['core','api','view','style']){
    if(!fs.existsSync(full(k)))throw Error('Thieu file '+paths[k]+'. Dat script cung cap voi frontend/ va backend/.');
    files[k]=fs.readFileSync(full(k),'utf8');
  }
  if(!files.style.includes('am-tabs-with-stats')||!files.view.includes('am-inline-stats'))
    throw Error('Frontend chua co thanh thong ke cung hang - can ap dung ban giao dien truoc. Khong ghi de.');
  const alreadyCore=files.core.includes(TAG);
  const alreadyApi=files.api.includes('const transition=prepareAssetStatusEdit(old,data.status);');
  const alreadyCSS=files.style.includes(TAG);
  const alreadyUI=files.view.includes('Chuyển về Có sẵn trước khi bàn giao');
  if(alreadyCore!==alreadyApi)throw Error('Backend chua dong bo patch; can doi chieu truoc khi ghi de.');
  if(alreadyApi && (!files.api.includes('transition.recoveredAssignee')||!files.api.includes('assignedTo:transition.assignedTo')))
    throw Error('Backend patch co mot phan nhung thieu noi dung.');
  if(!alreadyCore){
    const needle='export function enrichAsset(asset, cats = {}, depts = {}) {';
    requireOnce(files.core,needle,paths.core);
    files.core=files.core.replace(needle,helper+needle);
  }
  if(!alreadyApi){
    const importNeedle='assetUUID, enrichAsset, selectAssets';
    requireOnce(files.api,importNeedle,paths.api);
    files.api=files.api.replace(importNeedle,'assetUUID, prepareAssetStatusEdit, enrichAsset, selectAssets');
    requireOnce(files.api,apiBefore,paths.api);
    files.api=files.api.replace(apiBefore,apiAfter);
    requireOnce(files.api,matchStatus,paths.api);
    files.api=files.api.replace(matchStatus,statusReplace);
    requireOnce(files.api,historyBefore,paths.api);
    files.api=files.api.replace(historyBefore,historyAfter);
  }
  if(!alreadyUI){
    requireOnce(files.view,assignmentBefore,paths.view);
    files.view=files.view.replace(assignmentBefore,assignmentAfter);
  }
  if(!files.view.includes('Tài sản còn người sử dụng cũ:')){
    requireOnce(files.view,noteBefore,paths.view);
    files.view=files.view.replace(noteBefore,noteAfter);
  }
  if(!alreadyCSS)files.style=files.style.trimEnd()+'\n'+style;
  const additions={};
  if(!fs.existsSync(full('test')))additions.test=testContent;
  else if(!fs.readFileSync(full('test'),'utf8').includes('prepareAssetStatusEdit'))
    throw Error('Ten file test trung nhung noi dung khac.');
  const changes=Object.entries(files).filter(([k,v])=>v!==fs.readFileSync(full(k),'utf8'));
  const actions=[...changes.map(([k])=>paths[k]),...Object.keys(additions).map(k=>paths[k])];
  console.log(check?'[CHECK] Kiem tra file, khong ghi du lieu.':'[APPLY] Cap nhat source.');
  if(!actions.length){console.log('[OK] Da cap nhat truoc do, khong co gi can thay doi.');return;}
  for(const rel of actions)console.log(' - '+rel);
  if(check){console.log('[CHECK OK] Dung cau truc, co the chay khong kem --check.');return;}
  const backup=path.join(os.tmpdir(),'HEXA-status-layout-backup-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomBytes(3).toString('hex'));
  for(const [k] of changes){const dest=path.join(backup,...paths[k].split('/'));fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(full(k),dest);}
  // Source writes are atomic per file; on partial failure, restore existing files.
  const saved=[];
  try{
    for(const [k,value] of changes){const dest=full(k);const tmp=dest+'.hexa_tmp_'+process.pid;fs.writeFileSync(tmp,value,'utf8');fs.renameSync(tmp,dest);saved.push(k);}
    for(const [k,value] of Object.entries(additions)){fs.mkdirSync(path.dirname(full(k)),{recursive:true});fs.writeFileSync(full(k),value,'utf8');}
  }catch(error){for(const k of saved){const src=path.join(backup,...paths[k].split('/'));fs.copyFileSync(src,full(k));}throw error;}
  console.log('[OK] Da cap nhat. Backup: '+backup);
  console.log('Tiep: cd backend; npm test; cd ../frontend; npm run build');
  console.log('Sau do push 5 file frontend/backend va test moi len GitHub.');
}
try{patch()}catch(e){fail(e.message)}
