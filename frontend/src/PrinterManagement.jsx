// HEXA_FILTER_MODAL_REFRESH_FIX_V1
// HEXA_IT_LIBRARY_V1
import React, {useCallback,useEffect,useMemo,useState} from 'react';
import {createPortal} from 'react-dom';
import {
  Printer,Package,RefreshCw,Search,History,Wrench,X,Save,Droplets,
  CheckCircle2,Plus,Pencil,MapPin
} from 'lucide-react';
import {api} from './api';
import {formatPrinterDate,formatPrinterMoney,getPrinterRepairTotals} from './printer-history-utils.js';
import WarehouseManagement from './WarehouseManagement.jsx';
import './printer-management.css';
import SortableHeader from './SortableHeader.jsx';
import {sortVisibleRows,toggleColumnSort} from './table-sort.js';

const dateToday=()=>new Date().toLocaleDateString('en-CA');
const makeOperationId=()=>`p_${crypto.randomUUID().replaceAll('-','')}`;
const when=stamp=>stamp?new Date(stamp).toLocaleString('vi-VN'):'—';
const actions={replace_toner:'Đổ mực',repair:'Sửa chữa',printer_service:'Sửa chữa máy in',replace_part:'Thay linh kiện',maintenance:'Bảo trì'};
const emptyPrinter={assetCode:'',assetName:'',ipAddress:'',tonerType:'',tonerStockItemId:'',ownerDepartmentId:'',location:'',serialNumber:'',description:''};

