---
name: gem-panel
description: Pick and approve the Gem for every waiting Template proposal by panel consensus (three independent subagents with different lenses), then draft the approvals, run tests and build Puzzles. The maintainer only steps in later when real player feedback disputes a Template.
disable-model-invocation: true
argument-hint: "[templateId ...]  (default: every proposal waiting in the queue)"
---

# /gem-panel

The maintainer has delegated Gem picks and approval to this panel. They change an approval by hand only when real player feedback disputes it. Vocabulary: `GLOSSARY.md`. Gem rules: the gemCandidates section of `.claude/skills/review-template/SKILL.md`.

## 1. Collect the Templates

Run `npm run reviews:queue`. Take the Templates given as arguments, or every Template under "Proposals to approve". A Template under "No proposal yet" first needs `/review-template <templateId>`. Run that review yourself, then include the Template here.

For each Template, compute the **eligible** Gems from `proposals/<id>.json`. Leave out Too Clever entries and sort by Typicality, highest first. An entity is eligible when its Typicality is ≤ 0.25 and its rank is past the likeliest half (rank > ceil(n/2)). Resolve the names from `<id>.worklist.json`.

## 2. Panel: three independent subagents, launched in parallel

Every panelist gets the same brief. It names the Templates, the proposal and worklist paths, and the eligible ID lists. It says the panelist must stay read-only, must pick from the eligible list, and must report a #1 pick, two backups, vetoes and 2-3 sentences of reasoning, all in under 450 words. The lenses differ:

- **Veteran.** A Diamond+ player who knows the shop and the kits cold. Pick the eligible answer a veteran would kick themselves for missing.
- **Casual.** Gold/Plat, casual and ARAM players. The Gem must be one they recognise on reveal ("oh yeah, I've seen that").
- **Skeptic.** Quality control. Veto picks that players would dispute: technicalities over a stat vs. a passive, quest or mode-only items, reworked or new items people misremember, or estimates one small change away from ineligible. Verify that the Rule's stat or mechanic really applies.

Don't hand a panelist the other panelists' picks or your own preference.

## 3. Consensus

- If at least 2 of 3 panelists pick the same #1 and nobody vetoes it, that pick is the Gem.
- If a panelist vetoes the majority pick, or the three picks all differ, use SendMessage to send each panelist all three reports. Ask each to rank the candidates and to name any pick it cannot accept. The Gem is the highest-ranked pick that nobody rejects. If there is still no agreement, take the skeptic's pick, because the safest Gem wins.
- The Gem must be on the eligible list. Never change Typicality estimates just to make a pick eligible.

## 4. Approve

1. Run `npm run reviews:approve -- <id>`.
2. If the consensus Gem differs from the first candidate in the draft, edit `"gem"` in `approved/<id>.json`.
3. Run `npm test` and `npm run puzzles:build`.

A test that was already failing for an unrelated reason doesn't block the approval; report it. Don't commit unless the maintainer asks.

## 5. Report

For each Template, give the maintainer: the Gem, the vote (for example 3-0, or 2-1 with the dissent's reason), and any vetoed answers worth knowing about. Then list the proposal's open missing, disputable and wording points. Those are data fixes, so the maintainer decides them later.
