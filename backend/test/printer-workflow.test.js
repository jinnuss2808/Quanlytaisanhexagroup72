import test from 'node:test';
import assert from 'node:assert/strict';
import { isPrinterAsset,validatePrinterToner } from '../src/printer-core.js';
import { stockChange } from '../src/warehouse-core.js';
import { canUseUrgent,requesterLevel } from '../src/requester-account.js';

const printer={id:'a_p1',assetName:'Máy in HP LaserJet 1020',assetCode:'HEXA-PR-01'};
const ink={id:'w_1',sku:'INK-01',category:'ink',quantity:2,movements:{}};
test('Máy in được nhận diện từ tên tiếng Việt và mã danh mục',()=>{
 assert.equal(isPrinterAsset(printer),true);
 assert.equal(isPrinterAsset({assetName:'Lenovo ThinkPad',categoryName:'LAPTOP'}),false);
 assert.equal(isPrinterAsset({assetName:'Canon',categoryCode:'PRINTER'}),true);
});
test('Chỉ mực trong kho có thể đổ và mỗi lượt luôn trừ 1',()=>{
 const input=validatePrinterToner({printer,stock:ink,stockItemId:'w_1',operationId:'12345678'});
 assert.equal(input.stockItemId,'w_1');
 const after=stockChange(ink,{type:'issue',amount:1,recipient:'Máy in HEXA-PR-01',reason:'Đổ mực',opId:'printer_toner_12345678'});
 assert.equal(after.quantity,1);
 assert.equal(after.movements.printer_toner_12345678.delta,-1);
 const retried=stockChange(after,{type:'issue',amount:1,recipient:'Máy in HEXA-PR-01',reason:'Đổ mực',opId:'printer_toner_12345678'});
 assert.equal(retried.quantity,1,'Gửi lại cùng request không được trừ 2 lần');
});
test('Tồn kho bằng 0 không thể đổ, trừ thao tác đang được khôi phục',()=>{
 assert.throws(()=>validatePrinterToner({printer,stock:{...ink,quantity:0},stockItemId:'w_1',operationId:'12345678'}),/hết tồn kho/);
 assert.doesNotThrow(()=>validatePrinterToner({printer,stock:{...ink,quantity:0,movements:{printer_toner_12345678:{id:'printer_toner_12345678'}}},stockItemId:'w_1',operationId:'12345678'}));
});
test('Không dùng kho khác loại mực và tài sản không phải máy in',()=>{
 assert.throws(()=>validatePrinterToner({printer,stock:{...ink,category:'mouse'},stockItemId:'w_1',operationId:'12345678'}),/không phải mực/);
 assert.throws(()=>validatePrinterToner({printer:{assetName:'Laptop Dell'},stock:ink,stockItemId:'w_1',operationId:'12345678'}),/không phải máy in/);
});
test('Ưu tiên Khẩn cấp chỉ cấp quản lý đã được Admin phê duyệt',()=>{
 assert.equal(requesterLevel('manager'),'manager');
 assert.equal(requesterLevel('other'),'employee');
 assert.equal(canUseUrgent({jobLevel:'manager',jobLevelApproved:false,active:true}),false);
 assert.equal(canUseUrgent({jobLevel:'manager',jobLevelApproved:true,active:true}),true);
 assert.equal(canUseUrgent({jobLevel:'employee',jobLevelApproved:true,active:true}),false);
 assert.equal(canUseUrgent({jobLevel:'manager',jobLevelApproved:true,active:false}),false);
});
