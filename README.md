# LoLrillion
Krillion but league of legends

## Develop

```sh
npm install
npm run dev     # http://localhost:3000
npm test        # Vitest (Game Engine)
npm run build
```

## Smoke test (Playwright)

One Playwright test plays a full Puzzle Day through the running app. Run it **before every deploy**
(locally, against a production build) and **after every deploy** (against the deployed URL).

```sh
npx playwright install chromium   # once per machine
npm run test:smoke                # before a deploy: next build + next start on :3100, then every spec
```

Before a deploy, `npm run test:smoke` builds the app, starts it on port 3100 in smoke-test mode
(`LOLRILLION_SMOKE_TEST=1`, set only by `playwright.config.ts`), and runs `e2e/smoke.spec.ts`. Two
browser contexts (two devices) play the fixed smoke Puzzle (`src/server/smoke-puzzle.ts`, not the real
content). The test covers a Rejected Attempt then an Accepted Guess, a wrong Answer Type message, a
Did-you-mean confirmation, a timeout Miss, the end screen with the share line, and a group leaderboard
showing both players. It also runs the read-only `e2e/deployed.spec.ts`. The clock is adjustable, so the
5s/25s windows are skipped instead of waited out, and the whole run takes seconds after the build. Set
`SMOKE_SKIP_BUILD=1` to reuse the existing `.next` build.

In smoke-test mode the server always uses the in-memory store, even if `.env.local` has Supabase
credentials, so the test never touches the real database. It also serves the test-only
`/api/test/clock` and `/api/test/reset` routes. Without the variable those routes return 404, and if
the variable is ever set where `VERCEL_ENV=production`, the server refuses to start.

After a deploy, point the test at the deployed URL:

```sh
PLAYWRIGHT_BASE_URL=https://<deployment>.vercel.app npm run test:smoke            # bash
$env:PLAYWRIGHT_BASE_URL="https://<deployment>.vercel.app"; npm run test:smoke    # PowerShell
```

With `PLAYWRIGHT_BASE_URL` set, no server is started and only `e2e/deployed.spec.ts` runs. A deployed site
has no test hooks, so this run is a reduced, read-only check: the home page offers today's Puzzle without
revealing it, the state API sends no Answer Set, results stay locked before the Puzzle is finished, the
leaderboards and stats pages load, the admin-only archive is a 404, and the `/api/test/*` routes return 404. It never starts a
Prompt or submits a Guess, so it leaves no plays in Supabase. The gameplay flows (Attempts, Did-you-mean,
timeouts, the end screen, share line and group leaderboards) are covered only by the local run. If the
preview has Vercel Deployment Protection, also set `VERCEL_AUTOMATION_BYPASS_SECRET`.

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

## Template reviews

```sh
npm run reviews:queue                     # Templates never approved, or whose Answer Set changed since approval
npm run reviews:worklist -- <templateId>  # work file for /review-template
npm run reviews:validate -- <templateId>  # check the proposal
npm run reviews:approve -- <templateId>   # draft the approved file from the proposal, then edit and commit it
npm run reviews:share                     # Answer Share per Template (needs the Supabase variables)
npm run reports:unmatched                 # Rejected Guesses per Template (needs the Supabase variables)
```

`reports:unmatched` groups every Guess Rejected as an answer by its normalized text, with counts and distinct
players, most frequent first (`--day YYYY-MM-DD`, `--template <templateId>`, `--json`). `-> ENTITY` marks a Guess
naming an Entity of the Answer Type outside the Answer Set: a likely missing answer or disputable Rule, for
`/review-template`. `-> ?` marks one naming no Entity: a likely missing Alias (add it to
`src/content/game-data/nicknames.ts`, then `npm run data:registry`) or a typo. Did-you-mean and wrong-Answer-Type
results are not Attempts and never appear.

Run `/review-template <templateId>` in Claude Code: it proposes missing/disputable answers, wording fixes, Aliases,
a fun check, Typicality per Entity, Too Clever and Gem candidates into `src/content/reviews/proposals/`. Only
`src/content/reviews/approved/` reaches Puzzles. Formats and workflow: `src/content/reviews/README.md`.

## Dated Puzzles

```sh
npm run puzzles:build                             # next 14 Puzzle Days, from approved Templates only
npm run puzzles:build -- --from 2026-12-01 --days 7
npm run puzzles:build -- --report                 # Answer Set size and Tiers per eligible Template
npm run puzzles:build -- --include-unreviewed     # opt in: also use Templates with no approved review
```

By default only Templates with an approved review file in `src/content/reviews/approved/` are eligible, so
until at least seven are approved (within the generator's esports and Family limits) a build of new days fails
with a "not enough Prompts" error. `--include-unreviewed` restores the old behaviour of drawing from every
Template (unreviewed ones use the Builder's defaults).
Already-generated dated Puzzles in `src/content/puzzles/` are never rewritten (unless `--force`), so a live
Puzzle never changes.

Layout: `src/engine/` is the pure Game Engine, `src/server/` holds the game service, storage and Puzzle source, and `src/app/` holds the UI and API routes.
