/**
 * Generate additional Tengaged-style avatar PNGs (200x230, tintable grayscale).
 * Run: node scripts/generate-avatar-parts.mjs
 */
import fs from "fs";
import path from "path";
import { PNG } from "pngjs";

const W = 200;
const H = 230;
// Tintable grays (lighter = brighter after color tint)
const FILL = [191, 191, 191, 255];
const FILL_SHIRT = [181, 181, 181, 255];
const LIGHT = [220, 220, 220, 255];
const MID = [140, 140, 140, 255];
const SHADOW = [100, 100, 100, 255];
const DARK = [64, 64, 64, 255];
const WHITE = [255, 255, 255, 255];
const CLEAR = [0, 0, 0, 0];

function gray(v, a = 255) {
  return [v, v, v, a];
}

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
  for (let y = 140; y <= 154; y++) {
    const t = (154 - y) / 14;
    const half = Math.round(12 + t * 2);
    for (let x = 100 - half; x <= 100 + half; x++) set(png, x, y, FILL_SHIRT);
  }
  // ribbing bands
  strokeLine(png, 88, 144, 112, 144, MID, 1.2);
  strokeLine(png, 88, 148, 112, 148, MID, 1.2);
  strokeLine(png, 90, 152, 110, 152, SHADOW, 1);
  save(png, "public/avatars/shirts/shirt_07_base.png");
}

function shirt08_hoodie() {
  const png = cloneShirtMask("public/avatars/shirts/shirt_02_base.png");
  openScoop(png, 155, 176, 17);

  // hood folds (slightly darker lining on inner edge)
  fillPolygon(png, [[62, 155], [83, 155], [85, 170], [76, 176], [64, 166]], FILL_SHIRT);
  fillPolygon(png, [[138, 155], [117, 155], [115, 170], [124, 176], [136, 166]], FILL_SHIRT);
  fillPolygon(png, [[80, 156], [84, 168], [78, 174], [74, 164]], MID);
  fillPolygon(png, [[120, 156], [116, 168], [122, 174], [126, 164]], MID);
  openScoop(png, 155, 176, 17);
  strokePolyline(png, [[83, 156], [84, 168], [100, 176], [116, 168], [117, 156]], SHADOW, 1.2);

  // kangaroo pocket — mid fill + dark outline
  fillPolygon(png, [[80, 186], [120, 186], [118, 206], [82, 206]], MID);
  strokePolyline(png, [[80, 186], [120, 186], [118, 206], [82, 206], [80, 186]], DARK, 1.4);
  strokeLine(png, 100, 186, 100, 206, SHADOW, 1);
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
  for (let y = 168; y < 228; y += 10) {
    for (let x = 0; x < W; x++) {
      if (png.data[((W * y + x) << 2) + 3] > 10) set(png, x, y, MID);
      if (y + 1 < H && png.data[((W * (y + 1) + x) << 2) + 3] > 10) set(png, x, y + 1, SHADOW);
    }
  }
  save(png, "public/avatars/shirts/shirt_10_base.png");
}

function shirt11_vneck() {
  // Use open-top tee so V isn't a hole punched through a filled collar
  const png = cloneShirtMask("public/avatars/shirts/shirt_02_base.png");
  fillPolygon(png, [[84, 155], [116, 155], [100, 186]], CLEAR);
  // collar edge shading
  strokePolyline(png, [[84, 156], [100, 184], [116, 156]], SHADOW, 1.6);
  strokePolyline(png, [[86, 156], [100, 180], [114, 156]], LIGHT, 1);
  save(png, "public/avatars/shirts/shirt_11_base.png");
}

