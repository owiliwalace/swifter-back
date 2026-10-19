import {createMysqlPool} from '../config/mysql.js';

let pool;
try{
  pool=createMysqlPool();
  const [rows]=await pool.execute('SELECT 1 AS connected, VERSION() AS version');
  console.log(JSON.stringify({ok:rows[0].connected===1,version:rows[0].version}));
  console.log('Connection verified only. Application queries and financial migrations still require MySQL conversion.');
}catch(error){
  // Never print raw driver errors: they may include hostnames, usernames or SQL.
  if(!pool)console.error(error.code==='ENOENT'?'DB_SSL_CA file was not found. Check its path.':error.code?'Unable to load MySQL connection configuration.':error.message);
  else console.error('MySQL connection failed. Check host, database access, credentials and TLS. Code:',/^[A-Z0-9_]+$/.test(error.code||'')?error.code:'UNKNOWN');
  process.exitCode=1;
}finally{if(pool)await pool.end();}
