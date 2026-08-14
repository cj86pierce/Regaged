"use client";

import { COLOR_LAB, colorLevelSwatch, colorLevelSwatchClass } from "@/lib/colorLevelCss";

const GROUPS: { id: "static" | "moving"; title: string; blurb: string }[] = [
  {
    id: "static",
    title: "Static ladder",
    blurb: "White through Black — solids, power 1x–10x.",
  },
  {
    id: "moving",
    title: "Moving colors",
    blurb: "Silver through TV Star. Vote power is the x number; Rookies bet max is 2× that. TV Star is 40x / 80 T$.",
  },
];

export default function ColorLabClient() {
  return (
    <div style={{ display: "grid", gap: 28 }}>
      {GROUPS.map((g) => {
        const items = COLOR_LAB.filter((c) => c.group === g.id);
        return (
          <section key={g.id}>
            <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 1000 }}>{g.title}</h2>
            <p style={{ margin: "0 0 14px", fontSize: 13, opacity: 0.75 }}>{g.blurb}</p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: 12,
              }}
            >
              {items.map((c) => {
                const sw = colorLevelSwatch(c.name);
                return (
                  <div
                    key={c.name}
                    className="theme-sidebar-panel"
                    style={{
                      borderRadius: 12,
                      padding: 14,
                      border: "1px solid var(--border)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                      <div style={{ fontWeight: 1000 }}>{c.name}</div>
                      {c.strength != null && (
                        <div style={{ fontSize: 11, opacity: 0.7 }}>{c.strength}x · bet {c.strength * 2} T$</div>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div
                        className={`lvlSwatch ${colorLevelSwatchClass(c.name, c.animated)}`}
                        style={{
                          ["--lvl" as string]: sw,
                          width: 120,
                          height: 72,
                          borderRadius: 8,
                          flexShrink: 0,
                        }}
                        title={c.name}
                      />
                      <div
                        className={`lvlSwatch tgGradeBelt ${colorLevelSwatchClass(c.name, c.animated)}`}
                        style={{ ["--lvl" as string]: sw }}
                        title="Profile belt size"
                      />
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>{c.note}</div>
                    {c.karmaNeeded != null && (
                      <div style={{ fontSize: 11, opacity: 0.65 }}>
                        {c.karmaNeeded} karma · {c.priceT} R$
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
