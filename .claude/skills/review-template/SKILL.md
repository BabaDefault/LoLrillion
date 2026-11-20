---
name: review-template
description: Review one Template and its current Answer Set, writing a proposal (missing/disputable answers, wording, Aliases, fun, Typicality, Too Clever and Gem candidates) for the maintainer to approve.
disable-model-invocation: true
argument-hint: <templateId>
---

# /review-template

You are a **reviewer**, not a decider: you write a proposal file, and the human approves it. Approved reviews in `src/content/reviews/approved/` are the only review files the Builder reads; you never create or edit them, and you never edit Templates, labels or nicknames.

Formats and the whole workflow: `src/content/reviews/README.md`. Vocabulary: `GLOSSARY.md` ("Prompt" is the player-facing question, never AI instructions).

If no Template ID was given, run `npm run reviews:queue`, show the human the queue and ask which Template to review.

## 1. Build the work file

Run `npm run reviews:worklist -- <templateId>`. It writes `src/content/reviews/proposals/<templateId>.worklist.json`: the Prompt text, Answer Type, Rule, filter (and the mechanics term definition for kit Templates), the queue status (for `changed`: the Entities added and removed since approval), the current approved review if any, every Entity in the Answer Set with its name, Aliases and current Tier, and the names of every other Entity of the Answer Type (`notInAnswerSet`).

Done when the command reports the answer count.

## 2. Review

Judge the Answer Set against the **Rule**, not the Prompt's everyday meaning. Scope is the current patch: own base kit, items currently in the shop. For a `changed` Template, focus on the added and removed Entities, but still give every estimate.

Work through every section; each point needs a `why` a maintainer can check:

- **missing**: Entities in `notInAnswerSet` that a reasonable player would say fit the Rule. Name them by `name` (they have no place in the set yet). Say whether the fix is data (a label, nickname) or the Rule.
- **disputable**: Entities in the Answer Set whose membership players would argue about.
- **wording**: ambiguity in the Prompt text or Rule, with a `suggestion`.
- **aliases**: spellings players would actually type (nicknames, old names, abbreviations) that aren't in the Entity's `aliases`. Skip anything already there or that only differs by case, spaces or punctuation.
- **fun**: `fun`, `ok` or `dull`, and why. A Prompt is fun when most players can name a few and few can name them all.
- **typicality**: simulate about 100 varied players (new to veteran, every role) each giving their first answer within 25 seconds. For **every** Entity in the Answer Set, `value` is how readily it comes to mind for this Prompt, from 0 (nobody) to 1 (everyone's first answer). It's about this Prompt, not general popularity: Thresh is typical for "can pull an enemy" but not for "has a dash".
- **tooClever**: Entities that seem obscure but that players reach for *because* they seem obscure (the "everyone thinks they're clever" pick). Usually zero to three.
- **gemCandidates**: exactly three, best first, from the Answer Set, none Too Clever. A Gem is satisfying to find when revealed ("oh, of course!"), not merely the rarest. Like Krillion's, it is "something at least a few players actually get": prefer Typicality of roughly 0.05-0.25, and never a deep cut almost nobody would type. Approval enforces a hard floor on obscurity: an approved Gem with Typicality above 0.25, or in the likeliest half of the Answer Set by Typicality (Too Clever left out), fails `npm test` and `puzzles:build`. So every candidate must clear both with your own estimates; above that threshold, pick the one that's most fun.

## 3. Write and validate the proposal

Write `src/content/reviews/proposals/<templateId>.json` in the proposal format from the README, copying `templateId`, `dataVersion` and the Answer Set's Entity IDs (`answerSet`) from the work file.

Run `npm run reviews:validate -- <templateId>` and fix every PROBLEM line.

Done when the validator exits 0.

## 4. Hand off

Report to the human: the fun verdict, every missing / disputable / wording point, suggested Aliases, the Too Clever candidates and the three Gem candidates with their reasons, and the five most and least typical answers.

Then run `npm run reviews:queue` and show where this proposal now sits. Proposals are listed **most uncertain first**, with reasons computed from the proposal (each disputable and missing entry, a review on an older patch, answers resting on a label checked before their ability text changed, Typicality estimates near a band edge or Gem candidates near the 0.25 Gem threshold). Tell the human to **approve top-down**: the top proposals are the likeliest to need correcting. Never add your own confidence rating; the queue doesn't use one.

Approval is theirs: they run `npm run reviews:approve -- <templateId>`, edit the drafted approved file to their picks, commit it, then run `npm test` and `npm run puzzles:build`.
