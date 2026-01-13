"use client";

export type AvatarConfig = {
  bodyStyle: "body_m" | "body_f";
  shirtStyle: string; // "shirt_01" .. "shirt_06"
  eyesStyle: string;  // "eyes_01" .. "eyes_06"
  mouthStyle: string; // "mouth_01" .. "mouth_06"
  hairStyle: string;  // "hair_m_01" .. or "hair_f_01" ..
  accessoryStyle: string; // "none" | "accessory_01"

  bodyColor: string;
  shirtColor: string;
  eyeColor: string;
  mouthColor: string;
  hairColor: string;
  accessoryColor: string;
};

function MaskTint({ maskSrc, tint, zIndex }: { maskSrc: string; tint: string; zIndex: number }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex,
        backgroundColor: tint,
        pointerEvents: "none",
        WebkitMaskImage: `url(${maskSrc})`,
        WebkitMaskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        WebkitMaskSize: "contain",
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

export default function Avatar({
  config,
  width = 200,
  grayscale = false,
}: {
  config: AvatarConfig;
  width?: number;
  grayscale?: boolean;
}) {
  const w = width;
  const h = Math.round(width * (230 / 200));

  const bodySrc = `/avatars/body/${config.bodyStyle}.png`;
  const shirtBase = `/avatars/shirts/${config.shirtStyle}_base.png`;
  const shirtHighlight = `/avatars/shirts/${config.shirtStyle}_highlight.png`; // may not exist except shirt_01
  const eyesSrc = `/avatars/eyes/${config.eyesStyle}.png`;
  const mouthSrc = `/avatars/mouth/${config.mouthStyle}.png`;
  const hairSrc = `/avatars/hair/${config.hairStyle}.png`;

  const accessorySrc =
    config.accessoryStyle && config.accessoryStyle !== "none"
      ? `/avatars/accessories/${config.accessoryStyle}.png`
      : null;

  // only shirt_01 has highlight right now
  const hasHighlight = config.shirtStyle === "shirt_01";

  return (
    <div
      style={{
        width: w,
        height: h,
        position: "relative",
        borderRadius: 12,
        overflow: "hidden",
        border: "1px solid rgba(0,0,0,0.15)",
        background: "#fff",
        filter: grayscale ? "grayscale(1)" : "none",
      }}
    >
      {/* Bottom → Top order:
          1) Body (tinted)
          2) Shirt base (tinted)
          3) Shirt highlight (plain, only shirt_01)
          4) Mouth (tinted)
          5) Eyes (tinted)
          6) Hair (tinted)
          7) Accessory (tinted)
      */}
      <MaskTint maskSrc={bodySrc} tint={config.bodyColor} zIndex={1} />
      <MaskTint maskSrc={shirtBase} tint={config.shirtColor} zIndex={2} />
      {hasHighlight && <LayerPlain src={shirtHighlight} zIndex={3} />}
      <MaskTint maskSrc={mouthSrc} tint={config.mouthColor} zIndex={4} />
      <MaskTint maskSrc={eyesSrc} tint={config.eyeColor} zIndex={5} />
      <MaskTint maskSrc={hairSrc} tint={config.hairColor} zIndex={6} />
      {accessorySrc && <MaskTint maskSrc={accessorySrc} tint={config.accessoryColor} zIndex={7} />}
    </div>
  );
}
