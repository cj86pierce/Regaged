/**
 * Generate additional Tengaged-style avatar PNGs (200x230, tintable grayscale).
 * Run: node scripts/generate-avatar-parts.mjs
 */
import fs from "fs";
import path from "path";
import { PNG } from "pngjs";

const W = 200;
const H = 230;
const FILL = [191, 191, 191, 255];
const FILL_SHIRT = [181, 181, 181, 255];
const DARK = [64, 64, 64, 255];
const WHITE = [255, 255, 255, 255];
const CLEAR = [0, 0, 0, 0];

function blank() {
  const png = new PNG({ width: W, height: H, colorType: 6 });
  png.data.fill(0);
  return png;
}

function set(png, x, y, rgba) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (W * y + x) << 2;
  // force-write for opaque or fully transparent (cutouts)
  if (rgba[3] <= 1 || rgba[3] >= 252) {
    png.data[i] = rgba[0];
    png.data[i + 1] = rgba[1];
    png.data[i + 2] = rgba[2];
    png.data[i + 3] = rgba[3];
    return;
  }
  // soft alpha blend over existing
  const a = rgba[3] / 255;
  const oa = png.data[i + 3] / 255;
  const outA = a + oa * (1 - a);
  if (outA <= 0) return;
  png.data[i] = Math.round((rgba[0] * a + png.data[i] * oa * (1 - a)) / outA);
  png.data[i + 1] = Math.round((rgba[1] * a + png.data[i + 1] * oa * (1 - a)) / outA);
  png.data[i + 2] = Math.round((rgba[2] * a + png.data[i + 2] * oa * (1 - a)) / outA);
  png.data[i + 3] = Math.round(outA * 255);
}

function fillRect(png, x0, y0, x1, y1, rgba) {
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
    for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) set(png, x, y, rgba);
  }
}

function fillEllipse(png, cx, cy, rx, ry, rgba) {
  const x0 = Math.floor(cx - rx - 1);
  const x1 = Math.ceil(cx + rx + 1);
  const y0 = Math.floor(cy - ry - 1);
  const y1 = Math.ceil(cy + ry + 1);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      const d = nx * nx + ny * ny;
      if (d <= 1) {
        const edge = Math.max(0, 1 - (Math.sqrt(d) - 0.92) / 0.08);
        const a = d > 0.85 ? Math.round(rgba[3] * Math.min(1, edge)) : rgba[3];
        set(png, x, y, [rgba[0], rgba[1], rgba[2], a]);
      }
    }
  }
}

function clearEllipse(png, cx, cy, rx, ry) {
  fillEllipse(png, cx, cy, rx, ry, CLEAR);
}

function fillCircle(png, cx, cy, r, rgba) {
  fillEllipse(png, cx, cy, r, r, rgba);
}

function fillPolygon(png, points, rgba) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const minX = Math.floor(Math.min(...xs));
  const maxX = Math.ceil(Math.max(...xs));
  const minY = Math.floor(Math.min(...ys));
  const maxY = Math.ceil(Math.max(...ys));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (pointInPoly(x + 0.5, y + 0.5, points)) set(png, x, y, rgba);
    }
  }
}

function pointInPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0],
      yi = pts[i][1];
    const xj = pts[j][0],
      yj = pts[j][1];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 0.00001) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function strokePolyline(png, points, rgba, thickness = 2) {
  for (let i = 0; i < points.length - 1; i++) {
    strokeLine(png, points[i][0], points[i][1], points[i + 1][0], points[i + 1][1], rgba, thickness);
  }
}

function strokeLine(png, x0, y0, x1, y1, rgba, thickness = 2) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const steps = Math.ceil(len * 2);
  const r = thickness / 2;
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    fillCircle(png, x0 + dx * t, y0 + dy * t, r, rgba);
  }
}

function save(png, rel) {
  const out = path.join(process.cwd(), rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, PNG.sync.write(png));
  console.log("wrote", rel);
}

function loadPng(rel) {
  return PNG.sync.read(fs.readFileSync(path.join(process.cwd(), rel)));
}

