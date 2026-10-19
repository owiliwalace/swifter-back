import test from 'node:test';
import assert from 'node:assert/strict';
import {frontendOrigin} from '../config/frontend.js';
test('production auth links default to the live frontend and normalize trailing slash',()=>{
 assert.equal(frontendOrigin({NODE_ENV:'production'}),'https://www.swifttrade.co.ke');
 assert.equal(frontendOrigin({NODE_ENV:'production',FRONTEND_URL:'https://www.swifttrade.co.ke/'}),'https://www.swifttrade.co.ke');
 assert.equal(frontendOrigin({NODE_ENV:'development'}),'http://localhost:5173');
});
test('production cannot silently send users to localhost',()=>{
 for(const url of ['http://localhost:5173','https://localhost','https://127.0.0.1','https://[::1]','https://www.swifttrade.co.ke/login'])assert.throws(()=>frontendOrigin({NODE_ENV:'production',FRONTEND_URL:url}));
});
