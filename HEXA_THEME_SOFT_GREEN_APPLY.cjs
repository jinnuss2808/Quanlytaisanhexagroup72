'use strict';
const fs = require('node:fs');
const path = require('node:path');

const project = __dirname;
const srcDir = path.join(project, 'frontend', 'src');
const required = ['styles.css', 'asset-management.css', 'printer-management.css'];
const MARK_START = '/* HEXA_SOFT_GREEN_THEME_START */';
const MARK_END = '/* HEXA_SOFT_GREEN_THEME_END */';

function fail(msg){ console.error('[ERROR] ' + msg); process.exit(1); }
if (!fs.existsSync(path.join(project, 'frontend', 'package.json')) || !fs.existsSync(path.join(project, 'backend', 'package.json'))) {
  fail('Hay dat file BAT va CJS vao thu muc goc du an HEXA (cung cap frontend/ va backend/).');
}
for (const f of required) {
  if (!fs.existsSync(path.join(srcDir, f))) fail('Khong tim thay ' + f + ' trong frontend/src.');
}

function upsertBlock(filePath, block) {
  let text = fs.readFileSync(filePath, 'utf8');
  const wrapped = `\n${MARK_START}\n${block.trim()}\n${MARK_END}\n`;
  const rgx = new RegExp(`${MARK_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${MARK_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n?`, 'g');
  if (rgx.test(text)) {
    text = text.replace(rgx, wrapped);
  } else {
    if (!text.endsWith('\n')) text += '\n';
    text += wrapped;
  }
  fs.writeFileSync(filePath, text, 'utf8');
}

const stylesBlock = `
:root{
  --hexa-green:#0b6b5e;
  --hexa-green-dark:#084f46;
  --hexa-green-text:#1f5a53;
  --hexa-green-soft:#eaf6f3;
  --hexa-green-soft-2:#f5fbf9;
  --hexa-green-border:#d9ebe6;
}
html,body,#root{background:#ffffff;color:var(--hexa-green-text)}
body,.public-root,.admin-root,.admin-main,.admin-content{background:#ffffff!important;color:var(--hexa-green-text)}
.sidebar{background:#ffffff!important;border-right:1px solid var(--hexa-green-border);box-shadow:0 10px 30px rgba(8,79,70,.05)}
.side-brand-name,.side-brand-name span{color:var(--hexa-green)!important}
.side-label{color:#6f958e!important}
.side-link{background:transparent!important;color:var(--hexa-green-text)!important;border-radius:12px;transition:background-color .18s ease,color .18s ease,box-shadow .18s ease,transform .18s ease}
.side-link svg,.side-link .side-link-text{color:inherit!important}
.side-link:hover,.side-link.active{background:var(--hexa-green)!important;color:#ffffff!important;box-shadow:0 10px 22px rgba(11,107,94,.16)}
.side-link:hover svg,.side-link.active svg,.side-link:hover .side-link-text,.side-link.active .side-link-text{color:#ffffff!important}
.side-link .side-count{background:#ffd8de;color:#c23c55}
.side-link.active .side-count,.side-link:hover .side-count{background:#ffffff;color:var(--hexa-green)}
.side-profile{background:var(--hexa-green-soft-2)!important;border:1px solid var(--hexa-green-border)}
.profile-avatar{background:var(--hexa-green-soft)!important;color:var(--hexa-green)!important}
.profile-meta strong{color:var(--hexa-green-text)!important}
.profile-meta span{color:#6d8f89!important}
.side-profile>button,.desktop-sidebar-toggle,.mobile-menu{background:#ffffff!important;border:1px solid var(--hexa-green-border)!important;color:var(--hexa-green)!important}
.side-profile>button:hover,.desktop-sidebar-toggle:hover,.mobile-menu:hover{background:var(--hexa-green)!important;color:#ffffff!important;border-color:var(--hexa-green)!important}
.breadcrumbs,.date-chip,.dash-heading p,.panel-header p,.list-top p,.stat-sub,.am-muted,.pm-heading p{color:#72928b!important}
.breadcrumbs strong,.dash-heading h1,.panel-header h3,.list-top h3,.stat-card>strong,.am-heading h2,.am-heading h3,.pm-heading h3{color:var(--hexa-green-text)!important}
.stat-card,.dash-panel,.card-surface,.login-form-panel,.success-card,.requester-auth-card,.ticket-tabs,.modal,.modal-head,.detail-grid>div{border-color:#ebf3f0}
.stat-icon,.empty-icon,.recent-n-icon,.notification-icon,.type-pill,.type-card-icon.support,.form-section-icon,.assigned-avatar{background:var(--hexa-green-soft)!important;color:var(--hexa-green)!important}
.btn.primary,.submit-btn,.pm-primary,.am-btn.am-primary{background:var(--hexa-green)!important;border-color:var(--hexa-green)!important;color:#ffffff!important;box-shadow:0 10px 22px rgba(11,107,94,.16)}
.btn.primary:hover:not(:disabled),.submit-btn:hover:not(:disabled),.pm-primary:hover:not(:disabled),.am-btn.am-primary:hover:not(:disabled){background:var(--hexa-green-dark)!important;border-color:var(--hexa-green-dark)!important;color:#ffffff!important}
.btn.muted,.am-btn.am-light{background:#ffffff!important;color:var(--hexa-green-text)!important;border-color:var(--hexa-green-border)!important}
.btn.muted:hover,.am-btn.am-light:hover{background:var(--hexa-green)!important;color:#ffffff!important;border-color:var(--hexa-green)!important}
.text-link,.ticket-code,.active-tag,.am-link,.pm-head small{color:var(--hexa-green)!important}
.control-wrap:focus-within,.field textarea:focus,.note-input:focus,input:focus,textarea:focus,select:focus{border-color:#86bfb5!important;box-shadow:0 0 0 3px rgba(11,107,94,.10)!important;outline:none}
::selection{background:#cae9e1;color:var(--hexa-green-dark)}
`;

