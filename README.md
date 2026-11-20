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

Layout: `src/engine/` is the pure Game Engine, `src/server/` holds the game service, storage and Puzzle source, and `src/app/` holds the UI and API routes.
