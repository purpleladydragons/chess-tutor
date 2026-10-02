import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { branches, filterGames, fromLichess, lineLabel, matchesPath, mergeGames, moveLabel, openingFor, outcome, parsePgnGame, rate, splitPgn, stats, type Game } from '../lib/chess';
import { DEMO_GAMES } from '../lib/demo';
const base:Game={id:'one',white:'Alice',black:'Bob',result:'0-1',moves:['e4','c6','d4','d5','e5'],date:Date.UTC(2026,8,30),speed:'rapid',rated:true};
const pgn=(extra='',moves='1. e4 c6 2. d4 d5 3. e5 0-1')=>`[Event "Rated rapid game"]\n[Site "https://lichess.org/abcd1234"]\n[Date "2026.09.30"]\n[White "Alice"]\n[Black "Bob"]\n[Result "0-1"]\n[TimeControl "600+5"]\n${extra}\n\n${moves}`;

test('results use the selected player color, including draws',()=>{
 assert.equal(outcome(base,'black'),'win');assert.equal(outcome(base,'white'),'loss');
 const draw={...base,id:'draw',result:'1/2-1/2' as const};assert.equal(outcome(draw,'black'),'draw');
 assert.deepEqual(stats([base,draw,{...base,result:'1-0'}],'black'),{total:3,win:1,draw:1,loss:1});
 assert.equal(rate(2,4),50);assert.equal(rate(0,0),0);
});
test('side, date, rated and speed filters work together without mixing players',()=>{
 const list=[base,{...base,id:'other',black:'Carol'},{...base,id:'casual',rated:false},{...base,id:'blitz',speed:'blitz'},{...base,id:'old',date:0}];
 assert.equal(filterGames(list,'bOB','black','rapid',90,true,Date.UTC(2026,9,1)).length,1);
 assert.equal(filterGames(list,'Alice','black').length,0);
});
test('branch counts preserve all games, and stops do not create imaginary moves',()=>{
 const games=[base,{...base,id:'two',moves:['e4','c6','d4','d5','exd5']},{...base,id:'end',moves:['e4','c6','d4','d5']}];
 const path=['e4','c6','d4','d5'];const b=branches(games,path,'black');
 assert.deepEqual(b.map(x=>x.move),['e5','exd5']);assert.equal(b.reduce((n,x)=>n+x.stats.total,0),2);
 assert.equal(games.filter(g=>matchesPath(g,path)).length,3);
 assert.equal(branches(games,['d4'],'black').length,0);
});
test('Caro-Kann names are assigned only when their defining moves have happened',()=>{
 assert.match(openingFor(['e4','c6']).name,/Caro-Kann/);
 assert.match(openingFor(['e4','c6','d4','d5','e5']).name,/Advance/);
 assert.match(openingFor(['e4','c6','d4','d5','exd5']).name,/Exchange/);
 assert.match(openingFor(['e4','c6','d4','d5','Nc3','dxe4','Nxe4','Bf5']).name,/Classical/);
 assert.doesNotMatch(openingFor(['e4','c6']).name,/Advance|Exchange|Classical/);
 assert.equal(openingFor(['e4','c6','d4','d5']).fen,openingFor(['d4','d5','e4','c6']).fen);
 assert.equal(openingFor(['e4','c6','d4','d5']).name,openingFor(['d4','d5','e4','c6']).name);
});
test('moves are explicitly numbered for either color',()=>{
 assert.equal(moveLabel('c6',1),'1... c6');assert.equal(moveLabel('e5',4),'3. e5');assert.equal(lineLabel(base.moves),'1. e4 c6 2. d4 d5 3. e5');
});
test('PGN parsing supports comments and side variations without importing them as the main line',()=>{
 const g=parsePgnGame(pgn('','1. e4 {comment: 1-0} c6 (1... e5 2. Nf3) 2. d4 d5 3. e5 0-1'))!;
 assert.deepEqual(g.moves,base.moves);assert.equal(g.speed,'rapid');assert.equal(g.rated,true);assert.equal(g.id,'abcd1234');assert.equal(g.result,'0-1');
});
test('multi-game splitting ignores results in comments, tags and variations',()=>{
 const first=pgn('','1. e4 { 1-0 } c6 (1... e5 2. Nf3) 2. d4 d5 3. e5 0-1');
 const second=pgn().replaceAll('abcd1234','efgh5678');
 const chunks=splitPgn(first+'\n\n'+second);assert.equal(chunks.length,2);assert.equal(parsePgnGame(chunks[1])?.id,'efgh5678');
});
test('unfinished, variant and nonstandard starting position PGNs are excluded',()=>{
 assert.equal(parsePgnGame(pgn().replaceAll('0-1','*')),null);
 assert.equal(parsePgnGame(pgn('[Variant "Chess960"]')),null);
 assert.equal(parsePgnGame(pgn('[SetUp "1"]')),null);
 assert.throws(()=>parsePgnGame(pgn('','1. e4 e4 0-1')));
});
test('stable PGN identities allow repeat imports without duplicates',()=>{
 const g=parsePgnGame(pgn().replace('https://lichess.org/abcd1234','?'))!;
 assert.equal(g.id,parsePgnGame(pgn().replace('https://lichess.org/abcd1234','?'))!.id);
 assert.equal(mergeGames([base,g],[g,base]).length,2);
 assert.equal(mergeGames([base],[{...base,speed:'blitz'}])[0].speed,'blitz');
});
test('Lichess JSON handles completed games, draws and unsupported records',()=>{
 const raw={id:'abcd1234',variant:'standard',status:'resign',winner:'black',moves:'e4 c6',createdAt:100,players:{white:{user:{name:'Alice'}},black:{user:{name:'Bob'}}}};
 assert.equal(fromLichess(raw)?.result,'0-1');assert.equal(fromLichess({...raw,status:'draw',winner:undefined})?.result,'1/2-1/2');
 assert.equal(fromLichess({...raw,status:'aborted'}),null);assert.equal(fromLichess({...raw,variant:'chess960'}),null);assert.equal(fromLichess({...raw,status:'started'}),null);
});
test('every distinct demonstration line is legal and both colors are represented',()=>{
 const lines=new Set(DEMO_GAMES.map(g=>g.moves.join(' ')));
 for(const line of lines){const chess=new Chess();for(const move of line.split(' '))assert.ok(chess.move(move));}
 assert.ok(filterGames(DEMO_GAMES,'demo_player','white').length>0);assert.ok(filterGames(DEMO_GAMES,'demo_player','black').length>0);
});
