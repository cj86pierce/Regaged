"use client";

export default function CastingsPanel(props: {
  meUserId: string | null;
  gameNumber: number;
  dayNumber: number;
  timeLeft: number | null;
  players: { userId: string; username: string; checks: number; health: number; keys: number }[];
}) {
  const me = props.meUserId ? props.players.find((p) => p.userId === props.meUserId) : null;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ border: "1px solid rgba(0,0,0,0.10)", borderRadius: 12, background: "#fff", padding: 12 }}>
        <div style={{ fontWeight: 1000, marginBottom: 8 }}>Castings</div>
        <div style={{ fontSize: 12, opacity: 0.8 }}>
          Game #{props.gameNumber} · Day {props.dayNumber}
          {props.timeLeft !== null && (
            <>
              {" "}
              · Ends in <b>{props.timeLeft}s</b>
            </>
          )}
        </div>

        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75, lineHeight: 1.35 }}>
          Keys decide the winner. Ties: checks → health. Drops/minigames coming next.
        </div>
      </div>

      <div style={{ border: "1px solid rgba(0,0,0,0.10)", borderRadius: 12, background: "#fff", padding: 12 }}>
        <div style={{ fontWeight: 1000, marginBottom: 8 }}>Your Stats</div>

        {me ? (
          <div style={{ display: "grid", gap: 8, fontSize: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>✅ Checks</span>
              <b>{me.checks}</b>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>❤️ Health</span>
              <b>{me.health}</b>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>🔑 Keys</span>
              <b>{me.keys}</b>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 12, opacity: 0.7 }}>Login to see your stats.</div>
        )}
      </div>

      <div style={{ border: "1px solid rgba(0,0,0,0.10)", borderRadius: 12, background: "#fff", padding: 12 }}>
        <div style={{ fontWeight: 1000, marginBottom: 8 }}>Coming Soon</div>
        <div style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.35 }}>
          • Hourly drops (🍎 / 🔑 / 🧪)<br />
          • Minigame score → auto nominees<br />
          • 1/2/3 point voting
        </div>
      </div>
    </div>
  );
}
