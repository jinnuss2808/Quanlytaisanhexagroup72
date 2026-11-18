import React, {useEffect,useState} from 'react';
import {History,Search,Printer,Clock3,Droplets,Wrench,ChevronDown,ChevronUp} from 'lucide-react';
import {api} from './api';
import {formatPrinterMoney} from './printer-history-utils.js';

const labels={
  replace_toner:'Đổ mực',printer_service:'Sửa chữa',repair:'Sửa chữa',
  replace_part:'Thay linh kiện',maintenance:'Bảo trì'
};
const formattedTime=new Intl.DateTimeFormat('vi-VN',{
  timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',year:'numeric',
  hour:'2-digit',minute:'2-digit',hour12:false
});
function displayTime(item){
  if(Number.isFinite(item.at)&&item.at>0) return formattedTime.format(new Date(item.at));
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(item.date||'');
  return m?`${m[3]}/${m[2]}/${m[1]}`:'Không rõ thời gian';
}
function workDate(date){
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(date||'');
  return m?`${m[3]}/${m[2]}/${m[1]}`:null;
}

/** Nhật ký tập trung; chỉ đọc dữ liệu từ API, không ghi/chỉnh tồn kho. */
export default function PrinterActivity({active,refreshEpoch=0}){
  const [query,setQuery]=useState('');
  const [search,setSearch]=useState('');
  const [kind,setKind]=useState('all');
  const [page,setPage]=useState(1);
  const [result,setResult]=useState({items:[],total:0,totalPages:1,page:1});
  const [loading,setLoading]=useState(false),[error,setError]=useState('');
  const [expanded,setExpanded]=useState(null);
  useEffect(()=>{
    const timer=setTimeout(()=>{setSearch(query.trim());setPage(1);},250);
    return ()=>clearTimeout(timer);
  },[query]);
  useEffect(()=>{
    if(!active)return;
    let alive=true;
    setLoading(true);setError('');
    const params=new URLSearchParams({kind,search,page:String(page),pageSize:'30'});
    api(`/assets/printers/activity?${params}`)
      .then(data=>{if(alive){setResult({items:Array.isArray(data.items)?data.items:[],total:data.total||0,totalPages:data.totalPages||1,page:data.page||1});setExpanded(null);}})
      .catch(err=>{if(alive)setError(err.message||'Không tải được nhật ký.');})
      .finally(()=>{if(alive)setLoading(false);});
    return ()=>{alive=false;};
  },[active,kind,search,page,refreshEpoch]);
  const updateKind=value=>{setKind(value);setPage(1);};
  return <div className="am-card pm-global-activity">
    <div className="pm-activity-toolbar">
      <div className="pm-activity-search"><Search size={17}/><input aria-label="Tìm kiếm lịch sử máy in" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tìm theo tên máy, IP, công việc, người thực hiện..."/></div>
      <div className="pm-activity-filters" role="group" aria-label="Lọc lịch sử">
        {[['all','Tất cả'],['toner','Đổ mực'],['repair','Sửa chữa / bảo trì']].map(([value,label])=><button type="button" key={value} className={kind===value?'active':''} aria-pressed={kind===value} onClick={()=>updateKind(value)}>{label}</button>)}
      </div>
    </div>
    <div className="pm-activity-summary"><History size={16}/><strong>{result.total}</strong> lượt hoạt động {loading?'· Đang tải...':''}<span>Hiển thị mới nhất trước · Giờ Việt Nam</span></div>
    {error&&<div className="pm-message pm-bad" role="alert">{error} — Cần deploy backend HEXA có API lịch sử trước khi sử dụng tab này.</div>}
    <div className="am-table-wrap pm-activity-table-wrap">
      <table className="am-table pm-activity-table">
        <thead><tr><th>Thời gian</th><th>Máy in / IP</th><th>Hoạt động</th><th>Nội dung / Người thực hiện</th><th>Chi tiết</th></tr></thead>
        <tbody>
        {result.items.map(item=>{
          const id=`${item.printerId}:${item.id}`;
          const open=expanded===id;
          const isToner=item.type==='replace_toner';
          return <React.Fragment key={id}>
            <tr>
              <td className="pm-activity-time"><Clock3 size={14}/><time dateTime={item.at?new Date(item.at).toISOString():undefined}>{displayTime(item)}</time></td>
              <td><div className="pm-activity-machine"><Printer size={15}/><strong>{item.assetName}</strong></div><small>{item.ipAddress||'Không có IP'}{item.deleted?' · Đã xóa':''}</small></td>
              <td><span className={`pm-activity-type ${isToner?'toner':'repair'}`}>{isToner?<Droplets size={14}/>:<Wrench size={14}/>} {labels[item.type]||item.type}</span></td>
              <td><strong className="pm-activity-note">{item.summary||labels[item.type]||'Công việc máy in'}</strong><small>{item.byName||'Nhân viên IT'}</small></td>
              <td><button type="button" className="pm-activity-details-btn" aria-expanded={open} onClick={()=>setExpanded(open?null:id)}>{open?<ChevronUp size={15}/>:<ChevronDown size={15}/>} {open?'Thu gọn':'Xem'}</button></td>
            </tr>
            {open&&<tr className="pm-activity-expanded"><td colSpan={5}>
              <div className="pm-activity-info-grid">
                <div><span>Mã máy in</span><strong>{item.assetCode||'—'}</strong></div>
                <div><span>IP / Vị trí</span><strong>{item.ipAddress||'Không có IP'}{item.location?` · ${item.location}`:''}</strong></div>
                <div><span>Ngày công việc</span><strong>{workDate(item.date)||displayTime(item)}</strong></div>
                <div><span>Người thực hiện</span><strong>{item.byName||item.performedBy||'IT'}</strong></div>
                {!isToner&&<div><span>Chi phí sửa chữa</span><strong>{item.cost==null?'Chưa khai báo':formatPrinterMoney(item.cost)}</strong></div>}
                {item.stockName&&<div><span>Mực / Vật tư</span><strong>{item.stockName} · SL: {item.stockQuantity||1}</strong></div>}
                {item.replacedParts&&<div><span>Linh kiện đã thay</span><strong>{item.replacedParts}</strong></div>}
                {item.serviceProvider&&<div><span>Đơn vị sửa chữa</span><strong>{item.serviceProvider}</strong></div>}
                <div className="pm-activity-wide"><span>Ghi chú / Kết quả</span><strong>{item.notes||'Không có ghi chú'}</strong></div>
              </div>
            </td></tr>}
          </React.Fragment>;
        })}
        {!loading&&!error&&!result.items.length&&<tr><td colSpan={5} className="pm-empty">Chưa có lịch sử phù hợp. Khi đổ mực hoặc ghi sửa chữa, hoạt động sẽ xuất hiện ở đây.</td></tr>}
        {loading&&!result.items.length&&<tr><td colSpan={5} className="pm-empty">Đang tải lịch sử...</td></tr>}
        </tbody>
      </table>
    </div>
    <div className="pm-activity-pagination">
      <span>Trang {result.page}/{result.totalPages} · Tổng {result.total} lượt</span>
      <div><button type="button" disabled={loading||page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Trang trước</button><button type="button" disabled={loading||page>=result.totalPages} onClick={()=>setPage(p=>p+1)}>Trang sau</button></div>
    </div>
  </div>;
}
