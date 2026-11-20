/** The site-wide navigation, in display order. */
export const NAV_ITEMS = [
  { href: "/", label: "Today" },
  { href: "/archive", label: "Archive" },
  { href: "/stats", label: "Stats" },
  { href: "/leaderboard", label: "Leaderboard" },
] as const;

/** The href of the nav item for the page at `pathname`, or null when no item covers it. */
export function activeNavHref(pathname: string): string | null {
  if (pathname === "/") return "/";
  const item = NAV_ITEMS.find((i) => i.href !== "/" && (pathname === i.href || pathname.startsWith(`${i.href}/`)));
  return item?.href ?? null;
}
