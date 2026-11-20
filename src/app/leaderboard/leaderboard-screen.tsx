"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { addDays } from "@/engine";
import type {
  CreateGroupResponse,
  JoinGroupResponse,
  LeaderboardEntryView,
  LeaderboardResponse,
  LeaderboardView,
  NicknameResponse,
  ProfileView,
} from "@/server/leaderboard-service";

const ERRORS: Record<string, string> = {
  empty: "That can't be empty.",
  "too-long": "That's too long.",
  "nickname-required": "Pick a nickname first.",
  "invalid-code": "Group codes are 6 letters and numbers.",
  "no-such-group": "No group has that code.",
  "no-free-code": "Couldn't make a group code. Try again.",
  "not-a-member": "You're not in that group.",
  "future-day": "That Puzzle Day hasn't started yet.",
  "invalid-day": "That isn't a Puzzle Day.",
};

function errorText(error: string): string {
  return ERRORS[error] ?? "Something went wrong. Try again.";
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as T;
}

function EntryRow({ entry }: { entry: LeaderboardEntryView }) {
  return (
    <li className={entry.you ? "you" : undefined}>
      <span className="rank">{entry.rank}</span>
      <span className="name">
        {entry.nickname ?? <span className="muted">Anonymous</span>}
        {entry.you && <span className="muted"> (you)</span>}
      </span>
      <span className="muted">{entry.dayTitle}</span>
      <span className="score">{entry.total}</span>
    </li>
  );
}

function Board({ board }: { board: LeaderboardView }) {
  const youShown = board.entries.some((e) => e.you);
  return (
    <>
      <p className="muted">
        LoLrillion #{board.puzzleNumber} · {board.puzzleDay} ·{" "}
        {board.phase === "final" ? "Final" : "Live"} · {board.playerCount}{" "}
        {board.playerCount === 1 ? "player" : "players"}
      </p>
      {board.entries.length === 0 ? (
        <p className="muted">Nobody has finished this Puzzle yet.</p>
      ) : (
        <ol className="leaderboard" data-testid="leaderboard">
          {board.entries.map((entry, i) => (
            <EntryRow key={i} entry={entry} />
          ))}
          {board.you && !youShown && <EntryRow entry={board.you} />}
        </ol>
      )}
    </>
  );
}

