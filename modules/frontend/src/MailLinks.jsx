import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {Plus,ExternalLink,Copy,RefreshCw,Trash2,Mail,Search,Save,Eye,EyeOff,Edit3} from 'lucide-react';
import {api} from './api.js';
import './hexa-modules.css';

const emptyForm={title:'',url:'',category:'Quản trị mail',note:'',username:'',password:''};
const groups=['Tất cả','Quản trị mail','Webmail','Hosting & DNS','Hệ thống nội bộ'];
const isWebURL=url=>typeof url==='string'&&/^https:\/\//i.test(url);
const seedDrafts=rows=>Object.fromEntries(rows.map(r=>[r.id,{username:r.username||'',password:''}]));
function MailRow({item,draft,onChange,onSave,onCopyUser,onCopyPassword,onEdit,onRemove,onError,busy}){
 const [showPassword,setShowPassword]=useState(false);
 const [revealedPassword,setRevealedPassword]=useState('');
 const [opening,setOpening]=useState(false);
 const passwordStored=Boolean(item.hasPassword);
 const togglePassword=async()=>{
   if(showPassword){setShowPassword(false);setRevealedPassword('');return;}
   if(draft.password){setShowPassword(true);return;}
   if(!passwordStored){setShowPassword(true);return;}
   setOpening(true);
   try{const r=await api(`/mail-links/${item.id}/reveal`,{method:'POST',body:{}});
     if(typeof r.password!=='string')throw new Error('Chưa có mật khẩu được lưu.');
     setRevealedPassword(r.password);setShowPassword(true);
   }catch(e){onError(e.message);}finally{setOpening(false);}
 };
 return <tr className="hm-mail-row">
   <td className="hm-mail-title-cell"><strong>{item.title}</strong><small className="hm-category-inline">{item.category}</small>
     {isWebURL(item.url)?<a className="hm-mail-table-url" href={item.url} target="_blank" rel="noopener noreferrer" title={item.note||item.url}>{item.url}</a>:<small className="hm-mail-table-url" title={item.note||''}>{item.note||'Chưa có URL'}</small>}
   </td>
   <td><div className="hm-credential-control hm-table-input"><input aria-label={`Tài khoản ${item.title}`} type="text" autoComplete="off" spellCheck={false} placeholder="Tài khoản" value={draft.username} maxLength={180} onChange={e=>onChange(item.id,'username',e.target.value)}/><button type="button" title="Copy tài khoản" aria-label={`Copy tài khoản ${item.title}`} onClick={()=>onCopyUser(item)}><Copy size={15}/></button></div></td>
   <td><div className="hm-credential-control hm-table-input"><input aria-label={`Mật khẩu ${item.title}`} type={showPassword?'text':'password'} autoComplete="new-password" placeholder={passwordStored?'Đã lưu ••••••••':'Chưa có mật khẩu'} value={draft.password||(showPassword?revealedPassword:'')} maxLength={512} onChange={e=>{setRevealedPassword('');onChange(item.id,'password',e.target.value);}}/><button type="button" disabled={busy||opening} title={showPassword?'Ẩn mật khẩu':'Hiện mật khẩu'} aria-label={`${showPassword?'Ẩn':'Hiện'} mật khẩu ${item.title}`} onClick={togglePassword}>{showPassword?<EyeOff size={15}/>:<Eye size={15}/>}</button><button type="button" disabled={busy||(!passwordStored&&!draft.password)} title="Copy mật khẩu" aria-label={`Copy mật khẩu ${item.title}`} onClick={()=>onCopyPassword(item)}><Copy size={15}/></button></div></td>
   <td><div className="hm-actions hm-mail-row-actions">
     <button type="button" className="hm-icon-btn" title="Lưu tài khoản / mật khẩu" aria-label={`Lưu ${item.title}`} disabled={busy} onClick={()=>onSave(item)}><Save size={15}/></button>
     {isWebURL(item.url)&&<a className="hm-icon-btn" href={item.url} target="_blank" rel="noopener noreferrer" title="Mở trang" aria-label={`Mở trang ${item.title}`}><ExternalLink size={15}/></a>}
     <button type="button" className="hm-icon-btn" title="Sửa link" aria-label={`Sửa link ${item.title}`} onClick={()=>onEdit(item)}><Edit3 size={15}/></button>
     <button type="button" className="hm-icon-btn hm-danger-action" title="Xóa link" aria-label={`Xóa link ${item.title}`} disabled={busy} onClick={()=>onRemove(item)}><Trash2 size={15}/></button>
   </div></td>
 </tr>;
}
export default function MailLinks(){
 const [rows,setRows]=useState([]),[drafts,setDrafts]=useState({}),[group,setGroup]=useState('Tất cả'),[search,setSearch]=useState('');
 const [form,setForm]=useState(emptyForm),[adding,setAdding]=useState(false),[editId,setEditId]=useState(null);
 const [busyId,setBusyId]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const refresh=useCallback(async()=>{
  try{const data=await api('/mail-links');const next=Array.isArray(data)?data:[];setRows(next);setDrafts(seedDrafts(next));setError('');}
  catch(e){setError('Không tải được danh sách liên kết: '+e.message);}
 },[]);
 useEffect(()=>{refresh();},[refresh]);
 const visible=useMemo(()=>rows.filter(r=>
   (group==='Tất cả'||r.category===group)&&`${r.title} ${r.url||''} ${r.note||''} ${r.category}`.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi'))
 ),[rows,group,search]);
 const editDraft=(id,field,value)=>setDrafts(current=>({...current,[id]:{...(current[id]||{username:'',password:''}),[field]:value}}));
 const toast=(message,isError=false)=>{setNotice(isError?'':message);setError(isError?message:'');};
 const copy=async(value,label)=>{
  if(!value){toast(`Chưa có ${label} để sao chép.`,true);return;}
  try{await navigator.clipboard.writeText(value);toast(`Đã sao chép ${label}. Hãy xóa clipboard sau khi sử dụng trên máy chung.`);}
  catch{toast('Không thể sao chép. Kiểm tra quyền Clipboard của trình duyệt.',true);}
 };
 const copyUser=r=>copy(drafts[r.id]?.username||'',`tài khoản của ${r.title}`);
 const copyPassword=async r=>{
  const typed=drafts[r.id]?.password||'';
  if(typed){await copy(typed,`mật khẩu của ${r.title}`);return;}
  if(!r.hasPassword){toast('Chưa lưu mật khẩu cho liên kết này.',true);return;}
  setBusyId(r.id);toast('');
  try{const data=await api(`/mail-links/${r.id}/reveal`,{method:'POST',body:{}});await copy(data.password,`mật khẩu của ${r.title}`);}
  catch(e){toast(e.message,true);}finally{setBusyId('');}
 };
 const saveCredentials=async r=>{
  setBusyId(r.id);toast('');
  try{
   const draft=drafts[r.id]||{username:'',password:''};
   const body={username:draft.username};
   if(draft.password) body.password=draft.password;
   await api(`/mail-links/${r.id}`,{method:'PATCH',body});
   await refresh();toast(`Đã lưu tài khoản/mật khẩu của ${r.title}.`);
  }catch(e){toast(e.message,true);}finally{setBusyId('');}
 };
 const saveNew=async e=>{
  e.preventDefault();setBusyId('form');toast('');
  try{
   const body={...form};
   await api(editId?`/mail-links/${editId}`:'/mail-links',{method:editId?'PATCH':'POST',body});
   setAdding(false);setEditId(null);setForm(emptyForm);await refresh();toast('Đã lưu liên kết.');
  }catch(e){toast(e.message,true);}finally{setBusyId('');}
 };
 const edit=r=>{setAdding(true);setEditId(r.id);setForm({title:r.title,url:r.url||'',category:r.category||'Quản trị mail',note:r.note||'',username:r.username||'',password:''});};
 const remove=async r=>{
  if(!window.confirm(`Ẩn / xóa liên kết "${r.title}" khỏi danh sách?`))return;
  setBusyId(r.id);toast('');
  try{await api(`/mail-links/${r.id}`,{method:'DELETE'});await refresh();toast('Đã ẩn/xóa liên kết.');}
  catch(e){toast(e.message,true);}finally{setBusyId('');}
 };
 return <section className="hm-root hm-mail-v2 hm-compact-directory">
   <div className="hm-toolbar hm-compact-toolbar">
     <div className="hm-search hm-toolbar-search"><Search size={16}/><input aria-label="Tìm liên kết mail" placeholder="Tìm dịch vụ mail, tên miền, IP..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
     <div className="hm-actions">
       <select className="hm-compact-select" aria-label="Lọc nhóm link mail" value={group} onChange={e=>setGroup(e.target.value)}>{groups.map(g=><option value={g} key={g}>{g}</option>)}</select>
       <span className="hm-inline-count">{visible.length}/{rows.length} link</span>
       <button type="button" className="hm-btn hm-btn-tight" title="Làm mới danh sách" onClick={refresh}><RefreshCw size={15}/> Làm mới</button>
       <button type="button" className="hm-btn hm-btn-tight primary" onClick={()=>{setAdding(x=>!x);setForm(emptyForm);setEditId(null);}}><Plus size={15}/> Thêm link</button>
     </div>
   </div>
   {error&&<p className="hm-alert" role="alert">{error}</p>}{notice&&<p className="hm-note" role="status">{notice}</p>}
   {adding&&<form className="hm-panel hm-form hm-compact-form" onSubmit={saveNew}><div className="hm-panel-head"><h3>{editId?'Chỉnh sửa liên kết':'Thêm liên kết mới'}</h3></div><div className="hm-fields">
     <label>Tên liên kết *<input required maxLength={120} value={form.title} onChange={e=>setForm(s=>({...s,title:e.target.value}))}/></label>
     <label>Nhóm<select value={form.category} onChange={e=>setForm(s=>({...s,category:e.target.value}))}>{groups.slice(1).map(s=><option key={s}>{s}</option>)}</select></label>
     <label>URL HTTPS<input type="url" placeholder="https://..." value={form.url} onChange={e=>setForm(s=>({...s,url:e.target.value}))}/></label>
     <label>Ghi chú<input maxLength={600} value={form.note} onChange={e=>setForm(s=>({...s,note:e.target.value}))} placeholder="Dịch vụ / địa chỉ nội bộ..."/></label>
     <label>Tài khoản<input maxLength={180} autoComplete="off" value={form.username} onChange={e=>setForm(s=>({...s,username:e.target.value}))}/></label>
     <label>{editId?'Đổi mật khẩu (để trống giữ nguyên)':'Mật khẩu'}<input type="password" autoComplete="new-password" maxLength={512} value={form.password} onChange={e=>setForm(s=>({...s,password:e.target.value}))}/></label>
   </div><div className="hm-actions"><button className="hm-btn hm-btn-tight primary" disabled={Boolean(busyId)} type="submit"><Save size={15}/> Lưu</button><button className="hm-btn hm-btn-tight" type="button" onClick={()=>{setAdding(false);setEditId(null);}}>Hủy</button></div></form>}
   <div className="hm-panel hm-directory-panel"><div className="hm-scroll hm-mail-table-scroll"><table className="hm-mail-table"><thead><tr><th>Liên kết</th><th>Tài khoản</th><th>Mật khẩu</th><th>Thao tác</th></tr></thead><tbody>
     {visible.map(r=><MailRow key={r.id} item={r} draft={drafts[r.id]||{username:'',password:''}} onChange={editDraft} onSave={saveCredentials} onCopyUser={copyUser} onCopyPassword={copyPassword} onEdit={edit} onRemove={remove} onError={e=>toast(e,true)} busy={Boolean(busyId)}/>)}
     {!visible.length&&<tr><td colSpan={4} className="hm-empty-links">Không có liên kết phù hợp.</td></tr>}
   </tbody></table></div></div>
 </section>;
}
