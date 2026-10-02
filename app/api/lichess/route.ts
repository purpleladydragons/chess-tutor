export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('username')?.trim() ?? '';
  const max = Number(searchParams.get('max') ?? 1000);
  if (!/^[a-zA-Z0-9_-]{2,30}$/.test(username) || ![100,1000,5000,10000].includes(max)) {
    return Response.json({error:'Enter a valid Lichess username and game limit.'}, {status:400});
  }
  const params = new URLSearchParams({max:String(max),moves:'true',clocks:'false',evals:'false',opening:'false',pgnInJson:'false',ongoing:'false',finished:'true',sort:'dateDesc',perfType:'ultraBullet,bullet,blitz,rapid,classical,correspondence'});
  try {
    const response = await fetch(`https://lichess.org/api/games/user/${encodeURIComponent(username)}?${params}`, {
      headers:{Accept:'application/x-ndjson','User-Agent':`OpeningLines/1.0 (+${new URL(request.url).origin})`}, signal: request.signal,
    });
    if (!response.ok) {
      const error = response.status === 404 ? 'That Lichess username was not found. Check the spelling and try again.' : response.status === 429 ? 'Lichess is rate limiting requests. Please wait a minute before trying again.' : 'Lichess is unavailable right now. Try again shortly, or import a PGN file.';
      return Response.json({error}, {status:response.status === 404 ? 404 : response.status === 429 ? 429 : 502});
    }
    return new Response(response.body, {headers:{'Content-Type':'application/x-ndjson','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  } catch {
    return Response.json({error:'Could not connect to Lichess. Try again, or import a PGN file.'}, {status:502});
  }
}
