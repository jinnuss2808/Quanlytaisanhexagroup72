import test from 'node:test';
import assert from 'node:assert/strict';
import { photoStorageError, storageBucketName, classifyStorageFailure } from './asset-photo-storage-diagnostics.mjs';

test('bucket normalization', () => {
  assert.equal(storageBucketName(' gs://tickethexaa.firebasestorage.app/ '), 'tickethexaa.firebasestorage.app');
  assert.equal(storageBucketName('tickethexaa.appspot.com'), 'tickethexaa.appspot.com');
  assert.throws(() => storageBucketName(''), e => e.publicCode === 'STORAGE_BUCKET_MISSING');
  assert.throws(() => storageBucketName('https://x.com/path'), e => e.publicCode === 'STORAGE_BUCKET_INVALID');
});
for (const [raw, expected] of [
  [{code:403,message:'Forbidden'},'STORAGE_PERMISSION_DENIED'],
  [{code:404,message:'Not Found'},'STORAGE_BUCKET_NOT_FOUND'],
  [{code:402,message:'Billing required'},'STORAGE_BILLING_REQUIRED'],
  [{code:412,message:'Precondition'},'STORAGE_PRECONDITION'],
  [{code:'ENOTFOUND'},'STORAGE_NETWORK'],
  [{message:'invalid_grant'},'STORAGE_CREDENTIALS'],
  [{code:429},'STORAGE_QUOTA'],
  [{message:'unexpected'},'STORAGE_WRITE_ERROR']]) {
  test('classifies '+expected, () => {
    const e=classifyStorageFailure(raw);
    assert.equal(e.publicCode,expected);
    assert.equal(e.expose,true);
    assert.equal(e.status,503);
    assert.doesNotMatch(e.message,/private_key|apiKey|token=/);
  });
}
test('do not remap already safe error', () => {
  const e=photoStorageError(501,'PRESET','safe');
  assert.equal(classifyStorageFailure(e),e);
});
