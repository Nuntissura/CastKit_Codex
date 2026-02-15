const test = require('node:test');
const assert = require('node:assert/strict');

const { extractDominantPaletteFromBitmap } = require('../app/backend/palette');

function fillBgra(buf, offsetPx, { r, g, b, a }) {
  const i = offsetPx * 4;
  buf[i] = b;
  buf[i + 1] = g;
  buf[i + 2] = r;
  buf[i + 3] = a;
}

test('extractDominantPaletteFromBitmap returns a stable dominant color', () => {
  const width = 10;
  const height = 10;
  const bytes = Buffer.alloc(width * height * 4);

  // Choose values that are exactly at the 5-bit bin centers used by the extractor:
  // r=252 g=4 b=4 => #fc0404
  for (let px = 0; px < width * height; px++) {
    fillBgra(bytes, px, { r: 252, g: 4, b: 4, a: 255 });
  }

  const palette = extractDominantPaletteFromBitmap({ width, height, bytes, colorCount: 6, channelOrder: 'bgra' });
  assert.ok(Array.isArray(palette));
  assert.equal(palette.length, 1);
  assert.equal(palette[0], '#fc0404');
});

test('extractDominantPaletteFromBitmap finds multiple dominant colors', () => {
  const width = 10;
  const height = 10;
  const bytes = Buffer.alloc(width * height * 4);

  // 70% red, 30% blue.
  const total = width * height;
  const redCount = Math.floor(total * 0.7);

  for (let px = 0; px < total; px++) {
    if (px < redCount) fillBgra(bytes, px, { r: 252, g: 4, b: 4, a: 255 });
    else fillBgra(bytes, px, { r: 4, g: 4, b: 252, a: 255 }); // #0404fc
  }

  const palette = extractDominantPaletteFromBitmap({ width, height, bytes, colorCount: 6, channelOrder: 'bgra' });
  assert.ok(Array.isArray(palette));
  assert.ok(palette.includes('#fc0404'));
  assert.ok(palette.includes('#0404fc'));
});

test('extractDominantPaletteFromBitmap ignores fully transparent pixels', () => {
  const width = 8;
  const height = 8;
  const bytes = Buffer.alloc(width * height * 4);
  for (let px = 0; px < width * height; px++) fillBgra(bytes, px, { r: 252, g: 4, b: 4, a: 0 });

  const palette = extractDominantPaletteFromBitmap({ width, height, bytes, colorCount: 6, channelOrder: 'bgra' });
  assert.deepEqual(palette, []);
});

