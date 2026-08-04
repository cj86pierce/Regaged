"use client";

export default function MinigameShell(props: {
  title: string;
  blurb: string;
  myScore: number;
  children: React.ReactNode;
}) {
  return (
    <div className="theme-sidebar-panel" style={{ borderRadius: 12, padding: 12 }}>
      <div style={{ fontWeight: 1000, marginBottom: 6 }}>{props.title}</div>
      <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 10 }}>{props.blurb}</div>
      <div style={{ fontSize: 12, marginBottom: 10 }}>
        Best score today: <b>{props.myScore > 0 ? props.myScore.toLocaleString() : "—"}</b>
      </div>
      {props.children}
    </div>
  );
}

export function PlayButton(props: { onClick: () => void; label?: string; disabled?: boolean }) {
  return (
    <button
      onClick={props.onClick}
      disabled={props.disabled}
      style={{
        padding: "10px 14px",
        borderRadius: 10,
        border: "1px solid var(--border)",
        background: "var(--accent-bg)",
        fontWeight: 1000,
        cursor: props.disabled ? "not-allowed" : "pointer",
      }}
    >
      {props.label ?? "Play"}
    </button>
  );
}
