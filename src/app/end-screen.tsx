"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { shareLine, TIER_EMOJI, TIER_NAMES } from "@/engine";
import type { AnswerSetEntryView, PuzzleResultsView, ResultsResponse } from "@/server/game-service";
import { ErrorState, Loading } from "./status";
import { tierTone } from "./tier-tone";

type SortOrder = "most" | "least";

/** Copy text, falling back to a hidden textarea where the async Clipboard API is unavailable. */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  area.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } finally {
    document.body.removeChild(area);
  }
  return ok;
}

function sorted(entries: AnswerSetEntryView[], order: SortOrder): AnswerSetEntryView[] {
  const dir = order === "most" ? -1 : 1;
  // Ties fall back to Points, rarest last for "most chosen" and first for "least chosen".
  return entries.slice().sort((a, b) => dir * (a.count - b.count) || dir * (b.points - a.points));
}

function percent(share: number): string {
  return `${Math.round(share * 100)}%`;
}

/** "Better than X% of today's players" and the day's score curve with the player's bin highlighted. */
function DistributionCurve({ results }: { results: PuzzleResultsView }) {
  const { bins, yourBin } = results.distribution;
  const peak = Math.max(1, ...bins.map((b) => b.count));
  return (
    <>
      {results.percentile === null ? (
        <p data-testid="percentile">
          That day&apos;s <span className="num">{results.playerCount}</span> {results.playerCount === 1 ? "player" : "players"}
        </p>
      ) : (
        <p data-testid="percentile">
          Better than <strong className="num">{results.percentile}%</strong> of {results.archive ? "that day's" : "today's"}{" "}
          <span className="num">{results.playerCount}</span> {results.playerCount === 1 ? "player" : "players"}
        </p>
      )}
      <div
        className="curve"
        role="img"
        aria-label={yourBin === null ? "The day's score distribution" : "Today's score distribution, with your score highlighted"}
      >
        {bins.map((b, i) => (
          <div
            key={b.from}
            className={i === yourBin ? "bar you" : "bar"}
            style={{ height: `${Math.max(4, (b.count / peak) * 100)}%` }}
            title={`${b.from}–${b.to}: ${b.count}`}
          />
        ))}
      </div>
    </>
  );
}

/** The end-of-day reveal: total, day title, each answer and the full Answer Sets, plus sharing. */
export function EndScreen({ archiveDay }: { archiveDay?: string } = {}) {
  const [results, setResults] = useState<PuzzleResultsView | null>(null);
  const [error, setError] = useState(false);
  const [order, setOrder] = useState<SortOrder>("most");
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    const query = archiveDay ? `?day=${encodeURIComponent(archiveDay)}` : "";
    fetch(`/api/puzzle/results${query}`, { cache: "no-store" })
      .then((res) => res.json() as Promise<ResultsResponse>)
      .then((res) => (res.ok ? setResults(res.results) : setError(true)))
      .catch(() => setError(true));
  }, [archiveDay]);

  if (error) return <ErrorState>Couldn&apos;t load the results. Refresh to try again.</ErrorState>;
  if (!results) return <Loading>Loading your results…</Loading>;

  async function share() {
    if (!results) return;
    const text = shareLine({
      puzzleNumber: results.puzzleNumber,
      results: results.prompts.map((p) => (p.result?.status === "accepted" ? p.result.tier : null)),
      link: window.location.origin,
    });
    setCopied((await copyText(text)) ? "copied" : "failed");
  }

  return (
    <div className="end-screen">
      <section className="card center">
        <p className="kicker">
          LoLrillion <span className="num">#{results.puzzleNumber}</span>
        </p>
        {results.archive && (
          <p className="muted" data-testid="archive-flag">
            Archive play: not counted on leaderboards or in Answer Share
          </p>
        )}
        {results.played ? (
          <>
            <p className="total" data-testid="total">
              {results.total}
            </p>
            <p className="muted">
              out of <span className="num">{results.maxTotal}</span>
            </p>
            <p className="day-title" data-testid="day-title">
              {results.dayTitle}
            </p>
          </>
        ) : (
          <p data-testid="not-played">You haven&apos;t played this Puzzle. Here are its answers.</p>
        )}
        <DistributionCurve results={results} />
        {results.played && (
          <>
            <button className="cta cta-inline" onClick={share}>
              {copied === "copied" ? "Copied!" : "Share"}
            </button>
            <p className="muted" role="status">
              {copied === "failed" ? "Couldn't copy. Try again." : copied === "copied" ? "Share line copied." : ""}
            </p>
          </>
        )}
        <p>
          <Link href={`/leaderboard?day=${results.puzzleDay}`} data-testid="leaderboard-link">
            See the leaderboards
          </Link>
        </p>
      </section>

      <div className="row" role="group" aria-labelledby="sort-label">
        <span className="muted" id="sort-label">
          Sort answers by
        </span>
        <span className="chips">
          <button className="chip" aria-pressed={order === "most"} onClick={() => setOrder("most")}>
            Most chosen
          </button>
          <button className="chip" aria-pressed={order === "least"} onClick={() => setOrder("least")}>
            Least chosen
          </button>
        </span>
      </div>

      {results.prompts.map((prompt, i) => (
        <section className="card reveal" key={i}>
          <p className="kicker">
            Prompt <span className="num">{i + 1}</span> · {prompt.answerType.toUpperCase()}
          </p>
          <h3>{prompt.text}</h3>
          {prompt.result && (
            <p
              className={`your-answer tone-${tierTone(prompt.result.status === "accepted" ? prompt.result.tier : null)}`}
            >
              {prompt.result.status === "accepted" ? (
                <>
                  {TIER_EMOJI[prompt.result.tier]} {prompt.result.entityName}: {TIER_NAMES[prompt.result.tier]}{" "}
                  <span className="num">(+{prompt.result.points})</span>
                </>
              ) : (
                <>
                  ⬛ Miss <span className="num">(+0)</span>
                </>
              )}
            </p>
          )}
          <ul className="answer-set">
            {sorted(prompt.answerSet, order).map((entry) => {
              const yours = prompt.result?.status === "accepted" && prompt.result.entityId === entry.entityId;
              return (
                <li key={entry.entityId} className={`tone-${tierTone(entry.tier)}${entry.gem ? " gem" : ""}${yours ? " yours" : ""}`}>
                  <span>
                    {TIER_EMOJI[entry.tier]} {entry.name}
                    {entry.gem && <span className="gem-label"> Gem</span>}
                  </span>
                  <span className="muted">
                    {TIER_NAMES[entry.tier]} · <span className="num">{entry.count}</span> chose ·{" "}
                    <span className="num">{percent(entry.share)}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
