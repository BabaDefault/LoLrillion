/**
 * The fixed pixel backdrop behind every page: a dusk sky with drifting clouds, a turret on the
 * horizon, the river line, and the dark Rift below with rising Hextech sparks, plus CRT scanlines
 * laid over the whole screen. Purely decorative.
 */

/** A cloud drawn on a pixel grid: each string is one row, "#" a filled cell. */
const CLOUD = ["......####......", "...#########....", ".##############.", "################"];

/** A turret silhouette on the same kind of grid. */
const TURRET = [
  "....##....",
  "...####...",
  "..######..",
  "...####...",
  "...#..#...",
  "...####...",
  "..######..",
  "..######..",
  "..######..",
  ".########.",
  "##########",
];

function PixelArt({ rows, cell, className }: { rows: string[]; cell: number; className: string }) {
  const width = rows[0].length * cell;
  const height = rows.length * cell;
  return (
    <svg className={className} width={width} height={height} viewBox={`0 0 ${width} ${height}`} shapeRendering="crispEdges">
      {rows.flatMap((row, y) =>
        [...row].map((c, x) => (c === "#" ? <rect key={`${x}-${y}`} x={x * cell} y={y * cell} width={cell} height={cell} /> : null)),
      )}
    </svg>
  );
}

const SPARKS = [8, 19, 31, 44, 57, 66, 78, 91];

export function Scene() {
  return (
    <>
      <div className="scene" aria-hidden="true">
        <div className="scene-sky">
          <PixelArt rows={CLOUD} cell={8} className="cloud cloud-a" />
          <PixelArt rows={CLOUD} cell={6} className="cloud cloud-b" />
          <PixelArt rows={CLOUD} cell={10} className="cloud cloud-c" />
          <PixelArt rows={TURRET} cell={5} className="turret" />
        </div>
        <div className="scene-river" />
        <div className="scene-depths">
          {SPARKS.map((left, i) => (
            <span key={left} className="spark" style={{ left: `${left}%`, animationDelay: `${i * -1.7}s` }} />
          ))}
        </div>
      </div>
      <div className="scanlines" aria-hidden="true" />
    </>
  );
}
