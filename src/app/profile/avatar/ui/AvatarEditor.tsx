function ColorPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ fontWeight: 900 }}>{label}</div>

      {/* Color wheel */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: 48, height: 36, padding: 0, border: "none", background: "transparent" }}
        />
        <div style={{ fontSize: 12, opacity: 0.75 }}>{value}</div>
      </div>

      {/* Quick palette */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
        {palette.map((c) => (
          <button
            key={c}
            onClick={() => onChange(c)}
            title={c}
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              border: c === value ? "2px solid #111" : "1px solid rgba(0,0,0,0.2)",
              background: c,
              cursor: "pointer",
            }}
          />
        ))}
      </div>
    </div>
  );
}