function shirt12_buttonup() {
  const png = cloneShirtMask("public/avatars/shirts/shirt_04_base.png");
  openScoop(png, 148, 162, 10);
  fillPolygon(png, [[78, 150], [98, 158], [88, 166], [72, 156]], WHITE);
  fillPolygon(png, [[122, 150], [102, 158], [112, 166], [128, 156]], WHITE);
  // collar underside
  fillPolygon(png, [[84, 158], [96, 162], [90, 166]], MID);
  fillPolygon(png, [[116, 158], [104, 162], [110, 166]], MID);
  openScoop(png, 148, 162, 10);
  // placket strip
  for (let y = 164; y <= 228; y++) {
    if (png.data[((W * y + 100) << 2) + 3] > 10) {
      set(png, 99, y, MID);
      set(png, 100, y, LIGHT);
      set(png, 101, y, MID);
    }
  }
  for (const y of [172, 186, 200, 214]) {
    if (png.data[((W * y + 100) << 2) + 3] > 10) fillCircle(png, 100, y, 2.2, DARK);
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
  fillPolygon(png, [[80, 155], [98, 162], [88, 170], [74, 160]], WHITE);
  fillPolygon(png, [[120, 155], [102, 162], [112, 170], [126, 160]], WHITE);
  fillPolygon(png, [[84, 160], [94, 164], [88, 168]], MID);
  fillPolygon(png, [[116, 160], [106, 164], [112, 168]], MID);
  openScoop(png, 155, 168, 12);
  fillCircle(png, 100, 172, 2, DARK);
  fillCircle(png, 100, 182, 2, DARK);
  save(png, "public/avatars/shirts/shirt_13_base.png");
}

function shirt14_starTee() {
  const png = cloneShirtMask("public/avatars/shirts/shirt_02_base.png");
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
  fillPolygon(png, pts, MID);
  // star outline
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    strokeLine(png, a[0], a[1], b[0], b[1], DARK, 1);
  }
  save(png, "public/avatars/shirts/shirt_14_base.png");
}

function shirt15_zipJacket() {
  const png = cloneShirtMask("public/avatars/shirts/shirt_04_base.png");
  openScoop(png, 148, 164, 11);
  // panel shading left/right of zipper
  for (let y = 168; y <= 228; y++) {
    for (let x = 70; x <= 96; x++) {
      if (png.data[((W * y + x) << 2) + 3] > 10 && (x + y) % 7 === 0) set(png, x, y, MID);
    }
    for (let x = 104; x <= 130; x++) {
      if (png.data[((W * y + x) << 2) + 3] > 10 && (x + y) % 7 === 0) set(png, x, y, MID);
    }
  }
  for (let y = 164; y <= 228; y++) {
    if (png.data[((W * y + 100) << 2) + 3] > 10) {
      set(png, 99, y, SHADOW);
      set(png, 100, y, DARK);
      set(png, 101, y, SHADOW);
      if (y % 5 === 0) {
        if (png.data[((W * y + 97) << 2) + 3] > 10) set(png, 97, y, LIGHT);
        if (png.data[((W * y + 103) << 2) + 3] > 10) set(png, 103, y, LIGHT);
      }
    }
  }
  fillPolygon(png, [[78, 150], [96, 157], [88, 164], [74, 156]], MID);
  fillPolygon(png, [[122, 150], [104, 157], [112, 164], [126, 156]], MID);
  openScoop(png, 148, 164, 11);
  save(png, "public/avatars/shirts/shirt_15_base.png");
}

function shirt16_overalls() {
  const png = cloneShirtMask("public/avatars/shirts/shirt_03_base.png");
  openScoop(png, 155, 174, 15);
  for (let y = 148; y <= 164; y++) {
    for (let x = 70; x <= 80; x++) set(png, x, y, MID);
    for (let x = 120; x <= 130; x++) set(png, x, y, MID);
  }
  openScoop(png, 155, 174, 15);
  // solid bib pocket with shade
  fillPolygon(png, [[84, 176], [116, 176], [114, 196], [86, 196]], MID);
  strokePolyline(png, [[84, 176], [116, 176], [114, 196], [86, 196], [84, 176]], DARK, 1.4);
  fillCircle(png, 75, 158, 2.4, DARK);
  fillCircle(png, 125, 158, 2.4, DARK);
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
  fillRect(png, 90, 122, 110, 126, WHITE);
  strokeLine(png, 88, 122, 112, 122, DARK, 1.2);
  strokeLine(png, 100, 122, 100, 126, MID, 1);
  save(png, "public/avatars/mouth/mouth_07.png");
}

