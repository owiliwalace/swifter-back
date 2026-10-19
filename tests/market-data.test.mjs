import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeTicks,getMarketData} from '../services/marketData.js';
test('scanner uses provider precision, counts trailing zeroes and includes unchanged ticks',()=>{
 const prices=Array.from({length:20},(_,i)=>i%2?12.31:12.3),times=prices.map((_,i)=>100+i);
 const data=analyzeTicks(prices,times,2);
 assert.equal(data.digits[0].count,10);assert.equal(data.digits[1].count,10);
 assert.equal(data.digits.reduce((sum,row)=>sum+row.count,0),20);
 assert.equal(data.even_percent,50);assert.equal(data.odd_percent,50);
 assert.equal(data.rising_percent,52.63);assert.equal(data.falling_percent,47.37);
 assert.deepEqual(data.hot_digits,[0,1]);
 const flat=analyzeTicks(Array(20).fill(12.3),times,2);
 assert.equal(flat.unchanged_percent,100);assert.equal(flat.change_percent,0);
});
test('scanner rejects malformed, short or unsupported input',async()=>{
 const prices=Array(20).fill(10),times=prices.map((_,i)=>i);
 for(const args of [[[],[],2],[prices,times.slice(1),2],[prices,times,undefined],[prices,times,11],[[NaN,...prices.slice(1)],times,2],[prices,[100,...times.slice(1)],2]])assert.throws(()=>analyzeTicks(...args));
 await assert.rejects(getMarketData('invalid'));
});
