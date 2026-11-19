/** HEXA staff directory — optional roster columns and deterministic duplicate handling. */
import {sanitizeEmployee} from './attendance-core.js';

export const EMPLOYEE_EXCEL_HEADERS = [
  ['Mã NV','Mã nhân viên','Mã'],
  ['Tên','Họ tên','Họ và tên'],
  ['Phòng','Công ty','Phòng ban'],
  ['Mail','Email','Địa chỉ email'],
  ['Mật khẩu','Password','Pass'],
];

const norm = x => String(x ?? '').trim().toLocaleLowerCase('vi');
const invalid = message => Object.assign(new Error(message),{status:400});
/** Rows require at least one stable identifier (email or code), all other cells may be empty. */
export function cleanRosterProfile(data={}){
  const p=sanitizeEmployee(data);
  const mailLinkId=typeof data.mailLinkId==='string'?data.mailLinkId.trim().slice(0,128):'';
  if(!p.employeeCode && !p.email)throw invalid('Cần ít nhất Mã NV hoặc Mail để nhận diện và tránh trùng.');
  if(p.employeeCode&&!/^[\p{L}\d._-]{2,40}$/u.test(p.employeeCode))throw invalid('Mã NV không hợp lệ (2–40 ký tự).');
  if(p.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email))throw invalid('Mail không hợp lệ.');
  if(mailLinkId&&!/^[\w-]{1,128}$/.test(mailLinkId))throw invalid('Mã liên kết mail không hợp lệ.');
  return {...p,mailLinkId};
}

/** True only for a nonempty matching code OR a nonempty matching email. */
export function matchesRosterIdentity(a={},b={}){
  return Boolean(
    (norm(a.employeeCode)&&norm(a.employeeCode)===norm(b.employeeCode)) ||
    (norm(a.email)&&norm(a.email)===norm(b.email))
  );
}

/** Sort CL18.211, CL23.212, CL18.213 by the last numeric segment 211, 212, 213.
 * Codes without a final dotted number follow; missing codes are always last.
 */
export function compareRosterCodes(a,b){
  const codeA=typeof a==='string'?a:String(a?.employeeCode??'');
  const codeB=typeof b==='string'?b:String(b?.employeeCode??'');
  const x=codeA.trim(),y=codeB.trim();
  if(!x||!y)return x? -1 : y?1:0;
  const numA=x.match(/\.(\d+)$/),numB=y.match(/\.(\d+)$/);
  if(numA&&numB){
    const nA=BigInt(numA[1]),nB=BigInt(numB[1]);
    if(nA<nB)return -1;if(nA>nB)return 1;
  }else if(numA||numB)return numA?-1:1;
  return x.localeCompare(y,'vi',{numeric:true,sensitivity:'base'});
}
export function compareRosterProfiles(a,b){
  return compareRosterCodes(a,b)||norm(a.email).localeCompare(norm(b.email),'vi')||norm(a.name).localeCompare(norm(b.name),'vi');
}

/** Skip duplicates by nonempty code/email. Invalid rows are reported separately. */
export function planRosterImport(rows,existing=[],mailLinkId=''){
  if(!Array.isArray(rows)||rows.length>1000)throw invalid('File Excel tối đa 1.000 nhân viên.');
  const codes=new Set(existing.map(x=>norm(x.employeeCode)).filter(Boolean));
  const emails=new Set(existing.map(x=>norm(x.email)).filter(Boolean));
  const prepared=[],errors=[];
  let skipped=0;
  for(const {row,values} of rows){
    try{
      const [employeeCode,name,company,email,passwordRaw]=values;
      const profile=cleanRosterProfile({employeeCode,name,company,email,mailLinkId});
      const password=String(passwordRaw??'');
      if(password.length>512)throw invalid('Mật khẩu dài quá 512 ký tự.');
      const code=norm(profile.employeeCode),mail=norm(profile.email);
      if((code&&codes.has(code))||(mail&&emails.has(mail))){skipped++;continue;}
      if(code)codes.add(code);
      if(mail)emails.add(mail);
      prepared.push({row,profile,password});
    }catch(e){errors.push({row,message:e.message});}
  }
  return {prepared,errors,skipped};
}