/** Clone an existing shirt silhouette, recolored to a flat tintable fill. */
function cloneShirtMask(srcRel, rgba = FILL_SHIRT) {
  const src = loadPng(srcRel);
  const png = blank();
  for (let i = 0; i < src.data.length; i += 4) {
    if (src.data[i + 3] > 10) {
      png.data[i] = rgba[0];
      png.data[i + 1] = rgba[1];
      png.data[i + 2] = rgba[2];
      png.data[i + 3] = src.data[i + 3];
    }
  }
  return png;
}

/** Punch a crew-neck hole so the body neck shows through. */
function cutCrewNeck(png, { top = 148, depth = 168, halfW = 14 } = {}) {
  const h = depth - top;
  for (let y = top; y <= depth; y++) {
    const t = (y - top) / Math.max(1, h);
    // slightly wider toward bottom, rounded tip
    const round = t > 0.7 ? Math.sqrt(Math.max(0, 1 - ((t - 0.7) / 0.3) ** 2)) : 1;
    const hw = (halfW + t * 3) * round;
    for (let x = Math.floor(100 - hw); x <= Math.ceil(100 + hw); x++) {
      set(png, x, y, CLEAR);
    }
  }
}

/** Keep only pixels that exist on a reference shirt mask (fix stripes/details). */
function maskToShirt(png, srcRel) {
  const src = loadPng(srcRel);
  for (let i = 0; i < png.data.length; i += 4) {
    if (src.data[i + 3] <= 10) {
      png.data[i] = 0;
      png.data[i + 1] = 0;
      png.data[i + 2] = 0;
      png.data[i + 3] = 0;
    }
  }
}

// ---------- shirts ----------
function shirt07_turtleneck() {
  const png = cloneShirtMask("public/avatars/shirts/shirt_04_base.png");
  // extend collar up the neck (covers skin intentionally)
  for (let y = 140; y <= 154; y++) {
    const t = (154 - y) / 14;
    const half = Math.round(12 + t * 2);
    for (let x = 100 - half; x <= 100 + half; x++) set(png, x, y, FILL_SHIRT);
  }
  strokeLine(png, 88, 146, 112, 146, DARK, 1.2);
  save(png, "public/avatars/shirts/shirt_07_base.png");
}

function shirt08_hoodie() {
  // Open-top neckline cutout (like a garment scoop), NOT a closed hole ring
  const png = cloneShirtMask("public/avatars/shirts/shirt_02_base.png");
  openScoop(png, 155, 176, 17);

  // Hood folds on left/right of scoop only
  fillPolygon(png, [[62, 155], [83, 155], [85, 170], [76, 176], [64, 166]], FILL_SHIRT);
  fillPolygon(png, [[138, 155], [117, 155], [115, 170], [124, 176], [136, 166]], FILL_SHIRT);
  openScoop(png, 155, 176, 17);

  // soft inner rim along scoop
  strokePolyline(png, [[83, 156], [84, 168], [100, 176], [116, 168], [117, 156]], DARK, 1.2);

  // kangaroo pocket as outline, not a solid dark slab
  strokePolyline(
    png,
    [
      [80, 186],
      [120, 186],
      [118, 206],
      [82, 206],
      [80, 186],
    ],
    DARK,
    1.6
  );
  strokeLine(png, 100, 186, 100, 206, DARK, 1);
  // drawstrings
  strokeLine(png, 86, 176, 88, 192, DARK, 1.3);
  strokeLine(png, 114, 176, 112, 192, DARK, 1.3);
  save(png, "public/avatars/shirts/shirt_08_base.png");
}

function shirt09_tank() {
  const png = cloneShirtMask("public/avatars/shirts/shirt_03_base.png");
  openScoop(png, 155, 178, 16);
  // straps up to collarbone
  for (let y = 148; y <= 160; y++) {
    for (let x = 66; x <= 78; x++) set(png, x, y, FILL_SHIRT);
    for (let x = 122; x <= 134; x++) set(png, x, y, FILL_SHIRT);
  }
  openScoop(png, 155, 178, 16);
  save(png, "public/avatars/shirts/shirt_09_base.png");
}

