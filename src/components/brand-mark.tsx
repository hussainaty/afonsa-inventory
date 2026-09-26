/** Stacked-boxes mark, rendered by next/og for icons (inline styles only). */
export function BrandMark({ size, padding }: { size: number; padding: number }) {
  const inner = size - padding * 2;
  const box = inner / 2.2;
  const gap = inner * 0.06;
  const boxStyle = { width: box, height: box, borderRadius: box * 0.18, background: "#ffffff" };
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0f766e",
        borderRadius: padding > size * 0.15 ? 0 : size * 0.22,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap }}>
        <div style={{ ...boxStyle, opacity: 0.95 }} />
        <div style={{ display: "flex", gap }}>
          <div style={{ ...boxStyle, opacity: 0.75 }} />
          <div style={{ ...boxStyle, opacity: 0.55 }} />
        </div>
      </div>
    </div>
  );
}
