'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, Download, FileUp, LoaderCircle, ShieldCheck, X } from 'lucide-react';
import { fromLichess, gameSource, parsePgnGame, splitPgn, type Game, type Library } from '@/lib/chess';
import { importChessCom } from '@/lib/chesscom';

export default function ImportDialog({library,onClose,onImport}:{library:Library|null;onClose:()=>void;onImport:(username:string,games:Game[],skipped:number)=>Promise<void>}) {
  const dialog=useRef<HTMLDialogElement>(null);const abort=useRef<AbortController|null>(null);
  const [tab,setTab]=useState<'lichess'|'chesscom'|'pgn'>(()=>library?.games[0]&&gameSource(library.games[0])==='chesscom'?'chesscom':'lichess');const [username,setUsername]=useState(library?.username??'');
  const [month,setMonth]=useState('');const [pgnRated,setPgnRated]=useState(false);
  const [max,setMax]=useState('1000');const [file,setFile]=useState<File|null>(null);const [busy,setBusy]=useState(false);const [progress,setProgress]=useState(0);const [error,setError]=useState('');
  useEffect(()=>{dialog.current?.showModal();return()=>abort.current?.abort();},[]);
  function close(){abort.current?.abort();onClose();}
  async function submit(event:React.FormEvent) {
    event.preventDefault();setError('');setProgress(0);
    const user=username.trim();if(!user){setError('Enter your username so results can be shown from your side.');return;}
    const controller=new AbortController();abort.current=controller;setBusy(true);
    let skipped=0;const games:Game[]=[];
    try {
      if(tab==='lichess') {
        const response=await fetch(`/api/lichess?username=${encodeURIComponent(user)}&max=${max}`,{signal:controller.signal});
        if(!response.ok){const data=await response.json().catch(()=>null) as {error?:string}|null;throw new Error(data?.error??'The import could not be completed. Please try again.');}
        if(!response.body)throw new Error('The download was empty. Please try a PGN file.');
        const reader=response.body.getReader();const decoder=new TextDecoder();let buffer='';let received=0;
        const parse=(line:string)=>{if(!line.trim())return;const game=fromLichess(JSON.parse(line));received++;if(game&&(game.white.toLowerCase()===user.toLowerCase()||game.black.toLowerCase()===user.toLowerCase()))games.push(game);else skipped++;setProgress(received);};
        while(true){const {value,done}=await reader.read();buffer+=decoder.decode(value,{stream:!done});const lines=buffer.split('\n');buffer=lines.pop()??'';for(const line of lines)parse(line);if(done){parse(buffer);break;}}
      } else if(tab==='chesscom') {
        const result=await importChessCom(user,Number(max),{signal:controller.signal,onProgress:(n,m)=>{setProgress(n);setMonth(m);}});
        games.push(...result.games);skipped=result.skipped;
      } else {
        if(!file)throw new Error('Choose a PGN file to import.');
        if(file.size>50*1024*1024)throw new Error('Please use a PGN file smaller than 50 MB.');
        const chunks=splitPgn(await file.text());
        for(let i=0;i<chunks.length;i++) {
          if(controller.signal.aborted)throw new DOMException('Import cancelled','AbortError');
          try {const game=parsePgnGame(chunks[i]);if(game&&(game.white.toLowerCase()===user.toLowerCase()||game.black.toLowerCase()===user.toLowerCase())){if(game.ratedUnknown&&pgnRated){game.rated=true;game.ratedUnknown=false;}games.push(game);}else skipped++;}catch{skipped++;}
          if(i%20===0){setProgress(i+1);await new Promise(resolve=>setTimeout(resolve,0));}
        }
        setProgress(chunks.length);
      }
      if(controller.signal.aborted)return;
      if(!games.length)throw new Error('No completed standard-chess games matched this username. Check the username, or try another PGN file.');
      await onImport(user,games,skipped);onClose();
    } catch(err) {if(!(err instanceof DOMException&&err.name==='AbortError'))setError(err instanceof Error?err.message:'Import failed. Please try again.');}
    finally{setBusy(false);}
  }
  const replacing=!!library&&library.username.toLowerCase()!==username.trim().toLowerCase();
  return <dialog ref={dialog} className="import-dialog" onCancel={close} aria-labelledby="import-title">
    <div className="dialog-content"><button className="icon-button dialog-close" onClick={close} aria-label="Close import"><X size={20}/></button>
      <div className="dialog-icon"><Download size={24}/></div><span className="eyebrow">BRING YOUR GAMES</span><h2 id="import-title">Your next insight starts here.</h2><p>Connect the dots in the games you’ve already played.</p>
      <div className="import-tabs" role="tablist" aria-label="Import method">{([{id:'lichess',label:'Lichess'},{id:'chesscom',label:'Chess.com'},{id:'pgn',label:'Upload PGN'}] as const).map(t=><button key={t.id} role="tab" aria-selected={tab===t.id} onClick={()=>{setTab(t.id);setError('');setMonth('');}} disabled={busy}>{t.label}</button>)}</div>
      <form onSubmit={submit}><label className="field">{tab==='pgn'?'Your player name in the PGN':`${tab==='chesscom'?'Chess.com':'Lichess'} username`}<input value={username} onChange={e=>setUsername(e.target.value)} placeholder={tab==='pgn'?'Match the White or Black player tag':'Your username'} disabled={busy} required maxLength={tab==='lichess'?30:tab==='chesscom'?50:100}/></label>
        {tab!=='pgn'?<><label className="field">Games to import<select value={max} onChange={e=>setMax(e.target.value)} disabled={busy}><option value="100">Latest 100 games</option><option value="1000">Latest 1,000 games</option><option value="5000">Latest 5,000 games</option><option value="10000">Latest 10,000 games</option></select></label><p className="field-hint">No password or API key needed. {tab==='chesscom'?'Downloads public monthly archives, newest first. Recent games may take time to appear.':'Large imports can take several minutes.'}</p></>:<><label className="file-input"><FileUp size={28}/><strong>{file?file.name:'Choose a PGN file'}</strong><span>Lichess, Chess.com, or standard PGN · up to 50 MB</span><input type="file" accept=".pgn,application/x-chess-pgn,text/plain" onChange={e=>setFile(e.target.files?.[0]??null)} disabled={busy} required aria-label="Choose a PGN file"/></label><label className="rating-provisional"><input type="checkbox" checked={pgnRated} onChange={e=>setPgnRated(e.target.checked)} disabled={busy}/>These Chess.com PGN games were rated</label><p className="field-hint">Chess.com PGNs often omit rated status. Check this only for rated games to include them in rating priorities. Username imports detect rated status automatically.</p></>}
        {tab==='chesscom'&&<p className="notice">Opening results and the approximate rating ranking are supported. Chess.com does not provide per-game rating changes in this export, so recorded net rating points will be unavailable.</p>}
        <div className="import-notes"><span><Check size={14}/> Both colors, with results from your perspective</span><span><Check size={14}/> Repeat imports refresh rating data without duplicates</span><span><ShieldCheck size={14}/> Saved only in this browser on this device</span></div>
        {replacing&&<p className="notice">Importing a different player replaces the saved library in this browser.</p>}
        {error&&<p role="alert" className="error-message">{error}</p>}
        {busy&&<p className="import-progress" role="status"><LoaderCircle size={16} className="spin"/>{progress?`${progress.toLocaleString()} games received…`:month?`Reading ${month}…`:'Connecting…'}{tab==='chesscom'&&progress>0&&month?` (${month})`:''} Keep this window open.</p>}
        <button className="primary-button full-width" disabled={busy} type="submit">{busy?<><LoaderCircle size={17} className="spin"/>Importing your games</>:<>Import games<ArrowRight size={17}/></>}</button>
        {busy&&<button className="text-button full-width" type="button" onClick={close}>Cancel import</button>}
        <p className="dialog-footnote">Only completed standard-chess games are included. Variants, unfinished games, and games from custom starting positions are skipped.</p>
      </form>
    </div>
  </dialog>;
}
