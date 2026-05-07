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
  const libraryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ckc-test-identity-replay-'));
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

function face70() {
  return Array.from({ length: 70 }, (_unused, idx) => ({
    id: `face_${idx}`,
    x: 410 + (idx % 10) * 22,
    y: 360 + Math.floor(idx / 10) * 26,
    z: 0,
    visibility: 1,
    estimated: false,
  }));
}

test('identity profile replay injection fills CastKitCodexBridge identity inputs', async (t) => {
  const lib = makeLib(t);
  await lib.initialize();
  t.after(() => lib.close());

  const characterId = await lib.createCharacter({ displayName: 'Identity Replay Test' });
  const srcPath = path.join(lib.libraryRoot, 'identity-replay-source.png');
  fs.writeFileSync(srcPath, Buffer.from(TINY_PNG_B64, 'base64'));
  const imported = await lib.importImages({ characterId, filePaths: [srcPath], duplicatePolicy: 'skip' });
  const imageId = imported.imported[0].id;
  const rig = await lib.createRig({
    characterId,
    portraitImageId: imageId,
    label: 'identity replay rig',
    poseJson: {
      schemaVersion: 1,
      subsystem: 'posekit',
      characterId,
      portraitImageId: imageId,
      image: { width: 1024, height: 1024 },
      canvas: { width: 1024, height: 1024 },
      body: [],
      face: face70(),
      handLeft: [],
      handRight: [],
      detector: { provider: 'test', status: 'detected' },
      openpose: null,
    },
  });
  const profile = await lib.createIdentityProfile({
    characterId,
    sourceImageId: imageId,
    sourceRigId: rig.rigId,
    name: 'bridge_identity',
  });
  const profileRow = await lib.getIdentityProfile({ profileId: profile.profileId });

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
      res.end(JSON.stringify({ prompt_id: 'identity-prompt', number: 1, node_errors: {} }));
    });
  });
  const port = await listen(server);
  t.after(() => server.close());

  const workflow = {
    1: {
      class_type: 'CastKitCodexBridge',
      inputs: {
        images: ['9', 0],
        character_id: '',
        rig_id: '',
        identity_profile_id: '',
        identity_profile_ref: '',
        identity_image_id: '',
        ipadapter_image_ref: '',
      },
    },
  };

  const replay = await lib.replayWorkflow({
    host: `http://127.0.0.1:${port}`,
    workflowJson: workflow,
    characterId,
    rigId: rig.rigId,
    identityProfileId: profile.profileId,
  });

  assert.equal(replay.ok, true);
  assert.equal(replay.identityProfile.profileId, profile.profileId);
  assert.equal(postedBody.prompt['1'].inputs.character_id, characterId);
  assert.equal(postedBody.prompt['1'].inputs.rig_id, rig.rigId);
  assert.equal(postedBody.prompt['1'].inputs.identity_profile_id, profile.profileId);
  assert.equal(postedBody.prompt['1'].inputs.identity_profile_ref, profileRow.manifestRelativePath);
  assert.equal(postedBody.prompt['1'].inputs.identity_image_id, profileRow.croppedFaceImageId);
  assert.equal(postedBody.prompt['1'].inputs.ipadapter_image_ref, profileRow.cropRelativePath);
});
