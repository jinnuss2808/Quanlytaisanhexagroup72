import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut,
  EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { ref, query, orderByChild, equalTo, limitToLast, onValue } from 'firebase/database';
import {
  ArrowRight, ArrowLeft, Bell, Check, CheckCircle2, ChevronRight, Clock3,
  ClipboardList, Headphones, LayoutDashboard, Laptop, LifeBuoy, ListFilter, LockKeyhole,
  LogOut, Menu, Monitor, Package, Plus, Search, Send, ShieldCheck, Sparkles,
  Ticket, UserRound, UserRoundPlus, UsersRound, X, AlertCircle, CirclePause,
  Settings2, CalendarDays, FileText, MessageSquareText, Zap, Building2, BriefcaseBusiness,
  Mail, Phone, Hash, ExternalLink, RefreshCw, ClipboardCheck, CheckCheck, BarChart3, AlarmClock, Star, UserCheck, UserX, CalendarOff, SlidersHorizontal, Boxes, PanelLeftClose, PanelLeftOpen
} from 'lucide-react';
import { auth, realtimeDb } from './firebase';
import { api } from './api';
import { filterTicketsByType, countTicketsByType } from './ticket-list';
import AssetManagement, { PublicAssetPage } from './AssetManagement';

const STATUS = {
  new: { label: 'Mới tiếp nhận', cls: 'status-new', icon: Clock3 },
  in_progress: { label: 'Đang xử lý', cls: 'status-progress', icon: Zap },
  on_hold: { label: 'Tạm treo', cls: 'status-hold', icon: CirclePause },
  resolved: { label: 'Đã xử lý', cls: 'status-resolved', icon: CheckCircle2 },
  closed: { label: 'Đã đóng', cls: 'status-closed', icon: LockKeyhole },
};
const labelType = type => type === 'support' ? 'Hỗ trợ IT' : 'Yêu cầu thiết bị';
const dateFmt = value => value ? new Date(value).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const formatShortDate = value => value ? new Date(value).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : '—';
const shortName = name => (name || 'IT').split(' ').filter(Boolean).slice(-2).map(x => x[0]).join('').toUpperCase();
const realtimeList = value => Object.entries(value || {}).map(([id, data]) => ({ ...data, id })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

function Brand({ compact = false }) {
  return <div className={'brand ' + (compact ? 'brand-compact' : '')}>
    <div className="brand-icon"><span>H</span></div>
    <div><div className="brand-name">HEXA<span>.</span></div><div className="brand-caption">IT SERVICE DESK</div></div>
  </div>;
}
function Spinner({ label = 'Đang tải...' }) { return <div className="center-loading"><div className="spinner"/>{label}</div>; }
function StatusPill({ status }) { const s = STATUS[status] || STATUS.new; const Icon = s.icon; return <span className={`status-pill ${s.cls}`}><Icon size={13}/>{s.label}</span>; }
function TypePill({ type }) { const Icon = type === 'support' ? Headphones : Laptop; return <span className="type-pill"><Icon size={14}/>{labelType(type)}</span>; }
function TicketRating({ rating, compact = false }) {
  const stars = Number(rating);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return <span className="muted-value">—</span>;
  return <span className={'ticket-rating' + (compact ? ' compact' : '')} role="img"
    aria-label={`Người gửi đánh giá ${stars} trên 5 sao`} title={`${stars}/5 sao`}>
    <span className="ticket-rating-icons" aria-hidden="true">{[1, 2, 3, 4, 5].map(n =>
      <Star key={n} size={compact ? 12 : 15} fill={n <= stars ? 'currentColor' : 'none'}
        className={n <= stars ? 'filled' : 'empty'}/>)}</span>
    <strong>{stars}/5</strong>
  </span>;
}
function EmptyState({ icon: Icon = ClipboardList, title, text }) { return <div className="empty"><div className="empty-icon"><Icon size={25}/></div><strong>{title}</strong><p>{text}</p></div>; }
function Alert({ message, onClose }) { return message ? <div className="alert"><AlertCircle size={17}/><span>{message}</span><button onClick={onClose} aria-label="Đóng"><X size={16}/></button></div> : null; }

const initialForm = { type: 'support', requesterName: '', department: '', position: '', contact: '', email: '',
  subject: '', description: '', itemName: '', quantity: 1 };
function PublicRequestForm({ requester = null }) {
  const [form, setForm] = useState(() => requester ? {
    ...initialForm, requesterName: requester.name, department: requester.department,
    position: requester.position, contact: requester.contact, email: requester.email
  } : initialForm);
  useEffect(() => { if (requester) setForm(f => ({ ...f, requesterName: requester.name,
    department: requester.department, position: requester.position, contact: requester.contact,
    email: requester.email })); }, [requester]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));
  const submit = async ev => {
    ev.preventDefault(); setBusy(true); setError('');
    try {
      const ticket = await api('/public/tickets', { method: 'POST', authRequired: Boolean(requester), body: form });
      setSuccess(ticket);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const reset = () => { setSuccess(null); setForm(requester ? { ...initialForm, requesterName: requester.name,
    department: requester.department, position: requester.position, contact: requester.contact, email: requester.email } : initialForm); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  return <div className="public-root">
    <header className="public-header"><div className="page-width nav-row"><Brand/><nav>
      <span className="online-state"><span className="online-dot"/> CỔNG HỖ TRỢ NỘI BỘ</span>
      {requester && <button type="button" className="btn muted small" onClick={() => signOut(auth)}>Đăng xuất: {requester.name}</button>}
      <a href="/it" className="nav-it">Dành cho nhân viên IT <ArrowRight size={16}/></a>
    </nav></div></header>
    <main>
      <div className="public-hero"><div className="hero-orb hero-orb-one"/><div className="hero-orb hero-orb-two"/>
        <div className="page-width hero-inner"><div className="hero-copy"><div className="hero-eyebrow"><Sparkles size={15}/> HELPDESK · HEXA</div>
          <h1>Chúng tôi ở đây<br/>để <em>hỗ trợ bạn.</em></h1>
          <p>Mọi yêu cầu về công nghệ và trang thiết bị, chỉ cần vài thao tác. Đội ngũ IT sẽ tiếp nhận và xử lý nhanh chóng.</p>
          <div className="hero-highlights"><span><ShieldCheck size={18}/> Quy trình minh bạch</span><span><Clock3 size={18}/> Tiếp nhận nhanh chóng</span></div>
        </div><div className="hero-illustration" aria-hidden="true">
          <div className="illus-ring ring-one"/><div className="illus-ring ring-two"/>
          <div className="illustration-main"><div className="illu-top"><span className="mini-dot"/><span className="mini-dot"/><span className="mini-dot"/></div>
            <div className="illus-screen"><div className="illus-icon"><LifeBuoy size={36}/></div><div className="illus-line big"/><div className="illus-line"/><div className="illus-line small"/>
            <div className="illus-actions"><span/><span/></div></div></div>
          <div className="illus-float float-ticket"><Ticket size={20}/><div><strong>#IT-000128</strong><small>Đã tiếp nhận</small></div><CheckCircle2 size={19}/></div>
          <div className="illus-float float-user"><div className="avatar-mini">IT</div><div><strong>IT Support Team</strong><small>Luôn sẵn sàng hỗ trợ</small></div></div>
        </div></div>
      </div>
      {requester && <div className="page-width requester-account-tip"><UserCheck size={18}/>
        Bạn đang gửi yêu cầu bằng tài khoản <strong>{requester.email}</strong>.
        {requester.requestedJobLevel==='manager' && !requester.jobLevelApproved && <span> Cấp bậc Quản lý đang chờ IT phê duyệt.</span>}
        Sau khi IT đánh dấu Đã xử lý, bạn sẽ có quyền đánh giá và xác nhận đóng phiếu.</div>}
      <div className="page-width request-area" id="tao-yeu-cau">
        <div className="section-intro"><div><div className="eyebrow dark">TẠO YÊU CẦU MỚI</div><h2>Bạn cần hỗ trợ vấn đề gì?</h2><p>Chọn loại yêu cầu và điền thông tin bên dưới để gửi đến bộ phận IT.</p></div><div className="intake-badge"><span>01</span><span>/ 02</span><small>BƯỚC ĐẦU TIÊN</small></div></div>
        {success ? <div className="success-card"><div className="success-icon"><CheckCircle2 size={40}/></div><h2>Gửi yêu cầu thành công!</h2>
          <p>Yêu cầu của bạn đã được ghi nhận. Bộ phận IT sẽ sớm tiếp nhận và xử lý.</p>
          <div className="reference-box"><small>MÃ PHIẾU CỦA BẠN</small><strong>{success.code}</strong><span>Hãy lưu mã này để trao đổi với bộ phận IT.</span></div>
          <button className="btn primary" onClick={reset}><Plus size={17}/> Gửi yêu cầu khác</button></div> : <>
          <div className="request-type-grid">
            <button className={'request-type-card ' + (form.type === 'support' ? 'selected' : '')} onClick={() => set('type', 'support')}>
              <div className="type-card-icon support"><Headphones size={27}/></div><div className="type-card-content"><strong>Hỗ trợ kỹ thuật IT</strong><p>Máy tính, mạng, phần mềm, tài khoản, email và các sự cố khác</p></div><div className="type-radio">{form.type === 'support' && <Check size={14}/>}</div></button>
            <button className={'request-type-card ' + (form.type === 'equipment' ? 'selected' : '')} onClick={() => set('type', 'equipment')}>
              <div className="type-card-icon equipment"><Laptop size={27}/></div><div className="type-card-content"><strong>Yêu cầu trang thiết bị</strong><p>Đề xuất cấp máy tính, laptop, màn hình, bàn phím và vật tư IT</p></div><div className="type-radio">{form.type === 'equipment' && <Check size={14}/>}</div></button>
          </div>
          <form className="public-form card-surface" onSubmit={submit}>
            <div className="form-section-title"><div className="form-section-icon"><UserRound size={19}/></div><div><h3>Thông tin người yêu cầu</h3><span>Để IT có thể liên hệ với bạn</span></div></div>
            <div className="form-grid">
              <Field label="Họ và tên" required readOnly={Boolean(requester)} icon={UserRound} value={form.requesterName} onChange={v => set('requesterName', v)} placeholder="Nguyễn Văn A" maxLength={100}/>
              <Field label="Phòng ban" required readOnly={Boolean(requester)} icon={Building2} value={form.department} onChange={v => set('department', v)} placeholder="Ví dụ: Phòng Kế toán" maxLength={100}/>
              <Field label="Chức vụ" required readOnly={Boolean(requester)} icon={BriefcaseBusiness} value={form.position} onChange={v => set('position', v)} placeholder="Ví dụ: Nhân viên kế toán" maxLength={100}/>
              <Field label="Số điện thoại / máy lẻ" required readOnly={Boolean(requester)} icon={Phone} value={form.contact} onChange={v => set('contact', v)} placeholder="Số điện thoại liên hệ" maxLength={100}/>
              <Field label={requester ? "Email tài khoản" : "Email (không bắt buộc)"} readOnly={Boolean(requester)} icon={Mail} value={form.email} onChange={v => set('email', v)} placeholder="email@hexa.vn" type="email" maxLength={254}/>
            </div>
            <div className="form-line"/>
            <div className="form-section-title"><div className="form-section-icon purple">{form.type === 'support' ? <Headphones size={19}/> : <Package size={19}/>}</div><div><h3>Chi tiết yêu cầu</h3><span>Mô tả cụ thể để chúng tôi hỗ trợ tốt nhất</span></div></div>
            <div className="form-grid">
              <Field label="Tiêu đề yêu cầu" required span icon={FileText} value={form.subject} onChange={v => set('subject', v)} placeholder={form.type === 'support' ? 'Ví dụ: Không kết nối được Wi-Fi tầng 3' : 'Ví dụ: Đề xuất cấp mới laptop'} maxLength={160}/>
              {form.type === 'equipment' && <>
                <Field label="Tên thiết bị" required icon={Laptop} value={form.itemName} onChange={v => set('itemName', v)} placeholder="Laptop Dell / Màn hình / Bàn phím..." maxLength={120}/>
                <Field label="Số lượng" required type="number" value={form.quantity} onChange={v => set('quantity', v)} min={1} max={999}/>
              </>}
              <div className="field span-all"><label>Mô tả chi tiết <span>*</span></label><textarea required rows={5} maxLength={3000} value={form.description} onChange={e => set('description', e.target.value)} placeholder={form.type === 'support' ? 'Mô tả tình trạng lỗi, thiết bị đang sử dụng, thời điểm phát sinh...' : 'Mục đích sử dụng, cấu hình mong muốn, lý do đề xuất...'}/></div>
            </div>
            <Alert message={error} onClose={() => setError('')}/>
            <div className="submit-footer"><div className="submit-hint"><ShieldCheck size={18}/> Thông tin của bạn chỉ được sử dụng để xử lý yêu cầu.</div>
              <button type="submit" className="btn primary submit-btn" disabled={busy}>{busy ? 'Đang gửi...' : <>Gửi yêu cầu <Send size={17}/></>}</button></div>
          </form></>}
      </div>
      {requester && <div className="page-width requester-list"><RequesterTickets uid={requester.uid || auth.currentUser?.uid}/></div>}
    </main><footer className="public-footer"><div className="page-width"><Brand compact/><span>© {new Date().getFullYear()} HEXA · IT Service Desk</span><span>Hỗ trợ nội bộ · Bảo mật & chuyên nghiệp</span></div></footer>
  </div>;
}
// Public mode is unchanged while the manager's optional requester workflow is OFF.
function PublicPage() {
  const [enabled, setEnabled] = useState(null);
  const [settingsError, setSettingsError] = useState('');
  const [ticketAvailable, setTicketAvailable] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState(undefined);
  const [requester, setRequester] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => onAuthStateChanged(auth, setFirebaseUser), []);
  useEffect(() => {
    let mounted = true;
    api('/public/settings', { authRequired: false })
      .then(v => { if (mounted) { setEnabled(v.requesterWorkflowEnabled === true); setTicketAvailable(v.ticketEnabled !== false); } })
      .catch(err => { if (mounted) { setSettingsError(err.message); setEnabled('unavailable'); } });
    return () => { mounted = false; };
  }, []);
  useEffect(() => {
    if (enabled !== true || firebaseUser === undefined) return;
    let alive = true;
    if (!firebaseUser) { setRequester(null); setLoading(false); return; }
    setLoading(true);
    api('/requester/me').then(person => { if (alive) setRequester(person); })
      .catch(() => { if (alive) setRequester(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [enabled, firebaseUser]);
  if (enabled === null || firebaseUser === undefined || loading) return <Spinner label="Đang tải cổng yêu cầu..."/>;
  if (enabled === 'unavailable') return <div className="requester-auth-root"><div className="requester-auth-card card-surface"><Brand/><h2>Không tải được cấu hình hệ thống</h2><p>Vui lòng kiểm tra máy chủ Node.js và thử tải lại trang.</p><Alert message={settingsError}/><button className="btn primary full" onClick={() => window.location.reload()}>Thử lại</button></div></div>;
  if (!ticketAvailable) return <div className="requester-auth-root"><div className="requester-auth-card card-surface">
    <Brand/><div style={{display:'flex',justifyContent:'center',margin:'12px auto',color:'#2563eb'}}><CirclePause size={27}/></div>
    <h2>Cổng yêu cầu đang tạm ngừng</h2>
    <p>HEXA đang tạm tắt tính năng Ticket. Hệ thống Quản lý tài sản vẫn hoạt động bình thường.</p>
    <a className="btn primary full" href="/it">Đăng nhập hệ thống IT</a>
  </div></div>;
  if (!enabled) return <PublicRequestForm/>;
  if (requester) return <PublicRequestForm requester={requester}/>;
  return <RequesterAccess hasSession={Boolean(firebaseUser)} onRegistered={setRequester} draft={draft} onDraft={setDraft}/>;
}
function RequesterAccess({ hasSession, onRegistered, draft, onDraft }) {
  const [register, setRegister] = useState(false);
  const [form, setForm] = useState({ name: '', department: '', position: '', contact: '', email: '', password: '', jobLevel: 'employee', ...(draft || {}) });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key, value) => setForm(old => ({ ...old, [key]: value }));
  const submit = async e => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      if (register && !hasSession) {
        if (form.password.length < 8 || form.password.length > 128) throw new Error('Mật khẩu cần từ 8 đến 128 ký tự.');
        onDraft({ name: form.name, department: form.department, position: form.position, contact: form.contact, email: form.email, jobLevel: form.jobLevel });
        await createUserWithEmailAndPassword(auth, form.email.trim(), form.password);
        // No email-link verification. Create profile as soon as Auth has signed in.
        const person = await api('/requester/register', { method: 'POST', body: {
          name: form.name, department: form.department, position: form.position, contact: form.contact, jobLevel: form.jobLevel
        }});
        onRegistered(person);
      } else if (hasSession) {
        const person = await api('/requester/register', { method: 'POST', body: {
          name: form.name, department: form.department, position: form.position, contact: form.contact, jobLevel: form.jobLevel
        }});
        onRegistered(person);
      } else {
        await signInWithEmailAndPassword(auth, form.email.trim(), form.password);
      }
    } catch (err) { setError(err?.message || 'Không thể đăng nhập hoặc đăng ký.'); }
    finally { setBusy(false); }
  };
  const needsProfile = hasSession;
  return <div className="requester-auth-root"><div className="requester-auth-card card-surface">
    <Brand/><div className="eyebrow dark">CỔNG YÊU CẦU HEXA</div>
    <h2>{needsProfile ? 'Hoàn tất hồ sơ người yêu cầu' : register ? 'Tạo tài khoản người yêu cầu' : 'Đăng nhập để gửi yêu cầu'}</h2>
    <p>Chế độ xác thực người gửi đã được quản trị viên bật. Bạn có thể theo dõi, đánh giá và xác nhận đóng ticket của chính mình.</p>
    <form onSubmit={submit} className="requester-auth-form">
      {(register || needsProfile) && <>
        <Field label="Họ tên" required icon={UserRound} value={form.name} onChange={v => set('name', v)}/>
        <Field label="Phòng ban" required icon={Building2} value={form.department} onChange={v => set('department', v)}/>
        <Field label="Chức vụ" required icon={BriefcaseBusiness} value={form.position} onChange={v => set('position', v)}/>
        <label className="requester-level-control">Cấp bậc
          <select value={form.jobLevel} onChange={e=>set('jobLevel',e.target.value)}>
            <option value="employee">Nhân viên</option>
            <option value="manager">Quản lý trở lên</option>
          </select>
        </label>
        <Field label="Số điện thoại" required icon={Phone} value={form.contact} onChange={v => set('contact', v)}/>
      </>}
      {!needsProfile && <>
        <Field label="Email công ty" required type="email" icon={Mail} value={form.email} onChange={v => set('email', v)}/>
        <Field label="Mật khẩu" required type="password" icon={LockKeyhole} value={form.password} onChange={v => set('password', v)}/>
      </>}
      <Alert message={error} onClose={() => setError('')}/>
      <button className="btn primary full" type="submit" disabled={busy}>{busy ? 'Đang xử lý...' : needsProfile ? 'Hoàn tất hồ sơ' : register ? 'Tạo tài khoản' : 'Đăng nhập'}</button>
    </form>
    {needsProfile ? <button className="btn muted full" onClick={() => signOut(auth)}>Đăng xuất / Dùng tài khoản khác</button> :
      <button className="btn muted full" onClick={() => setRegister(!register)}>{register ? 'Tôi đã có tài khoản' : 'Chưa có tài khoản? Đăng ký'}</button>}
    <a href="/it" className="nav-it">Đăng nhập khu vực IT</a>
  </div></div>;
}
function RequesterTickets({ uid }) {
  const [tickets, setTickets] = useState([]);
  const [reviewFor, setReviewFor] = useState(null);
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const reloadTickets = () => api('/requester/tickets').then(rows => { if (!Array.isArray(rows)) throw new Error('API người yêu cầu trả về dữ liệu không phải danh sách.'); setTickets(rows); }).catch(err => setError(err.message));
  useEffect(() => {
    reloadTickets(); // Backend API still works when the RTDB client listener is not available.
    const requesterUid = uid || auth.currentUser?.uid;
    if (typeof requesterUid !== 'string' || !requesterUid.trim()) {
      setError('Thiếu UID tài khoản người yêu cầu; vui lòng đăng nhập lại.');
      return;
    }
    const q = query(ref(realtimeDb, 'tickets'), orderByChild('requesterUid'), equalTo(requesterUid));
    return onValue(q, snap => setTickets(realtimeList(snap.val())),
      err => setError('Không có quyền xem realtime, hãy triển khai Firebase Rules hoặc bấm Làm mới: ' + err.message));
  }, [uid]);
  const confirm = async ticket => {
    setBusy(true); setError('');
    try {
      await api(`/requester/tickets/${ticket.id}/confirm`, { method:'PATCH', body:{ rating, review } });
      setReviewFor(null); setReview('');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  return <section className="dash-panel requester-tickets-panel">
    <div className="panel-header"><div><h3>Yêu cầu của tôi</h3><p>Theo dõi ticket, đánh giá IT và xác nhận hoàn thành.</p></div><button className="btn muted small" onClick={reloadTickets}><RefreshCw size={15}/> Làm mới</button></div>
    <Alert message={error} onClose={() => setError('')}/>
    {!tickets.length ? <EmptyState title="Bạn chưa có ticket" text="Các phiếu gửi từ tài khoản này sẽ hiển thị tại đây."/> :
      tickets.map(ticket => <div key={ticket.id} className="requester-ticket-row">
        <div><strong>{ticket.code} · {ticket.subject}</strong><p>{labelType(ticket.type)} · {dateFmt(ticket.createdAt)}</p><StatusPill status={ticket.status}/></div>
        {ticket.status === 'resolved' && <div className="requester-confirm">
          {reviewFor !== ticket.id ? <button className="btn primary small" onClick={() => { setReviewFor(ticket.id); setRating(5); }}>
            <CheckCircle2 size={16}/> Đánh giá và xác nhận đóng</button> : <>
            <div className="rating-stars" role="group" aria-label="Đánh giá số sao">{[1,2,3,4,5].map(n =>
              <button type="button" key={n} className={n <= rating ? 'selected' : ''} onClick={() => setRating(n)} aria-label={`${n} sao`}><Star size={21}/></button>)}</div>
            <textarea className="note-input" rows={2} value={review} maxLength={1000} placeholder="Nhận xét về chất lượng hỗ trợ (không bắt buộc)" onChange={e => setReview(e.target.value)}/>
            <div className="inline-action"><button className="btn primary small" disabled={busy} onClick={() => confirm(ticket)}>Xác nhận và đóng ticket</button>
              <button className="btn muted small" onClick={() => setReviewFor(null)}>Hủy</button></div>
          </>}
        </div>}
        {ticket.status === 'closed' && ticket.requesterRating && <div className="requester-completed-rating">Đã xác nhận · <TicketRating rating={ticket.requesterRating}/></div>}
      </div>)}
  </section>;
}

function Field({ label, required, readOnly = false, icon: Icon, value, onChange, placeholder, type = 'text', span, maxLength, min, max }) {
  return <div className={'field ' + (span ? 'span-all' : '')}><label>{label} {required && <span>*</span>}</label>
    <div className="control-wrap">{Icon && <Icon size={18} className="control-icon"/>}<input required={required} readOnly={readOnly} type={type} value={value} maxLength={maxLength} min={min} max={max} onChange={e => onChange(e.target.value)} placeholder={placeholder}/></div></div>;
}
function LoginPage() {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const submit = async e => { e.preventDefault(); setLoading(true); setError('');
    try { await signInWithEmailAndPassword(auth, email.trim(), password); }
    catch (err) {
      const code = err?.code || 'auth/unknown';
      const messages = {
        'auth/invalid-api-key': 'Firebase API Key không hợp lệ trên bản deploy.',
        'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'Firebase API Key không hợp lệ trên bản deploy.',
        'auth/operation-not-allowed': 'Chưa bật đăng nhập Email/Password trong Firebase Authentication.',
        'auth/user-disabled': 'Tài khoản đã bị khóa trong Firebase Authentication.',
        'auth/network-request-failed': 'Trình duyệt không kết nối được Firebase Authentication.',
        'auth/too-many-requests': 'Firebase tạm khóa đăng nhập do thử nhiều lần. Hãy thử lại sau.',
        'auth/invalid-credential': 'Firebase không chấp nhận email/mật khẩu trong project hiện tại. Hãy đối chiếu Firebase Authentication > Users.',
        'auth/wrong-password': 'Firebase báo mật khẩu không khớp với tài khoản trong project hiện tại.',
        'auth/user-not-found': 'Firebase không tìm thấy tài khoản trong project hiện tại.',
        'auth/unauthorized-domain': 'Tên miền web chưa được cho phép trong Firebase Authentication.',
        'auth/configuration-not-found': 'Firebase Authentication chưa có cấu hình đăng nhập Email/Password.'
      };
      console.error('[HEXA AUTH ERROR]', code);
      setError(`${messages[code] || 'Firebase Authentication không đăng nhập được.'} (Mã: ${code})`);
    }
    finally { setLoading(false); }
  };
  return <div className="login-root"><div className="login-image-panel"><div className="login-panel-top"><Brand/></div><div className="login-panel-center"><div className="login-panel-tag"><ShieldCheck size={17}/> KHU VỰC DÀNH CHO IT</div><h1>Quản lý công việc.<br/><em>Tối ưu hỗ trợ.</em></h1><p>Toàn bộ yêu cầu từ nhân sự được tổng hợp, phân công và theo dõi trên cùng một nền tảng.</p><div className="login-cards"><div><Ticket size={20}/><span>Ticket tập trung</span></div><div><UsersRound size={20}/><span>Phân công thông minh</span></div><div><Bell size={20}/><span>Thông báo kịp thời</span></div></div></div><span className="login-watermark">HEXA.</span></div>
    <div className="login-form-panel"><div className="login-toplink"><a href="/"><ArrowLeft size={17}/> Quay lại cổng yêu cầu</a></div><form onSubmit={submit} className="login-form"><div className="login-emoji"><LockKeyhole size={25}/></div><span className="eyebrow dark">ĐĂNG NHẬP HỆ THỐNG</span><h2>Chào mừng trở lại!</h2><p>Đăng nhập bằng tài khoản IT được cấp để tiếp tục.</p>
      <div className="field"><label>Email công ty</label><div className="control-wrap"><Mail size={17} className="control-icon"/><input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="it@hexa.vn"/></div></div>
      <div className="field"><label>Mật khẩu</label><div className="control-wrap"><LockKeyhole size={17} className="control-icon"/><input required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Nhập mật khẩu"/></div></div>
      <Alert message={error} onClose={() => setError('')}/><button type="submit" className="btn primary login-submit" disabled={loading}>{loading ? 'Đang đăng nhập...' : <>Đăng nhập hệ thống <ArrowRight size={18}/></>}</button>
      <div className="login-notice"><ShieldCheck size={17}/> Khu vực bảo mật, chỉ dành cho nhân viên IT được ủy quyền.</div></form><div className="login-bottom">© {new Date().getFullYear()} HEXA · IT Service Desk</div></div>
  </div>;
}
function Dashboard({ user, onLogout }) {
  // Asset management is the primary module while Ticket may be disabled.
  const [section, setSection] = useState('assets');
  const [ticketEnabled, setTicketEnabled] = useState(true);
  const [tickets, setTickets] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Desktop sidebar can be collapsed; remember the choice between reloads.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return window.localStorage.getItem('hexa-sidebar-collapsed') === '1'; }
    catch { return false; }
  });
  useEffect(() => {
    try { window.localStorage.setItem('hexa-sidebar-collapsed', sidebarCollapsed ? '1' : '0'); }
    catch { /* Private browsing / disabled storage */ }
  }, [sidebarCollapsed]);
  const [selected, setSelected] = useState(null);
  const [ticketTab, setTicketTab] = useState('support');
  const [ticketFilters, setTicketFilters] = useState({
    support: { search: '', status: 'all' },
    equipment: { search: '', status: 'all' },
  });
  const activeTicketFilter = ticketFilters[ticketTab];
  const setTicketSearch = value => setTicketFilters(old => ({ ...old, [ticketTab]: { ...old[ticketTab], search: value } }));
  const setTicketStatus = value => setTicketFilters(old => ({ ...old, [ticketTab]: { ...old[ticketTab], status: value } }));
  const [showAddUser, setShowAddUser] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [assetFromTicket, setAssetFromTicket] = useState(null);
  useEffect(() => {
    let mounted = true;
    api('/public/settings', { authRequired: false })
      .then(v => { if (mounted) {
        const on = v.ticketEnabled !== false;
        setTicketEnabled(on);
        if (!on) setSection('assets');
      }})
      .catch(err => { if (mounted) setError('Không tải được cấu hình Ticket: ' + err.message); });
    return () => { mounted = false; };
  }, []);
  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const requests = [ticketEnabled ? api('/tickets') : Promise.resolve([]), ticketEnabled ? api('/notifications') : Promise.resolve([])];
      if (user.role === 'manager') requests.push(api('/users'));
      const [t, n, u] = await Promise.all(requests);
      // Backend/Vercel may return an error object or non-array payload.
      // Never place it into a list state: doing so crashes React with "filter is not a function".
      if (!Array.isArray(t) || !Array.isArray(n) || (u !== undefined && !Array.isArray(u))) {
        throw new Error('API trả về dữ liệu không đúng cấu trúc. Hãy kiểm tra backend /api/tickets và /api/notifications trên Vercel.');
      }
      setTickets(t); setNotifications(n); if (u) setUsers(u);
      setError('');
    } catch (err) { setError(err.message); }
    finally { if (!silent) setLoading(false); }
  }, [user.role, ticketEnabled]);
  useEffect(() => {
    refresh();
    // Firebase RTDB listeners update tickets and notifications as soon as data changes.
    // Always use the signed-in Firebase Auth UID. Never call equalTo(undefined).
    const effectiveUid = auth.currentUser?.uid || user.uid;
    const validUid = typeof effectiveUid === 'string' && effectiveUid.trim().length > 0 && ticketEnabled;
    // Shared queue for all active IT users; Firebase Rules protect access.
    const ticketsQuery = validUid
      ? query(ref(realtimeDb, 'tickets'), orderByChild('createdAt'))
      : null;
    const notificationQuery = validUid
      ? query(ref(realtimeDb, `notifications/${effectiveUid}`), orderByChild('createdAt'), limitToLast(50))
      : null;
    if (!validUid) setError('Thiếu UID tài khoản Firebase, vui lòng đăng xuất rồi đăng nhập lại.');
    const unsubscribeTickets = ticketsQuery
      ? onValue(ticketsQuery, snap => setTickets(realtimeList(snap.val())),
        err => setError('Không nhận được dữ liệu ticket trực tiếp: ' + err.message))
      : () => {};
    const unsubscribeNotifications = notificationQuery
      ? onValue(notificationQuery, snap => setNotifications(realtimeList(snap.val())),
        err => setError('Không nhận được thông báo trực tiếp: ' + err.message))
      : () => {};
    return () => { unsubscribeTickets(); unsubscribeNotifications(); };
  }, [refresh, user.role, user.uid, ticketEnabled]);
  const openTicket = ticket => { setSelected(ticket); };
  const selectSection = key => {
    if (!ticketEnabled && ['tickets','equipment','overview','reports','notifications','requester_accounts','leaves'].includes(key)) key = 'assets';
    // Preserve existing entry points that opened the old equipment section.
    if (key === 'equipment') { setTicketTab('equipment'); setSection('tickets'); }
    else setSection(key);
    setSidebarOpen(false);
  };
  const unread = (Array.isArray(notifications) ? notifications : []).filter(n => !n.read).length;
  const active = (Array.isArray(tickets) ? tickets : []).filter(t => ['new','in_progress','on_hold'].includes(t.status));
  const onUpdated = async () => { await refresh(true); };
  const current = selected ? tickets.find(t => t.id === selected.id) || selected : null;
  const isManager = user.role === 'manager';
  const items = [
    ...(ticketEnabled ? [
      { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard },
      { id: 'tickets', label: 'Quản lý ticket', icon: Ticket, count: tickets.filter(t => t.status === 'new').length },
    ] : []),
    { id: 'assets', label: 'Quản lý tài sản', icon: Boxes },
    ...(ticketEnabled ? [
      { id: 'reports', label: 'Thống kê hoàn thành', icon: BarChart3 },
      { id: 'notifications', label: 'Thông báo', icon: Bell, count: unread }
    ] : []),
  ];
  if (isManager) items.push({ id: 'users', label: 'Nhân viên IT', icon: UsersRound },
    ...(ticketEnabled ? [{ id: 'requester_accounts', label: 'Tài khoản người yêu cầu', icon: UserRoundPlus }] : []),
    { id: 'settings', label: 'Cấu hình hệ thống', icon: SlidersHorizontal });
  else if (ticketEnabled) items.push({ id: 'leaves', label: 'Ngày nghỉ của tôi', icon: CalendarOff });
  const title = { overview: 'Tổng quan hệ thống', tickets: 'Quản lý ticket', equipment: 'Yêu cầu trang thiết bị', notifications: 'Thông báo của bạn', users: 'Quản lý nhân viên IT', reports: 'Báo cáo hoàn thành', leaves: 'Đăng ký ngày nghỉ', requester_accounts: 'Tài khoản người yêu cầu', settings: 'Cấu hình hệ thống', assets: 'Quản lý tài sản' }[section];
  const ticketCounts = useMemo(() => ({
    support: countTicketsByType(tickets, 'support'),
    equipment: countTicketsByType(tickets, 'equipment'),
  }), [tickets]);
  const filteredTickets = useMemo(() => filterTicketsByType(tickets, {
    type: ticketTab, search: activeTicketFilter.search, status: activeTicketFilter.status,
  }), [tickets, ticketTab, activeTicketFilter]);
  return <div className={'admin-root' + (sidebarCollapsed ? ' sidebar-collapsed' : '')}>
    {sidebarOpen && <button className="side-scrim" onClick={() => setSidebarOpen(false)} aria-label="Đóng menu"/>}
    <aside className={'sidebar ' + (sidebarOpen ? 'sidebar-open' : '')}>
      <div className="side-brand"><div className="side-brand-name">HEXA<span>.</span></div></div><div className="side-label">BẢNG ĐIỀU KHIỂN</div>
      <nav className="side-menu">{items.map(item => { const Icon = item.icon; return <button key={item.id} title={item.label} aria-label={item.label} onClick={() => selectSection(item.id)} className={'side-link ' + (section === item.id ? 'active' : '')}><Icon size={20}/><span className="side-link-text">{item.label}</span>{item.count > 0 && <span className="side-count">{item.count}</span>}</button>; })}</nav>
      <div className="side-bottom"><div className="side-profile"><div className="profile-avatar">{shortName(user.name)}</div><div className="profile-meta"><strong>{user.name}</strong><span>{isManager ? 'Quản lý IT' : 'Nhân viên IT'}</span></div><button title="Đăng xuất" onClick={onLogout}><LogOut size={18}/></button></div></div>
    </aside>
    <div className="admin-main"><header className="admin-topbar"><div className="bar-left"><button className="mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Mở menu"><Menu size={22}/></button><button className="desktop-sidebar-toggle" type="button" aria-label={sidebarCollapsed ? 'Mở rộng menu bên trái' : 'Thu gọn menu bên trái'} title={sidebarCollapsed ? 'Mở rộng menu' : 'Thu gọn menu'} aria-expanded={!sidebarCollapsed} onClick={() => setSidebarCollapsed(v => !v)}>{sidebarCollapsed ? <PanelLeftOpen size={20}/> : <PanelLeftClose size={20}/>}</button><div className="breadcrumbs">Hệ thống <ChevronRight size={15}/> <strong>{title}</strong></div></div>
      <div className="bar-right"><span className="date-chip"><CalendarDays size={16}/>{new Date().toLocaleDateString('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' })}</span><button className="icon-button" onClick={() => refresh()} title="Làm mới"><RefreshCw size={18}/></button><button className="icon-button notify-button" onClick={() => selectSection('notifications')} title="Thông báo"><Bell size={19}/>{unread > 0 && <span className="notify-dot"/>}</button><button className="icon-button" onClick={() => setShowPasswordModal(true)} title="Đổi mật khẩu của tôi"><LockKeyhole size={18}/></button><div className="top-avatar">{shortName(user.name)}</div></div></header>
      <div className="admin-content">{section !== 'assets' && <div className="dash-heading"><div><span className="eyebrow dark">{isManager ? 'QUẢN TRỊ VIÊN' : 'NHÂN VIÊN HỖ TRỢ'} · HEXA IT</span><h1>{title}</h1><p>{section === 'overview' ? `Xin chào ${user.name}! Đây là tình hình yêu cầu hỗ trợ hiện tại.` : 'Theo dõi, cập nhật và xử lý công việc trên cùng một nền tảng.'}</p></div>
        <div className="heading-actions">{section === 'users' && <button className="btn primary" onClick={() => setShowAddUser(true)}><UserRoundPlus size={17}/> Thêm tài khoản IT</button>}{['tickets','overview'].includes(section) && <button className="btn muted" onClick={() => refresh()}><RefreshCw size={16}/> Làm mới</button>}</div></div>}
        <Alert message={error} onClose={() => setError('')}/>
        {loading ? <Spinner/> : <>
          {section === 'overview' && <>
            <div className="welcome-banner"><div><span className="banner-label"><Sparkles size={15}/> QUẢN LÝ HIỆU QUẢ</span><h2>Mọi yêu cầu, một nơi quản lý.</h2><p>{isManager ? 'Toàn bộ IT cùng nhìn thấy ticket, không cần phân công.' : 'Tất cả ticket đều hiển thị cho IT; người hoàn thành được ghi nhận trong báo cáo.'}</p></div><div className="banner-art"><div className="banner-circle"><ClipboardCheck size={62}/></div><span className="banner-star one">✦</span><span className="banner-star two">✧</span></div></div>
            <div className="stats-grid"><Stat label="Tổng số yêu cầu" value={tickets.length} icon={ClipboardList} color="blue" sub="Tất cả các phiếu"/><Stat label="Chờ tiếp nhận" value={tickets.filter(t => t.status === 'new').length} icon={Clock3} color="orange" sub="Cần được xử lý"/><Stat label="Đang xử lý" value={tickets.filter(t => t.status === 'in_progress').length} icon={Zap} color="purple" sub="Đang thực hiện"/><Stat label="Hoàn thành" value={tickets.filter(t => ['resolved','closed'].includes(t.status)).length} icon={CheckCircle2} color="green" sub="Đã xử lý / đóng"/></div>
            <div className="section-grid"><div className="dash-panel stretch"><div className="panel-header"><div><h3>Yêu cầu gần đây</h3><p>Cập nhật những yêu cầu mới nhất</p></div><button className="text-link" onClick={() => selectSection('tickets')}>Xem tất cả <ArrowRight size={16}/></button></div>
              <TicketTable tickets={tickets.slice(0, 6)} onOpen={openTicket}/></div>
              <div className="dash-panel activity-panel"><div className="panel-header"><div><h3>Thông báo gần đây</h3><p>Hoạt động từ hệ thống</p></div></div><div className="recent-notifications">{notifications.slice(0, 5).length ? notifications.slice(0, 5).map(n => <div className="recent-n" key={n.id}><div className="recent-n-icon">{n.type === "reminder" ? <AlarmClock size={17}/> : <Bell size={17}/>}</div><div><strong>{n.title}</strong><p>{n.message}</p><small>{dateFmt(n.createdAt)}</small></div></div>) : <EmptyState title="Chưa có thông báo" text="Thông báo sẽ hiển thị tại đây."/>}</div></div></div>
          </>}
          {section === 'tickets' && <div className="dash-panel list-panel">
            <div className="ticket-tabs" role="tablist" aria-label="Phân loại danh sách yêu cầu">
              <button type="button" role="tab" id="support-ticket-tab" aria-controls="ticket-list-panel"
                aria-selected={ticketTab === 'support'} className={'ticket-tab ' + (ticketTab === 'support' ? 'active' : '')}
                onClick={() => setTicketTab('support')}>
                <span className="ticket-tab-icon support"><Headphones size={19}/></span>
                <span className="ticket-tab-copy"><strong>Ticket Support</strong><small>Yêu cầu hỗ trợ IT</small></span>
                <span className="ticket-tab-total">{ticketCounts.support}</span>
              </button>
              <button type="button" role="tab" id="equipment-ticket-tab" aria-controls="ticket-list-panel"
                aria-selected={ticketTab === 'equipment'} className={'ticket-tab ' + (ticketTab === 'equipment' ? 'active' : '')}
                onClick={() => setTicketTab('equipment')}>
                <span className="ticket-tab-icon equipment"><Laptop size={19}/></span>
                <span className="ticket-tab-copy"><strong>Yêu cầu tài sản</strong><small>Máy tính, laptop, trang thiết bị</small></span>
                <span className="ticket-tab-total">{ticketCounts.equipment}</span>
              </button>
            </div>
            <div role="tabpanel" id="ticket-list-panel" aria-labelledby={ticketTab === 'support' ? 'support-ticket-tab' : 'equipment-ticket-tab'}>
              <div className="list-top"><div>
                <h3>{ticketTab === 'support' ? 'Danh sách ticket Support' : 'Danh sách yêu cầu tài sản'}</h3>
                <p>{filteredTickets.length} / {ticketCounts[ticketTab]} yêu cầu · Tìm kiếm và trạng thái được lưu riêng cho mỗi tab</p>
              </div><div className="list-controls">
                <div className="search-input"><Search size={17}/><input
                  aria-label={'Tìm kiếm ' + (ticketTab === 'support' ? 'ticket Support' : 'yêu cầu tài sản')}
                  placeholder="Tìm mã, tên, phòng ban..." value={activeTicketFilter.search}
                  onChange={e => setTicketSearch(e.target.value)}/></div>
                <div className="small-select"><ListFilter size={16}/><select
                  aria-label="Lọc trạng thái yêu cầu" value={activeTicketFilter.status}
                  onChange={e => setTicketStatus(e.target.value)}><option value="all">Tất cả trạng thái</option>
                  {Object.entries(STATUS).map(([key, data]) => <option key={key} value={key}>{data.label}</option>)}</select></div>
              </div></div>
              <TicketTable tickets={filteredTickets} onOpen={openTicket}/>
            </div>
          </div>}
          {section === 'assets' && <AssetManagement user={user} initialTicket={assetFromTicket} onClearInitialTicket={() => setAssetFromTicket(null)}/>}
          {section === 'reports' && <CompletionReport user={user}/>}
          {section === 'leaves' && !isManager && <LeavePlanner/>}
          {section === 'settings' && isManager && <><TicketModuleSettings enabled={ticketEnabled} onChanged={setTicketEnabled}/>{ticketEnabled && <RequesterModeSettings/>}</>}
          {section === 'requester_accounts' && isManager && <RequesterAccountManager/>}
          {section === 'notifications' && <div className="dash-panel notifications-panel"><div className="panel-header"><div><h3>Trung tâm thông báo</h3><p>{unread} thông báo chưa đọc</p></div></div>{notifications.length ? notifications.map(n => <button className={'notification-item ' + (!n.read ? 'unread ' : '') + (n.type === 'reminder' ? 'reminder' : '')} key={n.id} onClick={async () => {
            try { if (!n.read) { await api('/notifications/' + n.id + '/read', { method: 'PATCH' }); setNotifications(old => old.map(x => x.id === n.id ? { ...x, read: true } : x)); }
              const t = tickets.find(t => t.id === n.ticketId); if (t) openTicket(t);
            } catch (err) { setError(err.message); }
          }}><div className="notification-icon">{n.type === "reminder" ? <AlarmClock size={19}/> : <Bell size={19}/>}</div><div><strong>{n.title}</strong><p>{n.message}</p><small>{dateFmt(n.createdAt)}</small></div>{!n.read && <div className="unread-dot"/>}</button>) : <EmptyState icon={Bell} title="Bạn chưa có thông báo" text="Các yêu cầu và nhắc việc sẽ hiển thị tại đây."/>}</div>}
          {section === 'users' && <div className="dash-panel users-panel">
            <div className="panel-header"><div><h3>Danh sách tài khoản IT</h3><p>Quản lý Admin và nhân viên IT; tất cả Admin có quyền ngang nhau.</p></div></div>
            <div className="responsive-table"><table><thead><tr><th>Nhân viên</th><th>Vai trò</th><th>Ticket hoàn thành</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
              <tbody>{users.map(u => <tr key={u.uid}>
                <td><div className="user-cell"><div className="profile-avatar smaller">{shortName(u.name)}</div><div><strong>{u.name}</strong><span>{u.email}</span></div></div></td>
                <td>{u.role === 'manager' ? 'Admin' : 'Nhân viên IT'}</td>
                <td><strong>{u.completedTickets ?? 0}</strong> ticket</td>
                <td><span className={'active-tag ' + (!u.active ? 'inactive' : '')}><span/>{!u.active ? 'Tạm khóa' : isCurrentlyOnLeave(u) ? 'Đang nghỉ' : 'Hoạt động'}</span></td>
                <td><button className="btn muted small" onClick={() => setEditingUser(u)}><Settings2 size={15}/> Quản lý</button></td>
              </tr>)}</tbody>
            </table></div>
          </div>}
        </>}
      </div>
    </div>
    {current && <TicketModal ticket={current} role={user.role} onClose={() => setSelected(null)} onUpdate={onUpdated} onCreateAsset={ticket => { setSelected(null); setAssetFromTicket(ticket); selectSection('assets'); }} />}
    {showAddUser && <AddUserModal onClose={() => setShowAddUser(false)} onCreated={() => { setShowAddUser(false); refresh(true); }}/>}
    {editingUser && <EditUserModal user={editingUser} onClose={() => setEditingUser(null)} onSaved={() => { setEditingUser(null); refresh(true); }}/>}
    {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)}/>}
  </div>;
}
function Stat({ label, value, icon: Icon, color, sub }) { return <div className="stat-card"><div className={'stat-icon ' + color}><Icon size={22}/></div><span className="stat-label">{label}</span><strong>{value}</strong><span className="stat-sub">{sub}</span></div>; }
function TicketTable({ tickets, onOpen }) {
  return tickets.length ? <div className="responsive-table"><table className="ticket-table"><thead><tr><th>MÃ YÊU CẦU</th><th>NỘI DUNG</th><th>NGƯỜI GỬI</th><th>NGƯỜI HOÀN THÀNH</th><th>TRẠNG THÁI</th><th>ĐÁNH GIÁ</th><th>THỜI GIAN</th><th></th></tr></thead><tbody>{tickets.map(t => <tr key={t.id} onClick={() => onOpen(t)} className="clickable-row"><td><strong className="ticket-code">{t.code}</strong></td><td><div className="ticket-desc"><strong>{t.subject}</strong><span>{labelType(t.type)}</span></div></td><td><div className="requester-cell"><strong>{t.requesterName}</strong><span>{t.department}</span></div></td><td>{t.completedByName ? <span className="assigned"><span className="assigned-avatar">{shortName(t.completedByName)}</span>{t.completedByName}</span> : <span className="unassigned">Chưa hoàn thành</span>}</td><td><StatusPill status={t.status}/></td><td><TicketRating rating={t.requesterRating} compact/></td><td><span className="date-cell">{formatShortDate(t.createdAt)}</span></td><td><ChevronRight size={17} className="table-arrow"/></td></tr>)}</tbody></table></div> : <EmptyState icon={ClipboardList} title="Chưa có yêu cầu" text="Không tìm thấy yêu cầu phù hợp."/>;
}
function TicketModal({ ticket, role, onClose, onUpdate, onCreateAsset }) {
  const [status, setStatus] = useState(ticket.status);
  const [comment, setComment] = useState('');
  const [requesterMode, setRequesterMode] = useState(false);
  const [activities, setActivities] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const loadActivity = useCallback(() => api('/tickets/' + ticket.id + '/activities').then(setActivities).catch(err => setError(err.message)), [ticket.id]);
  useEffect(() => { setStatus(ticket.status); }, [ticket.id, ticket.status]);
  useEffect(() => { if (ticket.requesterUid) api('/public/settings',{authRequired:false})
    .then(v => setRequesterMode(v.requesterWorkflowEnabled === true)).catch(() => {}); }, [ticket.requesterUid]);
  useEffect(() => {
    loadActivity();
    const activityQuery = query(ref(realtimeDb, `activities/${ticket.id}`), orderByChild('createdAt'), limitToLast(150));
    return onValue(activityQuery, snap => setActivities(realtimeList(snap.val()).reverse()),
      err => setError('Không nhận được lịch sử trực tiếp: ' + err.message));
  }, [ticket.id, loadActivity]);
  const apply = async (action, successMessage='Thao tác đã lưu thành công.') => { setBusy(true); setError(''); setNotice(''); try { await action(); await onUpdate(); await loadActivity(); setNotice(successMessage); } catch (err) { setError(err.message); } finally { setBusy(false); } };
  const saveStatus = () => apply(() => api('/tickets/' + ticket.id + '/status', { method: 'PATCH', body: { status } }), `Đã cập nhật trạng thái thành “${STATUS[status]?.label || status}”.`);
  const finishTicket = () => apply(() => api('/tickets/' + ticket.id + '/status', { method:'PATCH', body:{status:'resolved'} }), 'Đã hoàn thành ticket và ghi nhận nhân viên xử lý.');
  const saveNote = () => apply(async () => { await api('/tickets/' + ticket.id + '/comments', { method: 'POST', body: { comment } }); setComment(''); },'Đã thêm ghi chú vào lịch sử.');
  return <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div className="modal ticket-modal"><div className="modal-head"><div><span className="eyebrow dark">CHI TIẾT YÊU CẦU</span><h2>{ticket.code}</h2></div><button className="modal-close" onClick={onClose}><X size={22}/></button></div>
    <div className="modal-body"><div className="detail-header"><TypePill type={ticket.type}/><StatusPill status={ticket.status}/>
      {Number.isInteger(Number(ticket.requesterRating)) && Number(ticket.requesterRating) >= 1 && Number(ticket.requesterRating) <= 5 &&
        <TicketRating rating={ticket.requesterRating}/>}</div><h3 className="ticket-detail-title">{ticket.subject}</h3><p className="detail-description">{ticket.description}</p>
      <div className="detail-grid"><Detail label="Người yêu cầu" value={ticket.requesterName}/><Detail label="Phòng ban" value={ticket.department}/><Detail label="Chức vụ" value={ticket.position}/><Detail label="Liên hệ" value={ticket.contact}/><Detail label="Email" value={ticket.email || '—'}/><Detail label="Ngày tạo" value={dateFmt(ticket.createdAt)}/><Detail label="Nhắc việc" value={["resolved", "closed"].includes(ticket.status) ? "Đã dừng" : (ticket.type === "support" ? "Mỗi 30 phút" : "Mỗi 12 giờ")}/><Detail label="Nhắc tiếp theo" value={["resolved", "closed"].includes(ticket.status) ? "—" : dateFmt(ticket.nextReminderAt)}/><Detail label="Hoàn thành" value={dateFmt(ticket.completedAt)}/><Detail label="Người hoàn thành" value={ticket.completedByName || 'Chưa có'}/>
        {ticket.requesterRating && <><Detail label="Đánh giá từ người yêu cầu" value={<TicketRating rating={ticket.requesterRating}/>}/>
          <Detail label="Ngày đánh giá" value={dateFmt(ticket.ratedAt || ticket.requesterConfirmedAt)}/></>}{ticket.type === 'equipment' && <><Detail label="Tên thiết bị" value={ticket.itemName}/><Detail label="Số lượng" value={ticket.quantity}/></>}</div>
      {ticket.requesterRating && ticket.requesterReview &&
        <div className="ticket-review"><strong>Nhận xét của người yêu cầu</strong><p>{ticket.requesterReview}</p></div>}
      {ticket.type === 'equipment' && <div className="detail-actions"><h4>Liên kết quản lý tài sản</h4><p className="help-text">Có thể tạo hồ sơ tài sản từ phiếu này. Ticket vẫn giữ quy trình xử lý riêng.</p><button className="btn muted small" onClick={() => onCreateAsset(ticket)}><Boxes size={16}/> Tạo tài sản từ yêu cầu</button></div>}
      <div className="detail-actions"><h4>Quy trình xử lý</h4>
      <p className="help-text">Hàng chờ dùng chung: tất cả nhân viên IT đều nhìn thấy ticket này. Người bấm Hoàn thành đầu tiên sẽ được ghi nhận.</p>
      {ticket.completedByName && <p className="success-text"><CheckCircle2 size={16}/> Đã hoàn thành bởi {ticket.completedByName}</p>}
      {requesterMode && ticket.requesterUid && ticket.status === 'resolved' && <p className="help-text">Đang chờ người yêu cầu đánh giá, xác nhận hoàn thành và đóng ticket.</p>}
      <div className="action-block"><label>Cập nhật trạng thái</label><div className="inline-action"><select value={status} onChange={e => setStatus(e.target.value)}>{Object.entries(STATUS).filter(([k]) => !(k === 'closed' && requesterMode && ticket.requesterUid && ticket.status !== 'closed')).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}</select><button className="btn primary small" disabled={busy || status === ticket.status} onClick={saveStatus}>Cập nhật</button></div></div>
      {['new','in_progress','on_hold'].includes(ticket.status) && <div className="action-block"><button className="btn primary small" disabled={busy} onClick={finishTicket}><CheckCircle2 size={16}/> Hoàn thành ticket</button><span className="help-text">Hệ thống ghi nhận tài khoản đang đăng nhập là người hoàn thành.</span></div>}
      </div><div className="detail-actions"><h4>Ghi chú nội bộ</h4><textarea className="note-input" placeholder="Thêm ghi chú về quá trình xử lý..." rows={3} value={comment} onChange={e => setComment(e.target.value)} maxLength={2000}/><div className="note-action"><button className="btn muted small" disabled={busy || !comment.trim()} onClick={saveNote}><MessageSquareText size={15}/> Thêm ghi chú</button></div></div>
      {notice&&<div className="ticket-success-notice" role="status"><CheckCircle2 size={17}/>{notice}</div>}
      <div className="detail-actions"><h4>Lịch sử hoạt động</h4><div className="timeline">{activities.map(a => <div key={a.id} className="timeline-row"><span className="timeline-bullet"/><div><strong>{a.actorName}</strong><p>{a.detail}</p><small>{dateFmt(a.createdAt)}</small></div></div>)}</div></div><Alert message={error} onClose={() => setError('')}/>
    </div></div></div>;
}
function Detail({ label, value }) { return <div className="detail-data"><span>{label}</span><strong>{value}</strong></div>; }
function AddUserModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('agent');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async e => {
    e.preventDefault(); setBusy(true); setError('');
    try { await api('/users', { method: 'POST', body: { name, email, password, role } }); onCreated(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  return <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="modal add-user-modal">
      <div className="modal-head"><div><span className="eyebrow dark">QUẢN TRỊ TÀI KHOẢN</span><h2>Thêm tài khoản IT</h2></div><button onClick={onClose} className="modal-close"><X size={22}/></button></div>
      <form className="modal-body" onSubmit={submit}>
        <p>Chọn quyền Admin để tài khoản có quyền quản trị như Admin hiện tại.</p>
        <Field label="Họ và tên" required icon={UserRound} value={name} onChange={setName} placeholder="Nguyễn Văn B"/>
        <Field label="Email đăng nhập" required icon={Mail} type="email" value={email} onChange={setEmail} placeholder="it01@hexa.vn"/>
        <label className="field"><span>Vai trò tài khoản</span>
          <select className="role-select" value={role} onChange={e => setRole(e.target.value)}>
            <option value="agent">Nhân viên IT</option>
            <option value="manager">Admin — toàn quyền quản trị</option>
          </select>
        </label>
        {role === 'manager' && <p className="help-text">Admin mới có thể quản lý tài khoản IT khác, bao gồm cả Admin, và đặt lại mật khẩu của họ. Chỉ cấp quyền cho người tin cậy.</p>}
        <Field label="Mật khẩu ban đầu (ít nhất 8 ký tự)" required icon={LockKeyhole} type="password" value={password} onChange={setPassword}/>
        <p className="help-text">Mật khẩu được quản lý bởi Firebase Authentication, không lưu trong Realtime Database.</p>
        <Alert message={error} onClose={() => setError('')}/>
        <button type="submit" className="btn primary full" disabled={busy}>{busy ? 'Đang tạo...' : 'Tạo tài khoản'}</button>
      </form>
    </div>
  </div>;
}

function EditUserModal({ user, onClose, onSaved }) {
  const [name, setName] = useState(user.name || '');
  const [email, setEmail] = useState(user.email || '');
  const [role, setRole] = useState(user.role || 'agent');
  const [active, setActive] = useState(user.active === true);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const isSelf = user.uid === auth.currentUser?.uid;
  const run = async (action, close = true) => {
    setBusy(true); setError(''); setNotice('');
    try {
      await action();
      if (close) onSaved();
      else { setPassword(''); setNotice('Đã đặt mật khẩu mới. Tài khoản này cần đăng nhập lại.'); }
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const save = e => {
    e.preventDefault();
    run(() => api(`/users/${user.uid}`, { method: 'PATCH', body: { name, email, role, active } }));
  };
  const resetPassword = () => {
    if (password.length < 8 || password.length > 128) return setError('Mật khẩu phải có từ 8 đến 128 ký tự.');
    if (window.confirm(`Đặt lại mật khẩu cho ${user.name}? Người này sẽ cần đăng nhập lại.`)) {
      run(() => api(`/users/${user.uid}/password`, { method: 'PATCH', body: { password } }), false);
    }
  };
  const deleteUser = () => {
    if (window.confirm(`XÓA VĨNH VIỄN tài khoản ${user.name}? Ticket và lịch sử vẫn được giữ lại.`)) {
      run(() => api(`/users/${user.uid}`, { method: 'DELETE' }));
    }
  };
  return <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="modal add-user-modal">
      <div className="modal-head"><div><span className="eyebrow dark">QUẢN LÝ TÀI KHOẢN IT</span><h2>{user.role === 'manager' ? 'Chỉnh sửa Admin' : 'Chỉnh sửa nhân viên IT'}</h2></div><button className="modal-close" onClick={onClose} aria-label="Đóng"><X size={22}/></button></div>
      <div className="modal-body">
        <form onSubmit={save}>
          <Field label="Họ và tên" required icon={UserRound} value={name} onChange={setName}/>
          <Field label="Email đăng nhập" required type="email" icon={Mail} value={email} onChange={setEmail}/>
          <label className="field"><span>Quyền tài khoản</span>
            <select className="role-select" value={role} disabled={isSelf} onChange={e => setRole(e.target.value)}>
              <option value="agent">Nhân viên IT</option>
              <option value="manager">Admin — toàn quyền quản trị</option>
            </select>
          </label>
          <label className="toggle-row"><input type="checkbox" checked={active} disabled={isSelf} onChange={e => setActive(e.target.checked)}/><span>Tài khoản đang hoạt động</span></label>
          {isSelf && <p className="help-text">Bạn không thể tự khóa/hạ quyền/xóa tài khoản đang đăng nhập. Bạn vẫn có thể đổi tên và email.</p>}
          <p className="help-text">Không thể khóa, xóa hoặc hạ quyền Admin cuối cùng. Hãy giao lại ticket đang mở trước khi khóa nhân viên.</p>
          <button type="submit" className="btn primary full" disabled={busy}>{busy ? 'Đang lưu...' : 'Lưu thay đổi'}</button>
        </form>
        <div className="modal-separator"/>
        <strong className="form-group-title">{isSelf ? 'Đổi mật khẩu của bạn' : 'Admin đặt lại mật khẩu tài khoản này'}</strong>
        {isSelf ? <p className="help-text">Sử dụng biểu tượng ổ khóa trên thanh trên cùng để tự đổi mật khẩu (cần mật khẩu hiện tại).</p> : <>
          <Field label="Mật khẩu mới (ít nhất 8 ký tự)" type="password" icon={LockKeyhole} value={password} onChange={setPassword}/>
          <button type="button" className="btn muted full" disabled={busy || !password} onClick={resetPassword}><LockKeyhole size={16}/> Đặt lại mật khẩu</button>
        </>}
        {user.passwordChangedAt && <p className="help-text">Lần quản trị mật khẩu ghi nhận: {dateFmt(user.passwordChangedAt)}</p>}
        <p className="help-text">Không hiển thị hoặc lưu mật khẩu gốc. Mật khẩu được bảo vệ bởi Firebase Authentication.</p>
        {notice && <p className="success-text"><CheckCircle2 size={16}/>{notice}</p>}
        <Alert message={error} onClose={() => setError('')}/>
        {!isSelf && <><div className="modal-separator"/>
          <button className="btn danger full" disabled={busy} onClick={deleteUser}><X size={16}/> Xóa vĩnh viễn tài khoản</button>
        </>}
      </div>
    </div>
  </div>;
}

function ChangePasswordModal({ onClose }) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [changed, setChanged] = useState(false);
  const submit = async e => {
    e.preventDefault(); setError('');
    if (newPassword.length < 8 || newPassword.length > 128) return setError('Mật khẩu mới phải có từ 8 đến 128 ký tự.');
    if (newPassword !== confirmPassword) return setError('Mật khẩu xác nhận không trùng khớp.');
    if (oldPassword === newPassword) return setError('Hãy chọn mật khẩu mới khác mật khẩu cũ.');
    setBusy(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser?.email) throw new Error('Bạn chưa đăng nhập.');
      const credential = EmailAuthProvider.credential(currentUser.email, oldPassword);
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, newPassword);
      setOldPassword(''); setNewPassword(''); setConfirmPassword(''); setChanged(true);
    } catch (err) {
      setError(['auth/invalid-credential','auth/wrong-password'].includes(err.code)
        ? 'Mật khẩu hiện tại chưa chính xác.' : (err.message || 'Không thể đổi mật khẩu.'));
    } finally { setBusy(false); }
  };
  return <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="modal add-user-modal">
      <div className="modal-head"><div><span className="eyebrow dark">BẢO MẬT TÀI KHOẢN</span><h2>Đổi mật khẩu của tôi</h2></div><button className="modal-close" onClick={onClose} aria-label="Đóng"><X size={22}/></button></div>
      <form className="modal-body" onSubmit={submit}>
        {changed ? <><p className="success-text"><CheckCircle2 size={18}/> Đổi mật khẩu thành công!</p><button type="button" className="btn primary full" onClick={onClose}>Hoàn tất</button></> : <>
          <Field label="Mật khẩu hiện tại" required type="password" icon={LockKeyhole} value={oldPassword} onChange={setOldPassword}/>
          <Field label="Mật khẩu mới" required type="password" icon={LockKeyhole} value={newPassword} onChange={setNewPassword}/>
          <Field label="Nhập lại mật khẩu mới" required type="password" icon={LockKeyhole} value={confirmPassword} onChange={setConfirmPassword}/>
          <Alert message={error} onClose={() => setError('')}/>
          <button className="btn primary full" type="submit" disabled={busy}>{busy ? 'Đang cập nhật...' : 'Xác nhận đổi mật khẩu'}</button>
        </>}
      </form>
    </div>
  </div>;
}

function currentVietnamDate() {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone:'Asia/Ho_Chi_Minh',
    year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(new Date());
  const get = key => p.find(x => x.type === key)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
function isCurrentlyOnLeave(u) {
  const day = currentVietnamDate();
  return Object.values(u?.leavePeriods || {}).some(x => x?.startDate <= day && x?.endDate >= day);
}
function LeavePlanner() {
  const [leaves, setLeaves] = useState([]);
  const [startDate, setStartDate] = useState(currentVietnamDate());
  const [endDate, setEndDate] = useState(currentVietnamDate());
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = () => api('/me/leaves').then(setLeaves).catch(err => setError(err.message));
  useEffect(() => { load(); }, []);
  const submit = async e => {
    e.preventDefault(); setBusy(true); setError('');
    try { await api('/me/leaves',{method:'POST',body:{startDate,endDate,note}});
      setNote(''); await load(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const remove = async id => {
    if (!window.confirm('Hủy đăng ký nghỉ này?')) return;
    setBusy(true); setError('');
    try { await api('/me/leaves/' + id,{method:'DELETE'}); await load(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return <div className="dash-panel leave-panel"><div className="panel-header"><div>
    <h3>Ngày nghỉ của tôi</h3><p>Lịch nghỉ giúp bộ phận IT chủ động sắp xếp người xử lý. Ticket vẫn hiển thị trong hàng chờ chung, không có bước phân công tự động.</p></div></div>
    <form onSubmit={submit} className="leave-form">
      <label>Từ ngày<input type="date" min={currentVietnamDate()} value={startDate} onChange={e => {setStartDate(e.target.value); if (e.target.value > endDate) setEndDate(e.target.value);}} required/></label>
      <label>Đến ngày<input type="date" min={startDate} value={endDate} onChange={e => setEndDate(e.target.value)} required/></label>
      <label>Lý do (không bắt buộc)<input maxLength={300} value={note} placeholder="Nghỉ phép / công tác..." onChange={e => setNote(e.target.value)}/></label>
      <button type="submit" className="btn primary small" disabled={busy}><Plus size={16}/> Đăng ký nghỉ</button>
    </form><Alert message={error} onClose={() => setError('')}/>
    <div className="leave-records">{!leaves.length ? <EmptyState icon={CalendarOff} title="Chưa có ngày nghỉ" text="Đăng ký lịch nghỉ để bộ phận IT biết thời gian bạn vắng mặt."/> : leaves.map(leave =>
      <div className="leave-record" key={leave.id}><span><CalendarDays size={17}/> <strong>{leave.startDate} → {leave.endDate}</strong><small>{leave.note || 'Ngày nghỉ'}</small></span>
        <button className="btn muted small" disabled={busy} onClick={() => remove(leave.id)}><X size={15}/> Hủy lịch</button></div>)}</div>
  </div>;
}
// Accounts used by employees submitting requests (separate from IT agent accounts).
// Firebase only exposes account emails and metadata; it never reveals existing passwords.
function RequesterAccountManager() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setAccounts(await api('/requesters')); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const saved = () => { setEditing(null); setShowCreate(false); load(); };
  return <div className="dash-panel users-panel">
    <div className="panel-header requester-accounts-header">
      <div><h3>Tài khoản người gửi yêu cầu</h3>
        <p>Quản lý email, hồ sơ, trạng thái và đặt lại mật khẩu người gửi. Không thể xem mật khẩu hiện tại.</p></div>
      <div className="requester-account-actions">
        <button className="btn muted small" onClick={load}><RefreshCw size={16}/> Làm mới</button>
        <button className="btn primary small" onClick={() => setShowCreate(true)}><UserRoundPlus size={16}/> Thêm tài khoản</button>
      </div>
    </div>
    <Alert message={error} onClose={() => setError('')}/>
    {loading ? <Spinner/> : accounts.length === 0
      ? <EmptyState icon={UserRoundPlus} title="Chưa có tài khoản người yêu cầu" text="Admin có thể tạo sẵn tài khoản, hoặc người dùng đăng ký khi bật chế độ này."/>
      : <div className="responsive-table"><table><thead><tr>
          <th>Họ tên / Email</th><th>Phòng ban / Chức vụ</th><th>Liên hệ</th><th>Trạng thái</th><th>Ngày tạo</th><th>Thao tác</th>
        </tr></thead><tbody>{accounts.map(person => <tr key={person.uid}>
          <td><div className="user-cell"><div className="profile-avatar smaller">{shortName(person.name)}</div>
            <div><strong>{person.name}</strong><span>{person.email}</span>
            <span>{person.jobLevel==='manager' && person.jobLevelApproved===true ? 'Quản lý (đã xác minh)' : person.requestedJobLevel==='manager' ? 'Đề nghị Quản lý — chờ duyệt' : 'Nhân viên'}</span></div></div></td>
          <td><strong>{person.department}</strong><div className="muted-value">{person.position}</div></td>
          <td>{person.contact}</td>
          <td><span className={'active-tag ' + (person.active === false ? 'inactive' : '')}>
            <span/>{person.active === false ? 'Đã khóa' : 'Hoạt động'}</span></td>
          <td>{dateFmt(person.createdAt)}</td>
          <td><button className="btn muted small" onClick={() => setEditing(person)}><Settings2 size={15}/> Sửa / Xóa</button></td>
        </tr>)}</tbody></table></div>}
    {showCreate && <RequesterAccountModal onClose={() => setShowCreate(false)} onSaved={saved}/>}
    {editing && <RequesterAccountModal account={editing} onClose={() => setEditing(null)} onSaved={saved}/>}
  </div>;
}

function RequesterAccountModal({ account = null, onClose, onSaved }) {
  const editing = Boolean(account);
  const [form, setForm] = useState({ name: account?.name || '', email: account?.email || '',
    department: account?.department || '', position: account?.position || '', contact: account?.contact || '',
    active: account?.active !== false, jobLevel: account?.jobLevel || 'employee', password: '' });
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const set = (key, value) => setForm(old => ({ ...old, [key]: value }));
  const update = async e => {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      if (editing) {
        await api(`/requesters/${account.uid}`, { method: 'PATCH', body: {
          name: form.name, email: form.email, department: form.department, position: form.position,
          contact: form.contact, active: form.active, jobLevel: form.jobLevel
        }});
      } else {
        if (form.password.length < 8 || form.password.length > 128) throw new Error('Mật khẩu phải có từ 8 đến 128 ký tự.');
        await api('/requesters', { method: 'POST', body: form });
      }
      onSaved();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const reset = async () => {
    if (newPassword.length < 8 || newPassword.length > 128) return setError('Mật khẩu phải có từ 8 đến 128 ký tự.');
    if (!window.confirm('Đặt mật khẩu MỚI cho tài khoản này?')) return;
    setBusy(true); setError(''); setNotice('');
    try { await api(`/requesters/${account.uid}/password`, { method: 'PATCH', body: { password: newPassword } });
      setNewPassword(''); setNotice('Đã đặt lại mật khẩu thành công. Hãy chuyển mật khẩu mới cho người dùng qua kênh an toàn.'); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!window.confirm(`Xóa vĩnh viễn tài khoản ${account.email}? Các ticket cũ vẫn được giữ lại.`)) return;
    setBusy(true); setError('');
    try { await api(`/requesters/${account.uid}`, { method: 'DELETE' }); onSaved(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  return <div className="modal-overlay" onMouseDown={e => { if (e.currentTarget === e.target) onClose(); }}>
    <div className="modal add-user-modal">
      <div className="modal-head"><div><span className="eyebrow dark">QUẢN LÝ NGƯỜI YÊU CẦU</span>
        <h2>{editing ? 'Sửa tài khoản người yêu cầu' : 'Thêm tài khoản người yêu cầu'}</h2></div>
        <button className="modal-close" onClick={onClose} aria-label="Đóng"><X size={22}/></button></div>
      <div className="modal-body">
        <form onSubmit={update} className="requester-admin-form">
          <Field label="Họ và tên" required icon={UserRound} value={form.name} onChange={v => set('name', v)}/>
          <Field label="Email đăng nhập" required type="email" icon={Mail} value={form.email} onChange={v => set('email', v)}/>
          <Field label="Phòng ban" required icon={Building2} value={form.department} onChange={v => set('department', v)}/>
          <Field label="Chức vụ" required icon={BriefcaseBusiness} value={form.position} onChange={v => set('position', v)}/>
          <label className="requester-level-control">Cấp bậc đã xác minh (Admin cấp quyền)
            <select value={form.jobLevel} onChange={e=>set('jobLevel',e.target.value)}>
              <option value="employee">Nhân viên</option>
              <option value="manager">Quản lý trở lên</option>
            </select>
            {account?.requestedJobLevel==='manager' && !account?.jobLevelApproved && <small>Người dùng đang đề nghị quyền Quản lý. Chỉ phê duyệt nếu đã kiểm tra chức danh thực tế.</small>}
          </label>
          <Field label="Số liên hệ" required icon={Phone} value={form.contact} onChange={v => set('contact', v)}/>
          {!editing && <Field label="Mật khẩu ban đầu (ít nhất 8 ký tự)" required type="password" icon={LockKeyhole}
            value={form.password} onChange={v => set('password', v)}/>}
          {editing && <label className="toggle-row"><input type="checkbox" checked={form.active}
            onChange={e => set('active', e.target.checked)}/><span>Tài khoản hoạt động</span></label>}
          <button className="btn primary full" disabled={busy}>{busy ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Tạo tài khoản'}</button>
        </form>
        {editing && <>
          <div className="modal-separator"/>
          <strong className="form-group-title">Đặt lại mật khẩu</strong>
          <p className="help-text">Firebase không cho xem mật khẩu hiện tại. Admin có thể tạo mật khẩu mới thay thế.</p>
          <Field label="Mật khẩu mới" type="password" icon={LockKeyhole} value={newPassword} onChange={setNewPassword}/>
          <button type="button" className="btn muted full" disabled={busy || !newPassword} onClick={reset}>
            <LockKeyhole size={16}/> Đặt lại mật khẩu</button>
          <div className="modal-separator"/>
          <button type="button" className="btn danger full" disabled={busy} onClick={remove}>
            <X size={16}/> Xóa vĩnh viễn tài khoản</button>
        </>}
        {notice && <p className="success-text"><CheckCircle2 size={16}/>{notice}</p>}
        <Alert message={error} onClose={() => setError('')}/>
      </div>
    </div>
  </div>;
}

function TicketModuleSettings({ enabled, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const toggle = async () => {
    const next = !enabled;
    if (!next && !window.confirm('Tạm tắt Ticket? Người dùng sẽ không gửi yêu cầu mới và các thông báo nhắc việc sẽ tạm dừng. Dữ liệu cũ vẫn được giữ.')) return;
    setBusy(true); setError(''); setSuccess('');
    try {
      const data = await api('/settings', { method: 'PATCH', body: { ticketEnabled: next } });
      onChanged(data.ticketEnabled !== false);
      setSuccess(next ? 'Đã bật lại Ticket. Nhân viên có thể tiếp tục gửi yêu cầu.' : 'Đã tạm tắt Ticket. Quản lý tài sản vẫn hoạt động.');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  return <div className="dash-panel requester-settings ticket-module-settings" style={{marginBottom:20}}>
    <div className="panel-header"><div><h3>Bật / tắt phân hệ Ticket</h3>
      <p>Chỉ Admin được thay đổi. Dữ liệu ticket đã tạo sẽ không bị xóa.</p></div></div>
    <Alert message={error} onClose={() => setError('')}/>
    {success && <div className="settings-guide"><CheckCircle2 size={18}/>{success}</div>}
    <div className="settings-toggle-row"><div><strong>Cổng yêu cầu và quản lý Ticket</strong>
      <p>Bật: Có cổng gửi yêu cầu, danh sách Ticket, thống kê và thông báo. Tắt: Ẩn các mục Ticket, chặn tạo/cập nhật yêu cầu và tạm dừng nhắc việc; vẫn sử dụng Quản lý tài sản bình thường.</p></div>
      <button type="button" role="switch" aria-label="Bật hoặc tắt Ticket" aria-checked={enabled}
        className={'mode-toggle ' + (enabled ? 'on' : '')} disabled={busy} onClick={toggle}>
        <span/>{busy ? 'ĐANG LƯU' : enabled ? 'ĐANG BẬT' : 'ĐANG TẮT'}
      </button></div>
  </div>;
}

function RequesterModeSettings() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { api('/settings').then(v => setEnabled(v.requesterWorkflowEnabled === true))
    .catch(err => setError(err.message)).finally(() => setLoading(false)); }, []);
  const toggle = async () => {
    const next = !enabled;
    if (next && !window.confirm('Bật yêu cầu đăng nhập? Từ giờ người gửi phải có tài khoản và chỉ người gửi mới xác nhận đóng ticket mới.')) return;
    setBusy(true); setError('');
    try { const data = await api('/settings',{ method:'PATCH', body:{requesterWorkflowEnabled:next} });
      setEnabled(data.requesterWorkflowEnabled); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return <div className="dash-panel requester-settings"><div className="panel-header"><div><h3>Cổng người yêu cầu có tài khoản</h3>
    <p>Cấu hình này chỉ Admin được thay đổi. Mặc định TẮT để nhân viên toàn công ty vẫn gửi ticket không cần đăng nhập.</p></div></div>
    <Alert message={error} onClose={() => setError('')}/>
    {loading ? <Spinner/> : <>
      <div className="settings-toggle-row"><div><strong>Yêu cầu đăng nhập + Đánh giá + Xác nhận hoàn thành</strong>
        <p>Bật: Người gửi đăng ký email/mật khẩu (không xác minh email), theo dõi ticket, đánh giá 1–5 sao sau khi IT đánh dấu Đã xử lý và tự xác nhận đóng. Tắt: giữ quy trình gửi tự do như hiện tại.</p></div>
        <button type="button" role="switch" aria-checked={enabled} className={'mode-toggle '+(enabled?'on':'')}
          disabled={busy} onClick={toggle}><span/>{enabled?'ĐANG BẬT':'ĐANG TẮT'}</button></div>
      <div className="settings-guide"><ShieldCheck size={18}/>{enabled ? 'Đã bật: các yêu cầu mới cần có tài khoản. Các yêu cầu cũ không có tài khoản vẫn có thể được IT đóng.' :
        'Đang tắt: người dùng tiếp tục gửi ticket mà không cần tài khoản. Đánh giá và xác nhận đóng của người gửi chưa được kích hoạt.'}</div>
    </>}
  </div>;
}

function CompletionReport({ user }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const loadReport = useCallback(async () => {
    setLoading(true); setError('');
    try { setReport(await api(`/reports/completions?year=${year}&month=${month}`)); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [year, month]);
  useEffect(() => { loadReport(); }, [loadReport]);
  const exportCsv = () => {
    if (!report) return;
    const headings = ['Nhân viên', 'Email', `Hoàn thành tháng ${month}`, 'IT tháng', 'Tài sản tháng', `Hoàn thành năm ${year}`, 'IT năm', 'Tài sản năm',
      'Phiếu đánh giá tháng', 'Trung bình sao tháng', 'Phiếu đánh giá năm', 'Trung bình sao năm', 'Tổng phiếu đánh giá', 'Trung bình sao toàn thời gian'];
    const rows = [headings, ...report.employees.map(row => [row.name, row.email, row.monthCompleted,
      row.monthSupport, row.monthEquipment, row.yearCompleted, row.yearSupport, row.yearEquipment,
      row.ratingMonth.tickets, row.ratingMonth.average ?? '', row.ratingYear.tickets,
      row.ratingYear.average ?? '', row.ratingAll.tickets, row.ratingAll.average ?? ''])];
    const safe = value => {
      let str = String(value ?? '');
      if (/^[=+@-]/.test(str)) str = "'" + str; // Avoid CSV formula injection.
      return '"' + str.replace(/"/g, '""') + '"';
    };
    const csv = '\ufeff' + rows.map(row => row.map(safe).join(',')).join('\r\n');
    const href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = href; link.download = `HEXA-ThongKe-${year}-${String(month).padStart(2, '0')}.csv`;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  };
  const maxCompleted = Math.max(1, ...(Array.isArray(report?.months) ? report.months : []).map(row => row.completed));
  const years = Array.from({ length: 8 }, (_, i) => today.getFullYear() - i);
  return <div className="reports-view">
    <div className="report-toolbar dash-panel">
      <div><h3>Báo cáo hiệu suất hoàn thành</h3><p>Đếm ticket đã xử lý/đóng theo nhân viên; một ticket chỉ được tính một lần.</p></div>
      <div className="report-filters"><label>Tháng<select value={month} onChange={e => setMonth(Number(e.target.value))}>{Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>Tháng {i + 1}</option>)}</select></label>
        <label>Năm<select value={year} onChange={e => setYear(Number(e.target.value))}>{years.map(y => <option value={y} key={y}>{y}</option>)}</select></label>
        <button className="btn muted small" onClick={loadReport}><RefreshCw size={15}/> Làm mới</button><button className="btn muted small" disabled={!report} onClick={exportCsv}><FileText size={15}/> Xuất CSV</button>
      </div>
    </div>
    <Alert message={error} onClose={() => setError('')}/>
    {loading ? <Spinner label="Đang tổng hợp báo cáo..."/> : report && <>
      <div className="report-summary">
        <Stat label={`Hoàn thành tháng ${month}`} value={report.total.month} icon={CheckCircle2} color="green" sub="Ticket hoàn thành trong tháng"/>
        <Stat label={`Hoàn thành năm ${year}`} value={report.total.year} icon={BarChart3} color="blue" sub="Ticket hoàn thành cả năm"/>
        <Stat label="Nhân sự được thống kê" value={report.employees.length} icon={UsersRound} color="purple" sub={user.role === 'manager' ? 'Toàn bộ nhân sự IT' : 'Dữ liệu của bạn'}/>
      </div>
      <div className="dash-panel report-chart"><div className="panel-header"><div><h3>Ticket hoàn thành theo tháng · {year}</h3><p>Dữ liệu theo múi giờ Việt Nam (UTC+7)</p></div></div>
        <div className="report-bars">{report.months.map(m => <div key={m.month} className="report-bar-col" title={`Tháng ${m.month}: ${m.completed} ticket`}>
          <span>{m.completed}</span><div className="report-bar-track"><div className="report-bar-fill" style={{ height: `${m.completed / maxCompleted * 100}%` }}/></div><small>T{m.month}</small>
        </div>)}</div>
      </div>
      <div className="dash-panel rating-report-panel">
        <div className="panel-header"><div><h3>Đánh giá chất lượng hỗ trợ</h3>
          <p>Điểm trung bình = tổng số sao / số ticket được đánh giá. Ticket chưa đánh giá không tham gia phép tính; tháng/năm tính theo ngày đánh giá.</p></div></div>
        <div className="rating-summary-grid">
          {[['Tháng ' + month, report.ratingTotals.month], ['Năm ' + year, report.ratingTotals.year], ['Tất cả thời gian', report.ratingTotals.all]].map(([label, stats]) =>
            <div className="rating-summary-item" key={label}><small>{label}</small>
              <strong>{stats.average === null ? 'Chưa có đánh giá' : <><Star size={19} fill="currentColor"/> {stats.average.toFixed(2)}/5</>}</strong>
              <span>{stats.tickets} ticket được đánh giá</span></div>)}
        </div>
        <div className="responsive-table"><table className="report-table"><thead><tr>
          <th>Nhân viên IT</th><th>Đánh giá tháng</th><th>Trung bình tháng</th>
          <th>Đánh giá năm</th><th>Trung bình năm</th><th>Tổng được đánh giá</th><th>Trung bình chung</th>
        </tr></thead><tbody>{report.employees.map(row => <tr key={row.uid}>
          <td><strong>{row.name}</strong></td>
          <td>{row.ratingMonth.tickets}</td><td>{row.ratingMonth.average === null ? '—' : `${row.ratingMonth.average.toFixed(2)}/5 ⭐`}</td>
          <td>{row.ratingYear.tickets}</td><td>{row.ratingYear.average === null ? '—' : `${row.ratingYear.average.toFixed(2)}/5 ⭐`}</td>
          <td><strong>{row.ratingAll.tickets}</strong></td>
          <td><strong>{row.ratingAll.average === null ? '—' : `${row.ratingAll.average.toFixed(2)}/5 ⭐`}</strong></td>
        </tr>)}</tbody></table></div>
        <p className="rating-report-note">Chưa có đánh giá thì hiển thị —, không phải 0 sao. Đánh giá được ghi cho người hoàn thành ticket.</p>
      </div>
      <div className="dash-panel"><div className="panel-header"><div><h3>{user.role === 'manager' ? 'Hiệu suất từng nhân viên' : 'Thống kê công việc của bạn'}</h3><p>Gồm ticket hỗ trợ IT và yêu cầu tài sản đã hoàn thành.</p></div></div>
        <div className="responsive-table"><table className="report-table"><thead><tr><th>Nhân viên</th><th>Tháng {month}</th><th>IT (tháng)</th><th>Tài sản (tháng)</th><th>Năm {year}</th><th>IT (năm)</th><th>Tài sản (năm)</th></tr></thead>
          <tbody>{report.employees.map(row => <tr key={row.uid}><td><div className="user-cell"><div className="profile-avatar smaller">{shortName(row.name)}</div><div><strong>{row.name}</strong><span>{row.email || 'Lịch sử nhân viên'}</span></div></div></td>
            <td><strong>{row.monthCompleted}</strong></td><td>{row.monthSupport}</td><td>{row.monthEquipment}</td><td><strong>{row.yearCompleted}</strong></td><td>{row.yearSupport}</td><td>{row.yearEquipment}</td></tr>)}</tbody>
        </table></div>
        {report.inferredCount > 0 && <p className="report-note">* {report.inferredCount} lượt của ticket cũ chưa lưu ngày hoàn thành riêng; dùng thời điểm cập nhật gần nhất để ước tính.</p>}
      </div>
    </>}
  </div>;
}

export default function App() {
  const isIT = window.location.pathname === '/it' || window.location.pathname.startsWith('/it/');
  const assetPublicId = window.location.pathname.match(/^\/assets\/([a-zA-Z0-9_-]+)\/?$/)?.[1];
  const [firebaseUser, setFirebaseUser] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [authError, setAuthError] = useState('');
  useEffect(() => onAuthStateChanged(auth, setFirebaseUser), []);
  useEffect(() => {
    let alive = true;
    if (!isIT || !firebaseUser) { setProfile(null); return; }
    api('/me').then(p => { if (alive) { setProfile({ ...p, uid: firebaseUser.uid }); setAuthError(''); } })
      .catch(async err => { if (alive) { setProfile(null); setAuthError(err.message); await signOut(auth); } });
    return () => { alive = false; };
  }, [firebaseUser, isIT]);
  if (assetPublicId) return <PublicAssetPage publicId={assetPublicId}/>;
  if (!isIT) return <PublicPage/>;
  if (firebaseUser === undefined) return <Spinner/>;
  if (!firebaseUser) return <><LoginPage/>{authError && <div className="auth-toast">{authError}</div>}</>;
  if (!profile) return <Spinner label="Đang xác thực quyền truy cập..."/>;
  return <Dashboard user={profile} onLogout={() => signOut(auth)}/>;
}
