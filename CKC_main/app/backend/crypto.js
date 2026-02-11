const crypto = require('crypto');

function sha256Hex(input) {
  const hash = crypto.createHash('sha256');
  hash.update(input);
  return hash.digest('hex');
}

function randomId(prefix = '') {
  // 128-bit id, hex-encoded, deterministic length.
  const id = crypto.randomBytes(16).toString('hex');
  return prefix ? `${prefix}${id}` : id;
}

module.exports = {
  sha256Hex,
  randomId,
};

