import { PROMPTS_PER_PUZZLE } from "@/builder/generator";
import { ANSWER_WINDOW_MS } from "@/engine";
import { PlayScreen } from "./play-screen";

/** The title block over the sky, shown until the first Prompt starts. */
function Hero() {
  return (
    <header className="hero">
      <h1 className="hero-title">LOLRILLION</h1>
      <p className="hero-sub">The Daily Rift</p>
      <p className="hero-tagline">
        <span className="num">{PROMPTS_PER_PUZZLE}</span> Prompts · <span className="num">{ANSWER_WINDOW_MS / 1000}</span>{" "}
        seconds each · rarer Guesses score more
      </p>
    </header>
  );
}

export default function Home() {
  return <PlayScreen hero={<Hero />} />;
}
