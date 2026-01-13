"use client";

import { useState } from "react";
import Avatar, { AvatarConfig } from "@/components/Avatar";

const palette = [
  "#F1C27D", "#E0AC69", "#C68642", "#8D5524",
  "#111111", "#2B1B0E", "#6D4C41", "#B71C1C",
  "#E53935", "#FB8C00", "#FDD835", "#43A047",
  "#1E88E5", "#2E7DFF", "#8E24AA", "#00ACC1",
  "#FFFFFF", "#BDBDBD", "#616161", "#000000"
];

type Initial = AvatarConfig & { username: string };

function StylePicker({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ fontWeight: 900 }}>{label}</div>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ padding: 8, borderRadius: 10, border: "1px solid rgba(0,0,0,0.15)" }}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ fontWeight: 900 }}>{label}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
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

export default function AvatarEditor({ initial }: { initial: Initial }) {
  const [cfg, setCfg] = useState<AvatarConfig>({
    bodyStyle: initial.bodyStyle,
    hairStyle: initial.hairStyle,
    eyesStyle: initial.eyesStyle,
    mouthStyle: initial.mouthStyle,
    shirtStyle: initial.shirtStyle,
    bodyColor: initial.bodyColor,
    hairColor: initial.hairColor,
    eyeColor: initial.eyeColor,
    shirtColor: initial.shirtColor,
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

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 14 }}>
        <div style={{ border: "1px solid rgba(0,0,0,0.10)", borderRadius: 14, padding: 12, background: "#fff" }}>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Preview</div>
          <Avatar config={cfg} size={220} />
          <button
            onClick={save}
            disabled={saving}
            style={{
              marginTop: 12,
              width: "100%",
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.15)",
              background: saving ? "#f3f6f9" : "linear-gradient(#ffd85a,#ffb703)",
              fontWeight: 1000,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Saving..." : "Save Avatar"}
          </button>

          {msg && <div style={{ marginTop: 10, fontWeight: 900 }}>{msg}</div>}
        </div>

        <div style={{ border: "1px solid rgba(0,0,0,0.10)", borderRadius: 14, padding: 12, background: "#fff" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <StylePicker label="Body" value={cfg.bodyStyle} options={["body1","body2","body3","body4","body5"]} onChange={(v) => setCfg({ ...cfg, bodyStyle: v })} />
            <ColorPicker label="Body color" value={cfg.bodyColor} onChange={(v) => setCfg({ ...cfg, bodyColor: v })} />

            {/* ✅ Hair now includes hair6–hair10 */}
            <StylePicker
              label="Hair"
              value={cfg.hairStyle}
              options={["hair1","hair2","hair3","hair4","hair5","hair6","hair7","hair8","hair9","hair10"]}
              onChange={(v) => setCfg({ ...cfg, hairStyle: v })}
            />
            <ColorPicker label="Hair color" value={cfg.hairColor} onChange={(v) => setCfg({ ...cfg, hairColor: v })} />

            <StylePicker label="Eyes" value={cfg.eyesStyle} options={["eyes1","eyes2","eyes3","eyes4","eyes5"]} onChange={(v) => setCfg({ ...cfg, eyesStyle: v })} />
            <ColorPicker label="Eye color" value={cfg.eyeColor} onChange={(v) => setCfg({ ...cfg, eyeColor: v })} />

            <StylePicker label="Mouth" value={cfg.mouthStyle} options={["mouth1","mouth2","mouth3","mouth4","mouth5"]} onChange={(v) => setCfg({ ...cfg, mouthStyle: v })} />
            <div style={{ opacity: 0.7, fontSize: 12, alignSelf: "end" }}>Mouth color is fixed for now.</div>

            <StylePicker label="Shirt" value={cfg.shirtStyle} options={["shirt1","shirt2","shirt3","shirt4","shirt5"]} onChange={(v) => setCfg({ ...cfg, shirtStyle: v })} />
            <ColorPicker label="Shirt color" value={cfg.shirtColor} onChange={(v) => setCfg({ ...cfg, shirtColor: v })} />
          </div>
        </div>
      </div>
    </main>
  );
}
