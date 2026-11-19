import { createCipheriv,createDecipheriv,randomBytes } from 'node:crypto';
function keyFromEnv(value=process.env.MAIL_VAULT_KEY){
  if(!/^[a-f\d]{64}$/i.test(value||'')) throw Object.assign(new Error('Thiếu MAIL_VAULT_KEY: cần khóa ngẫu nhiên 32 byte dạng hex tại backend.'),{status:422});
  return Buffer.from(value,'hex');
}
export function encryptSecret(plain,key){
  if(typeof plain!=='string' || plain.length<1 || plain.length>512) throw Object.assign(new Error('Mật khẩu phải từ 1 đến 512 ký tự.'),{status:400});
  const iv=randomBytes(12);
  const cipher=createCipheriv('aes-256-gcm',keyFromEnv(key),iv);
  const encrypted=Buffer.concat([cipher.update(plain,'utf8'),cipher.final()]);
  return {v:1,iv:iv.toString('base64'),data:encrypted.toString('base64'),tag:cipher.getAuthTag().toString('base64')};
}
export function decryptSecret(sealed,key){
  const decipher=createDecipheriv('aes-256-gcm',keyFromEnv(key),Buffer.from(sealed.iv,'base64'));
  decipher.setAuthTag(Buffer.from(sealed.tag,'base64'));
  return Buffer.concat([decipher.update(Buffer.from(sealed.data,'base64')),decipher.final()]).toString('utf8');
}
export function safePortalURL(input){
  try {const url=new URL(input); if(url.protocol!=='https:'||url.username||url.password) return null;return url.href; }catch{return null;}
}
