# Opening Lines

A personal chess opening explorer with a proportional flow diagram, move-by-move results, and a position board. Import public Lichess games by username or a multi-game PGN file. Game libraries are saved in IndexedDB on the current browser/device; no game database or API key is required.

## Develop

```sh
npm install
npm run dev
```

The app uses React, TypeScript, vinext/Vite, and chess.js. The Cloudflare-compatible worker streams public Lichess exports through `/api/lichess`. Its identifying User-Agent avoids Lichess's generic command-line client restrictions. Upstream rate limits are surfaced without automatic retries.

```sh
npm test             # accounting, imports, study ranking, and actual Stockfish WASM
npm run typecheck
npm run build
npm run test:render  # smoke test the built worker's HTML
```

## How the explorer works

- Results always use the selected player's color. Draws stay separate from wins.
- A path is the exact sequence of SAN moves. Transpositions retain separate branches, but the same named position is recognized via FEN.
- Each chart step is one half-move. Ribbon width is proportional to game count within the current view. The largest branches are shown first; grouped branches lead to the complete next-move table.
- Click a move to change the chart, board, game list, and position statistics. The upper summary cards continue to describe the selected color/date/time-control filters.
- Opening names never borrow labels from future moves. Unnamed positions retain the most recent recognized opening name.
- Recent-game imports request 100, 1,000, 5,000, or 10,000 records. Repeat imports merge by game ID and refresh available ratings, rating changes, and provisional flags without duplicating games. PGN games without a Lichess ID use a stable content fingerprint.
- Only completed games from the standard starting position are counted. Aborted, unfinished, variant, and custom-position games are skipped. PGN parse errors and unmatched players are reported as skipped records.
- Unknown PGN dates remain unknown and are excluded from bounded date filters. Unknown time controls are selectable separately.
- Synthetic sample games are explicitly labeled. They are never merged into an imported library. Their rating changes are illustrative values generated with a fixed-factor Elo approximation, not actual Lichess changes.
- Study priorities find recurring problem branches; optional on-device Stockfish analysis checks a selected position separately.

## Study priorities

- **Rating impact** defaults to **Below expected score**: each game's expected score is `1 / (1 + 10 ** ((opponentRating - playerRating) / 400))`, using the pre-game ratings and a result of 1, 0.5, or 0. Rankings use `100 × (eligible branch games / eligible scope games) × max(0, (sum of expected scores − sum of actual scores) / (eligible branch games + 5))`. Five neutral pseudo-games shrink small-sample shortfalls toward zero. This is a transparent Elo approximation, not an exact reconstruction of Lichess's Glicko-2 rating system.
- Switch to **Net rating points lost** to rank by the sum of recorded rating changes from the selected player's side, most negative first. Wins, draws, and losses all contribute; frequency is already included in the total. Missing changes are excluded rather than treated as zero. An opponent's change is never used to infer your own.
- Rating modes use rated games in one rating pool at a time and default to the last 90 days. The global date filter and rating window both apply. Games flagged provisional for either player are excluded unless enabled. Details show sample sizes, data coverage, actual versus expected score, and opponent bands (weaker by more than 100 points, within 100 points, stronger by more than 100 points).
- Older libraries need another Lichess import to fill in recorded changes. PGN imports support `WhiteElo`, `BlackElo`, `WhiteRatingDiff`, and `BlackRatingDiff`; absent or invalid values remain missing. A known zero change is retained. Minimum sample requirements apply to games with the data required by the selected ranking.
- **Unusually difficult** ranks frequency × positive excess loss rate compared with the other moves from the exact parent position. Both sides need the chosen minimum sample. Five pseudo-games at the overall loss rate smooth each group. This is a descriptive heuristic, not a causal estimate or a significance test.
- **Frequent losses** ranks frequency × observed loss rate, equivalent to losses in that branch per 100 games in scope. Forced continuations and a first move always played are omitted.
- **Lost every game** finds the earliest all-loss branches meeting a minimum of two games (five by default). Already-all-loss descendants are omitted. Repeated losses are evidence to investigate, not proof of a bad move.
- Filter by your decisions or opponent replies, choose a move range through move 20, and focus on an opening or any selected line. Related ancestors and descendants are grouped by default. Counts overlap, so row scores must not be added. Move orders remain separate paths. Rating modes account for opponent strength descriptively; game results do not establish that the opening caused a loss, and later mistakes are not controlled for.
- Review all games behind a rating candidate (preserving its pool, window, and provisional setting), or losses for the other modes, in the game library. Recorded changes are also shown per game. Compare sibling moves or check the position with Stockfish. Your decisions are evaluated from the pre-move position with a free search and a search restricted to your played move. Opponent replies are evaluated for your best response. Scores are always from your side.
- Engine analysis runs in a local browser Worker only after clicking its button. Each search is limited to depth 18 or 1.8 seconds. These are quick estimates; mate scores are shown separately and deeper analysis may change a recommendation.

## Opening names and assets

`lib/openings.json` includes 3,815 distinct named positions from [Lichess chess-openings](https://github.com/lichess-org/chess-openings), released under CC0. Regenerate it with `npm run openings:refresh`. PGN parsing, legality, and board positions use [chess.js](https://github.com/jhlywa/chess.js).

`public/og.png` is the bespoke social card, generated with the built-in image generation tool. Prompt: a finished landscape card for “Opening Lines” with the subtitle “Your games. A clearer plan.”, warm ivory and forest green branding, sage/lavender/terracotta Sankey ribbons, move cards labelled “1. e4”, “1... c6”, and “2. d4”, and a small black knight motif. No external runtime image dependencies.

`public/engine/` bundles the unmodified Stockfish.js 19.0.0 lite single-threaded JS/WASM build, its GPLv3 license, and the corresponding source archive from commit `54fde71d90c7c403964f6cacef48f7bbec495df1`. See `NOTICE.txt` there for provenance. The UI provides license and source downloads. No third-party analysis service receives game data.

## Hosting

The Sites deployment binding is in `.openai/hosting.json`. The build emits a Cloudflare Worker and static assets under `dist/`. Libraries stay on the user's device even when the app is hosted. Clearing browser data removes those saved games; they can be imported again.
