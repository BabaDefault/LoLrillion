"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeNavHref, NAV_ITEMS } from "./nav";

/** The shared site navigation, with the current page marked for sighted and screen-reader users. */
export function SiteNav() {
  const active = activeNavHref(usePathname() ?? "/");
  return (
    <nav className="site-nav" aria-label="Main">
      <ul>
        {NAV_ITEMS.map((item) => (
          <li key={item.href}>
            <Link href={item.href} aria-current={item.href === active ? "page" : undefined}>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
