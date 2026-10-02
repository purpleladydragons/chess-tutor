import { Chess } from 'chess.js';
import { writeFile } from 'node:fs/promises';
const entries = {};
for (const volume of ['a','b','c','d','e']) {
  const response = await fetch(`https://raw.githubusercontent.com/lichess-org/chess-openings/master/${volume}.tsv`);
  if (!response.ok) throw new Error(`Opening data: ${response.status}`);
  for (const row of (await response.text()).trim().split('\n').slice(1)) {
    const [eco, name, pgn] = row.split('\t');
    const chess = new Chess();
    chess.loadPgn(pgn);
    const key = chess.fen().split(' ').slice(0,4).join(' ');
    const plies = chess.history().length;
    if (!entries[key] || entries[key].plies > plies) entries[key] = {eco, name, plies};
  }
}
await writeFile('lib/openings.json', JSON.stringify(entries));
console.log(`Saved ${Object.keys(entries).length} named opening positions (Lichess CC0).`);
