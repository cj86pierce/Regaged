"use client";

import { useEffect } from "react";

/**
 * Steam client opens: BASE_URL/auth/steam-callback?token=JWT
 * This page sets the regaged_token cookie and redirects to / so the rest of the app works with cookie-based auth.
 */
export default function SteamCallbackPage() {
  useEffect(() => {
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    const token = params.get("token");
    if (token) {
      // Set cookie for same-origin API and server components (max 7 days to match JWT expiry)
      document.cookie = `regaged_token=${encodeURIComponent(token)}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
    }
    window.location.replace("/");
  }, []);

  return (
    <div style={{ padding: 24, textAlign: "center", fontFamily: "system-ui" }}>
      <p>Signing you in…</p>
    </div>
  );
}
