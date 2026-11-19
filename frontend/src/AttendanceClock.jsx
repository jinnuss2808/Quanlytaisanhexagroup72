import React,{useEffect,useState} from 'react';
import {onAuthStateChanged,signInWithEmailAndPassword,signOut} from 'firebase/auth';
import {Clock3,LogIn,LogOut,RefreshCw,CheckCircle2} from 'lucide-react';
import {auth} from './firebase.js';import {api} from './api.js';import './hexa-modules.css';
const formatTime=value=>value?new Date(value).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit',second:'2-digit'}):'—';
export default function AttendanceClock(){
 const [account,setAccount]=useState(undefined),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[record,setRecord]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>onAuthStateChanged(auth,setAccount),[]);
 async function refresh(){try{setError('');setRecord(await api('/attendance/self/today'));}catch(e){setRecord(null);setError(e.message);}}
 useEffect(()=>{if(account)refresh();else setRecord(null);},[account?.uid]);
 async function login(e){e.preventDefault();setBusy(true);setError('');try{await signInWithEmailAndPassword(auth,email,password);setPassword('');}catch{setError('Không đăng nhập được. Kiểm tra email hoặc mật khẩu.');}finally{setBusy(false);}}
 async function clock(type){setBusy(true);setError('');try{await api(`/attendance/self/${type}`,{method:'POST',body:{}});await refresh();}catch(e){setError(e.message);}finally{setBusy(false);}}
 return <div className="hm-public"><main className="hm-public-card"><h1>HEXA · Chấm công</h1><p>Giờ vào / giờ ra được ghi nhận theo giờ Việt Nam từ máy chủ.</p>
   {error&&<p role="alert" className="hm-alert">{error}</p>}
   {account===undefined?<p>Đang kiểm tra phiên đăng nhập...</p>:!account?<form className="hm-form" onSubmit={login}><label>Email nhân viên<input required type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Mật khẩu<input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="hm-btn primary" disabled={busy}><LogIn size={16}/> Đăng nhập</button></form>:<>
     {record&&<><h2>{record.employee.name} · {record.employee.employeeCode}</h2><p>{record.employee.company} — {record.date}</p><div className="hm-clock-grid"><div><small>Giờ vào</small><strong>{formatTime(record.checkInAt)}</strong></div><div><small>Giờ ra</small><strong>{formatTime(record.checkOutAt)}</strong></div></div>
     <div className="hm-actions"><button className="hm-btn primary" disabled={busy||!!record.checkInAt} onClick={()=>clock('check-in')}><Clock3 size={16}/> Chấm giờ vào</button><button className="hm-btn primary" disabled={busy||!record.checkInAt||!!record.checkOutAt} onClick={()=>clock('check-out')}><CheckCircle2 size={16}/> Chấm giờ ra</button><button className="hm-btn" onClick={refresh}><RefreshCw size={16}/> Làm mới</button></div></>}
     <button className="hm-btn" onClick={()=>signOut(auth)}><LogOut size={16}/> Đăng xuất</button></>}
   <p className="hm-hint">Chấm công trực tuyến không tự xác nhận nhân viên có mặt tại văn phòng.</p></main></div>;
}
