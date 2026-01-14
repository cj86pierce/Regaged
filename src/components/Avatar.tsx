"use client";

export type AvatarConfig = {
  bodyStyle: "body_m" | "body_f";
  shirtStyle: string; // shirt_01..shirt_06
  eyesStyle: string;  // eyes_01..eyes_06
  mouthStyle: string; // mouth_01..mouth_06
  hairStyle: string;  // hair_m_01.. hair_f_03..
  accessoryStyle: string; // none | accessory_01

  bodyColor: string;
  shirtColor: string;
  eyeColor: string;
  mouthColor: string;
  hairColor: string;
  accessoryColor: string;
};

// ✅ Tints the shape AND preserves shading from the grayscale PNG
function TintedLayer({
  src,
  tint,
  zIndex,
}: {
  src: string;
  tint: string;
  zIndex: number;
}) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex,
        pointerEvents: "none",
        // critical: prevents blend modes from affecting layers outside this group
        isolation: "isolate",
      }}
    >
      {/* color fill masked to the shape */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: tint,

          WebkitMaskImage: `url(${src})`,
          WebkitMaskRepeat: "no-repeat",
          WebkitMaskPosition: "center",
          WebkitMaskSize: "contain",

          maskImage: `url(${src})`,
          maskRepeat: "no-repeat",
          maskPosition: "center",
          maskSize: "contain",
        }}
      />

      {/* grayscale PNG on top multiplies shading into the tint */}
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
  const shirtHighlight = `/avatars/shirts/${config.shirtStyle}_highlight.png`;
  const eyesSrc = `/avatars/eyes/${config.eyesStyle}.png`;
  const mouthSrc = `/avatars/mouth/${config.mouthStyle}.png`;
  const hairSrc = `/avatars/hair/${config.hairStyle}.png`;

  const accessorySrc =
    config.accessoryStyle && config.accessoryStyle !== "none"
      ? `/avatars/accessories/${config.accessoryStyle}.png`
      : null;

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
      {/* Bottom → Top */}
      <TintedLayer src={bodySrc} tint={config.bodyColor} zIndex={1} />
      <TintedLayer src={shirtBase} tint={config.shirtColor} zIndex={2} />
      {hasHighlight && <LayerPlain src={shirtHighlight} zIndex={3} />}
      <TintedLayer src={mouthSrc} tint={config.mouthColor} zIndex={4} />
      <TintedLayer src={eyesSrc} tint={config.eyeColor} zIndex={5} />
      <TintedLayer src={hairSrc} tint={config.hairColor} zIndex={6} />
      {accessorySrc && <TintedLayer src={accessorySrc} tint={config.accessoryColor} zIndex={7} />}
    </div>
  );
}