function mouth08_o() {
  const png = blank();
  fillEllipse(png, 100, 124, 7, 9, FILL_SHIRT);
  fillEllipse(png, 100, 124, 5, 6.5, MID);
  fillEllipse(png, 100, 124, 3.2, 4.2, DARK);
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

// ---------- hair: morph original hand-drawn pixels (no geometric blobs) ----------
function cloneLayer(srcRel) {
  const src = loadPng(srcRel);
  const png = blank();
  src.data.copy(png.data);
  return png;
}

function pix(png, x, y) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= W || y >= H) return [0, 0, 0, 0];
  const i = (W * y + x) << 2;
  return [png.data[i], png.data[i + 1], png.data[i + 2], png.data[i + 3]];
}

function topYAt(png, x) {
  for (let y = 0; y < H; y++) if (png.data[((W * y + x) << 2) + 3] > 12) return y;
  return -1;
}

function trimBelow(png, baseY, curve = 0) {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const cut = baseY + Math.sin(((x - 40) / 120) * Math.PI) * curve;
      if (y > cut) set(png, x, y, CLEAR);
    }
  }
}

/** Soften a hard cut edge by fading alpha on the last few rows. */
function softenBottom(png, fromY, toY) {
  for (let y = fromY; y <= toY; y++) {
    const t = (y - fromY) / Math.max(1, toY - fromY);
    for (let x = 0; x < W; x++) {
      const i = (W * y + x) << 2;
      if (png.data[i + 3] <= 10) continue;
      png.data[i + 3] = Math.round(png.data[i + 3] * (1 - t * 0.85));
    }
  }
}

function hair_m_04_spiky() {
  // Grow soft peaks from hair_m_02's real top edge (keeps fringe/sideburns/AA)
  const png = cloneLayer("public/avatars/hair/hair_m_02.png");
  const peaks = [
    { x: 70, h: 18, w: 9 },
    { x: 86, h: 24, w: 8 },
    { x: 100, h: 28, w: 9 },
    { x: 114, h: 24, w: 8 },
    { x: 130, h: 18, w: 9 },
  ];
  for (let x = 50; x <= 150; x++) {
    let lift = 0;
    for (const p of peaks) {
      const d = (x - p.x) / p.w;
      lift = Math.max(lift, p.h * Math.exp(-d * d));
    }
    lift = Math.round(lift);
    if (lift < 2) continue;
    const ty = topYAt(png, x);
    if (ty < 0) continue;
    for (let k = 0; k < lift; k++) {
      const srcY = Math.min(H - 1, ty + Math.min(4, Math.floor(k / 4)));
      const dstY = ty - lift + k;
      const [r, g, b, a] = pix(png, x, srcY);
      if (a <= 12) continue;
      // taper alpha near tip
      const tipT = k / lift;
      const aa = tipT < 0.2 ? Math.round(a * (tipT / 0.2)) : a;
      set(png, x, dstY, [r, g, b, aa]);
      // slight thickness
      if (aa > 40) {
        const [r2, g2, b2, a2] = pix(png, x, srcY + 1);
        if (a2 > 12) set(png, x, dstY + 1, [r2, g2, b2, Math.round(a2 * 0.7)]);
      }
    }
  }
  save(png, "public/avatars/hair/hair_m_04.png");
}

function hair_m_05_buzz() {
  // Clean short cap carved from m_02 (same AA/gray as originals)
  const png = cloneLayer("public/avatars/hair/hair_m_02.png");
  const cx = 100,
    cy = 58,
    rx = 50,
    ry = 24;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (W * y + x) << 2;
      if (png.data[i + 3] <= 10) continue;
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      const d = nx * nx + ny * ny;
      if (d > 1.05 || y > 72) {
        set(png, x, y, CLEAR);
      } else if (d > 0.82) {
        // soft rim
        const fade = 1 - (d - 0.82) / 0.23;
        png.data[i + 3] = Math.round(png.data[i + 3] * Math.max(0, fade));
      }
    }
  }
  // short temple fades only (not long sideburns)
  const src = loadPng("public/avatars/hair/hair_m_02.png");
  for (let y = 72; y <= 82; y++) {
    for (let x = 0; x < W; x++) {
      if (x > 54 && x < 146) continue;
      const i = (W * y + x) << 2;
      if (src.data[i + 3] > 12) {
        const fade = 1 - (y - 72) / 10;
        png.data[i] = src.data[i];
        png.data[i + 1] = src.data[i + 1];
        png.data[i + 2] = src.data[i + 2];
        png.data[i + 3] = Math.round(src.data[i + 3] * fade);
      }
    }
  }
  save(png, "public/avatars/hair/hair_m_05.png");
}

