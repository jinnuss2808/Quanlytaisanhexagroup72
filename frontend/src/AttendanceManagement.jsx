import React,{useCallback,useEffect,useState} from 'react';
import {Plus,RefreshCw,Clock3,UserPlus,ClipboardList,Search,ExternalLink,ShieldCheck} from 'lucide-react';
import {api} from './api.js';
import './hexa-modules.css';

const initial={employeeCode:'',name:'',company:'',email:'',password:''};
const currentMonth=()=>{const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit'}).formatToParts(new Date()).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));return `${parts.year}-${parts.month}`;};
const fmtTime=value=>value?new Date(value).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit'}):'—';
export default function AttendanceManagement(){
  const [employees,setEmployees]=useState([]),[records,setRecords]=useState([]),[month,setMonth]=useState(currentMonth);
  const [form,setForm]=useState(initial),[showForm,setShowForm]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[filter,setFilter]=useState('');
  const refresh=useCallback(async()=>{
    try {const [people,rows]=await Promise.all([api('/attendance/admin/employees'),api(`/attendance/admin/records?month=${month}`)]);
      setEmployees(people.employees||[]);setRecords(rows.records||[]);setError('');}
    catch(e){setError(e.message);}
  },[month]);
  useEffect(()=>{refresh();},[refresh]);
  const submit=async event=>{
    event.preventDefault();setBusy(true);setError('');setNotice('');
    try {await api('/attendance/admin/employees',{method:'POST',body:form});setNotice('Đã tạo tài khoản chấm công. Mật khẩu khởi tạo chỉ gửi tới Firebase Authentication.');setForm(initial);setShowForm(false);await refresh();}
    catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const changeActive=async p=>{if(!window.confirm(`${p.active?'Khóa':'Mở khóa'} tài khoản ${p.name}?`))return;
    try{await api(`/attendance/admin/employees/${p.uid}`,{method:'PATCH',body:{active:!p.active}});await refresh();}catch(e){setError(e.message);}};
  const found=employees.filter(x=>`${x.employeeCode} ${x.name} ${x.company} ${x.email}`.toLowerCase().includes(filter.toLowerCase()));
  return <section className="hm-root">
    <div className="hm-toolbar"><div><strong>Chấm công nhân viên</strong><p>Quản lý hồ sơ và lịch sử chấm giờ. Giờ ghi nhận theo giờ Việt Nam.</p></div><div className="hm-actions"><a className="hm-btn" href="/attendance" target="_blank" rel="noopener noreferrer"><ExternalLink size={16}/> Trang chấm công</a><button className="hm-btn" onClick={refresh}><RefreshCw size={16}/> Làm mới</button><button className="hm-btn primary" onClick={()=>setShowForm(v=>!v)}><UserPlus size={16}/> Thêm nhân viên</button></div></div>
    {error&&<p className="hm-alert" role="alert">{error}</p>}{notice&&<p className="hm-note">{notice}</p>}
    {showForm&&<form onSubmit={submit} className="hm-panel hm-form"><h3>Thêm nhân viên chấm công</h3><div className="hm-fields">
      <label>Mã nhân viên *<input required maxLength={40} value={form.employeeCode} onChange={e=>setForm(f=>({...f,employeeCode:e.target.value}))} placeholder="VD: CL18.326"/></label>
      <label>Họ và tên *<input required maxLength={120} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Họ tên nhân viên"/></label>
      <label>Công ty *<input required maxLength={80} value={form.company} onChange={e=>setForm(f=>({...f,company:e.target.value}))} placeholder="HMF / HXG / GDB"/></label>
      <label>Email đăng nhập *<input required type="email" autoComplete="off" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="nhanvien@congty.vn"/></label>
      <label>Mật khẩu khởi tạo *<input required type="password" autoComplete="new-password" minLength={8} value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))}/></label>
    </div><p className="hm-hint">Mật khẩu không được lưu trong bảng nhân viên hoặc lịch sử chấm công. Nhân viên đăng nhập tại /attendance. Chấm công là giờ do máy chủ ghi nhận, không xác minh vị trí GPS.</p><div className="hm-actions"><button className="hm-btn primary" disabled={busy}><Plus size={16}/>{busy?'Đang tạo...':'Tạo tài khoản'}</button><button className="hm-btn" type="button" onClick={()=>setShowForm(false)}>Hủy</button></div></form>}
    <div className="hm-panel"><div className="hm-panel-head"><h3>Danh sách nhân viên ({employees.length})</h3><div className="hm-search"><Search size={16}/><input aria-label="Tìm nhân viên" placeholder="Tìm mã, tên, công ty, email" value={filter} onChange={e=>setFilter(e.target.value)}/></div></div>
      <div className="hm-scroll"><table><thead><tr><th>Mã NV</th><th>Họ tên</th><th>Công ty</th><th>Email</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{found.map(p=><tr key={p.uid}><td><strong>{p.employeeCode}</strong></td><td>{p.name}</td><td>{p.company}</td><td>{p.email}</td><td>{p.active?'Hoạt động':'Đã khóa'}</td><td><button className="hm-btn small" onClick={()=>changeActive(p)}>{p.active?'Khóa':'Mở khóa'}</button></td></tr>)}{!found.length&&<tr><td colSpan={6}>Chưa có nhân viên phù hợp.</td></tr>}</tbody></table></div>
    </div>
    <div className="hm-panel"><div className="hm-panel-head"><h3><ClipboardList size={18}/> Bảng chấm công</h3><label className="hm-month">Tháng <input type="month" value={month} onChange={e=>setMonth(e.target.value)}/></label></div>
      <div className="hm-scroll"><table><thead><tr><th>Ngày</th><th>Mã NV</th><th>Nhân viên</th><th>Công ty</th><th>Giờ vào</th><th>Giờ ra</th></tr></thead><tbody>{records.map(r=><tr key={r.uid+r.date}><td>{r.date}</td><td>{r.employeeCode}</td><td>{r.name}</td><td>{r.company}</td><td>{fmtTime(r.checkInAt)}</td><td>{fmtTime(r.checkOutAt)}</td></tr>)}{!records.length&&<tr><td colSpan={6}>Chưa có lượt chấm công trong tháng.</td></tr>}</tbody></table></div>
    </div>
  </section>;
}
