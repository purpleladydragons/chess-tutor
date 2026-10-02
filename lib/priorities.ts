import { matchesPath, outcome, type Game, type Side, type Stats } from './chess';
import { addRatingGame, emptyRating, ratingPools, ratingPriority, type RatingSummary } from './ratings';

export type StudyMode = 'rating' | 'rating-net' | 'contrast' | 'volume' | 'perfect';
export type MoveOwner = 'all' | 'mine' | 'opponent';
export type StudyNode = { path: string[]; stats: Stats; rating:RatingSummary; parent?: StudyNode; children: Map<string, StudyNode> };
export type StudyTree = { root: StudyNode; nodes: StudyNode[]; total: number; overallLossRate: number; scope: string[]; maxMoves: number; ratingPools:string[] };
export type StudyCandidate = {
  path: string[]; stats: Stats; rating:RatingSummary; ratingPriority:number; owner: 'mine' | 'opponent'; siblings: {path:string[];stats:Stats;rating:RatingSummary}[];
  alternatives: Stats; frequency: number; lossRate: number; otherLossRate: number | null;
  adjustedGap: number; rawGap: number | null; priority: number; lossShare: number;
  firstAllLoss: boolean; branching: boolean;
};
const empty = (): Stats => ({total:0,win:0,draw:0,loss:0});
export function buildStudyTree(games: Game[], side: Side, scope: string[] = [], maxMoves = 12): StudyTree {
  const root: StudyNode = {path:scope,stats:empty(),rating:emptyRating(),children:new Map()};
  const nodes: StudyNode[] = [];
  const end = Math.max(scope.length, Math.min(40, maxMoves*2));
  for (const game of games) {
    if(!matchesPath(game,scope))continue;
    const result=outcome(game,side); root.stats.total++;root.stats[result]++;addRatingGame(root.rating,game,side);
    let node=root;
    for(let i=scope.length;i<Math.min(end,game.moves.length);i++){
      const move=game.moves[i];let child=node.children.get(move);
      if(!child){child={path:[...node.path,move],stats:empty(),rating:emptyRating(),parent:node,children:new Map()};node.children.set(move,child);nodes.push(child);}
      child.stats.total++;child.stats[result]++;addRatingGame(child.rating,game,side);node=child;
    }
  }
  return {root,nodes,total:root.stats.total,overallLossRate:root.stats.total?root.stats.loss/root.stats.total:0,scope,maxMoves,ratingPools:ratingPools(games.filter(g=>matchesPath(g,scope)))};
}
export function candidateFor(node: StudyNode, tree: StudyTree, side: Side): StudyCandidate {
  const siblings=[...(node.parent?.children.values()??[])].filter(n=>n!==node);
  const alternatives=empty();for(const n of siblings){for(const k of ['total','win','draw','loss'] as const) alternatives[k]+=n.stats[k];}
  const n=node.stats.total;const lossRate=n?node.stats.loss/n:0;
  // Five pseudo-games at the overall loss rate stabilize each comparison.
  // This is a descriptive ranking heuristic, not a causal estimate or significance test.
  const smoothed=(s:Stats)=>(s.loss+5*tree.overallLossRate)/(s.total+5);
  const adjustedGap=alternatives.total?Math.max(0,smoothed(node.stats)-smoothed(alternatives)):0;
  return {path:node.path,stats:node.stats,rating:node.rating,ratingPriority:ratingPriority(node.rating,tree.root.rating),owner:((node.path.length-1)%2===0)===(side==='white')?'mine':'opponent',
    siblings:siblings.map(s=>({path:s.path,stats:s.stats,rating:s.rating})).sort((a,b)=>b.stats.total-a.stats.total),alternatives,
    frequency:tree.total?n/tree.total:0,lossRate,otherLossRate:alternatives.total?alternatives.loss/alternatives.total:null,
    adjustedGap,rawGap:alternatives.total?lossRate-alternatives.loss/alternatives.total:null,
    priority:100*(tree.total?n/tree.total:0)*adjustedGap,lossShare:tree.total?100*node.stats.loss/tree.total:0,
    firstAllLoss:n>0&&node.stats.loss===n&&!!node.parent&&node.parent.stats.loss<node.parent.stats.total,
    branching:(node.parent?.children.size??0)>1};
}
export function related(a: string[], b: string[]) {return a.slice(0,Math.min(a.length,b.length)).every((move,i)=>move===b[i]);}
export function rankStudy(tree: StudyTree, side: Side, options: {mode:StudyMode;minGames:number;owner:MoveOwner;collapse:boolean;minMove?:number}) {
  const min=Math.max(2,options.minGames);
  if((options.mode==='rating'||options.mode==='rating-net')&&tree.ratingPools.length!==1)return {candidates:[],available:0,collapsed:0};
  let candidates=tree.nodes.filter(n=>n.stats.total>=min).map(n=>candidateFor(n,tree,side)).filter(c=>
    (options.owner==='all'||c.owner===options.owner) && Math.ceil(c.path.length/2)>=(options.minMove??1) &&
    (options.mode==='rating'?c.branching&&c.rating.count>=min&&c.ratingPriority>1e-9:options.mode==='rating-net'?c.branching&&c.rating.changeCount>=min&&c.rating.netChange<0:options.mode==='perfect'?c.firstAllLoss:options.mode==='volume'?c.branching&&c.stats.loss>0:c.branching&&c.alternatives.total>=min&&c.priority>0));
  candidates.sort((a,b)=>options.mode==='rating'?b.ratingPriority-a.ratingPriority||b.rating.count-a.rating.count:options.mode==='rating-net'?a.rating.netChange-b.rating.netChange||b.rating.changeCount-a.rating.changeCount:options.mode==='perfect'?a.path.length-b.path.length||b.stats.total-a.stats.total:options.mode==='volume'?b.lossShare-a.lossShare||a.path.length-b.path.length:b.priority-a.priority||b.stats.total-a.stats.total);
  const available=candidates.length;
  if(options.collapse){const picked:StudyCandidate[]=[];for(const candidate of candidates){if(!picked.some(p=>related(p.path,candidate.path)))picked.push(candidate);}candidates=picked;}
  return {candidates,available,collapsed:available-candidates.length};
}
