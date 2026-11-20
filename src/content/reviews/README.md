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
2. In Claude Code, run `/review-template <templateId>`. It runs `npm run reviews:worklist -- <templateId>`,
   writes `proposals/<templateId>.json`, and checks it with `npm run reviews:validate -- <templateId>`.
3. Read the proposal. Fix the data it flags (labels, overlay, Template filter, Rule wording, nicknames) where
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
  "templateId": "champions-yordle",
  "dataVersion": "16.23.1",
  "answerSet": ["champion:Corki", "champion:Fizz", "..."],
  "missing": [{ "entity": "Yuumi", "why": "Players think she's a Yordle; the Rule already says she's a cat, so not missing." }],
  "disputable": [{ "entity": "champion:Gnar", "why": "..." }],
  "wording": [{ "why": "\"Yordle\" vs \"yordle\"", "suggestion": "Name a Yordle champion" }],
  "aliases": [{ "entity": "champion:Heimerdinger", "alias": "heimer", "why": "Common short form." }],
  "fun": { "verdict": "fun", "why": "..." },
  "typicality": { "champion:Teemo": { "value": 0.95, "why": "The face of the Yordles." } },
  "tooClever": [{ "entity": "champion:Gnar", "why": "..." }],
  "gemCandidates": [
    { "entity": "champion:Kled", "why": "..." },
    { "entity": "champion:Vex", "why": "..." },
    { "entity": "champion:Corki", "why": "..." }
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
  "templateId": "champions-yordle",
  "dataVersion": "16.23.1",
  "answerSet": ["champion:Corki", "champion:Fizz", "..."],
  "typicality": { "champion:Teemo": 0.95, "champion:Kled": 0.15 },
  "tooClever": ["champion:Gnar"],
  "gem": "champion:Kled"
}
```

- `answerSet`: the sorted Answer Set as approved. The review queue diffs the current Answer Set against it.
- `typicality`: approved Typicality per Entity, 0 to 1. Entities left out use the Builder's default.
- `tooClever`: Entities that score Too Clever (15). `gem`: the one Gem (100), not Too Clever.
- Every pick must be in `answerSet`; `puzzles:build` and `npm test` refuse an inconsistent file.
- If a data refresh drops a pick from the Answer Set, the Builder ignores it (falling back to a rare but
  reachable answer, about 80% of the way down by Prior, for a dropped Gem) and the Template shows as `changed` in the queue until it is re-approved.
