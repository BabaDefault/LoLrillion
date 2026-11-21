# Template reviews

The review queue lives in these files; there is no admin page. Each Template is reviewed once with AI help
(`/review-template`) and approved by the maintainer. Only `approved/` reaches Puzzles.

```
proposals/<templateId>.worklist.json   work file for /review-template (regenerable, not committed)
proposals/<templateId>.json            the AI's proposal: reasons for every point; never read by the Builder
approved/<templateId>.json             the maintainer's approval: the only review file the Builder reads
```

## Workflow

1. `npm run reviews:queue` lists Templates that need review: `unreviewed` (never approved) or `changed`
   (the Answer Set differs from the one it was approved on, after a data refresh; shown with `+added -removed`).
   Approvals that fail today's checks (e.g. a rule added after they were approved) come first as
   `needs re-approval`, with their problems: redo them with `npm run reviews:approve -- <templateId>`, which
   replaces an invalid approval without `--force`. `npm run puzzles:build` refuses to run until they are fixed.
   Templates with a proposal waiting come first, **most uncertain first**, each with its score and reasons; work
   through them **top-down**. Templates with no proposal yet follow. The score is computed by code
   (`src/uncertainty`), never by asking the AI how sure it is:

   | Signal | Adds |
   | --- | --- |
   | each `disputable` entry | 2 |
   | each `missing` entry | 2 |
   | proposal reviewed on an older patch than the current snapshot (esports Templates: an older esports snapshot) | 2 |
   | a Gem candidate's Typicality within 0.05 of the Gem threshold (0.25) | 2 each |
   | a Gem candidate in the likeliest half of the Answer Set, or one a Typicality change of 0.05 would put there | 2 each |
   | an Answer Set entry resting on a mechanics label checked (`tagged.json`) before its ability text changed | 1 each |
   | neighbouring Entities across a band edge with Typicality within 0.05 (banded as the drafted approval would be) | 1 per pair |

   Mechanics labels have the same kind of queue: `npm run labels:queue` (see `/tag-patch`).
2. In Claude Code, run `/review-template <templateId>`. It runs `npm run reviews:worklist -- <templateId>`,
   writes `proposals/<templateId>.json`, and checks it with `npm run reviews:validate -- <templateId>`.
3. Read the proposal. Fix the data it flags (labels, Template filter, Rule wording, nicknames) where
   you agree; those are separate commits through their own workflows.
4. `npm run reviews:approve -- <templateId>` drafts `approved/<templateId>.json` from the proposal (Gem = first
   candidate, every Too Clever candidate, every Typicality estimate). Edit it to your picks, commit it, then
   `npm test` and `npm run puzzles:build`. Already-generated Puzzles don't change; new ones use the approval.
5. To re-tier a played Template by hand, `npm run reviews:share -- --template <templateId>` prints its Answer
   Share (needs the Supabase variables); adjust the approved file and rebuild.

## Proposal format (`proposals/<templateId>.json`)

Type: `ReviewProposal` in `src/reviews/types.ts`. Every point carries a `why`.

```json
{
  "templateId": "champions-pull",
  "dataVersion": "16.23.1",
  "answerSet": ["champion:Blitzcrank", "champion:Darius", "..."],
  "missing": [{ "entity": "Poppy", "why": "Players remember Heroic Charge moving enemies, but it pushes them away, so not missing." }],
  "disputable": [{ "entity": "champion:Sett", "why": "..." }],
  "wording": [{ "why": "\"pull\" could read as pulling minions", "suggestion": "Name a champion who can pull an enemy champion" }],
  "aliases": [{ "entity": "champion:Blitzcrank", "alias": "blitz", "why": "Common short form." }],
  "fun": { "verdict": "fun", "why": "..." },
  "typicality": { "champion:Blitzcrank": { "value": 0.95, "why": "Rocket Grab is the hook everyone knows." } },
  "tooClever": [{ "entity": "champion:Nautilus", "why": "..." }],
  "gemCandidates": [
    { "entity": "champion:Skarner", "why": "..." },
    { "entity": "champion:Urgot", "why": "..." },
    { "entity": "champion:Zac", "why": "..." }
  ]
}
```

- `answerSet` is the Answer Set that was reviewed; the validator rejects a proposal made on a stale one.
- `typicality` has an estimate (0 = nobody names it, 1 = everyone's first answer) for **every** Entity in the
  Answer Set, from simulating about 100 players.
- `gemCandidates`: exactly three, distinct, in the Answer Set, best first, none of them Too Clever.
- `missing` entries may name Entities outside the Answer Set (`entity` is then a name); everything else uses
  Entity IDs from the Answer Set.

## Approved format (`approved/<templateId>.json`)

Type: `ApprovedReview` in `src/reviews/types.ts`. The file name must be `<templateId>.json`.

```json
{
  "templateId": "champions-pull",
  "dataVersion": "16.23.1",
  "answerSet": ["champion:Blitzcrank", "champion:Darius", "..."],
  "typicality": { "champion:Blitzcrank": 0.95, "champion:Skarner": 0.15 },
  "tooClever": ["champion:Nautilus"],
  "gem": "champion:Skarner"
}
```

- `answerSet`: the sorted Answer Set as approved. The review queue diffs the current Answer Set against it.
- `typicality`: approved Typicality per Entity, 0 to 1. Entities left out use the Builder's default.
- `tooClever`: Entities that score Too Clever (15). `gem`: the one Gem (100), not Too Clever.
- Every pick must be in `answerSet`; `puzzles:build` and `npm test` refuse an inconsistent file.
- The Gem must be obscure (Krillion's "past a certain obscurity threshold"), judged from approved Typicality
  because Familiarity may not exist. `puzzles:build` and `npm test` refuse a Gem that has no Typicality, has
  Typicality above 0.25 (`GEM_MAX_TYPICALITY`), or sits in the likeliest half of the Answer Set ranked by
  Typicality (Too Clever picks left out; ties count in the Gem's favour). Which qualifying answer is the fun
  one stays your call.
- If a data refresh drops a pick from the Answer Set, the Builder ignores it (falling back to a rare but
  reachable answer, about 80% of the way down by Prior, for a dropped Gem) and the Template shows as `changed` in the queue until it is re-approved.
