const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function loadCore() {
  return import(pathToFileURL(path.join(__dirname, '..', 'src', 'posekit', 'core.mjs')).href);
}

function hand(side, xOffset) {
  return Array.from({ length: 21 }, (_unused, idx) => ({
    id: `hand_${side}_${idx}`,
    x: xOffset + idx * 4,
    y: 300 + idx * 3,
    z: idx * 2,
    visibility: 0.8,
    estimated: false,
  }));
}

function mockCanvas() {
  const calls = [];
  const ctx = {
    set strokeStyle(value) {
      calls.push(['strokeStyle', value]);
    },
    set fillStyle(value) {
      calls.push(['fillStyle', value]);
    },
    set lineWidth(value) {
      calls.push(['lineWidth', value]);
    },
    set lineCap(value) {
      calls.push(['lineCap', value]);
    },
    beginPath() {
      calls.push(['beginPath']);
    },
    moveTo(x, y) {
      calls.push(['moveTo', x, y]);
    },
    lineTo(x, y) {
      calls.push(['lineTo', x, y]);
    },
    stroke() {
      calls.push(['stroke']);
    },
    arc(x, y, radius) {
      calls.push(['arc', x, y, radius]);
    },
    fill() {
      calls.push(['fill']);
    },
    fillRect(x, y, w, h) {
      calls.push(['fillRect', x, y, w, h]);
    },
    clearRect(x, y, w, h) {
      calls.push(['clearRect', x, y, w, h]);
    },
  };
  return {
    canvas: {
      width: 0,
      height: 0,
      getContext(kind) {
        return kind === '2d' ? ctx : null;
      },
    },
    calls,
  };
}

test('openpose export writes canonical 63-float arrays for both hands', async () => {
  const core = await loadCore();
  const rig = core.buildFallbackRig({ canvasWidth: 1024, canvasHeight: 1024 });
  rig.handLeft = hand('left', 180);
  rig.handRight = hand('right', 620);

  const openpose = core.rigToOpenposeJson(rig);
  const person = openpose.people[0];
  assert.equal(person.hand_left_keypoints_2d.length, 63);
  assert.equal(person.hand_right_keypoints_2d.length, 63);
  assert.deepEqual(person.hand_left_keypoints_2d.slice(0, 6), [180, 300, 0.8, 184, 303, 0.8]);
  assert.deepEqual(person.hand_right_keypoints_2d.slice(0, 6), [620, 300, 0.8, 624, 303, 0.8]);

  const hidden = core.rigToOpenposeJson(rig, {
    calibration: {
      schemaVersion: 1,
      perKeypoint: {},
      reframer: { scale: 1, offsetX: 0, offsetY: 0, anchor: 'head' },
      visibility: { hand_left_0: false },
    },
  });
  assert.deepEqual(hidden.people[0].hand_left_keypoints_2d.slice(0, 3), [0, 0, 0]);
});

test('hand keypoints participate in head-pose transforms and 2d rendering', async () => {
  const core = await loadCore();
  const rig = core.buildFallbackRig({ canvasWidth: 1024, canvasHeight: 1024 });
  rig.handLeft = hand('left', 180);
  rig.handRight = hand('right', 620);

  const base = core.rigToOpenposeJson(rig);
  const rotated = core.rigToOpenposeJson(rig, { headPose: core.createHeadPose({ yaw: 30, pitch: -8, roll: 5 }) });
  assert.notEqual(rotated.people[0].hand_left_keypoints_2d[0], base.people[0].hand_left_keypoints_2d[0]);

  const { canvas, calls } = mockCanvas();
  assert.equal(core.renderOpenposeJsonToCanvas(canvas, rotated), true);
  assert.equal(canvas.width, 1024);
  assert.equal(canvas.height, 1024);
  assert.ok(calls.filter((call) => call[0] === 'stroke').length >= core.HAND_CONNECTIONS.length);
  assert.ok(calls.filter((call) => call[0] === 'arc').length >= 42);
});
