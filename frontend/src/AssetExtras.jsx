import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Camera,CheckCircle2,Download,RefreshCw,Search,ShieldCheck,AlertTriangle,ScanLine} from 'lucide-react';
import {auth} from './firebase';
import {api} from './api';

const fmtDate=ms=>ms?new Date(ms).toLocaleString('vi-VN'):'—';
const fmtMoney=n=>Number(n||0).toLocaleString('vi-VN')+' ₫';
const saveBlob=(blob,name)=>{const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);};
function saveCSV(rows,name){
  const escape=x=>'"'+String(x??'').replaceAll('"','""')+'"';
  saveBlob(new Blob(['\ufeff'+rows.map(row=>row.map(escape).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),name);
}

export function AssetReportPanel(){
 const [result,setResult]=useState(null),[view,setView]=useState('companies'),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 const load=useCallback(async()=>{setLoading(true);setError('');try{setResult(await api('/assets/reports/summary'))}catch(e){setError(e.message)}finally{setLoading(false)}},[]);
 useEffect(()=>{load()},[load]);
 const rows=result?.[view]||[];
 const exportCSV=()=>saveCSV([['Tên','Số tài sản','Tổng giá trị (VNĐ)','Có sẵn','Đang dùng','Bảo trì','Đã hỏng','Thanh lý'],...rows.map(x=>[x.name,x.count,x.value,x.available,x.using,x.maintenance,x.broken,x.liquidated])],`HEXA_BaoCao_${view}_${new Date().toISOString().slice(0,10)}.csv`);
 return <div className="am-extra am-card am-padded">
  <div className="am-split am-heading"><div><h3>Báo cáo tài sản</h3><p>Giá trị và trạng thái tài sản hiện tại theo công ty hoặc phòng ban sử dụng</p></div><div className="am-head-actions"><button className="am-btn am-light" onClick={load}><RefreshCw size={15}/>Làm mới</button><button className="am-btn am-primary" disabled={!result} onClick={exportCSV}><Download size={15}/>Xuất CSV</button></div></div>
  {error&&<p role="alert" className="am-error">{error}</p>}
  {result&&<><div className="am-warehouse-summary"><div>Tổng: <strong>{result.total}</strong> tài sản</div><div>Giá trị mua: <strong>{fmtMoney(result.totalValue)}</strong></div></div>
  <div className="am-pill-tabs"><button className={view==='companies'?'active':''} onClick={()=>setView('companies')}>Theo công ty</button><button className={view==='departments'?'active':''} onClick={()=>setView('departments')}>Theo phòng ban sử dụng</button></div>
  <div className="am-table-wrap"><table className="am-table"><thead><tr><th>{view==='companies'?'Công ty':'Phòng ban'}</th><th>Số lượng</th><th>Tổng giá trị</th><th>Có sẵn</th><th>Đang dùng</th><th>Bảo trì</th><th>Hỏng</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><b>{r.name}</b></td><td>{r.count}</td><td>{fmtMoney(r.value)}</td><td>{r.available}</td><td>{r.using}</td><td>{r.maintenance}</td><td>{r.broken}</td></tr>)}{!rows.length&&<tr><td colSpan={7} className="am-empty">{loading?'Đang tải...':'Chưa có dữ liệu.'}</td></tr>}</tbody></table></div>
  <p className="am-muted">Giá trị tính từ giá mua đã nhập (không phải định giá còn lại). Phòng ban sử dụng được lưu khi thêm/sửa hoặc bàn giao tài sản; dữ liệu cũ chưa có sẽ nằm ở nhóm “Chưa xác định”.</p></>}
 </div>;
}

