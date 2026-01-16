import type { Metadata } from "next";
import { Providers } from "@/app/providers";
import NavBar from "@/components/NavBar";
import RightRail from "@/components/RightRail";
import "@/styles/colorLevels.css";

export const metadata: Metadata = {
  title: "Regaged",
  description: "Reality social game",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
          background: "linear-gradient(#a9cfe8, #d6eaf6 260px, #f5f7fb 900px)",
          color: "#111",
        }}
      >
        <Providers>
          <NavBar />

          <div style={{ padding: "16px 12px 40px" }}>
            <div style={{ maxWidth: 1120, margin: "0 auto" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 260px",
                  gap: 14,
                  alignItems: "start",
                }}
              >
                <div>{children}</div>

                <div style={{ position: "sticky", top: 70, alignSelf: "start" }}>
                  <RightRail />
                </div>
              </div>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
