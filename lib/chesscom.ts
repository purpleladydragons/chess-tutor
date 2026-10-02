import { DEFAULT_POSITION } from 'chess.js';
import { chessComLink, parsePgnGame, type Game } from './chess';

export type ChessComGame = {
  url?:string;pgn?:string;rules?:string;rated?:boolean;time_class?:string;end_time?:number;initial_setup?:string;
  white?:{username?:string;rating?:number};black?:{username?:string;rating?:number};
};
export function fromChessCom(raw:ChessComGame):Game|null {
  if(raw.rules!=='chess'||!raw.pgn||(raw.initial_setup&&raw.initial_setup!==DEFAULT_POSITION))return null;
  const link=chessComLink(raw.url);if(!link)return null;
  try {
    const game=parsePgnGame(raw.pgn);if(!game)return null;
    // Keep PGN game ratings. The JSON player.rating is documented as post-game;
    // never subtract neighboring games or infer a missing per-game rating change.
    return {...game,...link,source:'chesscom',white:raw.white?.username??game.white,black:raw.black?.username??game.black,
      rated:raw.rated===true,ratedUnknown:typeof raw.rated!=='boolean',
      speed:raw.time_class==='daily'?'correspondence':['bullet','blitz','rapid'].includes(raw.time_class??'')?raw.time_class!:game.speed};
  } catch {return null;}
}

type ImportOptions={signal:AbortSignal;onProgress:(received:number,month:string)=>void;fetcher?:typeof fetch};
export async function importChessCom(username:string,max:number,{signal,onProgress,fetcher=fetch}:ImportOptions):Promise<{games:Game[];skipped:number}> {
  if(![100,1000,5000,10000].includes(max))throw new Error('Choose a supported game limit.');
  const endpoint=`/api/chesscom?username=${encodeURIComponent(username)}`;
  async function read(url:string){
    signal.throwIfAborted();const response=await fetcher(url,{signal});
    const parsed:unknown=await response.json().catch(()=>null);
    const data=parsed&&typeof parsed==='object'?parsed as Record<string,unknown>:{};
    if(!response.ok)throw new Error(typeof data.error==='string'?data.error:'Chess.com could not be reached. Try again or upload a PGN.');
    return data;
  }
  const archive=await read(endpoint);
  if(!Array.isArray(archive.months))throw new Error('Chess.com returned an invalid archive list.');
  const months=[...new Set<string>(archive.months.filter((m:unknown)=>typeof m==='string'&&/^\d{4}\/(0[1-9]|1[0-2])$/.test(m)))].sort().reverse();
  const games:Game[]=[];let received=0,skipped=0;const seen=new Set<string>();
  for(const month of months){
    onProgress(received,month);const data=await read(`${endpoint}&month=${month}`);
    if(!Array.isArray(data.games))throw new Error('Chess.com returned an invalid game archive.');
    const records=(data.games as ChessComGame[]).sort((a,b)=>(b.end_time??0)-(a.end_time??0));
    for(const raw of records){
      signal.throwIfAborted();if(raw.url&&seen.has(raw.url))continue;if(raw.url)seen.add(raw.url);
      const game=fromChessCom(raw);received++;
      if(game&&[game.white,game.black].some(n=>n.toLowerCase()===username.toLowerCase()))games.push(game);else skipped++;
      onProgress(received,month);if(received>=max)return {games,skipped};
      if(received%20===0)await new Promise(resolve=>setTimeout(resolve,0));
    }
  }
  return {games,skipped};
}
