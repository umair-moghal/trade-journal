import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync('lib/journal.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {metrics,defaults,blank,summary,parseOCR,validate}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const t={...blank(),entry:'4202.541',sl:'4209.118',tp:'4192.052'};
let m=metrics(t,defaults);assert.ok(Math.abs(m.risk-6.577)<1e-8);assert.ok(Math.abs(m.reward-10.489)<1e-8);assert.equal(m.rr.toFixed(2),'1.59');assert.equal(m.result,'OPEN');
t.exit='4192.580';assert.equal(metrics(t,defaults).result,'OPEN');t.confirmed=true;m=metrics(t,defaults);assert.ok(Math.abs(m.points-99.61)<1e-6);assert.equal(m.result,'WIN');assert.ok(Math.abs(metrics(t,{...defaults,pointSize:.1}).points-99.61)<1e-6);
t.pnl='-1';assert.equal(metrics(t,defaults).result,'LOSS');t.pnl='0';assert.equal(metrics(t,defaults).result,'BREAKEVEN');
const b={...blank(),direction:'BUY',entry:'4200',sl:'4190',tp:'4220',exit:'4205',confirmed:true,pnl:'25'};assert.equal(metrics(b,defaults).rr,2);assert.equal(metrics(b,defaults).r,.5);assert.equal(metrics({...b,exit:'4190'},defaults).r,-1);assert.equal(metrics({...b,sl:'4195'},defaults).r,1);
assert.throws(()=>validate({...b,sl:'4210'}));validate({...b,sl:'4210',override:true});assert.throws(()=>validate({...b,exit:'',pnl:''}));const s=summary([b,{...b,pnl:'-10'},{...b,pnl:'0'},t],defaults);assert.equal(s.wins,1);assert.equal(s.losses,1);assert.equal(s.be,2);assert.equal(s.factor,2.5);
assert.deepEqual(parseOCR('XAUUSD Short Position Entry: 4202.541 Stop Loss: 4209.118 Take Profit: 4192.052 1m'),{symbol:'XAUUSD',direction:'SELL',entry:'4202.541',sl:'4209.118',tp:'4192.052',timeframe:'1m'});assert.equal(parseOCR('Current price 4192.580').exit,undefined);
console.log('PASS: planned RR, points settings, actual exits, P&L precedence, open status, edit recalculation, validation, aggregates, conservative OCR parsing');

const auto={...blank(),pnlMode:'auto',entry:'4050',actualEntry:'4050',exit:'4040',sl:'4052',tp:'4045',direction:'SELL',lot:'.01',confirmed:true};
for(const [lot,expected]of [['.01',10],['.02',20],['.05',50]]){const m=metrics({...auto,lot},defaults);assert.equal(m.points,100);assert.equal(m.pnl,expected);assert.equal(m.result,'WIN');}
assert.equal(metrics({...auto,exit:'4025'},defaults).pnl,25);
assert.equal(metrics({...auto,exit:'4060',lot:'.05'},defaults).pnl,-50);
assert.equal(metrics({...auto,direction:'BUY'},defaults).pnl,-10);
assert.equal(metrics({...auto,direction:'BUY',exit:'4060'},defaults).pnl,10);
assert.equal(metrics({...auto,actualEntry:'4040'},defaults).result,'BREAKEVEN');
assert.equal(metrics({...auto,lot:''},defaults).pnl,null);
assert.equal(metrics({...auto,exit:''},defaults).pnl,null);
assert.equal(metrics({...auto,confirmed:false},defaults).result,'WIN');assert.equal(metrics({...auto,confirmed:false},defaults).pnl,10);assert.equal(metrics({...auto,confirmed:false,exit:''},defaults).result,'OPEN');
assert.equal(metrics({...auto,pnl:'999'},defaults).pnl,10);
assert.equal(metrics({...auto,pnl:'8',pnlMode:'manual'},defaults).pnl,8);
assert.equal(metrics(auto,{...defaults,pointSize:.1}).pnl,10);
assert.equal(metrics(auto,{...defaults,currency:'PKR'}).pnl,null);
assert.equal(summary([auto,{...auto,lot:'.05'}],defaults).net,60);
assert.equal(metrics(JSON.parse(JSON.stringify(auto)),defaults).pnl,10);
console.log('PASS: automatic pip/lot P&L examples, BUY/SELL, edits, breakeven, missing values, manual override, settings, persistence and aggregates');

const supplied={...auto,confirmed:false,actualEntry:'4214.45',entry:'4214.45',exit:'4190.37'};
assert.ok(Math.abs(metrics(supplied,defaults).points-240.8)<1e-6);assert.equal(metrics(supplied,defaults).pnl,24.08);assert.equal(metrics({...supplied,lot:'.05'},defaults).pnl,120.4);

for(const [direction,entry,exit,points] of [['BUY','4190','4200',100],['BUY','4200','4190',-100],['SELL','4200','4190',100],['SELL','4190','4200',-100]]){
 for(const lot of ['.01','.02','.03','.05']){const trade={...auto,direction,entry,actualEntry:entry,exit,lot};const m=metrics(trade,{...defaults,pointSize:.01});assert.equal(m.points,points);assert.equal(m.pnl,points*Number(lot)*10);assert.equal(m.result,points>0?'WIN':'LOSS');}
}
assert.equal(metrics({...auto,symbol:'EURUSD'},{...defaults,pointSize:.01}).points,1000);
console.log('PASS: requested XAUUSD 4190/4200 examples, every lot size and direction, existing settings compatibility, other symbols unchanged');
