"use client";

export type AvatarConfig = {
  bodyStyle: string;
  hairStyle: string;
  eyesStyle: string;
  mouthStyle: string;
  shirtStyle: string;

  bodyColor: string;
  hairColor: string;
  eyeColor: string;
  shirtColor: string;
};

export default function Avatar({
  config,
  size = 80,
  grayscale = false,
}: {
  config: AvatarConfig;
  size?: number;
  grayscale?: boolean;
}) {
  const s = size;

  // Simple 5-style shapes. We keep it generic + clean.
  // Later: swap these with nicer SVG assets, same API.
  const Body = () => {
    switch (config.bodyStyle) {
      case "body2":
        return <circle cx="50" cy="42" r="22" fill={config.bodyColor} />;
      case "body3":
        return <rect x="28" y="20" width="44" height="44" rx="10" fill={config.bodyColor} />;
      case "body4":
        return <ellipse cx="50" cy="42" rx="20" ry="24" fill={config.bodyColor} />;
      case "body5":
        return <path d="M30 30 Q50 14 70 30 Q74 50 50 66 Q26 50 30 30Z" fill={config.bodyColor} />;
      default:
        return <circle cx="50" cy="42" r="20" fill={config.bodyColor} />;
    }
  };

  const Shirt = () => {
    switch (config.shirtStyle) {
      case "shirt2":
        return <path d="M28 62 Q50 54 72 62 V92 H28 Z" fill={config.shirtColor} />;
      case "shirt3":
        return <rect x="26" y="60" width="48" height="34" rx="8" fill={config.shirtColor} />;
      case "shirt4":
        return <path d="M25 62 H75 L70 94 H30 Z" fill={config.shirtColor} />;
      case "shirt5":
        return <path d="M30 60 Q50 72 70 60 V94 H30 Z" fill={config.shirtColor} />;
      default:
        return <rect x="28" y="62" width="44" height="32" rx="10" fill={config.shirtColor} />;
    }
  };

  const Eyes = () => {
    const c = config.eyeColor;
    switch (config.eyesStyle) {
      case "eyes2":
        return (
          <>
            <circle cx="42" cy="40" r="4" fill={c} />
            <circle cx="58" cy="40" r="4" fill={c} />
          </>
        );
      case "eyes3":
        return (
          <>
            <rect x="37" y="38" width="10" height="4" rx="2" fill={c} />
            <rect x="53" y="38" width="10" height="4" rx="2" fill={c} />
          </>
        );
      case "eyes4":
        return (
          <>
            <circle cx="42" cy="40" r="5" fill="#fff" />
            <circle cx="58" cy="40" r="5" fill="#fff" />
            <circle cx="42" cy="40" r="2.5" fill={c} />
            <circle cx="58" cy="40" r="2.5" fill={c} />
          </>
        );
      case "eyes5":
        return (
          <>
            <path d="M36 40 Q42 34 48 40" stroke={c} strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M52 40 Q58 34 64 40" stroke={c} strokeWidth="3" fill="none" strokeLinecap="round" />
          </>
        );
      default:
        return (
          <>
            <circle cx="42" cy="40" r="3" fill={c} />
            <circle cx="58" cy="40" r="3" fill={c} />
          </>
        );
    }
  };

  const Mouth = () => {
    const c = "#1b1b1b";
    switch (config.mouthStyle) {
      case "mouth2":
        return <path d="M42 52 Q50 58 58 52" stroke={c} strokeWidth="3" fill="none" strokeLinecap="round" />;
      case "mouth3":
        return <line x1="44" y1="54" x2="56" y2="54" stroke={c} strokeWidth="3" strokeLinecap="round" />;
      case "mouth4":
        return <path d="M42 56 Q50 48 58 56" stroke={c} strokeWidth="3" fill="none" strokeLinecap="round" />;
      case "mouth5":
        return <circle cx="50" cy="54" r="4" fill="none" stroke={c} strokeWidth="3" />;
      default:
        return <path d="M44 52 Q50 56 56 52" stroke={c} strokeWidth="3" fill="none" strokeLinecap="round" />;
    }
  };

  const Hair = () => {
    const c = config.hairColor;
    switch (config.hairStyle) {
      case "hair2":
        return <path d="M30 30 Q50 10 70 30 Q64 18 50 18 Q36 18 30 30Z" fill={c} />;
      case "hair3":
        return <path d="M28 34 Q50 12 72 34 Q68 22 50 22 Q32 22 28 34Z" fill={c} />;
      case "hair4":
        return <path d="M30 26 Q50 6 70 26 Q74 40 50 30 Q26 40 30 26Z" fill={c} />;
      case "hair5":
        return <path d="M28 30 Q50 4 72 30 Q70 44 50 26 Q30 44 28 30Z" fill={c} />;
      default:
        return <path d="M32 30 Q50 12 68 30 Q64 22 50 22 Q36 22 32 30Z" fill={c} />;
    }
  };

  return (
    <div
      style={{
        width: s,
        height: s,
        borderRadius: 10,
        overflow: "hidden",
        border: "1px solid rgba(0,0,0,0.15)",
        background: "linear-gradient(#f3f6f9,#fff)",
        filter: grayscale ? "grayscale(1)" : "none",
      }}
    >
      <svg viewBox="0 0 100 100" width={s} height={s}>
        <Body />
        <Shirt />
        <Eyes />
        <Mouth />
        <Hair />
      </svg>
    </div>
  );
}
