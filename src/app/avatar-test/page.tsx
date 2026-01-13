"use client";

import { useState } from "react";

function MaskTint({
  maskSrc,
  tint,
  zIndex,
}: {
  maskSrc: string;
  tint: string; // hex
  zIndex: number;
}) {
  // This draws a colored rectangle, then uses the PNG as a mask
  // so ONLY the shirt pixels get tinted, not the body underneath.
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex,
        backgroundColor: tint,
        pointerEvents: "none",

        // WebKit (Chrome, Safari)
        WebkitMaskImage: `url(${maskSrc})`,
        WebkitMaskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        WebkitMaskSize: "contain",

        // Standard (Firefox may support differently; Vercel/Chrome is fine)
        maskImage: `url(${maskSrc})`,
        maskRepeat: "no-repeat",
        maskPosition: "center",
        maskSize: "contain",
      }}
    />
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
          1) Body tinted (mask)
          2) Shirt base tinted (mask)
          3) Shirt highlight normal PNG (white)
      */}

      <MaskTint
        maskSrc={`/avatars/body/Body_${gender}.png`}
        tint={bodyColor}
        zIndex={1}
      />

      <MaskTint
        maskSrc="/avatars/shirts/Shirt_1_base.png"
        tint={shirtColor}
        zIndex={2}
      />

      <LayerPlain src="/avatars/shirts/Shirt_1_highlight.png" zIndex={3} />
    </div>
  );
}

export default function AvatarTestPage() {
  const [gender, setGender] = useState<"M" | "F">("M");
  const [bodyColor, setBodyColor] = useState("#F1C27D");
  const [shirtColor, setShirtColor] = useState("#E53935");

  return (
    <main style={{ padding: 16 }}>
      <h1 style={{ marginTop: 0 }}>PNG Avatar Test (Mask Tint)</h1>

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
            This uses <b>masking</b>, so shirt color won’t affect the body.
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
