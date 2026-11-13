import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {api} from './api';
import {Boxes,Printer,Keyboard,Mouse,Laptop,Package,Plus,Search,ArrowRightLeft,History,RefreshCw,X,Save,CheckCircle2,AlertTriangle} from 'lucide-react';
import SortableHeader from './SortableHeader.jsx';
import {sortVisibleRows,toggleColumnSort} from './table-sort.js';

const CATEGORIES={ink:'Mực in',mouse:'Chuột',keyboard:'Bàn phím',laptop:'Laptop',pc:'PC',spare:'Linh kiện',other:'Thiết bị khác'};
const EMPTY={sku:'',name:'',category:'ink',quantity:0,unit:'cái',minQuantity:0,unitPrice:0,location:'',owner:'',note:''};
const fmt=ms=>ms?new Date(ms).toLocaleString('vi-VN'):'—';
const labelAction={opening:'Tồn đầu kỳ',receive:'Nhập kho',issue:'Cấp phát / sử dụng',adjust:'Kiểm kê'};
function Dialog({title,onClose,children}){return <div className="am-overlay" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="am-modal am-large" role="dialog" aria-modal="true" aria-label={title}><div className="am-modal-header"><h2>{title}</h2><button className="am-icon-btn" onClick={onClose} aria-label="Đóng"><X size={18}/></button></div>{children}</div></div>}
function Input({title,children}){return <label className="am-field"><span>{title}</span>{children}</label>}
function StockEditor({item,kind,onClose,onSaved}){
 const edit=Boolean(item?.id),[form,setForm]=useState(item?{...EMPTY,...item}: {...EMPTY,category:kind==='ink'?'ink':'mouse'}),[working,setWorking]=useState(false),[error,setError]=useState('');
 const field=(key,value)=>setForm(f=>({...f,[key]:value}));
 const submit=async e=>{e.preventDefault();setError('');setWorking(true);try{
  await api(edit?`/warehouse/${item.id}`:'/warehouse',{method:edit?'PATCH':'POST',body:form});onSaved();
 }catch(err){setError(err.message)}finally{setWorking(false)}};
 return <Dialog title={kind==='ink'?(edit?'Sửa mực trong kho':'Thêm mực vào kho'):(edit?'Sửa mặt hàng trong kho':'Thêm hàng vào kho')} onClose={onClose}><form className="am-form" onSubmit={submit}>
 <div className="am-form-grid"><Input title={kind==='ink'?'Mã mực *':'Mã hàng *'}><input required maxLength={100} disabled={edit} value={form.sku} onChange={e=>field('sku',e.target.value)}/></Input>
 <Input title={kind==='ink'?'Tên mực *':'Tên thiết bị / mực *'}><input required maxLength={255} value={form.name} onChange={e=>field('name',e.target.value)}/></Input>
 <Input title="Phân loại"><select value={form.category} onChange={e=>field('category',e.target.value)}>{Object.entries(CATEGORIES).filter(([k])=>kind!=='ink'||k==='ink').map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></Input>
 <Input title="Đơn vị tính"><input value={form.unit} onChange={e=>field('unit',e.target.value)}/></Input>
 {!edit&&<Input title="Số lượng đầu kỳ"><input type="number" min="0" step="1" value={form.quantity} onChange={e=>field('quantity',e.target.value)}/></Input>}
 <Input title="Ngưỡng cảnh báo tồn"><input type="number" min="0" step="1" value={form.minQuantity} onChange={e=>field('minQuantity',e.target.value)}/></Input>
 <Input title="Vị trí kho"><input value={form.location} onChange={e=>field('location',e.target.value)}/></Input>
 <Input title="Công ty sở hữu"><input value={form.owner} onChange={e=>field('owner',e.target.value)}/></Input>
 <Input title="Đơn giá (VNĐ)"><input type="number" min="0" value={form.unitPrice} onChange={e=>field('unitPrice',e.target.value)}/></Input>
 <Input title="Ghi chú"><input value={form.note} onChange={e=>field('note',e.target.value)}/></Input></div>
 {edit&&<div className="am-note">Muốn thay đổi số lượng tồn, hãy dùng Nhập/Xuất/Điều chỉnh để lưu đầy đủ lịch sử giao dịch.</div>}
 {error&&<p className="am-error">{error}</p>}<footer className="am-actions"><button type="button" className="am-btn am-light" onClick={onClose}>Hủy</button><button disabled={working} className="am-btn am-primary"><Save size={15}/> Lưu</button></footer>
 </form></Dialog>
}
function StockTransaction({item,onClose,onSaved}){
 const [type,setType]=useState('issue'),[amount,setAmount]=useState('1'),[actual,setActual]=useState(String(item.quantity)),[recipient,setRecipient]=useState(''),[reason,setReason]=useState(''),[date,setDate]=useState(new Date().toISOString().slice(0,10));
 const [working,setWorking]=useState(false),[error,setError]=useState('');
 const submit=async e=>{e.preventDefault();setWorking(true);setError('');try{
  await api(`/warehouse/${item.id}/movements`,{method:'POST',body:{type,amount:Number(amount),actualQuantity:Number(actual),recipient,reason,date}});onSaved();
 }catch(err){setError(err.message)}finally{setWorking(false)}};
 return <Dialog title={`${item.sku} · Nhập/Xuất kho`} onClose={onClose}><form className="am-form" onSubmit={submit}>
 <div className="am-highlight">Tồn hiện tại: <b>{item.quantity} {item.unit||'cái'}</b></div>
 <Input title="Thao tác"><select value={type} onChange={e=>setType(e.target.value)}><option value="issue">Cấp phát / Xuất kho</option><option value="receive">Nhập thêm hàng</option><option value="adjust">Điều chỉnh qua kiểm kê</option></select></Input>
 {type==='adjust'?<Input title="Số lượng tồn thực tế"><input required type="number" min="0" step="1" value={actual} onChange={e=>setActual(e.target.value)}/></Input>:<Input title="Số lượng"><input required type="number" min="1" step="1" value={amount} onChange={e=>setAmount(e.target.value)}/></Input>}
 {type==='issue'&&<Input title="Người nhận / bộ phận *"><input required value={recipient} onChange={e=>setRecipient(e.target.value)} placeholder="Tên người được cấp phát"/></Input>}
 <Input title="Ngày"><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></Input>
 <Input title="Ghi chú"><textarea value={reason} onChange={e=>setReason(e.target.value)} rows={2} placeholder="Lý do xuất, phiếu cấp phát hoặc nhập hàng..."/></Input>
 {error&&<p className="am-error">{error}</p>}<footer className="am-actions"><button type="button" className="am-btn am-light" onClick={onClose}>Hủy</button><button disabled={working} className="am-btn am-primary">Xác nhận</button></footer>
 </form></Dialog>
}
function StockHistory({item,onClose}){
 const [rows,setRows]=useState([]),[error,setError]=useState('');
 useEffect(()=>{api(`/warehouse/${item.id}/movements`).then(setRows).catch(e=>setError(e.message))},[item.id]);
 return <Dialog title={`Lịch sử kho · ${item.sku}`} onClose={onClose}><div className="am-detail-body">
 {error&&<p className="am-error">{error}</p>}{!rows.length&&<p className="am-muted">Chưa có lịch sử.</p>}
 {rows.map(m=><div className="am-event" key={m.id}><History size={16}/><div><b>{labelAction[m.type]||m.type}: {m.delta>0?'+':''}{m.delta} {item.unit}</b><p>{fmt(m.at)} · {m.performedBy||'Hệ thống'} · Tồn: {m.before} → {m.after}</p><small>{m.recipient?'Người nhận: '+m.recipient+' · ':''}{m.reason||''}</small></div></div>)}
 </div></Dialog>
}
export default function WarehouseManagement({kind='warehouse',onAssignAsset,onShowAsset,refreshEpoch=0,embedded=false,openCreateSignal=0}){
 const [stock,setStock]=useState({items:[],total:0,alerts:0}),[devices,setDevices]=useState([]),[term,setTerm]=useState(''),[category,setCategory]=useState('all');
 const [devicePage,setDevicePage]=useState(1),[devicePages,setDevicePages]=useState(1),[deviceTotal,setDeviceTotal]=useState(0),[debouncedSearch,setDebouncedSearch]=useState('');
 const [stockSort,setStockSort]=useState(''),[deviceSort,setDeviceSort]=useState('');
 const [onlyLow,setOnlyLow]=useState(false),[editor,setEditor]=useState(undefined),[transaction,setTransaction]=useState(null),[history,setHistory]=useState(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const reload=useCallback(async()=>{setLoading(true);try{
  const [list,assets]=await Promise.all([api('/warehouse'),kind==='warehouse'?api(`/assets?status=available&pageSize=50&page=${devicePage}&search=${encodeURIComponent(debouncedSearch)}${deviceSort?`&sortBy=${encodeURIComponent(deviceSort)}&sortDirection=asc`:''}`):Promise.resolve({items:[]})]);
  setStock({...list,items:Array.isArray(list?.items)?list.items:[]});setDevices(Array.isArray(assets?.items)?assets.items:[]);setDevicePages(assets.totalPages||1);setDeviceTotal(assets.total||0);setError('');
 }catch(err){setError(err.message)}finally{setLoading(false)}},[kind,devicePage,debouncedSearch,deviceSort]);
 useEffect(()=>{const t=setTimeout(()=>{setDebouncedSearch(term);setDevicePage(1);},300);return()=>clearTimeout(t);},[term]);
 useEffect(()=>{reload()},[reload,refreshEpoch]);
 // Nút Thêm mực ở thanh công cụ chung mở biểu mẫu kho mực.
 useEffect(()=>{if(kind==='ink'&&openCreateSignal>0)setEditor(null)},[kind,openCreateSignal]);
 const onlyInk=kind==='ink',safeItems=Array.isArray(stock?.items)?stock.items:[],stocked=useMemo(()=>safeItems.filter(x=>(onlyInk?x.category==='ink':kind==='warehouse'?x.category!=='ink':true)
    &&(category==='all'||x.category===category)&&(!onlyLow||Number(x.quantity)<=Number(x.minQuantity??0))&&(!term||[x.sku,x.name,x.location,x.owner].some(v=>String(v||'').toLocaleLowerCase('vi').includes(term.toLocaleLowerCase('vi'))))),[safeItems,kind,category,term,onlyLow]);
 const summaryInk=safeItems.filter(x=>x.category==='ink');
 const visibleTotal=onlyInk?summaryInk.length:stock.total;
 const visibleAlerts=onlyInk?summaryInk.filter(x=>x.quantity<=x.minQuantity).length:stock.alerts;
 const sortedStock=useMemo(()=>sortVisibleRows(stocked,stockSort,row=>{
  if(stockSort==='quantity'||stockSort==='minQuantity')return Number(row[stockSort]??0);
  if(stockSort==='location')return row.location||row.owner||'';
  if(stockSort==='category')return CATEGORIES[row.category]||row.category;
  return row[stockSort];
 }),[stocked,stockSort]);
 const toggleStockSort=key=>setStockSort(current=>toggleColumnSort(current,key));
 const toggleDeviceSort=key=>{setDeviceSort(current=>toggleColumnSort(current,key));setDevicePage(1)};
 const listed=devices;
 const saved=()=>{setEditor(undefined);setTransaction(null);reload()};
 return <div className="am-warehouse">
 {!embedded&&<div className="am-split am-heading"><div><h3>{onlyInk?'Quản lý mực in':kind==='warehouse'?'Kho thiết bị IT':'Kho vật tư và linh kiện'}</h3><p>Quản lý số lượng tồn, nhập xuất cấp phát và lịch sử từng vật tư</p></div><div className="am-head-actions"><button className="am-btn am-light" onClick={reload}><RefreshCw size={15}/>Làm mới</button><button className="am-btn am-primary" onClick={()=>setEditor(null)}><Plus size={15}/>{onlyInk?'Thêm mực':'Thêm hàng'}</button></div></div>}
 <div className="am-warehouse-summary"><div><Boxes size={18}/> {visibleTotal} mã {onlyInk?'mực':'vật tư'}</div><button type="button" className={onlyLow?'am-btn am-primary':'am-btn am-light'} onClick={()=>setOnlyLow(v=>!v)}><AlertTriangle size={18}/> {visibleAlerts} mã cần nhập thêm {onlyLow?'· Đang lọc':''}</button></div>
 {visibleAlerts>0&&<div className="am-alert-line" role="status"><AlertTriangle size={16}/> Cảnh báo tồn kho: {safeItems.filter(x=>(onlyInk?x.category==='ink':kind==='warehouse'?x.category!=='ink':true)&&Number(x.quantity)<=Number(x.minQuantity??0)).slice(0,5).map(x=>`${x.sku} (${x.quantity}/${x.minQuantity||0})`).join(' · ')}. Nhấn nhãn cảnh báo để lọc.</div>}
 <div className="am-filter-bar am-warehouse-filter"><div className="am-search"><Search size={16}/><input placeholder="Tìm mã, tên vật tư, vị trí kho..." value={term} onChange={e=>setTerm(e.target.value)}/></div>
 {!onlyInk&&<select value={category} onChange={e=>setCategory(e.target.value)}><option value="all">Tất cả nhóm</option>{Object.entries(CATEGORIES).filter(([k])=>kind==='warehouse'?k!=='ink':true).map(([k,v])=><option value={k} key={k}>{v}</option>)}</select>}
 </div>
 {error&&<p className="am-error">{error}</p>}
 {kind==='warehouse'&&<div className="am-card" style={{marginBottom:17}}><div className="am-padded"><h3>Thiết bị có mã tài sản còn trong kho</h3><p className="am-muted">Laptop, PC, màn hình, máy in... trạng thái Có sẵn. Cấp phát tại đây sẽ tạo lịch sử bàn giao tài sản.</p></div>
 <div className="am-table-wrap"><table className="am-table"><thead><tr>
 <SortableHeader label="Mã" sortKey="assetCode" activeKey={deviceSort} onToggle={toggleDeviceSort}/>
 <SortableHeader label="Tài sản" sortKey="assetName" activeKey={deviceSort} onToggle={toggleDeviceSort}/>
 <SortableHeader label="Loại" sortKey="categoryName" activeKey={deviceSort} onToggle={toggleDeviceSort}/>
 <SortableHeader label="Công ty" sortKey="ownerDepartmentName" activeKey={deviceSort} onToggle={toggleDeviceSort}/>
 <th scope="col">Thao tác</th>
 </tr></thead><tbody>
 {listed.map(item=><tr key={item.id}><td><button className="am-link" onClick={()=>onShowAsset(item)}>{item.assetCode}</button></td><td><b>{item.assetName}</b></td><td>{item.categoryName||'—'}</td><td>{item.ownerDepartmentName||'—'}</td><td><button className="am-btn am-primary" onClick={()=>onAssignAsset(item)}><ArrowRightLeft size={14}/> Cấp phát</button></td></tr>)}
 {!listed.length&&<tr><td colSpan={5} className="am-empty">Chưa có tài sản sẵn sàng cấp phát.</td></tr>}
 </tbody></table></div><div className="am-pagination"><span>{deviceTotal} thiết bị · Trang {devicePage}/{devicePages}</span><div><button disabled={devicePage<=1} onClick={()=>setDevicePage(p=>p-1)}>‹</button><button disabled={devicePage>=devicePages} onClick={()=>setDevicePage(p=>p+1)}>›</button></div></div></div>}
 <div className="am-card"><div className="am-padded"><h3>{onlyInk?'Danh sách mực in':'Vật tư quản lý theo số lượng'}</h3><p className="am-muted">{onlyInk?'Tồn kho mực theo mã, kèm lịch sử nhập, xuất và sử dụng cho máy in.':'Chuột, bàn phím, linh kiện, mực in... được ghi nhận tồn kho và lịch sử xuất cấp phát.'}</p></div>
 <div className="am-table-wrap"><table className="am-table"><thead><tr>
 <SortableHeader label="Mã kho" sortKey="sku" activeKey={stockSort} onToggle={toggleStockSort}/>
 <SortableHeader label="Tên hàng" sortKey="name" activeKey={stockSort} onToggle={toggleStockSort}/>
 <SortableHeader label="Loại" sortKey="category" activeKey={stockSort} onToggle={toggleStockSort}/>
 <SortableHeader label="Tồn kho" sortKey="quantity" activeKey={stockSort} onToggle={toggleStockSort}/>
 <SortableHeader label="Vị trí / Công ty" sortKey="location" activeKey={stockSort} onToggle={toggleStockSort}/>
 <th scope="col">Thao tác</th>
 </tr></thead><tbody>
 {sortedStock.map(item=><tr key={item.id}><td><b>{item.sku}</b></td><td>{item.name}</td><td>{CATEGORIES[item.category]||item.category}</td><td><span className={item.quantity<=item.minQuantity?'am-stock-low':'am-stock-good'}>{item.quantity} {item.unit}</span>{item.quantity<=item.minQuantity&&<small>Cần nhập thêm</small>}</td><td>{item.location||'—'}<small>{item.owner||''}</small></td><td><div className="am-warehouse-actions"><button className="am-btn am-primary" onClick={()=>setTransaction(item)}><ArrowRightLeft size={14}/>Nhập/Xuất</button><button className="am-icon-btn" title="Lịch sử xuất kho" onClick={()=>setHistory(item)}><History size={16}/></button><button className="am-icon-btn" title="Sửa mặt hàng" onClick={()=>setEditor(item)}><Save size={15}/></button></div></td></tr>)}
 {!stocked.length&&<tr><td colSpan={6} className="am-empty">{loading?'Đang tải dữ liệu...':'Chưa có hàng tồn trong nhóm này.'}</td></tr>}
 </tbody></table></div></div>
 {editor!==undefined&&<StockEditor item={editor} kind={kind} onClose={()=>setEditor(undefined)} onSaved={saved}/>}
 {transaction&&<StockTransaction item={transaction} onClose={()=>setTransaction(null)} onSaved={saved}/>}
 {history&&<StockHistory item={history} onClose={()=>setHistory(null)}/>}
 </div>
}
