"use client";

type Message = {
  id: string;
  userId: string;
  username: string;
  body: string;
  createdAt: string;
  plus: number;
  minus: number;
  myReaction: "PLUS" | "MINUS" | null;
};

export default function Sidebar(props: {
  gameState: string;
  roundNumber: number;
  messages: Message[];
}) {
  const { gameState, roundNumber, messages } = props;

  const systemFeed = messages
    .filter((m) => m.username === "__system__" || m.body.startsWith("[SYSTEM]"))
    .map((m) => ({
      id: m.id,
      text: m.body.replace(/^\[SYSTEM\]\s*/i, ""),
      createdAt: m.createdAt,
    }))
    .slice(-30);

  return (
    <div style={{ border: "1px solid #d7d7d7", borderRadius: 8, background: "#fff", padding: 12 }}>
      <div style={{ borderBottom: "1px solid #eef2f5", paddingBottom: 10, marginBottom: 10 }}>
        <div style={{ fontWeight: 900, color: "#b02a37" }}>Read this</div>
        <div style={{ fontSize: 12, marginTop: 8, lineHeight: 1.35 }}>
          This is a social reality game. Stay active in chat, build alliances, and avoid being nominated and evicted.
          <br />
          <br />
          <b>State:</b> {gameState} · <b>Round:</b> {roundNumber}
        </div>
      </div>

      <div>
        <div style={{ fontWeight: 900, color: "#b02a37" }}>Game Story</div>
        <div style={{ fontSize: 12, marginTop: 8 }}>
          {systemFeed.length === 0 ? (
            <div style={{ opacity: 0.7 }}>No story yet.</div>
          ) : (
            <div style={{ maxHeight: 520, overflowY: "auto" }}>
              {systemFeed.map((s) => (
                <div key={s.id} style={{ padding: "6px 0", borderBottom: "1px solid #eef2f5" }}>
                  <div style={{ color: "#0b5ed7", fontWeight: 800 }}>{s.text}</div>
                  <div style={{ opacity: 0.6 }}>{new Date(s.createdAt).toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
