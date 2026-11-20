import type { Metadata, Viewport } from "next";
import { Pixelify_Sans, Press_Start_2P } from "next/font/google";
import Link from "next/link";
import type { ReactNode } from "react";
import { SiteNav } from "./site-nav";
import "./globals.css";

/* Pixel fonts, downloaded at build time and served from our own origin (no runtime font CDN). */
const display = Press_Start_2P({ weight: "400", subsets: ["latin"], display: "swap", variable: "--font-display" });
const body = Pixelify_Sans({ subsets: ["latin"], display: "swap", variable: "--font-body" });

export const metadata: Metadata = {
  title: { default: "LoLrillion", template: "%s · LoLrillion" },
  description: "Daily League of Legends trivia: the rarer your answer, the more it scores.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0f1f", // --bg in globals.css
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
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
