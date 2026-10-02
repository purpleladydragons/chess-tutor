import test from 'node:test';
import assert from 'node:assert/strict';
import { unstable_dev } from 'wrangler';
test('built worker serves the opening explorer, metadata, and import validation',async()=>{
 const worker=await unstable_dev('dist/server/index.js',{config:'dist/server/wrangler.json',local:true,port:0,inspectorPort:0,logLevel:'error',experimental:{disableExperimentalWarning:true,disableDevRegistry:true,watch:false}});
 try{
  const response=await worker.fetch('/',{headers:{accept:'text/html'}});
  assert.equal(response.status,200);
  const html=await response.text();
  assert.match(html,/Your games\. A clearer plan\./);assert.match(html,/Your opening paths/);assert.match(html,/Import games/);assert.match(html,/Sample library/);assert.match(html,/1\. e4 c6 2\. d4 d5/);assert.match(html,/og\.png/);assert.doesNotMatch(html,/codex-preview|react-loading-skeleton/);
  assert.match(html,/Study priorities/);
  const invalid=await worker.fetch('/api/lichess?username=Alice&max=0');assert.equal(invalid.status,400);
  const icon=await worker.fetch('/favicon.png');assert.equal(icon.status,200);assert.match(icon.headers.get('content-type'),/image\/png/);
  const engine=await worker.fetch('/engine/stockfish-19-lite-single.wasm');assert.equal(engine.status,200);assert.match(engine.headers.get('content-type'),/application\/wasm/);
  assert.deepEqual([...new Uint8Array(await engine.arrayBuffer()).slice(0,4)],[0,97,115,109]);
 } finally{await worker.stop();}
});
