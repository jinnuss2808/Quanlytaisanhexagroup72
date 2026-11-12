import test from 'node:test';
import assert from 'node:assert/strict';
import { isPrinterAsset, normalizePrinterDetails } from '../src/printer-core.js';
import { enrichAsset } from '../src/asset-core.js';

test('Máy in tạo riêng được nhận diện ngay cả khi tên không chứa từ máy in',()=>{
 assert.equal(isPrinterAsset({assetName:'LBP 2900',assetType:'printer'}),true);
 assert.equal(isPrinterAsset({assetName:'Canon MF443dw',isPrinter:true}),true);
 assert.equal(isPrinterAsset({assetName:'Laptop Dell'}),false);
});
test('Lưu tên máy, IP, loại mực đổ, vị trí và công ty sở hữu',()=>{
 const p=normalizePrinterDetails({name:'HP LaserJet Pro M404',ip:'192.168.1.55',tonerType:'HP 59A',location:'Tầng 3',ownerDepartmentId:'dept1',serialNumber:'ABC123'});
 assert.deepEqual({name:p.assetName,ip:p.ipAddress,ink:p.tonerType,location:p.location,owner:p.ownerDepartmentId},
 {name:'HP LaserJet Pro M404',ip:'192.168.1.55',ink:'HP 59A',location:'Tầng 3',owner:'dept1'});
});
test('Máy USB có thể không có IP; IPv6 cũng hợp lệ',()=>{
 assert.equal(normalizePrinterDetails({assetName:'Canon USB',tonerType:'Canon 303'}).ipAddress,null);
 assert.equal(normalizePrinterDetails({assetName:'Printer IPv6',ipAddress:'2001:db8::1',tonerType:'85A'}).ipAddress,'2001:db8::1');
});
test('Không chấp nhận IP sai hoặc thiếu tên máy/loại mực',()=>{
 assert.throws(()=>normalizePrinterDetails({assetName:'Test',tonerType:'85A',ipAddress:'300.300.0.1'}),/IP không hợp lệ/);
 assert.throws(()=>normalizePrinterDetails({assetName:'',tonerType:'85A'}),/tên máy in/);
 assert.throws(()=>normalizePrinterDetails({assetName:'HP',tonerType:''}),/loại mực/);
});
test('Chặn mã mực và công ty không hợp lệ',()=>{
 assert.throws(()=>normalizePrinterDetails({assetName:'HP',tonerType:'85A',tonerStockItemId:'../../x'}),/Mã mực/);
 assert.throws(()=>normalizePrinterDetails({assetName:'HP',tonerType:'85A',ownerDepartmentId:'a/b'}),/công ty/);
});

test('Máy in tạo riêng có loại Máy in trong danh sách tài sản dù chưa có danh mục',()=>{
 const a=enrichAsset({id:'a_1',assetType:'printer',isPrinter:true,assetName:'Canon LBP'}, {}, {});
 assert.equal(a.categoryName,'Máy in');
 assert.equal(a.categoryCode,'PRINTER');
});
