'use strict';
/** HEXA: fix opaque printer history modal + add persistent light/dark mode.
 *  Applies a small, version-safe React change, and adds a standalone stylesheet.
 *  Never modifies Firebase data, secrets or backend files.
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const root = __dirname;
const dir = path.join(root, 'frontend', 'src');
const appFile = path.join(dir, 'App.jsx');
const mainFile = path.join(dir, 'main.jsx');
const themeFile = path.join(dir, 'hexa-appearance.css');
const suppliedCss = path.join(root, 'hexa-appearance.css');
const MARK = '/* HEXA_APPEARANCE_TOGGLE_V1 */';
const CSS_MARK = '/* HEXA APPEARANCE V1';

function fail(m) { throw new Error(m); }
function exactlyOne(s, re, label) {
  const hits = [...s.matchAll(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'))];
  if (hits.length !== 1) fail(`${label}: can tim thay 1 vi tri, thuc te ${hits.length}. Da dung an toan.`);
}
function changeOnce(s, re, val, label) { exactlyOne(s,re,label); return s.replace(re,val); }
function read(p) { return fs.readFileSync(p,'utf8'); }
function write(p,s) {fs.writeFileSync(p,s,'utf8');}
function init() {
  if (!fs.existsSync(path.join(root, 'backend','package.json')) || !fs.existsSync(path.join(root,'frontend','package.json')))
    fail('Dat 3 file BAT, CJS va CSS tai thu muc HEXA goc (ngang frontend/ va backend/).');
  for (const file of [appFile,mainFile,suppliedCss]) if (!fs.existsSync(file)) fail('Thieu file: '+file);
}
const WIDGET = `${MARK}
function HexaAppearanceToggle() {
  const [appearance, setAppearance] = useState(() => {
    try { return window.localStorage.getItem('hexa.appearance.v1') === 'dark' ? 'dark' : 'light'; }
    catch { return 'light'; }
  });
  useEffect(() => {
    document.documentElement.setAttribute('data-hexa-theme', appearance);
    try { window.localStorage.setItem('hexa.appearance.v1', appearance); }
    catch { /* Browser blocks localStorage. The current choice still works. */ }
  }, [appearance]);
  const nextTitle = appearance === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối';
  return <button type="button" className="hexa-theme-toggle" aria-label={nextTitle}
    title={nextTitle} aria-pressed={appearance === 'dark'}
    onClick={() => setAppearance(current => current === 'dark' ? 'light' : 'dark')}>
    {appearance === 'dark' ? <Sun size={19} aria-hidden="true"/> : <Moon size={19} aria-hidden="true"/>}
  </button>;
}

`;

function prepare() {
  init();
  let app = read(appFile), main = read(mainFile), originalTheme = fs.existsSync(themeFile) ? read(themeFile) : null;
  const css = read(suppliedCss);
  if (!css.startsWith(CSS_MARK)) fail('File theme CSS khong hop le; khong ap dung.');
  const appHas = app.includes(MARK);
  const mainHas = main.includes("import './hexa-appearance.css';");
  if (appHas !== mainHas) fail('Phat hien project da duoc cap nhat mot phan. Dung de tranh trung lap.');
  if (originalTheme !== null && !originalTheme.startsWith(CSS_MARK))
    fail('File hexa-appearance.css tren may co noi dung khac ban va; khong tu ghi de.');

  if (!appHas) {
    if (!/import\s+(?:React\s*,\s*)?\{[^}]*\buseState\b[^}]*\}\s*from\s*['"]react['"]/.test(app))
      fail('App.jsx khong co React useState import de them nut Sáng/Tối.');
    if (!/import\s+(?:React\s*,\s*)?\{[^}]*\buseEffect\b[^}]*\}\s*from\s*['"]react['"]/.test(app))
      fail('App.jsx khong co React useEffect import de luu che do.');
    if (!/\bPanelLeftOpen\b/.test(app)) fail('Khong tim thay icon PanelLeftOpen de bo sung Sun/Moon.');
    const lucideMatch = app.match(/import\s*\{([\s\S]*?)\}\s*from\s*['"]lucide-react['"];/);
    if (!lucideMatch) fail('Khong tim thay import lucide-react.');
    const icons = lucideMatch[1];
    const need = ['Sun','Moon'].filter(name => !(new RegExp(`\\b${name}\\b`)).test(icons));
    if (need.length) {
      const updated = icons.replace(/\bPanelLeftOpen\b/, `PanelLeftOpen, ${need.join(', ')}`);
      if (updated === icons) fail('Khong chen duoc icon giao dien.');
      app = app.replace(lucideMatch[0], lucideMatch[0].replace(icons, updated));
    }
    app = changeOnce(app, /function Dashboard\s*\(/, WIDGET + 'function Dashboard(', 'Vi tri component Dashboard');
    app = changeOnce(app, /<div className="bar-right">/, '<div className="bar-right"><HexaAppearanceToggle/>', 'Thanh cong cu Admin');
    if (!app.includes('<HexaAppearanceToggle/>')) fail('Khong them duoc nut giao dien.');

    main = changeOnce(main, /import\s+['"]\.\/styles\.css['"];?/, "import './styles.css';\nimport './hexa-appearance.css';", 'CSS goc main.jsx');
    main = changeOnce(main, /createRoot\s*\(/,
`// HEXA_APPEARANCE_BOOTSTRAP_V1: restore mode before React paints the UI.
try {
  const savedAppearance = window.localStorage.getItem('hexa.appearance.v1');
  document.documentElement.setAttribute('data-hexa-theme', savedAppearance === 'dark' ? 'dark' : 'light');
} catch { document.documentElement.setAttribute('data-hexa-theme', 'light'); }
createRoot(`, 'React createRoot');
  }
  return {app,main,css,changed:!appHas || css !== originalTheme};
}

try {
  const work = prepare();
  if (!work.changed) { console.log('[OK] Theme Sáng/Tối da duoc cai, khong sua trung.'); process.exit(0); }
  const stamp = new Date().toISOString().replace(/[:.]/g,'-');
  const project = path.basename(root).replace(/[^a-z0-9_-]/gi,'_');
  const backup = path.join(os.homedir(),'HEXA_THEME_BACKUPS',`${project}_${stamp}`);
  fs.mkdirSync(backup,{recursive:true});
  for (const original of [appFile,mainFile,themeFile]) {
    if (fs.existsSync(original)) fs.copyFileSync(original,path.join(backup,path.basename(original)));
  }
  const old = [[appFile,read(appFile)],[mainFile,read(mainFile)],[themeFile,fs.existsSync(themeFile)?read(themeFile):null]];
  try {
    write(appFile,work.app);
    write(mainFile,work.main);
    write(themeFile,work.css);
  } catch (e) {
    for (const [file,data] of old) {
      if (data === null) { if(fs.existsSync(file)) fs.unlinkSync(file); }
      else write(file,data);
    }
    throw e;
  }
  console.log('[OK] Da sua hop lich su may in: nen kin, chu ro, tong tien co dinh.');
  console.log('[OK] Da them nut Sáng/Tối o thanh tren, nho lua chon cua ban.');
  console.log('[BACKUP] '+backup);
  console.log('[SAFE] Khong thay backend, Firebase, .env hay Service Account.');
} catch(e) { console.error('[FAILED] '+e.message); process.exitCode = 1; }
