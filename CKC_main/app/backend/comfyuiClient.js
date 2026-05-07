async function readJsonResponse(response, label) {
  const text = await response.text();
  if (!response.ok) throw new Error(`${label}: ${response.status} ${text}`);
  try {
    return JSON.parse(text || '{}');
  } catch {
    throw new Error(`${label}: response was not JSON`);
  }
}

async function readBytesResponse(response, label) {
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!response.ok) throw new Error(`${label}: ${response.status} ${bytes.toString('utf8')}`);
  return bytes;
}

function normalizeHost(host) {
  const raw = String(host || 'http://127.0.0.1:8188').trim() || 'http://127.0.0.1:8188';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

async function postPrompt({ host, workflowJson, clientId }) {
  const url = new URL('/prompt', normalizeHost(host)).href;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflowJson || {}, client_id: clientId || 'ckc-replay' }),
  });
  return readJsonResponse(response, 'ComfyUI /prompt');
}

async function getHistory({ host, promptId }) {
  const id = String(promptId || '').trim();
  if (!id) throw new Error('promptId is required');
  const url = new URL(`/history/${encodeURIComponent(id)}`, normalizeHost(host)).href;
  const response = await fetch(url);
  return readJsonResponse(response, 'ComfyUI /history');
}

async function pollHistory({ host, promptId, timeoutMs = 300000, pollMs = 2000 } = {}) {
  const deadline = Date.now() + Math.max(1000, Number(timeoutMs) || 300000);
  const interval = Math.max(250, Number(pollMs) || 2000);
  const id = String(promptId || '').trim();
  if (!id) throw new Error('promptId is required');

  while (Date.now() <= deadline) {
    const history = await getHistory({ host, promptId: id });
    const entry = history?.[id];
    if (entry?.status?.completed || entry?.status?.status_str === 'success' || entry?.status?.status_str === 'error') {
      return entry;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error(`ComfyUI /history poll timeout for prompt_id=${id}`);
}

async function getImageBytes({ host, filename, subfolder = '', type = 'output' } = {}) {
  const name = String(filename || '').trim();
  if (!name) throw new Error('filename is required');
  const url = new URL('/view', normalizeHost(host));
  url.searchParams.set('filename', name);
  url.searchParams.set('subfolder', String(subfolder || ''));
  url.searchParams.set('type', String(type || 'output'));
  const response = await fetch(url);
  return readBytesResponse(response, 'ComfyUI /view');
}

async function getSystemStats({ host }) {
  const url = new URL('/system_stats', normalizeHost(host)).href;
  const response = await fetch(url);
  return readJsonResponse(response, 'ComfyUI /system_stats');
}

module.exports = {
  normalizeHost,
  postPrompt,
  getHistory,
  pollHistory,
  getImageBytes,
  getSystemStats,
};
