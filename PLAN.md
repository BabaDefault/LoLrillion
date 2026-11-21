# LoLrillion — design plan (League of Legends Krillion-style trivia)

## Context
Build a daily League of Legends trivia game modeled on Krillion's mechanic: 7 prompts per day, each with
many valid answers; correct answers score more the *rarer* they are among all players. Goals: a solid
portfolio project, played casually by the user and friends, with daily puzzles, per-day leaderboards and
shareable results. Topics: champions, items, skins, esports. The working dir `lolrillion/` is empty — greenfield.
Use the Krillion *mechanic* only; own name/branding/look (not a clone of krillion.io's UI).
Vocabulary is defined in `GLOSSARY.md` (Puzzle, Prompt, Template, Entity, Guess, Attempt, Match, Prior,
Tier, Gem, Too Clever, Points, Answer Share). "Prompt" always means the player-facing question, never AI instructions.
Note: the "article" cited below for the failure-type table is a **third-party analysis** of Krillion
(aiidelist.com), not something Krillion's creator wrote.

## Core game loop
- One puzzle per day, same 7 prompts for everyone. **Resets at 12:00am Australian time**
  (`Australia/Sydney`, so it follows AEST/AEDT daylight saving automatically).
  - The "puzzle day" is the current date in `Australia/Sydney`, worked out in code, not in UTC.
  - **No scheduled job needed:** puzzles are pre-assigned to dates, so whichever puzzle matches the
    current Sydney date is the live one. The previous day is finalized on the first request after
    Sydney midnight. This avoids free-tier cron limits and the AEST/AEDT UTC-offset problem.
- Per prompt: **5-second read time, then a 25-second answer window** (Krillion uses 3s + 25s). During the
  read time the Prompt, Rule and Answer Type are visible but input is locked.
  - **Retries allowed:** a wrong or invalid Guess is rejected (shake) and the player can keep making Attempts
    until one is accepted or time runs out. The **first accepted Guess locks the prompt.** Timing out scores 0.
  - **No suggestions while typing** (no autocomplete, so recall isn't turned into recognition). On submit:
    exact name/alias → accepted or rejected straight away; a misspelling or near-miss of a real Entity →
    **"Did you mean Kassadin?"** popup (Yes submits it, No returns to editing; the timer keeps running and the
    popup doesn't count as an Attempt). Near-miss matching uses every Entity of the prompt's Answer Type, not the
    Answer Set, so it never leaks answers. Several close names → the popup lists them. Typing the wrong
    Answer Type (a champion on a SKIN prompt) → "This asks for a skin" popup, no Attempt used.
  - The timer is enforced **server-side**: the server records when the answer window opened and rejects
    Guesses that arrive after 25s plus a small network grace (~2s).
  - Prompts are revealed one at a time, so players can't read ahead or look answers up.
  - Between prompts: only a **score animation** (Tier name + emoji + Points), then the next prompt.
- Every prompt shows an **answer-type badge** (CHAMPION / ITEM / SKIN / PRO PLAYER / TEAM), and the
  autocomplete only offers that type. This stops players typing a champion when a pro player was wanted
  ("name a support at Worlds"), or a champion when a full skin name was wanted.
- No accepted Guess = 0. Accepted = its Tier's Points. Total = sum (max 700).
- **End screen (the reveal):** total, a ranked-style **day title** (0–150 Iron · 151–250 Silver · 251–350 Gold ·
  351–449 Diamond · 450+ Challenger), "better than X% of today's players", the day's score-distribution curve,
  and per prompt: your answer, its Tier, "N players chose this", and the full Answer Set sortable by most/least
  chosen with the Gem highlighted.
- Difficulty ramp across the 7 prompts (broad → narrow).

## Rarity scoring (curated Tiers from real data, like Krillion)
Why: The Daily Rift scored purely on how many players gave each answer, and it broke down. With about
30 players most answers were unique, so scores bunched at 60 or 85 and "first bloods" were everywhere.
Players also skipped the obvious answers, so obvious answers ended up scoring as rare (Thresh and Blitzcrank
for pulls rarer than Skarner). Krillion itself never scores from live player counts:
it uses fixed Tiers set from a familiarity database plus LLM assistance and a manual pass. LoLrillion does the same.

**1. Prior = how likely a player is to name this Entity for this Prompt** (not how much it's played):
- **Familiarity** (per Entity, prompt-independent): how well known it is overall.
  - Champions: **lifetime Champion Mastery** (Champion-Mastery-V4) summed over a worldwide sample of players,
    so it doesn't swing with the meta.
  - Items: build rate in the sampled matches (items have no mastery equivalent).
  - Skins: the champion's Familiarity, adjusted by Typicality (below), since there's no skin usage data.
  - Esports players/teams: pro games played / appearances, from Leaguepedia.
- **Typicality** (per Entity *per Prompt*): how readily it comes to mind for that specific Prompt (Blitzcrank and
  Thresh for "pull" because their hooks define them). Estimated by `/review-template` (Claude Code simulates ~100 players answering
  and gives a recall estimate per Entity), then **approved by you** in the review queue.
- Prior = a weighted blend of the two, normalized over the Answer Set. Current-patch pick rate is only a tiebreaker.

**2. Tiers (fixed per Template, set when you approve it)**

| Points | Tier | Emoji | How it's assigned |
|---|---|---|---|
| 10 | Minion | 🟦 | Code: highest-Prior band |
| 15 | Too Clever | 🤡 | AI flags "obvious obscure" answers players reach for *because* they seem rare; you approve |
| 30 | Kill | 🟩 | Code: Prior band |
| 60 | Triple Kill | 🟨 | Code: Prior band |
| 85 | Quadra Kill | 🟧 | Code: lowest-Prior band |
| 100 | Pentakill (the **Gem**) | 💎 | Exactly one per Prompt. AI proposes 3 candidates with reasons; you pick the most satisfying find |
| 0 | Miss | ⬛ | Timed out with no accepted Guess |

- The trap Tier directly fixes the Daily Rift problem: answers that seem obscure but everyone types
  ("Bramble Vest" for Armor items) score barely above the obvious ones.
- **No crowd nudge.** Player answers never change Tiers automatically. Live counts only drive Answer Share
  ("N players chose this"), the percentile and the score curve, plus a stats report you can use to re-tier a
  Template by hand.
- Because Tiers are fixed, **Points are final the moment a Guess is accepted**. There's no provisional scoring;
  at day end the leaderboard simply freezes (on the first request after Sydney midnight).

## Data sources
- **Riot Data Dragon** (free static JSON, versioned per patch): champions (tags, partype, release via
  `info` fields), abilities, items (stats, tags), skins. Also **Community Dragon** for richer fields
  (skin lines, item history).
- **Esports: Leaguepedia** (lol.fandom.com Cargo API): players, teams, tournament winners.
  Snapshot into local JSON; esports prompts are hand-curated templates against the snapshot.
- **Riot API (Champion-Mastery-V4 + Match-V5 + League-V4)** for Familiarity: a script samples players and
  recent ranked matches **worldwide** (spread evenly across all major regions and all ranks), then aggregates
  them into `data/familiarity.json` (summed lifetime champion mastery, item build rate, pick rate as tiebreaker).
  Needs a Riot API key. Development keys
  expire every 24h, so apply for a **personal API key** (free; approval is for non-commercial projects).
  Stay within the rate limits by refreshing once per patch, not live.
- Some attributes aren't in Data Dragon ("has a dash", global ult, stuns) —
  they come from approved mechanics labels (`/tag-patch`), each quoting the ability text.
- Snapshot data per puzzle (store the data version with the puzzle) so mid-day patches can't change answers.

## Puzzle generation
- Prompt *templates* = filter functions over the data snapshot, e.g. `champions labelled dash`,
  `items with tag=SpellBlock`, `skins in line=Star Guardian`, `Worlds-winning players from LCK`.
- Generator picks 7 templates/day with constraints: answer-set size in a good range (≈8–100),
  category mix (**at most 1 esports prompt per day**; many players don't follow pro play),
  no repeat of a template within N days. Pre-generate a week ahead; allow manual override.
- Answer normalization: see **Answer accuracy** below.

## Answer accuracy (top priority)
Two things are kept separate: **validity** (does this answer actually fit the prompt?) and **rarity**
(how many points it scores). The AI (an LLM) does its work while puzzles are being *prepared*, and a
human approves it. It is **not** called live on every answer, because that would slow the 25s game
and could judge the same answer differently on different calls.

**1. Canonical entity registry**
- Every champion, item, skin, player and team gets one stable ID (from Data Dragon or Leaguepedia).
  An answer always resolves to an ID, never to free text, so spelling variants can't split the rarity count.
- An alias table is attached to each ID: official name, common nicknames (`MF`, `TF`, `Asol`,
  `Mundo`), internal names (`MonkeyKing`), old or renamed names (`Nunu`), and for esports players
  their in-game-name history.

**2. Every fact has a source**
- Every hand-maintained fact ("has a dash", Worlds winner, ...) stores a `source`
  link (official wiki or Leaguepedia page) and the `patch` it was checked on.
- Every prompt has a written **rule** shown to players (e.g. *"Dash = any self-movement ability
  that isn't a blink or teleport"*), so categories that could be argued either way are settled up front.

- Standard scope rules that apply to every prompt unless it says otherwise:
  - **Kits = the champion's own base kit on the current patch.** Stolen or copied abilities don't count
    (Sylas taking an ult, Viego possessing, Neeko disguising); otherwise they'd fit almost every prompt.
  - **Items = currently in the shop on the current patch**, unless the prompt says "ever".
  - **Esports prompts state the event and stage exactly** (e.g. "at any Worlds, including Play-Ins").
  - Words like "pull", "dash", "invisible" or "stun" have one fixed definition in a shared glossary
    (e.g. Gnar's knockback is a push, not a pull).

**3. AI review of every prompt template before it's used** (how it works: see *AI implementation*)
- **The AI is given the facts, not left to remember them.** Its prompt includes the current patch's
  ability and item text (from Data Dragon/Community Dragon), so it checks today's kits rather than
  whatever it remembers. A model's memory is out of date after reworks (e.g. Aurora's old ult pull).
- For each prompt template (once, plus again if a patch changes its answers), the LLM is asked to:
  (a) list answers it thinks qualify but are *missing* from our set,
  (b) flag answers in our set that are *disputable*,
  (c) flag *ambiguous wording*, and
  (d) suggest *alias candidates* players are likely to type.
- Anything it raises goes into a **review queue** where you approve or reject it. Nothing the AI says goes
  live without approval, and approved decisions are stored with their evidence.
- Daily puzzles are assembled only from approved templates, so no per-day review is needed.

**3b. Generate answer lists from data, not by hand**
- Wherever the data allows, answer sets are built automatically from the full data, never typed in.
  For example, "skin with *Dragon* in its name" is a search over every skin in Community Dragon,
  matching the whole word anywhere in the name (`Dragonslayer`, `Dragonblade`, `Obsidian Dragon`,
  `Storm Dragon` ...). Hand-typed lists are how answers go missing.

**4. Matching order (deterministic)**
0. Normalize first: lowercase, strip apostrophes, spaces, periods and `&`, so `Kai'Sa` = `kaisa` = `Kai Sa`.
1. Exact canonical name, then 2. approved alias → accepted or rejected straight away.
3. Otherwise a conservative fuzzy match (edit distance scaled by length, **no fuzzy matching on names of
   4 characters or fewer**) is **never applied silently**: it raises the "Did you mean X?" popup (see Core
   game loop), so the player confirms every correction and wrong auto-corrections can't happen.

**5. Catching missed answers** *(v1: unmatched Guesses are logged; the rest is v1.1)*
- Answers that don't match anything are logged, not just thrown away. Whenever you run the triage
  step (see *AI implementation*), the unmatched answers are sorted into typo of a valid entity / valid answer
  we missed / wrong, and you confirm. Confirmed fixes **re-score the affected days, even after they've closed**
  (see Versioning), so players get their points back. You don't have to beat the midnight deadline.
- A "Report this answer" button records the prompt, the answer, what it was read as, and an optional source link.
  Reports are labeled: *missing answer, missing alias, wrong auto-correction, wording problem, disputed rarity*.

**6. Versioning** *(v1.1)*
- Answer sets and alias tables are versioned per puzzle. Any correction is a new version, and scores are
  recalculated from it, so past results can always be explained.
- **Correction policy for days that have closed** (the article warns that quietly changing results makes
  them hard to compare): a fix that makes a rejected answer *valid* re-scores the past day **upward**, so
  players get their points back. A fix that makes an accepted answer *invalid* only applies from then on,
  and nobody loses points they were already given. Players' results show a small "corrected" note.
- Accuracy is tracked as two separate numbers: % of rejected answers that were actually valid, and
  % of accepted answers matched to the wrong entity.

## AI implementation ($0, no paid API)
**Constraint: the project must cost nothing to run.** So there is no Anthropic API key and no per-call billing.
The AI work runs in **Claude Code on your existing Claude subscription**. This assumes Claude Code is
signed in with a Pro/Max plan, not billed through an API key. It uses your normal usage limits, with no extra bill.
The trade-off is that the AI steps are **run by you** (a few minutes, a few times a month), not fully automatic.
That suits this project anyway, since you review AI output before it goes live.

**Key idea: the AI labels the data, and code builds the answer lists.** The AI reads each champion's kit
**once per patch** and labels it against the shared glossary (`invisible`, `dash`, `pull`, `stun`,
`global_ult`, ...). Answer lists then come from those labels with ordinary code, so they're consistent,
quick to rebuild, and easy to check.

**The AI's role: reviewer, never decider** (following the third-party Krillion analysis's advice to give the
model an explicit job: "proposing a classification, explaining uncertainty, or identifying missing
candidates", never "a confident score without a defined task"). It never writes live data directly and
never runs while people are playing. Every output is a *suggestion with evidence* that you accept or reject.

| Review job | What the AI checks | Failure type it prevents (article's table) |
|---|---|---|
| Label review | Do the keyword-script labels match the kit text? What did keywords miss? | Coverage gap |
| Answer-set review | Valid answers missing from the list; edge cases like Sylas or Viego | Coverage gap, category ambiguity |
| Wording review | Could a player misread this prompt? (champion vs pro player, champion vs full skin name) | Category ambiguity |
| Nickname review | What will players type? (`asol`, `j4`, `kaisa`) Which nicknames are too short or ambiguous to accept? | Missing alias, overcorrection |
| Typicality + Tier review | Simulates ~100 players to estimate Typicality per answer; proposes Too Clever candidates and 3 Gem candidates, with reasons | Disputed rarity |
| Fun review | Does the prompt have a few findable rare answers, or is it all obvious or all impossible? | Editorial: "satisfying and attainable" |
| Report review (optional) | Sorts player reports and unmatched answers into the five failure types | All five |

**Layer 1: keyword pre-labelling (free, automatic, no AI)**
- Riot's ability text uses fairly consistent game terms ("Invisible", "Camouflage", "Dash", "Pulls",
  "Knocks Up", "Stuns"). A script searches the current patch text for these and proposes labels.
  These are suggestions with the matching text attached, not final answers.

**Layer 2: Claude Code commands in the repo (`.claude/skills/`)**
- `/tag-patch` (once per patch, ~2/month): a script first writes a work file listing champions/items
  whose ability text **changed** since the last patch (so reworks like Aurora's are caught automatically),
  along with the glossary and Layer 1 suggestions. Claude Code labels each one and writes `labels.json`.
  Every label must include **an exact quote from the ability text as evidence**.
- `/review-template` (once, when you add a new prompt template): Claude Code runs the answer-set,
  wording, nickname, Typicality + Tier and fun reviews on that template and its current answer set. You approve
  it (including the Too Clever answers and the Gem) once, and the generator can then use it on any day.
- **No weekly audit.** Puzzles are built only from approved templates, so the things a weekly audit would
  check are covered elsewhere:
  - wording, rules and fun are fixed when the template is approved;
  - a template's answers only change when a patch does, so after `/tag-patch` a script diffs every template's
    answer set and puts only the **changed** ones back in the review queue;
  - the generator checks every day's puzzle automatically: answer-set size in range, at least a few
    genuinely rare answers (Triple Kill or above), category mix, no recent repeats.
- `/triage` (optional, v1.1): Claude Code sorts player reports and unmatched answers into the five failure types,
  with evidence. At friends-scale you can also just read them yourself on the admin page.

**Guardrails (same as before, all plain code)**
- **Hallucination check:** a validation script makes sure every evidence quote really appears in the source
  text. A label with a fake quote is rejected, and low-confidence labels go to the review queue.
- Nothing goes live until you approve it in the review queue (simple admin page).
- The game itself never calls an AI, so it keeps working even if you skip a week of triage.

**Cost: $0.** If you ever want it fully automatic, the same commands can be switched to the paid API later
(estimated ~$8–15/month at friends-scale on Opus 5.5). That is an option, not part of this plan.

## Players, leaderboards, sharing
- No accounts at first: anonymous device ID + chosen nickname; optional **friend group code** for a
  private daily leaderboard alongside the global one.
- Scoring runs server-side; the client never receives the Answer Set until the day's play is finished.
  One accepted Guess per prompt per device per day (rejected Attempts are logged).
- Share text (no spoilers): `LoLrillion #N` · total + day title · one Tier emoji per prompt
  (e.g. `🟦🟨💎⬛🤡🟧🟩`) · optional link.
- **Personal stats page** (per device ID): games played, average score, Tier counts, Gems found, best day.
- **No streaks.**
- Archive: past days playable for fun but not on that day's leaderboard.

## Proposed stack (all free tiers, $0/month)
| Piece | Service | Free-tier notes |
|---|---|---|
| Web app | **Next.js (App Router) + TypeScript** on **Vercel Hobby** | Free for non-commercial use; free `*.vercel.app` address (custom domain optional, ~$15/yr, skip it) |
| Database | **Supabase** free tier (Postgres) | 500 MB is plenty; free projects pause after ~1 week with no activity, which daily play prevents |
| Game data | Riot Data Dragon / Community Dragon, Leaguepedia | Free, no key |
| Familiarity data | Riot API **personal key** | Free; script runs on your PC once per patch |
| AI | Claude Code on your existing subscription | No extra cost (see AI section) |
| Code hosting | GitHub | Free |
- Tables: `puzzles`, `prompts`, `submissions`, `answer_counts`, `players`, `groups`, `review_queue`.
- No cron jobs: day rollover happens when the first request arrives (see Core game loop). Data refreshes are
  scripts you run once per patch, alongside `/tag-patch`.
- Data pipeline as TS scripts (`scripts/fetch-ddragon.ts`, `scripts/fetch-familiarity.ts`,
  `scripts/fetch-leaguepedia.ts`, `scripts/prelabel.ts`, `scripts/validate-labels.ts`) → `data/*.json`.
- Free tiers can change their limits, so check them at setup time.
- `submissions` stores `window_opened_at` (after the 5s read) and each Attempt's `answered_at` per prompt so
  the timer can be checked server-side.
- Vitest for generator/scoring/normalization; Playwright smoke test for a full daily play.
- Riot "Legal Jibber Jabber" fan-project disclaimer in footer.

## Build phases
**v1 (lean: get friends playing)**
1. **Data**: fetch + snapshot Data Dragon, alias table; Riot API key +
   sampling script → Familiarity.
2. **Generator + accuracy**: 20–30 hand-approved Templates, data-built Answer Sets, daily selection +
   validation; entity registry + aliases; keyword pre-labelling, `/tag-patch` and `/review-template`,
   quote validator, Tier assignment (auto bands + approved Too Clever/Gem), review queue (simple admin page). Unit-tested.
3. **Game UI (local)**: 5s read + 25s window with retries, "Did you mean" popup, score animation between
   prompts, end-screen reveal.
4. **Backend**: Supabase, submissions, Answer Share counts, leaderboard freeze on first request after midnight.
5. **Social**: nickname, global + group leaderboards, percentile + score curve, share text, personal stats, archive.

**v1.1 (once friends are playing)**
6. Versioning + upward re-scoring of closed days, "Report this answer" button, `/triage`.
7. **Esports**: Leaguepedia snapshot + curated templates.
8. Polish: design pass, mobile, OG share image.

## Verification
- Unit tests: Prior blend + Tier banding (exactly one Gem per prompt, approved Too Clever answers score 15),
  alias matching, "Did you mean" triggering (never for ≤4-char names, never leaks the Answer Set), retries
  until first accepted Guess, generator constraints, Sydney-date rollover (including both DST changeover days),
  timer rejection after 5s read + 25s + grace.
- Sanity-check sampled Familiarity against a public stats site for a handful of champions.
- Matching test suite: a fixed list of tricky inputs (`MF`, `nunu`, `wukong`, `kaisa`/`Kai'Sa`,
  short names like `Vi`/`Jax`, near-misses like `Zac` vs `Zed`) that must resolve correctly or be rejected.
- Before launch, play a week of generated puzzles with friends and log every dispute.
- **Regression cases from The Daily Rift's feedback** (a similar game, reviewed on r/leagueoflegends), all
  as automated tests: Kai'Sa / `kaisa` counts as invisible; Sylas/Viego/Neeko are excluded by the
  stolen-ability rule; Aurora is *not* a pull champion on the current patch; Gnar is not a pull;
  "Dragon" skins include Dragonslayer Xin Zhao, Dragonblade Talon, Obsidian Dragon Sett;
  Worlds player lists include lesser-known players (e.g. Rhuckz); an esports prompt's wording
  clearly says which events count (e.g. the Shogun pentakill dispute).
- Seed script simulating ~50 fake players to check the score distribution and day titles look sane.
- Play-through a full day locally and on a Vercel preview with 2+ devices; confirm group leaderboard and share text.

## Decisions made
- Daily reset: **12:00am Australian time** (`Australia/Sydney`, DST-aware).
- Prior: **Familiarity** (lifetime mastery / build rate / pro appearances) blended with AI-estimated,
  human-approved **Typicality** per prompt. Pick rate is only a tiebreaker.
- Points: **six fixed Multikill Tiers** per Template (10 Minion · 15 Too Clever · 30 Kill · 60 Triple Kill ·
  85 Quadra Kill · 100 Pentakill Gem), like Krillion's curated tiers. **No crowd nudge**; Points are final immediately.
- Answering: **5s read, then 25s with unlimited retries**; first accepted Guess locks the prompt.
- Input: **no autocomplete**; "Did you mean X?" popup on submit for near-misses.
- Reveal: score animation between prompts; full answer reveal, percentile and curve at the end; ranked day title.
- Retention: personal stats page, **no streaks**.
- Familiarity sample: **worldwide**, all ranks.
- Scoring: **rarity only**, no speed bonus. The 25s timer is just a cutoff.
- Name: **LoLrillion**.
- Scope: **lean v1**; versioning/back-scoring, reports, `/triage`, esports and polish in v1.1.
- Accuracy: answer lists are built from data, an AI given the current patch's facts labels kits and audits
  puzzles, you approve or reject what it raises in a review queue; (v1.1) confirmed fixes re-score past days.
- Cost: **$0/month.** Free tiers only; AI work runs through Claude Code on your existing subscription,
  started by you, not through a paid API.
