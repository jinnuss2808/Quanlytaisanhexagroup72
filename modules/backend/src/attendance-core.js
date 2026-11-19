const trim = (value,max) => typeof value === 'string' ? value.trim().slice(0,max) : '';
export function sanitizeEmployee(data={}){
  data = data && typeof data === 'object' ? data : {};
  return {employeeCode: trim(data.employeeCode,40), name:trim(data.name,120),company:trim(data.company,80),email:trim(data.email,254).toLowerCase()};
}
export function isValidEmployee(e){
  return /^[\p{L}\d._-]{2,40}$/u.test(e.employeeCode) && e.name.length>=2 && e.company.length>=1 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.email);
}
export function localDayKeys(date=new Date()){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
  return {month:`${parts.year}-${parts.month}`,date:`${parts.year}-${parts.month}-${parts.day}`};
}
