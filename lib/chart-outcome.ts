import {emptyDetection,type Detection,type PriceLabel,type Box} from './screenshot-analysis';
export type Candle={x:number;high:number;low:number;top:number;bottom:number};
/** Ordered OHLC ranges. The entry candle cannot establish intrabar ordering. */
export function firstTouch(candles:Candle[],entry:number,sl:number,tp:number){
 let entered=false;
 const gaps=candles.slice(1).map((c,i)=>c.x-candles[i].x).filter(g=>g>0).sort((a,b)=>a-b);const spacing=gaps[Math.floor(gaps.length/2)]||Infinity;let previous:number|undefined;
 for(const c of candles){
  if(entered&&previous!==undefined&&c.x-previous>spacing*2.5)return {entered:true,ambiguous:true};previous=c.x;
  const touchesEntry=c.low<=entry&&c.high>=entry;
  const stop=c.low<=sl&&c.high>=sl,target=c.low<=tp&&c.high>=tp;
  if(!entered){if(!touchesEntry)continue;entered=true;if(stop||target)return {entered:true,ambiguous:true};continue;}
  // A gap beyond a level also counts as a touch; exact broker fills remain unverified.
  const stopHit=sl>entry?c.high>=sl:c.low<=sl,targetHit=tp>entry?c.high>=tp:c.low<=tp;
  if(stopHit&&targetHit)return {entered:true,ambiguous:true};
  if(stopHit||targetHit)return {entered:true,ambiguous:false,exit:stopHit?sl:tp,result:stopHit?'LOSS':'WIN'};
 }
 return {entered,ambiguous:false};
}
/** Read candle bodies and their attached vertical wicks, not horizontal chart lines. */
export function readCandles(p:Uint8ClampedArray|Uint8Array,w:number,h:number,startX:number,endX:number,priceAt:(y:number)=>number):Candle[]{
 const bars:{x:number;top:number;bottom:number}[]=[];
 const ink=(x:number,y:number)=>{const i=(y*w+x)*4,r=p[i],g=p[i+1],b=p[i+2];return (r>145&&r>g*1.3&&r>b*1.15)||(g>130&&g>r*1.2)||(r>=125&&r<205&&Math.max(r,g,b)-Math.min(r,g,b)<32);};
 for(let x=Math.max(0,Math.floor(startX));x<Math.min(w,endX);x++){
  let bestTop=0,bestBottom=0,begin=-1,last=-1;
  for(let y=Math.round(h*.16);y<Math.round(h*.9);y++){
   if(ink(x,y)){if(begin<0)begin=y;last=y;}else if(begin>=0&&y-last>1){if(last-begin>bestBottom-bestTop){bestTop=begin;bestBottom=last;}begin=-1;}
  }
  if(begin>=0&&last-begin>bestBottom-bestTop){bestTop=begin;bestBottom=last;}
  if(bestBottom-bestTop>=3)bars.push({x,top:bestTop,bottom:bestBottom});
 }
 const groups:typeof bars[]=[];
 for(const b of bars){const group=groups.at(-1),last=group?.at(-1);if(last&&b.x===last.x+1&&b.top<=last.bottom+2&&b.bottom>=last.top-2)group!.push(b);else groups.push([b]);}
 return groups.filter(g=>g.length>=2&&g.length<=Math.max(12,w*.008)).map(g=>{const top=Math.min(...g.map(b=>b.top)),bottom=Math.max(...g.map(b=>b.bottom));return {x:(g[0].x+g.at(-1)!.x)/2,top,bottom,high:priceAt(top),low:priceAt(bottom)};});
}
export function analyzeChartOutcome(p:Uint8ClampedArray|Uint8Array,w:number,h:number,plan:Detection,labels:PriceLabel[],areas:Box[]):Detection{
 const d=emptyDetection();if(plan.values.exit||plan.values.pnl)return d; // Precise execution records take priority.
 const entry=Number(plan.values.entry),sl=Number(plan.values.sl),tp=Number(plan.values.tp);
 if(!entry||!sl||!tp||!['BUY','SELL'].includes(plan.values.direction))return d;
 const center=(b:Box)=>b.y+b.height/2;
 const stop=labels.find(l=>l.price===sl&&l.kind==='red'),open=labels.find(l=>l.price===entry);
 if(!stop||!open)return d;
 const area=areas.filter(a=>Math.min(Math.abs(center(stop)-a.y),Math.abs(center(stop)-a.y-a.height))<20&&Math.min(Math.abs(center(open)-a.y),Math.abs(center(open)-a.y-a.height))<20);
 if(area.length!==1)return d;
 const a=area[0],scale=(sl-entry)/(center(stop)-center(open));if(scale>=0)return d;
 const priceAt=(y:number)=>entry+(y-center(open))*scale;
 const candles=readCandles(p,w,h,a.x-4,Math.min(open.x,stop.x)-12,priceAt).filter(c=>c.x>=a.x-3);
 if(candles.length<3)return d;
 // The first detected candle must straddle the tool start, otherwise entry timing is unknown.
 if(candles[0].x-a.x>Math.max(12,w*.008)){d.warnings.push('Cannot locate the entry candle reliably. Actual outcome needs review.');return d;}
 if(candles[0].low>entry||candles[0].high<entry){d.warnings.push('Entry timing is not visible at the position start. Actual outcome needs review.');return d;}
 const outcome=firstTouch(candles,entry,sl,tp);
 if(outcome.entered){d.values.actualEntry=String(entry);d.confidence.actualEntry='medium';d.evidence.actualEntry='Chart-inferred: candle crosses the position-tool entry at its start; not a broker fill.';}
 if(outcome.ambiguous){d.warnings.push('Needs Review: entry/exit ordering or TP versus SL is ambiguous within one candle. No exit was assumed.');return d;}
 if(outcome.exit!==undefined){d.values.exit=String(outcome.exit);d.values.result=outcome.result!;d.confidence.exit='medium';d.confidence.result='medium';d.evidence.exit='Chart-inferred first '+(outcome.result==='WIN'?'TP':'SL')+' touch from candle bodies and wicks after entry. Assumes the planned order remained active; not a broker-confirmed fill.';d.evidence.result=d.evidence.exit;d.confirmed=true;d.warnings.push('Outcome inferred from chart candles. Review the entry and exit; broker fills, slippage and partial closes are not visible.');}
 return d;
}
