# LoLrillion

A daily League of Legends trivia game: each day's prompts have many valid answers, and a correct answer scores more the less likely a player is to think of it.

## Language

### The daily game

**Puzzle**:
The fixed set of seven Prompts that every player gets on one Puzzle Day.
_Avoid_: Daily, game, round

**Puzzle Day**:
A calendar date in Sydney time; each Puzzle Day has exactly one live Puzzle.
_Avoid_: Day (unqualified), UTC date

**Prompt**:
One player-facing question within a Puzzle (e.g. "Name a champion with a dash"), with its Answer Type and Rule. Never used for instructions given to the AI.
_Avoid_: Question, category, clue

**Template**:
A reusable, approved definition that produces a Prompt and its Answer Set from the game data.
_Avoid_: Prompt type, question generator

**Rule**:
The written clarification shown with a Prompt that settles borderline cases (e.g. what counts as a dash).
_Avoid_: Fine print, note

**Answer Type**:
The kind of Entity a Prompt accepts: Champion, Item, Skin, Pro Player or Team.
_Avoid_: Category, badge

### Answers

**Entity**:
One canonical champion, item, skin, pro player or team, with a stable identity.
_Avoid_: Answer (when meaning the thing itself), name

**Alias**:
An alternative name that resolves to exactly one Entity (nickname, old name, internal name).
_Avoid_: Synonym, nickname (as the general term)

**Answer Set**:
The Entities that are valid for a Prompt.
_Avoid_: Answer list, solutions

**Guess**:
The text a player submits for a Prompt.
_Avoid_: Answer, submission, input

**Match**:
The Entity a Guess was read as, or none.
_Avoid_: Resolution, correction

**Label**:
An approved mechanics fact about a champion's own kit (e.g. has a dash), with an evidence quote from its ability text.
_Avoid_: Tag, attribute

### Scoring

**Prior**:
How likely a player is to name a given Entity for a given Prompt, before any player data; a blend of Familiarity and Typicality.
_Avoid_: Pick rate, popularity

**Familiarity**:
How well known an Entity is among players in general, independent of any Prompt.
_Avoid_: Popularity, pick rate

**Typicality**:
How readily an Entity comes to mind as an answer for one specific Prompt.
_Avoid_: Relevance, fit

**Tier**:
One of six fixed rarity bands an Entity in an Answer Set is placed in for a Prompt; each Tier has a fixed Points value.
_Avoid_: Rarity level, bucket

**Too Clever**:
The trap Tier for answers that seem obscure but that players reach for precisely because they seem obscure; scores barely above the most obvious answers.
_Avoid_: Fake rare, trap answer

**Gem**:
The single hand-picked Entity per Prompt in the top Tier, chosen for being satisfying to find, not just for being the rarest.
_Avoid_: Rarest answer, jackpot

**Points**:
What an accepted Guess scores: the value of its Entity's Tier for that Prompt.
_Avoid_: Score (for a single Prompt), rarity points

**Attempt**:
One submitted Guess within a Prompt's answer window; a rejected Attempt lets the player try again until one is accepted or time runs out.
_Avoid_: Try, life, strike

**Miss**:
A Prompt with no accepted Guess when its answer window closes; it scores 0 Points.
_Avoid_: Fail, timeout, skip

**Answer Share**:
The percentage of today's players whose Guess matched a given Entity; shown for fun, separate from Points.
_Avoid_: Rarity, pick percentage
