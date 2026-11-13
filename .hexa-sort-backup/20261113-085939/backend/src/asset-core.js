import { randomUUID } from 'node:crypto';

export const ASSET_STATUSES = ['available', 'using', 'maintenance', 'broken', 'liquidated'];
export const assetStatusName = {
  available: 'Có sẵn', using: 'Đang sử dụng', maintenance: 'Bảo trì', broken: 'Đã hỏng', liquidated: 'Đã thanh lý'
};
export function assetError(status, message) { return Object.assign(new Error(message), {status}); }
export function asText(value, max = 255) { return String(value ?? '').trim().slice(0, max); }
export function keyForCode(code) { return Buffer.from(asText(code, 100).toUpperCase(), 'utf8').toString('base64url'); }
export function normalizeAsset(body = {}) {
  const assetCode = asText(body.assetCode, 100);
  const assetName = asText(body.assetName, 255);
  const status = asText(body.status || 'available', 30);
  if (!assetCode || !assetName) throw assetError(400, 'Mã tài sản và tên tài sản là bắt buộc.');
  if (!ASSET_STATUSES.includes(status)) throw assetError(400, 'Trạng thái tài sản không hợp lệ.');
  if (/[\u0000-\u001F]/.test(assetCode)) throw assetError(400, 'Mã tài sản chứa ký tự điều khiển không hợp lệ.');
  const purchasePrice = body.purchasePrice === '' || body.purchasePrice == null ? null : Number(body.purchasePrice);
  if (purchasePrice !== null && (!Number.isFinite(purchasePrice) || purchasePrice < 0 || purchasePrice > 1e15)) throw assetError(400, 'Giá mua không hợp lệ.');
  const date = asText(body.purchaseDate, 10);
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw assetError(400, 'Ngày mua phải có định dạng YYYY-MM-DD.');
  return {
    assetCode, assetName,
    categoryId: asText(body.categoryId, 128) || null,
    ownerDepartmentId: asText(body.ownerDepartmentId ?? body.departmentId, 128) || null,
    assignedTo: asText(body.assignedTo, 255) || null,
    ipAddress: asText(body.ipAddress, 50) || null,
    serialNumber: asText(body.serialNumber, 255) || null,
    purchaseDate: date || null,
    purchasePrice,
    status,
    description: asText(body.description, 1000) || null
  };
}
export function enrichAsset(asset, cats = {}, depts = {}) {
  return { ...asset,
    categoryName: cats[asset.categoryId]?.name || ((asset.isPrinter || asset.assetType === 'printer') ? 'Máy in' : ''), categoryCode: cats[asset.categoryId]?.code || ((asset.isPrinter || asset.assetType === 'printer') ? 'PRINTER' : ''),
    ownerDepartmentName: depts[asset.ownerDepartmentId]?.name || '', ownerDepartmentCode: depts[asset.ownerDepartmentId]?.code || ''
  };
}
export function selectAssets(rows, query = {}) {
  const q = asText(query.search, 255).toLocaleLowerCase('vi');
  const result = rows.filter(a => {
    if (!query.trash && a.deletedAt) return false;
    if (query.trash && !a.deletedAt) return false;
    if (query.status && query.status !== 'all' && a.status !== query.status) return false;
    if (query.categoryId && a.categoryId !== query.categoryId) return false;
    if (query.ownerDepartmentId && a.ownerDepartmentId !== query.ownerDepartmentId) return false;
    return !q || [a.assetCode,a.assetName,a.serialNumber,a.ipAddress,a.assignedTo,a.description,a.categoryName,a.ownerDepartmentName]
      .some(v => String(v || '').toLocaleLowerCase('vi').includes(q));
  });
  const allowedSort = new Set(['assetCode','assetName','createdAt','updatedAt','status','ownerDepartmentName']);
  const sort = allowedSort.has(query.sortBy) ? query.sortBy : 'createdAt';
  const desc = (query.sortDirection || 'desc') === 'desc';
  result.sort((a,b)=>{
    const av=a[sort]??'', bv=b[sort]??'';
    const n = typeof av === 'number' && typeof bv === 'number' ? av-bv : String(av).localeCompare(String(bv), 'vi', {numeric:true});
    return desc ? -n : n;
  });
  const total = result.length;
  const pageSize = Math.min(100,Math.max(1,Number(query.pageSize)||20));
  const page = Math.max(1,Number(query.page)||1);
  return { items:result.slice((page-1)*pageSize, page*pageSize),page,pageSize,total,totalPages:Math.max(1,Math.ceil(total/pageSize)) };
}
export function parseCSV(input) {
  const text = String(input ?? '').replace(/^\uFEFF/,'');
  if (text.length > 4_000_000) throw assetError(413,'File CSV quá lớn.');
  const rows=[];let cells=[];let cell='';let quoted=false;
  const first=text.split(/\r?\n/,1)[0];
  const delim=(first.match(/;/g)||[]).length>(first.match(/,/g)||[]).length?';':',';
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"'){
      if(quoted && text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;
    } else if(c===delim && !quoted){cells.push(cell);cell='';}
    else if((c==='\r'||c==='\n')&&!quoted){
      if(c==='\r'&&text[i+1]==='\n')i++;
      cells.push(cell);cell='';
      if(cells.some(v=>v.trim()))rows.push(cells);
      cells=[];
    } else cell+=c;
  }
  if(quoted)throw assetError(400,'CSV có dấu nháy kép chưa được đóng.');
  cells.push(cell);if(cells.some(v=>v.trim()))rows.push(cells);
  if(!rows.length)return [];
  const headers=rows.shift().map(x=>x.trim().replace(/^\uFEFF/,''));
  return rows.map((r,i)=>({__row:i+2,...Object.fromEntries(headers.map((h,j)=>[h,r[j]||'']))}));
}
export function mapLegacyCSV(row, departments = {}, categories = {}) {
  // Accept both SQL column names and the original Vietnamese Excel export headers.
  const canonical = x => String(x).toLowerCase().replace(/đ/g,'d').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
  const lower=Object.fromEntries(Object.entries(row).map(([k,v])=>[canonical(k),v]));
  const get=(...keys)=>keys.map(k=>lower[canonical(k)]).find(v=>v!==undefined && v!=='') || '';
  const lookup=(dict, idOrCode)=> Object.keys(dict).find(id=> id===idOrCode || dict[id].code?.toLowerCase()===idOrCode?.toLowerCase() || dict[id].name?.toLowerCase()===idOrCode?.toLowerCase()) || null;
  const rawStatus=get('Status','TrangThai')||'available';
  const statusMap={cosan:'available',dangsudung:'using',dasudung:'using',dangcapphat:'using',baotri:'maintenance',dahong:'broken',dathanhly:'liquidated'};
  const status=statusMap[canonical(rawStatus)]||rawStatus;
  const cat=get('CategoryCode','CategoryId','CategoryName','Loai','Loại');
  const dept=get('DepartmentCode','DepartmentId','DepartmentName','CongTy','Công ty');
  const foundCategory = lookup(categories,cat);
  const foundDepartment = lookup(departments,dept);
  if (cat && !foundCategory) throw assetError(400, `Không tìm thấy loại tài sản: ${cat}`);
  if (dept && !foundDepartment) throw assetError(400, `Không tìm thấy công ty sở hữu: ${dept}`);
  const rawDate=get('PurchaseDate','NgayMua','Ngày mua');
  const isoDate=/^\d{2}\/\d{2}\/\d{4}$/.test(rawDate) ? rawDate.slice(6)+'-'+rawDate.slice(3,5)+'-'+rawDate.slice(0,2) : rawDate.slice(0,10);
  const assignedTo=get('AssignedTo','NguoiSuDung','Người sử dụng');
  const normalizedStatus=assignedTo && status==='available' ? 'using' : status;
  if(normalizedStatus==='using'&&!assignedTo) throw assetError(400,'Tài sản đang sử dụng nhưng thiếu người nhận.');
  return normalizeAsset({
    assetCode:get('AssetCode','MaTaiSan','MaTS','Mã tài sản'), assetName:get('AssetName','TenTaiSan','TenTS','Tên tài sản'),
    categoryId:foundCategory,ownerDepartmentId:foundDepartment,
    assignedTo,ipAddress:get('IpAddress','Ip','Địa chỉ IP'),serialNumber:get('SerialNumber','Serial'),
    purchaseDate:isoDate,purchasePrice:get('PurchasePrice','GiaMua','Giá mua'),
    status:normalizedStatus, description:get('Description','GhiChu','Ghi chú')
  });
}
export function escapeCsvCell(value) {
  const raw=String(value??'');
  const safe=/^[\s]*[=+@\-\t\r]/.test(raw) ? "'"+raw : raw;
  return '"'+safe.replace(/"/g,'""')+'"';
}
export function toCSV(rows, columns) {
  return [columns.map(x=>escapeCsvCell(x[0])).join(','),...rows.map(row=>columns.map(([_,key])=>escapeCsvCell(row[key])).join(','))].join('\r\n');
}
export const assetUUID=()=>randomUUID();
