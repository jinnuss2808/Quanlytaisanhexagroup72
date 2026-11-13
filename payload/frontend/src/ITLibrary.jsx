import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, ExternalLink, FileArchive, FileCode2, FileText, FolderOpen, HardDriveDownload,
  History, Link2, Plus, RefreshCw, Save, Search, ShieldCheck, Trash2, UploadCloud, X } from 'lucide-react';
import { api } from './api';
import './it-library.css';

const TYPE = {
  software: {label:'Bộ cài phần mềm',Icon:HardDriveDownload},
  printer_driver:{label:'Driver máy in',Icon:FileArchive},
  script:{label:'BAT / PowerShell',Icon:FileCode2},
  document:{label:'Tài liệu IT',Icon:FileText},
};
const start = {title:'',category:'software',description:'',vendor:'',version:'',platform:'',url:'',printerIds:[]};
const date = t => t ? new Date(t).toLocaleString('vi-VN') : '—';
const size = n => n ? (n/1024/1024).toFixed(1)+' MB' : '—';

function openDownload(url){
  // URLs are provided by authenticated API; no embedding of credentials in the database UI.
  const a=document.createElement('a'); a.href=url; a.rel='noopener noreferrer'; a.target='_blank';
  document.body.appendChild(a);a.click();a.remove();
}
export default function ITLibrary({user,printerId='',compact=false}){
  const manager = user?.role === 'manager';
  const [items,setItems]=useState([]),[printers,setPrinters]=useState([]),[tab,setTab]=useState('all');
  const [search,setSearch]=useState(''),[loading,setLoading]=useState(true),[working,setWorking]=useState(false);
  const [editing,setEditing]=useState(null),[showForm,setShowForm]=useState(false),[mode,setMode]=useState('link');
  const [form,setForm]=useState(start),[file,setFile]=useState(null),[progress,setProgress]=useState('');
  const [msg,setMsg]=useState(''),[error,setError]=useState(''),[history,setHistory]=useState(null);
  const alive = useRef(true);
  const reload=useCallback(async()=>{
    setLoading(true);
    try {
      const response=await api('/it-library/items'+(printerId?'?printerId='+encodeURIComponent(printerId):''));
      if(alive.current){setItems(Array.isArray(response.items)?response.items:[]);setError('');}
    }catch(err){if(alive.current)setError(err.message);}finally{if(alive.current)setLoading(false);}
  },[printerId]);
  useEffect(()=>{alive.current=true;reload();return()=>{alive.current=false;};},[reload]);
  useEffect(()=>{if(!manager)return;let valid=true;api('/assets/printers').then(r=>{
    if(valid)setPrinters(Array.isArray(r.items)?r.items:[]);
  }).catch(()=>{});return()=>{valid=false};},[manager]);
  const filtered=useMemo(()=>items.filter(x=>(tab==='all'||x.category===tab)&&
    [x.title,x.description,x.vendor,x.platform,x.version,x.filename].join(' ').toLocaleLowerCase('vi')
      .includes(search.toLocaleLowerCase('vi'))),[items,tab,search]);
  const resetForm=()=>{setForm({...start,category:printerId?'printer_driver':'software',printerIds:printerId?[printerId]:[]});setFile(null);setEditing(null);setMode('link');};
  const showCreate=()=>{resetForm();setMsg('');setError('');setShowForm(true)};
  const showEdit=row=>{setEditing(row);setMode(row.kind==='upload'?'upload':'link');setFile(null);
    setForm({...start,...row,url:''});setMsg('');setError('');setShowForm(true);};
  const change=(field,value)=>setForm(f=>({...f,[field]:value}));
  const save=async e=>{
    e.preventDefault();setWorking(true);setError('');setMsg('');setProgress('');
    try{
      const {url:linkUrl,...fields}={...form,printerIds:printerId ? [...new Set([...(form.printerIds||[]),printerId])] : form.printerIds};
      if(mode==='link'){
        if(editing){
          await api('/it-library/items/'+editing.id,{method:'PATCH',body:{...fields,...(linkUrl?{url:linkUrl}:{})}});
        }else{
          await api('/it-library/items/link',{method:'POST',body:{...fields,url:linkUrl}});
        }
      }else if(file){
        setProgress('Đang tạo phiên upload an toàn...');
        const session=await api('/it-library/uploads',{method:'POST',body:{...fields,file:{
          name:file.name,size:file.size,contentType:file.type||'application/octet-stream'},
          replaceItemId:editing?.id||undefined}});
        setProgress('Đang tải file lên Firebase Storage...');
        let response;
        try{response=await fetch(session.url,{method:'PUT',headers:{'Content-Type':session.contentType},body:file});}
        catch {throw new Error('Không tải lên được Storage. Kiểm tra cấu hình CORS và kết nối mạng.');}
        if(!response.ok)throw new Error('Storage từ chối file (HTTP '+response.status+').');
        setProgress('Đang xác nhận và lưu hồ sơ...');
        await api('/it-library/uploads/'+session.uploadId+'/complete',{method:'POST',body:{}});
      }else if(editing){
        await api('/it-library/items/'+editing.id,{method:'PATCH',body:fields});
      }else{
        throw new Error('Vui lòng chọn file cần upload.');
      }
      setShowForm(false);resetForm();setMsg('Đã lưu mục Thư viện IT thành công.');await reload();
    }catch(err){setError(err.message)}finally{setWorking(false);setProgress('');}
  };
  const remove=async row=>{
    if(!window.confirm('Chuyển "'+row.title+'" khỏi Thư viện IT? Metadata sẽ được ẩn và nhật ký được giữ lại.'))return;
    try{await api('/it-library/items/'+row.id,{method:'DELETE'});setMsg('Đã ẩn mục khỏi thư viện.');await reload();}catch(err){setError(err.message)}
  };
  const download=async row=>{
    try{const result=await api('/it-library/items/'+row.id+'/download');openDownload(result.url);}catch(err){setError(err.message)}
  };
  const downloadVersion=async version=>{
    try {const r=await api('/it-library/items/'+history.itemId+'/versions/'+version.id+'/download');openDownload(r.url);}catch(err){setError(err.message)}
  };
  const loadHistory=async row=>{
    try{const x=await api('/it-library/items/'+row.id+'/history');setHistory({itemId:row.id,title:row.title,...x});}catch(err){setError(err.message)}
  };
  return <div className={'itl-root'+(compact?' itl-compact':'')}>
    <div className="itl-header"><div><h3>{printerId?'Driver & tài liệu của máy in':'Thư viện IT'}</h3>
      <p>{printerId?'Tải driver đúng model, hướng dẫn cài và xử lý sự cố.':'Bộ cài · Driver máy in · BAT/PowerShell · Hướng dẫn IT'}</p></div>
      <div className="itl-actions"><button className="itl-btn ghost" type="button" onClick={reload}><RefreshCw size={15}/> Làm mới</button>
        {manager&&<button className="itl-btn primary" type="button" onClick={showCreate}><Plus size={15}/> Thêm file / liên kết</button>}</div>
    </div>
    <div className="itl-toolbar"><div className="itl-tabs"><button className={tab==='all'?'active':''} onClick={()=>setTab('all')}>Tất cả</button>
      {Object.entries(TYPE).map(([key,v])=><button key={key} className={tab===key?'active':''} onClick={()=>setTab(key)}>{v.label}</button>)}</div>
      <label className="itl-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm tên, phiên bản, hãng, hệ điều hành..."/></label>
    </div>
    {error&&<div className="itl-alert error" role="alert">{error}<button onClick={()=>setError('')} aria-label="Đóng">×</button></div>}
    {msg&&<div className="itl-alert">{msg}</div>}
    {loading?<p className="itl-empty">Đang tải thư viện IT...</p>:filtered.length===0?<div className="itl-empty"><FolderOpen size={30}/><p>Chưa có file hoặc tài liệu phù hợp.</p></div>:
      <div className="itl-grid">{filtered.map(row=>{
        const Icon=TYPE[row.category]?.Icon||FileText;
        return <article className="itl-card" key={row.id}><div className="itl-title"><span className="itl-icon"><Icon size={22}/></span><div><strong>{row.title}</strong>
          <small>{TYPE[row.category]?.label||row.category} · {row.vendor||'HEXA IT'}</small></div></div>
          <p>{row.description||'Không có mô tả'}</p>
          <div className="itl-meta"><span>Phiên bản: {row.version||'—'}</span><span>Hệ điều hành: {row.platform||'—'}</span>
            <span>{row.kind==='upload'?size(row.size):'Liên kết HTTPS'}</span><span>Ngày cập nhật: {date(row.updatedAt)}</span></div>
          <div className="itl-card-buttons"><button className="itl-btn primary" onClick={()=>download(row)}>
            {row.kind==='link'?<ExternalLink size={14}/>:<Download size={14}/>} {row.kind==='link'?'Mở liên kết':'Tải xuống'}</button>
            <button className="itl-btn ghost" onClick={()=>loadHistory(row)} title="Lịch sử phiên bản"><History size={14}/></button>
            {manager&&<><button className="itl-btn ghost" onClick={()=>showEdit(row)}>Sửa</button>
              <button className="itl-btn danger" onClick={()=>remove(row)} aria-label={'Ẩn '+row.title}><Trash2 size={14}/></button></>}
          </div></article>
      })}</div>}
    {showForm&&<div className="itl-overlay" onMouseDown={e=>e.currentTarget===e.target&&!working&&setShowForm(false)}>
      <div className="itl-modal" role="dialog" aria-modal="true" aria-label="Thêm hoặc sửa thư viện IT">
        <div className="itl-modal-head"><h3>{editing?'Sửa / thay phiên bản':'Thêm mục Thư viện IT'}</h3><button disabled={working} onClick={()=>setShowForm(false)} aria-label="Đóng"><X size={20}/></button></div>
        <form className="itl-form" onSubmit={save}>
          <div className="itl-type"><button type="button" disabled={Boolean(editing)} className={mode==='link'?'active':''} onClick={()=>setMode('link')}><Link2 size={14}/> Liên kết HTTPS</button>
            <button type="button" disabled={Boolean(editing)&&editing.kind==='link'} className={mode==='upload'?'active':''} onClick={()=>setMode('upload')}><UploadCloud size={14}/> Upload file</button></div>
          <label>Tên bộ cài / driver / tài liệu *<input required maxLength={160} value={form.title} onChange={e=>change('title',e.target.value)}/></label>
          <div className="itl-two"><label>Nhóm *<select value={form.category} onChange={e=>change('category',e.target.value)}>{Object.entries(TYPE).filter(([k])=>!printerId||['printer_driver','document'].includes(k)).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></label>
            <label>Phiên bản<input value={form.version||''} onChange={e=>change('version',e.target.value)} placeholder="v1.2.0 / 2026"/></label></div>
          <div className="itl-two"><label>Hãng / Nhà cung cấp<input value={form.vendor||''} onChange={e=>change('vendor',e.target.value)}/></label>
            <label>Hệ điều hành<input value={form.platform||''} onChange={e=>change('platform',e.target.value)} placeholder="Windows 10 / Windows 11"/></label></div>
          <label>Mô tả / hướng dẫn<textarea rows={3} maxLength={1500} value={form.description||''} onChange={e=>change('description',e.target.value)}/></label>
          {(form.category==='printer_driver'||form.category==='document')&&<label>Gắn với các máy in (Ctrl để chọn nhiều)<select multiple size={Math.min(4,Math.max(2,printers.length))}
            value={form.printerIds||[]} onChange={e=>change('printerIds',[...e.target.selectedOptions].map(x=>x.value))}>
            {printers.map(p=><option key={p.id} value={p.id}>{p.assetCode} · {p.assetName}</option>)}
          </select></label>}
          {mode==='link'&&<label>Liên kết tải (HTTPS) {editing?'(bỏ trống nếu giữ nguyên)':'*'}<input type="url" required={!editing} placeholder="https://..." value={form.url||''} onChange={e=>change('url',e.target.value)}/></label>}
          {mode==='upload'&&<label>{editing?'File phiên bản mới (để trống nếu chỉ sửa thông tin)':'Chọn file tải lên *'}<input type="file" required={!editing} onChange={e=>setFile(e.target.files?.[0]||null)}/>
            <small>Cho phép ZIP/7Z, MSI/EXE, INF/CAB, PDF, BAT/PS1... tối đa 150 MB. File lưu riêng tư trên Firebase Storage.</small></label>}
          <div className="itl-warning"><ShieldCheck size={16}/> Chỉ Admin được upload/sửa. IT tải file được cấp quyền; BAT/PowerShell phải được kiểm tra trước khi thực thi trên máy.</div>
          {error&&<div className="itl-alert error" role="alert">{error}</div>}{progress&&<div className="itl-alert">{progress}</div>}
          <div className="itl-form-actions"><button className="itl-btn ghost" type="button" disabled={working} onClick={()=>setShowForm(false)}>Hủy</button>
            <button className="itl-btn primary" type="submit" disabled={working}><Save size={15}/>{working?'Đang xử lý...':'Lưu'}</button></div>
        </form>
      </div>
    </div>}
    {history&&<div className="itl-overlay" onMouseDown={e=>e.target===e.currentTarget&&setHistory(null)}><div className="itl-modal itl-history-dialog" role="dialog" aria-modal="true">
      <div className="itl-modal-head"><h3>Lịch sử: {history.title}</h3><button onClick={()=>setHistory(null)} aria-label="Đóng"><X size={20}/></button></div>
      <div className="itl-history"><h4>Phiên bản ({history.versions?.length||0})</h4>{(history.versions||[]).map((v,i)=><div key={i}><b>{v.version||'Không ghi phiên bản'}</b><span>{date(v.at)} · {v.byName}</span><small>{v.filename||v.kind}</small>{v.available&&<button className="itl-btn ghost" onClick={()=>downloadVersion(v)}><Download size={13}/> Tải phiên bản này</button>}</div>)}
        <h4>Nhật ký thao tác</h4>{(history.audit||[]).map((a,i)=><div key={i}><b>{a.action}</b><span>{date(a.at)} · {a.byName}</span></div>)}</div>
    </div></div>}
  </div>;
}
