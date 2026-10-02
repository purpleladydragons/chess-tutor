# Opening Lines

A personal chess opening explorer with a proportional flow diagram, move-by-move results, and a position board. Import public Lichess games by username or a multi-game PGN file. Game libraries are saved in IndexedDB on the current browser/device; no game database or API key is required.

## Develop

```sh
npm install
npm run dev
```

The app uses React, TypeScript, vinext/Vite, and chess.js. The Cloudflare-compatible worker streams public Lichess exports through `/api/lichess`. Its identifying User-Agent avoids Lichess's generic command-line client restrictions. Upstream rate limits are surfaced without automatic retries.

```sh
npm test             # chess accounting, PGN parsing, filters, and HTTP error behavior
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
- Recent-game imports request 100, 1,000, 5,000, or 10,000 records. Repeat imports merge by game ID. PGN games without a Lichess ID use a stable content fingerprint.
- Only completed games from the standard starting position are counted. Aborted, unfinished, variant, and custom-position games are skipped. PGN parse errors and unmatched players are reported as skipped records.
- Unknown PGN dates remain unknown and are excluded from bounded date filters. Unknown time controls are selectable separately.
- Synthetic sample games are explicitly labeled. They are never merged into an imported library.
- This app helps identify lines to study; it does not make engine-based claims about move quality.

## Opening names and assets

`lib/openings.json` includes 3,815 distinct named positions from [Lichess chess-openings](https://github.com/lichess-org/chess-openings), released under CC0. Regenerate it with `npm run openings:refresh`. PGN parsing, legality, and board positions use [chess.js](https://github.com/jhlywa/chess.js).

`public/og.png` is the bespoke social card, generated with the built-in image generation tool. Prompt: a finished landscape card for “Opening Lines” with the subtitle “Your games. A clearer plan.”, warm ivory and forest green branding, sage/lavender/terracotta Sankey ribbons, move cards labelled “1. e4”, “1... c6”, and “2. d4”, and a small black knight motif. No external runtime image dependencies.

## Hosting

The Sites deployment binding is in `.openai/hosting.json`. The build emits a Cloudflare Worker and static assets under `dist/`. Libraries stay on the user's device even when the app is hosted. Clearing browser data removes those saved games; they can be imported again.