function shirt10_stripes() {
  const png = cloneShirtMask("public/avatars/shirts/shirt_02_base.png");
  for (let y = 168; y < 228; y += 9) {
    for (let x = 0; x < W; x++) {
      const i = (W * y + x) << 2;
      if (png.data[i + 3] > 10) set(png, x, y, DARK);
      if (png.data[i + 3] > 10 && y + 1 < H) {
        const j = (W * (y + 1) + x) << 2;
        if (png.data[j + 3] > 10) set(png, x, y + 1, DARK);
      }
    }
  }
  save(png, "public/avatars/shirts/shirt_10_base.png");
}

function shirt11_vneck() {
  const png = cloneShirtMask("public/avatars/shirts/shirt_04_base.png");
  // V cutout from neck into chest
  fillPolygon(
    png,
    [
      [86, 148],
      [114, 148],
      [100, 182],
    ],
    CLEAR
  );
  strokePolyline(png, [[86, 150], [100, 180], [114, 150]], DARK, 1.4);
  save(png, "public/avatars/shirts/shirt_11_base.png");
}

function shirt12_buttonup() {
  const png = cloneShirtMask("public/avatars/shirts/shirt_04_base.png");
  openScoop(png, 148, 162, 10);
  // collar flaps
  fillPolygon(png, [[78, 150], [98, 158], [88, 166], [72, 156]], WHITE);
  fillPolygon(png, [[122, 150], [102, 158], [112, 166], [128, 156]], WHITE);
  openScoop(png, 148, 162, 10);
  // buttons + placket on fabric
  for (const y of [172, 186, 200, 214]) {
    const i = (W * y + 100) << 2;
    if (png.data[i + 3] > 10) fillCircle(png, 100, y, 2.2, DARK);
  }
  for (let y = 164; y <= 228; y++) {
    if (png.data[((W * y + 100) << 2) + 3] > 10) set(png, 100, y, DARK);
  }
  save(png, "public/avatars/shirts/shirt_12_base.png");
}

function openScoop(png, cutTop, cutBottom, cutHalf) {
  for (let y = cutTop; y <= cutBottom; y++) {
    const t = (y - cutTop) / Math.max(1, cutBottom - cutTop);
    const round = t < 0.55 ? 1 : Math.sqrt(Math.max(0, 1 - ((t - 0.55) / 0.45) ** 2));
    const hw = cutHalf * round;
    for (let x = Math.floor(100 - hw); x <= Math.ceil(100 + hw); x++) set(png, x, y, CLEAR);
  }
}

function shirt13_polo() {
  const png = cloneShirtMask("public/avatars/shirts/shirt_02_base.png");
  openScoop(png, 155, 168, 12);
  // collar points
  fillPolygon(png, [[80, 155], [98, 162], [88, 170], [74, 160]], WHITE);
  fillPolygon(png, [[120, 155], [102, 162], [112, 170], [126, 160]], WHITE);
  // two buttons
  fillCircle(png, 100, 172, 2, DARK);
  fillCircle(png, 100, 182, 2, DARK);
  save(png, "public/avatars/shirts/shirt_13_base.png");
}

function shirt14_starTee() {
  const png = cloneShirtMask("public/avatars/shirts/shirt_02_base.png");
  // 5-point star on chest
  const cx = 100,
    cy = 188,
    r = 12;
  const pts = [];
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    const b = a + Math.PI / 5;
    pts.push([cx + Math.cos(b) * (r * 0.42), cy + Math.sin(b) * (r * 0.42)]);
  }
  fillPolygon(png, pts, DARK);
  save(png, "public/avatars/shirts/shirt_14_base.png");
}

