import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const backendDirectory=fileURLToPath(new URL('../',import.meta.url));

export function mysqlOptions(env=process.env){
  const missing=['DB_HOST','DB_NAME','DB_USER','DB_PASSWORD'].filter(key=>!env[key]?.trim());
  if(missing.length)throw new Error('Set '+missing.join(', ')+' in backend/.env.');
  const port=Number(env.DB_PORT||3306);
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error('DB_PORT must be an integer from 1 to 65535.');
  const tls=(env.DB_SSL||'true').trim().toLowerCase();
  if(!['true','false'].includes(tls))throw new Error('DB_SSL must be true or false.');
  const caPath=env.DB_SSL_CA?.trim();
  if(caPath&&tls==='false')throw new Error('DB_SSL_CA requires DB_SSL=true.');
  return {
    host:env.DB_HOST.trim(),port,database:env.DB_NAME.trim(),user:env.DB_USER.trim(),password:env.DB_PASSWORD,
    charset:'utf8mb4',timezone:'Z',connectTimeout:10000,
    connectionLimit:5,waitForConnections:true,queueLimit:50,
    multipleStatements:false,decimalNumbers:false,supportBigNumbers:true,bigNumberStrings:true,
    ...(tls==='true'?{ssl:{rejectUnauthorized:true,...(caPath?{ca:fs.readFileSync(path.resolve(backendDirectory,caPath))}:{})}}:{}),
  };
}
