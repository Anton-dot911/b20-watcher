import type { Metadata } from "next";
import Link from "next/link";

import { MOCK_MODE } from "@/lib/config";
import "./globals.css";

export const metadata: Metadata = {
  title: "B20 Watcher — Issuer-control risk for Base B20 tokens",
  description:
    "Know who controls a B20 token before you trust it. Public risk dashboard and JSON API for Base B20 native tokens.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="site-header__inner">
            <Link href="/" className="brand">
              <span className="brand__mark">B</span>
              <span>B20 Watcher</span>
            </Link>
            {MOCK_MODE && (
              <span className="mock-badge">
                <span className="mock-badge__dot" />
                Mock mode
              </span>
            )}
          </div>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <div className="container">
            B20 Watcher estimates issuer-control and operational risk. It is not
            a price prediction or investment advice.
          </div>
        </footer>
      </body>
    </html>
  );
}
