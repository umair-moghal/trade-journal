import fs from 'node:fs';import ts from 'typescript';import assert from 'node:assert/strict';
const compile=s=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64');
const shared=compile(fs.readFileSync('lib/screenshot-analysis.ts','utf8'));
const {firstTouch,readCandles}=await import(compile(fs.readFileSync('lib/chart-outcome.ts','utf8').replace("'./screenshot-analysis'",JSON.stringify(shared))));
const candles=(ranges)=>ranges.map(([low,high],i)=>({x:i*6,low,high,top:0,bottom:0}));
assert.equal(firstTouch(candles([[99,101],[95,102],[89,96]]),100,110,90).result,'WIN');
assert.equal(firstTouch(candles([[99,101],[95,111],[89,105]]),100,110,90).result,'LOSS');
assert.equal(firstTouch(candles([[99,101],[89,111]]),100,110,90).ambiguous,true);
assert.equal(firstTouch(candles([[89,101]]),100,110,90).ambiguous,true);
assert.equal(firstTouch(candles([[99,101],[98,104],[97,105]]),100,110,90).exit,undefined);
assert.equal(firstTouch(candles([[99,101],[100,105],[103,111]]),100,90,110).result,'WIN');
assert.equal(firstTouch(candles([[99,101],[89,105],[103,111]]),100,90,110).result,'LOSS');
assert.equal(firstTouch(candles([[80,89],[70,79]]),100,110,90).entered,false);
// Pixel fixture: gray body with an upper wick reaching the stop.
const w=100,h=100,p=new Uint8ClampedArray(w*h*4);const draw=(x,y)=>{let i=(y*w+x)*4;p[i]=p[i+1]=p[i+2]=150;p[i+3]=255;};
for(let x=20;x<=24;x++)for(let y=40;y<=50;y++)draw(x,y);for(let y=25;y<40;y++)draw(22,y);
const detected=readCandles(p,w,h,15,40,y=>100-y);assert.equal(detected.length,1);assert.equal(detected[0].high,75);assert.equal(detected[0].low,50);
console.log('PASS: chronological TP/SL, BUY/SELL, same-candle ambiguity, unentered/open setups and full wick extraction');
