export type Confidence='high'|'medium'|'low';
export type Detection={values:Record<string,string>;confidence:Record<string,Confidence>;evidence:Record<string,string>;confirmed:boolean;warnings:string[]};
export type Box={x:number;y:number;width:number;height:number;kind:string;targetY?:number};
export type PriceLabel=Box&{price:number;score:number};
export const detectionFields=['symbol','direction','timeframe','date','time','entry','sl','tp','actualEntry','exit','pnl','result','points','rr'];
export function emptyDetection():Detection{return {values:{},confidence:Object.fromEntries(detectionFields.map(k=>[k,'low'])),evidence:{},confirmed:false,warnings:[]};}
export function priceNumber(raw:string):number|null{let s=raw.trim().replace(/\s/g,'');if(s.includes('.')&&s.includes(','))s=s.replace(/,/g,'');else if(s.includes(','))s=s.replace(',','.');if(!/^-?\d+(?:\.\d+)?$/.test(s))return null;const n=Number(s);return Number.isFinite(n)?n:null;}
export function inferDirection(entry:unknown,sl:unknown,tp:unknown){if([entry,sl,tp].some(v=>v===undefined||v===''))return '';const [e,s,t]=[entry,sl,tp].map(Number);return t>e&&e>s?'BUY':s>e&&e>t?'SELL':'';}
function put(d:Detection,k:string,v:string,c:Confidence,e:string){d.values[k]=v;d.confidence[k]=c;d.evidence[k]=e;}
export function analyzeText(text:string):Detection{const d=emptyDetection();
 if(/XAU\s*USD|Gold Spot\s*\/\s*U\.?S\.?\s*Dollar/i.test(text))put(d,'symbol','XAUUSD','high','Gold / USD chart heading');else if(/\bGOLD\b/i.test(text))put(d,'symbol','XAUUSD','medium','Gold label');
 const buys=/\blong position\b|(?:direction|side|type)\s*:?\s*(?:buy|long)/i.test(text),sells=/\bshort position\b|(?:direction|side|type)\s*:?\s*(?:sell|short)/i.test(text);if(buys!==sells)put(d,'direction',buys?'BUY':'SELL','high','Explicit position direction');else if(/\bBUY\b/i.test(text)!==/\bSELL\b/i.test(text))put(d,'direction',/\bBUY\b/i.test(text)?'BUY':'SELL','medium','Single visible order-side label');
 const num='([+-]?[0-9][0-9,]*(?:\\.[0-9]+)?)';const labels:Record<string,string>={entry:'(?:planned entry(?: price)?|open price|(?<!actual )\\bentry(?: price)?)',sl:'(?:stop[ -]?loss|stop price|\\bSL)',tp:'(?:take[ -]?profit|target price|\\bTP)',actualEntry:'(?:actual entry(?: price)?|filled entry(?: price)?|execution entry(?: price)?|entry fill(?: price)?)',exit:'(?:actual exit(?: price)?|exit(?: price)?|close(?:d)? price|exit fill(?: price)?)',pnl:'(?:net P[&/]?L|net profit(?:/loss)?|realized P[&/]?L|realized profit(?:/loss)?)'};
 for(const[k,label]of Object.entries(labels)){const m=text.match(new RegExp(label+'[ \\t]*[:=]?[ \\t]*(?:USD|[$€£])?[ \\t]*'+num,'i'));if(m){const v=priceNumber(m[1]);if(v!==null&&(k==='pnl'||v>0))put(d,k,String(v),'medium','Visible '+k+' label');}}
 const tf=text.match(/\b(1|2|3|5|10|15|30|45|60|120|240)\s*(?:m|min(?:ute)?s?)\b/i);const head=text.match(/(?:Dollar|XAUUSD|GOLD)[ \t]*[·•\-][ \t]*(\d+|\d+[mMhHdD])[ \t]*[·•\-]/i);if(head)put(d,'timeframe',/^\d+$/.test(head[1])?head[1]+'m':head[1].toLowerCase(),'high','Chart header interval');else if(tf)put(d,'timeframe',tf[1]+'m','medium','Timeframe label; verify selected interval');
 const clock=extractChartTime(text);if(clock)put(d,'time',clock.value,'medium',clock.evidence);
 // Broker execution panels use Open/Close Price under an explicit closed record.
 const executionRecord=/\b(?:closed trade|trade closed|executed trade|execution report|deal history)\b/i.test(text);
 if(executionRecord){
  const open=text.match(new RegExp('(?:open(?:ing)? price|filled at)[ \t]*[:=]?[ \t]*'+num,'i'));
  if(open){const n=priceNumber(open[1]);if(n!==null&&n>0)put(d,'actualEntry',String(n),'medium','Open/fill price in an explicit execution record');}
  // A position drawing's hypothetical Closed P&L is not a broker fill.
  const pnl=text.match(new RegExp('(?:net profit|net P[&/]?L|realized P[&/]?L)[ \t]*[:=]?[ \t]*(?:USD|[$])?[ \t]*'+num,'i'));
  if(pnl){const n=priceNumber(pnl[1]);if(n!==null)put(d,'pnl',String(n),'medium','Realized/net P&L in execution record');}
 }
 const dir=inferDirection(d.values.entry,d.values.sl,d.values.tp);if(dir)put(d,'direction',dir,'high','TP / entry / SL relationship');
 if(d.values.entry&&d.values.sl&&d.values.tp&&!dir){d.warnings.push('Conflicting planned levels: verify the position panel.');for(const k of ['entry','sl','tp','direction'])d.confidence[k]='medium';}
 // Position-tool paper profit and live quotes are not execution records.
 d.confirmed=!!(d.values.exit||d.values.pnl)&&/actual exit|exit fill|closed trade|trade closed|realized|net P[&/]?L/i.test(text);
 if(d.confirmed&&d.values.pnl){const v=Number(d.values.pnl);put(d,'result',v>0?'WIN':v<0?'LOSS':'BREAKEVEN','medium','Explicit final P&L');}
 return d;
}
function color(r:number,g:number,b:number){if(r>110&&r>g*1.3&&r>b*1.15)return 'red';if(g>85&&g>r*1.2&&g>b*1.03)return 'green';if(b>100&&b>r*1.3&&b>g*1.07)return 'blue';if(r>=65&&r<210&&Math.max(r,g,b)-Math.min(r,g,b)<35)return 'gray';return '';}
export function scanChart(p:Uint8ClampedArray|Uint8Array,w:number,h:number):{labels:Box[];risk:Box[]}{const labels:Box[]=[];
 for(const kind of ['red','green','blue','gray']){for(let y=0;y<h;y++){let start=-1,best=[0,0];for(let x=Math.floor(w*.82);x<w;x++){const i=(y*w+x)*4,yes=color(p[i],p[i+1],p[i+2])===kind;if(yes){if(start<0)start=x;}else{if(start>=0&&x-start>best[1]-best[0])best=[start,x];start=-1;}}if(start>=0&&w-start>best[1]-best[0])best=[start,w];if(best[1]-best[0]<Math.max(30,w*.018))continue;
 const x0=best[0],x1=best[1];let end=y+1;for(;end<h&&end-y<90;end++){const at=(x:number)=>{const i=(end*w+x)*4;return color(p[i],p[i+1],p[i+2])===kind;};if(!at(x0+2)&&!at(x1-3))break;}if(end-y>=7){labels.push({x:x0,y,width:x1-x0,height:end-y,kind});y=end-1;}}}
 const risk:Box[]=[];let band:Box|null=null;for(let y=Math.floor(h*.07);y<h*.9;y++){let start=-1,best=[0,0];for(let x=Math.floor(w*.05);x<w*.9;x++){const i=(y*w+x)*4,r=p[i],g=p[i+1],b=p[i+2];const yes=r>40&&r>g*1.25&&r>b*1.1;if(yes){if(start<0)start=x;}else{if(start>=0&&x-start>best[1]-best[0])best=[start,x];start=-1;}}if(best[1]-best[0]>w*.08){if(band&&Math.abs(band.x+band.width-best[1])<8&&y<=band.y+band.height+3){band.height=y-band.y+1;band.x=Math.min(band.x,best[0]);band.width=best[1]-band.x;}else{if(band&&band.height>12)risk.push(band);band={x:best[0],y,width:best[1]-best[0],height:1,kind:'risk'};}}else if(band&&y>band.y+band.height+3){if(band.height>12)risk.push(band);band=null;}}if(band&&band.height>12)risk.push(band);
 // Follow the adjacent filled rectangle to the reward boundary. Gray themes are valid.
 const pixel=(x:number,y:number)=>{const i=(Math.round(y)*w+Math.round(x))*4;return [p[i],p[i+1],p[i+2]];};
 const distance=(a:number[],b:number[])=>Math.max(...a.map((v,i)=>Math.abs(v-b[i])));
 for(const r of risk){for(const side of [-1,1]){const start=side===1?r.y+r.height:r.y;const sy=start+side*5;if(sy<0||sy>=h)continue;const base=pixel(r.x+r.width*.93,sy),outside=pixel(Math.min(w-1,r.x+r.width+12),sy);if(distance(base,outside)<24)continue;
 let end=start,miss=0;for(let y=sy;y>h*.06&&y<h*.92;y+=side){const count=[.15,.35,.55,.75,.93].filter(f=>distance(pixel(r.x+r.width*f,y),base)<20).length;if(count>=3){end=y;miss=0;}else if(++miss>3)break;}
 if(Math.abs(end-start)>15){r.targetY=end;break;}
 }}
 return {labels:labels.filter(b=>b.height<90).sort((a,b)=>a.y-b.y),risk};}
