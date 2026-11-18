// HEXA deployment: operate directly in the existing repository root.
// Never copies Firebase secrets into the repository or Git.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

import {fileURLToPath} from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API_NAME=process.env.HEXA_API_PROJECT||'quanlytaisanhexagroup72-api';
const WEB_NAME=process.env.HEXA_WEB_PROJECT||'quanlytaisanhexagroup72-web';
const API_URL=`https://${API_NAME}.vercel.app`;
const WEB_URL=`https://${WEB_NAME}.vercel.app`;
const logPath=path.join(os.tmpdir(),`HEXA-deploy-${new Date().toISOString().replaceAll(':','-')}.log`);
const logs=[];
const fail=(message)=>{throw new Error(message)};
function say(s=''){console.log(s);logs.push(s);}
function writeLog(){try{fs.writeFileSync(logPath,logs.join('\n')+'\n','utf8')}catch{}}
function requireFile(relative){if(!fs.existsSync(path.join(ROOT,relative)))fail('Thieu file '+relative+' trong '+ROOT+'. Hay giai nen/chep de DU file vao project goc.');}
function logSafe(stderr='',stdout='',limit=1400){return (stderr+'\n'+stdout).replace(/(?<=FIREBASE_SERVICE_ACCOUNT_BASE64\s*=\s*)[^\s]+/g,'[HIDDEN]').slice(-limit).trim()}
function runJS(binJS,args,{cwd=ROOT,input,quiet=false,interactive=false,allowFail=false,env=process.env,timeout=600000}={}){
 const cmd=process.execPath;
 const opts={cwd,env,windowsHide:!interactive,encoding:'utf8',timeout,maxBuffer:16*1024*1024,stdio:interactive?'inherit':['pipe','pipe','pipe']};
 if(!interactive && input!==undefined)opts.input=input;
 const res=spawnSync(cmd,[binJS,...args],opts);
 const code=res.status??1;const stdout=String(res.stdout||''),stderr=String(res.stderr||'');
 if(code!==0&&!allowFail){say('LENH THAT BAI: '+path.basename(binJS)+' '+args.filter(x=>!x.includes('=')).slice(0,4).join(' '));say(logSafe(stderr,stdout));fail('Exit '+code+'. '+(res.error?.message||''));}
 if(!quiet && !interactive){if(stdout.trim())say(stdout.trim().slice(-850));if(stderr.trim())say(stderr.trim().slice(-850))}
 return {code,out:stdout,err:stderr};
}
function npmCLI(){
 const dir=path.dirname(process.execPath);
 const paths=[process.env.npm_execpath,process.env.HEXA_NPM_ENTRY,path.join(dir,'node_modules','npm','bin','npm-cli.js'),process.env.APPDATA&&path.join(process.env.APPDATA,'npm','node_modules','npm','bin','npm-cli.js'),'/opt/nvm/versions/node/v22.16.0/lib/node_modules/npm/bin/npm-cli.js','/usr/local/lib/node_modules/npm/bin/npm-cli.js'].filter(Boolean);
 for(const p of paths){if(fs.existsSync(p))return p}
 fail('Khong tim thay npm-cli.js. Cai Node.js LTS kem npm (khong dung npm.cmd qua chuoi CMD).');
}
let npmFile='';const npm=(args,opts)=>runJS(npmFile,args,opts);
function vcCLI(){
 const r=npm(['root','-g'],{quiet:true});const locations=[r.out.trim().split(/\r?\n/).at(-1),path.join(path.dirname(process.execPath),'node_modules'),process.env.APPDATA&&path.join(process.env.APPDATA,'npm','node_modules')].filter(Boolean);
 for(const loc of locations){
  const p=path.join(loc,'vercel','package.json');if(!fs.existsSync(p))continue;
  try{const o=JSON.parse(fs.readFileSync(p,'utf8'));let rel=typeof o.bin==='string'?o.bin:o.bin?.vercel;const entry=rel&&path.resolve(path.dirname(p),rel);if(entry&&fs.existsSync(entry))return entry}catch{}
 }
 return null;
}
let vcFile='';const vc=(args,opts)=>runJS(vcFile,args,opts);
function readEnv(rel){
 const result={};
 // Merge instead of first-found: Vercel may have created .env.local containing only VERCEL_OIDC_TOKEN.
 // Local overrides base only for keys it actually defines.
 for(const filename of [rel+'/.env',rel+'/.env.local']){
  const p=path.join(ROOT,filename);if(!fs.existsSync(p))continue;
  for(const line of fs.readFileSync(p,'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){
   const m=line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);if(!m)continue;
   let v=m[2].trim();if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);
   result[m[1]]=v.replace(/\\n/g,'\n');
  }
 }
 return result;
}
function required(obj,k,where){if(!obj[k])fail('Thieu '+k+' trong '+where+'. Can cau hinh Firebase local, script khong tu tao khoa.');return obj[k]}
function getFirebase(){
 const be={...readEnv('backend')},fe={...readEnv('frontend')};
 for(const k of ['FIREBASE_PROJECT_ID','FIREBASE_DATABASE_URL'])required(be,k,'backend/.env');
 for(const k of ['VITE_FIREBASE_PROJECT_ID','VITE_FIREBASE_AUTH_DOMAIN','VITE_FIREBASE_DATABASE_URL','VITE_FIREBASE_API_KEY','VITE_FIREBASE_APP_ID'])required(fe,k,'frontend/.env');
 if(be.FIREBASE_PROJECT_ID!==fe.VITE_FIREBASE_PROJECT_ID)fail('Firebase project ID o backend/frontend KHONG khop.');
 const keyFile=path.join(ROOT,'backend','service-account.json');
 if(!be.FIREBASE_SERVICE_ACCOUNT_BASE64 && fs.existsSync(keyFile))be.FIREBASE_SERVICE_ACCOUNT_BASE64=fs.readFileSync(keyFile).toString('base64');
 if(!be.FIREBASE_SERVICE_ACCOUNT_BASE64)fail('Thieu Firebase Admin key: backend/service-account.json hoac FIREBASE_SERVICE_ACCOUNT_BASE64 trong backend/.env.');
 let service;try{service=JSON.parse(Buffer.from(be.FIREBASE_SERVICE_ACCOUNT_BASE64,'base64').toString('utf8'))}catch{fail('Firebase Admin base64 khong phai JSON hop le.');}
 if(service.project_id!==be.FIREBASE_PROJECT_ID||!service.private_key||!service.client_email)fail('Firebase Admin key sai project hoac thieu truong.');
 const backendEnv={FIREBASE_PROJECT_ID:be.FIREBASE_PROJECT_ID,FIREBASE_DATABASE_URL:be.FIREBASE_DATABASE_URL,FIREBASE_SERVICE_ACCOUNT_BASE64:be.FIREBASE_SERVICE_ACCOUNT_BASE64,CLIENT_ORIGINS:WEB_URL};
 for(const k of ['FIREBASE_STORAGE_BUCKET','SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASSWORD','SMTP_FROM'])if(be[k])backendEnv[k]=be[k];
 const frontendEnv={...Object.fromEntries(Object.entries(fe).filter(([k])=>k.startsWith('VITE_FIREBASE_'))),VITE_API_URL:API_URL};
 say('OK: Firebase project '+be.FIREBASE_PROJECT_ID+'; API/WEB env prepared (secrets hidden).');
 return {backendEnv,frontendEnv};
}
function cleanup(){
 const backup=path.join(os.homedir(),'HEXA_BACKUP_SCRIPTS',new Date().toISOString().replaceAll(':','-'));
 const old=fs.readdirSync(ROOT,{withFileTypes:true}).filter(f=>f.isFile()&&/^(?:APPLY_|FIX_|PATCH_|DEPLOY_)/i.test(f.name)&&/\.(?:bat|cjs|ps1)$/i.test(f.name)&&f.name!=='DEPLOY_HEXA_VERCEL.bat');
 let moved=0;for(const f of old){fs.mkdirSync(backup,{recursive:true});fs.renameSync(path.join(ROOT,f.name),path.join(backup,f.name));moved++;}
 const redundant=['backend/vercel.json','backend/api/index.js'];
 for(const f of redundant){const from=path.join(ROOT,f);if(!fs.existsSync(from))continue;fs.mkdirSync(path.join(backup,path.dirname(f)),{recursive:true});fs.renameSync(from,path.join(backup,f));moved++;}
 if(moved)say('Da sao luu '+moved+' file script/route cu vao: '+backup);
}
function checkLocal(){
 for(const f of ['backend/src/app.js','backend/index.js','backend/package.json','frontend/src/App.jsx','frontend/vercel.json','frontend/package.json'])requireFile(f);
 const be=fs.readFileSync(path.join(ROOT,'backend/index.js'),'utf8');if(!be.includes("./src/app.js")||!be.includes('export default'))fail('backend/index.js khong export Express app nhu mong doi.');
 if(Number(process.versions.node.split('.')[0])<22)fail('Can Node.js 22+; hien tai: '+process.version);
 say('OK: project root '+ROOT);say('Node '+process.version+', npm '+npm(['--version'],{quiet:true}).out.trim());
}
function localTests(fb){
 say('=== LOCAL BUILD / TEST (before Vercel) ===');
 npm(['ci','--no-audit','--no-fund'],{cwd:path.join(ROOT,'backend'),quiet:true});
 npm(['test'],{cwd:path.join(ROOT,'backend'),quiet:true});say('OK: backend npm test.');
 npm(['ci','--no-audit','--no-fund'],{cwd:path.join(ROOT,'frontend'),quiet:true});
 npm(['run','build'],{cwd:path.join(ROOT,'frontend'),quiet:true,env:{...process.env,...fb.frontendEnv}});say('OK: Vite build.');
}
function auth(){
 say('=== VERCEL ACCOUNT ===');
 vcFile=vcCLI();if(!vcFile){say('Installing vercel CLI using Node/npm ...');npm(['install','-g','vercel@latest'],{quiet:true});vcFile=vcCLI();}
 if(!vcFile)fail('Khong tim thay Vercel CLI sau cai dat.');
 const who=vc(['whoami'],{allowFail:true,quiet:true});
 if(who.code!==0){say('Dang nhap Vercel. Cap quyen trong trinh duyet...');vc(['login'],{interactive:true,timeout:10*60*1000});}
 const res=vc(['whoami'],{quiet:true});say('Vercel account: '+res.out.trim());
}
function link(name,expectedRoot){
 const inspect=vc(['project','inspect',name],{quiet:true,allowFail:true});
 if(inspect.code!==0){say(logSafe(inspect.err,inspect.out,1000));fail('Khong tim thay project Vercel '+name+' tren account/team dang nhap. Khong tao project khac de tranh sai scope.');}
 vc(['link','--yes','--project',name],{quiet:true});
 // Additional identity check: linked project id should match project inspect, when inspect exposes prj_ ID.
 const linked=JSON.parse(fs.readFileSync(path.join(ROOT,'.vercel','project.json'),'utf8'));
 const expected=(inspect.out+' '+inspect.err).match(/prj_[A-Za-z0-9]+/)?.[0];
 if(expected && linked.projectId!==expected)fail('Vercel link sai project ID. Expected '+expected+', got '+linked.projectId);
 say('Linked project '+name+' ['+linked.projectId+']');
 const rootMatch=(inspect.out+'\n'+inspect.err).match(/Root\s*Directory\s*[:|]\s*([^\r\n]+)/i);
 if(rootMatch){
  const actual=rootMatch[1].trim().replace(/[\`'\"|]/g,'').split(/\s{2,}/)[0].trim();
  say('Project Root Directory (Vercel): '+actual);
  if(actual && actual.toLowerCase()!=='not set' && actual.toLowerCase()!=='none' && actual.toLowerCase()!==expectedRoot)fail('SAI ROOT DIRECTORY cua '+name+': '+actual+' (can '+expectedRoot+'). Sua tai Vercel Settings -> Build & Deployment -> Root Directory. Dung lai truoc khi deploy nham.');
 } else say('Root Directory was not exposed by Vercel CLI; will deploy from repository root and verify real API response.');
 // Deploying from REPO ROOT is essential when Vercel project has Root Directory backend/frontend.
}
function envSet(values){
 for(const [k,v] of Object.entries(values)){
  if(v==null||v==='')continue;
  const res=vc(['env','add',k,'production','--force'],{quiet:true,input:String(v)+'\n',allowFail:true,timeout:90000});
  if(res.code!==0)fail('Khong cap nhat duoc Vercel env: '+k+'; '+logSafe(res.err,res.out,450));
  say('  OK '+k);
 }
}
function deployment(name){
 say('=== DEPLOY '+name+' FROM REPO ROOT ===');
 const d=vc(['deploy','--prod','--yes'],{quiet:true,timeout:15*60*1000});
 const all=d.out+'\n'+d.err;
 const urls=[...all.matchAll(/https:\/\/[A-Za-z0-9][A-Za-z0-9.-]+\.vercel\.app/g)].map(x=>x[0]);
 const url=urls.at(-1);
 if(!url)fail('Vercel khong tra deployment URL. '+logSafe(d.err,d.out,500));
 say('Deployment: '+url);return url;
}
async function apiCheck(url){
 const r=vc(['curl','/api/health','--deployment',url],{allowFail:true,quiet:true});
 if(r.code!==0){say(logSafe(r.err,r.out));fail('Vercel curl /api/health FAILED. Check Runtime Logs: vercel logs --deployment '+url+' --level error --since 1h');}
 let obj;try{obj=JSON.parse(r.out.trim())}catch{say('API tra ve '+r.out.slice(0,200).replace(/\s+/g,' '));fail('API /api/health tra HTML/van ban, KHONG PHAI HEXA JSON. Kiem tra Root Directory backend, framework Express va Deployment Protection.');}
 if(obj.ok!==true||obj.service!=='hexa-it-helpdesk')fail('API /api/health tra JSON khong dung hexa-it-helpdesk.');
 say('OK: authenticated API health HEXA JSON.');
 // Verify public production alias is accessible independently of bypassed CLI.
 try{
  const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),18000);
  let res;try{res=await fetch(API_URL+'/api/health',{redirect:'manual',signal:ctrl.signal})}finally{clearTimeout(timer)};
  const body=await res.text();let j;try{j=JSON.parse(body)}catch{}
  if(res.status!==200||j?.ok!==true||j?.service!=='hexa-it-helpdesk')fail('API PRODUCTION URL '+API_URL+' public check failed: HTTP '+res.status+' content-type '+(res.headers.get('content-type')||'?')+'. Vercel Security Deployment Protection/Domains or API routing may be blocking it.');
  say('OK: public production API '+API_URL+'/api/health');
 }catch(e){fail('Public API check: '+e.message)}
}
async function main(){
 say('=== HEXA DIRECT SOURCE - VERCEL DEPLOY ===');say('Project: '+ROOT);say('Projects: '+API_NAME+' / '+WEB_NAME);
 npmFile=npmCLI();checkLocal();
 if(process.argv.includes('--check-only')){say('CHECK-ONLY: source and Node/npm OK. No deployment.');return;}
 const fb=getFirebase();
 // Local tests first, before any production changes.
 localTests(fb);
 cleanup();
 auth();
 link(API_NAME,'backend');say('=== API ENV ===');envSet(fb.backendEnv);
 const apiUrl=deployment(API_NAME);await apiCheck(apiUrl);
 link(WEB_NAME,'frontend');say('=== WEB ENV ===');envSet(fb.frontendEnv);
 const webUrl=deployment(WEB_NAME);
 say('DONE. Frontend deployment '+webUrl);say('Production aliases: '+API_URL+' / '+WEB_URL);
 say('Verify Firebase Authentication authorized domains include '+WEB_NAME+'.vercel.app');
}
main().catch(e=>{say('\n[STOP] '+e.message);say('No Firebase data or Git repository was deleted.');process.exitCode=1}).finally(()=>{writeLog();say('Diagnostic log (no env secret values): '+logPath)});
