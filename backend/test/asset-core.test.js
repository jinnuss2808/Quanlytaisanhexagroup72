import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAsset,keyForCode,selectAssets,parseCSV,mapLegacyCSV,toCSV,assetStatusName} from '../src/asset-core.js';

test('tài sản hợp lệ được chuẩn hóa và giữ công ty sở hữu',()=>{
 const a=normalizeAsset({assetCode:' H-LAP-01 ',assetName:' Laptop ',ownerDepartmentId:'hexa',status:'available'});
 assert.equal(a.assetCode,'H-LAP-01');assert.equal(a.ownerDepartmentId,'hexa');assert.equal(a.purchasePrice,null);
});
test('kiểm tra trạng thái và trường bắt buộc',()=>{
 assert.throws(()=>normalizeAsset({assetName:'A'}),/Mã tài sản/);
 assert.throws(()=>normalizeAsset({assetName:'A',assetCode:'A',status:'hacked'}),/Trạng thái/);
 assert.throws(()=>normalizeAsset({assetName:'A',assetCode:'A',purchasePrice:-99}),/Giá mua/);
});
test('mã tài sản phân biệt hoa thường một cách an toàn',()=>{
 assert.equal(keyForCode(' hexa-01 '),keyForCode('HEXA-01'));
 assert.notEqual(keyForCode('HEXA-01'),keyForCode('HEXA-02'));
});
test('lọc công ty, loại, trạng thái, phân trang, thùng rác',()=>{
 const rows=[{id:'1',assetCode:'A1',assetName:'Laptop',ownerDepartmentId:'H',status:'available',createdAt:100},
  {id:'2',assetCode:'A2',assetName:'Màn hình',ownerDepartmentId:'B',status:'using',createdAt:200},
  {id:'3',assetCode:'A3',assetName:'PC',ownerDepartmentId:'H',status:'broken',createdAt:300,deletedAt:1}];
 assert.equal(selectAssets(rows,{ownerDepartmentId:'H'}).total,1);
 assert.equal(selectAssets(rows,{trash:'1'}).total,1);
 assert.equal(selectAssets(rows,{status:'using'}).items[0].id,'2');
 assert.equal(selectAssets(rows,{pageSize:1}).totalPages,2);
});
test('đọc CSV có BOM, dấu nháy, xuống dòng và ký tự phẩy',()=>{
 const rows=parseCSV('\uFEFFAssetCode,AssetName,Description\r\nA1,"Dell, Laptop","Hai dòng\nOK"\r\n');
 assert.equal(rows.length,1);assert.equal(rows[0].AssetName,'Dell, Laptop');assert.equal(rows[0].Description,'Hai dòng\nOK');
});
test('CSV tự phát hiện dấu chấm phẩy',()=>{
 assert.equal(parseCSV('AssetCode;AssetName\nA;PC')[0].AssetName,'PC');
 assert.throws(()=>parseCSV('a,b\n"unfinished'),/chưa được đóng/);
});
test('đổi cột SQL xuất CSV thành bản ghi Firebase',()=>{
 const row={AssetCode:'H1',AssetName:'Dell',CategoryCode:'LAPTOP',DepartmentCode:'HEXA',Status:'using',AssignedTo:'NV1'};
 const obj=mapLegacyCSV(row,{d1:{code:'HEXA',name:'HEXA'}},{c1:{code:'LAPTOP',name:'Máy tính'}});
 assert.equal(obj.ownerDepartmentId,'d1');assert.equal(obj.categoryId,'c1');assert.equal(obj.assignedTo,'NV1');
 assert.throws(()=>mapLegacyCSV({...row,DepartmentCode:'UNKNOWN'}, {}, {c1:{code:'LAPTOP'}}),/công ty/);
});
test('xuất CSV chống công thức injection',()=>{
 const csv=toCSV([{code:'=cmd|evil',name:'"quoted"'}],[['Code','code'],['Name','name']]);
 assert.ok(csv.includes("'=cmd|evil"));assert.ok(csv.includes('""quoted""'));
});
test('trạng thái có tiếng Việt',()=>assert.equal(assetStatusName.liquidated,'Đã thanh lý'));
test('nhập CSV chuyển từ file Excel tiếng Việt của project tài sản cũ',()=>{
 const source=parseCSV('Mã tài sản,Loại,Tên tài sản,Công ty,Người sử dụng,Địa chỉ IP,Serial,Ngày mua,Giá mua,Trạng thái,Ghi chú\nTS001,Laptop,Dell 5450,HEXA,Nguyễn Văn A,10.0.0.1,SN1,13/01/2025,10500000,Đang cấp phát,Đã giao');
 const r=mapLegacyCSV(source[0],{d1:{code:'HEXA',name:'Công ty HEXA'}},{c1:{code:'LAPTOP',name:'Laptop'}});
 assert.equal(r.ownerDepartmentId,'d1');assert.equal(r.categoryId,'c1');assert.equal(r.purchaseDate,'2025-01-13');assert.equal(r.status,'using');assert.equal(r.assetCode,'TS001');
});
