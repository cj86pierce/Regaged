import type { Metadata } from "next";
import { Suspense } from "react";
import { Providers } from "@/app/providers";
import NavBar from "@/components/NavBar";
import RightRailClient from "@/components/RightRailClient";
import CronPinger from "@/components/CronPinger";
import { ThemeInitScript } from "@/app/theme-init";
import "@/styles/colorLevels.css";
import "@/styles/theme.css";
import "@/styles/layout.css";
import "@/styles/responsive.css";

export const metadata: Metadata = {
  title: "Regaged",
  description: "Reality social game",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="theme-body">
        <ThemeInitScript />
        <Providers>
          <CronPinger />
          <NavBar />

          {/* Floating rail - Suspense so page content loads first */}
          <div className="rightRail">
            <Suspense fallback={<div style={{ minWidth: 180 }} />}>
              <RightRailClient />
            </Suspense>
          </div>

          <div className="mainContent">
            <div style={{ maxWidth: 1120, margin: "0 auto", minWidth: 0 }}>{children}</div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
