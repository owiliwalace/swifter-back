import {admin} from '../config/supabase.js';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
if(!admin)throw new Error('Configure backend credentials first.');
const {data:buckets,error}=await admin.storage.listBuckets();if(error)throw new Error(error.message);
for(const id of ['site-assets','avatars','support-attachments','account-documents','trade-exports']){
 if(!buckets.some(bucket=>bucket.id===id)){const created=await admin.storage.createBucket(id,{public:false,fileSizeLimit:10485760});if(created.error)throw new Error(created.error.message);console.log('Created private bucket',id);}
}
const root=fileURLToPath(new URL('../../frontend/public/',import.meta.url));
let uploaded=0;
async function walk(dir){
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
 const file=path.join(dir,entry.name);if(entry.isDirectory()){await walk(file);continue;}
 const relative=path.relative(root,file).replaceAll('\\','/');
 const ext=path.extname(file),mime={'.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'}[ext];
 if(!mime)continue;
 const data=fs.readFileSync(file);
 const result=await admin.storage.from('site-assets').upload(relative,data,{contentType:mime,upsert:true});
 if(result.error)throw new Error(result.error.message);uploaded++;
 const record=await admin.from('site_files').upsert({object_path:relative,bucket:'site-assets',mime_type:mime,size_bytes:data.length},{onConflict:'object_path'});
 if(record.error&&record.error.code!=='PGRST205')console.log('File metadata pending:',record.error.code);
 }
}
await walk(root);console.log('Uploaded public site assets:',uploaded);