const assetBlock = `
.am-root,.am-card,.am-modal,.am-public-card{background:#ffffff}
.am-card,.am-modal,.am-public-card,.am-detail-grid>div,.am-warehouse-summary>div,.am-maintenance-card{border-color:#e5f0ec!important}
.am-heading h2,.am-heading h3,.am-table td b,.am-detail-grid strong,.am-modal-header h2,.am-warehouse .am-padded h3{color:#1f5a53!important}
.am-heading p,.am-table td,.am-detail-grid small,.am-modal-header p,.am-muted,.am-public-card .am-muted{color:#6f918a!important}
.am-btn.am-primary{background:#0b6b5e!important;border-color:#0b6b5e!important;color:#ffffff!important}
.am-btn.am-primary:hover:not(:disabled){background:#084f46!important;border-color:#084f46!important}
.am-btn.am-light{background:#ffffff!important;color:#1f5a53!important;border-color:#d9ebe6!important}
.am-btn.am-light:hover{background:#0b6b5e!important;color:#ffffff!important;border-color:#0b6b5e!important}
.am-pill-tabs,.am-main-tabs,.am-detail-tabs{background:#f3faf8!important}
.am-pill-tabs button,.am-detail-tabs button{color:#547972!important;transition:background-color .18s ease,color .18s ease}
.am-pill-tabs button:hover,.am-pill-tabs button.active,.am-detail-tabs button:hover,.am-detail-tabs button.active{background:#0b6b5e!important;color:#ffffff!important;box-shadow:none!important}
.am-table th{background:#f8fcfb!important;color:#7e9b95!important}
.am-table tbody tr:hover{background:#f8fcfb!important}
.am-table th .am-sort-toggle.is-active,.am-table th .am-sort-toggle:hover{color:#0b6b5e!important}
.am-table th .am-sort-toggle.is-active svg,.am-table th .am-sort-toggle:hover svg{color:#0b6b5e!important}
.am-row-actions button:hover,.am-pagination button:hover{background:#0b6b5e!important;border-color:#0b6b5e!important;color:#ffffff!important}
.am-status.using,.am-status.available{background:#eaf6f3!important;color:#0b6b5e!important}
.am-highlight,.am-note,.am-import-guide,.am-url{background:#f6fbfa!important;border-color:#dfefea!important;color:#4f756e!important}
.am-field>input:focus,.am-field>select:focus,.am-field>textarea:focus,.am-inline-form input:focus,.am-catalog-form input:focus{border-color:#86bfb5!important;box-shadow:0 0 0 3px rgba(11,107,94,.10)!important}
`;

const printerBlock = `
.pm-root,.pm-modal{background:transparent}
.pm-head h3,.pm-history-row strong{color:#1f5a53!important}
.pm-head p,.pm-history-row span,.pm-history-row p,.pm-help{color:#6f918a!important}
.pm-tabs{background:#f3faf8!important;border:1px solid #e5f0ec}
.pm-tabs button{color:#557a73!important;transition:background-color .18s ease,color .18s ease}
.pm-tabs button:hover,.pm-tabs button.active{background:#0b6b5e!important;color:#ffffff!important;box-shadow:none!important}
.pm-primary{background:#0b6b5e!important;color:#ffffff!important}
.pm-primary:hover:not(:disabled){background:#084f46!important}
.pm-history-filters button{background:#ffffff!important;border-color:#d9ebe6!important;color:#426b64!important;transition:background-color .18s ease,color .18s ease}
.pm-history-filters button:hover,.pm-history-filters button.active{background:#0b6b5e!important;border-color:#0b6b5e!important;color:#ffffff!important}
.pm-stock{background:#f6fbfa!important;color:#4f756e!important}
.pm-message.pm-ok{background:#eaf6f3!important;color:#0b6b5e!important}
.pm-form input:focus,.pm-form select:focus,.pm-form textarea:focus{border-color:#86bfb5!important;outline:2px solid rgba(11,107,94,.10)!important}
`;

upsertBlock(path.join(srcDir, 'styles.css'), stylesBlock);
upsertBlock(path.join(srcDir, 'asset-management.css'), assetBlock);
upsertBlock(path.join(srcDir, 'printer-management.css'), printerBlock);

console.log('[OK] Da cap nhat theme nen trang - xanh diu mat cho HEXA.');
console.log('[NEXT] Neu frontend dang chay, refresh Ctrl+Shift+R.');
console.log('[GIT] git add frontend/src/styles.css frontend/src/asset-management.css frontend/src/printer-management.css');
console.log('[GIT] git commit -m "Update soft green white theme"');
console.log('[GIT] git push origin main');
