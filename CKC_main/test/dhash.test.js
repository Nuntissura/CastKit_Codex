const test = require('node:test');
const assert = require('node:assert/strict');

const { computeDhashHexFromBitmap, hammingDistanceHex64 } = require('../app/backend/dhash');

function fillBgra(buf, width, x, y, { r, g, b, a }) {
  const i = (y * width + x) * 4;
  buf[i] = b;
  buf[i + 1] = g;
  buf[i + 2] = r;
  buf[i + 3] = a;
}

test('computeDhashHexFromBitmap returns 64-bit hex', () => {
  const width = 9;
  const height = 8;
  const bytes = Buffer.alloc(width * height * 4);

  // Increasing brightness left->right => left > right is always false => all bits 0.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = 10 * x;
      fillBgra(bytes, width, x, y, { r: v, g: v, b: v, a: 255 });
    }
  }

  const h = computeDhashHexFromBitmap({ width, height, bytes, channelOrder: 'bgra' });
  assert.equal(h, '0000000000000000');
});

test('computeDhashHexFromBitmap produces all-ones for decreasing gradient', () => {
  const width = 9;
  const height = 8;
  const bytes = Buffer.alloc(width * height * 4);

  // Decreasing brightness left->right => left > right is always true => all bits 1.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = 250 - 10 * x;
      fillBgra(bytes, width, x, y, { r: v, g: v, b: v, a: 255 });
    }
  }

  const h = computeDhashHexFromBitmap({ width, height, bytes, channelOrder: 'bgra' });
  assert.equal(h, 'ffffffffffffffff');
});

test('hammingDistanceHex64 works for 64-bit hashes', () => {
  assert.equal(hammingDistanceHex64('0000000000000000', '0000000000000000'), 0);
  assert.equal(hammingDistanceHex64('ffffffffffffffff', 'ffffffffffffffff'), 0);
  assert.equal(hammingDistanceHex64('0000000000000000', 'ffffffffffffffff'), 64);
  assert.equal(hammingDistanceHex64('0000000000000000', '0000000000000001'), 1);
});

