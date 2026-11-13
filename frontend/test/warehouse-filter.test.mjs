import {test} from 'node:test';
import assert from 'node:assert/strict';
import {findAssetCategoryIds, loadAvailableAssets} from '../src/warehouse-category-utils.js';
const catalogs=[{id:'lap',code:'LAPTOP',name:'Laptop'},{id:'pc',code:'PC',name:'Máy tính để bàn'},
  {id:'m',code:'MOUSE',name:'Chuột'}, {id:'printer',code:'PRINTER',name:'Máy in'}];
test('match common Vietnamese and English asset category names',()=>{
  assert.deepEqual(findAssetCategoryIds(catalogs,'laptop'), ['lap']);
  assert.deepEqual(findAssetCategoryIds(catalogs,'pc'), ['pc']);
  assert.deepEqual(findAssetCategoryIds(catalogs,'mouse'), ['m']);
});
test('warehouse filter sends categoryId to server', async()=>{
  let query='';
  const result=await loadAvailableAssets(async p=>{query=p;return {items:[{id:'a'}],total:1,totalPages:1,page:1}},
    {category:'laptop',catalogs,page:1,search:'MSI'});
  assert.match(query,/categoryId=lap/);
  assert.match(query,/search=MSI/);
  assert.equal(result.items.length,1);
});
test('all devices retains server pagination, not a local 50-item filter',async()=>{
  const calls=[];await loadAvailableAssets(async p=>{calls.push(p);return {items:[],total:0,totalPages:1}},
  {category:'all',catalogs,page:2});
  assert.match(calls[0],/page=2/);
  assert.doesNotMatch(calls[0],/categoryId=/);
});
test('unmatched category returns zero devices rather than all devices',async()=>{
  const r=await loadAvailableAssets(async()=>{throw Error('should not fetch');},{category:'spare',catalogs});
  assert.equal(r.total,0);
});
test('multiple matching catalog categories are combined and deduplicated',async()=>{
 const many=[{id:'a',code:'LAPTOP'},{id:'b',name:'Laptop Gaming'}];
 const r=await loadAvailableAssets(async url=>({items:[{id:'shared',createdAt:10},{id:url.includes('categoryId=a')?'a':'b',createdAt:20}],totalPages:1}),{category:'laptop',catalogs:many});
 assert.equal(r.total,3);
 assert.equal(r.items[0].createdAt,20);
});
test('column sorting survives a selected warehouse group',async()=>{
  let seen='';await loadAvailableAssets(async p=>{seen=p;return {items:[],total:0,page:1,totalPages:1}},
    {category:'pc',catalogs,sortBy:'assetName',sortDirection:'asc'});
  assert.match(seen,/sortBy=assetName/);
  assert.match(seen,/sortDirection=asc/);
  assert.match(seen,/categoryId=pc/);
});
