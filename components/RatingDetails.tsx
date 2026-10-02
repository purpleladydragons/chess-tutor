'use client';
import { lineLabel, moveLabel, type GameSource } from '@/lib/chess';
import { signedPoints, type RatingSummary } from '@/lib/ratings';
import type { StudyCandidate } from '@/lib/priorities';

const percent=(n:number,total:number)=>total?`${(100*n/total).toFixed(1)}%`:'—';
export function RatingDetails({value,total,source}:{value:RatingSummary;total:number;source?:GameSource}){
  const gap=value.count?100*(value.actual-value.expected)/value.count:0;
  return <section className="rating-detail" aria-label="Rating performance">
    <div className="rating-metrics"><div><span>Net rating change</span><strong>{value.changeCount?signedPoints(value.netChange):source==='chesscom'?'Not provided':'Not imported'}</strong><small>{value.changeCount} of {total} games have changes</small></div><div><span>Score vs expectation</span><strong>{value.count?`${gap>0?'+':''}${gap.toFixed(1)} pp`:'Unavailable'}</strong><small>{value.count} of {total} games have both ratings</small></div></div>
    <p>Scored <b>{percent(value.actual,value.count)}</b> · expected <b>{percent(value.expected,value.count)}</b>. Draws count as half a win. Expectation is an Elo approximation using {source==='chesscom'?'the ratings in the Chess.com PGN. Their timing is not independently verified':'each game’s pre-game ratings'}.</p>
    <h4>Against different opponents</h4><div className="rating-table-wrap"><table className="rating-band-table"><caption>Opponent strength relative to your rating at the time</caption><thead><tr><th>Opponent</th><th>Games</th><th>Scored</th><th>Expected</th></tr></thead><tbody>{(['weaker','similar','stronger'] as const).map(b=>{const s=value.bands[b];return <tr key={b}><th>{b==='weaker'?'More than 100 below':b==='stronger'?'More than 100 above':'Within 100'}<small>{b==='similar'?'Similar rating':b==='weaker'?'Weaker':'Stronger'}</small></th><td>{s.count}</td><td>{percent(s.actual,s.count)}</td><td>{percent(s.expected,s.count)}</td></tr>;})}</tbody></table></div>
    <small className="rating-caveat">Bands use games with both ratings. Small groups are clues for review, not reliable conclusions. Rating changes include wins, draws, and losses; they are not points the opening itself caused.</small>
  </section>;
}
export function RatingComparison({candidate,net,onExplore}:{candidate:StudyCandidate;net:boolean;onExplore:(path:string[])=>void}){
  return <section className="study-comparison"><h4>At the same decision point</h4>{[{path:candidate.path,rating:candidate.rating},...candidate.siblings].map((s,i)=>{
    const r=s.rating;const gap=r.count?100*(r.actual-r.expected)/r.count:0;
    return <div key={s.path.join(' ')} className="study-compare-row">{i===0?<span>{moveLabel(s.path.at(-1)!,s.path.length-1)}</span>:<button onClick={()=>onExplore(s.path)} title={lineLabel(s.path)}>{moveLabel(s.path.at(-1)!,s.path.length-1)}</button>}<b>{net?(r.changeCount?`${signedPoints(r.netChange)} pts`:'No changes'):(r.count?`${gap>0?'+':''}${gap.toFixed(1)} pp`:'No ratings')}</b><span>{net?r.changeCount:r.count} games</span></div>;
  })}<p>{net?'Net points include every recorded gain and loss.':'Percentage points above or below the rating-based expected score.'} Each row uses only games with the required data.</p></section>;
}
