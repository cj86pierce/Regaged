"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="theme-card" style={{ padding: 24, margin: 16, textAlign: "center" }}>
      <h2 style={{ marginTop: 0, color: "var(--text-primary)" }}>Something went wrong</h2>
      <p style={{ color: "var(--text-muted)", marginBottom: 16 }}>
        {error.message || "A server-side error occurred."}
      </p>
      <button
        onClick={reset}
        className="theme-btn-primary"
        style={{ cursor: "pointer" }}
      >
        Try again
      </button>
    </div>
  );
}
