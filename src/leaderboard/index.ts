// Leaderboards, nicknames and friend groups: pure rules, no I/O.

/** One counted run on a Puzzle Day, before ranking. */
export interface DayScore {
  /** Server-side identity of the player (never sent to clients). */
  playerKey: string;
  /** The player's nickname, or null if they haven't picked one. */
  nickname: string | null;
  total: number;
}

export interface RankedEntry extends DayScore {
  /** 1-based; tied totals share a rank and the next rank skips (1, 2, 2, 4). */
  rank: number;
}

export type NameCheck = { ok: true; value: string } | { ok: false; error: "empty" | "too-long" };

export const NICKNAME_MAX_LENGTH = 20;

/** Tidy a typed name (control characters dropped, spaces trimmed and collapsed) and check its length. */
function validateName(raw: string, maxLength: number): NameCheck {
  // eslint-disable-next-line no-control-regex
  const value = raw.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim();
  if (value.length === 0) return { ok: false, error: "empty" };
  if ([...value].length > maxLength) return { ok: false, error: "too-long" };
  return { ok: true, value };
}

/** A nickname as shown on leaderboards. */
export function validateNickname(raw: string): NameCheck {
  return validateName(raw, NICKNAME_MAX_LENGTH);
}

export const GROUP_NAME_MAX_LENGTH = 30;

/** A friend group's display name. */
export function validateGroupName(raw: string): NameCheck {
  return validateName(raw, GROUP_NAME_MAX_LENGTH);
}

/** Group code alphabet: capitals and digits, minus the easily confused 0/O and 1/I/L. */
const GROUP_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const GROUP_CODE_LENGTH = 6;

/** A new short, shareable group code. `random` returns values in [0, 1), like Math.random. */
export function generateGroupCode(random: () => number = Math.random): string {
  let code = "";
  for (let i = 0; i < GROUP_CODE_LENGTH; i++) {
    code += GROUP_CODE_ALPHABET[Math.floor(random() * GROUP_CODE_ALPHABET.length)];
  }
  return code;
}

/** The group code a player typed (any case, spaces or dashes), or null if it can't be one. */
export function parseGroupCode(typed: string): string | null {
  const code = typed.toUpperCase().replace(/[\s-]/g, "");
  if (code.length !== GROUP_CODE_LENGTH) return null;
  return [...code].every((c) => GROUP_CODE_ALPHABET.includes(c)) ? code : null;
}

/**
 * A leaderboard is live during its Puzzle Day and final (frozen) once the day has passed:
 * after that, the day's Puzzle can only be replayed in archive mode, which never counts.
 */
export type LeaderboardPhase = "live" | "final" | "future";

/** Phase of `puzzleDay`'s leaderboard when today's Puzzle Day is `today` (both `YYYY-MM-DD`). */
export function leaderboardPhase(puzzleDay: string, today: string): LeaderboardPhase {
  if (puzzleDay === today) return "live";
  return puzzleDay < today ? "final" : "future";
}

/**
 * A moment (epoch ms) that falls on the given Sydney Puzzle Day: 02:00 UTC is midday or 1pm
 * in Sydney whether or not daylight saving is on.
 */
export function momentOnPuzzleDay(puzzleDay: string): number {
  return Date.parse(`${puzzleDay}T02:00:00Z`);
}

/** Rank a Puzzle Day's runs by total, highest first. Ties share a rank and are listed by nickname. */
export function rankLeaderboard(scores: readonly DayScore[]): RankedEntry[] {
  const ordered = scores
    .slice()
    .sort(
      (a, b) =>
        b.total - a.total ||
        (a.nickname ?? "").localeCompare(b.nickname ?? "") ||
        a.playerKey.localeCompare(b.playerKey),
    );
  return ordered.map((score, i) => {
    let first = i;
    while (first > 0 && ordered[first - 1].total === score.total) first--;
    return { ...score, rank: first + 1 };
  });
}
