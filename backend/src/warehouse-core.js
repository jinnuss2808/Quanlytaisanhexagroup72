import { assetError, asText } from './asset-core.js';

export const STOCK_CATEGORIES = Object.freeze({
  ink:'Mực in', mouse:'Chuột', keyboard:'Bàn phím', laptop:'Laptop (không mã riêng)',
  pc:'PC (không mã riêng)', spare:'Linh kiện', other:'Thiết bị khác'
});
export const STOCK_ACTIONS = ['receive','issue','adjust'];
export function quantity(value, field='Số lượng', {allowZero=false}={}) {
  const number=Number(value);
  if (!Number.isSafeInteger(number) || number < (allowZero?0:1) || number > 1_000_000)
    throw assetError(400,`${field} phải là số nguyên ${allowZero?'không âm':'dương'}, tối đa 1.000.000.`);
  return number;
}
export function normalizeStockItem(body={}) {
  const sku=asText(body.sku,100).toUpperCase();
  const name=asText(body.name,255);
  const category=asText(body.category,30);
  if(!sku || !name) throw assetError(400,'Mã kho và tên hàng là bắt buộc.');
  if(!Object.hasOwn(STOCK_CATEGORIES,category))throw assetError(400,'Loại thiết bị/vật tư không hợp lệ.');
  const minQuantity=quantity(body.minQuantity??0,'Tồn kho tối thiểu',{allowZero:true});
  const unitPrice=Number(body.unitPrice??0);
  if(!Number.isFinite(unitPrice)||unitPrice<0||unitPrice>1e15)throw assetError(400,'Đơn giá không hợp lệ.');
  return {sku,name,category,unit:asText(body.unit||'cái',40),minQuantity,unitPrice,
    location:asText(body.location,150),owner:asText(body.owner,150),note:asText(body.note,1000)};
}
export function stockChange(current,{type,amount,actualQuantity,recipient,reason,assetId,performedBy,opId,date}) {
  if(!current || current.deletedAt)throw assetError(404,'Không tìm thấy mặt hàng trong kho.');
  if(!STOCK_ACTIONS.includes(type))throw assetError(400,'Loại giao dịch kho không hợp lệ.');
  if(!opId || !/^[\w-]{6,130}$/.test(opId))throw assetError(400,'Mã giao dịch kho không hợp lệ.');
  if(current.movements?.[opId])return current;
  const before=quantity(current.quantity,'Tồn kho',{allowZero:true});
  const moved=type==='adjust' ? quantity(actualQuantity,'Tồn thực tế',{allowZero:true})-before : quantity(amount);
  if(type==='issue'&&!asText(recipient,200))throw assetError(400,'Nhập người nhận khi cấp phát.');
  const delta=type==='issue'?-moved:type==='receive'?moved:moved;
  const after=before+delta;
  if(after<0)throw assetError(409,`Không đủ tồn kho (hiện còn ${before}).`);
  if(after>1_000_000)throw assetError(400,'Vượt giới hạn tồn kho.');
  const now=Date.now();
  const movement={id:opId,type,before,delta,after,recipient:asText(recipient,200),reason:asText(reason,1000),
    assetId:asText(assetId,128),performedBy:asText(performedBy,150),date:asText(date,10)||new Date().toISOString().slice(0,10),at:now};
  return {...current,quantity:after,updatedAt:now,movements:{...current.movements,[opId]:movement}};
}
export function movementRows(stock){return Object.values(stock.movements||{}).sort((a,b)=>b.at-a.at);}
