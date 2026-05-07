const http = require('http');

const DEFAULT_PORT = 52319;
const DEFAULT_MAX_PORT = 52399;
const DEFAULT_MAX_BODY_BYTES = 50 * 1024 * 1024;

function isLocalAddress(address) {
  const raw = String(address || '').trim();
  return raw === '127.0.0.1' || raw === '::1' || raw === '::ffff:127.0.0.1' || raw === '';
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function readBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    let received = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      received += chunk.length;
      if (received > maxBytes) {
        reject(new Error('request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('error', reject);
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

async function bindServer(server, port) {
  await new Promise((resolve, reject) => {
    const onError = (err) => {
      server.off('listening', onListening);
      reject(err);
    };
    const onListening = () => {
      server.off('error', onError);
      resolve();
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, '127.0.0.1');
  });
}

async function startIntakeServer({
  preferredPort = DEFAULT_PORT,
  maxPort = DEFAULT_MAX_PORT,
  maxBodyBytes = DEFAULT_MAX_BODY_BYTES,
  token = null,
  registerBundle,
} = {}) {
  if (typeof registerBundle !== 'function') throw new Error('registerBundle callback is required');
  const start = Math.max(1, Math.min(65535, Number(preferredPort) || DEFAULT_PORT));
  const end = Math.max(start, Math.min(65535, Number(maxPort) || DEFAULT_MAX_PORT));
  const authToken = String(token || '').trim() || null;

  const handler = async (req, res) => {
    try {
      if (!isLocalAddress(req.socket.remoteAddress)) {
        sendJson(res, 403, { ok: false, error: 'forbidden' });
        return;
      }
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      if (req.method !== 'POST' || url.pathname !== '/intake/comfyui_output') {
        sendJson(res, 404, { ok: false, error: 'not found' });
        return;
      }
      if (authToken) {
        const auth = String(req.headers.authorization || '').trim();
        if (auth !== `Bearer ${authToken}`) {
          sendJson(res, 401, { ok: false, error: 'unauthorized' });
          return;
        }
      }
      const text = await readBody(req, Math.max(1024, Number(maxBodyBytes) || DEFAULT_MAX_BODY_BYTES));
      const body = JSON.parse(text || '{}');
      const result = await registerBundle(body);
      sendJson(res, result?.ok === false ? 400 : 200, result || { ok: true });
    } catch (err) {
      sendJson(res, /too large/i.test(String(err?.message || '')) ? 413 : 500, {
        ok: false,
        error: String(err?.message || err || 'Unknown error'),
      });
    }
  };

  let lastError = null;
  for (let port = start; port <= end; port += 1) {
    const server = http.createServer(handler);
    try {
      await bindServer(server, port);
      return {
        server,
        port,
        tokenRequired: !!authToken,
        stop: () => {
          try {
            server.close();
          } catch {
            // best-effort shutdown
          }
        },
      };
    } catch (err) {
      lastError = err;
      try {
        server.close();
      } catch {
        // ignore
      }
      if (err && err.code !== 'EADDRINUSE') throw err;
    }
  }
  throw lastError || new Error(`Could not bind intake server on ${start}..${end}`);
}

module.exports = {
  DEFAULT_PORT,
  DEFAULT_MAX_PORT,
  DEFAULT_MAX_BODY_BYTES,
  isLocalAddress,
  startIntakeServer,
};
