import Link from "next/link";

/** Visual tiers for Hall of Fame ranks (karma). */
export function hofBadgeStyle(rank: number): {
  background: string;
  color: string;
  border: string;
  boxShadow?: string;
  fontWeight: number;
} {
  if (rank === 1) {
    return {
      background: "linear-gradient(135deg, #f6d365 0%, #fda085 50%, #f6d365 100%)",
      color: "#5a3a00",
      border: "1px solid #d4a017",
      boxShadow: "0 0 0 1px rgba(255,215,0,0.35), 0 1px 3px rgba(0,0,0,0.18)",
      fontWeight: 1000,
    };
  }
  if (rank === 2) {
    return {
      background: "linear-gradient(135deg, #e8e8e8 0%, #bdbdbd 50%, #f5f5f5 100%)",
      color: "#333",
      border: "1px solid #9e9e9e",
      boxShadow: "0 1px 2px rgba(0,0,0,0.12)",
      fontWeight: 1000,
    };
  }
  if (rank === 3) {
    return {
      background: "linear-gradient(135deg, #e0a070 0%, #cd7f32 50%, #b87333 100%)",
      color: "#3a220c",
      border: "1px solid #8b5a2b",
      boxShadow: "0 1px 2px rgba(0,0,0,0.14)",
      fontWeight: 1000,
    };
  }
  if (rank <= 10) {
    return {
      background: "linear-gradient(135deg, #c4b5fd 0%, #8b5cf6 100%)",
      color: "#fff",
      border: "1px solid #6d28d9",
      fontWeight: 900,
    };
  }
  if (rank <= 50) {
    return {
      background: "var(--accent-bg, #e0e7ff)",
      color: "var(--text-primary)",
      border: "1px solid var(--border)",
      fontWeight: 900,
    };
  }
  if (rank <= 100) {
    return {
      background: "var(--bg-msg, #f3f4f6)",
      color: "var(--text-primary)",
      border: "1px solid var(--border)",
      fontWeight: 800,
    };
  }
  if (rank <= 250) {
    return {
      background: "transparent",
      color: "var(--text-muted, #666)",
      border: "1px solid var(--border)",
      fontWeight: 700,
    };
  }
  // 251–500: quiet
  return {
    background: "transparent",
    color: "var(--text-muted, #888)",
    border: "1px dashed var(--border)",
    fontWeight: 600,
  };
}

export function formatHofRank(rank: number): string {
  if (rank === 1) return "1st";
  if (rank === 2) return "2nd";
  if (rank === 3) return "3rd";
  return `#${rank}`;
}

/** Small badge next to a username. Only show if in top 500. */
export default function HofBadge(props: { rank: number | null | undefined; size?: "sm" | "md" }) {
  const rank = props.rank;
  if (rank == null || rank < 1 || rank > 500) return null;
  const style = hofBadgeStyle(rank);
  const sm = props.size !== "md";
  return (
    <Link
      href="/hof"
      title={`Hall of Fame · Karma rank ${rank}`}
      className="hofBadge"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: sm ? "1px 6px" : "2px 8px",
        borderRadius: 999,
        fontSize: sm ? 10 : 12,
        lineHeight: 1.2,
        textDecoration: "none",
        verticalAlign: "middle",
        marginLeft: 6,
        flexShrink: 0,
        ...style,
      }}
    >
      {formatHofRank(rank)}
    </Link>
  );
}
