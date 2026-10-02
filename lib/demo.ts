import type { Game } from './chess';
const lines: [string, number, number, number][] = [
 ['e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2 c5', 94, .58, .06],
 ['e4 c6 d4 d5 exd5 cxd5 Bd3 Nc6 c3 Nf6', 66, .67, .09],
 ['e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6', 58, .48, .10],
 ['e4 c6 d4 d5 Nc3 dxe4 Nxe4 Nd7 Nf3 Ngf6', 22, .43, .10],
 ['e4 c6 d4 d5 Nd2 dxe4 Nxe4 Bf5 Ng3 Bg6', 18, .55, .05],
 ['e4 c6 Nf3 d5 Nc3 Bg4 h3 Bxf3 Qxf3 e6', 20, .45, .05],
 ['e4 c6 d4 d5 f3 dxe4 fxe4 e5 Nf3', 12, .33, .08],
 ['e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6', 42, .50, .07],
 ['e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6', 20, .40, .05],
 ['d4 d5 c4 e6 Nc3 Nf6 Bg5 Be7', 56, .46, .09],
 ['d4 d5 Bf4 Nf6 e3 c5 c3 Nc6', 46, .43, .09],
 ['d4 Nf6 c4 g6 Nc3 Bg7 e4 d6', 36, .47, .05],
 ['Nf3 d5 g3 Nf6 Bg2 e6 O-O Be7', 30, .53, .10],
 ['c4 e5 Nc3 Nf6 g3 d5 cxd5 Nxd5', 22, .54, .05],
];
export function makeDemo(): Game[] {
  const games: Game[] = []; let id = 0;
  for (const [line, count, win, draw] of lines) {
    for (let i=0; i<count; i++) {
      const n = id++;
      games.push({id: `demo-${n}`, white: `Opponent_${String(n+1).padStart(3,'0')}`, black: 'demo_player',
        whiteRating: 1350+(n*37)%450, blackRating: 1540+n%100,
        result: i < Math.round(count*win) ? '0-1' : i < Math.round(count*(win+draw)) ? '1/2-1/2' : '1-0',
        moves: line.split(' '), date: Date.UTC(2026,8,30)-((n*17)%180)*86400000,
        speed: n%5===0?'blitz':'rapid', rated: n%7!==0});
    }
  }
  const whiteGames = games.filter((_,i) => i%3===0).map((g,i) => ({...g, id:`demo-white-${i}`, white:'demo_player', black:g.white}));
  return [...games,...whiteGames];
}
export const DEMO_GAMES = makeDemo();