function shirt15_zipJacket() {
  const png = cloneShirtMask("public/avatars/shirts/shirt_04_base.png");
  openScoop(png, 148, 164, 11);
  // zipper on fabric only
  for (let y = 164; y <= 228; y++) {
    const i = (W * y + 100) << 2;
    if (png.data[i + 3] > 10) {
      set(png, 100, y, DARK);
      if (y % 5 === 0) {
        if (png.data[((W * y + 98) << 2) + 3] > 10) set(png, 98, y, WHITE);
        if (png.data[((W * y + 102) << 2) + 3] > 10) set(png, 102, y, WHITE);
      }
    }
  }
  // collar tabs hugging scoop
  fillPolygon(png, [[78, 150], [96, 157], [88, 164], [74, 156]], FILL_SHIRT);
  fillPolygon(png, [[122, 150], [104, 157], [112, 164], [126, 156]], FILL_SHIRT);
  openScoop(png, 148, 164, 11);
  save(png, "public/avatars/shirts/shirt_15_base.png");
}

function shirt16_overalls() {
  const png = cloneShirtMask("public/avatars/shirts/shirt_03_base.png");
  openScoop(png, 155, 174, 15);
  // straps
  for (let y = 148; y <= 164; y++) {
    for (let x = 70; x <= 80; x++) set(png, x, y, FILL_SHIRT);
    for (let x = 120; x <= 130; x++) set(png, x, y, FILL_SHIRT);
  }
  openScoop(png, 155, 174, 15);
  // bib pocket outline
  strokePolyline(png, [[84, 176], [116, 176], [114, 196], [86, 196], [84, 176]], DARK, 1.5);
  fillCircle(png, 75, 158, 2.2, DARK);
  fillCircle(png, 125, 158, 2.2, DARK);
  save(png, "public/avatars/shirts/shirt_16_base.png");
}

// ---------- eyes ----------
function makeEyePair(name, { irisRx, irisRy, whiteRx, whiteRy, irisCy = 94, whiteCy = 93, gap = 30, slant = 0 }) {
  const iris = blank();
  const white = blank();
  const lx = 100 - gap / 2;
  const rx = 100 + gap / 2;
  for (const cx of [lx, rx]) {
    fillEllipse(white, cx, whiteCy + slant * (cx < 100 ? -1 : 1), whiteRx, whiteRy, WHITE);
    fillEllipse(iris, cx, irisCy + slant * (cx < 100 ? -1 : 1), irisRx, irisRy, FILL);
  }
  save(iris, `public/avatars/eyes/${name}.png`);
  save(white, `public/avatars/eyes/${name}_white.png`);
}

function eyes07_sleepy() {
  const iris = blank();
  const white = blank();
  for (const cx of [85, 115]) {
    // flat white lids
    fillEllipse(white, cx, 95, 10, 5, WHITE);
    // thin iris slits
    fillEllipse(iris, cx, 96, 7, 2.2, FILL);
  }
  save(iris, "public/avatars/eyes/eyes_07.png");
  save(white, "public/avatars/eyes/eyes_07_white.png");
}

function eyes08_wide() {
  makeEyePair("eyes_08", { irisRx: 5.5, irisRy: 6.5, whiteRx: 9, whiteRy: 10, irisCy: 94, whiteCy: 93, gap: 32 });
}

function eyes09_almond() {
  const iris = blank();
  const white = blank();
  // left
  fillEllipse(white, 84, 93, 11, 6, WHITE);
  fillEllipse(iris, 85, 94, 5, 3.5, FILL);
  // right
  fillEllipse(white, 116, 93, 11, 6, WHITE);
  fillEllipse(iris, 115, 94, 5, 3.5, FILL);
  save(iris, "public/avatars/eyes/eyes_09.png");
  save(white, "public/avatars/eyes/eyes_09_white.png");
}

function eyes10_happy() {
  const iris = blank();
  const white = blank();
  for (const cx of [85, 115]) {
    // crescent whites
    fillEllipse(white, cx, 95, 9, 5, WHITE);
    clearEllipse(white, cx, 98, 9, 4);
    // upturned iris arcs
    fillEllipse(iris, cx, 94, 7, 3, FILL);
    clearEllipse(iris, cx, 96.5, 7, 2.5);
  }
  save(iris, "public/avatars/eyes/eyes_10.png");
  save(white, "public/avatars/eyes/eyes_10_white.png");
}

