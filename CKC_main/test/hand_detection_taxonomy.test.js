const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function loadCore() {
  return import(pathToFileURL(path.join(__dirname, '..', 'src', 'posekit', 'core.mjs')).href);
}

function landmarks(offsetX = 0, confidence = 1) {
  return Array.from({ length: 21 }, (_unused, idx) => ({
    x: 0.1 + offsetX + idx * 0.01,
    y: 0.2 + idx * 0.005,
    z: idx * 0.001,
    visibility: confidence,
    presence: confidence,
  }));
}

test('hand detection taxonomy maps MediaPipe hand 21 directly to left/right OpenPose hands', async () => {
  const core = await loadCore();
  assert.equal(core.HAND_21.length, 21);
  assert.deepEqual(core.HAND_21.slice(0, 5).map((entry) => entry.id), ['wrist', 'thumb_cmc', 'thumb_mcp', 'thumb_ip', 'thumb_tip']);

  const hands = core.fitHandLandmarkerResultToHands({
    handResult: {
      landmarks: [landmarks(0), landmarks(0.3)],
      worldLandmarks: [landmarks(0), landmarks(0.3)],
      handednesses: [
        [{ categoryName: 'Left', score: 0.92 }],
        [{ categoryName: 'Right', score: 0.87 }],
      ],
    },
    canvasWidth: 1000,
    canvasHeight: 500,
  });

  assert.equal(hands.handLeft.length, 21);
  assert.equal(hands.handRight.length, 21);
  assert.equal(hands.handLeft[0].id, 'hand_left_wrist');
  assert.equal(hands.handRight[8].id, 'hand_right_index_tip');
  assert.deepEqual([hands.handLeft[0].x, hands.handLeft[0].y, hands.handLeft[0].visibility], [100, 100, 0.92]);
  assert.deepEqual([hands.handRight[0].x, hands.handRight[0].y, hands.handRight[0].visibility], [400, 100, 0.87]);
});

test('hand detection taxonomy drops low-confidence or ambiguous hand results', async () => {
  const core = await loadCore();
  const lowScore = core.fitHandLandmarkerResultToHands({
    handResult: {
      landmarks: [landmarks(0)],
      handednesses: [[{ categoryName: 'Left', score: 0.49 }]],
    },
  });
  assert.equal(lowScore.handLeft.length, 0);
  assert.equal(lowScore.handRight.length, 0);

  const lowPresence = core.fitHandLandmarkerResultToHands({
    handResult: {
      landmarks: [landmarks(0, 0.2)],
      handednesses: [[{ categoryName: 'Right', score: 0.9 }]],
    },
  });
  assert.equal(lowPresence.handRight.length, 0);
});
