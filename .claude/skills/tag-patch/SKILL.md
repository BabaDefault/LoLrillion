---
name: tag-patch
description: Once per patch, propose mechanics labels (with exact evidence quotes) for champions whose ability text changed.
disable-model-invocation: true
---

# /tag-patch

You are a **labeller**, not a decider: you write proposals to a file, and the human approves them. Approved labels in `src/content/labels/approved.json` are the only labels the Builder reads; you never edit that file.

Scope is the champion's **own base kit on the current patch**. Abilities listed under `borrowedAbilities` in the work file (Sylas's Hijack, Viego's possession, Neeko's disguise) never count as evidence.

## 1. Build the work file

Run `npm run labels:worklist`. It writes `src/content/labels/proposals/worklist.json` with the term definitions, the borrowed abilities, and one entry per **changed** champion (ability text differs from `src/content/labels/tagged.json`; new champions count as changed): its plain ability text, its current approved labels, and keyword suggestions.

When a new term has just been added to `MECHANICS_TERMS`, no champion has been judged on it yet: run `npm run labels:worklist -- --all --terms <id,...>` instead, which covers every champion for only those terms. Split the work file into chunks if it is too large to judge in one pass.

Done when the command reports the count. If the count is 0, tell the human there is nothing to tag and stop.

## 2. Label each changed champion

For every champion in the work file and every term in `terms`, decide: has it, or doesn't. Read the full ability text yourself: keyword suggestions are leads, often wrong (a self-pull is a dash; "draws back" a curse is not a pull), and they miss things worded differently.

For each "has it", write one label:

```json
{ "entityId": "champion:Kaisa", "term": "invisible", "ability": "E", "quote": "Kai'Sa also becomes Invisible for {{ e7 }} seconds.", "sourceField": "tooltip" }
```

- `quote` is copied **verbatim** from that ability's `description` or `tooltip` in the work file (tags already stripped; keep `{{ var }}` placeholders exactly). Shortest span that proves the term.
- Rarely, the game plainly has the term but no text shows it (Ashe's R is global; its text never says so). Then quote a span that identifies the ability and add `"inGame": "<what the game does>"`. Only for facts any player would confirm; never to stretch a term.
- One label per champion per term is enough.
- Judge against `definition` and `excludes`, never the term's everyday meaning.

Every existing approved label on a changed champion is re-decided too: keep it (re-quote if its text moved), or list it for removal.

Done when every (changed champion × term) pair has a decision.

## 3. Write and validate the proposals

Write `src/content/labels/proposals/<patch>.json`:

```json
{
  "patch": "16.24.1",
  "labels": [ /* every label that should be approved for the changed champions, kept ones included */ ],
  "remove": [ { "entityId": "...", "term": "...", "why": "..." } ],
  "notes": [ { "entityId": "...", "term": "...", "why": "borderline case for the reviewer" } ]
}
```

Run `npm run labels:validate -- src/content/labels/proposals/<patch>.json`. Fix every REJECTED line by re-copying the quote from the text; drop a label only if no quote proves it.

Done when the validator exits 0.

## 4. Hand off

Run `npm run labels:queue -- src/content/labels/proposals/<patch>.json`. It lists every proposed label **most uncertain first**, with the reasons code found (no keyword evidence from the pre-labeller, a quote without the term's keyword or from the short `description`, a borderline term such as dash vs blink, ability text that changed this patch). It never asks you how sure you are: don't add confidence ratings to the proposals.

Report to the human: champions tagged, labels added / removed versus `approved.json`, every `notes` entry, and the queue's top entries with their reasons. Tell them to **work through the queue top-down**: the top labels are the likeliest to be wrong. Approval is theirs: they merge the proposals into `approved.json`, run `npm test`, then `npm run labels:worklist -- --mark-tagged` to record the patch as tagged.
