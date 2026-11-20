import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './hexa-appearance.css';
import './hexa-typography.css';
import './hexa-sidebar-compact.css';
class HEXAErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) {
    console.error('[HEXA React ErrorBoundary]', error, info.componentStack);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main style={{ minHeight:'100vh', display:'grid', placeItems:'center', background:'#f3f6fb', padding:24, fontFamily:'system-ui,sans-serif' }}>
        <div role="alert" style={{ maxWidth:600, width:'100%', padding:28, background:'#fff', borderRadius:14, boxShadow:'0 8px 35px #0d274d1a' }}>
          <h1 style={{ marginTop:0, color:'#15294b' }}>HEXA gặp lỗi hiển thị</h1>
          <p>Không xóa dữ liệu Firebase. Hãy chụp màn hình lỗi này và Console để kiểm tra.</p>
          <pre style={{ whiteSpace:'pre-wrap', overflowWrap:'anywhere', color:'#af2838', background:'#fff3f5', padding:12, borderRadius:6 }}>
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <button onClick={() => window.location.reload()} style={{ padding:'10px 18px', background:'#2563eb', color:'white', border:0, borderRadius:7, cursor:'pointer' }}>Tải lại trang</button>
        </div>
      </main>
    );
  }
}

// HEXA_APPEARANCE_BOOTSTRAP_V1: restore mode before React paints the UI.
try {
  const savedAppearance = window.localStorage.getItem('hexa.appearance.v1');
  document.documentElement.setAttribute('data-hexa-theme', savedAppearance === 'dark' ? 'dark' : 'light');
} catch { document.documentElement.setAttribute('data-hexa-theme', 'light'); }
createRoot(document.getElementById('root')).render(
  <React.StrictMode><HEXAErrorBoundary><App /></HEXAErrorBoundary></React.StrictMode>
);
