'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Layers } from 'lucide-react';
import { branches, moveLabel, openingFor, rate, stats, type Game, type Side, type Stats } from '@/lib/chess';

type FlowNode = {id: string; path: string[]; label: string; name: string; stats: Stats; games: Game[]; color: string; parent?: string; grouped?: boolean; detail?: string; x?: number; y?: number};
const colors = ['#6f9b80','#a399bf','#d2a083','#83a9b8','#abb3a0'];
const palette: Record<string,string> = {e4:colors[0],d4:colors[1],Nf3:colors[2],c4:colors[3]};
export default function FlowChart({games,path,side,depth,onSelect}: {games:Game[];path:string[];side:Side;depth:number;onSelect:(path:string[])=>void}) {
  const hasGames=games.length>0;
  const canvas=useRef<HTMLCanvasElement>(null); const viewport=useRef<HTMLDivElement>(null); const [availableWidth,setAvailableWidth]=useState(760);
  useEffect(()=>{const element=viewport.current;if(!element)return;const observer=new ResizeObserver(entries=>setAvailableWidth(entries[0].contentRect.width));observer.observe(element);return()=>observer.disconnect();},[hasGames]);
  const data=useMemo(() => {
    const root: FlowNode={id:'root',path,label:path.length?moveLabel(path.at(-1)!,path.length-1):`You as ${side === 'black'?'Black':'White'}`,name:openingFor(path).name,stats:stats(games,side),games,color:palette[path[0]]??colors[0]};
    const columns: FlowNode[][]=[[root]];
    for(let d=0;d<depth;d++) {
      const next:FlowNode[]=[];
      for(const node of columns[d]) {
        if(node.grouped) continue;
        const all=branches(node.games,node.path,side);
        const limit=d===0?4:3;
        for(const [i,b] of all.slice(0,limit).entries()) next.push({id:b.path.join(' '),path:b.path,label:moveLabel(b.move,b.path.length-1),name:b.name,stats:b.stats,games:b.games,color:d===0?(palette[b.move]??colors[i%colors.length]):node.color,parent:node.id});
        if(all.length>limit) {
          const rest=all.slice(limit); const restGames=rest.flatMap(b=>b.games);
          next.push({id:`${node.id}-other`,path:node.path,label:`${rest.length} other moves`,name:rest.map(b=>b.move).join(', '),stats:stats(restGames,side),games:restGames,color:colors[4],parent:node.id,grouped:true,detail:'Open the full next-moves table for this position'});
        }
      }
      if(!next.length) break;
      columns.push(next);
    }
    const height=Math.max(420,...columns.map(c=>c.length*67+26));
    const width=Math.max(columns.length*190+40,availableWidth);
    for(let c=0;c<columns.length;c++) {
      const nodes=columns[c]; const gap=(height-24)/nodes.length;
      nodes.forEach((node,i)=>{node.x=20+c*((width-205)/Math.max(1,columns.length-1));node.y=12+gap*(i+.5);});
    }
    return {columns,nodes:columns.flat(),height,width,scale:Math.min(100/Math.max(1,games.length),3)};
  },[games,path,side,depth,availableWidth]);
  useEffect(()=>{
    const element=canvas.current; if(!element)return;
    const ratio=window.devicePixelRatio||1;
    element.width=data.width*ratio;element.height=data.height*ratio;
    const ctx=element.getContext('2d');if(!ctx)return;
    ctx.scale(ratio,ratio);
    for(const source of data.nodes) {
      const targets=data.nodes.filter(n=>n.parent===source.id);
      const outgoing=targets.reduce((n,t)=>n+t.stats.total,0)*data.scale;
      let y=source.y!-outgoing/2;
      for(const target of targets) {
        const h=target.stats.total*data.scale; const x0=source.x!+163;const x1=target.x!;const t0=target.y!-h/2;const mid=(x0+x1)/2;
        ctx.beginPath();ctx.moveTo(x0,y);ctx.bezierCurveTo(mid,y,mid,t0,x1,t0);ctx.lineTo(x1,t0+h);ctx.bezierCurveTo(mid,t0+h,mid,y+h,x0,y+h);ctx.closePath();ctx.fillStyle=target.color+'50';ctx.fill(); y+=h;
      }
    }
  },[data]);
  if(!games.length)return <div className="chart-empty"><Layers size={32}/><h3>No games in this view</h3><p>Try another color or clear your filters.</p></div>;
  return <div ref={viewport} className="flow-scroll"><div className="flow-inner" style={{width:data.width,minWidth:data.width}}>
    <div className="flow-headings">{data.columns.map((_,i)=><span key={i} style={{left:20+i*((data.width-205)/Math.max(1,data.columns.length-1))}}>{i===0?'YOUR POSITION':`${(path.length+i-1)%2===0?'WHITE':'BLACK'} · MOVE ${Math.floor((path.length+i-1)/2)+1}`}</span>)}</div>
    <div className="flow-canvas" style={{height:data.height}}>
      <canvas ref={canvas} style={{width:data.width,height:data.height}} aria-hidden="true"/>
      {data.nodes.map(node=><button key={node.id} className={`flow-node ${node.id==='root'?'root-node':''} ${node.grouped?'group-node':''}`} style={{left:node.x,top:node.y!-31,'--branch':node.color} as React.CSSProperties} onClick={()=>{onSelect(node.path);if(node.grouped)document.getElementById("next-moves")?.scrollIntoView({block:"start"});}} title={`${node.label} — ${node.name}. ${node.stats.total} games: ${node.stats.win} wins, ${node.stats.draw} draws, ${node.stats.loss} losses. ${node.detail??'Click to explore this position.'}`} aria-label={`${node.label}, ${node.name}, ${node.stats.total} games, ${rate(node.stats.win,node.stats.total).toFixed(1)} percent wins. Explore branch.`}>
        <span className="flow-move">{node.label}{node.id!=='root'&&<ArrowUpRight size={12}/>}</span><span className="flow-name">{node.name}</span>
        <span className="flow-meta"><b>{node.stats.total}</b> games <span>·</span> <strong>{rate(node.stats.win,node.stats.total).toFixed(0)}% W</strong></span><span className="node-results" aria-hidden="true"><i style={{width:`${rate(node.stats.win,node.stats.total)}%`,background:'var(--win)'}}/><i style={{width:`${rate(node.stats.draw,node.stats.total)}%`,background:'var(--draw)'}}/><i style={{width:`${rate(node.stats.loss,node.stats.total)}%`,background:'var(--loss)'}}/></span>
      </button>)}
    </div>
  </div></div>;
}