function PrinterForm({printer,onClose,onSaved}){
  const editing=Boolean(printer?.id);
  const [form,setForm]=useState(()=>({...emptyPrinter,...Object.fromEntries(Object.keys(emptyPrinter).map(k=>[k,printer?.[k]??'']))}));
  const [departments,setDepartments]=useState([]),[inks,setInks]=useState([]);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{
    let active=true;
    Promise.all([api('/assets/catalogs'),api('/warehouse?category=ink')])
      .then(([catalog,warehouse])=>{
        if(!active)return;
        setDepartments(Array.isArray(catalog.departments)?catalog.departments:[]);
        setInks(Array.isArray(warehouse.items)?warehouse.items:[]);
      })
      .catch(err=>{if(active)setError('Không tải được danh mục hoặc kho mực: '+err.message);});
    return ()=>{active=false;};
  },[]);
  const set=(key,value)=>setForm(old=>({...old,[key]:value}));
  const selectInk=value=>{
    const item=inks.find(x=>x.id===value);
    setForm(old=>({...old,tonerStockItemId:value,tonerType:item?`${item.sku} – ${item.name}`:old.tonerType}));
  };
  const submit=async e=>{
    e.preventDefault();setBusy(true);setError('');
    try{
      const payload={...form};
      if(editing)delete payload.assetCode;
      const result=await api(editing?`/assets/printers/${printer.id}`:'/assets/printers',{
        method:editing?'PATCH':'POST',body:payload
      });
      await onSaved(result,editing);
    }catch(err){setError(err.message||'Không lưu được máy in.');}
    finally{setBusy(false);}
  };
  return createPortal(<div className="pm-overlay" onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
    <div className="pm-modal" role="dialog" aria-modal="true" aria-label={editing?'Sửa máy in':'Thêm máy in'}>
      <header className="pm-head"><div><small>HEXA · QUẢN LÝ MÁY IN</small>
        <h3>{editing?'Chỉnh sửa máy in':'Thêm máy in mới'}</h3>
        <p>Máy in tạo tại đây cũng xuất hiện trong Danh sách tài sản và có nhật ký riêng....</p>
      </div><button className="pm-close" onClick={onClose} aria-label="Đóng"><X size={20}/></button></header>
      <div className="pm-content"><form className="pm-form" onSubmit={submit}>
        <div className="pm-form-grid">
          <label>Tên máy in *
            <input required maxLength={255} value={form.assetName} onChange={e=>set('assetName',e.target.value)} placeholder="VD: Canon LBP 2900 phòng Kế toán"/>
          </label>
          <label>Mã máy in {editing?'(không thay đổi)':'(để trống sẽ tự sinh)'}
            <input disabled={editing} maxLength={100} value={form.assetCode} onChange={e=>set('assetCode',e.target.value)} placeholder="VD: PRN-HX-001"/>
          </label>
          <label>IP máy in (không bắt buộc nếu dùng USB)
            <input maxLength={50} value={form.ipAddress} onChange={e=>set('ipAddress',e.target.value)} placeholder="VD: 192.168.1.120"/>
          </label>
          <label>Loại mực đổ / sử dụng *
            <input required maxLength={120} value={form.tonerType} onChange={e=>set('tonerType',e.target.value)} placeholder="VD: Canon 303 / HP 85A"/>
          </label>
          <label>Liên kết với mực đang có trong kho
            <select value={form.tonerStockItemId} onChange={e=>selectInk(e.target.value)}><option value="">Chưa liên kết / chọn khi đổ mực</option>
              {inks.filter(x=>x.category==='ink').map(x=><option key={x.id} value={x.id}>{x.sku} · {x.name} (tồn {x.quantity})</option>)}
            </select>
          </label>
          <label>Công ty sở hữu
            <select value={form.ownerDepartmentId} onChange={e=>set('ownerDepartmentId',e.target.value)}><option value="">Chưa xác định</option>
              {departments.map(d=><option key={d.id} value={d.id}>{d.code} · {d.name}</option>)}
            </select>
          </label>
          <label>Vị trí đặt máy in
            <input maxLength={255} value={form.location} onChange={e=>set('location',e.target.value)} placeholder="VD: Tầng 3 – Phòng Kế toán"/>
          </label>
          <label>Serial máy in
            <input maxLength={255} value={form.serialNumber} onChange={e=>set('serialNumber',e.target.value)} placeholder="Serial của thiết bị"/>
          </label>
          <label className="pm-wide">Ghi chú
            <textarea rows={3} maxLength={1000} value={form.description} onChange={e=>set('description',e.target.value)} placeholder="Hãng/model, đơn vị quản lý, lưu ý kỹ thuật..."/>
          </label>
        </div>
        <p className="pm-help">Lịch sử đổ mực, sửa chữa và thay linh kiện sẽ được ghi tự động từ các thao tác ở chi tiết máy in. Không cần nhập lịch sử khi tạo.</p>
        {error&&<div role="alert" className="pm-message pm-bad">{error}</div>}
        <div className="pm-form-actions"><button type="button" className="am-btn am-light" onClick={onClose}>Hủy</button>
          <button className="pm-primary" type="submit" disabled={busy}><Save size={16}/>{busy?'Đang lưu...':editing?'Lưu thay đổi':'Thêm máy in'}</button>
        </div>
      </form></div>
    </div>
  </div>, document.body);
}
function PrinterDetail({printer,onClose,onSaved,user}){
  const [tab,setTab]=useState('history'),[historyKind,setHistoryKind]=useState('all');
  const [expandedHistoryId,setExpandedHistoryId]=useState(null);
  const [history,setHistory]=useState([]),[stock,setStock]=useState([]);
  const [inkId,setInkId]=useState(''),[notes,setNotes]=useState(''),[date,setDate]=useState(dateToday());
  const [problem,setProblem]=useState(''),[solution,setSolution]=useState(''),[parts,setParts]=useState(''),[cost,setCost]=useState('0');
  const [operationId,setOperationId]=useState(makeOperationId);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const load=useCallback(async()=>{
    const [h,w]=await Promise.all([api(`/assets/${printer.id}/history`),api('/warehouse?category=ink')]);
    setHistory(Array.isArray(h.maintenance)?h.maintenance:[]);
    const items=Array.isArray(w.items)?w.items:[];
    setStock(items);
    setInkId(current=>current || (items.some(i=>i.id===printer.tonerStockItemId&&i.quantity>0)?printer.tonerStockItemId:''));
  },[printer.id,printer.tonerStockItemId]);
  useEffect(()=>{load().catch(e=>setError(e.message));},[load]);
  const saveToner=async e=>{e.preventDefault();setError('');setNotice('');setBusy(true);try{
    const result=await api(`/assets/${printer.id}/printer/toner`,{method:'POST',body:{stockItemId:inkId,operationId,date,notes}});
    await load();await onSaved();setNotes('');setOperationId(makeOperationId());
    setNotice(`Đã đổ mực cho ${printer.assetCode}, trừ 1 khỏi kho. Còn ${result.stockRemaining} đơn vị.`);
    setTab('history');setHistoryKind('toner');
  }catch(err){setError(err.message)}finally{setBusy(false)}};
  const saveRepair=async e=>{e.preventDefault();setError('');setNotice('');setBusy(true);try{
    await api(`/assets/${printer.id}/maintenance`,{method:'POST',body:{type:'printer_service',summary:problem,notes:solution,replacedParts:parts,date,cost:Number(cost||0)}});
    await load();await onSaved();setProblem('');setSolution('');setParts('');setCost('0');
    setNotice('Đã lưu sửa chữa và lịch sử máy in.');setTab('history');setHistoryKind('repair');
  }catch(err){setError(err.message)}finally{setBusy(false)}};
  const selected=stock.find(s=>s.id===inkId);
  const tonerCount=history.filter(h=>h.type==='replace_toner').length;
  const repairCount=history.length-tonerCount;
  const visibleHistory=history.filter(h=>historyKind==='all'||(historyKind==='toner'?h.type==='replace_toner':h.type!=='replace_toner'));
  const repairTotals=getPrinterRepairTotals(history);
  return createPortal(<div className="pm-overlay" onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
    <div className="pm-modal" role="dialog" aria-modal="true" aria-label={`Máy in ${printer.assetCode}`}>
      <header className="pm-head"><div><small>HEXA · QUẢN LÝ MÁY IN</small><h3>{printer.assetName}</h3>
        <p>{printer.assetCode} · IP: {printer.ipAddress||'USB / chưa có IP'} · Mực: {printer.tonerType||'Chưa cập nhật'}</p>
      </div><button className="pm-close" onClick={onClose} aria-label="Đóng"><X size={20}/></button></header>
      <div className="pm-tabs">{[['history','Lịch sử',History],['toner','Đổ mực',Droplets],['repair','Sửa chữa',Wrench]].map(([key,label,Icon])=><button key={key} className={tab===key?'active':''} onClick={()=>{setTab(key);setError('');setNotice('');}}><Icon size={15}/>{label}</button>)}</div>
      <div className="pm-content">
        {notice&&<div className="pm-message pm-ok"><CheckCircle2 size={16}/>{notice}</div>}
        {error&&<div className="pm-message pm-bad">{error}</div>}
        {tab==='history'&&<div className="pm-history-view">
          <p className="pm-help">Lịch sử gắn với hồ sơ máy in này. Bấm <b>Xem chi tiết</b> để xem ngày sửa, người sửa, linh kiện, chi phí và kết quả xử lý.</p>
          <div className="pm-history-filters">{[['all',`Tất cả (${history.length})`],['toner',`Đổ mực (${tonerCount})`],['repair',`Sửa chữa (${repairCount})`]].map(([key,label])=><button key={key} type="button" className={historyKind===key?'active':''} onClick={()=>{setHistoryKind(key);setExpandedHistoryId(null);}}>{label}</button>)}</div>
          <div className="pm-history">
            {visibleHistory.map(h=>{
              const isToner=h.type==='replace_toner';
              const expanded=expandedHistoryId===h.id;
              return <article className="pm-history-row" key={h.id}>
                <div className="pm-history-row-top"><strong>{actions[h.type]||h.type}: {h.summary||'Không có mô tả'}</strong>
                  {!isToner&&<span className="pm-cost-tag">{formatPrinterMoney(h.cost)}</span>}
                </div>
                <div className="pm-history-meta">
                  <span>Ngày {isToner?'đổ mực':'sửa'}: <b>{formatPrinterDate(h.date,h.at)}</b></span>
                  <span>Người thực hiện: <b>{h.byName||h.performedBy||'IT'}</b></span>
                </div>
                <button type="button" className="pm-history-expand" aria-expanded={expanded} onClick={()=>setExpandedHistoryId(expanded?null:h.id)}>{expanded?'Thu gọn chi tiết':'Xem chi tiết'}</button>
                {expanded&&<dl className="pm-history-details">
                  <div><dt>Loại công việc</dt><dd>{actions[h.type]||h.type}</dd></div>
                  <div><dt>Ngày thực hiện</dt><dd>{formatPrinterDate(h.date,h.at)}</dd></div>
                  <div><dt>Thời gian ghi nhận</dt><dd>{when(h.at)}</dd></div>
                  <div><dt>Người thực hiện</dt><dd>{h.byName||h.performedBy||'IT'}</dd></div>
                  {!isToner&&<div><dt>Chi phí sửa chữa</dt><dd className="pm-repair-price">{formatPrinterMoney(h.cost)}</dd></div>}
                  {h.replacedParts&&<div className="pm-full"><dt>Linh kiện thay thế</dt><dd>{h.replacedParts}</dd></div>}
                  {h.stockName&&<div className="pm-full"><dt>Mực / vật tư sử dụng</dt><dd>{h.stockName} (số lượng: {h.stockQuantity||1})</dd></div>}
                  {h.serviceProvider&&<div className="pm-full"><dt>Đơn vị sửa chữa</dt><dd>{h.serviceProvider}</dd></div>}
                  {h.ticketCode&&<div><dt>Ticket tham chiếu</dt><dd>{h.ticketCode}</dd></div>}
                  <div className="pm-full"><dt>Kết quả xử lý / ghi chú</dt><dd>{h.notes||'Chưa có ghi chú'}</dd></div>
                </dl>}
              </article>;
            })}
            {!visibleHistory.length&&<p className="pm-help">Chưa có nhật ký trong nhóm này.</p>}
          </div>
          <div className="pm-repair-total" aria-label="Tổng chi phí sửa chữa máy in">
            <div><strong>Tổng chi phí sửa chữa</strong><span>{repairTotals.count} lần sửa chữa · không tính tiền mực</span>
            {repairTotals.unknown>0&&<small>{repairTotals.unknown} lần chưa ghi chi phí, không cộng vào tổng.</small>}</div>
            <output>{formatPrinterMoney(repairTotals.total)}</output>
          </div>
        </div>}
        {tab==='toner'&&<form onSubmit={saveToner} className="pm-form"><p className="pm-help">Mực đề xuất cho máy: <b>{printer.tonerType||'Chưa khai báo'}</b>. Mỗi lần xác nhận trừ đúng <b>1</b> đơn vị tồn kho và ghi nhật ký.</p>
          <label>Loại mực trong kho *<select required value={inkId} onChange={e=>setInkId(e.target.value)}><option value="">Chọn mực có tồn kho</option>{stock.filter(x=>x.category==='ink'&&x.quantity>0).map(x=><option key={x.id} value={x.id}>{x.sku} · {x.name} — tồn {x.quantity}</option>)}</select></label>
          {selected&&<div className="pm-stock">Tồn hiện tại: <b>{selected.quantity}</b> → sau khi đổ: <b>{selected.quantity-1}</b></div>}
          <label>Ngày đổ mực<input required type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
          <label>Ghi chú<textarea rows={3} maxLength={1500} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Chất lượng bản in, ghi chú khác..."/></label>
          <button type="submit" className="pm-primary" disabled={busy||!inkId}><Save size={16}/>{busy?'Đang ghi...':'Xác nhận đổ mực (-1)'}</button>
        </form>}
        {tab==='repair'&&<form onSubmit={saveRepair} className="pm-form"><label>Lỗi máy in / nội dung sửa chữa *<input required maxLength={255} value={problem} onChange={e=>setProblem(e.target.value)} placeholder="Ví dụ: Máy in kẹt giấy, sọc bản in..."/></label>
          <label>Ngày sửa chữa<input type="date" required value={date} onChange={e=>setDate(e.target.value)}/></label>
          <label>Linh kiện đã thay<input value={parts} maxLength={500} onChange={e=>setParts(e.target.value)} placeholder="Trống, gạt, lô sấy..."/></label>
          <label>Chi phí sửa chữa (VNĐ)<input type="number" min="0" value={cost} onChange={e=>setCost(e.target.value)}/></label>
          <label>Kết quả / ghi chú<textarea rows={4} maxLength={1500} value={solution} onChange={e=>setSolution(e.target.value)} placeholder="Cách khắc phục, tình trạng sau sửa..."/></label>
          <button type="submit" className="pm-primary" disabled={busy}><Save size={16}/>{busy?'Đang lưu...':'Lưu sửa chữa vào lịch sử'}</button>
        </form>}
      </div>
    </div>
  </div>, document.body);
}
export default function PrinterManagement({user,refreshEpoch=0}){
  const [tab,setTab]=useState('printers'),[printers,setPrinters]=useState([]),[search,setSearch]=useState('');
  const [printerSort,setPrinterSort]=useState('');
  const [selected,setSelected]=useState(null),[editing,setEditing]=useState(null),[showCreate,setShowCreate]=useState(false);
  const [loading,setLoading]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[refreshId,setRefreshId]=useState(0);
  const [inkCreateSignal,setInkCreateSignal]=useState(0);
  const refresh=useCallback(async()=>{setLoading(true);try{
    const p=await api('/assets/printers');setPrinters(Array.isArray(p.items)?p.items:[]);setError('');
     return true;
  }catch(e){setError(e.message);return false;}finally{setLoading(false)}},[]);
  useEffect(()=>{refresh();},[refresh,refreshEpoch]);
  const listed=useMemo(()=>{
    const filtered=printers.filter(p=>`${p.assetCode} ${p.assetName} ${p.serialNumber||''} ${p.ipAddress||''} ${p.tonerType||''} ${p.location||''} ${p.assignedTo||''}`.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi')));
    return sortVisibleRows(filtered,printerSort,p=>printerSort==='ipAddress'?(p.ipAddress||p.location):p[printerSort]);
  },[printers,search,printerSort]);
  const togglePrinterSort=key=>setPrinterSort(current=>toggleColumnSort(current,key));
  const savedPrinter=async (result,wasEdit)=>{
    setEditing(null);setShowCreate(false);
    setNotice(wasEdit?'Đã cập nhật thông tin máy in.':`Đã thêm máy in ${result.assetCode} vào danh sách.`);
    await refresh();
  };
  return <div className="pm-root">
    {/* HEXA_UNIFIED_PRINTER_UPLOAD_20261113_V1 */}
    <div className="pm-unified-toolbar">
      <div className="pm-tabs" role="tablist" aria-label="Quản lý máy in và kho mực">
      <button id="pm-tab-printers" type="button" role="tab" aria-selected={tab==='printers'} aria-controls="pm-panel-printers" className={tab==='printers'?'active':''} onClick={()=>setTab('printers')}><Printer size={17}/> Danh sách máy in ({printers.length})</button>
      <button id="pm-tab-ink" type="button" role="tab" aria-selected={tab==='ink'} aria-controls="pm-panel-ink" className={tab==='ink'?'active':''} onClick={()=>setTab('ink')}><Package size={17}/> Mực trong kho</button>
    </div>
      <div className="pm-heading-actions">
        <button type="button" className="am-btn am-light" onClick={async()=>{setNotice('Đang làm mới dữ liệu...');const ok=await refresh();setRefreshId(x=>x+1);setNotice(ok?'Đã làm mới danh sách máy in và kho mực.':'Không thể làm mới danh sách máy in.')}} disabled={loading}>
          <RefreshCw size={16}/> Làm mới
        </button>
        {tab==='printers'
          ? <button type="button" className="am-btn am-primary" onClick={()=>{setNotice('');setShowCreate(true);}}><Plus size={16}/> Thêm máy in</button>
          : <button type="button" className="am-btn am-primary" onClick={()=>{setNotice('');setInkCreateSignal(x=>x+1);}}><Plus size={16}/> Thêm mực</button>}
      </div>
    </div>
    {notice&&<p className="pm-message pm-ok"><CheckCircle2 size={16}/>{notice}</p>}
    {error&&<p className="pm-message pm-bad">{error}</p>}
    <div className="pm-tab-viewport">
      <section id="pm-panel-printers" className="pm-tab-panel" role="tabpanel" aria-labelledby="pm-tab-printers" hidden={tab!=='printers'}>
        <div className="am-card">
          <div className="pm-search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm máy in theo mã, tên, IP, loại mực, vị trí..."/></div>
          <div className="am-table-wrap"><table className="am-table pm-printer-table pm-printers-table"><thead><tr>
            <SortableHeader label="Mã máy in" sortKey="assetCode" activeKey={printerSort} onToggle={togglePrinterSort}/>
            <SortableHeader label="Tên máy in" sortKey="assetName" activeKey={printerSort} onToggle={togglePrinterSort}/>
            <SortableHeader label="IP / Vị trí" sortKey="ipAddress" activeKey={printerSort} onToggle={togglePrinterSort}/>
            <SortableHeader label="Loại mực đổ" sortKey="tonerType" activeKey={printerSort} onToggle={togglePrinterSort}/>
            <SortableHeader label="Công ty" sortKey="ownerDepartmentName" activeKey={printerSort} onToggle={togglePrinterSort}/>
            <th scope="col">Thao tác</th>
          </tr></thead><tbody>
            {listed.map(p=><tr key={p.id}><td><b>{p.assetCode}</b></td><td title={p.assetName}>{p.assetName}<small>{p.serialNumber||''}</small></td>
              <td>{p.ipAddress||'USB / chưa có IP'}<small>{p.location||''}</small></td><td>{p.tonerType||'Chưa khai báo'}</td>
              <td>{p.ownerDepartmentName||'—'}</td><td><div className="pm-row-actions">
                <button type="button" className="am-btn am-primary" onClick={()=>setSelected(p)}><History size={14}/> Lịch sử / Đổ mực</button>
                <button type="button" className="am-btn am-light" onClick={()=>{setNotice('');setEditing(p);}}><Pencil size={14}/> Sửa</button>
              </div></td></tr>)}
            {!listed.length&&<tr><td colSpan={6} className="pm-empty">{loading?'Đang tải...':'Chưa có máy in. Bấm “Thêm máy in” để tạo hồ sơ mới.'}</td></tr>}
          </tbody></table></div>
        </div>
      </section>
      <section id="pm-panel-ink" className="pm-tab-panel" role="tabpanel" aria-labelledby="pm-tab-ink" hidden={tab!=='ink'}>
        <WarehouseManagement kind="ink" embedded openCreateSignal={inkCreateSignal} refreshEpoch={refreshId+refreshEpoch}/>
      </section>
    </div>
    {selected&&<PrinterDetail printer={selected} onClose={()=>setSelected(null)} onSaved={refresh} user={user}/>} 
    {(showCreate||editing)&&<PrinterForm key={editing?.id||'new'} printer={editing} onClose={()=>{setEditing(null);setShowCreate(false);}} onSaved={savedPrinter}/>} 
  </div>;
}
