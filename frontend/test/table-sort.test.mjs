import test from 'node:test';
import assert from 'node:assert/strict';
import { toggleColumnSort, sortVisibleRows } from '../src/table-sort.js';

test('first click sorts, second clears, switching columns sorts new column',()=>{
 assert.equal(toggleColumnSort('','sku'),'sku');
 assert.equal(toggleColumnSort('sku','sku'),'');
 assert.equal(toggleColumnSort('sku','name'),'name');
});
test('numeric order and original order restored without mutation',()=>{
 const rows=[{id:1,quantity:10},{id:2,quantity:2},{id:3,quantity:5}];
 assert.deepEqual(sortVisibleRows(rows,'quantity').map(x=>x.id),[2,3,1]);
 assert.deepEqual(sortVisibleRows(rows,'').map(x=>x.id),[1,2,3]);
 assert.deepEqual(rows.map(x=>x.id),[1,2,3]);
});
test('natural alphanumeric sort with stable ties and missing values last',()=>{
 const rows=[{id:1,sku:'SP-10'},{id:2,sku:'SP-2'},{id:3,sku:'SP-2'},{id:4}];
 assert.deepEqual(sortVisibleRows(rows,'sku').map(x=>x.id),[2,3,1,4]);
});
