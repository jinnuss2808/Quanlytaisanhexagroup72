import test from 'node:test';
import assert from 'node:assert/strict';
import { selectAssets } from '../src/asset-core.js';

const rows=[
 {id:'a',assetCode:'A-10',assetName:'Máy 10',ownerDepartmentName:'B',status:'using',serialNumber:'S-20',ipAddress:'10.0.0.20',createdAt:100},
 {id:'b',assetCode:'A-2',assetName:'Máy 2',ownerDepartmentName:'A',status:'available',serialNumber:'',ipAddress:'10.0.0.2',createdAt:200},
 {id:'c',assetCode:'A-1',assetName:'Máy 1',ownerDepartmentName:'C',status:'using',serialNumber:'S-1',createdAt:300}
];
test('sort assetCode naturally across pages',()=>{
 const a=selectAssets(rows,{sortBy:'assetCode',sortDirection:'asc',pageSize:1,page:1});
 const b=selectAssets(rows,{sortBy:'assetCode',sortDirection:'asc',pageSize:1,page:2});
 assert.equal(a.items[0].assetCode,'A-1');assert.equal(b.items[0].assetCode,'A-2');
});
test('clear sort restores default createdAt descending',()=>{
 assert.deepEqual(selectAssets(rows,{sortBy:'',pageSize:20}).items.map(x=>x.id),['c','b','a']);
});
test('sort assignedTo and serialOrIp is supported',()=>{
 assert.equal(selectAssets(rows,{sortBy:'serialOrIp',sortDirection:'asc'}).items[0].id,'b');
 assert.equal(selectAssets(rows,{sortBy:'ownerDepartmentName',sortDirection:'asc'}).items[0].id,'b');
});
