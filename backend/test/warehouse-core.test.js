import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeStockItem,stockChange,quantity,movementRows} from '../src/warehouse-core.js';
const item={id:'w1',sku:'INK-01',name:'Mực 12A',category:'ink',quantity:4,unit:'hộp',minQuantity:2,movements:{}};
const op=(type,extra={})=>({type,opId:`op-${type}-12345`,performedBy:'IT',amount:1,recipient:'Nhân viên',...extra});
test('validate item codes and categories',()=>{
 assert.equal(normalizeStockItem({sku:'ink-01',name:'Mực 12A',category:'ink'}).sku,'INK-01');
 assert.throws(()=>normalizeStockItem({sku:'',name:'x',category:'ink'}));
 assert.throws(()=>normalizeStockItem({sku:'x',name:'y',category:'unknown'}));
});
test('quantity positive integer only for issue',()=>{
 assert.equal(quantity('10'),10);assert.throws(()=>quantity(-1));assert.throws(()=>quantity(1.2));
});
test('issue inventory reduces stock and records recipient',()=>{
 const x=stockChange(item,op('issue',{amount:2,recipient:'Trần A'}));
 assert.equal(x.quantity,2);assert.equal(x.movements['op-issue-12345'].recipient,'Trần A');
 assert.equal(movementRows(x).length,1);
});
test('no negative inventory on issue',()=>assert.throws(()=>stockChange(item,op('issue',{amount:5})),/Không đủ/));
test('stock receive increments',()=>assert.equal(stockChange(item,op('receive',{amount:3})).quantity,7));
test('actual inventory adjustment',()=>assert.equal(stockChange(item,op('adjust',{actualQuantity:1})).quantity,1));
test('repeated idempotency key is not double counted',()=>{
 const x=stockChange(item,op('issue'));const y=stockChange(x,op('issue'));assert.equal(x.quantity,y.quantity);
});
test('must have recipient when issuing',()=>assert.throws(()=>stockChange(item,op('issue',{recipient:''})),/người nhận/));
