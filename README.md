# LoLrillion
Krillion but league of legends

## Develop

```sh
npm install
npm run dev     # http://localhost:3000
npm test        # Vitest (Game Engine)
npm run build
```

## Game data

```sh
npm run data:fetch      # fetch the current patch from Data Dragon + Community Dragon
npm run data:registry   # rebuild the Entity registry from the committed snapshot (after editing nicknames)
```

Both write the committed files in `src/content/game-data/`: `snapshot.json` (trimmed game data, labelled
with its patch) and `registry.json` (every Entity with its ID, Answer Type and Aliases). Curated nicknames
live in `src/content/game-data/nicknames.ts`.

## Familiarity (Riot API)

Once per patch, after `data:fetch`, sample real players to measure how well known each champion and item is:

```sh
RIOT_API_KEY=RGAPI-... npm run data:familiarity                       # every platform and tier (slow on a dev key)
RIOT_API_KEY=RGAPI-... npm run data:familiarity -- --platforms=na1,euw1,kr --tiers=gold,diamond,master \
  --players=5 --matches=10 --since=2026-11-12
```

Get a key at <https://developer.riotgames.com> (development keys expire every 24h). The script takes the same
number of ranked solo players from every platform x tier bucket (`--platforms`, `--tiers`, `--players` per bucket,
`--matches` per player, `--since` = patch release date), and stays within the development-key limits
(20 req/s, 100 req/2 min per routing host), waiting out `Retry-After` on a 429 and backing off on server errors.
Pass `--production` with a personal/production key to raise the limits.

It writes `src/content/familiarity/<patch>.json` (patch = the snapshot's version):
`{ patch, champions: { "champion:<id>": { mastery, pickRate } }, items: { "item:<id>": { buildRate } }, sample }`.
`mastery` is the champion's share of all summed lifetime mastery points, `pickRate` the share of current-patch
matches it appeared in, `buildRate` the share of players who finished a match holding the item. Only these
anonymous totals and sample counts are written; PUUIDs and match IDs are never saved.

Layout: `src/engine/` is the pure Game Engine, `src/server/` holds the game service, storage and Puzzle source, and `src/app/` holds the UI and API routes.
