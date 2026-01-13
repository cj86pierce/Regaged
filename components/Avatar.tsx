type AvatarProps = {
  gender: "M" | "F";
  shirtColor: string; // hex, e.g. "#ff0000"
  size?: number;
};

export function Avatar({ gender, shirtColor, size = 200 }: AvatarProps) {
  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size * 1.15,
      }}
    >
      {/* Shirt highlight (white, no tint) */}
      <img
        src="/avatars/shirts/Shirt_1_highlight.png"
        alt=""
        style={layerStyle}
      />

      {/* Shirt base (tinted) */}
      <img
        src="/avatars/shirts/Shirt_1_base.png"
        alt=""
        style={{
          ...layerStyle,
          filter: colorToFilter(shirtColor),
        }}
      />

      {/* Body */}
      <img
        src={`/avatars/body/Body_${gender}.png`}
        alt=""
        style={layerStyle}
      />
    </div>
  );
}

const layerStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  objectFit: "contain",
  pointerEvents: "none",
};
