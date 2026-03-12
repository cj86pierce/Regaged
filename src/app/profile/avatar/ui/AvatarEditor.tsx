"use client";

import { useState } from "react";
import Avatar, { AvatarConfig } from "@/components/Avatar";

const palette = [
  "#111111", "#2B1B0E", "#6D4C41", "#B71C1C",
  "#E53935", "#FB8C00", "#FDD835", "#43A047",
  "#1E88E5", "#2E7DFF", "#8E24AA", "#00ACC1",
  "#FFFFFF", "#BDBDBD", "#616161", "#000000"
];

// ✅ curated skin tones (bring back the “good ones”)
const skinPresets = [
  "#F1C27D",
  "#E0AC69",
  "#C68642",
  "#8D5524",
];

export type AvatarEditorInitial = AvatarConfig & { username: string };

function StylePicker({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ fontWeight: 900 }}>{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ padding: 8, borderRadius: 10, border: "1px solid rgba(0,0,0,0.15)" }}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

function ColorWheel({
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

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: 48, height: 36, padding: 0, border: "none", background: "transparent" }}
        />
        <div style={{ fontSize: 12, opacity: 0.75 }}>{value}</div>
      </div>

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
              border: c === value ? "2px solid var(--brand)" : "1px solid var(--border)",
              background: c,
              cursor: "pointer",
            }}
          />
        ))}
      </div>
    </div>
  );
}

function SkinPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ fontWeight: 900 }}>Skin tone</div>
      <div style={{ display: "flex", gap: 8 }}>
        {skinPresets.map((c) => (
          <button
            key={c}
            onClick={() => onChange(c)}
            title={c}
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              border: c === value ? "3px solid #111" : "1px solid rgba(0,0,0,0.2)",
              background: c,
              cursor: "pointer",
            }}
          />
        ))}
      </div>
      <div style={{ fontSize: 12, opacity: 0.75 }}>{value}</div>
    </div>
  );
}

export default function AvatarEditor({ initial }: { initial: AvatarEditorInitial }) {
  const [cfg, setCfg] = useState<AvatarConfig>({
    bodyStyle: initial.bodyStyle,
    hairStyle: initial.hairStyle,
    eyesStyle: initial.eyesStyle,
    mouthStyle: initial.mouthStyle,
    shirtStyle: initial.shirtStyle,
    accessoryStyle: initial.accessoryStyle ?? "none",

    bodyColor: initial.bodyColor,
    hairColor: initial.hairColor,
    eyeColor: initial.eyeColor,
    mouthColor: initial.mouthColor ?? "#E0AC69",
    shirtColor: initial.shirtColor,
    accessoryColor: initial.accessoryColor ?? "#111111",
  });

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/profile/avatar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(cfg),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) setMsg(json?.error ?? "Save failed");
    else setMsg("Saved!");
  }

  return (
    <main style={{ padding: 12 }}>
      <h1 style={{ marginTop: 0 }}>Customize Avatar</h1>

      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 14 }}>
        <div style={{ border: "1px solid rgba(0,0,0,0.10)", borderRadius: 14, padding: 12, background: "#fff" }}>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Preview</div>
          <Avatar config={cfg} width={240} />
          <button
            onClick={save}
            disabled={saving}
            style={{
              marginTop: 12,
              width: "100%",
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: saving ? "var(--bg-btn-disabled)" : "var(--bid-btn-bg)",
              color: saving ? "var(--text-muted)" : "var(--bid-btn-text)",
              fontWeight: 1000,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Saving..." : "Save Avatar"}
          </button>

          {msg && <div style={{ marginTop: 10, fontWeight: 900, color: "var(--text-primary)" }}>{msg}</div>}
        </div>

        <div style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 12, background: "var(--bg-card)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <StylePicker
              label="Body"
              value={cfg.bodyStyle}
              options={["body_m", "body_f"]}
              onChange={(v) => setCfg({ ...cfg, bodyStyle: v as any })}
            />
            <SkinPicker value={cfg.bodyColor} onChange={(v) => setCfg({ ...cfg, bodyColor: v })} />

            <StylePicker label="Shirt" value={cfg.shirtStyle} options={["shirt_01","shirt_02","shirt_03","shirt_04","shirt_05","shirt_06"]} onChange={(v) => setCfg({ ...cfg, shirtStyle: v })} />
            <ColorWheel label="Shirt color" value={cfg.shirtColor} onChange={(v) => setCfg({ ...cfg, shirtColor: v })} />

            <StylePicker label="Eyes" value={cfg.eyesStyle} options={["eyes_01","eyes_02","eyes_03","eyes_04","eyes_05","eyes_06"]} onChange={(v) => setCfg({ ...cfg, eyesStyle: v })} />
            <ColorWheel label="Eye color" value={cfg.eyeColor} onChange={(v) => setCfg({ ...cfg, eyeColor: v })} />

            <StylePicker label="Mouth" value={cfg.mouthStyle} options={["mouth_01","mouth_02","mouth_03","mouth_04","mouth_05","mouth_06"]} onChange={(v) => setCfg({ ...cfg, mouthStyle: v })} />
            <ColorWheel label="Mouth color" value={cfg.mouthColor} onChange={(v) => setCfg({ ...cfg, mouthColor: v })} />

            <StylePicker label="Hair" value={cfg.hairStyle} options={["hair_m_01","hair_m_02","hair_m_03","hair_f_01","hair_f_02","hair_f_03"]} onChange={(v) => setCfg({ ...cfg, hairStyle: v })} />
            <ColorWheel label="Hair color" value={cfg.hairColor} onChange={(v) => setCfg({ ...cfg, hairColor: v })} />

            <StylePicker label="Accessory" value={cfg.accessoryStyle} options={["none", "accessory_01"]} onChange={(v) => setCfg({ ...cfg, accessoryStyle: v })} />
            <ColorWheel label="Accessory color" value={cfg.accessoryColor} onChange={(v) => setCfg({ ...cfg, accessoryColor: v })} />
          </div>

          <div style={{ marginTop: 12, fontSize: 12, opacity: 0.75 }}>
            Shirt highlight currently exists only for <b>shirt_01</b>.
          </div>
        </div>
      </div>
    </main>
  );
}
