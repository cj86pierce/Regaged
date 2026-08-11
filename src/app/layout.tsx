import type { Metadata } from "next";
import { Suspense } from "react";
import { Providers } from "@/app/providers";
import NavBar from "@/components/NavBar";
import RightRailClient from "@/components/RightRailClient";
import OnlineCount from "@/components/OnlineCount";
import SiteFooter from "@/components/SiteFooter";
import DeviceIdInit from "@/components/DeviceIdInit";
import { ThemeInitScript } from "@/app/theme-init";
import { getCurrentUserIdFromHeaders } from "@/lib/getCurrentUserId";
import { touchUser } from "@/lib/touchUser";
import "@/styles/colorLevels.css";
import "@/styles/theme.css";
import "@/styles/layout.css";
import "@/styles/responsive.css";

export const metadata: Metadata = {
  title: "Regaged",
  description: "Reality social game",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const userId = await getCurrentUserIdFromHeaders();
  // Presence is best-effort — never delay the shell waiting on a DB write.
  if (userId) void touchUser(userId).catch(() => {});
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="theme-body">
        <ThemeInitScript />
        <Providers>
          <DeviceIdInit />
          <OnlineCount />
          <NavBar />

          {/* Floating rail - Suspense so page content loads first */}
          <div className="rightRail">
            <Suspense fallback={<div style={{ minWidth: 180 }} />}>
              <RightRailClient />
            </Suspense>
          </div>

          <div className="mainContent">
            <div style={{ margin: "0 auto", minWidth: 0, width: "100%" }}>{children}</div>
          </div>

          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
