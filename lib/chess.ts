import { Chess, DEFAULT_POSITION } from 'chess.js';
import openingData from './openings.json';

export type Side = 'white' | 'black';
export type Outcome = 'win' | 'draw' | 'loss';
export type Game = {
  id: string; white: string; black: string; whiteRating?: number; blackRating?: number;
  result: '1-0' | '0-1' | '1/2-1/2'; moves: string[]; date: number;
  speed: string; rated: boolean; url?: string;
};
export type Library = { username: string; games: Game[]; importedAt: number };
export type Stats = { total: number; win: number; draw: number; loss: number };
export type Branch = { path: string[]; games: Game[]; stats: Stats; move: string; name: string; eco?: string };
export type Opening = { name: string; eco?: string; fen: string; namedAt: number };
const openings = openingData as Record<string, {name: string; eco: string; plies: number}>;
const openingCache = new Map<string, Opening>();

export function moveLabel(move: string, ply: number) { return `${Math.floor(ply / 2) + 1}${ply % 2 ? '...' : '.'} ${move}`; }
export function lineLabel(moves: string[]) { return moves.map((move, ply) => ply % 2 === 0 ? `${Math.floor(ply / 2) + 1}. ${move}` : move).join(' '); }
export function outcome(game: Game, side: Side): Outcome {
  if (game.result === '1/2-1/2') return 'draw';
  return (game.result === '1-0') === (side === 'white') ? 'win' : 'loss';
}
export function stats(games: Game[], side: Side): Stats {
  const result: Stats = {total: games.length, win: 0, draw: 0, loss: 0};
  for (const game of games) result[outcome(game, side)]++;
  return result;
}
export function rate(value: number, total: number) { return total ? value / total * 100 : 0; }
export function matchesPath(game: Game, path: string[]) { return path.every((move, i) => game.moves[i] === move); }
export function openingFor(path: string[]): Opening {
  const key = path.join(' ');
  const cached = openingCache.get(key);
  if (cached) return cached;
  if (!path.length) return {name: 'Starting position', fen: DEFAULT_POSITION, namedAt: 0};
  const chess = new Chess();
  let name = 'Unnamed opening'; let eco: string | undefined; let namedAt = 0;
  for (let i = 0; i < path.length; i++) {
    chess.move(path[i]);
    const opening = openings[chess.fen().split(' ').slice(0, 4).join(' ')];
    if (opening) { name = opening.name; eco = opening.eco; namedAt = i + 1; }
  }
  const result = {name, eco, fen: chess.fen(), namedAt};
  openingCache.set(key, result);
  return result;
}
export function branches(games: Game[], path: string[], side: Side): Branch[] {
  const groups = new Map<string, Game[]>();
  for (const game of games) {
    if (!matchesPath(game, path)) continue;
    const move = game.moves[path.length];
    if (!move) continue;
    const group = groups.get(move) ?? [];
    group.push(game); groups.set(move, group);
  }
  return [...groups].map(([move, items]) => {
    const next = [...path, move];
    const {name, eco} = openingFor(next);
    return {move, path: next, games: items, stats: stats(items, side), name, eco};
  }).sort((a, b) => b.stats.total - a.stats.total || a.move.localeCompare(b.move));
}
export function filterGames(games: Game[], username: string, side: Side, speed = 'all', days = 0, ratedOnly = false, now = Date.now()) {
  return games.filter(g => g[side].toLowerCase() === username.toLowerCase() && (speed === 'all' || g.speed === speed) && (!days || g.date >= now - days * 86400000) && (!ratedOnly || g.rated));
}
export function mergeGames(oldGames: Game[], newGames: Game[]) {
  const merged = new Map(oldGames.map(g => [g.id, g]));
  for (const game of newGames) merged.set(game.id, game);
  return [...merged.values()].sort((a,b) => b.date - a.date);
}

