const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function loadCore() {
  return import(pathToFileURL(path.join(__dirname, '..', 'src', 'posekit', 'core.mjs')).href);
}

test('posekit head pose: identity quaternion is an identity transform', async () => {
  const core = await loadCore();
  const rig = core.buildFallbackRig({ canvasWidth: 1024, canvasHeight: 1024 });
  const identity = core.applyHeadRotation(rig, [0, 0, 0, 1]);
  assert.deepEqual(
    identity.body.map((kp) => [kp.id, kp.x, kp.y, kp.z]),
    rig.body.map((kp) => [kp.id, kp.x, kp.y, kp.z])
  );
});

test('posekit head pose: intrinsic YXZ pitch and roll move projected head points', async () => {
  const core = await loadCore();
  const rig = core.buildFallbackRig({ canvasWidth: 1024, canvasHeight: 1024 });
  const base = core.rigToOpenposeJson(rig);
  const pitched = core.rigToOpenposeJson(rig, { headPose: core.createHeadPose({ pitch: 30 }) });
  const rolled = core.rigToOpenposeJson(rig, { headPose: core.createHeadPose({ roll: 20 }) });

  const baseNose = base.people[0].pose_keypoints_2d.slice(0, 2);
  const pitchedNose = pitched.people[0].pose_keypoints_2d.slice(0, 2);
  const rolledNose = rolled.people[0].pose_keypoints_2d.slice(0, 2);

  assert.notDeepEqual(pitchedNose, baseNose);
  assert.notDeepEqual(rolledNose, baseNose);
  assert.equal(core.createHeadPose({ yaw: 12, pitch: -8, roll: 5 }).order, 'YXZ');
});

test('posekit head pose: quaternion round-trip preserves YXZ angle metadata', async () => {
  const core = await loadCore();
  const pose = core.createHeadPose({ yaw: 18, pitch: -11, roll: 9 });
  const normalized = core.normalizeHeadPose(pose);
  assert.equal(normalized.order, 'YXZ');
  assert.equal(normalized.yaw, 18);
  assert.equal(normalized.pitch, -11);
  assert.equal(normalized.roll, 9);
  assert.equal(normalized.quaternion.length, 4);
});
