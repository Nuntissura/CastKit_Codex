async function readJsonResponse(response, label) {
  const text = await response.text();
  if (!response.ok) throw new Error(`${label}: ${response.status} ${text}`);
  try {
    return JSON.parse(text || '{}');
  } catch {
    throw new Error(`${label}: response was not JSON`);
  }
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

async function getSystemStats({ host }) {
  const url = new URL('/system_stats', normalizeHost(host)).href;
  const response = await fetch(url);
  return readJsonResponse(response, 'ComfyUI /system_stats');
}

module.exports = {
  normalizeHost,
  postPrompt,
  getHistory,
  getSystemStats,
};
