'use client';
import { Chess } from 'chess.js';
import { useMemo } from 'react';
import { openingFor, type Side } from '@/lib/chess';
const pieces: Record<string,string>={wp:'♟',wn:'♞',wb:'♝',wr:'♜',wq:'♛',wk:'♚',bp:'♟',bn:'♞',bb:'♝',br:'♜',bq:'♛',bk:'♚'};
const names: Record<string,string>={p:'pawn',n:'knight',b:'bishop',r:'rook',q:'queen',k:'king'};
export default function ChessBoard({path,side}:{path:string[];side:Side}) {
  const {board,last}=useMemo(()=>{const chess=new Chess();let last;for(const move of path)last=chess.move(move);return{board:chess.board().flat(),last};},[path]);
  const squares=side==='white'?board:[...board].reverse();
  return <div className="chess-board" role="img" aria-label={`${openingFor(path).name}, viewed from ${side}'s side. ${path.length%2?'Black':'White'} to move.`}>{squares.map((piece,i)=>{
    const row=Math.floor(i/8);const col=i%8;const file=side==='white'?'abcdefgh'[col]:'hgfedcba'[col];const rank=side==='white'?8-row:row+1;const square=`${file}${rank}`;
    return <div key={square} className={`square ${(row+col)%2?'dark':'light'} ${last&&(last.from===square||last.to===square)?'last-move':''}`} title={piece?`${piece.color==='w'?'White':'Black'} ${names[piece.type]} on ${square}`:square}>
      {col===0&&<span className="rank">{rank}</span>}{row===7&&<span className="file">{file}</span>}{piece&&<span className={`piece ${piece.color==='w'?'white-piece':'black-piece'}`}>{pieces[piece.color+piece.type]}</span>}
    </div>;
  })}</div>;
}
