/**
 * HEXA employee directory sorting, Vietnamese locale aware.
 * CL18.211, CL23.212, CL18.213 sort by numeric suffix (211, 212, 213).
 * Does not mutate source records.
 */
const collator = new Intl.Collator('vi', {numeric:true, sensitivity:'base'});
const clean = v => String(v ?? '').trim();

export function employeeCodeSequence(code) {
  const value = clean(code);
  const m = value.match(/\.(\d+)\s*$/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isSafeInteger(n) ? n : null;
}

function compareNonEmpty(a, b, direction) {
  const x=clean(a), y=clean(b);
  if(!x && !y)return 0;
  if(!x)return 1;          // Missing values always last, ascending or descending.
  if(!y)return -1;
  return collator.compare(x,y)*direction;
}

function compareCodes(a,b,direction){
  const x=clean(a),y=clean(b);
  if(!x||!y)return compareNonEmpty(x,y,direction);
  const i=employeeCodeSequence(x),j=employeeCodeSequence(y);
  if(i!==null&&j!==null&&i!==j)return (i<j?-1:1)*direction;
  if(i!==null&&j===null)return -1;
  if(i===null&&j!==null)return 1;
  return collator.compare(x,y)*direction;
}

export const EMPLOYEE_SORT_OPTIONS = Object.freeze({
  'code-asc':'Mã NV: thấp → cao',
  'code-desc':'Mã NV: cao → thấp',
  'name-asc':'Tên: A → Z',
  'name-desc':'Tên: Z → A',
  'company-asc':'Công ty: A → Z',
  'company-desc':'Công ty: Z → A',
  'email-asc':'Email: A → Z',
  'email-desc':'Email: Z → A'
});

export function sortEmployeeDirectory(items,mode='code-asc') {
  const safeMode=Object.hasOwn(EMPLOYEE_SORT_OPTIONS,mode)?mode:'code-asc';
  const [field,order]=safeMode.split('-');
  const direction=order==='desc'?-1:1;
  const source=Array.isArray(items)?items:[];
  return source.map((employee,index)=>({employee,index})).sort((a,b)=>{
    const e1=a.employee||{},e2=b.employee||{};
    const primary=field==='code'
      ?compareCodes(e1.employeeCode,e2.employeeCode,direction)
      :compareNonEmpty(field==='company'?e1.company:e1[field],field==='company'?e2.company:e2[field],direction);
    if(primary!==0)return primary;
    const byCode=compareCodes(e1.employeeCode,e2.employeeCode,1);
    if(byCode!==0)return byCode;
    const byName=compareNonEmpty(e1.name,e2.name,1);
    if(byName!==0)return byName;
    return a.index-b.index;
  }).map(row=>row.employee);
}
