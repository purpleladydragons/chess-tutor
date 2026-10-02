import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStudyTree, rankStudy, candidateFor, related } from '../lib/priorities';
import { filterGames, matchesPath, type Game } from '../lib/chess';
import { DEMO_GAMES } from '../lib/demo';
let id=0;
function game(line:string,loss:boolean,side:'white'|'black'='white'):Game{return {id:String(id++),white:'me',black:'them',result:loss?(side==='white'?'0-1':'1-0'):(side==='white'?'1-0':'0-1'),moves:line.split(' '),date:0,speed:'rapid',rated:true};}
function dataset(){return [...Array.from({length:20},(_,i)=>game('e4 d5 exd5 Qxd5 Nc3',i<15)),...Array.from({length:80},(_,i)=>game('e4 e5 Nf3 Nc6 Bc4',i<20))];}
const options={mode:'contrast' as const,minGames:5,owner:'all' as const,collapse:true};
test('rank highlights a problematic opponent reply and suppresses a first move always played',()=>{
 const tree=buildStudyTree(dataset(),'white');const ranked=rankStudy(tree,'white',options).candidates;
 assert.equal(ranked[0].path.join(' '),'e4 d5');assert.equal(ranked[0].owner,'opponent');assert.equal(ranked[0].frequency,.2);assert.equal(ranked[0].lossRate,.75);assert.equal(ranked[0].otherLossRate,.25);assert.equal(ranked[0].rawGap,.5);
 assert.ok(ranked[0].priority>0&&ranked[0].priority<10);assert.equal(ranked.some(c=>c.path.join(' ')==='e4'),false);
 assert.equal(rankStudy(tree,'white',{...options,owner:'mine'}).candidates.length,0);
});
test('frequency times losses is explicitly a loss count per 100, with no double-counting draws',()=>{
 const games=dataset();games.push({...game('e4 d5 exd5',false),result:'1/2-1/2'});
 const tree=buildStudyTree(games,'white');const c=candidateFor(tree.nodes.find(n=>n.path.join(' ')==='e4 d5')!,tree,'white');
 assert.equal(c.stats.draw,1);assert.ok(Math.abs(c.lossShare-100*15/101)<1e-10);assert.ok(Math.abs(100*c.frequency*c.lossRate-c.lossShare)<1e-10);
});
test('all-loss search finds the fifth-move decision, suppresses its descendants and respects depth and sample limits',()=>{
 const games=[...Array.from({length:5},()=>game('e4 e6 d4 d5 e5 c5 c3 Nc6 Ba6 bxa6',true)),...Array.from({length:15},(_,i)=>game('e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6',i<3))];
 const tree=buildStudyTree(games,'white');const o={...options,mode:'perfect' as const,collapse:false};const r=rankStudy(tree,'white',o).candidates;
 assert.equal(r.length,1);assert.equal(r[0].path.at(-1),'Ba6');assert.equal(r[0].path.length,9);assert.equal(r[0].owner,'mine');
 assert.equal(rankStudy(tree,'white',{...o,minGames:6}).candidates.length,0);
 assert.equal(rankStudy(buildStudyTree(games,'white',[],4),'white',o).candidates.length,0);
 assert.equal(rankStudy(tree,'white',{...o,owner:'opponent'}).candidates.length,0);
});
test('a 1/1 loss does not qualify; siblings need a minimum sample for contrast',()=>{
 const games=[game('e4 d5',true),...Array.from({length:5},()=>game('e4 e5',false))];const tree=buildStudyTree(games,'white');
 assert.equal(rankStudy(tree,'white',{...options,minGames:2}).candidates.length,0);
 assert.equal(rankStudy(tree,'white',{...options,mode:'perfect',minGames:2}).candidates.length,0);
});
test('scoping changes denominators and comparisons exclude games ending at the parent',()=>{
 const games=[...dataset(),game('e4',true),...Array.from({length:10},()=>game('d4 d5',true))];
 const tree=buildStudyTree(games,'white',['e4']);assert.equal(tree.total,101);
 const c=candidateFor(tree.nodes.find(n=>n.path.join(' ')==='e4 d5')!,tree,'white');assert.equal(c.alternatives.total,80);assert.equal(c.frequency,20/101);
});
test('Black perspective and path-based grouping stay correct',()=>{
 const games=[...Array.from({length:8},()=>game('d4 d5 c4 e5',true,'black')),...Array.from({length:12},()=>game('d4 Nf6 c4 e6',false,'black'))];
 const r=rankStudy(buildStudyTree(games,'black'),'black',options).candidates;
 assert.equal(r[0].path.join(' '),'d4 d5');assert.equal(r[0].owner,'mine');assert.equal(r[0].stats.loss,8);
 assert.equal(related(['e4'],['e4','e6']),true);assert.equal(related(['e4','e6'],['e4','d5']),false);
});
test('demo offers French subvariation and repeated-loss examples without changing imported game data',()=>{
 const white=filterGames(DEMO_GAMES,'demo_player','white');const french=white.filter(g=>matchesPath(g,['e4','e6']));assert.ok(french.length>0);
 const r=rankStudy(buildStudyTree(white,'white',['e4','e6']),'white',{...options,mode:'perfect'}).candidates;
 assert.ok(r.some(c=>c.path.at(-1)==='Ba6'&&c.stats.total===7));
});