export function matchPosition(labels:PriceLabel[],risk:Box[]):Detection{const d=emptyDetection(),candidates:any[]=[];const center=(b:Box)=>b.y+b.height/2;
 for(const r of risk){const top=r.y,bottom=r.y+r.height;for(const sl of labels.filter(l=>l.kind==='red')){const edge=Math.abs(center(sl)-top)<Math.abs(center(sl)-bottom)?top:bottom;if(Math.abs(center(sl)-edge)>Math.max(15,sl.height))continue;const entryY=edge===top?bottom:top;for(const e of labels.filter(l=>l!==sl&&Math.abs(center(l)-entryY)<Math.max(18,l.height))){const dir=sl.price>e.price?'SELL':'BUY';if((dir==='SELL')!==(edge===top))continue;const targets=labels.filter(l=>l!==sl&&l!==e&&l.kind!=='red'&&(dir==='SELL'?l.price<e.price&&center(l)>center(e):l.price>e.price&&center(l)<center(e)));const valid=targets.filter(l=>l.height<=Math.max(sl.height,e.height)*1.45);let tp:PriceLabel|undefined;
 if(r.targetY!==undefined){const scale=(sl.price-e.price)/(center(sl)-center(e));const expected=e.price+(r.targetY-entryY)*scale;
 const ranked=valid.map(l=>({l,error:Math.abs(l.price-expected)/Math.abs(scale)})).filter(v=>v.error<Math.max(7,e.height*.7)&&Math.abs(center(v.l)-r.targetY!)<Math.max(60,v.l.height*3)).sort((a,b)=>a.error-b.error);
 if(ranked.length===1||(ranked[1]&&ranked[1].error-ranked[0].error>3))tp=ranked[0]?.l;
 }else if(valid.length===1)tp=valid[0];
 candidates.push({sl,e,tp,dir});}}}
 if(candidates.length!==1){if(candidates.length>1)d.warnings.push('More than one position tool found. Crop to one trade.');return d;}
 const {sl,e,tp,dir}=candidates[0];for(const[k,label]of [['entry',e],['sl',sl],['tp',tp]] as const)if(label)put(d,k,String(label.price),label.score>=80?'high':'medium','Price-axis label matched to position-tool boundaries');put(d,'direction',dir,'high','Stop, entry and target price ordering');return d;
}
export function mergeDetection(text:Detection,position:Detection):Detection{const d:Detection={values:{...text.values,...position.values},confidence:{...text.confidence},evidence:{...text.evidence,...position.evidence},confirmed:text.confirmed||position.confirmed,warnings:[...text.warnings,...position.warnings]};for(const k of Object.keys(position.values))d.confidence[k]=position.confidence[k];const dir=inferDirection(d.values.entry,d.values.sl,d.values.tp);if(dir)put(d,'direction',dir,'high','Price ordering');if(dir){const risk=Math.abs(Number(d.values.entry)-Number(d.values.sl)),reward=Math.abs(Number(d.values.tp)-Number(d.values.entry));if(risk>0)put(d,'rr',String(reward/risk),'high','Calculated from extracted prices');}if(d.values.entry&&d.values.exit&&d.values.direction&&d.confirmed){const movement=(Number(d.values.exit)-Number(d.values.actualEntry||d.values.entry))*(d.values.direction==='BUY'?1:-1);d.confidence.points='medium';d.evidence.points='Derived from confirmed entry/exit and configured point size';if(!d.values.result)put(d,'result',movement>0?'WIN':movement<0?'LOSS':'BREAKEVEN','medium','Confirmed exit price movement');}return d;}

