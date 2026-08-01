"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Avatar, { AvatarConfig, type SlotDesignType } from "@/components/Avatar";

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

type OwnedDesign = { id: string; title: string; designType: string };

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

export default function AvatarEditor({
  initial,
  slotDesigns: initialSlotDesigns = {},
}: {
  initial: AvatarEditorInitial;
  slotDesigns?: Partial<Record<SlotDesignType, string>>;
}) {
  const router = useRouter();
  const [slotDesigns, setSlotDesigns] = useState<Partial<Record<SlotDesignType, string>>>(initialSlotDesigns);
  const [ownedDesigns, setOwnedDesigns] = useState<OwnedDesign[]>([]);
  const [equipLoading, setEquipLoading] = useState<string | null>(null);
  const [cfg, setCfg] = useState<AvatarConfig>({
    bodyStyle: initial.bodyStyle,
    hairStyle: initial.hairStyle,
    eyesStyle: initial.eyesStyle,
    mouthStyle: initial.mouthStyle,
    shirtStyle: initial.shirtStyle,
    accessoryStyle: initial.accessoryStyle ?? "none",
    glassesStyle: initial.glassesStyle ?? "none",
    scarStyle: initial.scarStyle ?? "none",
    hairOrnamentStyle: initial.hairOrnamentStyle ?? "none",

    bodyColor: initial.bodyColor,
    hairColor: initial.hairColor,
    eyeColor: initial.eyeColor,
    mouthColor: initial.mouthColor ?? "#E0AC69",
    shirtColor: initial.shirtColor,
    accessoryColor: initial.accessoryColor ?? "#111111",
    backgroundColor: initial.backgroundColor ?? "#E8E8E8",
    glassesColor: initial.glassesColor ?? "#111111",
    scarColor: initial.scarColor ?? "#8B4513",
    hairOrnamentColor: initial.hairOrnamentColor ?? "#C0C0C0",
  });

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setSlotDesigns(initialSlotDesigns);
  }, [initialSlotDesigns]);

  useEffect(() => {
    fetch("/api/profile/avatar/owned-designs", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => setOwnedDesigns(data.designs ?? []))
      .catch(() => setOwnedDesigns([]));
  }, []);

  async function equip(slot: SlotDesignType, designId: string | null) {
    const key = designId ? `${slot}-${designId}` : `${slot}-unequip`;
    setEquipLoading(key);
    try {
      const res = await fetch("/api/profile/avatar/equip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot, designId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setMsg(j?.error ?? "Equip failed");
        return;
      }
      setSlotDesigns((prev) => {
        const next = { ...prev };
        if (designId) next[slot] = `/api/designs/${designId}/image`;
        else delete next[slot];
        return next;
      });
      router.refresh();
    } finally {
      setEquipLoading(null);
    }
  }

  function isEquipped(slot: SlotDesignType, designId: string) {
    return slotDesigns[slot] === `/api/designs/${designId}/image`;
  }

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
        <div style={{ border: "1px solid rgba(0,0,0,0.10)", borderRadius: 4, padding: 12, background: "var(--bg-card)" }}>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Preview</div>
          <Avatar config={cfg} width={240} slotDesigns={slotDesigns} />
          <button
            onClick={save}
            disabled={saving}
            style={{
              marginTop: 12,
              width: "100%",
              padding: "10px 12px",
              borderRadius: 3,
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

        <div style={{ border: "1px solid var(--border)", borderRadius: 4, padding: 12, background: "var(--bg-card)" }}>
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

            <div style={{ gridColumn: "1 / -1" }}>
              <ColorWheel label="Background color" value={cfg.backgroundColor ?? "#E8E8E8"} onChange={(v) => setCfg({ ...cfg, backgroundColor: v })} />
            </div>
          </div>

          <div style={{ marginTop: 12, fontSize: 12, opacity: 0.75 }}>
            Shirt highlight currently exists only for <b>shirt_01</b>.
          </div>

          <div style={{ marginTop: 24, paddingTop: 24, borderTop: "1px solid var(--border)" }}>
            <div style={{ fontWeight: 900, marginBottom: 12 }}>Owned designs</div>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
              Designs you won from auctions. Click Equip to use one on your avatar.
            </p>
            {ownedDesigns.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>You don&apos;t own any designs yet. Win an auction to get one!</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 12 }}>
                {ownedDesigns.map((d) => (
                  <div
                    key={d.id}
                    style={{
                      border: isEquipped(d.designType as SlotDesignType, d.id)
                        ? "2px solid var(--brand)"
                        : "1px solid var(--border)",
                      borderRadius: 10,
                      padding: 8,
                      background: "var(--bg-input)",
                      textAlign: "center",
                    }}
                  >
                    <img
                      src={`/api/designs/${d.id}/image`}
                      alt={d.title}
                      style={{ width: 64, height: 64, objectFit: "contain", display: "block", margin: "0 auto 8px" }}
                    />
                    <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }} title={d.title}>
                      {d.title.length > 12 ? d.title.slice(0, 10) + "…" : d.title}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 8 }}>{d.designType}</div>
                    <button
                      onClick={() => equip(d.designType as SlotDesignType, isEquipped(d.designType as SlotDesignType, d.id) ? null : d.id)}
                      disabled={!!equipLoading}
                      style={{
                        padding: "4px 8px",
                        fontSize: 11,
                        borderRadius: 6,
                        border: "1px solid var(--border)",
                        background: isEquipped(d.designType as SlotDesignType, d.id) ? "var(--brand)" : "var(--bg-btn)",
                        color: isEquipped(d.designType as SlotDesignType, d.id) ? "#fff" : "var(--text-primary)",
                        cursor: equipLoading ? "not-allowed" : "pointer",
                        fontWeight: 600,
                      }}
                    >
                      {equipLoading === `${d.designType}-${d.id}` || equipLoading === `${d.designType}-unequip` ? "..." : isEquipped(d.designType as SlotDesignType, d.id) ? "Unequip" : "Equip"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
