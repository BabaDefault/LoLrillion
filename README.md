# LoLrillion
Krillion but league of legends

## Develop

```sh
npm install
npm run dev     # http://localhost:3000
npm test        # Vitest (Game Engine)
npm run build
```

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

Layout: `src/engine/` is the pure Game Engine, `src/server/` holds the game service, storage and Puzzle source, and `src/app/` holds the UI and API routes.
