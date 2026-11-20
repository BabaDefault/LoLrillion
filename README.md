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

Without any environment variables, plays are kept in memory (lost on restart). That is the default for local dev and tests.

## Supabase (persistent storage)

Plays, Attempts and Answer Share counts are stored in Supabase when both of these are set (for example in `.env.local`, or in the host's environment settings):

| Variable | Where to find it |
| --- | --- |
| `SUPABASE_URL` | Supabase dashboard → Project Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page → `service_role` secret key. Server-only: never expose it to the browser or prefix it with `NEXT_PUBLIC_`. |

Setting only one of the two is an error, so a misconfigured deploy fails loudly instead of silently using memory.

Create the schema once by running the migration in `supabase/migrations/`, either by pasting it into the dashboard's SQL Editor or with the Supabase CLI (`supabase link --project-ref <ref>` then `supabase db push`).

With the variables set, `npm test` also runs the storage contract tests against the real project (they write rows for far-future Puzzle Days with throwaway device IDs).

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

## Mechanics labels

```sh
npm run labels:prelabel   # keyword suggestions (free, no AI) -> src/content/labels/proposals/prelabel.json
npm run labels:worklist   # work file of champions changed since the last tagging, for /tag-patch
npm run labels:validate   # quote validator over approved.json (or pass a proposals file)
```

Once per patch, run `/tag-patch` in Claude Code: it proposes labels with exact evidence quotes into
`src/content/labels/proposals/`. Approved labels live in `src/content/labels/approved.json` (the only file the
Builder reads); term definitions and helpers are in `src/labels/`.

Layout: `src/engine/` is the pure Game Engine, `src/server/` holds the game service, storage and Puzzle source, and `src/app/` holds the UI and API routes.
