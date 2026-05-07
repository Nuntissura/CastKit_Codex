delete process.env.CKC_DB_PROVIDER;
delete process.env.CKC_DATABASE_PROVIDER;
delete process.env.CKC_POSTGRES_URL;
delete process.env.CKC_POSTGRES_CONNECTION_STRING;
delete process.env.DATABASE_URL;

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const { CKCLibrary } = require('../app/backend/library');

const TINY_PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X0XkAAAAASUVORK5CYII=';

function makeLib(t) {
  const libraryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ckc-test-posekit-workflow-'));
  t.after(() => {
    try {
      fs.rmSync(libraryRoot, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  });
  const builtInTemplatePath = path.join(__dirname, '..', 'app', 'templates', 'CHARACTER_SHEET__v2.00.txt');
  return new CKCLibrary({ libraryRoot, builtInTemplatePath, defaultTemplateId: 'v2.00', electronNativeImage: null });
}

function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
}

test('posekit workflow: ComfyUI intake stores lineage, dedupes, extracts prompts, and replays', async (t) => {
  const lib = makeLib(t);
  await lib.initialize();
  const characterId = await lib.createCharacter({ displayName: 'Workflow Data Test' });
  const workflow = {
    1: { class_type: 'CLIPTextEncode', inputs: { text: 'clean portrait lighting' } },
    2: { class_type: 'CLIPTextEncode', inputs: { negative_prompt: 'blur, extra fingers' } },
    3: { class_type: 'LoraLoader', inputs: { lora_name: 'identity-test.safetensors' } },
  };

  const first = await lib.registerComfyUIOutput({
    schema: 'ckc.intake.comfyui_output@1',
    character_id: characterId,
    image_b64: TINY_PNG_B64,
    filename_hint: 'ComfyUI_00001.png',
    workflow_json: workflow,
    metadata: { title: 'lineage smoke', tags: 'workflow, replay', seed: 123 },
    session_id: 'test-session',
  });
  assert.equal(first.ok, true);
  assert.equal(first.deduped, false);
  assert.match(first.relativePath, /^images\/original\/[a-f0-9]{16}\.png$/);

  const second = await lib.registerComfyUIOutput({
    schema: 'ckc.intake.comfyui_output@1',
    character_id: characterId,
    image_b64: TINY_PNG_B64,
    workflow_json: workflow,
    metadata: { title: 'lineage smoke' },
  });
  assert.equal(second.deduped, true);
  assert.equal(second.imageId, first.imageId);

  const history = await lib.getWorkflowHistory({ characterId });
  assert.equal(history.length, 1);
  assert.equal(history[0].imageId, first.imageId);
  assert.equal(history[0].metadata.title, 'lineage smoke');
  assert.deepEqual(history[0].prompts.positive, ['clean portrait lighting']);
  assert.deepEqual(history[0].prompts.negative, ['blur, extra fingers']);
  assert.deepEqual(history[0].prompts.loras, ['identity-test.safetensors']);

  const extracted = await lib.extractPromptFromWorkflow({ workflowJson: JSON.stringify(workflow) });
  assert.equal(extracted.ok, true);
  assert.deepEqual(extracted.positive, ['clean portrait lighting']);

  let postedBody = null;
  const server = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/prompt') {
      res.statusCode = 404;
      res.end('{}');
      return;
    }
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      postedBody = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ prompt_id: 'prompt-test', number: 7, node_errors: {} }));
    });
  });
  const port = await listen(server);
  t.after(() => server.close());
  const replay = await lib.replayWorkflow({ host: `http://127.0.0.1:${port}`, workflowJson: workflow, characterId });
  assert.equal(replay.ok, true);
  assert.equal(replay.promptId, 'prompt-test');
  assert.equal(postedBody.prompt['1'].inputs.text, 'clean portrait lighting');

  lib.close();
});
