'use strict';
// HEXA: update blue UI palette to teal #004F44 without touching data or configuration.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const project = __dirname;
const cssDir = path.join(project, 'frontend', 'src');
const cssFiles = ['styles.css', 'asset-management.css', 'printer-management.css'];
const MARKER = '/* HEXA_TEAL_THEME_V1 */';

function fail(message) { console.error('[ERROR] ' + message); process.exit(1); }
if (!fs.existsSync(path.join(project, 'frontend', 'package.json')) || !fs.existsSync(path.join(project, 'backend', 'package.json')))
  fail('Place BAT and CJS in HEXA root (next to frontend/ and backend/).');
if (!fs.existsSync(path.join(cssDir, 'styles.css')) || !fs.existsSync(path.join(cssDir, 'asset-management.css')))
  fail('Frontend styles.css / asset-management.css not found. No changes made.');

function toHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0, s = 0, l = (max + min)/2;
  if (d > 0) {
    s = d/(1-Math.abs(2*l-1));
    switch (max) {
      case r: h = ((g-b)/d)%6; break;
      case g: h = (b-r)/d+2; break;
      default: h = (r-g)/d+4;
    }
    h = (h*60+360)%360;
  }
  return {h,s,l};
}
function fromHsl(h,s,l) {
  const c=(1-Math.abs(2*l-1))*s, x=c*(1-Math.abs((h/60)%2-1)), m=l-c/2;
  let z;
  if(h<60)z=[c,x,0]; else if(h<120)z=[x,c,0]; else if(h<180)z=[0,c,x];
  else if(h<240)z=[0,x,c]; else if(h<300)z=[x,0,c]; else z=[c,0,x];
  return z.map(a=>Math.min(255,Math.max(0,Math.round((a+m)*255))));
}
function convert(r,g,b) {
  const {h,s,l}=toHsl(r,g,b);
  if (h<187 || h>277 || s<0.18) return null; // preserve red, orange, yellow, existing greens and neutrals
  let mapped;
  // User's exact requested teal as the main color, softer tints for tables/inputs.
  if (s > 0.56 && l>=0.25 && l<=0.67) mapped=[0,79,68];
  else if (s > 0.48 && l>0.67 && l<=0.79) mapped=fromHsl(170,0.52,l);
  else if (l < 0.23) mapped=fromHsl(174,Math.max(0.35,Math.min(0.75,s)),Math.max(0.08,l));
  else mapped=fromHsl(170,Math.max(0.15,Math.min(s,0.74)),l);
  return mapped;
}
function hex2rgb(h) {
  const raw=h.slice(1).toLowerCase();
  if(raw.length===3) return raw.split('').map(x=>parseInt(x+x,16));
  return [0,2,4].map(i=>parseInt(raw.slice(i,i+2),16));
}
function toHex(arr) {return '#'+arr.map(n=>n.toString(16).padStart(2,'0')).join('');}
function recolor(content) {
  let changed = 0;
  content=content.replace(/#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3})(?![0-9a-f])/gi,hex=>{
    const rgb=hex2rgb(hex), next=convert(...rgb);
    if(!next) return hex;
    const alpha=hex.length===9?hex.slice(7):'';
    const result=toHex(next)+alpha;
    if(result.toLowerCase()!==hex.toLowerCase()) changed++;
    return result;
  });
  content=content.replace(/\brgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(\s*,\s*(?:0?(?:\.\d+)?|1(?:\.0+)?))?\s*\)/gi,(full,r,g,b,alpha)=>{
    const next=convert(Number(r),Number(g),Number(b));
    if(!next)return full;
    changed++;
    return `${alpha?'rgba':'rgb'}(${next.join(', ')}${alpha||''})`;
  });
  return {content,changed};
}
const overrides={
  'styles.css': `
${MARKER}
:root { --blue:#004F44;--indigo:#00675A;--navy:#003C34;--navydeep:#002B26;--text:#1B3530;--bg:#F5F9F7; }
::selection{background:#BDE3D8;color:#003C34}
.sidebar{background:#003C34;color:#C6E3DA}
.side-link.active{background:#006859;color:#FFFFFF;box-shadow:0 8px 24px rgba(0,32,27,.18)}
.side-link:hover:not(.active){background:rgba(255,255,255,.085);color:#FFFFFF}
.btn.primary,.submit-button,.pm-primary{background:#004F44;color:#FFFFFF}
.btn.primary:hover:not(:disabled){background:#00695B}
.public-header{background:#00382F}
.public-hero{background:linear-gradient(113deg,#002E29 0%,#004F44 62%,#087763 100%)}
.hero-copy h1 em{color:#82D9C6}
:where(button,input,select,textarea,a):focus-visible{outline-color:#128A76}
`,
  'asset-management.css': `
${MARKER}
.am-btn.am-primary{background:#004F44;border-color:#004F44;color:#fff}
.am-btn.am-primary:hover:not(:disabled){background:#00695B;border-color:#00695B}
.am-stat-icon{background:#E5F4EF;color:#004F44}
.am-pill-tabs button.active,.am-link,.am-eyebrow{color:#004F44}
.am-pill-tabs button:hover{color:#00695B}
.am-status.using{background:#E5F4EF;color:#004F44}
.am-field>input:focus,.am-field>select:focus,.am-field>textarea:focus{border-color:#13816F;box-shadow:0 0 0 3px rgba(0,79,68,.10)}
`,
  'printer-management.css': `
${MARKER}
.pm-primary{background:#004F44;color:#FFFFFF}
.pm-primary:hover:not(:disabled){background:#00695B}
.pm-tabs button.active{color:#004F44}
.pm-head small{color:#004F44}
.pm-history-filters button.active{background:#E5F4EF;border-color:#9BCEC0;color:#004F44}
.pm-form input:focus,.pm-form select:focus,.pm-form textarea:focus{border-color:#13816F;outline:2px solid rgba(0,79,68,.12)}
`
};
const present=cssFiles.filter(f=>fs.existsSync(path.join(cssDir,f)));
const edits=[];
for(const name of present){
  const file=path.join(cssDir,name),original=fs.readFileSync(file,'utf8');
  if(original.includes(MARKER)) {console.log('[SKIP] Already themed: '+name);continue;}
  const {content,changed}=recolor(original);
  if (changed<2) fail(`Unexpected CSS structure for ${name}; ${changed} theme colors found. No files modified.`);
  edits.push({name,file,original,updated:content+'\n'+overrides[name],changed});
}
if(!edits.length){console.log('[OK] HEXA already uses the teal theme (#004F44).');process.exit(0);}
// Backups are OUTSIDE git workspace so `git add -A` cannot accidentally publish them.
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const safeName=path.basename(project).replace(/[^a-z0-9-_]/gi,'_');
const backup=path.join(os.homedir(),'HEXA_THEME_BACKUPS',safeName+'_'+stamp);
fs.mkdirSync(backup,{recursive:true});
for(const e of edits)fs.writeFileSync(path.join(backup,e.name),e.original,'utf8');
try{
  for(const e of edits){fs.writeFileSync(e.file,e.updated,'utf8'); console.log(`[OK] ${e.name}: recolored ${e.changed} values`);}
}catch(err){
  for(const e of edits)fs.writeFileSync(e.file,e.original,'utf8');
  fail('File write failed, restored originals: '+err.message);
}
console.log('[DONE] HEXA primary teal: #004F44');
console.log('[BACKUP] '+backup);
console.log('[NEXT] Restart Vite if needed; refresh Ctrl+Shift+R.');
