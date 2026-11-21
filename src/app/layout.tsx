import type { Metadata, Viewport } from "next";
import { Press_Start_2P, Space_Mono } from "next/font/google";
import Link from "next/link";
import type { ReactNode } from "react";
import { Scene } from "./scene";
import { SiteNav } from "./site-nav";
import "./globals.css";

/* A pixel display face and a terminal-style mono body face, downloaded at build time and served from our own origin (no runtime font CDN). */
const display = Press_Start_2P({ weight: "400", subsets: ["latin"], display: "swap", variable: "--font-display" });
const body = Space_Mono({ weight: ["400", "700"], subsets: ["latin"], display: "swap", variable: "--font-body" });

export const metadata: Metadata = {
  title: { default: "LoLrillion", template: "%s · LoLrillion" },
  description: "Daily League of Legends trivia: the rarer your answer, the more it scores.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1a2452", // --sky-1 in globals.css: the top of the sky
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <Scene />
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
