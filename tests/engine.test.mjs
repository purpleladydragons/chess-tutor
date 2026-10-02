import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {parseEngineInfo,scoreForSide,scoreText,uciLineToSan,checkBranch} from '../lib/engine.ts';
test('engine parser ignores score bounds and normalizes Black correctly, including mate scores',()=>{
 const info=parseEngineInfo('info depth 18 seldepth 22 multipv 1 score cp 124 nodes 50234 pv e7e5 g1f3');
 assert.equal(info.cp,124);assert.equal(info.depth,18);assert.equal(scoreForSide(info,'black','black').cp,124);assert.equal(scoreForSide(info,'black','white').cp,-124);
 assert.equal(parseEngineInfo('info depth 12 score cp 55 lowerbound pv e2e4'),null);
 assert.equal(scoreText({mate:-2,depth:10,pv:[]}),'Mated in 2');assert.equal(scoreText({cp:0,depth:10,pv:[]}),'0.00');
});
test('principal variation converts promotions and checks to readable chess notation',()=>{
 assert.deepEqual(uciLineToSan('7k/P7/8/8/8/8/8/7K w - - 0 1',['a7a8q']),['a8=Q+']);
});
// Run the unmodified browser Worker script and WASM, using in-memory asset fetches.
// This exercises the real engine/client protocol without an external analysis service.
class EngineWorker {
 constructor(){
  this.timers=new Set();this.dead=false;
  const wrap=fn=>(callback,delay)=>{let timer;timer=fn(()=>{this.timers.delete(timer);if(!this.dead)try{callback();}catch(e){this.onerror?.(e);}},delay);this.timers.add(timer);return timer;};
  this.context={console,WebAssembly,URL,Response,Headers,ReadableStream,TextDecoder,TextEncoder,performance,setTimeout:wrap(setTimeout),clearTimeout,setInterval,clearInterval,
   fetch:async()=>new Response(fs.readFileSync(new URL('../public/engine/stockfish-19-lite-single.wasm',import.meta.url)),{headers:{'Content-Type':'application/wasm'}}),
   location:{origin:'http://localhost',pathname:'/engine/stockfish-19-lite-single.js',hash:''},onmessage:null,
   postMessage:data=>{if(!this.dead)this.onmessage?.({data});},close:()=>this.terminate()};
  this.context.self=this.context;
  vm.runInNewContext(fs.readFileSync(new URL('../public/engine/stockfish-19-lite-single.js',import.meta.url),'utf8'),this.context,{filename:'stockfish.js'});
 }
 postMessage(data){this.context.onmessage({data});}
 terminate(){this.dead=true;for(const t of this.timers)clearTimeout(t);this.timers.clear();}
}
test('real Stockfish finds Black’s mating reply and detects White’s move allowing mate',async()=>{
 const original=globalThis.Worker;globalThis.Worker=EngineWorker;
 try{
  const reply=await checkBranch(['f3','e5','g4'],'black',new AbortController().signal,()=>{});
  assert.equal(reply.kind,'reply');assert.equal(reply.best.mate,1);assert.equal(reply.bestLine[0],'Qh4#');
  const blunder=await checkBranch(['f3','e5','g4'],'white',new AbortController().signal,()=>{});
  assert.equal(blunder.kind,'my-move');assert.equal(blunder.played.mate,-1);assert.equal(blunder.drop,null);
  const controller=new AbortController();controller.abort();await assert.rejects(()=>checkBranch(['e4'],'white',controller.signal,()=>{}),{name:'AbortError'});
 }finally{globalThis.Worker=original;}
});
