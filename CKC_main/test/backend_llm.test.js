const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeOpenAiChatCompletionsUrl } = require('../app/backend/llm');

test('normalizeOpenAiChatCompletionsUrl appends /v1/chat/completions when missing', () => {
  assert.equal(
    normalizeOpenAiChatCompletionsUrl('http://localhost:11434'),
    'http://localhost:11434/v1/chat/completions'
  );
  assert.equal(
    normalizeOpenAiChatCompletionsUrl('http://localhost:11434/'),
    'http://localhost:11434/v1/chat/completions'
  );
});

test('normalizeOpenAiChatCompletionsUrl appends /chat/completions when base includes /v1', () => {
  assert.equal(
    normalizeOpenAiChatCompletionsUrl('http://localhost:1234/v1'),
    'http://localhost:1234/v1/chat/completions'
  );
  assert.equal(
    normalizeOpenAiChatCompletionsUrl('http://localhost:1234/v1/'),
    'http://localhost:1234/v1/chat/completions'
  );
});

test('normalizeOpenAiChatCompletionsUrl leaves explicit /chat/completions path alone', () => {
  assert.equal(
    normalizeOpenAiChatCompletionsUrl('http://127.0.0.1:1234/v1/chat/completions'),
    'http://127.0.0.1:1234/v1/chat/completions'
  );
  assert.equal(
    normalizeOpenAiChatCompletionsUrl('http://127.0.0.1:1234/v1/chat/completions?x=1'),
    'http://127.0.0.1:1234/v1/chat/completions'
  );
});

