import test from 'node:test';
import assert from 'node:assert/strict';
import {writeAssetExcel,readAssetExcel,EXCEL_HEADERS} from '../src/asset-excel.js';
import {prepareExcelImport} from '../src/asset-xlsx-import.js';
import {keyForCode} from '../src/asset-core.js';
test('Excel export and import has exact 8 Vietnamese columns',()=>{
 const wb=writeAssetExcel([{assetCode:'PC001',categoryName:'PC',assetName:'Dell 5000',ownerDepartmentName:'HXG',assignedTo:'An',purchasePrice:2000000,description:'Đã kiểm tra',ipAddress:'192.168.1.20'}]);
 const rows=readAssetExcel(wb);
 assert.deepEqual(rows[0].values,['PC001','PC','Dell 5000','HXG','An','2000000','Đã kiểm tra','192.168.1.20']);
 assert.equal(EXCEL_HEADERS.length,8);
});
test('Excel import creates categories and departments and assigned history flag',()=>{
 const rows=[{row:2,values:['PC001','PC','PC Dell','HXG','An',1200000,'', '10.0.0.1']},
             {row:3,values:['INK01','Mực in','Hộp mực','HXG','','250000','','']}];
 const result=prepareExcelImport(rows);
 assert.equal(result.assets.length,2);
 assert.equal(result.newCategories.length,2);
 assert.equal(result.newDepartments.length,1);
 assert.equal(result.assets[0].status,'using');assert.equal(result.assets[1].status,'available');
 assert.equal(result.errors.length,0);
});
test('Excel repeated asset code skipped without duplicating',()=>{
 const rows=[{row:2,values:['X','PC','test','HXG','',100,'','']},{row:3,values:['X','PC','test','HXG','',100,'','']}];
 const result=prepareExcelImport(rows);
 assert.equal(result.assets.length,1);assert.equal(result.skipped,1);
 const noChange=prepareExcelImport(rows,{}, {},new Set([keyForCode('X')]));
 assert.equal(noChange.assets.length,0);assert.equal(noChange.skipped,2);
});
test('Excel malformed prices reject whole input plan',()=>{
 const rows=[{row:2,values:['PC001','PC','Dell','HXG','',-100,'','']}];
 const r=prepareExcelImport(rows);assert.equal(r.assets.length,0);assert.equal(r.errors[0].row,2);
});
