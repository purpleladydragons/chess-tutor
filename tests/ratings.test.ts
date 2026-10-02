import test from 'node:test';
import assert from 'node:assert/strict';
import { fromLichess, mergeGames, parsePgnGame, type Game } from '../lib/chess';
import { addRatingGame, emptyRating, expectedScore, ratingChange, ratingCohort, ratingPools, ratingPriority } from '../lib/ratings';
import { buildStudyTree, rankStudy } from '../lib/priorities';

let next=0;
const now=Date.UTC(2026,9,2);
function game(overrides:Partial<Game>={}):Game{return {id:String(next++),white:'me',black:'opponent',whiteRating:1600,blackRating:1600,result:'0-1',moves:['e4','e6'],date:now,speed:'rapid',rated:true,...overrides};}
const options={mode:'rating' as const,minGames:5,owner:'all' as const,collapse:true};
test('imports retain signed changes, zero changes and provisional flags without fabricating the other side',()=>{
 const raw={id:'abcdefgh',status:'draw',rated:true,moves:'e4 e5',players:{white:{rating:1600,ratingDiff:0,provisional:true},black:{rating:1800,ratingDiff:4}}};
 const g=fromLichess(raw)!;assert.equal(g.whiteRatingDiff,0);assert.equal(g.blackRatingDiff,4);assert.equal(g.whiteProvisional,true);
 assert.equal(fromLichess({...raw,players:{white:{rating:1600,ratingDiff:-12}}})?.blackRatingDiff,undefined);
 assert.equal(fromLichess({...raw,players:{white:{rating:Infinity,ratingDiff:NaN}}})?.whiteRating,undefined);
 assert.equal(fromLichess({...raw,players:{white:{ratingDiff:NaN}}})?.whiteRatingDiff,undefined);
 const pgn='[Event "Rated rapid game"]\n[White "me"]\n[Black "them"]\n[WhiteElo "1600"]\n[BlackElo "1800"]\n[WhiteRatingDiff "-12"]\n[BlackRatingDiff "+4"]\n[Result "0-1"]\n\n1. e4 e5 0-1';
 assert.equal(parsePgnGame(pgn)?.whiteRatingDiff,-12);assert.equal(parsePgnGame(pgn)?.blackRatingDiff,4);
 assert.equal(parsePgnGame(pgn.replace('-12','0'))?.whiteRatingDiff,0);
 assert.equal(parsePgnGame(pgn.replace('-12','?'))?.whiteRatingDiff,undefined);
});
test('repeat import enriches legacy games and a less complete PGN never erases known rating metadata',()=>{
 const old=game();const enriched={...old,whiteRatingDiff:0,blackRatingDiff:7,whiteProvisional:false};
 const merged=mergeGames([old],[enriched]);assert.equal(merged.length,1);assert.equal(merged[0].whiteRatingDiff,0);
 const again=mergeGames(merged,[{...old,whiteRating:undefined,whiteRatingDiff:undefined}])[0];
 assert.equal(again.whiteRating,1600);assert.equal(again.whiteRatingDiff,0);assert.equal(again.whiteProvisional,false);
 assert.equal(mergeGames([again],[{...old,whiteRatingDiff:-3}])[0].whiteRatingDiff,-3);
});
test('expected score uses the historical rating gap and correct color; draws count half',()=>{
 const g=game({blackRating:2000,result:'1/2-1/2',whiteRatingDiff:8,blackRatingDiff:-5});
 assert.ok(Math.abs(expectedScore(g,'white')!-1/11)<1e-12);assert.ok(Math.abs(expectedScore(g,'black')!-10/11)<1e-12);
 assert.equal(ratingChange(g,'black'),-5);const s=emptyRating();addRatingGame(s,g,'white');assert.equal(s.actual,.5);assert.equal(s.bands.stronger.count,1);
 for(const invalid of [undefined,0,-1,Infinity,NaN])assert.equal(expectedScore({...g,whiteRating:invalid},'white'),undefined);
 assert.equal(expectedScore({...g,rated:false},'white'),undefined);assert.equal(ratingChange({...g,rated:false},'white'),undefined);
});
test('beating weak opponents often can rank as a problem while losing often to strong opponents does not',()=>{
 const weak=Array.from({length:10},(_,i)=>game({blackRating:1200,result:i<8?'1-0':'0-1'}));
 const strong=Array.from({length:10},(_,i)=>game({blackRating:2000,result:i<2?'1-0':'0-1',moves:['e4','d5']}));
 const tree=buildStudyTree([...weak,...strong],'white');const rows=rankStudy(tree,'white',options).candidates;
 assert.deepEqual(rows.map(r=>r.path.join(' ')),['e4 e6']);assert.equal(rows[0].stats.win,8);
 assert.ok(Math.abs(rows[0].ratingPriority-100*.5*((100/11-8)/15))<1e-10);
 assert.equal(rows.some(r=>r.path.length===1),false);
 const scoped=rankStudy(buildStudyTree([...weak,...strong],'white',['e4']),'white',options).candidates;assert.equal(scoped[0].ratingPriority,rows[0].ratingPriority);
});
test('net ranking includes gains, draws and zeroes, uses own recorded change and counts frequency only once',()=>{
 const a=Array.from({length:10},(_,i)=>game({result:i<8?'1-0':'0-1',whiteRatingDiff:i<8?2:-12,blackRatingDiff:i<8?-1:5}));
 const b=Array.from({length:5},()=>game({moves:['e4','d5'],whiteRatingDiff:-3,result:'1/2-1/2'}));
 const rows=rankStudy(buildStudyTree([...a,...b],'white'),'white',{...options,mode:'rating-net'}).candidates;
 assert.equal(rows[0].path.join(' '),'e4 d5');assert.equal(rows[0].rating.netChange,-15);assert.equal(rows[1].rating.netChange,-8);
 const s=emptyRating();addRatingGame(s,game({whiteRatingDiff:0}),'white');addRatingGame(s,game(),'white');assert.equal(s.changeCount,1);assert.equal(s.netChange,0);
 const missing=Array.from({length:30},()=>game({whiteRating:undefined}));
 assert.equal(rankStudy(buildStudyTree([...missing,...b],'white'),'white',{...options,mode:'rating-net',minGames:6}).candidates.length,0);
});
test('rating queues keep pools separate and recency/provisional filtering also works for legacy dates',()=>{
 const recent=game(),old=game({date:now-91*86400000}),unknown=game({date:0}),provisional=game({blackProvisional:true}),blitz=game({speed:'blitz'}),casual=game({rated:false});
 const games=[recent,old,unknown,provisional,blitz,casual];assert.deepEqual(ratingPools(games),['rapid','blitz']);
 assert.deepEqual(ratingCohort(games,'rapid',90,false,now).map(g=>g.id),[recent.id]);
 assert.equal(ratingCohort(games,'rapid',90,true,now).length,2);assert.equal(ratingCohort(games,'rapid',0,false,now).length,3);
 assert.equal(ratingCohort(games,'unknown',0,false,now).length,0);
 assert.equal(rankStudy(buildStudyTree(games,'white'),'white',{...options,minGames:2}).candidates.length,0);
});
test('opponent bands expose cancellation hidden by the aggregate, and missing ratings do not dilute scores',()=>{
 const s=emptyRating();for(const gap of [-101,-100,100,101])addRatingGame(s,game({blackRating:1600+gap}),'white');
 assert.deepEqual(Object.values(s.bands).map(b=>b.count),[1,2,1]);
 const before=ratingPriority(s,s);addRatingGame(s,game({whiteRating:undefined,whiteRatingDiff:-10}),'white');assert.equal(s.count,4);assert.equal(ratingPriority(s,s),before);assert.equal(s.changeCount,1);
 const balanced=emptyRating();addRatingGame(balanced,game({blackRating:1200,result:'1-0'}),'white');addRatingGame(balanced,game({blackRating:2000,result:'0-1'}),'white');
 assert.ok(Math.abs(balanced.actual-balanced.expected)<1e-12);assert.ok(balanced.bands.stronger.actual<balanced.bands.stronger.expected);
 assert.ok(balanced.bands.weaker.actual>balanced.bands.weaker.expected);
});