/** Date deliberately comes from the user's local calendar, never OCR. */
export function localToday(now=new Date()) {return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;}
export function extractChartTime(text:string):{value:string;evidence:string}|null {
 const pattern=/\b(\d{1,2}):([0-5]\d)(?::([0-5]\d))?\s*(AM|PM)?\s*(?:(UTC|GMT)\s*([+−-]\s*\d{1,2}(?::\d{2})?)?|\b(PKT))?/gi;
 const candidates=[...text.matchAll(pattern)].filter(m=>Number(m[1])<24&&(!m[4]||(Number(m[1])>=1&&Number(m[1])<=12)));
 // Prefer a clock with timezone, then a labeled execution time, then a seconds clock.
 const match=candidates.find(m=>m[5]||m[7])||candidates.find(m=>/(?:trade|fill|execution)?\s*time\s*[:=]?\s*$/i.test(text.slice(Math.max(0,m.index!-30),m.index)))||candidates.find(m=>m[3]);
 if(!match)return null; // Do not mistake axis tick labels or candle countdowns for trade time.
 let hour=Number(match[1]);if(match[4])hour=hour%12+(/^PM$/i.test(match[4])?12:0);
 let minutes=hour*60+Number(match[2]);const known=!!(match[5]||match[7]);
 if(known){const tz=(match[6]||'+0').replace(/\s/g,'').replace('−','-');const [h,m]=tz.replace(/^[+-]/,'').split(':');const offset=match[7]?300:(tz.startsWith('-')?-1:1)*(Number(h)*60+Number(m||0));if(Math.abs(offset)>14*60)return null;minutes=(minutes+300-offset+1440)%1440;}
 return {value:`${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`,evidence:known?'Visible chart clock converted to PKT (UTC+5); verify execution time':'Visible screenshot time preserved; source timezone unknown — review before treating as PKT'};
}
export const screenshotFormKeys=['symbol','direction','timeframe','entry','sl','tp','actualEntry','exit','pnl','date','time'];
/** Shared by progressive updates, final form mapping and regression tests. */
export function screenshotFormValues(d:Detection){return Object.fromEntries(screenshotFormKeys.map(k=>[k,d.values[k]||'']));}
