/* HEXA_IT_LIBRARY_V1 */
import React, { useCallback, useEffect, useMemo, useState, useRef} from 'react';
import { auth } from './firebase';
import { api } from './api';
import {
  Boxes, Box, Laptop, Plus, Search, Upload, Download, Pencil, Trash2, RotateCcw,
  ArrowRightLeft, History, QrCode, X, RefreshCw, Save, CheckCircle2,
  LayoutGrid, Wrench, AlertTriangle, Building2, Tags, HardDrive, Copy, ExternalLink,
  Monitor, PackageSearch, ChevronLeft, ChevronRight, Info
} from 'lucide-react';
import './asset-management.css';
import SortableHeader from './SortableHeader.jsx';
import {toggleColumnSort} from './table-sort.js';
import WarehouseManagement from './WarehouseManagement.jsx';
import PrinterManagement from './PrinterManagement.jsx';
import QRCode from 'qrcode';
import {AssetReportPanel,AssetStocktakePanel,AssetBackupPanel} from './AssetExtras.jsx';

const BASE = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:4000').replace(/\/$/, '');
const STATUS = {available:'Có sẵn',using:'Đang sử dụng',maintenance:'Bảo trì',broken:'Đã hỏng',liquidated:'Đã thanh lý'};
const initialAsset = {assetCode:'',assetName:'',categoryId:'',ownerDepartmentId:'',userDepartment:'',ipAddress:'',serialNumber:'',purchaseDate:'',purchasePrice:'',status:'available',description:''};
const dateLabel = ms => ms ? new Date(ms).toLocaleString('vi-VN') : '—';
const money = v => (v === '' || v === undefined || v === null) ? '—' : Number(v).toLocaleString('vi-VN') + ' ₫';
const publicLink = publicId => `${window.location.origin}/assets/${publicId}`;
const setField = (set,key,value)=>set(old=>({...old,[key]:value}));
async function rawRequest(path, {method='GET',body,headers={},blob=false}={}) {
  if(!auth.currentUser)throw new Error('Bạn cần đăng nhập tài khoản IT.');
  const token=await auth.currentUser.getIdToken();
  let response;
  try{response=await fetch(`${BASE}/api${path}`,{method,headers:{Authorization:`Bearer ${token}`,...headers},body});}
  catch{throw new Error('Không kết nối được máy chủ quản lý tài sản.');}
  if(!response.ok){const data=await response.json().catch(()=>({}));const detail=data.error || (response.status===413?'Dữ liệu gửi lên vượt giới hạn cho phép.':`HTTP ${response.status} khi gọi API.`);throw new Error(detail);}
  return blob ? response.blob() : response.json();
}
function download(blob,file){const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=file;link.click();URL.revokeObjectURL(url);}
function Field({label,required,children,wide}){return <label className={'am-field'+(wide?' am-wide':'')}><span>{label}{required&&' *'}</span>{children}</label>;}
function Modal({title,subtitle,onClose,children,wide=false,fixedDetail=false}){return <div className="am-overlay" onMouseDown={e=>e.target===e.currentTarget&&onClose()} role="presentation"><div className={'am-modal'+(wide?' am-large':'')+(fixedDetail?' am-detail-fixed':'')} role="dialog" aria-modal="true" aria-label={title}><header className="am-modal-header"><div><div className="am-eyebrow">HEXA · QUẢN LÝ TÀI SẢN</div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div><button className="am-icon-btn" onClick={onClose} aria-label="Đóng"><X size={20}/></button></header>{children}</div></div>;}
function AssetForm({item,catalogs,onClose,onSaved}){
  const edit=Boolean(item?.id);
  const [form,setForm]=useState(item?Object.fromEntries(Object.keys(initialAsset).map(k=>[k,item[k]??''])):initialAsset);
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const submit=async e=>{e.preventDefault();setBusy(true);setError('');try{
    await api(edit?`/assets/${item.id}`:'/assets',{method:edit?'PATCH':'POST',body:{...form,purchasePrice:form.purchasePrice===''?null:form.purchasePrice}});
    onSaved();
  }catch(err){setError(err.message);}finally{setBusy(false);}};
  return <Modal title={edit?'Chỉnh sửa tài sản':'Thêm tài sản mới'} subtitle="Thông tin lưu trực tiếp trên Firebase Realtime Database" onClose={onClose} wide>
    <form className="am-form" onSubmit={submit}>
      <div className="am-form-grid">
        <Field label="Mã tài sản" required><input required maxLength={100} value={form.assetCode} onChange={e=>setField(setForm,'assetCode',e.target.value)} placeholder="VD: HEXA-LAP-001"/></Field>
        <Field label="Loại tài sản"><select value={form.categoryId} onChange={e=>setField(setForm,'categoryId',e.target.value)}><option value="">Chưa phân loại</option>{catalogs.categories.map(x=><option key={x.id} value={x.id}>{x.code} · {x.name}</option>)}</select></Field>
        <Field label="Tên tài sản" required wide><input required maxLength={255} value={form.assetName} onChange={e=>setField(setForm,'assetName',e.target.value)} placeholder="VD: Laptop Dell Latitude 5450"/></Field>
        <Field label="Công ty sở hữu"><select value={form.ownerDepartmentId} onChange={e=>setField(setForm,'ownerDepartmentId',e.target.value)}><option value="">Chưa xác định</option>{catalogs.departments.map(x=><option key={x.id} value={x.id}>{x.code} · {x.name}</option>)}</select></Field>
        <Field label="Phòng ban sử dụng"><input maxLength={100} value={form.userDepartment||''} onChange={e=>setField(setForm,'userDepartment',e.target.value)} placeholder="VD: Kế toán / Kỹ thuật"/></Field>
        <Field label="Trạng thái"><select value={form.status} onChange={e=>setField(setForm,'status',e.target.value)}>{Object.entries(STATUS).filter(([key])=>item?.status==='using'||key!=='using').map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></Field>
        <Field label="Serial"><input maxLength={255} value={form.serialNumber} onChange={e=>setField(setForm,'serialNumber',e.target.value)}/></Field>
        <Field label="Địa chỉ IP"><input maxLength={50} value={form.ipAddress} onChange={e=>setField(setForm,'ipAddress',e.target.value)}/></Field>
        <Field label="Ngày mua"><input type="date" value={form.purchaseDate} onChange={e=>setField(setForm,'purchaseDate',e.target.value)}/></Field>
        <Field label="Giá mua (VNĐ)"><input type="number" min="0" step="0.01" value={form.purchasePrice} onChange={e=>setField(setForm,'purchasePrice',e.target.value)}/></Field>
        <Field label="Ghi chú" wide><textarea rows={3} value={form.description} onChange={e=>setField(setForm,'description',e.target.value)}/></Field>
      </div>
      <div className="am-note"><Info size={15}/> Công ty sở hữu không tự thay đổi khi bàn giao. Chỉnh người sử dụng qua chức năng “Bàn giao / Thu hồi” để lưu lịch sử.</div>
      {edit && item?.assignedTo && item.status!=='available' && item.status!=='using' && form.status==='available' &&
        <div className="am-note"><Info size={15}/> Tài sản còn người sử dụng cũ: <b>{item.assignedTo}</b>. Khi lưu về Có sẵn, hệ thống sẽ thu hồi người sử dụng cũ và ghi lịch sử.</div>}
      {error&&<p className="am-error">{error}</p>}
      <footer className="am-actions"><button type="button" className="am-btn am-light" onClick={onClose}>Hủy</button><button disabled={busy} className="am-btn am-primary"><Save size={16}/>{busy?'Đang lưu...':'Lưu tài sản'}</button></footer>
    </form>
  </Modal>;
}
function AssignmentForm({item,onClose,onSaved}){
  const isReturn=item.status==='using';const [name,setName]=useState('');const [userDepartment,setUserDepartment]=useState(item.userDepartment||'');const [date,setDate]=useState(new Date().toISOString().slice(0,10));const [note,setNote]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const submit=async e=>{e.preventDefault();setBusy(true);setError('');try{
    await api(`/assets/${item.id}/${isReturn?'return':'assign'}`,{method:'POST',body:{assignedTo:name,userDepartment,date,note}});onSaved();
  }catch(err){setError(err.message);}finally{setBusy(false);}};
  return <Modal title={isReturn?'Thu hồi tài sản':'Bàn giao tài sản'} subtitle={`${item.assetCode} · ${item.assetName}`} onClose={onClose}>
    <form className="am-form" onSubmit={submit}>
      {isReturn?<div className="am-highlight">Đang sử dụng: <strong>{item.assignedTo}</strong></div>:<Field label="Người nhận tài sản" required><input required value={name} onChange={e=>setName(e.target.value)} placeholder="Họ tên / Mã nhân viên"/></Field>}
      <Field label={isReturn?'Ngày thu hồi':'Ngày bàn giao'}><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></Field>
      {!isReturn&&<Field label="Phòng ban sử dụng"><input maxLength={100} value={userDepartment} onChange={e=>setUserDepartment(e.target.value)} placeholder="VD: Kế toán"/></Field>}
      <Field label="Ghi chú"><textarea rows={3} value={note} onChange={e=>setNote(e.target.value)}/></Field>
      {error&&<p className="am-error">{error}</p>}
      <footer className="am-actions"><button type="button" className="am-btn am-light" onClick={onClose}>Hủy</button><button disabled={busy} className="am-btn am-primary">{busy?'Đang lưu...':'Xác nhận'}</button></footer>
    </form>
  </Modal>;
}
function CatalogManager({catalogs,onSaved}){
  const [kind,setKind]=useState('categories'),[code,setCode]=useState(''),[name,setName]=useState(''),[description,setDescription]=useState(''),[editing,setEditing]=useState(null);
  const [error,setError]=useState(''),[working,setWorking]=useState(false);
  const rows=catalogs[kind];
  const reset=()=>{setCode('');setName('');setDescription('');setEditing(null);};
  const submit=async e=>{e.preventDefault();setWorking(true);setError('');try{
    await api(`/assets/catalogs/${kind}${editing?'/'+editing:''}`,{method:editing?'PATCH':'POST',body:{code,name,description}});reset();await onSaved();
  }catch(err){setError(err.message);}finally{setWorking(false);}};
  const remove=async row=>{if(!window.confirm(`Xóa danh mục “${row.name}”?`))return;setError('');try{await api(`/assets/catalogs/${kind}/${row.id}`,{method:'DELETE'});await onSaved();}catch(err){setError(err.message);}};
  return <div className="am-card am-padded">
    <div className="am-split am-heading"><div><h3>Danh mục tài sản</h3><p>Admin quản lý công ty sở hữu và loại thiết bị</p></div><div className="am-pill-tabs"><button className={kind==='categories'?'active':''} onClick={()=>{reset();setKind('categories');}}>Loại tài sản</button><button className={kind==='departments'?'active':''} onClick={()=>{reset();setKind('departments');}}>Công ty</button></div></div>
    <form className="am-catalog-form" onSubmit={submit}>
      <input required placeholder="Mã (LAPTOP, HEXA...)" maxLength={50} value={code} onChange={e=>setCode(e.target.value)}/>
      <input required placeholder="Tên danh mục" maxLength={255} value={name} onChange={e=>setName(e.target.value)}/>
      <input placeholder="Mô tả (không bắt buộc)" maxLength={500} value={description} onChange={e=>setDescription(e.target.value)}/>
      <button className="am-btn am-primary" disabled={working}>{editing?'Lưu':'Thêm'}</button>
      {editing&&<button type="button" className="am-btn am-light" onClick={reset}>Hủy</button>}
    </form>
    {error&&<p className="am-error">{error}</p>}
    <div className="am-table-wrap"><table className="am-table"><thead><tr><th>Mã</th><th>Tên</th><th>Mô tả</th><th>Thao tác</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><strong>{r.code}</strong></td><td>{r.name}</td><td>{r.description||'—'}</td><td><button className="am-link" onClick={()=>{setEditing(r.id);setCode(r.code);setName(r.name);setDescription(r.description||'');}}>Sửa</button><button className="am-link danger" onClick={()=>remove(r)}>Xóa</button></td></tr>)}</tbody></table></div>
  </div>;
}
function MaintenanceEditor({item,onClose,onSaved}){
  const [form,setForm]=useState({type:'repair',date:new Date().toISOString().slice(0,10),summary:'',notes:'',replacedParts:'',performedBy:'',serviceProvider:'',cost:'0',ticketCode:'',stockItemId:'',stockQuantity:'1'});
  const [stock,setStock]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{api('/warehouse').then(x=>setStock(x.items||[])).catch(()=>{});},[]);
  const change=(key,value)=>setForm(f=>({...f,[key]:value}));
  const submit=async e=>{e.preventDefault();setBusy(true);setError('');try{
    await api(`/assets/${item.id}/maintenance`,{method:'POST',body:{...form,cost:Number(form.cost||0),stockQuantity:Number(form.stockQuantity)}});onSaved();
  }catch(err){setError(err.message)}finally{setBusy(false)}};
  const isPrinter=/máy\s*in|printer/i.test(`${item.categoryName||''} ${item.assetName||''}`);
  return <Modal title="Ghi nhận sửa chữa / thay linh kiện" subtitle={`${item.assetCode} · ${item.assetName}`} onClose={onClose} wide><form className="am-form" onSubmit={submit}>
  <div className="am-form-grid">
    <Field label="Loại công việc"><select value={form.type} onChange={e=>change('type',e.target.value)}>
      <option value="repair">Sửa chữa thiết bị</option><option value="maintenance">Bảo trì định kỳ</option><option value="replace_part">Thay thế linh kiện</option><option value="printer_service">Sửa chữa / vệ sinh máy in</option><option value="replace_toner">Thay mực in</option>
    </select></Field>
    <Field label="Ngày thực hiện"><input type="date" required value={form.date} onChange={e=>change('date',e.target.value)}/></Field>
    <Field label="Mô tả công việc" wide required><input required maxLength={255} value={form.summary} onChange={e=>change('summary',e.target.value)} placeholder="VD: Thay trống máy in, sửa lỗi kẹt giấy..."/></Field>
    <Field label="Linh kiện thay thế"><input value={form.replacedParts} onChange={e=>change('replacedParts',e.target.value)} placeholder="Trống, gạt, RAM, SSD..."/></Field>
    <Field label="Người thực hiện"><input value={form.performedBy} onChange={e=>change('performedBy',e.target.value)} placeholder="Tên kỹ thuật viên"/></Field>
    <Field label="Đơn vị sửa chữa"><input value={form.serviceProvider} onChange={e=>change('serviceProvider',e.target.value)} placeholder="IT nội bộ / Nhà cung cấp"/></Field>
    <Field label="Chi phí (VNĐ)"><input type="number" min="0" value={form.cost} onChange={e=>change('cost',e.target.value)}/></Field>
    <Field label="Mã ticket liên quan"><input value={form.ticketCode} onChange={e=>change('ticketCode',e.target.value)}/></Field>
    <Field label="Dùng vật tư/mực trong kho"><select value={form.stockItemId} onChange={e=>change('stockItemId',e.target.value)}><option value="">Không xuất từ kho</option>{stock.filter(i=>i.quantity>0 && (form.type!=='replace_toner'||i.category==='ink')).map(i=><option key={i.id} value={i.id}>{i.sku} · {i.name} (tồn {i.quantity})</option>)}</select></Field>
    {form.stockItemId&&<Field label="Số lượng xuất kho"><input type="number" required min="1" step="1" value={form.stockQuantity} onChange={e=>change('stockQuantity',e.target.value)}/></Field>}
    <Field label="Ghi chú chi tiết" wide><textarea rows={3} value={form.notes} onChange={e=>change('notes',e.target.value)} placeholder="Lỗi trước/sau sửa, serial linh kiện, tình trạng máy..."/></Field>
  </div>
  {isPrinter&&<div className="am-note">Đối với máy in, bạn có thể ghi lại thay mực, thay trống, gạt mực, bánh răng, bảo trì và chi phí từng lần.</div>}
  {error&&<p className="am-error">{error}</p>}
  <footer className="am-actions"><button className="am-btn am-light" type="button" onClick={onClose}>Hủy</button><button className="am-btn am-primary" disabled={busy}><Save size={16}/>{busy?'Đang lưu...':'Lưu nhật ký'}</button></footer>
  </form></Modal>;
}
// QR được sinh trực tiếp trong trình duyệt, không gửi thông tin tài sản tới dịch vụ QR bên ngoài.
export function AssetQrLabel({item,url}) {
  const [qr,setQr] = useState('');
  const [error,setError] = useState('');
  useEffect(()=>{
    let alive=true;
    setQr('');setError('');
    QRCode.toDataURL(url,{width:340,margin:2,errorCorrectionLevel:'M',color:{dark:'#122746',light:'#FFFFFF'}})
      .then(data=>{if(alive)setQr(data);})
      .catch(()=>{if(alive)setError('Không tạo được mã QR. Vui lòng thử lại.');});
    return ()=>{alive=false;};
  },[url]);
  const saveQr=()=>{
    if(!qr)return;
    const a=document.createElement('a');
    a.download=`HEXA-QR-${String(item.assetCode||item.id).replace(/[^a-zA-Z0-9_-]/g,'_')}.png`;
    a.href=qr;
    document.body.appendChild(a);a.click();a.remove();
  };
  const printQr=()=>{
    if(!qr)return;
    const popup=window.open('','_blank','width=560,height=680');
    if(!popup){setError('Trình duyệt đang chặn cửa sổ in. Hãy cho phép pop-up để in tem.');return;}
    popup.document.title=`Tem QR - ${item.assetCode}`;
    const css=popup.document.createElement('style');
    css.textContent='@page{size:auto;margin:10mm}body{font-family:Arial,sans-serif;margin:25px;color:#172747}.label{width:300px;margin:auto;border:1px solid #ddd;border-radius:8px;padding:20px;text-align:center;break-inside:avoid}.label img{width:220px;height:220px;display:block;margin:10px auto}.brand{font-size:18px;font-weight:800}.code{font-size:17px;font-weight:bold;overflow-wrap:anywhere;margin-top:6px}.name{font-size:12px;line-height:1.5;overflow-wrap:anywhere}.hint{font-size:10px;color:#5a6880}';
    popup.document.head.appendChild(css);
    const label=popup.document.createElement('div');label.className='label';
    const brand=popup.document.createElement('div');brand.className='brand';brand.textContent='HEXA · TÀI SẢN';label.appendChild(brand);
    const img=popup.document.createElement('img');img.alt='Mã QR tài sản';img.src=qr;label.appendChild(img);
    const code=popup.document.createElement('div');code.className='code';code.textContent=item.assetCode||'';label.appendChild(code);
    const name=popup.document.createElement('div');name.className='name';name.textContent=item.assetName||'';label.appendChild(name);
    const hint=popup.document.createElement('p');hint.className='hint';hint.textContent='Quét mã để xem thông tin tài sản';label.appendChild(hint);
    popup.document.body.appendChild(label);
    let printed=false;
    const doPrint=()=>{if(printed)return;printed=true;popup.focus();popup.print();};
    img.onload=doPrint;
    if(img.complete)doPrint();
  };
  return <div className="am-qr-layout">
    <div className="am-qr-label">
      {qr?<img className="am-qr-image" src={qr} alt={`QR của tài sản ${item.assetCode}`}/>:<div className="am-qr-placeholder">Đang tạo mã QR...</div>}
      <strong>{item.assetCode}</strong><span>{item.assetName}</span>
      <div className="am-qr-meta"><div><small>Công ty sở hữu</small><b>{item.ownerDepartmentName||'Chưa cập nhật'}</b></div><div><small>Người đang sử dụng</small><b>{item.assignedTo||'Chưa bàn giao'}</b></div><div><small>Địa chỉ IP</small><b>{item.ipAddress||'Chưa cập nhật'}</b></div></div>
    </div>
    <div className="am-qr-description">
      <h4>Mã QR của tài sản</h4>
      <p className="am-muted">Quét mã để mở hồ sơ tài sản. Người đã đăng nhập IT xem thêm IP và người sử dụng; người ngoài chỉ thấy thông tin cơ bản.</p>
      <div className="am-url">{url}</div>
      <div className="am-qr-actions">
        <button type="button" className="am-btn am-primary" onClick={saveQr} disabled={!qr}><Download size={15}/> Tải QR PNG</button>
        <button type="button" className="am-btn am-light" onClick={printQr} disabled={!qr}><QrCode size={15}/> In tem QR</button>
        <button type="button" className="am-btn am-light" onClick={()=>navigator.clipboard?.writeText(url).then(()=>setError('Đã sao chép liên kết.')).catch(()=>setError('Không thể sao chép. Hãy sao chép thủ công.'))}><Copy size={15}/> Sao chép link</button>
        <a className="am-btn am-light" target="_blank" rel="noreferrer" href={url}><ExternalLink size={15}/> Xem tài sản</a>
      </div>
      <p className="am-muted">Lưu ý: nếu website đang chạy localhost, mã QR chỉ dùng được trên máy đó. Hãy tải/in lại mã QR sau khi triển khai lên tên miền Vercel.</p>
      {error&&<p role="status" className={error.startsWith('Đã ')?'am-success':'am-error'}>{error}</p>}
    </div>
  </div>;
}
function AssetDetail({item,onClose,onRefresh}){
  const [tab,setTab]=useState(item.initialTab||'info'),[history,setHistory]=useState({history:[],assignments:[],maintenance:[]}),[software,setSoftware]=useState([]);
  const [name,setName]=useState(''),[version,setVersion]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[addMaintenance,setAddMaintenance]=useState(false);
  const reload=useCallback(async()=>{
    const h=await api(`/assets/${item.id}/history`);setHistory(h);
    if(!item.deletedAt){const softwareItems=await api(`/assets/${item.id}/software`);setSoftware(softwareItems);}
  },[item.id]);
  useEffect(()=>{reload().catch(err=>setMessage(err.message));},[reload]);
  const addSoftware=async e=>{e.preventDefault();setBusy(true);setMessage('');try{await api(`/assets/${item.id}/software`,{method:'POST',body:{softwareName:name,version}});setName('');setVersion('');await reload();}catch(err){setMessage(err.message);}finally{setBusy(false);}};
  const removeSoftware=async sw=>{if(!window.confirm('Xóa phần mềm này?'))return;try{await api(`/assets/${item.id}/software/${sw.id}`,{method:'DELETE'});await reload();}catch(err){setMessage(err.message);}};
  const url=publicLink(item.publicId);
  return <Modal title={item.assetName} subtitle={item.assetCode} onClose={onClose} wide fixedDetail>
    <div className="am-pill-tabs am-detail-tabs">{[['info','Thông tin'],['history','Lịch sử'],['maintenance','Sửa chữa / thay linh kiện'],['software','Phần mềm'],['qr','Mã QR / liên kết']].map(([id,label])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}>{label}</button>)}</div>
    <div className="am-detail-body">
      {tab==='info'&&<div className="am-detail-grid">{[
        ['Mã tài sản',item.assetCode],['Tên tài sản',item.assetName],['Loại',item.categoryName||'—'],['Công ty sở hữu',item.ownerDepartmentName||'—'],
        ['Trạng thái',STATUS[item.status]],['Người sử dụng',item.assignedTo||'—'],['Serial',item.serialNumber||'—'],['IP',item.ipAddress||'—'],
        ['Ngày mua',item.purchaseDate||'—'],['Giá mua',money(item.purchasePrice)],['Ghi chú',item.description||'—']].map(([label,value])=><div key={label}><small>{label}</small><strong>{value}</strong></div>)}</div>}
      {tab==='history'&&<><h4>Bàn giao / thu hồi</h4>{history.assignments.length?history.assignments.map(x=><div className="am-event" key={x.id}><ArrowRightLeft size={17}/><div><b>{x.assignedTo}</b><p>Bàn giao: {x.date} · {x.returnedAt?`Thu hồi: ${x.returnedDate||dateLabel(x.returnedAt)}`:'Đang sử dụng'}</p><small>{x.note||''}</small></div></div>):<p className="am-muted">Chưa có lịch sử bàn giao.</p>}
        <h4>Nhật ký thay đổi</h4>{history.history.map(x=><div className="am-event" key={x.id}><History size={16}/><div><b>{x.summary||x.action}</b><p>{x.byName} · {dateLabel(x.at)}</p>{Array.isArray(x.changes)&&x.changes.length>0&&<ul className="am-audit-changes">{x.changes.map(c=><li key={c.field}><strong>{c.label}</strong>: {String(c.from??'—')} → {String(c.to??'—')}</li>)}</ul>}</div></div>)}</>}
      {tab==='maintenance'&&<><div className="am-split"><div><h4>Sửa chữa, thay thế linh kiện và mực in</h4><p className="am-muted">Lưu lịch sử sửa chữa, chi phí, người thực hiện và số vật tư đã dùng.</p></div><button className="am-btn am-primary" onClick={()=>setAddMaintenance(true)}><Plus size={15}/> Ghi sửa chữa</button></div>
        {!history.maintenance?.length&&<p className="am-muted">Thiết bị chưa có nhật ký sửa chữa.</p>}
        {(history.maintenance||[]).map(x=><div className="am-maintenance-card" key={x.id}><strong>{x.summary} · {x.date}</strong><p>{x.notes||'Không có ghi chú chi tiết'}{x.replacedParts?' · Linh kiện: '+x.replacedParts:''}</p><small>{x.performedBy||x.byName} · Chi phí: {money(x.cost)}{x.stockName?` · Xuất kho: ${x.stockName} × ${x.stockQuantity}`:''}{x.ticketCode?' · Ticket: '+x.ticketCode:''}</small></div>)}
        </>}
      {tab==='software'&&<><form onSubmit={addSoftware} className="am-inline-form"><input required placeholder="Tên phần mềm" value={name} onChange={e=>setName(e.target.value)}/><input placeholder="Phiên bản" value={version} onChange={e=>setVersion(e.target.value)}/><button disabled={busy} className="am-btn am-primary">Thêm</button></form>
        <div className="am-table-wrap"><table className="am-table"><thead><tr><th>Phần mềm</th><th>Phiên bản</th><th>Thao tác</th></tr></thead><tbody>{software.map(x=><tr key={x.id}><td>{x.softwareName}</td><td>{x.version||'—'}</td><td><button className="am-link danger" onClick={()=>removeSoftware(x)}>Xóa</button></td></tr>)}</tbody></table></div></>}
      {tab==='qr'&&<AssetQrLabel item={item} url={url}/>}

      {message&&<p className="am-error">{message}</p>}
    </div>
    {addMaintenance&&<MaintenanceEditor item={item} onClose={()=>setAddMaintenance(false)} onSaved={async()=>{setAddMaintenance(false);await reload();onRefresh?.();}}/>}
  </Modal>;
}
function ImportPanel({onSaved}){
 const [file,setFile]=useState(null),[loading,setLoading]=useState(false),[result,setResult]=useState(null),[error,setError]=useState('');
 const upload=async()=>{if(!file)return;setLoading(true);setError('');setResult(null);try{
  if(!/\.xlsx$/i.test(file.name))throw new Error('Chọn đúng file Excel .xlsx theo mẫu DanhSachTaiSan.');
  const buf=await file.arrayBuffer();
  const r=await rawRequest('/assets/import.xlsx',{method:'POST',headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'},body:buf});
  setResult(r);onSaved();
 }catch(err){setError(err.message)}finally{setLoading(false)}};
 const template=async()=>{try{download(await rawRequest('/assets/template.xlsx',{blob:true}),'Mau_Import_HEXA.xlsx')}catch(err){setError(err.message)}};
 return <div className="am-card am-padded"><div className="am-heading"><h3>Import tài sản từ Excel</h3><p>Nhập trực tiếp file DanhSachTaiSan.xlsx, không phải chuyển sang CSV.</p></div>
  <div className="am-import-guide"><strong>Sheet: Assets · 8 cột giữ đúng thứ tự:</strong><code>Mã tài sản | Loại tài sản | Tên tài sản | Công ty | Người sử dụng | Giá tiền | Ghi chú | Địa chỉ IP</code>
   <p>Hệ thống tự tạo loại tài sản và công ty chưa có. Nếu mã tài sản đã tồn tại sẽ bỏ qua, không ghi đè. Người sử dụng cũ được ghi nhận vào lịch sử cấp phát.</p>
  </div>
  <div className="am-inline-form"><input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={e=>setFile(e.target.files?.[0]||null)}/>
   <button className="am-btn am-primary" onClick={upload} disabled={!file||loading}><Upload size={16}/>{loading?'Đang nhập...':'Import Excel'}</button><button className="am-btn am-light" onClick={template}><Download size={15}/> Tải Excel mẫu</button>
  </div>
  {result&&<p className="am-success">Đã tạo {result.created} tài sản, bỏ qua {result.skipped} mã trùng; tạo {result.categoriesCreated} loại và {result.departmentsCreated} công ty.</p>}
  {error&&<p className="am-error">{error}</p>}
 </div>;
}
// HEXA_ASSET_TAB_VISIBILITY_V1: chỉ ẩn các TAB, không thay đổi dữ liệu Firebase.
const HEXA_DEFAULT_HIDDEN_ASSET_TABS = ['stock', 'stocktake', 'reports'];
function hexaReadHiddenAssetTabs(storageKey) {
  try {
    const saved = window.localStorage.getItem(storageKey);
    if (saved === null) return [...HEXA_DEFAULT_HIDDEN_ASSET_TABS];
    const items = JSON.parse(saved);
    return Array.isArray(items) ? items.filter(id => typeof id === 'string' && id !== 'assets') : [...HEXA_DEFAULT_HIDDEN_ASSET_TABS];
  } catch {
    return [...HEXA_DEFAULT_HIDDEN_ASSET_TABS];
  }
}
export default function AssetManagement({user,initialTicket=null,onClearInitialTicket=()=>{}}){
  const [mode,setMode]=useState('assets'),[data,setData]=useState({items:[],total:0,page:1,pageSize:20,totalPages:1});
  const [catalogs,setCatalogs]=useState({categories:[],departments:[]}),[stats,setStats]=useState({total:0,available:0,using:0,maintenance:0,broken:0,liquidated:0});
  const [filters,setFilters]=useState({search:'',categoryId:'',ownerDepartmentId:'',status:'',page:1,pageSize:20});
  const [searchValue,setSearchValue]=useState(''),[editing,setEditing]=useState(undefined),[assigning,setAssigning]=useState(null),[detail,setDetail]=useState(null);
  const [loading,setLoading]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[warehouseRefreshEpoch,setWarehouseRefreshEpoch]=useState(0);
  /* HEXA_INLINE_ASSET_STATS_20261119_V2: number of inventory SKUs, not sum of mixed units. */
  const [hexaWarehouseSkuCount, hexaSetWarehouseSkuCount] = useState(null);
  const hexaRefreshWarehouseCount = useCallback(async () => {
    try {
      const result = await api('/warehouse');
      const count = Number.isFinite(result?.total) ? result.total : Array.isArray(result?.items) ? result.items.length : null;
      hexaSetWarehouseSkuCount(count);
    } catch { hexaSetWarehouseSkuCount(null); }
  }, []);
  useEffect(() => { hexaRefreshWarehouseCount(); }, [hexaRefreshWarehouseCount,mode,warehouseRefreshEpoch]);
  const isManager=user.role==='manager';
  const hexaTabStorageKey = 'hexa.asset.hiddenTabs.v1:' + (user?.uid || user?.email || 'local');
  const [hexaHiddenTabs, hexaSetHiddenTabs] = useState(() => hexaReadHiddenAssetTabs(hexaTabStorageKey));
  const [hexaTabMenuOpen, hexaSetTabMenuOpen] = useState(false);
  const [hexaExtraMenuOpen, hexaSetExtraMenuOpen] = useState(false);
  const hexaExtraMenuRef = useRef(null);
  useEffect(() => {
    hexaSetHiddenTabs(hexaReadHiddenAssetTabs(hexaTabStorageKey));
  }, [hexaTabStorageKey]);
  useEffect(() => {
    try { window.localStorage.setItem(hexaTabStorageKey, JSON.stringify(hexaHiddenTabs)); } catch {}
  }, [hexaTabStorageKey, hexaHiddenTabs]);
  useEffect(() => {
    if (!hexaExtraMenuOpen) return;
    const onPointer = event => { if (!hexaExtraMenuRef.current?.contains(event.target)) hexaSetExtraMenuOpen(false); };
    const onKey = event => { if (event.key === 'Escape') hexaSetExtraMenuOpen(false); };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onPointer); document.removeEventListener('keydown', onKey); };
  }, [hexaExtraMenuOpen]);
  const hexaToggleTab = id => {
    if (['assets','warehouse','printers','trash'].includes(id)) return; // Không ẩn mục chính để luôn có nơi quay về.
    hexaSetHiddenTabs(previous => previous.includes(id) ? previous.filter(x => x !== id) : [...previous, id]);
    if (mode === id && !hexaHiddenTabs.includes(id)) setMode('assets');
  };

  const toggleAssetSort=key=>setFilters(current=>{ const next=toggleColumnSort(current.sortBy,key); return {...current, sortBy:next, sortDirection:next?'asc':'', page:1 }; });
  const reloadCatalogs=useCallback(async()=>{setCatalogs(await api('/assets/catalogs'));},[]);
  const load=useCallback(async()=>{setLoading(true);try{
    const params=new URLSearchParams();for(const [k,v] of Object.entries(filters))if(v!==''&&v!=null)params.set(k,String(v));
    if(mode==='trash')params.set('trash','1');
    const [result,summary]=await Promise.all([api(`/assets?${params}`),api('/assets/summary')]);
    setData(result);setStats(summary);setError('');
  }catch(err){setError(err.message);}finally{setLoading(false);}},[filters,mode]);
  useEffect(()=>{reloadCatalogs().catch(err=>setError(err.message));},[reloadCatalogs]);
  useEffect(()=>{const timer=setTimeout(()=>setFilters(f=>({...f,search:searchValue,page:1})),300);return()=>clearTimeout(timer);},[searchValue]);
  useEffect(()=>{if(mode==='assets'||mode==='trash')load();},[mode,load]);
  useEffect(()=>{if(mode!=='assets'&&mode!=='trash')return;const interval=setInterval(()=>load(),60000);return()=>clearInterval(interval);},[load,mode]);
  const refresh=async()=>{await Promise.all([load(),reloadCatalogs(),hexaRefreshWarehouseCount()]);setNotice('Dữ liệu đã được cập nhật.');};
  const saved=async()=>{setEditing(undefined);setAssigning(null);setDetail(null);setWarehouseRefreshEpoch(n=>n+1);await refresh();};
  const remove=async item=>{if(!window.confirm(`Chuyển ${item.assetCode} vào thùng rác?`))return;try{await api(`/assets/${item.id}`,{method:'DELETE'});await refresh();}catch(err){setError(err.message);}};
  const restore=async item=>{try{await api(`/assets/${item.id}/restore`,{method:'POST'});await refresh();}catch(err){setError(err.message);}};
  const xlsx=async()=>{try{download(await rawRequest('/assets/export.xlsx',{blob:true}),`DanhSachTaiSan_HEXA_${new Date().toISOString().slice(0,10)}.xlsx`);}catch(err){setError(err.message);}};
  useEffect(()=>{if(initialTicket){setMode('assets');setEditing({...initialAsset,assetName:initialTicket.itemName||initialTicket.subject,description:`Tham chiếu yêu cầu ${initialTicket.code||initialTicket.id}`});onClearInitialTicket();}},[initialTicket,onClearInitialTicket]);
  /* HEXA_ASSET_DENSE_NAV_20261119_V1: reorganize navigation only; keep all asset data and operations. */
  const modes=[['assets','Danh sách tài sản',Boxes],['warehouse','Kho thiết bị',PackageSearch],['printers','Quản lý máy in',Wrench],['stock','Kho linh kiện',HardDrive],['reports','Báo cáo tài sản',Building2],['trash','Thùng rác',Trash2],...(isManager?[['catalogs','Danh mục',Tags],['import','Nhập dữ liệu',Upload],['backups','Sao lưu',Download]]:[])];
  const hexaPrimaryModes = modes.filter(([id]) => ['assets','warehouse','printers'].includes(id));
  const hexaOptionalModes = modes.filter(([id]) => !['assets','warehouse','printers','trash'].includes(id));
  const hexaExtraModes = hexaOptionalModes.filter(([id]) => !hexaHiddenTabs.includes(id));
  const hexaSelectMode = id => {
    setError(''); setNotice(''); setMode(id);
    setFilters(f => ({...f,page:1}));
    hexaSetExtraMenuOpen(false); hexaSetTabMenuOpen(false);
  };
  return <div className="am-root">

    <div className="am-tabs-toolbar am-tabs-with-stats">
      <div className="am-pill-tabs am-main-tabs" role="tablist" aria-label="Phân hệ thường dùng">
        {hexaPrimaryModes.map(([id,label,Icon])=><button key={id} type="button" role="tab" aria-selected={mode===id} className={mode===id?'active':''} onClick={()=>hexaSelectMode(id)}><Icon size={15}/>{label}</button>)}
      </div>
      <div className="am-inline-stats" aria-label="Thống kê tài sản và kho">
        <div className="am-inline-stat" title="Tổng số tài sản" aria-label={`Tổng tài sản: ${stats.total}`}><Boxes size={13}/><span>Tổng TS</span><strong>{stats.total}</strong></div>
        <div className="am-inline-stat" title="Số tài sản đang có sẵn" aria-label={`Có sẵn: ${stats.available}`}><CheckCircle2 size={13}/><span>Có sẵn</span><strong>{stats.available}</strong></div>
        <div className="am-inline-stat" title="Số mã vật tư đang quản lý trong kho (không cộng các đơn vị khác nhau)" aria-label={`Tổng kho: ${hexaWarehouseSkuCount ?? 'chưa tải'}`}><PackageSearch size={13}/><span>Tổng kho</span><strong>{hexaWarehouseSkuCount ?? '—'}</strong></div>
      </div>
      <div className="am-tab-menu-actions">
        {/* HEXA_ONE_MORE_MENU_READABLE_TABLE_20261119_V1: keep all secondary modules and visibility controls in one menu. */}
        <div className="am-more-wrapper" ref={hexaExtraMenuRef}>
          <button type="button" className={'am-more-trigger'+(hexaExtraModes.some(([id])=>id===mode)?' active':'')} aria-expanded={hexaExtraMenuOpen} aria-controls="hexa-extra-tab-list" onClick={()=>{hexaSetExtraMenuOpen(open=>!open);hexaSetTabMenuOpen(false);}}><LayoutGrid size={15}/> Thêm <ChevronRight className="am-more-caret" size={13}/></button>
          {hexaExtraMenuOpen&&<div className="am-extra-dropdown am-more-unified" id="hexa-extra-tab-list" role="group" aria-label="Điều hướng và tùy chỉnh mục phụ">
            <div className="am-more-section-title">Công cụ khác</div>
            {hexaExtraModes.length?hexaExtraModes.map(([id,label,Icon])=><button type="button" key={id} className={mode===id?'active':''} onClick={()=>hexaSelectMode(id)}><Icon size={15}/>{label}</button>):<p>Chưa có mục phụ đang bật.</p>}
            <div className="am-more-divider"/>
            <button type="button" className="am-more-customize-trigger" aria-expanded={hexaTabMenuOpen} aria-controls="hexa-more-visibility" onClick={()=>hexaSetTabMenuOpen(open=>!open)}><LayoutGrid size={15}/> Hiện / ẩn mục <ChevronRight size={13} className={'am-more-customize-caret'+(hexaTabMenuOpen?' expanded':'')}/></button>
            {hexaTabMenuOpen&&<div className="am-more-visibility" id="hexa-more-visibility" role="group" aria-label="Chọn các công cụ trong menu Thêm">
              {hexaOptionalModes.map(([id,label,Icon])=><label key={id} className="am-more-visibility-item"><input type="checkbox" checked={!hexaHiddenTabs.includes(id)} onChange={()=>hexaToggleTab(id)}/><Icon size={15}/><span>{label}</span></label>)}
              <button type="button" className="am-more-show-all" onClick={()=>hexaSetHiddenTabs([])}>Hiện tất cả</button>
            </div>}
          </div>}
        </div>
        <button type="button" title="Thùng rác" aria-label="Thùng rác" className={'am-trash-shortcut'+(mode==='trash'?' active':'')} onClick={()=>hexaSelectMode('trash')}><Trash2 size={17}/></button>
      </div>
    </div>
    {error&&<div className="am-error am-banner">{error}<button onClick={()=>setError('')} aria-label="Đóng lỗi"><X size={15}/></button></div>}
    {notice&&<div className="am-success am-banner">{notice}<button onClick={()=>setNotice('')} aria-label="Đóng thông báo"><X size={15}/></button></div>}
    <div className="am-tab-stage" key={mode} aria-label="Nội dung Quản lý tài sản">
    {(mode==='assets'||mode==='trash')&&<div className="am-card am-asset-list-card">
      <div className="am-filter-bar am-assets-toolbar"><div className="am-search"><Search size={17}/><input placeholder="Tìm mã, tên, IP, serial, người dùng..." value={searchValue} onChange={e=>setSearchValue(e.target.value)}/></div>
        <select value={filters.ownerDepartmentId} onChange={e=>setFilters(f=>({...f,page:1,ownerDepartmentId:e.target.value}))}><option value="">Tất cả công ty</option>{catalogs.departments.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
        <select value={filters.categoryId} onChange={e=>setFilters(f=>({...f,page:1,categoryId:e.target.value}))}><option value="">Tất cả loại</option>{catalogs.categories.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
        <select value={filters.status} onChange={e=>setFilters(f=>({...f,page:1,status:e.target.value}))}><option value="">Mọi trạng thái</option>{Object.entries(STATUS).map(([code,label])=><option key={code} value={code}>{label}</option>)}</select>
        <button type="button" className="am-btn am-light" onClick={xlsx}><Download size={15}/> Xuất Excel</button>
        <div className="am-toolbar-actions">
          <button type="button" className="am-btn am-light" onClick={refresh} disabled={loading}><RefreshCw size={15}/> Làm mới</button>
          {mode==='assets'&&<button type="button" className="am-btn am-primary" onClick={()=>setEditing(null)}><Plus size={15}/> Thêm tài sản</button>}
        </div>
      </div>
      <div className="am-table-wrap"><table className="am-table am-assets-table"><thead><tr>
        <SortableHeader label="Mã tài sản" sortKey="assetCode" activeKey={filters.sortBy} onToggle={toggleAssetSort}/>
        <SortableHeader label="Loại / Tên tài sản" sortKey="assetName" activeKey={filters.sortBy} onToggle={toggleAssetSort} title="Sắp xếp theo tên tài sản; nhấn lần nữa để bỏ sắp xếp"/>
        <SortableHeader label="Công ty sở hữu" sortKey="ownerDepartmentName" activeKey={filters.sortBy} onToggle={toggleAssetSort}/>
        <SortableHeader label="Người sử dụng" sortKey="assignedTo" activeKey={filters.sortBy} onToggle={toggleAssetSort}/>
        <SortableHeader label="Serial / IP" sortKey="serialOrIp" activeKey={filters.sortBy} onToggle={toggleAssetSort}/>
        <SortableHeader label="Trạng thái" sortKey="status" activeKey={filters.sortBy} onToggle={toggleAssetSort}/>
        <th scope="col">Thao tác</th>
      </tr></thead>
        <tbody>{data.items.map(item=><tr key={item.id}><td><button className="am-link strong" title={item.assetCode} onClick={()=>setDetail(item)}>{item.assetCode}</button></td><td><b title={item.assetName}>{item.assetName}</b><small>{item.categoryName||'Chưa phân loại'}</small></td><td>{item.ownerDepartmentName||'—'}</td><td>{item.assignedTo||'—'}</td><td>{item.serialNumber||'—'}<small>{item.ipAddress||''}</small></td><td><span className={`am-status ${item.status}`}>{STATUS[item.status]||item.status}</span></td><td><div className="am-row-actions">
          {mode==='assets'?<><button title="Chi tiết / Lịch sử" onClick={()=>setDetail(item)}><History size={15}/></button><button title="Mã QR" onClick={()=>setDetail({...item,initialTab:'qr'})}><QrCode size={15}/></button><button title="Sửa" onClick={()=>setEditing(item)}><Pencil size={15}/></button><button title={item.status==='using'?'Thu hồi':item.status==='available'?'Bàn giao':'Chuyển về Có sẵn trước khi bàn giao'} onClick={()=>{if(item.status==='using'||item.status==='available')setAssigning(item);else{setEditing(item);setNotice('Hãy chuyển tài sản về Có sẵn, lưu lại rồi mới bàn giao.');}}}><ArrowRightLeft size={15}/></button><button title="Xóa mềm" onClick={()=>remove(item)}><Trash2 size={15}/></button></>:<button className="am-btn am-light" onClick={()=>restore(item)}><RotateCcw size={15}/> Khôi phục</button>}
          </div></td></tr>)}
          {!loading&&!data.items.length&&<tr><td colSpan={7} className="am-empty"><PackageSearch size={28}/> Chưa có tài sản phù hợp với bộ lọc.</td></tr>}
          {loading&&!data.items.length&&<tr><td colSpan={7} className="am-empty">Đang tải dữ liệu...</td></tr>}
        </tbody></table></div>
      <footer className="am-pagination"><span>{data.total} tài sản · Trang {data.page}/{data.totalPages}</span><div><button disabled={filters.page<=1} onClick={()=>setFilters(f=>({...f,page:f.page-1}))}><ChevronLeft size={17}/></button><button disabled={filters.page>=data.totalPages} onClick={()=>setFilters(f=>({...f,page:f.page+1}))}><ChevronRight size={17}/></button></div></footer>
    </div>}
    {(mode==='warehouse'||mode==='stock')&&<WarehouseManagement kind={mode} refreshEpoch={warehouseRefreshEpoch} onAssignAsset={setAssigning} onShowAsset={setDetail}/>}
    {mode==='printers'&&<PrinterManagement user={user} refreshEpoch={warehouseRefreshEpoch}/> }
    {mode==='reports'&&<AssetReportPanel/>}
    {mode==='stocktake'&&<AssetStocktakePanel catalogs={catalogs.departments} isManager={isManager}/>}
    {mode==='backups'&&isManager&&<AssetBackupPanel/>}
    {mode==='catalogs'&&isManager&&<CatalogManager catalogs={catalogs} onSaved={reloadCatalogs}/>} 
    {mode==='import'&&isManager&&<ImportPanel onSaved={refresh}/>}
    </div>
    {editing!==undefined&&<AssetForm item={editing} catalogs={catalogs} onClose={()=>setEditing(undefined)} onSaved={saved}/>}
    {assigning&&<AssignmentForm item={assigning} onClose={()=>setAssigning(null)} onSaved={saved}/>}
    {detail&&<AssetDetail item={detail} onClose={()=>setDetail(null)} onRefresh={refresh}/>}
  </div>;
}

// HEXA_QR_PHOTO_FIX_20261120: QR public/basic; private detail only with authenticated IT token.
export function PublicAssetPage({publicId}){
  const [item,setItem]=useState(null),[detail,setDetail]=useState(null),[error,setError]=useState(''),[privateError,setPrivateError]=useState('');
  useEffect(()=>{let alive=true;setItem(null);setError('');
    fetch(`${BASE}/api/public/assets/${encodeURIComponent(publicId)}`).then(async r=>{const data=await r.json();if(!r.ok)throw new Error(data.error||'Không tìm thấy tài sản.');return data;})
      .then(data=>{if(alive)setItem(data);}).catch(e=>{if(alive)setError(e.message);});
    return()=>{alive=false;};
  },[publicId]);
  useEffect(()=>{let alive=true;setDetail(null);setPrivateError('');
    const unsubscribe=auth.onAuthStateChanged(user=>{
      if(!user){if(alive){setDetail(null);setPrivateError('');}return;}
      api(`/assets/qr/${encodeURIComponent(publicId)}/private`)
        .then(data=>{if(alive)setDetail(data);}).catch(e=>{if(alive)setPrivateError(e.message);});
    });
    return()=>{alive=false;unsubscribe();};
  },[publicId]);
  const display=detail?{...item,...detail}:item;
  return <main className="am-public"><div className="am-public-card"><div className="am-eyebrow">HEXA GROUP · QUẢN LÝ TÀI SẢN</div><h1>Thông tin tài sản</h1>
    {error?<p className="am-error">{error}</p>:display?<div className="am-detail-grid">{[
      ['Mã tài sản',display.assetCode],['Tên tài sản',display.assetName],['Loại thiết bị',display.categoryName||'Chưa cập nhật'],
      ['Công ty sở hữu',display.ownerDepartmentName||'Chưa cập nhật'],['Trạng thái',STATUS[display.status]||'Chưa cập nhật'],
      ...(detail?[['Người đang sử dụng',detail.assignedTo||'Chưa bàn giao'],['Phòng ban sử dụng',detail.userDepartment||'Chưa cập nhật'],['Địa chỉ IP',detail.ipAddress||'Chưa cập nhật'],['Serial',detail.serialNumber||'Chưa cập nhật']]:[])
    ].map(([k,v])=><div key={k}><small>{k}</small><strong>{v}</strong></div>)}</div>:<p>Đang tải...</p>}
    {!detail&&item&&<p className="am-qr-login-note">IP, serial và người đang sử dụng chỉ hiển thị khi đăng nhập tài khoản IT tại <a href="/it">HEXA IT</a>. Sau khi đăng nhập, hãy quét hoặc mở lại QR.</p>}
    {privateError&&<p className="am-muted">Thông tin nội bộ chưa hiển thị: {privateError}</p>}
    <a className="am-btn am-primary" href="/it">Về trang quản lý IT</a>
  </div></main>;
}
