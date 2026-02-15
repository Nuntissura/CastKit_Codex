function clampByte(n) {
  const x = Number(n) || 0;
  if (x < 0) return 0;
  if (x > 255) return 255;
  return x | 0;
}

function isHex64(s) {
  return /^[0-9a-f]{16}$/i.test(String(s ?? '').trim());
}

function computeLuma({ r, g, b }) {
  // Fast-ish perceptual luminance approximation.
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function samplePixelBgra(bytes, width, x, y) {
  const i = (y * width + x) * 4;
  const b = clampByte(bytes[i] ?? 0);
  const g = clampByte(bytes[i + 1] ?? 0);
  const r = clampByte(bytes[i + 2] ?? 0);
  const a = clampByte(bytes[i + 3] ?? 255);
  return { r, g, b, a };
}

function computeDhashHexFromBitmap({ width, height, bytes, channelOrder = 'bgra' } = {}) {
  const w = Number(width) || 0;
  const h = Number(height) || 0;
  if (!(w > 0 && h > 0)) return '';
  if (!bytes || typeof bytes.length !== 'number') return '';

  const order = String(channelOrder || '').toLowerCase();
  if (order !== 'bgra') return '';

  // dHash uses a 9x8 sample grid (8 comparisons per row).
  const sampleW = 9;
  const sampleH = 8;

  const lumas = new Array(sampleW * sampleH).fill(0);
  for (let sy = 0; sy < sampleH; sy++) {
    const py = Math.min(h - 1, Math.max(0, Math.floor(((sy + 0.5) * h) / sampleH)));
    for (let sx = 0; sx < sampleW; sx++) {
      const px = Math.min(w - 1, Math.max(0, Math.floor(((sx + 0.5) * w) / sampleW)));
      const p = samplePixelBgra(bytes, w, px, py);
      if (p.a < 16) {
        lumas[sy * sampleW + sx] = 0;
        continue;
      }
      lumas[sy * sampleW + sx] = computeLuma(p);
    }
  }

  let hash = 0n;
  let bitIdx = 0;
  for (let y = 0; y < sampleH; y++) {
    for (let x = 0; x < sampleW - 1; x++) {
      const left = lumas[y * sampleW + x];
      const right = lumas[y * sampleW + x + 1];
      const bit = left > right ? 1n : 0n;
      hash = (hash << 1n) | bit;
      bitIdx += 1;
    }
  }

  if (bitIdx !== 64) return '';
  return hash.toString(16).padStart(16, '0');
}

const NIBBLE_POPCOUNT = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];

function hammingDistanceHex64(a, b) {
  const sa = String(a ?? '').trim().toLowerCase();
  const sb = String(b ?? '').trim().toLowerCase();
  if (!isHex64(sa) || !isHex64(sb)) return 64;
  let dist = 0;
  for (let i = 0; i < 16; i++) {
    const xa = parseInt(sa[i], 16);
    const xb = parseInt(sb[i], 16);
    dist += NIBBLE_POPCOUNT[(xa ^ xb) & 15] || 0;
  }
  return dist;
}

module.exports = {
  isHex64,
  computeDhashHexFromBitmap,
  hammingDistanceHex64,
};

