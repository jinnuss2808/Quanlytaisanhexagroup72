// Pure helpers for asset auditing, stocktake verification, asset reporting and stock alerts.
import { assetError, asText, keyForCode } from './asset-core.js';

export const AUDIT_FIELDS = Object.freeze({
  assetCode:'Mã tài sản', assetName:'Tên tài sản', categoryId:'Loại tài sản',
  ownerDepartmentId:'Công ty sở hữu', userDepartment:'Phòng ban sử dụng',
  assignedTo:'Người sử dụng', ipAddress:'IP', serialNumber:'Serial',
  purchaseDate:'Ngày mua', purchasePrice:'Giá mua', status:'Trạng thái',
  location:'Vị trí', tonerType:'Loại mực', tonerStockItemId:'Mực liên kết',
  description:'Ghi chú'
});
export function auditChanges(before={},after={}) {
  return Object.entries(AUDIT_FIELDS).flatMap(([key,label])=>{
    const from=before[key]??null, to=after[key]??null;
    return String(from??'')===String(to??'')?[]:[{field:key,label,from,to}];
  });
}
export function lowStockItems(items, category='all') {
  return Object.values(items||{}).filter(x=>x && !x.deletedAt &&
    (category==='all'||x.category===category) && Number.isFinite(Number(x.quantity)) &&
    Number(x.quantity)<=Number(x.minQuantity??0)).sort((a,b)=>a.quantity-b.quantity || String(a.name).localeCompare(String(b.name),'vi'));
}
export function crossedStockThreshold(before,after) {
  if(!before||!after||after.deletedAt)return false;
  const oldQty=Number(before.quantity),newQty=Number(after.quantity),limit=Number(after.minQuantity??0);
  return Number.isFinite(oldQty)&&Number.isFinite(newQty)&&oldQty>limit&&newQty<=limit;
}
export function normalizeStocktakeCode(input) {
  let raw=asText(input,1200);
  try {
    const parsed=new URL(raw);
    // QR links are generated as /assets/<publicId>; accept only this route.
    if(parsed.pathname.startsWith('/assets/'))raw=decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop()||'');
  }catch{ /* Raw asset code, asset ID or public ID */ }
  if(!raw || raw.length>160 || /[\u0000-\u001F]/.test(raw))throw assetError(400,'Mã QR hoặc mã tài sản không hợp lệ.');
  return raw;
}
export function resolveStocktakeAsset(input,assets={},publicIds={},codeIndex={}) {
  const code=normalizeStocktakeCode(input);
  const direct=assets[code]?.id===code?code:null;
  const byPublic=publicIds[code];
  const byCode=codeIndex[keyForCode(code)];
  const assetId=direct||byPublic||byCode||Object.values(assets).find(a=>String(a.assetCode).toUpperCase()===code.toUpperCase())?.id;
  const asset=assets[assetId];
  if(!asset||asset.deletedAt)throw assetError(404,'Không tìm thấy tài sản tương ứng mã QR.');
  return asset;
}
export function stocktakeProgress(session,assets={}) {
  const expected=session?.expected||{};
  const scanned=session?.scans||{};
  const missing=Object.keys(expected).filter(id=>!scanned[id]);
  const found=Object.keys(scanned).filter(id=>expected[id]);
  return {expected:Object.keys(expected).length,found:found.length,missing:missing.length,
    missingAssets:missing.map(id=>({id,assetCode:assets[id]?.assetCode||expected[id]?.assetCode||id,assetName:assets[id]?.assetName||expected[id]?.assetName||''})),
    foundAssets:found.map(id=>({...scanned[id],assetCode:assets[id]?.assetCode||expected[id]?.assetCode||id}))};
}
export function assetReport(assets,categories={},departments={}) {
  const records=Object.values(assets||{}).filter(x=>x&&!x.deletedAt);
  function aggregate(key) {
    const groups=new Map();
    for(const a of records){
      const id=key==='company'?(a.ownerDepartmentId||'none'):(asText(a.userDepartment,100)||'none');
      const name=key==='company'?(departments[id]?.name||'Chưa xác định'):(id==='none'?'Chưa xác định':id);
      if(!groups.has(id))groups.set(id,{id,name,count:0,value:0,available:0,using:0,maintenance:0,broken:0,liquidated:0});
      const g=groups.get(id);g.count+=1;g.value+=Number(a.purchasePrice)||0;
      if(Object.hasOwn(g,a.status))g[a.status]++;
    }
    return [...groups.values()].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'vi'));
  }
  const totalValue=records.reduce((n,a)=>n+(Number(a.purchasePrice)||0),0);
  return {total:records.length,totalValue,companies:aggregate('company'),departments:aggregate('department'),generatedAt:Date.now()};
}
