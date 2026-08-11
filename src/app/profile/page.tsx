export const dynamic = "force-dynamic";

import { getCurrentUserIdFromHeaders } from "@/lib/getCurrentUserId";
import { touchUser } from "@/lib/touchUser";
import ProfileTabs from "@/components/ProfileTabs";
import { loadProfileTabsData } from "@/lib/loadProfileTabsData";
import Link from "next/link";

export default async function ProfilePage({ searchParams }: { searchParams: { page?: string } }) {
  const userId = await getCurrentUserIdFromHeaders();

  if (!userId) {
    return (
      <main style={{ padding: 8 }}>
        <div style={{ border: "1px solid var(--border)", borderRadius: 4, background: "var(--bg-card)", padding: 14 }}>
          <h1 style={{ marginTop: 0 }}>Profile</h1>
          <p>You’re not logged in.</p>
          <div style={{ display: "flex", gap: 12 }}>
            <Link href="/login">Login</Link>
            <Link href="/register">Register</Link>
          </div>
        </div>
      </main>
    );
  }

  try {
    await touchUser(userId).catch((e) => console.error("Profile touchUser failed:", e));
    const page = Math.max(1, Number(searchParams?.page ?? "1") || 1);
    const data = await loadProfileTabsData({ userId, isOwnProfile: true, page });
    return <ProfileTabs data={data} />;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("Profile page error:", msg, stack);
    const showStack = typeof (searchParams as { page?: string; profile_debug?: string })?.profile_debug === "string";
    const safeMsg = String(msg).slice(0, 800);
    return (
      <main style={{ padding: 12 }}>
        <div className="theme-card" style={{ padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Something went wrong</h2>
          <p>We couldn’t load your profile. Try again or come back later.</p>
          {safeMsg && (
            <pre
              style={{
                fontSize: 12,
                overflow: "auto",
                background: "var(--bg-muted)",
                padding: 12,
                borderRadius: 8,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {safeMsg}
              {showStack && stack ? "\n\n" + stack : ""}
            </pre>
          )}
          <Link href="/">Back to home</Link>
        </div>
      </main>
    );
  }
}
