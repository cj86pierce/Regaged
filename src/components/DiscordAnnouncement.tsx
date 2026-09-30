"use client";

import { useEffect, useState } from "react";
import { DISCORD_INVITE_URL } from "@/lib/discord";

const DISMISSED_KEY = "regaged_discord_announcement_dismissed";

export default function DiscordAnnouncement() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(localStorage.getItem(DISMISSED_KEY) !== "1");
    } catch {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // The notice still closes when browser storage is unavailable.
    }
  }

  if (!visible) return null;

  return (
    <aside className="discordAnnouncement" aria-label="Regaged Discord announcement">
      <div className="discordAnnouncementInner">
        <p>
          Join the Regaged Discord to find games and chat with the community.{" "}
          <a href={DISCORD_INVITE_URL} target="_blank" rel="noopener noreferrer">
            Join Discord
          </a>
        </p>
        <button type="button" onClick={dismiss} aria-label="Dismiss Discord announcement" title="Dismiss">
          &times;
        </button>
      </div>
    </aside>
  );
}
