import { gameSource, outcome, type Game, type GameSource, type Side } from './chess';

export const RATING_POOLS = ['ultraBullet','bullet','blitz','rapid','classical','correspondence'] as const;
export type RatingBand = 'weaker'|'similar'|'stronger';
export type ScoreSummary = { count:number; actual:number; expected:number };
export type RatingSummary = ScoreSummary & {
  changeCount:number; netChange:number;
  bands:Record<RatingBand,ScoreSummary>;
};
const emptyScore=():ScoreSummary=>({count:0,actual:0,expected:0});
export const emptyRating=():RatingSummary=>({...emptyScore(),changeCount:0,netChange:0,bands:{weaker:emptyScore(),similar:emptyScore(),stronger:emptyScore()}});
export function ratingChange(game:Game,side:Side):number|undefined {
  const n=side==='white'?game.whiteRatingDiff:game.blackRatingDiff;
  return game.rated&&Number.isSafeInteger(n)?n:undefined;
}
// Transparent Elo approximation, not an attempt to reconstruct Lichess Glicko-2.
// Always use the two pre-game ratings in this game's own rating pool.
export function expectedScore(game:Game,side:Side):number|undefined {
  const own=side==='white'?game.whiteRating:game.blackRating;
  const opponent=side==='white'?game.blackRating:game.whiteRating;
  if(!game.rated||!Number.isSafeInteger(own)||!Number.isSafeInteger(opponent)||own!<=0||opponent!<=0)return undefined;
  return 1/(1+10**((opponent!-own!)/400));
}
export function addRatingGame(summary:RatingSummary,game:Game,side:Side){
  const change=ratingChange(game,side);
  if(change!==undefined){summary.changeCount++;summary.netChange+=change;}
  const expected=expectedScore(game,side);if(expected===undefined)return;
  const result=outcome(game,side);const actual=result==='win'?1:result==='draw'?.5:0;
  const gap=(side==='white'?game.blackRating!-game.whiteRating!:game.whiteRating!-game.blackRating!);
  const band=summary.bands[gap < -100?'weaker':gap > 100?'stronger':'similar'];
  for(const s of [summary,band]){s.count++;s.actual+=actual;s.expected+=expected;}
}
export function ratingPools(games:Game[]):string[]{
  const counts=new Map<string,number>();
  for(const g of games)if(g.rated&&RATING_POOLS.some(p=>p===g.speed))counts.set(g.speed,(counts.get(g.speed)??0)+1);
  return [...counts.keys()].sort((a,b)=>counts.get(b)!-counts.get(a)!||a.localeCompare(b));
}
export function ratingSources(games:Game[]):GameSource[]{
  const counts=new Map<GameSource,number>();for(const g of games)if(g.rated)counts.set(gameSource(g),(counts.get(gameSource(g))??0)+1);
  return [...counts.keys()].sort((a,b)=>counts.get(b)!-counts.get(a)!);
}
export function ratingCohort(games:Game[],pool:string,days:number,includeProvisional=false,now=Date.now(),source?:GameSource){
  return games.filter(g=>g.rated&&(!source||gameSource(g)===source)&&g.speed===pool&&RATING_POOLS.some(p=>p===pool)&&(!days||(g.date>0&&g.date>=now-days*86400000))&&(includeProvisional||(!g.whiteProvisional&&!g.blackProvisional)));
}
export function ratingPriority(branch:RatingSummary,scope:RatingSummary):number {
  if(!scope.count||!branch.count)return 0;
  // Five neutral pseudo-games shrink the observed shortfall toward zero.
  return 100*(branch.count/scope.count)*Math.max(0,(branch.expected-branch.actual)/(branch.count+5));
}
export function signedPoints(value:number):string{return `${value>0?'+':''}${value}`;}
