import test from 'node:test';
import assert from 'node:assert/strict';
import { auditChanges,lowStockItems,crossedStockThreshold,normalizeStocktakeCode,resolveStocktakeAsset,stocktakeProgress,assetReport } from '../src/asset-ops.js';
import { normalizeAsset } from '../src/asset-core.js';
import { BACKUP_PATHS,zippedInventoryBackup } from '../src/asset-backup.js';
import { gunzipSync } from 'node:zlib';

test('asset changes audit shows before and after, excluding equal fields',()=>{
 const x=auditChanges({assetName:'HP',status:'available',purchasePrice:0},{assetName:'Dell',status:'available',purchasePrice:200000});
 assert.deepEqual(x.map(y=>y.field),['assetName','purchasePrice']);
 assert.equal(x[0].from,'HP');assert.equal(x[0].to,'Dell');
});
test('asset accepts user department for departmental reporting',()=>{
 assert.equal(normalizeAsset({assetCode:'a',assetName:'b',userDepartment:'Kế toán'}).userDepartment,'Kế toán');
});
test('stock alert only on crossing from above minimum to below/equal',()=>{
 assert.equal(crossedStockThreshold({quantity:4},{quantity:3,minQuantity:3}),true);
 assert.equal(crossedStockThreshold({quantity:3},{quantity:2,minQuantity:3}),false);
 assert.equal(crossedStockThreshold({quantity:2},{quantity:10,minQuantity:3}),false);
});
test('stock low inventory correctly filters deleted stock and category',()=>{
 const x=lowStockItems({a:{id:'a',name:'Mực HP',quantity:2,minQuantity:2,category:'ink'},b:{id:'b',quantity:9,minQuantity:2,category:'ink'},c:{id:'c',quantity:0,minQuantity:2,category:'spare'},d:{id:'d',quantity:0,minQuantity:2,category:'ink',deletedAt:1}},'ink');
 assert.equal(x.length,1);assert.equal(x[0].id,'a');
});
test('stocktake QR URL resolves to existing asset by public id',()=>{
 const a={id:'a_01',assetCode:'HEXA-001',assetName:'HP'};
 assert.equal(normalizeStocktakeCode('https://example.com/assets/abcd-1234'),'abcd-1234');
 assert.deepEqual(resolveStocktakeAsset('https://example.com/assets/abcd-1234',{a_01:a},{'abcd-1234':'a_01'},{}),a);
});
test('stocktake rejects stale assets',()=>{
 assert.throws(()=>resolveStocktakeAsset('x',{a:{id:'a',assetCode:'x',deletedAt:1}},{},{}),/Không tìm thấy/);
});
test('stocktake progress computes missing and scanned without counting extras',()=>{
 const s={expected:{a:{assetCode:'A'},b:{assetCode:'B'}},scans:{a:{at:111},x:{at:222}}};
 const r=stocktakeProgress(s,{});assert.equal(r.expected,2);assert.equal(r.found,1);assert.equal(r.missing,1);assert.equal(r.missingAssets[0].assetCode,'B');
});
test('report groups by company, department, and value',()=>{
 const a={a:{ownerDepartmentId:'c1',userDepartment:'IT',purchasePrice:100,status:'using'},b:{ownerDepartmentId:'c1',userDepartment:'IT',purchasePrice:200,status:'available'},c:{ownerDepartmentId:'c2',userDepartment:'HR',purchasePrice:50,status:'maintenance'},d:{deletedAt:1,ownerDepartmentId:'c2',purchasePrice:999}};
 const r=assetReport(a,{}, {c1:{name:'HEXA'},c2:{name:'B'}});
 assert.equal(r.total,3);assert.equal(r.totalValue,350);assert.equal(r.companies[0].count,2);assert.equal(r.companies[0].value,300);assert.equal(r.departments[0].name,'IT');
});
test('manual backup never contains authentication passwords',()=>{
 assert.equal(BACKUP_PATHS.includes('users'),false);assert.equal(BACKUP_PATHS.includes('requesters'),false);
 const archived=zippedInventoryBackup({schema:'test',data:{assets:{a:{assetCode:'A'}}}});
 assert.equal(JSON.parse(gunzipSync(archived)).data.assets.a.assetCode,'A');
});
