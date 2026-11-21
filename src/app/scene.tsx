/**
 * The fixed pixel backdrop behind every page: a night sky with drifting clouds, a poro on the
 * horizon, the river line, and the dark Rift below with rising Hextech sparks, plus CRT scanlines
 * laid over the whole screen. Purely decorative.
 */

/** A cloud drawn on a pixel grid: each string is one row, "#" a filled cell. */
const CLOUD = ["......####......", "...#########....", ".##############.", "################"];

/** A poro, one character per cell: each maps to a colour token in PORO_COLOURS, "." is empty. */
const PORO = [
  "..hh............hh..",
  ".hHHh..WWWWWW..hHHh.",
  ".hH..WWWWWWWWWW..Hh.",
  "..HhWWWWWWWWWWWWhH..",
  "...WWWWWWWWWWWWWW...",
  "..WWWWKKWWWWKKWWWW..",
  "..WWWWKKWWWWKKWWWW..",
  ".WWWWWWWWWWWWWWWWWW.",
  ".WWWWWWKKKKKKWWWWWW.",
  ".SWWWWWKTTTTKWWWWWS.",
  ".SWWWWWWTTTTWWWWWWS.",
  "..SWWWWWTTTTWWWWWS..",
  "..SSWWWWTttTWWWWSS..",
  "...SSWWWWttWWWWSS...",
  ".....SSSSSSSSSS.....",
  ".....KK......KK.....",
];

const PORO_COLOURS: Record<string, string> = {
  W: "var(--poro-fur)",
  S: "var(--poro-shade)",
  H: "var(--poro-horn)",
  h: "var(--poro-horn-dark)",
  K: "var(--poro-eye)",
  T: "var(--poro-tongue)",
  t: "var(--poro-tongue-dark)",
};

/**
 * Pixel art on a grid of cells. Without a palette, "#" cells are filled with the CSS fill; with one,
 * each character is filled with its palette colour and characters missing from it are left empty.
 */
function PixelArt({
  rows,
  cell,
  className,
  palette,
}: {
  rows: string[];
  cell: number;
  className: string;
  palette?: Record<string, string>;
}) {
  const width = rows[0].length * cell;
  const height = rows.length * cell;
  return (
    <svg className={className} width={width} height={height} viewBox={`0 0 ${width} ${height}`} shapeRendering="crispEdges">
      {rows.flatMap((row, y) =>
        [...row].map((c, x) => {
          const fill = palette ? palette[c] : undefined;
          if (palette ? !fill : c !== "#") return null;
          return <rect key={`${x}-${y}`} x={x * cell} y={y * cell} width={cell} height={cell} style={fill ? { fill } : undefined} />;
        }),
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
          <PixelArt rows={PORO} cell={4} className="poro" palette={PORO_COLOURS} />
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
