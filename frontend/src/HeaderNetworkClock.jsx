import React, {useEffect, useState} from 'react';
import {CalendarDays, Clock3, Wifi, WifiOff} from 'lucide-react';
import './header-network-clock.css';

// Trạng thái mạng dựa trên sự kiện online/offline của trình duyệt.
// navigator.onLine không xác minh được Internet hay khả năng truy cập backend.
function browserOnline() {
  return typeof navigator === 'undefined' ? true : navigator.onLine !== false;
}

export default function HeaderNetworkClock() {
  const [now, setNow] = useState(() => new Date());
  const [isOnline, setIsOnline] = useState(browserOnline);

  useEffect(() => {
    const updateClock = () => setNow(new Date());
    const updateNetwork = () => setIsOnline(browserOnline());
    const refresh = () => { updateClock(); updateNetwork(); };
    const interval = window.setInterval(updateClock, 1000);
    window.addEventListener('online', updateNetwork);
    window.addEventListener('offline', updateNetwork);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    refresh();
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('online', updateNetwork);
      window.removeEventListener('offline', updateNetwork);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  const dateLong = now.toLocaleDateString('vi-VN', {day:'numeric', month:'long', year:'numeric'});
  const dateShort = now.toLocaleDateString('vi-VN', {day:'2-digit', month:'2-digit', year:'numeric'});
  const time = now.toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false});
  const networkLabel = isOnline ? 'Có mạng' : 'Mất mạng';
  const statusTitle = isOnline
    ? 'Trình duyệt báo đang có kết nối mạng (không bảo đảm Internet hoặc API hoạt động)'
    : 'Trình duyệt báo mất kết nối mạng';
  const StatusIcon = isOnline ? Wifi : WifiOff;

  return <div className="hexa-header-telemetry" aria-label="Trạng thái mạng, ngày và giờ">
    <span className={`hexa-network-state ${isOnline ? 'is-online' : 'is-offline'}`}
      role="status" aria-label={networkLabel} title={statusTitle}>
      <StatusIcon size={16} aria-hidden="true"/>
      <span className="hexa-network-label">{networkLabel}</span>
    </span>
    <span className="date-chip hexa-header-date" title={dateLong}>
      <CalendarDays size={15} aria-hidden="true"/>
      <time dateTime={`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`}>
        <span className="hexa-date-long">{dateLong}</span>
        <span className="hexa-date-short">{dateShort}</span>
      </time>
    </span>
    <span className="hexa-header-clock" title="Giờ hiện tại trên máy của bạn">
      <Clock3 size={15} aria-hidden="true"/>
      <time dateTime={time}>{time}</time>
    </span>
  </div>;
}
