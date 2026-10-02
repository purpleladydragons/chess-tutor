import test from 'node:test';
import assert from 'node:assert/strict';
import { chessComLink, gameSource, mergeGames, parsePgnGame, timeControlSpeed } from '../lib/chess';
import { fromChessCom, importChessCom, type ChessComGame } from '../lib/chesscom';
import { ratingCohort, expectedScore } from '../lib/ratings';
import { buildStudyTree, rankStudy } from '../lib/priorities';
import { GET } from '../app/api/chesscom/route';

const pgn=(id='123',extra='',moves='1. e4 c6 2. d4 d5 0-1')=>`[Event "Live Chess"]\n[Site "Chess.com"]\n[Date "2026.10.02"]\n[UTCDate "2026.10.02"]\n[UTCTime "12:00:00"]\n[White "Alice"]\n[Black "Bob"]\n[WhiteElo "1500"]\n[BlackElo "1600"]\n[Result "0-1"]\n[TimeControl "300"]\n[Link "https://www.chess.com/game/live/${id}"]\n${extra}\n\n${moves}`;
const record=(id='123',end=10):ChessComGame=>({url:`https://www.chess.com/game/live/${id}`,rules:'chess',pgn:pgn(id),rated:true,time_class:'blitz',end_time:end,white:{username:'Alice',rating:1492},black:{username:'Bob',rating:1608}});

