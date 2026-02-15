function clampByte(n) {
  const x = Number(n) || 0;
  if (x < 0) return 0;
  if (x > 255) return 255;
  return x | 0;
}

function byteToHex(n) {
  const s = clampByte(n).toString(16).padStart(2, '0');
  return s;
}

function rgbToHex(r, g, b) {
  return `#${byteToHex(r)}${byteToHex(g)}${byteToHex(b)}`;
}

function hexToRgb(hex) {
  const s = String(hex ?? '').trim();
  const m = /^#?([0-9a-f]{6})$/i.exec(s);
  if (!m) return null;
  const raw = m[1];
  const n = parseInt(raw, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function distRgb(a, b) {
  const dr = Number(a.r) - Number(b.r);
  const dg = Number(a.g) - Number(b.g);
  const db = Number(a.b) - Number(b.b);
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function extractDominantPaletteFromBitmap({ width, height, bytes, colorCount = 6, channelOrder = 'bgra' } = {}) {
  const w = Number(width) || 0;
  const h = Number(height) || 0;
  if (!(w > 0 && h > 0)) return [];
  if (!bytes || typeof bytes.length !== 'number') return [];

  const want = Math.max(1, Math.min(12, Number(colorCount) || 6));

  const total = w * h;
  const stride = Math.max(1, Math.floor(Math.sqrt(total / 5000)));

  // key = 5-bit-per-channel bin (15-bit).
  const hist = new Map();

  const isBgra = String(channelOrder || '').toLowerCase() === 'bgra';

  for (let y = 0; y < h; y += stride) {
    for (let x = 0; x < w; x += stride) {
      const i = (y * w + x) * 4;
      const b0 = bytes[i] ?? 0;
      const b1 = bytes[i + 1] ?? 0;
      const b2 = bytes[i + 2] ?? 0;
      const a = bytes[i + 3] ?? 255;
      if (a < 32) continue;

      const r = isBgra ? b2 : b0;
      const g = b1;
      const b = isBgra ? b0 : b2;

      const r5 = r >> 3;
      const g5 = g >> 3;
      const b5 = b >> 3;
      const key = (r5 << 10) | (g5 << 5) | b5;
      hist.set(key, (hist.get(key) || 0) + 1);
    }
  }

  const entries = Array.from(hist.entries()).sort((a, b) => (b[1] || 0) - (a[1] || 0));
  if (entries.length === 0) return [];

  const palette = [];
  for (const [key] of entries) {
    const r5 = (key >> 10) & 31;
    const g5 = (key >> 5) & 31;
    const b5 = key & 31;

    // Center of the bin.
    const r = Math.min(255, r5 * 8 + 4);
    const g = Math.min(255, g5 * 8 + 4);
    const b = Math.min(255, b5 * 8 + 4);

    const hex = rgbToHex(r, g, b);
    const rgb = { r, g, b };

    // Avoid near-duplicates.
    const tooClose = palette.some((p) => distRgb(hexToRgb(p) || { r: 0, g: 0, b: 0 }, rgb) < 18);
    if (tooClose) continue;

    palette.push(hex);
    if (palette.length >= want) break;
  }

  return palette;
}

module.exports = {
  rgbToHex,
  extractDominantPaletteFromBitmap,
};

