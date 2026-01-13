"use client";

import { useState } from "react";

function hueRotateFromHex(hex: string) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let hue = 0;

  if (max !== min) {
    if (max === r) hue = (g - b) / (max - min);
    else if (max === g) hue = 2 + (b - r) / (max - min);
    else hue = 4 + (r - g) / (max - min);
    hue *= 60;
    if (hue < 0) hue += 360;
  }

  return Math.round(hue);
}

// Simple “good enough to test” tint filter.
// Works best when the base PNG is grayscale/light gray.
function tintFilter(hex: string) {
  const hue = hueRotateFromHex(hex);
  return `brightness(0) saturate(100%) invert(1) sepia(1) saturate(10000%) hue-rotate(${hue}deg)`;
}

function AvatarPngTest({
  gender,
  shirtColor,
  size = 200,
  grayscaleBody = false,
}: {
  gender: "M" | "F";
  shirtColor: string;
  size?: number;
  grayscaleBody?: boolean;
}) {
  const w = size;
  const h = Math.round(size * (230 / 200));

  const layer: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "contain",
    pointerEvents: "none",
  };

  return (
    <div style={{ width: w, height: h, position: "relative", border: "1px solid rgba(0,0,0,0.15)", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
      {/* Shirt highlight (stays white) */}
      <img src="/avatars/shirts/Shirt_1_highlight.png" alt="" style={layer} />

      {/* Shirt base (tinted) */}
      <img
        src="/avatars/shirts/Shirt_1_base.png"
        alt=""
        style={{
          ...layer,
          filter: tintFilter(shirtColor),
        }}
      />

      {/* Body (optional grayscale toggle to test later) */}
      <img
        src={`/avatars/body/Body_${gender}.png`}
        alt=""
        style={{
          ...layer,
          filter: grayscaleBody ? "grayscale(1)" : "none",
        }}
      />
    </div>
  );
}

export default function AvatarTestPage() {
  const [gender, setGender] = useState<"M" | "F">("M");
  const [shirtColor, setShirtColor] = useState("#E53935");

  return (
    <main style={{ padding: 16 }}>
      <h1 style={{ marginTop: 0 }}>PNG Avatar Test</h1>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <div style={{ border: "1px solid rgba(0,0,0,0.10)", borderRadius: 12, padding: 12, background: "#fff" }}>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Controls</div>

          <div style={{ display: "grid", gap: 10 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontWeight: 800 }}>Gender</span>
              <select value={gender} onChange={(e) => setGender(e.target.value as any)} style={{ padding: 8, borderRadius: 10, border: "1px solid rgba(0,0,0,0.15)" }}>
                <option value="M">Body_M</option>
                <option value="F">Body_F</option>
              </select>
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontWeight: 800 }}>Shirt Color</span>
              <input type="color" value={shirtColor} onChange={(e) => setShirtColor(e.target.value)} style={{ height: 40, width: 120 }} />
              <div style={{ fontSize: 12, opacity: 0.7 }}>{shirtColor}</div>
            </label>
          </div>
        </div>

        <div style={{ border: "1px solid rgba(0,0,0,0.10)", borderRadius: 12, padding: 12, background: "#fff" }}>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Preview</div>
          <AvatarPngTest gender={gender} shirtColor={shirtColor} size={220} />
        </div>
      </div>

      <div style={{ marginTop: 14, fontSize: 12, opacity: 0.75 }}>
        If the shirt tint looks weird, your <b>Shirt_1_base.png</b> is probably not grayscale/light gray.
        Highlights should be in <b>Shirt_1_highlight.png</b> and stay white.
      </div>
    </main>
  );
}
