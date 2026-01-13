"use client";

import { useState } from "react";

function LayerTint({
  src,
  tint,
  zIndex,
}: {
  src: string;
  tint: string; // hex
  zIndex: number;
}) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex,
        backgroundColor: tint,
        pointerEvents: "none",
      }}
    >
      <img
        src={src}
        alt=""
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "contain",
          mixBlendMode: "multiply",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

function LayerPlain({ src, zIndex }: { src: string; zIndex: number }) {
  return (
    <img
      src={src}
      alt=""
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "contain",
        zIndex,
        pointerEvents: "none",
      }}
    />
  );
}

function AvatarPng({
  gender,
  bodyColor,
  shirtColor,
  size = 220,
}: {
  gender: "M" | "F";
  bodyColor: string;
  shirtColor: string;
  size?: number;
}) {
  const w = size;
  const h = Math.round(size * (230 / 200)); // keep 200x230 aspect

  return (
    <div
      style={{
        width: w,
        height: h,
        position: "relative",
        border: "1px solid rgba(0,0,0,0.15)",
        borderRadius: 12,
        overflow: "hidden",
        background: "#fff",
      }}
    >
      {/* ✅ ORDER (bottom -> top):
          1) Body (tinted)
          2) Shirt base (tinted)
          3) Shirt highlight (no tint, stays white)
      */}

      <LayerTint
        src={`/avatars/body/Body_${gender}.png`}
        tint={bodyColor}
        zIndex={1}
      />

      <LayerTint
        src="/avatars/shirts/Shirt_1_base.png"
        tint={shirtColor}
        zIndex={2}
      />

      <LayerPlain
        src="/avatars/shirts/Shirt_1_highlight.png"
        zIndex={3}
      />
    </div>
  );
}

export default function AvatarTestPage() {
  const [gender, setGender] = useState<"M" | "F">("M");
  const [bodyColor, setBodyColor] = useState("#F1C27D");
  const [shirtColor, setShirtColor] = useState("#E53935");

  return (
    <main style={{ padding: 16 }}>
      <h1 style={{ marginTop: 0 }}>PNG Avatar Test</h1>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <div
          style={{
            border: "1px solid rgba(0,0,0,0.10)",
            borderRadius: 12,
            padding: 12,
            background: "#fff",
            width: 320,
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Controls</div>

          <div style={{ display: "grid", gap: 12 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontWeight: 800 }}>Gender</span>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as any)}
                style={{
                  padding: 8,
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.15)",
                }}
              >
                <option value="M">Body_M.png</option>
                <option value="F">Body_F.png</option>
              </select>
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontWeight: 800 }}>Body Color</span>
              <input
                type="color"
                value={bodyColor}
                onChange={(e) => setBodyColor(e.target.value)}
                style={{ height: 40, width: 120 }}
              />
              <div style={{ fontSize: 12, opacity: 0.7 }}>{bodyColor}</div>
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontWeight: 800 }}>Shirt Color</span>
              <input
                type="color"
                value={shirtColor}
                onChange={(e) => setShirtColor(e.target.value)}
                style={{ height: 40, width: 120 }}
              />
              <div style={{ fontSize: 12, opacity: 0.7 }}>{shirtColor}</div>
            </label>
          </div>

          <div style={{ marginTop: 12, fontSize: 12, opacity: 0.75, lineHeight: 1.35 }}>
            <b>Important:</b> for tinting to look good, your PNGs should be grayscale.
            <br />
            • Body PNG: flat gray silhouette
            <br />
            • Shirt base: grayscale (tintable)
            <br />
            • Shirt highlight: white details only
          </div>
        </div>

        <div
          style={{
            border: "1px solid rgba(0,0,0,0.10)",
            borderRadius: 12,
            padding: 12,
            background: "#fff",
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Preview</div>
          <AvatarPng gender={gender} bodyColor={bodyColor} shirtColor={shirtColor} size={240} />
        </div>
      </div>
    </main>
  );
}
