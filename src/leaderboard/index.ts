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
