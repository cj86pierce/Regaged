"use client";

export default function Tabs({
  tab,
  setTab,
  publicCount,
}: {
  tab: "public" | "private";
  setTab: (t: "public" | "private") => void;
  publicCount: number;
}) {
  const btnStyle = (active: boolean) => ({
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: active ? "var(--bg-card)" : "var(--bg-btn-disabled)",
    fontWeight: 800 as const,
    cursor: "pointer",
  });

  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
      <button style={btnStyle(tab === "public")} onClick={() => setTab("public")}>
        public comments <span style={{ opacity: 0.7 }}>({publicCount})</span>
      </button>
      <button style={btnStyle(tab === "private")} onClick={() => setTab("private")}>
        private messages
      </button>
    </div>
  );
}
