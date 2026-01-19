"use client";

export default function CastingsPanel(props: {
  gameNumber: number;
  dayNumber: number;
  timeLeft: number | null;

  me: null | {
    username: string;
    checks: number;
    health: number;
    keys: number;
  };
}) {
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
          Keys decide the winner. Ties: checks → health.
          <br />
          (Drops + minigames coming next.)
        </div>
      </div>

      <div style={{ border: "1px solid rgba(0,0,0,0.10)", borderRadius: 12, background: "#fff", padding: 12 }}>
        <div style={{ fontWeight: 1000, marginBottom: 8 }}>Your Stats</div>

        {props.me ? (
          <div style={{ display: "grid", gap: 8, fontSize: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>✅ Checks</span>
              <b>{props.me.checks}</b>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>❤️ Health</span>
              <b>{props.me.health}</b>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>🔑 Keys</span>
              <b>{props.me.keys}</b>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 12, opacity: 0.7 }}>Login to see your stats.</div>
        )}
      </div>
    </div>
  );
}
