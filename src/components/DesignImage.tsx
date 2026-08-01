"use client";

/** Crisp display for low-res design PNGs (native ~200×230). */
export default function DesignImage(props: {
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <img
      src={props.src}
      alt={props.alt}
      className={props.className}
      decoding="async"
      style={{
        width: "100%",
        height: "100%",
        objectFit: "contain",
        imageRendering: "auto",
        background:
          "radial-gradient(circle at 50% 40%, rgba(255,255,255,0.08), transparent 70%), var(--bg-input)",
        ...props.style,
      }}
    />
  );
}