function hair_m_06_pompadour() {
  // Vertically stretch the crown of m_02 upward (real pixels, not ellipses)
  const base = cloneLayer("public/avatars/hair/hair_m_02.png");
  const png = cloneLayer("public/avatars/hair/hair_m_02.png");
  const y0 = 40,
    y1 = 70,
    factor = 1.75;
  const extra = Math.round((y1 - y0) * (factor - 1));
  // clear the stretch destination band
  for (let y = y0 - extra; y < y1; y++) {
    for (let x = 55; x <= 145; x++) set(png, x, y, CLEAR);
  }
  for (let y = y0 - extra; y < y1; y++) {
    const srcY = y0 + (y - (y0 - extra)) / factor;
    const sy0 = Math.floor(srcY);
    const sy1 = Math.min(H - 1, sy0 + 1);
    const t = srcY - sy0;
    for (let x = 55; x <= 145; x++) {
      // only rewrite crown region (leave sideburns of lower base later)
      const [r0, g0, b0, a0] = pix(base, x, sy0);
      const [r1, g1, b1, a1] = pix(base, x, sy1);
      if (a0 <= 12 && a1 <= 12) continue;
      const a = Math.round(a0 * (1 - t) + a1 * t);
      if (a <= 12) continue;
      const r = Math.round(r0 * (1 - t) + r1 * t);
      const g = Math.round(g0 * (1 - t) + g1 * t);
      const b = Math.round(b0 * (1 - t) + b1 * t);
      set(png, x, y, [r, g, b, a]);
    }
  }
  // restore original from fringe down (face window + sideburns)
  for (let y = 72; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (W * y + x) << 2;
      png.data[i] = base.data[i];
      png.data[i + 1] = base.data[i + 1];
      png.data[i + 2] = base.data[i + 2];
      png.data[i + 3] = base.data[i + 3];
    }
  }
  // subtle darker underside of pompadour for volume
  for (let y = 48; y <= 60; y++) {
    for (let x = 78; x <= 122; x++) {
      const i = (W * y + x) << 2;
      if (png.data[i + 3] > 200 && y > 54) {
        png.data[i] = Math.max(100, png.data[i] - 30);
        png.data[i + 1] = png.data[i];
        png.data[i + 2] = png.data[i];
      }
    }
  }
  save(png, "public/avatars/hair/hair_m_06.png");
}

function hair_f_04_bun() {
  // Shoulder-length f_01 + bun made by copying/scaling crown pixels upward
  const png = cloneLayer("public/avatars/hair/hair_f_01.png");
  trimBelow(png, 145, 10);
  softenBottom(png, 138, 148);
  const base = cloneLayer("public/avatars/hair/hair_f_01.png");
  // stamp a soft bun from crown samples
  for (let dy = -16; dy <= 10; dy++) {
    for (let dx = -16; dx <= 16; dx++) {
      const dist = Math.hypot(dx / 15, dy / 12);
      if (dist > 1) continue;
      const sx = 100 + Math.round(dx * 0.55);
      const sy = 56 + Math.round(dy * 0.35 + 4);
      const [r, g, b, a] = pix(base, sx, sy);
      if (a <= 12) continue;
      const aa = Math.round(a * Math.max(0, 1 - dist * dist));
      const dstX = 100 + dx;
      const dstY = 36 + dy;
      // prefer denser coverage; don't wipe darker part line entirely
      const curA = pix(png, dstX, dstY)[3];
      if (aa > curA) set(png, dstX, dstY, [r, g, b, aa]);
    }
  }
  // keep the original middle part notch visible on bun base
  strokeLine(png, 100, 48, 100, 58, DARK, 1);
  save(png, "public/avatars/hair/hair_f_04.png");
}

