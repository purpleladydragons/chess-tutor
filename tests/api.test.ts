import test from 'node:test';
import assert from 'node:assert/strict';
import { GET } from '../app/api/lichess/route';
test('import proxy rejects unsafe usernames and unsupported limits',async()=>{
 for(const query of ['username=../secrets&max=100','username=Alice&max=0','username=Alice&max=100000000']){
  const result=await GET(new Request(`https://app.example/api/lichess?${query}`));assert.equal(result.status,400);
 }
});
test('import proxy streams NDJSON and preserves Lichess rate-limit errors',async()=>{
 const original=globalThis.fetch;
 try {
  globalThis.fetch=async(input,init)=>{assert.ok(String(input).startsWith('https://lichess.org/api/games/user/Alice?'));assert.match(String(input),/finished=true/);assert.equal((init?.headers as Record<string,string>).Accept,'application/x-ndjson');return new Response('{"id":"one"}\n',{headers:{'Content-Type':'application/x-ndjson'}});};
  const result=await GET(new Request('https://app.example/api/lichess?username=Alice&max=100'));
  assert.equal(result.status,200);assert.equal(await result.text(),'{"id":"one"}\n');assert.equal(result.headers.get('cache-control'),'no-store');
  globalThis.fetch=async()=>new Response('',{status:429});
  const limited=await GET(new Request('https://app.example/api/lichess?username=Alice&max=100'));
  assert.equal(limited.status,429);assert.match(((await limited.json()) as {error:string}).error,/minute/);
 } finally{globalThis.fetch=original;}
});
