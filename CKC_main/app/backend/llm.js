function normalizeOpenAiChatCompletionsUrl(baseUrl) {
  const raw = String(baseUrl ?? '').trim();
  if (!raw) throw new Error('baseUrl is required');

  const u = new URL(raw);
  let p = String(u.pathname || '/').replace(/\/+$/, '');
  if (p.endsWith('/chat/completions')) {
    // use as-is
  } else if (p.endsWith('/v1')) {
    p = `${p}/chat/completions`;
  } else if (p.length === 0) {
    p = '/v1/chat/completions';
  } else {
    p = `${p}/v1/chat/completions`;
  }

  if (!p.startsWith('/')) p = `/${p}`;
  u.pathname = p;
  u.search = '';
  u.hash = '';
  return u.toString();
}

function sanitizeChatMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .map((m) => {
      if (!m || typeof m !== 'object') return null;
      const role = String(m.role || '').trim();
      if (role !== 'system' && role !== 'user' && role !== 'assistant') return null;
      const raw = m.content;

      if (typeof raw === 'string') {
        if (!raw.length) return null;
        return { role, content: raw };
      }

      // OpenAI-style rich content (multimodal): [{ type:'text', text }, { type:'image_url', image_url:{ url } }]
      if (Array.isArray(raw)) {
        const blocks = raw
          .map((b) => {
            if (!b || typeof b !== 'object') return null;
            const type = String(b.type ?? '').trim();
            if (type === 'text') {
              const text = String(b.text ?? '');
              if (!text.length) return null;
              return { type: 'text', text };
            }
            if (type === 'image_url') {
              const url = String(b.image_url?.url ?? '').trim();
              if (!url) return null;
              return { type: 'image_url', image_url: { url } };
            }
            return null;
          })
          .filter(Boolean);
        if (blocks.length === 0) return null;
        return { role, content: blocks };
      }

      return null;
    })
    .filter(Boolean);
}

async function openAiChatCompletions({
  baseUrl,
  apiKey,
  model,
  messages,
  temperature,
  maxTokens,
  timeoutMs = 60_000,
}) {
  const url = normalizeOpenAiChatCompletionsUrl(baseUrl);
  const modelName = String(model ?? '').trim();
  if (!modelName) throw new Error('model is required');

  const msgs = sanitizeChatMessages(messages);
  if (!msgs.length) throw new Error('messages[] is required');

  const body = { model: modelName, messages: msgs, stream: false };
  if (Number.isFinite(temperature)) body.temperature = temperature;
  if (Number.isFinite(maxTokens)) body.max_tokens = maxTokens;

  const headers = { 'content-type': 'application/json' };
  const key = String(apiKey ?? '').trim();
  if (key) headers.authorization = `Bearer ${key}`;

  const controller = new AbortController();
  const timeout = Math.max(1, Number(timeoutMs) || 60_000);
  const timer = setTimeout(() => controller.abort(), timeout);
  let res;
  try {
    res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal });
  } catch (err) {
    if (err && typeof err === 'object' && err.name === 'AbortError') throw new Error('LLM request timed out.');
    throw err;
  } finally {
    clearTimeout(timer);
  }

  const rawText = await res.text();
  let json = null;
  try {
    json = JSON.parse(rawText);
  } catch {
    // ignore
  }

  if (!res.ok) {
    const message = json?.error?.message ?? rawText ?? `HTTP ${res.status}`;
    const trimmed = String(message || '').trim();
    throw new Error(trimmed.length ? trimmed : `HTTP ${res.status}`);
  }

  const text = json?.choices?.[0]?.message?.content ?? json?.choices?.[0]?.text;
  if (typeof text !== 'string') throw new Error('LLM response did not include text.');
  return { text };
}

module.exports = {
  normalizeOpenAiChatCompletionsUrl,
  openAiChatCompletions,
};
