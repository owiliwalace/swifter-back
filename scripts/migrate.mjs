import '../config/env.js';
import pg from 'pg';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
if(!process.env.DATABASE_URL)throw new Error('Add DATABASE_URL to backend/.env to run migrations.');
const client=new pg.Client({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:true},connectionTimeoutMillis:15000});
await client.connect();
try{
 await client.query('begin');
 await client.query("select pg_advisory_xact_lock(hashtext('swifttrade-schema'))");
 for(const relative of ['../supabase/schema.sql','../supabase/migrations/002_platform.sql']){
 await client.query(fs.readFileSync(fileURLToPath(new URL(relative,import.meta.url)),'utf8'));
 console.log('Applied',relative);
 }
 await client.query('commit');
}catch(error){await client.query('rollback');throw error;}finally{await client.end();}
