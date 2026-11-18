import test from 'node:test';
import assert from 'node:assert/strict';
import {listPrinterActivity} from '../src/printer-activity.js';

const printers = [
  {id:'a1',assetCode:'HXG-R6054',assetName:'Ricoh 6054',ipAddress:'192.168.1.214'},
  {id:'a2',assetCode:'HXG-HP',assetName:'HP M404',ipAddress:'192.168.1.215'},
  {id:'a3',assetCode:'HXG-OLD',assetName:'Canon cũ',deletedAt:123}
];
const data={
  a1:{
    toner:{id:'toner',type:'replace_toner',summary:'Đổ 1 túi VMAX 6054',notes:'Đã kiểm tra',date:'2026-11-18',at:1794970200000,byName:'IT A'},
    service:{id:'service',type:'printer_service',summary:'Sửa kẹt giấy',at:1794960000000,byName:'IT B',replacedParts:'Lô sấy',cost:250000},
    meta:{type:'created',at:9999999999999}
  },
  a2:{s:{id:'s',type:'maintenance',summary:'Bảo dưỡng',at:1794970400000}},
  a3:{s:{id:'s',type:'repair',summary:'Lỗi sấy',at:100}},
  other:{s:{id:'s',type:'replace_toner',at:1000}}
};

test('gộp đổ mực và sửa chữa của nhiều máy, không lẫn nhật ký CRUD',()=>{
 const x=listPrinterActivity(printers,data);
 assert.equal(x.total,4);
 assert.equal(x.items[0].assetName,'HP M404');
 assert.equal(x.items[1].assetName,'Ricoh 6054');
 assert.equal(x.items[1].ipAddress,'192.168.1.214');
 assert.equal(x.items[1].type,'replace_toner');
 assert.equal(x.items[2].type,'printer_service');
 assert.equal(x.items[3].deleted,true);
});
test('lọc đổ mực và sửa chữa không bị trùng, tìm bằng tên máy và IP',()=>{
 assert.equal(listPrinterActivity(printers,data,{kind:'toner'}).total,1);
 assert.equal(listPrinterActivity(printers,data,{kind:'repair'}).total,3);
 assert.equal(listPrinterActivity(printers,data,{search:'ricoh'}).total,2);
 assert.equal(listPrinterActivity(printers,data,{search:'192.168.1.214'}).total,2);
 assert.equal(listPrinterActivity(printers,data,{search:'lô sấy'}).total,1);
});
test('phân trang không làm mất tổng số lịch sử',()=>{
 const result=listPrinterActivity(printers,data,{page:2,pageSize:2});
 assert.equal(result.total,4);
 assert.equal(result.totalPages,2);
 assert.equal(result.items.length,2);
 assert.equal(result.items[0].type,'printer_service');
});
test('chịu dữ liệu rỗng và sự kiện lỗi',()=>{
 assert.equal(listPrinterActivity([],{}).total,0);
 assert.equal(listPrinterActivity([{id:'x'}],{x:{one:null,two:{type:'wrong'},three:{type:'repair',at:'abc'}}}).total,1);
});
