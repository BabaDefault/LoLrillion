import type { Metadata, Viewport } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { SiteNav } from "./site-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "LoLrillion", template: "%s · LoLrillion" },
  description: "Daily League of Legends trivia: the rarer your answer, the more it scores.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b1020",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#content">
          Skip to content
        </a>
        <header className="site-header">
          <Link href="/" className="wordmark">
            <span className="wordmark-lol">LoL</span>rillion
          </Link>
          <SiteNav />
        </header>
        <main id="content">{children}</main>
        <footer className="legal">
          LoLrillion isn&apos;t endorsed by Riot Games and doesn&apos;t reflect the views or opinions of
          Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot
          Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.
        </footer>
      </body>
    </html>
  );
}
