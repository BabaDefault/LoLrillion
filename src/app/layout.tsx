import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "LoLrillion",
  description: "Daily League of Legends trivia: the rarer your answer, the more it scores.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="site-nav">
          <Link href="/">Today</Link>
          <Link href="/archive">Archive</Link>
          <Link href="/leaderboard">Leaderboard</Link>
          <Link href="/stats">Stats</Link>
        </nav>
        <main>{children}</main>
        <footer className="legal">
          LoLrillion isn&apos;t endorsed by Riot Games and doesn&apos;t reflect the views or opinions of
          Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot
          Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.
        </footer>
      </body>
    </html>
  );
}
