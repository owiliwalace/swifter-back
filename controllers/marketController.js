import {getMarketData,markets} from '../services/marketData.js';
export async function marketHistory(req,res){
 const symbol=req.query.symbol||markets[0].symbol;
 if(!markets.some(m=>m.symbol===symbol))return res.status(400).json({error:'Choose a supported market.'});
 try{res.json(await getMarketData(symbol));}catch{return res.status(503).json({error:'Live market data is temporarily unavailable. Please retry.'});}
}
export async function scanMarkets(_req,res){
 const results=await Promise.allSettled(markets.map(m=>getMarketData(m.symbol)));
 const rows=results.filter(r=>r.status==='fulfilled').map(({value:{prices,times,...analysis}})=>analysis);
 if(!rows.length)return res.status(503).json({error:'The market feed is unavailable. Please retry the scan.'});
 res.json({markets:rows,unavailable:markets.filter((_,i)=>results[i].status==='rejected').map(m=>m.name),method:'Observed frequencies in the latest 500 ticks. Historical frequencies are not win probabilities or trade recommendations.'});
}
