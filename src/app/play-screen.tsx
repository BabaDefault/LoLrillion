"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { AttemptResponse, PuzzleStateView } from "@/server/game-service";
import { DayStatsPanel } from "./day-stats-panel";

const GRACE_MS = 2_000;

type Interlude = { index: number; text: string } | null;

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  return (await res.json()) as T;
}

export function PlayScreen() {
  const [state, setState] = useState<PuzzleStateView | null>(null);
  const [offset, setOffset] = useState(0); // serverNow - Date.now()
  const [now, setNow] = useState(() => Date.now());
  const [guess, setGuess] = useState("");
  const [shake, setShake] = useState(0);
  const [busy, setBusy] = useState(false);
  const [interlude, setInterlude] = useState<Interlude>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const receive = useCallback((next: PuzzleStateView) => {
    setOffset(next.serverNow - Date.now());
    setState(next);
  }, []);

  useEffect(() => {
    api<PuzzleStateView>("/api/puzzle/state").then(receive);
  }, [receive]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);

  const serverNow = now + offset;
  const current = state?.current ?? null;
  const live = current && current.status !== "not-started" ? current : null;
  const reading = live !== null && serverNow < live.answerOpensAt;
  const answering = live !== null && serverNow >= live.answerOpensAt && serverNow < live.answerClosesAt;
  const timedOut = live !== null && serverNow >= live.answerClosesAt;

  useEffect(() => {
    if (answering) inputRef.current?.focus();
  }, [answering]);

  // A Rejected Attempt remounts the input (replaying the shake); keep the Guess selected for retyping.
  useEffect(() => {
    if (shake > 0) inputRef.current?.select();
  }, [shake]);

  // When the answer window (plus grace) closes, ask the server; it will report a Miss.
  const missCheckFor = useRef<number | null>(null);
  useEffect(() => {
    if (!live) return;
    if (serverNow < live.answerClosesAt + GRACE_MS) return;
    if (missCheckFor.current === live.index) return;
    missCheckFor.current = live.index;
    const index = live.index;
    api<PuzzleStateView>("/api/puzzle/state").then((next) => {
      if (next.results[index]?.status === "missed") setInterlude({ index, text: "Miss: time's up." });
      receive(next);
    });
  }, [live, serverNow, receive]);

  async function start() {
    setBusy(true);
    setGuess("");
    try {
      receive(await api<PuzzleStateView>("/api/puzzle/start", {}));
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!live || !answering || busy || guess.trim() === "") return;
    setBusy(true);
    try {
      const res = await api<AttemptResponse>("/api/puzzle/attempt", { promptIndex: live.index, guess });
      if (res.ok && res.result.kind === "accepted") {
        setInterlude({ index: live.index, text: `Locked in: ${res.result.entityName}` });
      } else {
        setShake((n) => n + 1);
      }
      receive(res.state);
    } finally {
      setBusy(false);
    }
  }

  if (!state) return <p className="muted">Loading today&apos;s Puzzle…</p>;

  if (interlude) {
    return (
      <section className="card">
        <p className="muted">
          Prompt {interlude.index + 1} of {state.promptCount}
        </p>
        <h2>{interlude.text}</h2>
        <button className="primary" onClick={() => setInterlude(null)} autoFocus>
          {state.finished ? "See your total" : "Next Prompt"}
        </button>
      </section>
    );
  }

  if (state.finished) {
    return (
      <section className="card center">
        <p className="muted">Today&apos;s total</p>
        <p className="total" data-testid="total">
          {state.total}
        </p>
        <p className="muted">out of {state.promptCount * 100}</p>
        <DayStatsPanel />
      </section>
    );
  }

  if (!current) return null;

  if (!live) {
    return (
      <section className="card center">
        <p className="muted">
          Prompt {current.index + 1} of {state.promptCount}
        </p>
        <p>5 seconds to read, then 25 seconds to answer.</p>
        <button className="primary" onClick={start} disabled={busy} autoFocus>
          {current.index === 0 ? "Start" : "Show Prompt"}
        </button>
      </section>
    );
  }

  const countdown = reading
    ? Math.ceil((live.answerOpensAt - serverNow) / 1000)
    : Math.max(0, Math.ceil((live.answerClosesAt - serverNow) / 1000));

  return (
    <section className="card">
      <div className="row">
        <span className="muted">
          Prompt {live.index + 1} of {state.promptCount}
        </span>
        <span className="badge">{live.answerType.toUpperCase()}</span>
      </div>
      <h2>{live.text}</h2>
      <p className="rule">{live.rule}</p>
      <p className={`countdown ${reading ? "reading" : ""}`} aria-live="polite">
        {reading ? `Read… ${countdown}` : timedOut ? "Time's up" : countdown}
      </p>
      <form onSubmit={submit}>
        <input
          key={shake}
          ref={inputRef}
          className={shake > 0 ? "shake" : ""}
          value={guess}
          onChange={(e) => setGuess(e.target.value)}
          disabled={!answering}
          placeholder={reading ? "Get ready…" : "Type your Guess"}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={100}
          aria-label="Guess"
        />
      </form>
    </section>
  );
}