export function AssetStocktakePanel({catalogs=[],isManager=false}){
 const [sessions,setSessions]=useState([]),[selected,setSelected]=useState(null),[scanCode,setScanCode]=useState(''),[newName,setNewName]=useState(''),[company,setCompany]=useState(''),[notice,setNotice]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [cameraOpen,setCameraOpen]=useState(false);
 const videoRef=useRef(null),cameraRef=useRef({stream:null,raf:null,alive:false});
 const loadSessions=useCallback(async()=>{try{const x=await api('/assets/stocktakes');setSessions(x.items||[])}catch(e){setError(e.message)}},[]);
 const loadSession=useCallback(async id=>{if(!id)return;try{setSelected(await api(`/assets/stocktakes/${id}`))}catch(e){setError(e.message)}},[]);
 useEffect(()=>{loadSessions()},[loadSessions]);
 const run=async fn=>{setBusy(true);setError('');setNotice('');try{await fn()}catch(e){setError(e.message)}finally{setBusy(false)}};
 const create=()=>run(async()=>{const x=await api('/assets/stocktakes',{method:'POST',body:{name:newName,ownerDepartmentId:company}});setNewName('');await loadSessions();await loadSession(x.id);setNotice('Đã tạo đợt kiểm kê. Bạn có thể bắt đầu quét QR.');});
 const scan=useCallback(async code=>{
   if(!selected?.id||!code)return;
   const x=await api(`/assets/stocktakes/${selected.id}/scan`,{method:'POST',body:{code}});
   setNotice(`Đã kiểm kê ${x.asset.assetCode} · ${x.asset.assetName}`);
   setScanCode('');await loadSession(selected.id);
 },[selected?.id,loadSession]);
 const stopCamera=useCallback(()=>{
   cameraRef.current.alive=false;
   if(cameraRef.current.raf)cancelAnimationFrame(cameraRef.current.raf);
   cameraRef.current.stream?.getTracks().forEach(t=>t.stop());
   cameraRef.current.stream=null;setCameraOpen(false);
 },[]);
 useEffect(()=>()=>{cameraRef.current.alive=false;cameraRef.current.stream?.getTracks().forEach(t=>t.stop());if(cameraRef.current.raf)cancelAnimationFrame(cameraRef.current.raf);},[]);
 const startCamera=async()=>{
  setError('');
  if(!('BarcodeDetector' in window)||!navigator.mediaDevices?.getUserMedia){setError('Trình duyệt không hỗ trợ quét QR trực tiếp. Hãy nhập mã tài sản hoặc dán đường dẫn QR vào ô bên dưới.');return;}
  try{
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}}});
    cameraRef.current.stream=stream;cameraRef.current.alive=true;setCameraOpen(true);
    const detector=new window.BarcodeDetector({formats:['qr_code']});
    requestAnimationFrame(async function tick(){
      if(!cameraRef.current.alive)return;
      if(videoRef.current){
       if(videoRef.current.srcObject!==stream){videoRef.current.srcObject=stream;await videoRef.current.play().catch(()=>{});}
       try{
        const found=await detector.detect(videoRef.current);
        if(found.length){const value=found[0].rawValue;stopCamera();await scan(value).catch(e=>setError(e.message));return;}
       }catch{/* Retry if the video frame isn't ready yet */}
      }
      if(cameraRef.current.alive)cameraRef.current.raf=requestAnimationFrame(tick);
    });
  }catch(e){stopCamera();setError('Không mở được camera: '+e.message);}
 };
 const close=()=>run(async()=>{if(!window.confirm('Kết thúc đợt kiểm kê? Không thể quét thêm sau khi chốt.'))return;await api(`/assets/stocktakes/${selected.id}/close`,{method:'POST'});await loadSession(selected.id);await loadSessions();setNotice('Đã chốt kiểm kê.');});
 const missing=selected?.missingAssets||[];
 const exportMissing=()=>saveCSV([['Mã tài sản','Tên tài sản','Trạng thái'],...missing.map(x=>[x.assetCode,x.assetName,'Chưa quét'])],`HEXA_ChuaKiemKe_${selected.id}.csv`);
 return <div className="am-extra am-card am-padded">
   <div className="am-heading"><h3>Kiểm kê tài sản bằng QR</h3><p>Quét mã QR trên tem tài sản để đối chiếu tài sản thực tế, không thay đổi trạng thái tài sản.</p></div>
   {isManager&&<div className="am-filter-bar"><input placeholder="Tên đợt kiểm kê" value={newName} onChange={e=>setNewName(e.target.value)}/><select value={company} onChange={e=>setCompany(e.target.value)}><option value="">Toàn bộ công ty</option>{catalogs.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><button className="am-btn am-primary" disabled={busy} onClick={create}>Tạo đợt kiểm kê</button></div>}
   <div className="am-filter-bar"><select aria-label="Chọn đợt kiểm kê" value={selected?.id||''} onChange={e=>{stopCamera();loadSession(e.target.value)}}><option value="">Chọn một đợt kiểm kê</option>{sessions.map(x=><option key={x.id} value={x.id}>{x.name} ({x.closedAt?'Đã chốt':'Đang kiểm kê'})</option>)}</select><button onClick={loadSessions} className="am-btn am-light"><RefreshCw size={15}/>Làm mới</button></div>
   {error&&<p role="alert" className="am-error">{error}</p>}{notice&&<p role="status" className="am-success">{notice}</p>}
   {selected&&<>
     <div className="am-warehouse-summary"><div>Dự kiến <strong>{selected.expected}</strong></div><div>Đã quét <strong>{selected.found}</strong></div><div>Chưa quét <strong>{selected.missing}</strong></div></div>
     {!selected.closedAt&&<><div className="am-filter-bar"><div className="am-search"><Search size={16}/><input value={scanCode} onChange={e=>setScanCode(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();run(()=>scan(scanCode))}}} placeholder="Nhập mã tài sản / dán URL QR"/></div><button disabled={busy||!scanCode.trim()} className="am-btn am-primary" onClick={()=>run(()=>scan(scanCode))}><ScanLine size={16}/>Kiểm kê</button><button className="am-btn am-light" onClick={cameraOpen?stopCamera:startCamera}><Camera size={16}/>{cameraOpen?'Tắt camera':'Quét camera'}</button></div>
       <video ref={videoRef} muted playsInline style={{display:cameraOpen?'block':'none',width:'100%',maxWidth:420,borderRadius:12,marginBottom:12}}/>
       {isManager&&<button className="am-btn am-light" disabled={busy} onClick={close}><CheckCircle2 size={15}/>Chốt kiểm kê</button>}
     </>}
     <div className="am-split" style={{marginTop:18}}><h4>Tài sản chưa quét ({missing.length})</h4><button className="am-btn am-light" onClick={exportMissing}><Download size={15}/>Xuất danh sách thiếu</button></div>
     <div className="am-table-wrap"><table className="am-table"><thead><tr><th>Mã tài sản</th><th>Tên tài sản</th></tr></thead><tbody>{missing.slice(0,200).map(x=><tr key={x.id}><td>{x.assetCode}</td><td>{x.assetName}</td></tr>)}{!missing.length&&<tr><td colSpan={2} className="am-empty">Tất cả tài sản trong đợt đã được quét.</td></tr>}</tbody></table></div>
     {missing.length>200&&<p className="am-muted">Đang hiển thị 200 dòng đầu. Xuất CSV để xem đầy đủ.</p>}
   </>}
   <p className="am-muted">Camera QR hoạt động trên HTTPS (Vercel) hoặc localhost và cần trình duyệt hỗ trợ BarcodeDetector. Có thể dùng máy quét QR dạng bàn phím hoặc nhập mã thủ công trên các thiết bị khác.</p>
 </div>;
}

