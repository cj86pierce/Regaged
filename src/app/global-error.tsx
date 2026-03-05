"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body style={{ fontFamily: "system-ui", padding: 24, background: "#1a0505", color: "#f0e8e8" }}>
        <h1>Something went wrong</h1>
        <p>{error.message || "A server-side exception occurred."}</p>
        <button
          onClick={reset}
          style={{
            padding: "10px 16px",
            background: "#8b1a1a",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
