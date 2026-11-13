#!/usr/bin/env node
'use strict';
// Non-destructive three-way merger for the HEXA Ticket module toggle.
// Does not replace whole App.jsx or assume fixed source line numbers.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const root = __dirname;
const payload = path.join(root, 'toggle-payload');
const modified = [
  'backend/src/app.js',
  'backend/src/remind.js',
  'firebase/functions/worker/remind.js',
  'frontend/src/App.jsx',
  'frontend/src/styles.css',
];
const added = [
  'backend/src/ticket-module.js',
  'backend/test/ticket-module.test.js',
];
const targets = [...modified, ...added];
const toLF = s => s.replace(/\r\n/g, '\n');
const read = f => fs.readFileSync(f, 'utf8');
const fail = message => { throw new Error(message); };
const sha = s => crypto.createHash('sha256').update(s, 'utf8').digest('hex');
const getBody = (file) => {
  const raw = read(file);
  return { raw, lf: toLF(raw).replace(/^\uFEFF/, ''), bom: raw.startsWith('\uFEFF'), crlf: raw.includes('\r\n') };
};
const applyEol = (str, from) => (from.bom ? '\uFEFF' : '') + (from.crlf ? str.replace(/\n/g, '\r\n') : str);
function cmd(program, args, cwd) {
  const r = spawnSync(program, args, { cwd, encoding:'utf8', maxBuffer: 32 * 1024 * 1024 });
  return r;
}
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'hexa-toggle-merge-'));
let backup = '';
const existing = new Map();
try {
  if (!fs.existsSync(path.join(root, 'frontend/src/App.jsx')) || !fs.existsSync(path.join(root, 'backend/src/app.js')))
    fail('Hay dat file BAT, CJS va thu muc toggle-payload trong thu muc goc HEXA (noi co frontend va backend).');
  if (cmd('git', ['--version'], root).status !== 0)
    fail('May chua co Git for Windows hoac chua co git trong PATH.');
  const pending = new Map();
  const changed = [];
  for (let i=0;i<targets.length;i++) {
    const rel = targets[i];
    const actual = path.join(root, rel);
    const updated = path.join(payload, 'updated', rel);
    if (!fs.existsSync(updated)) fail('Thieu file goi cap nhat: '+rel);
    const desired = getBody(updated).lf;
    if (modified.includes(rel)) {
      const baseFile = path.join(payload, 'base', rel);
      if (!fs.existsSync(baseFile) || !fs.existsSync(actual)) fail('Khong tim thay file goc: '+rel);
      const base = getBody(baseFile).lf;
      const current = getBody(actual);
      existing.set(rel, current.raw);
      let result = current.lf;
      if (current.lf === desired) {
        console.log('[SKIP] Da cap nhat: '+rel);
        continue;
      }
      if (current.lf === base) result = desired;
      else {
        const dir = path.join(temp, `merge-${i}`);
        fs.mkdirSync(dir);
        const ours = path.join(dir,'current.txt');
        const ancestor = path.join(dir,'base.txt');
        const theirs = path.join(dir,'updated.txt');
        fs.writeFileSync(ours,current.lf);
        fs.writeFileSync(ancestor,base);
        fs.writeFileSync(theirs,desired);
        const r = cmd('git', ['merge-file', ours, ancestor, theirs], root);
        if (r.status !== 0) {
          fail('File '+rel+' co thay doi trung vung voi ban va (git merge-file exit '+r.status+'). Khong ghi de. Hay gui file nay de toi ghep chinh xac.');
        }
        result = read(ours);
        if (result.includes('<<<<<<< ') || result.includes('>>>>>>> '))
          fail('Phat hien merge conflict trong '+rel+'; khong thay doi file goc.');
        console.log('[MERGE] Giu lai cac sua doi rieng: '+rel);
      }
      const final = applyEol(result,current);
      if (sha(final)!==sha(current.raw)) { pending.set(rel,final); changed.push(rel); }
    } else {
      if (fs.existsSync(actual)) {
        const current = getBody(actual);
        existing.set(rel,current.raw);
        if (current.lf !== desired) fail('File '+rel+' da ton tai nhung khac ban cap nhat. Khong ghi de.');
        console.log('[SKIP] Da co: '+rel);
      } else {
        existing.set(rel, null);
        pending.set(rel, desired);
        changed.push(rel);
      }
    }
  }
  // Cheap source compatibility checks before writing to the live project.
  const resolved = rel => toLF(pending.has(rel) ? pending.get(rel) : read(path.join(root,rel)));
  const app = resolved('backend/src/app.js');
  const ui = resolved('frontend/src/App.jsx');
  const reminders = resolved('backend/src/remind.js');
  if (!app.includes("settings/ticketEnabled") || !app.includes('requireTicketEnabled') ||
      !ui.includes('TicketModuleSettings') || !ui.includes('ticketEnabled') ||
      !reminders.includes('ticketIsOn')) fail('Kiem tra cau truc toggle that bai. Khong ap dung.');
  if (!changed.length) {
    console.log('[OK] Chuc nang da duoc ap dung truoc do; khong phai sua nua.');
    process.exit(0);
  }
  backup = path.join(path.dirname(root), 'HEXA_BACKUP_TOGGLE_'+new Date().toISOString().replace(/[:.]/g,'-'));
  fs.mkdirSync(backup,{recursive:true});
  for (const rel of targets) {
    const original = existing.get(rel);
    if (original === null) continue;
    const destination = path.join(backup,rel);
    fs.mkdirSync(path.dirname(destination),{recursive:true});
    fs.writeFileSync(destination,original);
  }
  console.log('[BACKUP] '+backup);
  try {
    for (const [rel,data] of pending) {
      const dest=path.join(root,rel);
      fs.mkdirSync(path.dirname(dest),{recursive:true});
      fs.writeFileSync(dest,data,'utf8');
      console.log('[UPDATED] '+rel);
    }
    for (const rel of ['backend/src/app.js','backend/src/remind.js','backend/src/ticket-module.js','firebase/functions/worker/remind.js']) {
      const r=cmd('node',['--check',path.join(root,rel)],root);
      if (r.status!==0) fail('Loi cu phap '+rel+': '+(r.stderr||'').slice(-1200));
    }
    const t=cmd('node',['--test','test/*.test.js'],path.join(root,'backend'));
    // Shell expansion on Windows is not guaranteed; npm test handles glob in package.json.
    const npm = process.platform==='win32' ? 'cmd.exe':'npm';
    const args = process.platform==='win32' ? ['/d','/s','/c','npm test'] : ['test'];
    const suite = cmd(npm,args,path.join(root,'backend'));
    if (suite.status!==0) fail('Backend test khong dat:\n'+(suite.stdout||'').slice(-2000)+'\n'+(suite.stderr||'').slice(-2000));
    const match=(suite.stdout||'').match(/# tests\s+(\d+)/);
    console.log('[TEST OK] Backend '+(match ? match[1]+' cases' : 'tests passed'));
    const vite = path.join(root,'frontend','node_modules','.bin',process.platform==='win32'?'vite.cmd':'vite');
    if (fs.existsSync(vite)) {
      const argsBuild = process.platform==='win32'?['/d','/s','/c','npm run build']:['run','build'];
      const built=cmd(npm,argsBuild,path.join(root,'frontend'));
      if (built.status!==0) fail('Vite build loi:\n'+(built.stdout||'').slice(-1600)+'\n'+(built.stderr||'').slice(-1600));
      console.log('[BUILD OK] Vite');
    } else {
      console.warn('[WARNING] Chua co frontend/node_modules/.bin/vite. Can npm install va npm run build truoc khi push len GitHub.');
    }
  } catch(error) {
    for (const [rel] of pending) {
      const dest=path.join(root,rel); const old=existing.get(rel);
      if (old===null) { if (fs.existsSync(dest)) fs.unlinkSync(dest); }
      else { fs.writeFileSync(dest,old,'utf8'); }
    }
    throw error;
  }
  console.log('[OK] Cap nhat bat/tat Ticket thanh cong. Du lieu Firebase khong bi dong cham.');
  console.log('[INFO] Kiem tra Git: git status --short');
} catch(error) {
  console.error('[FAILED] '+error.message);
  console.error('Khong sua Firebase; neu gap xung dot, hay gui frontend/src/App.jsx hien tai de ghep dung phien ban.');
  process.exitCode=1;
} finally {
  fs.rmSync(temp,{recursive:true,force:true});
}
