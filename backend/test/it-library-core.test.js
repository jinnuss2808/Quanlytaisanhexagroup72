import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeLibraryFields, normalizeExternalUrl, validateFile, libId, buildStoragePath, hasPrinter,
  MAX_UPLOAD_BYTES,
} from '../src/it-library-core.js';

test('accepts four supported categories',()=>{
  for(const category of ['software','printer_driver','script','document'])assert.equal(normalizeLibraryFields({title:'Tên',category}).category,category);
});
test('requires title and correct category',()=>{
  assert.throws(()=>normalizeLibraryFields({title:'',category:'script'}));
  assert.throws(()=>normalizeLibraryFields({title:'A',category:'untrusted'}));
});
test('deduplicates and validates printer ids',()=>{
  assert.deepEqual(normalizeLibraryFields({title:'A',category:'printer_driver',printerIds:['a_1','a_1']}).printerIds,['a_1']);
  assert.throws(()=>normalizeLibraryFields({title:'A',category:'script',printerIds:['a_1']}));
  assert.throws(()=>normalizeLibraryFields({title:'A',category:'printer_driver',printerIds:['bad/id']}));
});
test('HTTPS only, no embedded credentials',()=>{
  assert.equal(normalizeExternalUrl('https://example.com/a').startsWith('https://'),true);
  for(const link of ['javascript:alert(1)','http://example.com','https://user:pass@example.com','file:///etc/passwd'])assert.throws(()=>normalizeExternalUrl(link));
});
test('validates uploaded filename, size and type',()=>{
  assert.equal(validateFile({name:'driver.zip',size:100,contentType:'application/zip'}).length,100);
  for(const file of [
    {name:'driver.exe',size:0},
    {name:'../driver.exe',size:100},
    {name:'bad.html',size:100},
    {name:'setup.zip',size:MAX_UPLOAD_BYTES+1},
  ]) assert.throws(()=>validateFile(file));
});
test('unique storage path and printer binding',()=>{
  assert.notEqual(buildStoragePath(),buildStoragePath());
  assert.ok(hasPrinter({printerIds:['p_1']},'p_1'));
  assert.ok(!hasPrinter({printerIds:['p_1']},'p_2'));
  assert.throws(()=>libId('../x'));
});