export function AssetBackupPanel(){
 const [status,setStatus]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const load=useCallback(()=>api('/assets/backups/status').then(setStatus).catch(e=>setError(e.message)),[]);
 useEffect(()=>{load()},[load]);
 const manual=async()=>{
  setBusy(true);setError('');
  try{
   const token=await auth.currentUser?.getIdToken();
   if(!token)throw new Error('Phiên đăng nhập hết hạn.');
   const base=(import.meta.env.VITE_API_URL||'http://127.0.0.1:4000').replace(/\/$/,'');
   const response=await fetch(base+'/api/assets/backups/download',{headers:{Authorization:`Bearer ${token}`}});
   if(!response.ok){const e=await response.json().catch(()=>({}));throw new Error(e.error||'HTTP '+response.status);}
   saveBlob(await response.blob(),`HEXA-Inventory-Backup-${new Date().toISOString().slice(0,10)}.json.gz`);
  }catch(e){setError(e.message)}finally{setBusy(false)}
 };
 return <div className="am-extra am-card am-padded">
  <div className="am-split am-heading"><div><h3>Sao lưu Firebase</h3><p>Sao lưu dữ liệu bảo mật trên Cloud Storage hoặc tải bản xuất dữ liệu tài sản thủ công</p></div><button className="am-btn am-light" onClick={load}><RefreshCw size={15}/>Kiểm tra trạng thái</button></div>
  <div className="am-warehouse-summary"><div><ShieldCheck size={17}/> Sao lưu cloud: <b>{status?.lastRun?.status==='success'?'Đã chạy':status?.lastRun?.status==='failed'?'Có lỗi':'Chưa kích hoạt / chưa có bản sao lưu'}</b></div><div>Lần gần nhất: <b>{fmtDate(status?.lastRun?.at)}</b></div></div>
  {status?.lastRun?.status==='success'&&<p className="am-muted">Lưu trên Google Cloud Storage: {status.lastRun.storagePath}. Chỉ quản trị viên có quyền Cloud Storage mới tải/khôi phục được.</p>}
  {status?.lastRun?.status==='failed'&&<p className="am-error">Lịch sao lưu báo lỗi. Xem Firebase Functions Logs để kiểm tra.</p>}
  <button className="am-btn am-primary" disabled={busy} onClick={manual}><Download size={16}/>{busy?'Đang xuất...':'Tải bản sao lưu tài sản ngay'}</button>
  <p className="am-muted">Lịch tự động 02:00 hằng ngày (Việt Nam) cần triển khai Firebase Cloud Functions, bật Blaze và đặt biến HEXA_BACKUP_BUCKET. Bản tải thủ công chỉ gồm dữ liệu tài sản/kho; bản tự động là bản sao lưu Realtime Database đầy đủ. Không lưu file sao lưu ở thư mục công khai hoặc GitHub.</p>
  {error&&<p role="alert" className="am-error">{error}</p>}
 </div>;
}
