import test from 'node:test';
import assert from 'node:assert/strict';
import {mysqlOptions} from '../config/mysql-options.js';

const config={DB_HOST:'localhost',DB_NAME:'cpanel_app',DB_USER:'cpanel_user',DB_PASSWORD:' secret '};
test('MySQL config requires credentials without exposing supplied values',()=>{
  assert.throws(()=>mysqlOptions({...config,DB_NAME:''}),/^Error: Set DB_NAME in backend\/\.env\.$/);
  for(const port of ['0','65536','3.5','invalid'])assert.throws(()=>mysqlOptions({...config,DB_PORT:port}),/DB_PORT/);
});
test('MySQL connections verify TLS and preserve financial precision',()=>{
  const options=mysqlOptions(config);
  assert.equal(options.ssl.rejectUnauthorized,true);
  assert.equal(options.password,' secret ');
  assert.equal(options.decimalNumbers,false);
  assert.equal(options.bigNumberStrings,true);
  assert.equal(options.multipleStatements,false);
  assert.equal(mysqlOptions({...config,DB_SSL:'false'}).ssl,undefined);
  assert.throws(()=>mysqlOptions({...config,DB_SSL:'maybe'}),/DB_SSL/);
  assert.throws(()=>mysqlOptions({...config,DB_SSL:'false',DB_SSL_CA:'certificate.pem'}),/DB_SSL_CA/);
});
