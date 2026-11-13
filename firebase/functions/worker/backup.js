import { getStorage } from 'firebase-admin/storage';
import { gzipSync } from 'node:zlib';
import { db } from './firebase.js';

// Full Realtime Database backup, including inventory, tickets and system settings.
// Backups are private GCS objects; no public URLs and no client-side access.
export async function performDailyDatabaseBackup(){
 const bucketName=(process.env.HEXA_BACKUP_BUCKET||'').trim();
 if(!bucketName){
   console.warn('[backup] HEXA_BACKUP_BUCKET missing; no backup created');
   await db.ref('inventoryBackupRuns/latest').set({status:'not_configured',at:Date.now()});
   return {status:'not_configured'};
 }
 const started=Date.now();
 try{
   const root=(await db.ref('/').get()).val()||{};
   // Avoid backing up the backup metadata itself on every run.
   delete root.inventoryBackupRuns;
   const content=gzipSync(Buffer.from(JSON.stringify({schema:'hexa-rtdb-v1',createdAt:started,database:root})),{level:6});
   const max=100*1024*1024;
   if(content.length>max)throw new Error('Backup compressed size >100MiB; use Firebase managed export for larger databases.');
   const prefix=new Date(started).toISOString().replace(/[:.]/g,'-');
   const filename=`hexa-rtdb-backups/${prefix}.json.gz`;
   const bucket=getStorage().bucket(bucketName);
   await bucket.file(filename).save(content,{resumable:false,metadata:{contentType:'application/gzip',cacheControl:'private, no-store'}});
   const latest={status:'success',at:Date.now(),startedAt:started,bytes:content.length,storagePath:`gs://${bucketName}/${filename}`};
   await db.ref('inventoryBackupRuns/latest').set(latest);
   // Purge only files created by this job, older than 30 days.
   const [files]=await bucket.getFiles({prefix:'hexa-rtdb-backups/'});
   const cutoff=started-30*86400000;
   for(const file of files){const created=Date.parse(file.metadata?.timeCreated||'');
     if(Number.isFinite(created)&&created<cutoff)await file.delete().catch(e=>console.warn('[backup] cleanup',e.message));}
   return latest;
 }catch(err){
   await db.ref('inventoryBackupRuns/latest').set({status:'failed',at:Date.now(),error:String(err.message).slice(0,200)}).catch(()=>{});
   throw err;
 }
}