function eyes11_wink() {
  const iris = blank();
  const white = blank();
  // left open
  fillEllipse(white, 85, 93, 8, 7, WHITE);
  fillEllipse(iris, 85, 94, 4.5, 4.5, FILL);
  // right wink — no white, just the closed lid line
  strokePolyline(iris, [[108, 95], [115, 97], [122, 95]], FILL, 2.4);
  save(iris, "public/avatars/eyes/eyes_11.png");
  save(white, "public/avatars/eyes/eyes_11_white.png");
}

function eyes12_sideGlance() {
  const iris = blank();
  const white = blank();
  for (const cx of [85, 115]) {
    fillEllipse(white, cx, 93, 9, 7, WHITE);
    // iris shifted right
    fillEllipse(iris, cx + 2.5, 94, 4, 4.5, FILL);
  }
  save(iris, "public/avatars/eyes/eyes_12.png");
  save(white, "public/avatars/eyes/eyes_12_white.png");
}

// ---------- mouths ----------
function mouth07_grin() {
  const png = blank();
  fillEllipse(png, 100, 124, 16, 8, FILL_SHIRT);
  clearEllipse(png, 100, 120, 16, 7);
  // teeth bar
  fillRect(png, 90, 122, 110, 126, WHITE);
  strokeLine(png, 88, 122, 112, 122, DARK, 1.2);
  save(png, "public/avatars/mouth/mouth_07.png");
}

function mouth08_o() {
  const png = blank();
  fillEllipse(png, 100, 124, 7, 9, FILL_SHIRT);
  fillEllipse(png, 100, 124, 4, 5.5, DARK);
  save(png, "public/avatars/mouth/mouth_08.png");
}

function mouth09_smirk() {
  const png = blank();
  strokePolyline(
    png,
    [
      [88, 126],
      [96, 124],
      [104, 123],
      [112, 121],
    ],
    FILL_SHIRT,
    2.4
  );
  strokePolyline(
    png,
    [
      [88, 127],
      [96, 125.5],
      [104, 124.5],
      [112, 122.5],
    ],
    DARK,
    1
  );
  save(png, "public/avatars/mouth/mouth_09.png");
}

function mouth10_frown() {
  const png = blank();
  fillEllipse(png, 100, 128, 12, 6, FILL_SHIRT);
  clearEllipse(png, 100, 131, 12, 5);
  strokePolyline(
    png,
    [
      [88, 126],
      [100, 130],
      [112, 126],
    ],
    DARK,
    1.3
  );
  save(png, "public/avatars/mouth/mouth_10.png");
}

function mouth11_tongue() {
  const png = blank();
  fillEllipse(png, 100, 124, 12, 7, FILL_SHIRT);
  clearEllipse(png, 100, 120, 12, 5);
  // tongue
  fillEllipse(png, 100, 128, 6, 5, DARK);
  save(png, "public/avatars/mouth/mouth_11.png");
}

function mouth12_pout() {
  const png = blank();
  fillEllipse(png, 100, 124, 8, 6, FILL_SHIRT);
  fillEllipse(png, 100, 124, 4, 3, DARK);
  save(png, "public/avatars/mouth/mouth_12.png");
}

// ---------- hair (built from original hand-drawn bases so they fit the head) ----------
function cloneLayer(srcRel) {
  const src = loadPng(srcRel);
  const png = blank();
  src.data.copy(png.data);
  return png;
}

function clearRect(png, x0, y0, x1, y1) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(png, x, y, CLEAR);
}

/** Keep only pixels above a soft horizontal cut, with slight curve. */
function trimBelow(png, baseY, curve = 0) {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const cut = baseY + Math.sin(((x - 40) / 120) * Math.PI) * curve;
      if (y > cut) set(png, x, y, CLEAR);
    }
  }
}

/** Shift opaque pixels by (dx, dy). */
function shiftLayer(png, dx, dy) {
  const src = Buffer.from(png.data);
  png.data.fill(0);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (W * y + x) << 2;
      if (src[i + 3] <= 10) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = (W * ny + nx) << 2;
      png.data[j] = src[i];
      png.data[j + 1] = src[i + 1];
      png.data[j + 2] = src[i + 2];
      png.data[j + 3] = src[i + 3];
    }
  }
}

