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
import { apiJson } from "../api-client";
import { Empty, ErrorState, Loading } from "../status";

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

function EntryRow({ entry }: { entry: LeaderboardEntryView }) {
  return (
    <li className={entry.you ? "you" : undefined}>
      <span className="rank">{entry.rank}</span>
      <span className="name">
        {entry.nickname ?? <span className="muted">Anonymous</span>}
        {entry.you && <span className="muted"> (you)</span>}
      </span>
      <span className="muted day">{entry.dayTitle}</span>
      <span className="score">{entry.total}</span>
    </li>
  );
}

function Board({ board }: { board: LeaderboardView }) {
  const youShown = board.entries.some((e) => e.you);
  return (
    <>
      <p className="muted board-meta">
        LoLrillion <span className="num">#{board.puzzleNumber}</span> · <span className="num">{board.puzzleDay}</span> ·{" "}
        {board.phase === "final" ? "Final" : "Live"} · <span className="num">{board.playerCount}</span>{" "}
        {board.playerCount === 1 ? "player" : "players"}
      </p>
      {board.entries.length === 0 ? (
        <Empty>Nobody has finished this Puzzle yet.</Empty>
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
    const res = await apiJson<ProfileView>("/api/player");
    if (!res.ok) throw new Error(res.error);
    const next = res.body;
    setProfile(next);
    setNickname(next.nickname ?? "");
    return next;
  }, []);

  useEffect(() => {
    // A shared link like /leaderboard?join=ABC123 prefills the join form.
    // The end screen links to /leaderboard?day=YYYY-MM-DD for the Puzzle Day just played.
    const params = new URLSearchParams(window.location.search);
    const join = params.get("join");
    if (join) setJoinCode(join);
    const linkedDay = params.get("day");
    if (linkedDay && /^\d{4}-\d{2}-\d{2}$/.test(linkedDay)) setDay(linkedDay);
    loadProfile().catch(() => setMessage(errorText("")));
  }, [loadProfile]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (day) params.set("day", day);
    if (scope) params.set("group", scope);
    setBoardError(null);
    // Ignore a response that arrives after the selection has changed again.
    let stale = false;
    apiJson<LeaderboardResponse>(`/api/leaderboard?${params}`)
      .then((res) => {
        if (stale) return;
        if (res.ok && res.body.ok) setBoard(res.body.leaderboard);
        else {
          setBoard(null);
          setBoardError(errorText(res.ok ? "" : res.error));
        }
      })
      .catch(() => !stale && setBoardError(errorText("")));
    return () => {
      stale = true;
    };
  }, [day, scope, profile]);

  async function saveNickname(e: FormEvent) {
    e.preventDefault();
    const sent = await apiJson<NicknameResponse>("/api/player/nickname", { nickname });
    if (!sent.ok) return setMessage(errorText(sent.error));
    setMessage(null);
    setEditingNickname(false);
    await loadProfile();
  }

  async function createGroup(e: FormEvent) {
    e.preventDefault();
    const sent = await apiJson<CreateGroupResponse>("/api/groups", { name: groupName });
    if (!sent.ok || !sent.body.ok) return setMessage(errorText(sent.ok ? "" : sent.error));
    const { group } = sent.body;
    setMessage(`Created "${group.name}". Share the code ${group.code} with your friends.`);
    setGroupName("");
    await loadProfile();
    setScope(group.code);
  }

  async function joinGroup(e: FormEvent) {
    e.preventDefault();
    const sent = await apiJson<JoinGroupResponse>("/api/groups/join", { code: joinCode });
    if (!sent.ok || !sent.body.ok) return setMessage(errorText(sent.ok ? "" : sent.error));
    const { group } = sent.body;
    setMessage(`Joined "${group.name}".`);
    setJoinCode("");
    await loadProfile();
    setScope(group.code);
  }

  if (!profile) {
    if (message) return <ErrorState>Couldn&apos;t load the leaderboards. Refresh to try again.</ErrorState>;
    return <Loading>Loading the leaderboards…</Loading>;
  }
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
        <div className="chips scope-tabs" role="group" aria-label="Which leaderboard">
          <button className="chip" aria-pressed={scope === null} onClick={() => setScope(null)}>
            Global
          </button>
          {profile.groups.map((g) => (
            <button key={g.code} className="chip" aria-pressed={scope === g.code} onClick={() => setScope(g.code)}>
              {g.name}
            </button>
          ))}
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
        {boardError && <ErrorState>{boardError}</ErrorState>}
        {!board && !boardError && <Loading>Loading the leaderboard…</Loading>}
        {board && <Board board={board} />}
      </section>

      <section className="card">
        <h3 className="kicker">Friend groups</h3>
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

    </div>
  );
}
