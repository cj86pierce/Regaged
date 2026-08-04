import HofBadge from "@/components/HofBadge";

const badgeBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "1px 6px",
  borderRadius: 999,
  fontSize: 10,
  lineHeight: 1.2,
  textDecoration: "none",
  verticalAlign: "middle",
  marginLeft: 6,
  flexShrink: 0,
  fontWeight: 900,
};

/** Owner / Warned / HOF badges in the same row next to username. */
export default function StatusBadges(props: {
  isOwner?: boolean;
  isWarned?: boolean;
  isBanned?: boolean;
  hofRank?: number | null;
  size?: "sm" | "md";
}) {
  const sm = props.size !== "md";
  const pad = sm ? "1px 6px" : "2px 8px";
  const fontSize = sm ? 10 : 12;

  return (
    <>
      {props.isOwner ? (
        <span
          title="Site owner"
          style={{
            ...badgeBase,
            padding: pad,
            fontSize,
            background: "linear-gradient(135deg, #064e3b 0%, #059669 100%)",
            color: "#ecfdf5",
            border: "1px solid #047857",
            boxShadow: "0 1px 2px rgba(0,0,0,0.18)",
          }}
        >
          Owner
        </span>
      ) : null}
      {props.isWarned ? (
        <span
          title="Warned — breaking rules; proceed with caution"
          style={{
            ...badgeBase,
            padding: pad,
            fontSize,
            background: "linear-gradient(135deg, #b91c1c 0%, #ef4444 100%)",
            color: "#fff",
            border: "1px solid #991b1b",
            boxShadow: "0 1px 2px rgba(0,0,0,0.18)",
          }}
        >
          Warned
        </span>
      ) : null}
      {props.isBanned ? (
        <span
          title="Banned"
          style={{
            ...badgeBase,
            padding: pad,
            fontSize,
            background: "#111",
            color: "#fca5a5",
            border: "1px solid #7f1d1d",
          }}
        >
          Banned
        </span>
      ) : null}
      <HofBadge rank={props.hofRank} size={props.size} />
    </>
  );
}