function paintIfEmpty(png, x, y, rgba) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (W * y + x) << 2;
  if (png.data[i + 3] > 10) return;
  set(png, x, y, rgba);
}

function hair_m_04_spiky() {
  // Start from short messy — already fits head + fringe + sideburns
  const png = cloneLayer("public/avatars/hair/hair_m_02.png");
  // Grow spikes up from the existing crown (connected, not floating triangles)
  const spikes = [
    [68, 48, 60, 24],
    [84, 44, 78, 18],
    [100, 42, 100, 14],
    [116, 44, 122, 18],
    [132, 48, 140, 24],
  ];
  for (const [bx, by, tx, ty] of spikes) {
    // thick triangle rooted in existing hair
    fillPolygon(png, [[bx - 7, by + 6], [bx + 7, by + 6], [tx, ty]], FILL);
    // fill bridge so spike merges into crown
    fillPolygon(png, [[bx - 6, by + 10], [bx + 6, by + 10], [bx, by - 2]], FILL);
  }
  save(png, "public/avatars/hair/hair_m_04.png");
}

function hair_m_05_buzz() {
  // Thin even cap from short messy — cleaner than trimming the side-sweep
  const png = cloneLayer("public/avatars/hair/hair_m_02.png");
  // keep only upper dome + tiny sideburns
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (W * y + x) << 2;
      if (png.data[i + 3] <= 10) continue;
      const keepSide = (x <= 56 || x >= 144) && y <= 88;
      const keepTop = y <= 70;
      if (!(keepTop || keepSide)) set(png, x, y, CLEAR);
    }
  }
  // clean hard rim under the buzz (no random speckles)
  for (let y = 71; y < H; y++) {
    for (let x = 58; x <= 142; x++) set(png, x, y, CLEAR);
  }
  save(png, "public/avatars/hair/hair_m_05.png");
}

function hair_m_06_pompadour() {
  // Tall front volume on short messy base — keep original fringe/sideburns
  const png = cloneLayer("public/avatars/hair/hair_m_02.png");
  const base = loadPng("public/avatars/hair/hair_m_02.png");
  // pompadour mound on top
  fillEllipse(png, 100, 40, 24, 16, FILL);
  fillEllipse(png, 92, 46, 22, 14, FILL);
  fillEllipse(png, 100, 50, 30, 12, FILL);
  // restore original face window / fringe exactly (don't let mound cover face)
  for (let y = 70; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (W * y + x) << 2;
      png.data[i] = base.data[i];
      png.data[i + 1] = base.data[i + 1];
      png.data[i + 2] = base.data[i + 2];
      png.data[i + 3] = base.data[i + 3];
    }
  }
  save(png, "public/avatars/hair/hair_m_06.png");
}

function hair_f_04_bun() {
  // Long straight base, shorten + add bun
  const png = cloneLayer("public/avatars/hair/hair_f_01.png");
  trimBelow(png, 138, 6);
  // bun sitting on crown, connected
  fillCircle(png, 100, 34, 14, FILL);
  fillEllipse(png, 100, 44, 16, 8, FILL);
  // soft connection into parting
  fillEllipse(png, 100, 48, 12, 6, FILL);
  // tiny part mark on bun base
  strokeLine(png, 100, 42, 100, 52, DARK, 1);
  save(png, "public/avatars/hair/hair_f_04.png");
}

