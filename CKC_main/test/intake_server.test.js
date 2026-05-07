const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { startIntakeServer } = require('../app/backend/intakeServer');

function postJson(port, body, token = null) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: '/intake/comfyui_output',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve({ statusCode: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString('utf8')) }));
      }
    );
    req.on('error', reject);
    req.end(data);
  });
}

test('intake server: binds localhost, enforces bearer token, and dispatches bundle', async (t) => {
  const received = [];
  const handle = await startIntakeServer({
    preferredPort: 54019,
    maxPort: 54099,
    token: 'secret',
    registerBundle: async (body) => {
      received.push(body);
      return { ok: true, image_id: 'img_test' };
    },
  });
  t.after(() => handle.stop());

  const unauthorized = await postJson(handle.port, { schema: 'x' });
  assert.equal(unauthorized.statusCode, 401);
  assert.equal(received.length, 0);

  const authorized = await postJson(handle.port, { schema: 'ckc.intake.comfyui_output@1' }, 'secret');
  assert.equal(authorized.statusCode, 200);
  assert.equal(authorized.body.image_id, 'img_test');
  assert.equal(received.length, 1);
  assert.equal(handle.tokenRequired, true);
});
