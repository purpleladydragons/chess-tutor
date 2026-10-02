export async function GET(request:Request){
  const params=new URL(request.url).searchParams;const username=(params.get('username')??'').trim().toLowerCase();const month=params.get('month');
  if(!/^[a-z0-9_-]{2,50}$/.test(username)||(month!==null&&!/^\d{4}\/(0[1-9]|1[0-2])$/.test(month)))return Response.json({error:'Enter a valid Chess.com username and month.'},{status:400});
  const path=`https://api.chess.com/pub/player/${encodeURIComponent(username)}/games/`;
  try{
    // Construct a fixed-host URL; never fetch an archive URL supplied by the client.
    const response=await fetch(path+(month??'archives'),{headers:{Accept:'application/json','User-Agent':'OpeningLines/1.0 (+https://opening-lines-chess-tutor.asteady23.chatgpt.site)'},signal:request.signal});
    if(!response.ok){const status=response.status===404?404:response.status===429?429:502;return Response.json({error:status===404?'Chess.com could not find that player or game archive. Check the username.':status===429?'Chess.com is rate limiting requests. Wait a minute, then try again or upload a PGN.':'Chess.com is unavailable right now. Try again later or upload a PGN.'},{status});}
    const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
    if(month)return new Response(response.body,{headers:{...headers,'Content-Type':'application/json'}});
    const data=await response.json() as {archives?:unknown};
    if(!Array.isArray(data.archives))throw new Error('Invalid archives');
    const months=data.archives.flatMap((url:unknown)=>typeof url==='string'&&url.startsWith(path)&&/^\d{4}\/(0[1-9]|1[0-2])$/.test(url.slice(path.length))?[url.slice(path.length)]:[]);
    return Response.json({months:[...new Set(months)].sort().reverse()},{headers});
  }catch{return Response.json({error:'Could not connect to Chess.com. Try again, or upload a PGN file.'},{status:502});}
}
