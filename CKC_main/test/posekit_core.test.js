const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function loadCore() {
  return import(pathToFileURL(path.join(__dirname, '..', 'src', 'posekit', 'core.mjs')).href);
}

test('posekit core: fallback rig serializes to canonical openpose body arrays', async () => {
  const core = await loadCore();
  const rig = core.buildFallbackRig({ imageWidth: 640, imageHeight: 960, canvasWidth: 1024, canvasHeight: 1024 });
  assert.equal(rig.subsystem, 'posekit');
  assert.equal(rig.body.length, 18);
  assert.equal(rig.detector.status, 'fallback');

  const openpose = core.rigToOpenposeJson(rig);
  assert.equal(openpose.version, '1.0');
  assert.equal(openpose.canvas_width, 1024);
  assert.equal(openpose.canvas_height, 1024);
  assert.equal(openpose.people.length, 1);
  assert.equal(openpose.people[0].pose_keypoints_2d.length, 54);
  assert.equal(openpose.people[0].face_keypoints_2d.length, 210);
  assert.equal(openpose.people[0].hand_left_keypoints_2d.length, 63);
  assert.equal(openpose.people[0].hand_right_keypoints_2d.length, 63);
});

test('posekit core: yaw identity and calibration visibility are deterministic', async () => {
  const core = await loadCore();
  const rig = core.buildFallbackRig({ canvasWidth: 1024, canvasHeight: 1024 });
  const identity = core.applyYaw(rig, 0);
  assert.deepEqual(identity.body.map((kp) => [kp.id, kp.x, kp.y]), rig.body.map((kp) => [kp.id, kp.x, kp.y]));

  const hidden = core.rigToOpenposeJson(rig, {
    calibration: {
      schemaVersion: 1,
      perKeypoint: { nose: { visible: false } },
      reframer: { scale: 1, offsetX: 0, offsetY: 0, anchor: 'head' },
      visibility: {},
    },
  });
  assert.deepEqual(hidden.people[0].pose_keypoints_2d.slice(0, 3), [0, 0, 0]);

  const base = core.rigToOpenposeJson(rig);
  const moved = core.rigToOpenposeJson(rig, {
    yawDegrees: 15,
    calibration: {
      schemaVersion: 1,
      perKeypoint: { nose: { offsetXY: [10, -5] } },
      reframer: { scale: 1, offsetX: 0, offsetY: 0, anchor: 'head' },
      visibility: {},
    },
  });
  assert.notDeepEqual(moved.people[0].pose_keypoints_2d.slice(0, 2), base.people[0].pose_keypoints_2d.slice(0, 2));
});

test('posekit core: MediaPipe FaceMesh maps to OpenPose face-70 contract', async () => {
  const core = await loadCore();
  assert.equal(core.MP_FACEMESH_TO_OPENPOSE_70.length, 70);
  const landmarks = Array.from({ length: 478 }, (_unused, idx) => ({
    x: idx / 1000,
    y: (idx + 1) / 1000,
    z: idx / 10000,
  }));
  const face = core.fitFaceLandmarkerResultToFace70({
    faceResult: { faceLandmarks: [landmarks] },
    canvasWidth: 1000,
    canvasHeight: 1000,
  });
  assert.equal(face.length, 70);
  assert.deepEqual(
    face.slice(0, 3).map((kp) => [kp.id, kp.x, kp.y, kp.visibility]),
    [
      ['face_0', 234, 235, 1],
      ['face_1', 93, 94, 1],
      ['face_2', 132, 133, 1],
    ]
  );
  const rig = core.buildFallbackRig({ canvasWidth: 1000, canvasHeight: 1000 });
  rig.face = face;
  const openpose = core.rigToOpenposeJson(rig);
  assert.equal(openpose.people[0].face_keypoints_2d.length, 210);
  assert.deepEqual(openpose.people[0].face_keypoints_2d.slice(0, 6), [234, 235, 1, 93, 94, 1]);
});
