import { Chess } from 'chess.js';
import { type Side } from './chess';
export type EngineScore = {cp?:number;mate?:number;depth:number;pv:string[];bestMove?:string};
export type EngineResult = {kind:'my-move'|'reply';best:EngineScore;played?:EngineScore;drop:number|null;bestLine:string[];playedLine:string[];fen:string;engine:string};
export function parseEngineInfo(line:string):EngineScore|null {
  if(!line.startsWith('info ')||/\b(lowerbound|upperbound)\b/.test(line))return null;
  const score=line.match(/\bscore (cp|mate) (-?\d+)/);const depth=line.match(/\bdepth (\d+)/);
  if(!score||!depth)return null;
  const multi=line.match(/\bmultipv (\d+)/);if(multi&&multi[1]!=='1')return null;
  return {[score[1]]:Number(score[2]),depth:Number(depth[1]),pv:line.match(/\bpv (.+)$/)?.[1].trim().split(/\s+/)??[]};
}
export function scoreForSide(score:EngineScore,turn:Side,side:Side):EngineScore {
  const sign=turn===side?1:-1;
  return {...score,cp:score.cp===undefined?undefined:sign*score.cp,mate:score.mate===undefined?undefined:sign*score.mate};
}
export function scoreText(score:EngineScore):string {
  if(score.mate!==undefined)return score.mate===0?'Checkmate':score.mate>0?`Mate in ${score.mate}`:`Mated in ${Math.abs(score.mate)}`;
  if(score.cp===undefined)return 'Unavailable';
  return `${score.cp>0?'+':''}${(score.cp/100).toFixed(2)}`;
}
export function uciLineToSan(fen:string,pv:string[]):string[]{
  const board=new Chess(fen);const result:string[]=[];
  for(const move of pv.slice(0,8)){try{const m=board.move({from:move.slice(0,2),to:move.slice(2,4),promotion:move[4]});result.push(m.san);}catch{break;}}
  return result;
}
function cancelled(){return new DOMException('Analysis cancelled','AbortError');}
export async function checkBranch(path:string[],side:Side,signal:AbortSignal,onProgress:(text:string)=>void):Promise<EngineResult>{
  if(signal.aborted)throw cancelled();
  if(typeof Worker==='undefined'||typeof WebAssembly==='undefined')throw new Error('This browser cannot run the engine. Open the position in Lichess analysis instead.');
  const board=new Chess();for(const move of path)board.move(move);
  const last=board.history({verbose:true}).at(-1);
  const myMove=!!last&&last.color===(side==='white'?'w':'b');
  const fen=myMove?last.before:board.fen();
  const turn=fen.split(' ')[1]==='w'?'white':'black';
  const worker=new Worker('/engine/stockfish-19-lite-single.js');
  let listener:(line:string)=>void=()=>{};
  let fail:(error:Error)=>void=()=>{};
  worker.onmessage=(event:MessageEvent<unknown>)=>{if(typeof event.data==='string')for(const line of event.data.split('\n'))listener(line);};
  worker.onerror=()=>fail(new Error('The engine could not start. Try again, or open Lichess analysis.'));
  worker.onmessageerror=()=>fail(new Error('The engine returned an unreadable response. Please try again.'));
  function wait(command:string,until:(line:string)=>boolean,inspect?:(line:string)=>void,timeout=30000){
    return new Promise<void>((resolve,reject)=>{
      if(signal.aborted){reject(cancelled());return;}
      const abort=()=>finish(cancelled());
      const timer=setTimeout(()=>finish(new Error('The engine took too long. Try again or use Lichess analysis.')),timeout);
      const finish=(error?:Error)=>{clearTimeout(timer);signal.removeEventListener('abort',abort);listener=()=>{};fail=()=>{};if(error)reject(error);else resolve();};
      fail=finish;signal.addEventListener('abort',abort,{once:true});
      listener=line=>{inspect?.(line);if(until(line))finish();};
      worker.postMessage(command);
    });
  }
  async function search(searchMove?:string){
    let score:EngineScore|null=null;let bestMove:string|undefined;
    worker.postMessage(`position fen ${fen}`);
    await wait(`go depth 18 movetime 1800${searchMove?` searchmoves ${searchMove}`:''}`,line=>line.startsWith('bestmove '),line=>{
      const info=parseEngineInfo(line);if(info)score=info;
      if(line.startsWith('bestmove '))bestMove=line.split(' ')[1];
    },15000);
    if(!score){const position=new Chess(fen);if(position.isCheckmate())return {mate:0,depth:0,pv:[],bestMove};if(position.isGameOver())return {cp:0,depth:0,pv:[],bestMove};throw new Error('No evaluation was returned. Try the analysis again.');}
    return {...(score as EngineScore),bestMove};
  }
  try{
    onProgress('Loading Stockfish (about 2 MB on first use)…');await wait('uci',line=>line==='uciok');
    worker.postMessage('setoption name Hash value 16');worker.postMessage('setoption name MultiPV value 1');worker.postMessage('ucinewgame');await wait('isready',line=>line==='readyok');
    onProgress(myMove?'Finding the best available move…':'Evaluating the position and your best reply…');
    const best=await search();let played:EngineScore|undefined;
    if(myMove&&last){const uci=last.from+last.to+(last.promotion??'');
      if(best.bestMove===uci)played=best;else{onProgress('Comparing the move you actually played…');played=await search(uci);}}
    const normalized=scoreForSide(best,turn,side);const actual=played?scoreForSide(played,turn,side):undefined;
    return {kind:myMove?'my-move':'reply',best:normalized,played:actual,drop:normalized.cp!==undefined&&actual?.cp!==undefined?Math.max(0,(normalized.cp-actual.cp)/100):null,bestLine:uciLineToSan(fen,best.pv),playedLine:uciLineToSan(fen,played?.pv??[]),fen,engine:'Stockfish 19 Lite'};
  }finally{worker.terminate();}
}