function hair_f_05_bob() {
  // Chin bob from f_01 — clean trim + soft bangs from crown pixels
  const png = cloneLayer("public/avatars/hair/hair_f_01.png");
  trimBelow(png, 152, 12);
  softenBottom(png, 145, 155);
  const base = cloneLayer("public/avatars/hair/hair_f_01.png");
  // soft bangs: project crown underside into forehead
  for (let x = 66; x <= 134; x++) {
    for (let y = 64; y <= 76; y++) {
      const [r, g, b, a] = pix(base, x, 58 + Math.floor((y - 64) * 0.4));
      if (a <= 12) continue;
      const edge = 72 + Math.sin(((x - 66) / 68) * Math.PI) * 4;
      if (y > edge) continue;
      const fade = 1 - (y - 64) / Math.max(1, edge - 64);
      set(png, x, y, [r, g, b, Math.round(a * Math.max(0.35, fade))]);
    }
  }
  // ensure eyes stay open
  for (let y = 78; y <= 135; y++) {
    for (let x = 74; x <= 126; x++) set(png, x, y, CLEAR);
  }
  // restore side locks
  for (let y = 78; y <= 155; y++) {
    for (let x = 0; x < W; x++) {
      if (x > 72 && x < 128) continue;
      const i = (W * y + x) << 2;
      if (base.data[i + 3] > 12) {
        png.data[i] = base.data[i];
        png.data[i + 1] = base.data[i + 1];
        png.data[i + 2] = base.data[i + 2];
        png.data[i + 3] = base.data[i + 3];
      }
    }
  }
  trimBelow(png, 152, 12);
  softenBottom(png, 145, 155);
  save(png, "public/avatars/hair/hair_f_05.png");
}

function hair_f_06_pigtails() {
  // Shorten the hand-drawn braid style (hair_f_03) — already detailed/polished
  const png = cloneLayer("public/avatars/hair/hair_f_03.png");
  // cut length, keep braid texture
  trimBelow(png, 168, 10);
  softenBottom(png, 160, 172);
  // slight inward tuck at tips for a tied look
  for (let y = 150; y <= 170; y++) {
    for (let x = 0; x < W; x++) {
      const i = (W * y + x) << 2;
      if (png.data[i + 3] <= 12) continue;
      // nudge outer pixels inward a bit by clearing far edges
      if (x < 48 + (y - 150) * 0.15 || x > 152 - (y - 150) * 0.15) {
        if (x < 55 || x > 145) set(png, x, y, CLEAR);
      }
    }
  }
  // soft ties near mid-braid
  fillEllipse(png, 52, 120, 6, 3, DARK);
  fillEllipse(png, 148, 120, 6, 3, DARK);
  fillEllipse(png, 52, 120, 3, 1.5, SHADOW);
  fillEllipse(png, 148, 120, 3, 1.5, SHADOW);
  save(png, "public/avatars/hair/hair_f_06.png");
}

// ---------- accessories ----------
function accessory02_necklace() {
  const png = blank();
  for (let a = Math.PI * 0.18; a <= Math.PI * 0.82; a += 0.018) {
    const x = 100 + Math.cos(a) * 26;
    const y = 140 + Math.sin(a) * 20;
    fillCircle(png, x, y, 1.8, FILL);
    if (Math.floor(a * 40) % 2 === 0) fillCircle(png, x, y, 1.2, LIGHT);
  }
  fillPolygon(png, [[100, 156], [108, 168], [100, 178], [92, 168]], MID);
  strokePolyline(png, [[100, 156], [108, 168], [100, 178], [92, 168], [100, 156]], DARK, 1.2);
  fillCircle(png, 100, 162, 2, LIGHT);
  save(png, "public/avatars/accessories/accessory_02.png");
}

