import test from 'node:test';
import assert from 'node:assert/strict';
import {sanitizeEmployee,isValidEmployee,localDayKeys} from '../src/attendance-core.js';
import {encryptSecret,decryptSecret,safePortalURL} from '../src/mail-vault-core.js';
const key='d'.repeat(64);
test('Employee fields are normalized and no password is returned',()=>{
 const data=sanitizeEmployee({employeeCode:'CL18.326',name:'  Nhân viên mẫu  ',company:'HMF',email:'EMPLOYEE@Example.vn',password:'do-not-save'});
 assert.equal(data.email,'employee@example.vn');assert.equal(data.name,'Nhân viên mẫu');assert.equal(data.password,undefined);assert.equal(isValidEmployee(data),true);
});
test('Reject invalid employee metadata',()=>{
 assert.equal(isValidEmployee(sanitizeEmployee({employeeCode:'A!',name:'A',company:'',email:'not-email'})),false);
});
test('Vietnam date boundaries use Asia/Ho_Chi_Minh',()=>{
 assert.deepEqual(localDayKeys(new Date('2026-11-18T18:30:00.000Z')),{month:'2026-11',date:'2026-11-19'});
});
test('Passwords are stored as authenticated encryption and round-trip',()=>{
 const a=encryptSecret('example-not-real-password',key);const b=encryptSecret('example-not-real-password',key);
 assert.notEqual(a.data,'example-not-real-password');assert.notDeepEqual(a,b);
 assert.equal(decryptSecret(a,key),'example-not-real-password');
 assert.throws(()=>decryptSecret({...a,tag:Buffer.alloc(16).toString('base64')},key));
});
test('Secret key required and only HTTPS links accepted',()=>{
 assert.throws(()=>encryptSecret('abc','abc'),/MAIL_VAULT_KEY/);
 assert.equal(safePortalURL('https://103.232.120.76/domainadmin/'),'https://103.232.120.76/domainadmin/');
 assert.equal(safePortalURL('javascript:alert(1)'),null);
 assert.equal(safePortalURL('http://localhost/admin'),null);
});