test('Chess.com PGNs preserve game identity, comments, ratings, time controls and unknown rated status',()=>{
 const g=parsePgnGame(pgn('123','','1. e4 {[%clk 0:04:59]} c6 (1... e5) 2. d4 d5 0-1'))!;
 assert.equal(g.id,'chesscom-live-123');assert.equal(g.source,'chesscom');assert.equal(g.speed,'blitz');assert.equal(g.whiteRating,1500);assert.equal(g.blackRating,1600);assert.equal(g.rated,false);assert.equal(g.ratedUnknown,true);assert.equal(g.whiteRatingDiff,undefined);
 assert.deepEqual(g.moves,['e4','c6','d4','d5']);assert.equal(g.date,Date.UTC(2026,9,2,12));
 assert.equal(chessComLink('https://www.chess.com/live/game/123')?.id,g.id);
 assert.notEqual(chessComLink('https://www.chess.com/game/daily/123')?.id,g.id);
 assert.equal(chessComLink('https://chess.com.evil.test/game/live/123'),undefined);
 assert.deepEqual(['60','180','300','600','1800','1/259200'].map(s=>timeControlSpeed(s,'chesscom')),['bullet','blitz','blitz','rapid','rapid','correspondence']);
 assert.equal(parsePgnGame(pgn('123','[Rated "false"]'))?.ratedUnknown,false);
 assert.equal(parsePgnGame(pgn('123','[Rated "true"]'))?.rated,true);
});
test('username imports use documented archive metadata without inventing rating changes or using post-game JSON ratings',()=>{
 const g=fromChessCom(record())!;assert.equal(g.rated,true);assert.equal(g.ratedUnknown,false);assert.equal(g.whiteRating,1500);assert.equal(g.blackRating,1600);assert.equal(g.whiteRatingDiff,undefined);assert.ok(expectedScore(g,'white')!<.5);
 assert.equal(fromChessCom({...record(),time_class:'daily'})?.speed,'correspondence');
 assert.equal(fromChessCom({...record(),time_class:'rapid'})?.speed,'rapid');
 for(const raw of [{...record(),rules:'chess960'},{...record(),pgn:pgn().replaceAll('0-1','*')},{...record(),pgn:'invalid'},{...record(),initial_setup:'8/8/8/8/8/8/8/8 w - - 0 1'}])assert.equal(fromChessCom(raw),null);
 const apiThenPgn=mergeGames([g],[parsePgnGame(pgn())!]);assert.equal(apiThenPgn.length,1);assert.equal(apiThenPgn[0].rated,true);
 const pgnThenApi=mergeGames([parsePgnGame(pgn())!],[g]);assert.equal(pgnThenApi.length,1);assert.equal(pgnThenApi[0].rated,true);
 const casual=fromChessCom({...record(),rated:false})!;assert.equal(mergeGames([casual],[parsePgnGame(pgn())!])[0].rated,false);
});
test('Chess.com and Lichess rating pools remain separate, including candidate review',()=>{
 const c=Array.from({length:6},(_,i)=>fromChessCom(record(String(i)))!);
 const l=c.map((g,i)=>({...g,id:`l-${i}`,source:'lichess' as const,url:`https://lichess.org/abcd000${i}`,moves:['e4','e5']}));
 const opts={mode:'rating' as const,minGames:2,owner:'all' as const,collapse:true};
 assert.equal(rankStudy(buildStudyTree([...c,...l],'white'),'white',opts).candidates.length,0);
 const cohort=ratingCohort([...c,...l],'blitz',0,false,Date.now(),'chesscom');assert.equal(cohort.length,6);assert.ok(cohort.every(g=>gameSource(g)==='chesscom'));
});
test('archive import reads months serially, sorts newest games first, caps records and skips unsupported games',async()=>{
 const urls:string[]=[];let active=0;
 const fetcher=(async(input:RequestInfo|URL)=>{
   assert.equal(active++,0);const url=String(input);urls.push(url);await Promise.resolve();active--;
   if(!url.includes('&month='))return Response.json({months:['2026/08','2026/10','2026/09']});
   if(url.endsWith('2026/10'))return Response.json({games:[record('1',1),{...record('2',2),rules:'chess960'}]});
   return Response.json({games:Array.from({length:120},(_,i)=>record(String(100+i),i+10))});
 }) as typeof fetch;
 const result=await importChessCom('aLICE',100,{signal:new AbortController().signal,onProgress:()=>{},fetcher});
 assert.equal(result.games.length,99);assert.equal(result.skipped,1);assert.equal(result.games[0].id,'chesscom-live-1');assert.equal(result.games[1].id,'chesscom-live-219');assert.equal(urls.length,3);assert.ok(urls[1].endsWith('2026/10'));assert.ok(urls[2].endsWith('2026/09'));
});
test('archive import errors and cancellation never return a misleading partial success',async()=>{
 const fetcher=(async(input:RequestInfo|URL)=>String(input).includes('&month=')?Response.json({error:'Rate limited'},{status:429}):Response.json({months:['2026/10']})) as typeof fetch;
 await assert.rejects(importChessCom('Alice',100,{signal:new AbortController().signal,onProgress:()=>{},fetcher}),/Rate limited/);
 const controller=new AbortController();controller.abort();let called=false;
 await assert.rejects(importChessCom('Alice',100,{signal:controller.signal,onProgress:()=>{},fetcher:(async()=>{called=true;return Response.json({});}) as typeof fetch}),{name:'AbortError'});assert.equal(called,false);
});
test('Chess.com proxy restricts requests to validated usernames and archive months and reports upstream errors',async()=>{
 for(const query of ['username=../secret','username=Alice&month=https://evil.test','username=Alice&month=2026/13'])assert.equal((await GET(new Request(`https://app.test/api/chesscom?${query}`))).status,400);
 const original=globalThis.fetch;
 try{
  let url='';globalThis.fetch=async(input,init)=>{url=String(input);assert.equal((init?.headers as Record<string,string>).Accept,'application/json');return Response.json({archives:['https://api.chess.com/pub/player/alice/games/2026/10','https://evil.test/2026/11','https://api.chess.com/pub/player/bob/games/2026/12']});};
  const result=await GET(new Request('https://app.test/api/chesscom?username=Alice'));assert.deepEqual(await result.json(),{months:['2026/10']});assert.equal(url,'https://api.chess.com/pub/player/alice/games/archives');
  globalThis.fetch=async(input)=>{url=String(input);return Response.json({games:[record()]});};
  const month=await GET(new Request('https://app.test/api/chesscom?username=Alice&month=2026/10'));assert.equal(month.status,200);assert.equal(url,'https://api.chess.com/pub/player/alice/games/2026/10');assert.equal(((await month.json()) as {games:ChessComGame[]}).games[0].rated,true);
  for(const status of [404,429,503]){globalThis.fetch=async()=>new Response('',{status});assert.equal((await GET(new Request('https://app.test/api/chesscom?username=Alice'))).status,status===503?502:status);}
 }finally{globalThis.fetch=original;}
});