function accessory03_headphones() {
  const png = blank();
  // band over crown — sit on head (y~45-70), not floating too high
  for (let a = Math.PI * 1.05; a <= Math.PI * 1.95; a += 0.012) {
    const x = 100 + Math.cos(a) * 52;
    const y = 88 + Math.sin(a) * 42;
    if (y <= 78) {
      fillCircle(png, x, y, 3.4, FILL);
      fillCircle(png, x, y - 1, 1.6, LIGHT);
    }
  }
  // ear cups at temple height
  fillEllipse(png, 50, 92, 11, 15, FILL);
  fillEllipse(png, 150, 92, 11, 15, FILL);
  fillEllipse(png, 50, 92, 7, 10, MID);
  fillEllipse(png, 150, 92, 7, 10, MID);
  fillEllipse(png, 50, 92, 4, 6, DARK);
  fillEllipse(png, 150, 92, 4, 6, DARK);
  save(png, "public/avatars/accessories/accessory_03.png");
}

function accessory04_bowtie() {
  const png = blank();
  fillPolygon(png, [[76, 150], [98, 157], [76, 164]], FILL);
  fillPolygon(png, [[124, 150], [102, 157], [124, 164]], FILL);
  fillPolygon(png, [[80, 152], [94, 157], [80, 162]], MID);
  fillPolygon(png, [[120, 152], [106, 157], [120, 162]], MID);
  fillRect(png, 96, 154, 104, 161, DARK);
  fillRect(png, 98, 156, 102, 159, SHADOW);
  save(png, "public/avatars/accessories/accessory_04.png");
}

function accessory05_earrings() {
  const png = blank();
  for (const cx of [48, 152]) {
    fillCircle(png, cx, 108, 3.8, FILL);
    fillCircle(png, cx, 108, 1.8, LIGHT);
    fillCircle(png, cx, 118, 2.6, MID);
    strokeLine(png, cx, 111, cx, 116, DARK, 1);
  }
  save(png, "public/avatars/accessories/accessory_05.png");
}

function accessory06_scarf() {
  const png = blank();
  // thick wrap on neck (below chin ~y140-158)
  fillEllipse(png, 100, 150, 32, 14, FILL);
  fillEllipse(png, 100, 148, 28, 8, MID);
  // clear upper so it doesn't cover face — open top wrap
  for (let y = 130; y < 145; y++) {
    for (let x = 70; x <= 130; x++) {
      if (y < 142) set(png, x, y, CLEAR);
    }
  }
  // hanging ends with stripe detail
  fillPolygon(png, [[88, 154], [102, 156], [98, 198], [84, 192]], FILL);
  fillPolygon(png, [[112, 154], [100, 156], [108, 200], [122, 194]], FILL);
  fillPolygon(png, [[90, 160], [98, 162], [96, 190], [88, 186]], MID);
  fillPolygon(png, [[110, 160], [102, 162], [108, 192], [116, 188]], MID);
  strokeLine(png, 92, 170, 94, 188, DARK, 1);
  strokeLine(png, 112, 172, 114, 190, DARK, 1);
  save(png, "public/avatars/accessories/accessory_06.png");
}

function accessory07_choker() {
  const png = blank();
  // solid band on neck
  for (let a = Math.PI * 0.22; a <= Math.PI * 0.78; a += 0.012) {
    const x = 100 + Math.cos(a) * 20;
    const y = 146 + Math.sin(a) * 11;
    fillCircle(png, x, y, 3.0, FILL);
    fillCircle(png, x, y + 1, 1.4, MID);
  }
  fillCircle(png, 100, 154, 3.2, DARK);
  fillCircle(png, 100, 154, 1.4, LIGHT);
  save(png, "public/avatars/accessories/accessory_07.png");
}

function accessory08_cap() {
  const png = blank();
  // crown dome on head
  fillEllipse(png, 100, 54, 42, 20, FILL);
  fillEllipse(png, 100, 48, 28, 12, LIGHT);
  // brim as a solid oval in front (no harsh bar wipe)
  fillEllipse(png, 118, 72, 28, 8, MID);
  fillEllipse(png, 118, 70, 24, 5, FILL);
  // seam under crown
  for (let x = 62; x <= 138; x++) {
    if (png.data[((W * 70 + x) << 2) + 3] > 10) set(png, x, 70, SHADOW);
  }
  fillCircle(png, 100, 40, 2.8, DARK);
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