function hair_f_05_bob() {
  // Chin-length bob from long straight
  const png = cloneLayer("public/avatars/hair/hair_f_01.png");
  trimBelow(png, 148, 10);
  // bangs fringe across forehead (keep face open below)
  for (let x = 62; x <= 138; x++) {
    for (let y = 62; y <= 78; y++) {
      const edge = 70 + Math.sin(((x - 62) / 76) * Math.PI) * 4;
      if (y <= edge) paintIfEmpty(png, x, y, FILL);
    }
  }
  // open eyes area under bangs
  for (let y = 78; y <= 130; y++) {
    for (let x = 70; x <= 130; x++) {
      // leave side falls; clear center face
      if (x >= 72 && x <= 128) {
        const i = (W * y + x) << 2;
        // only clear if this was bangs overflow / face — sides of f_01 are ~38-60 and 145-166
        if (x >= 74 && x <= 126) set(png, x, y, CLEAR);
      }
    }
  }
  // restore side falls that got cleared (clone sides from original)
  const src = loadPng("public/avatars/hair/hair_f_01.png");
  for (let y = 78; y <= 148; y++) {
    for (let x = 0; x < W; x++) {
      if (x > 70 && x < 130) continue;
      const i = (W * y + x) << 2;
      if (src.data[i + 3] > 10 && y <= 148 + Math.sin(((x - 40) / 120) * Math.PI) * 10) {
        png.data[i] = src.data[i];
        png.data[i + 1] = src.data[i + 1];
        png.data[i + 2] = src.data[i + 2];
        png.data[i + 3] = src.data[i + 3];
      }
    }
  }
  trimBelow(png, 148, 10);
  save(png, "public/avatars/hair/hair_f_05.png");
}

function hair_f_06_pigtails() {
  // Crown from long straight, replace hanging hair with pigtails
  const png = cloneLayer("public/avatars/hair/hair_f_01.png");
  // remove long falls below temples
  for (let y = 90; y < H; y++) {
    for (let x = 0; x < W; x++) set(png, x, y, CLEAR);
  }
  // keep a bit more crown/side at ear level
  const src = loadPng("public/avatars/hair/hair_f_01.png");
  for (let y = 70; y <= 100; y++) {
    for (let x = 0; x < W; x++) {
      const i = (W * y + x) << 2;
      if (src.data[i + 3] <= 10) continue;
      // only outer sides
      if (x <= 62 || x >= 138) {
        png.data[i] = src.data[i];
        png.data[i + 1] = src.data[i + 1];
        png.data[i + 2] = src.data[i + 2];
        png.data[i + 3] = src.data[i + 3];
      }
    }
  }
  // connected pigtail masses from temples
  fillEllipse(png, 52, 95, 14, 18, FILL);
  fillEllipse(png, 148, 95, 14, 18, FILL);
  fillEllipse(png, 48, 125, 15, 26, FILL);
  fillEllipse(png, 152, 125, 15, 26, FILL);
  // hair ties
  fillEllipse(png, 52, 108, 6, 4, DARK);
  fillEllipse(png, 148, 108, 6, 4, DARK);
  // bridge ties into crown
  fillPolygon(png, [[44, 78], [60, 72], [58, 95], [42, 92]], FILL);
  fillPolygon(png, [[156, 78], [140, 72], [142, 95], [158, 92]], FILL);
  save(png, "public/avatars/hair/hair_f_06.png");
}

// ---------- accessories ----------
function accessory02_necklace() {
  const png = blank();
  // chain arc under chin
  for (let a = Math.PI * 0.15; a <= Math.PI * 0.85; a += 0.02) {
    const x = 100 + Math.cos(a) * 28;
    const y = 138 + Math.sin(a) * 22;
    fillCircle(png, x, y, 1.6, FILL);
  }
  // pendant
  fillPolygon(png, [[100, 155], [108, 168], [100, 178], [92, 168]], FILL);
  strokePolyline(png, [[100, 155], [108, 168], [100, 178], [92, 168], [100, 155]], DARK, 1);
  save(png, "public/avatars/accessories/accessory_02.png");
}

function accessory03_headphones() {
  const png = blank();
  // headband
  for (let a = Math.PI; a <= Math.PI * 2; a += 0.015) {
    const x = 100 + Math.cos(a) * 54;
    const y = 90 + Math.sin(a) * 48;
    if (y < 95) fillCircle(png, x, y, 3.2, FILL);
  }
  // ear cups
  fillEllipse(png, 48, 95, 12, 16, FILL);
  fillEllipse(png, 152, 95, 12, 16, FILL);
  fillEllipse(png, 48, 95, 7, 10, DARK);
  fillEllipse(png, 152, 95, 7, 10, DARK);
  save(png, "public/avatars/accessories/accessory_03.png");
}

