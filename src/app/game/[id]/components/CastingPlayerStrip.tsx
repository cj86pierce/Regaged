"use client";

import Link from "next/link";
import Avatar from "@/components/Avatar";
import type { AvatarConfig } from "@/components/Avatar";

type Player = {
  userId: string;
  username: string;
  status: "ACTIVE" | "ELIMINATED";
  eliminatedPlace: number | null;
  avatar: AvatarConfig;
};

export default function CastingPlayerStrip({ players }: { players: Player[] }) {
  return (
    <div
      style={{
        border: "1px solid rgba(0,0,0,0.10)",
        borderRadius: 12,
        background: "#fff",
        padding: 10,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(10, minmax(0, 1fr))",
          gap: 8,
          alignItems: "start",
        }}
      >
        {players.map((p, idx) => {
          const out = p.status !== "ACTIVE";
          const seatLabel = out ? (p.eliminatedPlace ? `${p.eliminatedPlace}` : "OUT") : `${idx + 1}`;

          return (
            <Link
              key={p.userId}
              href={`/u/${encodeURIComponent(p.username.toLowerCase())}`}
              style={{
                textDecoration: "none",
                color: "#111",
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.10)",
                padding: 8,
                display: "grid",
                gap: 6,
                background: "#fff",
              }}
            >
              <div style={{ display: "grid", placeItems: "center" }}>
                <Avatar config={p.avatar} width={64} grayscale={out} />
              </div>

              <div
                title={p.username}
                style={{
                  fontWeight: 1000,
                  fontSize: 11,
                  textAlign: "center",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {p.username}
              </div>

              <div style={{ fontSize: 10, textAlign: "center", opacity: 0.7 }}>
                #{seatLabel}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
