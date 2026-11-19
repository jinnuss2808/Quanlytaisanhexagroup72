import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {UserPlus,RefreshCw,Search,Upload,Download,ExternalLink,Copy,Save,Pencil,Users,KeyRound,Eye,EyeOff,Mail,X} from 'lucide-react';
import {auth} from './firebase.js';
import {api} from './api.js';
import './hexa-modules.css';

const blank={employeeCode:'',name:'',company:'',email:'',password:'',mailLinkId:''};
const apiBase=(import.meta.env.VITE_API_URL||'http://127.0.0.1:4000').replace(/\/$/,'');
const isHttpLink=l=>typeof l?.url==='string'&&/^https:\/\//i.test(l.url);
const saveFile=(url,name)=>{const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();};
async function uploadRoster(file,mailLinkId){
  if(!file||!/\.xlsx$/i.test(file.name))throw new Error('Chọn file Excel .xlsx, không phải .xls hoặc .csv.');
  if(file.size>8*1024*1024)throw new Error('File Excel vượt quá 8 MB.');
  const token=await auth.currentUser?.getIdToken();if(!token)throw new Error('Phiên đăng nhập đã hết.');
  let response;
  try{response=await fetch(`${apiBase}/api/attendance/admin/employees/import.xlsx${mailLinkId?`?mailLinkId=${encodeURIComponent(mailLinkId)}`:''}`,
    {method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'},body:await file.arrayBuffer()});}
  catch{throw new Error('Không kết nối được backend. Kiểm tra VITE_API_URL.');}
  const body=await response.json().catch(()=>({}));
  if(!response.ok){const details=Array.isArray(body.errors)?body.errors.slice(0,6).map(x=>`Dòng ${x.row}: ${x.message}`).join(' | '):'';throw new Error(`${body.error||`HTTP ${response.status}`}${details?` — ${details}`:''}`);}
  return body;
}
export default function AttendanceManagement(){
  const [employees,setEmployees]=useState([]),[mailLinks,setMailLinks]=useState([]);
  const [form,setForm]=useState(blank),[editing,setEditing]=useState(''),[showForm,setShowForm]=useState(false);
  const [filter,setFilter]=useState(''),[importOpen,setImportOpen]=useState(false),[importFile,setImportFile]=useState(null),[importLinkId,setImportLinkId]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  // Revealed secrets live only in component memory and are never returned by the list endpoint.
  const [revealedPasswords,setRevealedPasswords]=useState({});
  const refresh=useCallback(async()=>{
    try{const [people,links]=await Promise.all([api('/attendance/admin/employees'),api('/mail-links')]);
      setEmployees(people.employees||[]);setMailLinks((Array.isArray(links)?links:[]).filter(isHttpLink));setError('');}
    catch(e){setError(e.message);}
  },[]);
  useEffect(()=>{refresh();},[refresh]);
  const visible=useMemo(()=>employees.filter(x=>`${x.employeeCode||''} ${x.name||''} ${x.company||''} ${x.email||''}`.toLocaleLowerCase('vi').includes(filter.toLocaleLowerCase('vi'))),[employees,filter]);
  const linkOf=id=>mailLinks.find(x=>x.id===id);
  const startAdd=()=>{setForm(blank);setEditing('');setShowForm(true);setError('');setNotice('');};
  const startEdit=p=>{setRevealedPasswords({});setForm({employeeCode:p.employeeCode,name:p.name,company:p.company,email:p.email,password:'',mailLinkId:p.mailLinkId||''});setEditing(p.uid);setShowForm(true);setError('');};
  const save=async e=>{
    e.preventDefault();setBusy(true);setError('');setNotice('');
    try{
      await api(editing?`/attendance/admin/employees/${editing}/profile`:'/attendance/admin/employees',{method:editing?'PATCH':'POST',body:form});
      setNotice(editing?'Đã cập nhật hồ sơ nhân viên.':'Đã thêm nhân viên vào danh sách theo dõi.');setShowForm(false);setEditing('');setForm(blank);await refresh();
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const importExcel=async()=>{
    setBusy(true);setError('');setNotice('');
    try{const data=await uploadRoster(importFile,importLinkId);
      setNotice(`Đã thêm ${data.created} nhân viên; bỏ qua ${data.skipped} dòng trùng${data.invalid?`, ${data.invalid} dòng không hợp lệ`:''}.${data.errors?.length?` Dòng cần kiểm tra: ${data.errors.slice(0,3).map(x=>x.row).join(', ')}.`:''}`);
      setImportFile(null);setImportOpen(false);await refresh();
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const copy=async(value,label)=>{
    if(!value){setError(`Không có ${label} để sao chép.`);return;}
    try{await navigator.clipboard.writeText(value);setNotice(`Đã sao chép ${label}. Hãy xóa clipboard sau khi dùng.`);setError('');}
    catch{setError('Trình duyệt chặn Clipboard. Hãy cho phép quyền sao chép.');}
  };
  const requestPassword=async p=>{
    const response=await api(`/attendance/admin/employees/${p.uid}/reveal`,{method:'POST',body:{}});
    if(typeof response.password!=='string'||!response.password)throw new Error('Chưa có mật khẩu được lưu cho nhân viên này.');
    return response.password;
  };
  const togglePassword=async p=>{
    if(Object.prototype.hasOwnProperty.call(revealedPasswords,p.uid)){
      setRevealedPasswords(current=>{const next={...current};delete next[p.uid];return next;});return;
    }
    setBusy(true);setError('');
    try{const password=await requestPassword(p);setRevealedPasswords(current=>({...current,[p.uid]:password}));}
    catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const copyPassword=async p=>{
    setBusy(true);setError('');
    try{const password=revealedPasswords[p.uid]||await requestPassword(p);await copy(password,`mật khẩu của ${p.name}`);}
    catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const changeActive=async p=>{
    if(!window.confirm(`${p.active?'Ẩn/khóa':'Mở lại'} hồ sơ nhân viên ${p.name}?`))return;
    setBusy(true);setError('');
    try{await api(`/attendance/admin/employees/${p.uid}`,{method:'PATCH',body:{active:!p.active}});await refresh();}
    catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const linkChoices=<><option value="">— Chưa chọn cổng tạo mail —</option>{mailLinks.map(l=><option value={l.id} key={l.id}>{l.title} · {l.category}</option>)}</>;
  const linkButton=id=>{const link=linkOf(id);return link?<a className="hm-btn small" href={link.url} target="_blank" rel="noopener noreferrer" title={link.url}><ExternalLink size={14}/> Mở cổng mail</a>:<span className="hm-muted">Chưa liên kết</span>;};
  return <section className="hm-root hm-roster hm-compact-directory">
    <div className="hm-toolbar hm-compact-toolbar">
      <div className="hm-search hm-toolbar-search"><Search size={16}/><input aria-label="Tìm nhân viên" placeholder="Tìm mã NV, tên, phòng, email..." value={filter} onChange={e=>setFilter(e.target.value)}/></div>
      <div className="hm-actions"><span className="hm-inline-count"><Users size={15}/> {employees.length} nhân viên</span>
        <button type="button" className="hm-btn hm-btn-tight" title="Làm mới" onClick={refresh}><RefreshCw size={15}/> Làm mới</button>
        <button type="button" className="hm-btn hm-btn-tight" onClick={()=>setImportOpen(v=>!v)}><Upload size={15}/> Nhập Excel</button>
        <button type="button" className="hm-btn hm-btn-tight primary" onClick={startAdd}><UserPlus size={15}/> Thêm nhân viên</button>
      </div>
    </div>
    {error&&<p className="hm-alert" role="alert">{error}</p>}{notice&&<p className="hm-note" role="status">{notice}</p>}
    {importOpen&&<div className="hm-panel hm-roster-import">
      <div className="hm-panel-head"><h3><Upload size={17}/> Nhập danh sách từ Excel</h3><button type="button" className="hm-icon-btn" title="Đóng" onClick={()=>setImportOpen(false)}><X size={16}/></button></div>
      <p className="hm-hint">File .xlsx theo 5 cột: <strong>Mã NV · Tên · Phòng · Mail · Mật khẩu</strong>. Được để trống mã NV, tên, phòng hoặc mật khẩu. Cần ít nhất mã NV hoặc mail để kiểm tra trùng; các dòng trùng được bỏ qua.</p>
      <div className="hm-import-controls"><label>File Excel<input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={e=>setImportFile(e.target.files?.[0]||null)}/></label>
        <label>Cổng tạo mail áp dụng cho file<select value={importLinkId} onChange={e=>setImportLinkId(e.target.value)}>{linkChoices}</select></label></div>
      <div className="hm-actions"><button type="button" className="hm-btn" onClick={()=>saveFile('/Mau_Nhap_Nhan_Vien_HEXA.xlsx','Mau_Nhap_Nhan_Vien_HEXA.xlsx')}><Download size={15}/> Tải Excel mẫu</button>
      <button type="button" className="hm-btn primary" disabled={!importFile||busy} onClick={importExcel}><Upload size={15}/>{busy?'Đang nhập...':'Nhập nhân viên'}</button></div>
      <p className="hm-hint hm-security-hint"><KeyRound size={14}/> Excel chứa mật khẩu dạng đọc được. Chỉ dùng trên máy tin cậy và xóa bản có mật khẩu khi hoàn tất. Backend mã hóa trước khi lưu Firebase.</p>
    </div>}
    {showForm&&<form className="hm-panel hm-form" onSubmit={save}>
      <div className="hm-panel-head"><h3>{editing?'Sửa hồ sơ nhân viên':'Thêm nhân viên mới'}</h3><button className="hm-icon-btn" type="button" title="Đóng" onClick={()=>setShowForm(false)}><X size={17}/></button></div>
      <div className="hm-fields">
        <label>Mã nhân viên<input maxLength={40} placeholder="VD: CL18.326" value={form.employeeCode} onChange={e=>setForm(s=>({...s,employeeCode:e.target.value}))}/></label>
        <label>Họ và tên<input maxLength={120} placeholder="Họ và tên nhân viên" value={form.name} onChange={e=>setForm(s=>({...s,name:e.target.value}))}/></label>
        <label>Phòng / Công ty<input maxLength={80} placeholder="HXG / HMF / GDB" value={form.company} onChange={e=>setForm(s=>({...s,company:e.target.value}))}/></label>
        <label>Mail<input type="email" maxLength={254} placeholder="nhanvien@congty.vn" value={form.email} onChange={e=>setForm(s=>({...s,email:e.target.value}))}/></label>
        <label>Mật khẩu {editing?'mới (để trống giữ nguyên)':'(có thể điền sau)'}<input type="password" maxLength={512} autoComplete="new-password" placeholder="Được mã hóa ở backend" value={form.password} onChange={e=>setForm(s=>({...s,password:e.target.value}))}/></label>
        <label>Chọn liên kết để tạo mail<select value={form.mailLinkId} onChange={e=>setForm(s=>({...s,mailLinkId:e.target.value}))}>{linkChoices}</select></label>
      </div>
      <p className="hm-hint">Chỉ cần có <strong>Mail hoặc Mã NV</strong>; các trường khác có thể cập nhật sau.</p>
      {form.mailLinkId&&<div className="hm-actions"><span className="hm-hint">Cổng quản trị được chọn:</span>{linkButton(form.mailLinkId)}</div>}
      <div className="hm-actions"><button type="submit" className="hm-btn primary" disabled={busy}><Save size={16}/>{busy?'Đang lưu...':editing?'Lưu thay đổi':'Thêm vào danh sách'}</button><button type="button" className="hm-btn" onClick={()=>setShowForm(false)}>Hủy</button></div>
    </form>}
    <div className="hm-panel hm-directory-panel"><div className="hm-scroll hm-roster-scroll"><table><thead><tr><th>Mã NV</th><th>Tên</th><th>Phòng</th><th>Mail</th><th>Link tạo mail</th><th>Mật khẩu</th><th>Thao tác</th></tr></thead>
        <tbody>{visible.map(p=><tr key={p.uid} className={!p.active?'hm-roster-inactive':''}>
          <td><strong>{p.employeeCode||'—'}</strong></td><td>{p.name||'—'}</td><td>{p.company||'—'}</td>
          <td><div className="hm-cell-actions"><span className="hm-email" title={p.email||'Chưa có mail'}>{p.email||'—'}</span><button type="button" className="hm-icon-btn" title={`Copy email ${p.name}`} aria-label={`Sao chép email ${p.name||p.employeeCode||p.email}`} disabled={!p.email} onClick={()=>copy(p.email,`email của ${p.name}`)}><Copy size={14}/></button></div></td><td>{linkButton(p.mailLinkId)}</td>
          <td>{p.hasPassword?<div className="hm-cell-actions hm-employee-password"><span className="hm-secret-text" title="Chỉ Admin xem được">{Object.prototype.hasOwnProperty.call(revealedPasswords,p.uid)?revealedPasswords[p.uid]:'••••••••'}</span><button type="button" className="hm-icon-btn" disabled={busy} title={revealedPasswords[p.uid]?'Ẩn mật khẩu':'Hiện mật khẩu'} aria-label={`${revealedPasswords[p.uid]?'Ẩn':'Hiện'} mật khẩu ${p.name||p.employeeCode||p.email}`} onClick={()=>togglePassword(p)}>{revealedPasswords[p.uid]?<EyeOff size={14}/>:<Eye size={14}/>}</button><button type="button" className="hm-icon-btn" disabled={busy} title="Copy mật khẩu" aria-label={`Sao chép mật khẩu ${p.name||p.employeeCode||p.email}`} onClick={()=>copyPassword(p)}><Copy size={14}/></button></div>:<span className="hm-muted">Chưa lưu</span>}</td>
          <td><div className="hm-actions hm-roster-row-actions"><button type="button" className="hm-btn small" onClick={()=>startEdit(p)}><Pencil size={13}/> Sửa</button><button type="button" className="hm-btn small" disabled={busy} onClick={()=>changeActive(p)}>{p.active?'Ẩn':'Mở lại'}</button></div></td>
        </tr>)}{!visible.length&&<tr><td colSpan={7}>Không tìm thấy nhân viên phù hợp.</td></tr>}</tbody>
      </table></div>
    </div>
  </section>;
}
