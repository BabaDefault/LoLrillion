import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { entityRegistry } from "@/content/game-data";
import { datedPuzzles } from "@/content/puzzles";
import { ANSWER_TYPE_LABEL, puzzleDayOf, TIER_NAMES } from "@/engine";
import { ADMIN_COOKIE, adminKey, isAdminToken } from "@/server/admin-auth";
import { adminDay, type AdminPrompt } from "@/server/admin-dashboard";
import { getPlayStore } from "@/server/container";
import { PoroIcon } from "../poro";
import { tierTone } from "../tier-tone";
import { lock, unlock } from "./actions";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ day?: string | string[]; wrong?: string | string[] }> };

/**
 * The maintainer's dashboard: every dated Puzzle's Answer Sets, how often each answer was locked in,
 * and the Rejected Guesses that hint at missing answers. Exists only when LOLRILLION_ADMIN_KEY is
 * set, and shows nothing until this browser has unlocked it with that key.
 */
export default async function AdminPage({ searchParams }: Props) {
  // Read the request first, so the page is always rendered per request, never prerendered.
  const [jar, params] = await Promise.all([cookies(), searchParams]);
  const key = adminKey(process.env);
  if (!key) notFound();
  if (!isAdminToken(jar.get(ADMIN_COOKIE)?.value, key)) {
    return <AdminLogin wrong={params.wrong === "1"} />;
  }

  const today = puzzleDayOf(Date.now());
  const days = Object.keys(datedPuzzles).sort();
  const requested = typeof params.day === "string" ? params.day : today;
  const fallback = days.includes(today) ? today : days[days.length - 1];
  const day = Object.hasOwn(datedPuzzles, requested) ? requested : fallback;
  const puzzle = datedPuzzles[day];
  const prompts = adminDay(puzzle, entityRegistry, await getPlayStore().getAttempts(day));
  const when = day === today ? "today" : day > today ? "upcoming" : "past";

  return (
    <div className="admin">
      <div className="admin-head">
        <h1 className="title">Admin</h1>
        <Link href="/archive" className="chip">
          Archive
        </Link>
        <form action={lock}>
          <button className="secondary" type="submit">
            Lock
          </button>
        </form>
      </div>
      <nav className="admin-days" aria-label="Puzzle Days">
        {days.map((d) => (
          <Link
            key={d}
            href={`/admin?day=${d}`}
            className={`chip${d === today ? " admin-today" : ""}`}
            aria-current={d === day ? "page" : undefined}
          >
            #{datedPuzzles[d].puzzleNumber} · {d.slice(5)}
          </Link>
        ))}
      </nav>
      <p className="muted">
        LoLrillion <span className="num">#{puzzle.puzzleNumber}</span> · <span className="num">{day}</span> · {when} ·
        patch <span className="num">{puzzle.dataVersion}</span>. &quot;Early&quot; counts archive runs, including
        play-ahead.
      </p>
      {prompts.map((prompt) => (
        <AdminPromptCard key={prompt.index} prompt={prompt} />
      ))}
    </div>
  );
}

function AdminPromptCard({ prompt }: { prompt: AdminPrompt }) {
  const answers = prompt.tiers.reduce((n, t) => n + t.answers.length, 0);
  const missing = prompt.rejected.filter((g) => g.entity).length;
  const label = ANSWER_TYPE_LABEL[prompt.answerType];
  return (
    <section className="card">
      <p className="kicker">
        Prompt <span className="num">{prompt.index + 1}</span> · {label.toUpperCase()}
        <span className="badge">{prompt.templateId}</span>
      </p>
      <h3>{prompt.text}</h3>
      <p className="rule">{prompt.rule}</p>
      <p className="muted">
        <span className="num">{answers}</span> answers · <span className="num">{prompt.players.live}</span> played on
        the day · <span className="num">{prompt.players.early}</span> early
      </p>
      <ul className="answer-set">
        {prompt.tiers.flatMap(({ tier, answers: list }) =>
          list.map((a) => (
            <li key={a.entityId} className={`tone-${tierTone(tier)}`}>
              <span>
                <PoroIcon tone={tierTone(tier)} /> {a.name}
              </span>
              <span className="muted">
                {TIER_NAMES[tier]} · <span className="num">{a.live}</span> picked
                {a.early > 0 && (
                  <>
                    {" "}
                    · <span className="num">{a.early}</span> early
                  </>
                )}
              </span>
            </li>
          )),
        )}
      </ul>
      <details className="admin-rejected" open={missing > 0}>
        <summary>
          Rejected guesses (<span className="num">{prompt.rejected.length}</span>)
          {missing > 0 && (
            <>
              {" "}
              · <span className="admin-flag">{missing} name a real {label}</span>
            </>
          )}
        </summary>
        {prompt.rejected.length === 0 ? (
          <p className="muted">None yet.</p>
        ) : (
          <ul className="answer-set">
            {prompt.rejected.map((g) => (
              <li key={g.normalized} className={g.entity ? "admin-missing" : undefined}>
                <span>{g.spellings.map((s) => `"${s}"`).join(", ")}</span>
                <span className="muted">
                  <span className="num">{g.count}</span>× by <span className="num">{g.players}</span> ·{" "}
                  {g.entity ? `possible missing answer: ${g.entity.name}` : "no match: Alias or typo?"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </details>
    </section>
  );
}

function AdminLogin({ wrong }: { wrong: boolean }) {
  return (
    <section className="card admin-login">
      <h1 className="title">Admin</h1>
      <form action={unlock}>
        <label htmlFor="admin-key">Admin key</label>
        <input id="admin-key" name="key" type="password" autoComplete="current-password" required autoFocus />
        <button className="primary" type="submit">
          Unlock
        </button>
      </form>
      {wrong && (
        <p className="notice" role="alert">
          That isn&apos;t the admin key.
        </p>
      )}
    </section>
  );
}
