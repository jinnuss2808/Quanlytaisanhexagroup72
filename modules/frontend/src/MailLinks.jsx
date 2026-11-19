import React,{useCallback,useEffect,useState} from 'react';
import {Plus,ExternalLink,Copy,RefreshCw,Trash2,LockKeyhole,Mail} from 'lucide-react';
import {api} from './api.js';import './hexa-modules.css';
const formDefault={title:'Tạo mail HEXA',url:'https://103.232.120.76/domainadmin/',username:'',password:''};
export default function MailLinks(){
 const [rows,setRows]=useState([]),[form,setForm]=useState(formDefault),[adding,setAdding]=useState(false),[editId,setEditId]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const refresh=useCallback(async()=>{try{setRows(await api('/mail-links'));setError('');}catch(e){setError(e.message);}},[]);
 useEffect(()=>{refresh();},[refresh]);
 const save=async e=>{e.preventDefault();setBusy(true);setError('');try{await api(editId?`/mail-links/${editId}`:'/mail-links',{method:editId?'PATCH':'POST',body:form});setForm(formDefault);setAdding(false);setEditId(null);setNotice('Đã lưu liên kết, mật khẩu được mã hóa trên backend.');await refresh();}catch(e){setError(e.message);}finally{setBusy(false);}};
 const copy=async text=>{try{await navigator.clipboard.writeText(text);setNotice('Đã sao chép. Lưu ý xóa nội dung clipboard sau khi sử dụng trên máy dùng chung.');}catch{setError('Không thể truy cập clipboard. Kiểm tra quyền trên trình duyệt.');}};
 const copyPassword=async id=>{setBusy(true);setError('');try{const {password}=await api(`/mail-links/${id}/reveal`,{method:'POST',body:{}});await copy(password);}catch(e){setError(e.message);}finally{setBusy(false);}};
 const edit=r=>{setForm({title:r.title,url:r.url,username:r.username,password:''});setEditId(r.id);setAdding(true);};
 const remove=async r=>{if(!window.confirm(`Xóa liên kết ${r.title}?`))return;try{await api(`/mail-links/${r.id}`,{method:'DELETE'});await refresh();}catch(e){setError(e.message);}};
 return <section className="hm-root"><div className="hm-toolbar"><div><strong>Link mail và tài khoản quản trị</strong><p>Chỉ quản lý IT có quyền truy cập. Mật khẩu được mã hóa ở backend và không xuất hiện trong danh sách.</p></div><div className="hm-actions"><button className="hm-btn" onClick={refresh}><RefreshCw size={16}/> Làm mới</button><button className="hm-btn primary" onClick={()=>{setForm(formDefault);setEditId(null);setAdding(v=>!v);}}><Plus size={16}/> Thêm link mail</button></div></div>
 {error&&<p className="hm-alert" role="alert">{error}</p>}{notice&&<p className="hm-note">{notice}</p>}
 <p className="hm-hint"><LockKeyhole size={15}/> Khi bấm Mở trang, website sẽ mở ở tab mới. HEXA không thể tự điền mật khẩu trên website bên ngoài; hãy dùng trình quản lý mật khẩu của trình duyệt hoặc sao chép thông tin theo từng thao tác.</p>
 {adding&&<form className="hm-panel hm-form" onSubmit={save}><h3>{editId?'Sửa tài khoản / liên kết':'Thêm tài khoản / liên kết'}</h3><div className="hm-fields">
 <label>Tên liên kết *<input required value={form.title} maxLength={120} onChange={e=>setForm(s=>({...s,title:e.target.value}))}/></label>
 <label>Địa chỉ HTTPS *<input required type="url" value={form.url} onChange={e=>setForm(s=>({...s,url:e.target.value}))}/></label>
 <label>Tài khoản *<input required autoComplete="off" value={form.username} onChange={e=>setForm(s=>({...s,username:e.target.value}))}/></label>
 <label>{editId?"Mật khẩu mới (để trống nếu giữ nguyên)":"Mật khẩu *"}<input required={!editId} type="password" autoComplete="new-password" value={form.password} onChange={e=>setForm(s=>({...s,password:e.target.value}))}/></label></div>
 <div className="hm-actions"><button className="hm-btn primary" disabled={busy}>{editId?"Cập nhật":"Lưu tài khoản"}</button><button className="hm-btn" type="button" onClick={()=>{setAdding(false);setEditId(null);setForm(formDefault);}}>Hủy</button></div></form>}
 <div className="hm-panel"><div className="hm-scroll"><table><thead><tr><th>Liên kết</th><th>Tài khoản</th><th>Mật khẩu</th><th>Thao tác</th></tr></thead><tbody>
 {rows.map(r=><tr key={r.id}><td><strong>{r.title}</strong><small>{r.url}</small></td><td>{r.username} <button className="hm-icon-btn" title="Sao chép tên tài khoản" onClick={()=>copy(r.username)}><Copy size={15}/></button></td><td>•••••••• <button className="hm-btn small" disabled={busy} onClick={()=>copyPassword(r.id)}><Copy size={13}/> Chép MK</button></td><td><div className="hm-actions"><button className="hm-btn small" type="button" onClick={()=>edit(r)}>Sửa</button><a className="hm-btn primary small" href={r.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={15}/> Mở trang</a><button className="hm-icon-btn" title="Xóa" onClick={()=>remove(r)}><Trash2 size={15}/></button></div></td></tr>)}
 {!rows.length&&<tr><td colSpan={4}>Chưa có liên kết mail. Nhấn “Thêm link mail” để bắt đầu.</td></tr>}
 </tbody></table></div></div></section>;
}
