"use client";

import "@/styles/tengagedChat.css";

function pagerPages(page: number, totalPages: number): (number | "…")[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  if (start > 2) out.push("…");
  for (let i = start; i <= end; i++) out.push(i);
  if (end < totalPages - 1) out.push("…");
  if (totalPages > 1) out.push(totalPages);
  return out;
}

export default function Tabs({
  tab,
  setTab,
  publicCount,
  tengaged,
  page,
  totalPages,
  setPage,
}: {
  tab: "public" | "private";
  setTab: (t: "public" | "private") => void;
  publicCount: number;
  tengaged?: boolean;
  page?: number;
  totalPages?: number;
  setPage?: (n: number) => void;
}) {
  if (tengaged) {
    const pages = Math.max(1, totalPages ?? 1);
    const cur = page ?? 1;
    return (
      <div className="tgChatTabs">
        <button
          type="button"
          className={`tgChatTab${tab === "public" ? " selected" : ""}`}
          onClick={() => setTab("public")}
        >
          public comments<span>({publicCount})</span>
        </button>
        <button
          type="button"
          className={`tgChatTab${tab === "private" ? " selected" : ""}`}
          onClick={() => setTab("private")}
        >
          private messages
        </button>
        {tab === "public" && setPage ? (
          <div className="tgChatPager">
            {pagerPages(cur, pages).map((p, i) =>
              p === "…" ? (
                <span key={`e${i}`}>…</span>
              ) : (
                <button
                  key={p}
                  type="button"
                  className={p === cur ? "showing" : undefined}
                  disabled={p === cur}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              )
            )}
          </div>
        ) : null}
      </div>
    );
  }

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
        Public comments <span style={{ opacity: 0.7 }}>({publicCount})</span>
      </button>
      <button style={btnStyle(tab === "private")} onClick={() => setTab("private")}>
        Private messages
      </button>
    </div>
  );
}
