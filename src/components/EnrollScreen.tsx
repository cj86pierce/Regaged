"use client";

import Link from "next/link";
import { useState } from "react";
import type { EnrollGameType } from "@/lib/enrollRequirements";
import { getEnrollRequirements } from "@/lib/enrollRequirements";
import type { EnrollMe } from "@/lib/loadEnrollMe";

export default function EnrollScreen(props: {
  gameType: EnrollGameType;
  title: string;
  description: string;
  buttonBg: string;
  buttonColor?: string;
  me: EnrollMe | null;
}) {
  const req = getEnrollRequirements(props.gameType);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const needsColor = !!req.colorName;
  const hasColor = !needsColor || props.me?.ownsYellowOrHigher === true;
  const hasFee = (props.me?.tMoney ?? 0) >= req.feeT;
  const warned = !!props.me?.warned;
  const canEnroll = !!props.me && hasColor && hasFee && !warned && !busy;

  async function enroll() {
    if (!props.me) {
      window.location.href = "/login";
      return;
    }
    setBusy(true);
    setErr(null);

    const res = await fetch("/api/enroll", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        gameType: props.gameType,
        message: message.trim(),
      }),
    });

    const json = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setErr(json?.error ?? "Enroll failed");
      return;
    }

    const gameId = json?.gameId as string | undefined;
    if (gameId) window.location.href = `/game/${gameId}`;
  }

  return (
    <main style={{ padding: 12, maxWidth: 520 }}>
      <Link href="/enroll" style={{ fontSize: 13, opacity: 0.75, display: "inline-block", marginBottom: 10 }}>
        ← All games
      </Link>

      <h1 style={{ marginTop: 0, marginBottom: 8 }}>{props.title}</h1>
      <div style={{ fontSize: 13, opacity: 0.8, lineHeight: 1.4, marginBottom: 14 }}>{props.description}</div>

      <div
        className="theme-sidebar-panel"
        style={{
          borderRadius: 10,
          padding: 14,
          marginBottom: 14,
          border: "1px solid var(--border)",
        }}
      >
        <div style={{ fontWeight: 1000, marginBottom: 10 }}>Enrollment requirements</div>
        <div style={{ display: "grid", gap: 8, fontSize: 13 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <span>Color level</span>
            <b>
              {req.colorName ? `${req.colorName}+` : "Any (White)"}
              {props.me ? (
                <span style={{ marginLeft: 8, fontWeight: 700, color: hasColor ? "var(--success)" : "var(--text-error)" }}>
                  · you: {props.me.highestColorName}
                  {hasColor ? " ✓" : " ✗"}
                </span>
              ) : null}
            </b>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <span>Entrance fee</span>
            <b>
              {req.feeT > 0 ? `R$${req.feeT}` : "Free"}
              {props.me ? (
                <span style={{ marginLeft: 8, fontWeight: 700, color: hasFee ? "var(--success)" : "var(--text-error)" }}>
                  · you: R${props.me.tMoney}
                  {hasFee ? " ✓" : " ✗"}
                </span>
              ) : null}
            </b>
          </div>
          {req.practice ? (
            <div style={{ fontSize: 12, opacity: 0.75 }}>Practice lobby — bots fill instantly, no payouts.</div>
          ) : null}
        </div>
        {needsColor && props.me && !hasColor ? (
          <div style={{ marginTop: 10, fontSize: 12 }}>
            Buy Yellow in{" "}
            <Link href="/shop/colors" style={{ fontWeight: 800 }}>
              Shop → Colors
            </Link>
            .
          </div>
        ) : null}
        {props.me && !hasFee ? (
          <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-error)", fontWeight: 800 }}>
            Not enough R$ for the entrance fee.
          </div>
        ) : null}
        {warned ? (
          <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-error)", fontWeight: 800 }}>
            Your account is warned — you cannot enroll until an owner clears it.
          </div>
        ) : null}
      </div>

      <label style={{ display: "block", fontWeight: 900, fontSize: 13, marginBottom: 6 }}>
        Enrollment message
      </label>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value.slice(0, 500))}
        placeholder="Introduce yourself — this posts to public chat when you join."
        rows={4}
        style={{
          width: "100%",
          boxSizing: "border-box",
          borderRadius: 10,
          border: "1px solid var(--border)",
          padding: 12,
          fontSize: 14,
          resize: "vertical",
          marginBottom: 6,
          background: "var(--bg-card)",
          color: "inherit",
        }}
      />
      <div style={{ fontSize: 11, opacity: 0.65, marginBottom: 14 }}>{message.length}/500</div>

      {!props.me ? (
        <div style={{ marginBottom: 12, fontSize: 13 }}>
          <Link href="/login" style={{ fontWeight: 900 }}>
            Log in
          </Link>{" "}
          to enroll.
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => void enroll()}
        disabled={!canEnroll && !!props.me}
        style={{
          padding: "12px 16px",
          borderRadius: 12,
          border: "1px solid rgba(0,0,0,0.14)",
          background: canEnroll || !props.me ? props.buttonBg : "var(--bg-btn-disabled)",
          color: props.buttonColor ?? "inherit",
          fontWeight: 1000,
          cursor: canEnroll || !props.me ? "pointer" : "not-allowed",
          width: "100%",
        }}
      >
        {busy ? "Enrolling..." : props.me ? "Enroll" : "Log in to enroll"}
      </button>

      {err ? (
        <div style={{ marginTop: 10, fontWeight: 900, color: "var(--text-error)" }}>{err}</div>
      ) : null}
    </main>
  );
}