function accessory04_bowtie() {
  const png = blank();
  fillPolygon(png, [[78, 152], [98, 158], [78, 164]], FILL);
  fillPolygon(png, [[122, 152], [102, 158], [122, 164]], FILL);
  fillRect(png, 96, 154, 104, 162, DARK);
  save(png, "public/avatars/accessories/accessory_04.png");
}

function accessory05_earrings() {
  const png = blank();
  // left earring
  fillCircle(png, 48, 110, 3.5, FILL);
  fillCircle(png, 48, 118, 2.2, FILL);
  strokeLine(png, 48, 113, 48, 116, DARK, 1);
  // right earring
  fillCircle(png, 152, 110, 3.5, FILL);
  fillCircle(png, 152, 118, 2.2, FILL);
  strokeLine(png, 152, 113, 152, 116, DARK, 1);
  save(png, "public/avatars/accessories/accessory_05.png");
}

function accessory06_scarf() {
  const png = blank();
  // thin wrap under chin / on neck
  for (let a = Math.PI * 0.2; a <= Math.PI * 0.8; a += 0.015) {
    const x = 100 + Math.cos(a) * 26;
    const y = 142 + Math.sin(a) * 16;
    fillCircle(png, x, y, 3.2, FILL);
  }
  // hanging ends
  fillPolygon(png, [[90, 154], [100, 156], [97, 188], [86, 184]], FILL);
  fillPolygon(png, [[110, 154], [100, 156], [107, 192], [118, 186]], FILL);
  strokeLine(png, 92, 168, 94, 182, DARK, 1);
  strokeLine(png, 110, 170, 112, 186, DARK, 1);
  save(png, "public/avatars/accessories/accessory_06.png");
}

function accessory07_choker() {
  const png = blank();
  for (let a = Math.PI * 0.25; a <= Math.PI * 0.75; a += 0.02) {
    const x = 100 + Math.cos(a) * 18;
    const y = 144 + Math.sin(a) * 10;
    fillCircle(png, x, y, 2.2, FILL);
  }
  fillCircle(png, 100, 152, 2.4, DARK);
  save(png, "public/avatars/accessories/accessory_07.png");
}

function accessory08_cap() {
  // sits on head like short hair crown + forward brim
  const png = blank();
  fillEllipse(png, 100, 56, 44, 20, FILL);
  // flat bottom of crown
  for (let y = 68; y <= 74; y++) {
    for (let x = 56; x <= 144; x++) {
      const dx = (x - 100) / 44;
      if (dx * dx <= 1) set(png, x, y, FILL);
    }
  }
  // brim forward/right
  fillEllipse(png, 122, 74, 30, 7, FILL);
  strokeLine(png, 62, 72, 148, 74, DARK, 1.3);
  // tiny button on top
  fillCircle(png, 100, 42, 2.5, DARK);
  save(png, "public/avatars/accessories/accessory_08.png");
}

function main() {
  shirt07_turtleneck();
  shirt08_hoodie();
  shirt09_tank();
  shirt10_stripes();
  shirt11_vneck();
  shirt12_buttonup();
  shirt13_polo();
  shirt14_starTee();
  shirt15_zipJacket();
  shirt16_overalls();

  eyes07_sleepy();
  eyes08_wide();
  eyes09_almond();
  eyes10_happy();
  eyes11_wink();
  eyes12_sideGlance();

  mouth07_grin();
  mouth08_o();
  mouth09_smirk();
  mouth10_frown();
  mouth11_tongue();
  mouth12_pout();

  hair_m_04_spiky();
  hair_m_05_buzz();
  hair_m_06_pompadour();
  hair_f_04_bun();
  hair_f_05_bob();
  hair_f_06_pigtails();

  accessory02_necklace();
  accessory03_headphones();
  accessory04_bowtie();
  accessory05_earrings();
  accessory06_scarf();
  accessory07_choker();
  accessory08_cap();

  console.log("done");
}

main();
