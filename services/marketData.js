export const markets=[10,25,50,75,100].map(value=>({symbol:`1HZ${value}V`,name:`Volatility ${value} (1s) Index`}));
const cache=new Map(),pending=new Map();
export function analyzeTicks(prices,times,pipSize){
 if(!Array.isArray(prices)||prices.length<20||prices.length!==times?.length||!Number.isInteger(pipSize)||pipSize<0||pipSize>10||prices.some(p=>!Number.isFinite(p)||p<=0)||times.some((t,i)=>!Number.isFinite(t)||(i>0&&t<times[i-1])))throw new Error('Invalid market history.');
 const counts=Array(10).fill(0);let rising=0,falling=0,unchanged=0;
 prices.forEach((price,i)=>{counts[Number(price.toFixed(pipSize).at(-1))]++;if(i){if(price>prices[i-1])rising++;else if(price<prices[i-1])falling++;else unchanged++;}});
 const percentage=(count,total=prices.length)=>Number((100*count/total).toFixed(2));
 const even=counts.reduce((sum,count,i)=>sum+(i%2===0?count:0),0);
 return {sample_size:prices.length,pip_size:pipSize,last_price:prices.at(-1),from:times[0],as_of:times.at(-1),change_percent:Number(((prices.at(-1)/prices[0]-1)*100).toFixed(4)),digits:counts.map((count,digit)=>({digit,count,percent:percentage(count)})),even_percent:percentage(even),odd_percent:percentage(prices.length-even),rising_percent:percentage(rising,prices.length-1),falling_percent:percentage(falling,prices.length-1),unchanged_percent:percentage(unchanged,prices.length-1),hot_digits:counts.flatMap((count,i)=>count===Math.max(...counts)?[i]:[]),cold_digits:counts.flatMap((count,i)=>count===Math.min(...counts)?[i]:[])};
}
export function getMarketData(symbol){
 if(!markets.some(m=>m.symbol===symbol))return Promise.reject(new Error('Unsupported market.'));
 const stored=cache.get(symbol);if(stored&&Date.now()-stored.fetchedAt<5000)return Promise.resolve(stored.data);
 if(pending.has(symbol))return pending.get(symbol);
 const task=new Promise((resolve,reject)=>{
  const socket=new WebSocket('wss://api.derivws.com/trading/v1/options/ws/public');let done=false;
  const finish=(error,data)=>{if(done)return;done=true;clearTimeout(timer);socket.close();error?reject(error):resolve(data);};
  const timer=setTimeout(()=>finish(new Error('Market data timed out. Please retry.')),12000);
  socket.onopen=()=>socket.send(JSON.stringify({ticks_history:symbol,end:'latest',count:500,style:'ticks',req_id:1}));
  socket.onerror=()=>finish(new Error('Market data connection unavailable.'));
  socket.onclose=()=>{if(!done)finish(new Error('Market data connection closed.'));};
  socket.onmessage=event=>{try{
   const message=JSON.parse(event.data);if(message.req_id!==1)return;
   if(message.error)return finish(new Error('Market provider could not supply this market.'));
   if(!message.history)return;
   const {prices,times}=message.history;
   const analysis=analyzeTicks(prices,times,message.pip_size);
   if(Math.abs(Date.now()/1000-analysis.as_of)>60)throw new Error('Market data is stale. Please retry.');
   finish(null,{symbol,name:markets.find(m=>m.symbol===symbol).name,provider:'Deriv',prices,times,...analysis});
  }catch(error){finish(error);}};
 }).then(data=>{cache.set(symbol,{data,fetchedAt:Date.now()});return data;}).finally(()=>pending.delete(symbol));
 pending.set(symbol,task);return task;
}
