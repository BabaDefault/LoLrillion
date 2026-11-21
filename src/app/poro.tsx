import type { TierTone } from "./tier-tone";

/**
 * Pixel art on a grid of cells, drawn as crisp SVG squares. Without a palette, "#" cells take the CSS
 * fill; with one, each character is filled with its palette colour and characters missing from it
 * are left empty.
 */
export function PixelArt({
  rows,
  cell,
  className,
  palette,
}: {
  rows: readonly string[];
  cell: number;
  className: string;
  palette?: Readonly<Record<string, string>>;
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

/** A poro, one character per cell (see PORO_COLOURS); "." is empty. Tongue out, mid-cheer. */
export const PORO = [
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
] as const;

/** The same poro after a Miss: eyes shut, mouth closed. */
export const PORO_MISS = [
  "..hh............hh..",
  ".hHHh..WWWWWW..hHHh.",
  ".hH..WWWWWWWWWW..Hh.",
  "..HhWWWWWWWWWWWWhH..",
  "...WWWWWWWWWWWWWW...",
  "..WWWWWWWWWWWWWWWW..",
  "..WWWWKKWWWWKKWWWW..",
  ".WWWWWWWWWWWWWWWWWW.",
  ".WWWWWWWWWWWWWWWWWW.",
  ".SWWWWWWKKKKWWWWWWS.",
  ".SWWWWWWWWWWWWWWWWS.",
  "..SWWWWWWWWWWWWWWS..",
  "..SSWWWWWWWWWWWWSS..",
  "...SSWWWWWWWWWWSS...",
  ".....SSSSSSSSSS.....",
  ".....KK......KK.....",
] as const;

/** Fur and shade come from --poro-fur/--poro-shade, which a .poro-<tone> class can override. */
export const PORO_COLOURS: Readonly<Record<string, string>> = {
  W: "var(--poro-fur)",
  S: "var(--poro-shade)",
  H: "var(--poro-horn)",
  h: "var(--poro-horn-dark)",
  K: "var(--poro-eye)",
  T: "var(--poro-tongue)",
  t: "var(--poro-tongue-dark)",
};

/** A poro coloured for a Tier (or a Miss), as shown when a Prompt is scored. Decorative. */
export function TierPoro({ tone, cell }: { tone: TierTone; cell: number }) {
  return (
    <span className={`tier-poro poro-${tone}`} aria-hidden="true">
      <PixelArt rows={tone === "miss" ? PORO_MISS : PORO} cell={cell} className="tier-poro-art" palette={PORO_COLOURS} />
    </span>
  );
}

/** A small, still Tier poro for lists (end screen, stats), sized to the text. Decorative. */
export function PoroIcon({ tone }: { tone: TierTone }) {
  return (
    <span className={`poro-icon poro-${tone}`} aria-hidden="true">
      <PixelArt rows={tone === "miss" ? PORO_MISS : PORO} cell={1} className="poro-icon-art" palette={PORO_COLOURS} />
    </span>
  );
}
