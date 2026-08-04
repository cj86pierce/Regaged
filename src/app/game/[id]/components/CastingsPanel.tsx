"use client";

export default function CastingsPanel(props: {
  gameNumber: number;
  dayNumber: number;
  timeLeft: number | null;
  me: null | { checks: number; health: number; keys: number };
}) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="theme-sidebar-panel" style={{ borderRadius: 12, padding: 12 }}>
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
          Nominations: low challenge + low checks. Finals: keys → challenge → checks.
        </div>
      </div>

      <div className="theme-sidebar-panel" style={{ borderRadius: 12, padding: 12 }}>
        <div style={{ fontWeight: 1000, marginBottom: 8 }}>Your Stats</div>
        {props.me ? (
          <div style={{ display: "grid", gap: 10, fontSize: 13 }}>
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
