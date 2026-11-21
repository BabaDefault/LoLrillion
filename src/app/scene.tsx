import { PixelArt, PORO, PORO_COLOURS } from "./poro";

/**
 * The fixed pixel backdrop behind every page: a night sky with drifting clouds, a poro on the
 * horizon, the river line, and the dark Rift below with rising Hextech sparks, plus CRT scanlines
 * laid over the whole screen. Purely decorative. While a Puzzle is played the world sinks one step
 * per scored Prompt (the --dive custom property, see useDive), so each Prompt goes deeper.
 */

/** A cloud drawn on a pixel grid: each string is one row, "#" a filled cell. */
const CLOUD = ["......####......", "...#########....", ".##############.", "################"];

const SPARKS = [8, 19, 31, 44, 57, 66, 78, 91];

export function Scene() {
  return (
    <>
      <div className="scene" aria-hidden="true">
        <div className="scene-world">
          <div className="scene-sky">
            <PixelArt rows={CLOUD} cell={8} className="cloud cloud-a" />
            <PixelArt rows={CLOUD} cell={6} className="cloud cloud-b" />
            <PixelArt rows={CLOUD} cell={10} className="cloud cloud-c" />
            <PixelArt rows={PORO} cell={4} className="poro" palette={PORO_COLOURS} />
          </div>
          <div className="scene-river" />
          <div className="scene-depths">
            {SPARKS.map((left, i) => (
              <span key={left} className="spark" style={{ left: `${left}%`, animationDelay: `${i * -1.7}s` }} />
            ))}
          </div>
        </div>
        <div className="scene-dark" />
      </div>
      <div className="scanlines" aria-hidden="true" />
    </>
  );
}