type LichessGame = {id?: string; variant?: string; status?: string; moves?: string; winner?: string; createdAt?: number; speed?: string; rated?: boolean; players?: {white?: {user?: {name?: string; id?: string}; rating?: number}; black?: {user?: {name?: string; id?: string}; rating?: number}}};
export function fromLichess(raw: LichessGame): Game | null {
  if (!raw.id || (raw.variant && raw.variant !== 'standard') || !raw.moves || !['mate','resign','stalemate','timeout','draw','outoftime','cheat','variantEnd'].includes(raw.status ?? '')) return null;
  const white = raw.players?.white?.user?.name ?? raw.players?.white?.user?.id ?? 'Anonymous';
  const black = raw.players?.black?.user?.name ?? raw.players?.black?.user?.id ?? 'Anonymous';
  return {id: raw.id, white, black, whiteRating: raw.players?.white?.rating, blackRating: raw.players?.black?.rating,
    result: raw.winner === 'white' ? '1-0' : raw.winner === 'black' ? '0-1' : '1/2-1/2',
    moves: raw.moves.trim().split(/\s+/), date: raw.createdAt ?? 0, speed: raw.speed ?? 'unknown', rated: !!raw.rated,
    url: `https://lichess.org/${raw.id}`};
}

// Top-level PGN results split games; comments and side variations never do.
export function splitPgn(text: string): string[] {
  const chunks: string[] = []; let start = 0; let braces = 0; let variation = 0; let header = false; let quoted = false; let semicolon = false;
  const input = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (semicolon) { if (c === '\n') semicolon = false; continue; }
    if (braces) { if (c === '}') braces--; else if (c === '{') braces++; continue; }
    if (header) { if (c === '"' && input[i-1] !== '\\') quoted = !quoted; if (c === ']' && !quoted) header = false; continue; }
    if (c === '{') {braces++; continue;}
    if (c === ';') {semicolon = true; continue;}
    if (c === '[') {header = true; continue;}
    if (c === '(') {variation++; continue;}
    if (c === ')') {variation = Math.max(0, variation - 1); continue;}
    if (!variation && (i === 0 || /\s/.test(input[i-1]))) {
      const match = input.slice(i).match(/^(1-0|0-1|1\/2-1\/2|\*)(?=\s|$)/);
      if (match) { const end = i + match[0].length; chunks.push(input.slice(start, end).trim()); start = end; i = end - 1; }
    }
  }
  if (input.slice(start).replace(/\{[^}]*\}/g, '').trim()) chunks.push(input.slice(start).trim());
  return chunks.filter(Boolean);
}
function stableHash(value: string) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i=0; i<value.length; i++) {const c=value.charCodeAt(i); h1=Math.imul(h1^c,2654435761); h2=Math.imul(h2^c,1597334677);}
  return `${(h1>>>0).toString(16)}${(h2>>>0).toString(16)}`;
}
export function parsePgnGame(pgn: string): Game | null {
  const chess = new Chess(); chess.loadPgn(pgn);
  const headers = chess.getHeaders();
  if (headers.Variant && !['standard','standard chess','from position'].includes(headers.Variant.toLowerCase())) return null;
  if (headers.SetUp === '1' || (headers.FEN && headers.FEN !== DEFAULT_POSITION)) return null;
  const result = headers.Result;
  if (result !== '1-0' && result !== '0-1' && result !== '1/2-1/2') return null;
  const moves = chess.history(); if (!moves.length) return null;
  const link = headers.Site?.match(/^https:\/\/lichess\.org\/([a-zA-Z0-9]{8})(?:[a-zA-Z0-9]{4})?(?:\/.*)?$/);
  const seconds = headers.TimeControl?.match(/^(\d+)\+(\d+)$/);
  const estimate = seconds ? Number(seconds[1]) + Number(seconds[2])*40 : 0;
  const speed = !seconds ? (headers.TimeControl === '-' ? 'correspondence' : 'unknown') : estimate < 29 ? 'ultraBullet' : estimate < 180 ? 'bullet' : estimate < 480 ? 'blitz' : estimate < 1500 ? 'rapid' : 'classical';
  const timestamp = Date.parse(`${(headers.UTCDate || headers.Date || '').replace(/\./g,'-')}T${headers.UTCTime || '12:00:00'}Z`);
  return {id: link?.[1] ?? `pgn-${stableHash(JSON.stringify([headers.White,headers.Black,headers.Date,headers.UTCTime,result,moves]))}`,
    white: headers.White || 'Unknown', black: headers.Black || 'Unknown',
    whiteRating: Number(headers.WhiteElo) || undefined, blackRating: Number(headers.BlackElo) || undefined,
    result, moves, date: Number.isFinite(timestamp) ? timestamp : 0, speed, rated: /^rated\b/i.test(headers.Event ?? ''), url: link ? `https://lichess.org/${link[1]}` : undefined};
}