/** Nickname, friend groups, and the global and group leaderboards for a Puzzle Day. */
export function LeaderboardScreen() {
  const [profile, setProfile] = useState<ProfileView | null>(null);
  const [nickname, setNickname] = useState("");
  const [editingNickname, setEditingNickname] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  /** The selected leaderboard: null for global, else a group code. */
  const [scope, setScope] = useState<string | null>(null);
  /** The Puzzle Day shown; null for today. */
  const [day, setDay] = useState<string | null>(null);
  const [board, setBoard] = useState<LeaderboardView | null>(null);
  const [boardError, setBoardError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    const res = await fetch("/api/player", { cache: "no-store" });
    const next = (await res.json()) as ProfileView;
    setProfile(next);
    setNickname(next.nickname ?? "");
    return next;
  }, []);

  useEffect(() => {
    // A shared link like /leaderboard?join=ABC123 prefills the join form.
    const join = new URLSearchParams(window.location.search).get("join");
    if (join) setJoinCode(join);
    loadProfile().catch(() => setMessage(errorText("")));
  }, [loadProfile]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (day) params.set("day", day);
    if (scope) params.set("group", scope);
    setBoardError(null);
    fetch(`/api/leaderboard?${params}`, { cache: "no-store" })
      .then((res) => res.json() as Promise<LeaderboardResponse>)
      .then((res) => {
        if (res.ok) setBoard(res.leaderboard);
        else {
          setBoard(null);
          setBoardError(errorText(res.error));
        }
      })
      .catch(() => setBoardError(errorText("")));
  }, [day, scope, profile]);

  async function saveNickname(e: FormEvent) {
    e.preventDefault();
    const res = await post<NicknameResponse>("/api/player/nickname", { nickname });
    if (!res.ok) return setMessage(errorText(res.error));
    setMessage(null);
    setEditingNickname(false);
    await loadProfile();
  }

  async function createGroup(e: FormEvent) {
    e.preventDefault();
    const res = await post<CreateGroupResponse>("/api/groups", { name: groupName });
    if (!res.ok) return setMessage(errorText(res.error));
    setMessage(`Created "${res.group.name}". Share the code ${res.group.code} with your friends.`);
    setGroupName("");
    await loadProfile();
    setScope(res.group.code);
  }

  async function joinGroup(e: FormEvent) {
    e.preventDefault();
    const res = await post<JoinGroupResponse>("/api/groups/join", { code: joinCode });
    if (!res.ok) return setMessage(errorText(res.error));
    setMessage(`Joined "${res.group.name}".`);
    setJoinCode("");
    await loadProfile();
    setScope(res.group.code);
  }

  if (!profile) return <p className="muted">Loading…</p>;
  const shownDay = board?.puzzleDay ?? day;
  const isToday = day === null || board?.phase === "live";

  return (
    <div className="leaderboard-screen">
      <section className="card">
        {profile.nickname && !editingNickname ? (
          <div className="row">
            <span>
              Playing as <strong data-testid="nickname">{profile.nickname}</strong>
            </span>
            <button className="chip" onClick={() => setEditingNickname(true)}>
              Change
            </button>
          </div>
        ) : (
          <form onSubmit={saveNickname} className="inline-form">
            <label htmlFor="nickname">Nickname</label>
            <input
              id="nickname"
              value={nickname}
              maxLength={20}
              autoComplete="off"
              placeholder="How friends will see you"
              onChange={(e) => setNickname(e.target.value)}
            />
            <button className="primary" type="submit">
              Save
            </button>
          </form>
        )}
      </section>

      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}

      <section className="card">
        <div className="row scope-tabs" role="tablist" aria-label="Leaderboards">
          <span>
            <button className={scope === null ? "chip active" : "chip"} onClick={() => setScope(null)}>
              Global
            </button>
            {profile.groups.map((g) => (
              <button
                key={g.code}
                className={scope === g.code ? "chip active" : "chip"}
                onClick={() => setScope(g.code)}
              >
                {g.name}
              </button>
            ))}
          </span>
        </div>
        {scope && (
          <p className="muted">
            Group code: <strong className="group-code">{scope}</strong>
          </p>
        )}
        <div className="row day-nav">
          <button className="chip" onClick={() => shownDay && setDay(addDays(shownDay, -1))} disabled={!shownDay}>
            ← Previous day
          </button>
          <button
            className="chip"
            onClick={() => shownDay && setDay(addDays(shownDay, 1))}
            disabled={isToday || !shownDay}
          >
            Next day →
          </button>
        </div>
        {boardError && <p className="muted">{boardError}</p>}
        {board && <Board board={board} />}
      </section>

      <section className="card">
        <h3>Friend groups</h3>
        <form onSubmit={createGroup} className="inline-form">
          <label htmlFor="group-name">New group</label>
          <input
            id="group-name"
            value={groupName}
            maxLength={30}
            autoComplete="off"
            placeholder="Group name"
            onChange={(e) => setGroupName(e.target.value)}
          />
          <button className="primary" type="submit">
            Create
          </button>
        </form>
        <form onSubmit={joinGroup} className="inline-form">
          <label htmlFor="join-code">Join with a code</label>
          <input
            id="join-code"
            value={joinCode}
            maxLength={12}
            autoComplete="off"
            placeholder="ABC123"
            onChange={(e) => setJoinCode(e.target.value)}
          />
          <button className="primary" type="submit">
            Join
          </button>
        </form>
      </section>

      <p className="center">
        <a href="/">Back to today&apos;s Puzzle</a>
      </p>
    </div>
  );
}
