import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {cleanRosterProfile,EMPLOYEE_EXCEL_HEADERS,planRosterImport,matchesRosterIdentity,compareRosterCodes,compareRosterProfiles} from '../src/employee-roster-core.js';
import {readExcelTable,readAssetExcel,writeAssetExcel} from '../src/asset-excel.js';
import {encryptSecret,decryptSecret} from '../src/mail-vault-core.js';

test('Roster validates employee metadata while preserving mail portal reference',()=>{
 const p=cleanRosterProfile({employeeCode:' CL18.326 ',name:'  Nhân viên mẫu  ',company:'HMF',email:'NAME@EXAMPLE.VN',mailLinkId:'preset_create_hexa_mail'});
 assert.equal(p.email,'name@example.vn');assert.equal(p.mailLinkId,'preset_create_hexa_mail');
 assert.equal(p.password,undefined);
 assert.throws(()=>cleanRosterProfile({employeeCode:'!',name:'?',company:'',email:'bad'}));
});
test('Excel template with namespaced XML parses without creating records',()=>{
 const bytes=fs.readFileSync(new URL('../../frontend/public/Mau_Nhap_Nhan_Vien_HEXA.xlsx',import.meta.url));
 assert.deepEqual(readExcelTable(bytes,EMPLOYEE_EXCEL_HEADERS,{maxRows:1000}),[]);
});
test('Import skips duplicate emails or codes, retains secrets only in transient plan',()=>{
 const rows=[{row:2,values:['CL18.326','Test Person','HMF','first@example.vn','secret-on-import']},
 {row:3,values:['CL18.326','Duplicate','HXG','other@example.vn','secret']},
 {row:4,values:['CL18.327','Next Person','HXG','first@example.vn','secret']},
 {row:5,values:['CL18.328','Other Person','HXG','other@example.vn','']}];
 const plan=planRosterImport(rows,[],'preset_mail_hexa_zimbra');
 assert.equal(plan.prepared.length,2);assert.equal(plan.skipped,2);assert.deepEqual(plan.errors,[]);
 const sealed=encryptSecret(plan.prepared[0].password,'a'.repeat(64));
 assert.equal(decryptSecret(sealed,'a'.repeat(64)),plan.prepared[0].password);
 assert.notEqual(sealed.data,plan.prepared[0].password);
});
test('Invalid Excel rows prevent an entire import and do not leak passwords',()=>{
 const rows=[{row:2,values:['CL18.328','Test Person','HMF','valid@example.vn','dont-show']},
 {row:3,values:['??','No','HMF','not-email','hidden']}];
 const plan=planRosterImport(rows);
 assert.equal(plan.errors.length,1);assert.equal(plan.errors[0].row,3);
 assert.equal(JSON.stringify(plan.errors).includes('hidden'),false);
});
test('Existing asset XLSX parser still works after generic reader extension',()=>{
 const bytes=writeAssetExcel([]);
 assert.deepEqual(readAssetExcel(bytes),[]);
});

test('Import accepts email-only, code-only, missing name, department and password',()=>{
 const rows=[
   {row:2,values:['','', '', 'onlymail@example.vn','']},
   {row:3,values:['CL18.211','','','','']},
   {row:4,values:['CL23.212','Nguyen A','','someone@example.vn','']},
   {row:5,values:['CL18.213','','', 'another@example.vn','secret']},
 ];
 const {prepared,errors,skipped}=planRosterImport(rows);
 assert.equal(prepared.length,4);
 assert.equal(errors.length,0);
 assert.equal(skipped,0);
 assert.equal(prepared[0].profile.employeeCode,'');
 assert.equal(prepared[0].profile.name,'');
 assert.equal(prepared[0].profile.email,'onlymail@example.vn');
 assert.equal(prepared[1].profile.email,'');
 assert.equal(prepared[1].password,'');
});
test('Missing identifiers report invalid rows without preventing other imports',()=>{
 const rows=[{row:2,values:['','Only name','HMF','','']},
  {row:3,values:['','No code', '', 'new@example.vn','']},
  {row:4,values:['CL18.250','','','','']}];
 const plan=planRosterImport(rows);
 assert.equal(plan.prepared.length,2);
 assert.equal(plan.errors.length,1);
 assert.equal(plan.errors[0].row,2);
});
test('Missing fields do not accidentally collide; codes/emails deduplicate independently',()=>{
 const existing=[{employeeCode:'',email:'OLD@EXAMPLE.VN'}, {employeeCode:'CL18.211',email:''}];
 const rows=[{row:2,values:['','', '', 'NEW@EXAMPLE.VN','']},
   {row:3,values:['','', '', 'new@example.vn','']},
   {row:4,values:['CL18.211','', '', 'different@example.vn','']},
   {row:5,values:['CL23.212','', '', 'OLD@example.vn','']},
   {row:6,values:['CL18.213','', '', 'next@example.vn','']}];
 const plan=planRosterImport(rows,existing);
 assert.equal(plan.prepared.length,2);
 assert.equal(plan.skipped,3);
 assert.deepEqual(plan.errors,[]);
 assert.equal(matchesRosterIdentity({employeeCode:'',email:''},{employeeCode:'',email:''}),false);
 assert.equal(matchesRosterIdentity({employeeCode:'CL18.211'},{employeeCode:'cl18.211'}),true);
});
test('Sort by numeric segment after dot, missing employee codes last',()=>{
 const rows=[{employeeCode:'CL18.213',email:'z@example.vn'},
  {employeeCode:'',email:'missing@example.vn'},
  {employeeCode:'CL23.212',email:'y@example.vn'},
  {employeeCode:'CL18.211',email:'x@example.vn'},
  {employeeCode:'CL23.1000',email:''}];
 rows.sort(compareRosterProfiles);
 assert.deepEqual(rows.map(x=>x.employeeCode),['CL18.211','CL23.212','CL18.213','CL23.1000','']);
 assert.ok(compareRosterCodes('CL18.211','CL18.213')<0);
 assert.ok(compareRosterCodes('CL18.1000','CL18.999')>0);
});
