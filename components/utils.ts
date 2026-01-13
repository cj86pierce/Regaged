function colorToFilter(hex: string) {
  // TEMP SIMPLE VERSION (works well for MVP)
  // Converts grayscale base → color
  return `
    brightness(0)
    saturate(100%)
    invert(1)
    sepia(1)
    saturate(10000%)
    hue-rotate(${hexToHue(hex)}deg)
  `;
}

function hexToHue(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;

  if (max !== min) {
    if (max === r) h = (g - b) / (max - min);
    else if (max === g) h = 2 + (b - r) / (max - min);
    else h = 4 + (r - g) / (max - min);
    h *= 60;
  }

  return Math.round(h);
}
