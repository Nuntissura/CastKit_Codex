import { Euler, Quaternion, Vector3 } from 'three';

export const BODY_18 = [
  { idx: 0, id: 'nose', mpIdx: 0 },
  { idx: 1, id: 'neck', mpIdx: null },
  { idx: 2, id: 'right_shoulder', mpIdx: 12 },
  { idx: 3, id: 'right_elbow', mpIdx: 14 },
  { idx: 4, id: 'right_wrist', mpIdx: 16 },
  { idx: 5, id: 'left_shoulder', mpIdx: 11 },
  { idx: 6, id: 'left_elbow', mpIdx: 13 },
  { idx: 7, id: 'left_wrist', mpIdx: 15 },
  { idx: 8, id: 'right_hip', mpIdx: 24 },
  { idx: 9, id: 'right_knee', mpIdx: 26 },
  { idx: 10, id: 'right_ankle', mpIdx: 28 },
  { idx: 11, id: 'left_hip', mpIdx: 23 },
  { idx: 12, id: 'left_knee', mpIdx: 25 },
  { idx: 13, id: 'left_ankle', mpIdx: 27 },
  { idx: 14, id: 'right_eye', mpIdx: 5 },
  { idx: 15, id: 'left_eye', mpIdx: 2 },
  { idx: 16, id: 'right_ear', mpIdx: 8 },
  { idx: 17, id: 'left_ear', mpIdx: 7 },
];

export const LIMB_PAIRS = [
  [1, 2],
  [1, 5],
  [2, 3],
  [3, 4],
  [5, 6],
  [6, 7],
  [1, 8],
  [8, 9],
  [9, 10],
  [1, 11],
  [11, 12],
  [12, 13],
  [1, 0],
  [0, 14],
  [14, 16],
  [0, 15],
  [15, 17],
];

export const LIMB_COLORS_BGR = [
  [0, 0, 255],
  [0, 85, 255],
  [0, 170, 255],
  [0, 255, 255],
  [0, 255, 170],
  [0, 255, 85],
  [0, 255, 0],
  [85, 255, 0],
  [170, 255, 0],
  [255, 255, 0],
  [255, 170, 0],
  [255, 85, 0],
  [255, 0, 0],
  [255, 0, 85],
  [255, 0, 170],
  [255, 0, 255],
  [170, 0, 255],
];

export const HAND_CONNECTIONS = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [0, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [0, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20],
];

export const HAND_21 = [
  { idx: 0, id: 'wrist' },
  { idx: 1, id: 'thumb_cmc' },
  { idx: 2, id: 'thumb_mcp' },
  { idx: 3, id: 'thumb_ip' },
  { idx: 4, id: 'thumb_tip' },
  { idx: 5, id: 'index_mcp' },
  { idx: 6, id: 'index_pip' },
  { idx: 7, id: 'index_dip' },
  { idx: 8, id: 'index_tip' },
  { idx: 9, id: 'middle_mcp' },
  { idx: 10, id: 'middle_pip' },
  { idx: 11, id: 'middle_dip' },
  { idx: 12, id: 'middle_tip' },
  { idx: 13, id: 'ring_mcp' },
  { idx: 14, id: 'ring_pip' },
  { idx: 15, id: 'ring_dip' },
  { idx: 16, id: 'ring_tip' },
  { idx: 17, id: 'pinky_mcp' },
  { idx: 18, id: 'pinky_pip' },
  { idx: 19, id: 'pinky_dip' },
  { idx: 20, id: 'pinky_tip' },
];

// Face 70 taxonomy from the historical OpenPose contract:
// OpenRepose .product/src/openrepose/openpose_schema.py:84-121.
// Index = OpenPose face-70 index; value = MediaPipe FaceMesh index.
export const MP_FACEMESH_TO_OPENPOSE_70 = [
  234, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152,
  377, 400, 378, 379, 365, 397,
  70, 63, 105, 66, 107,
  336, 296, 334, 293, 300,
  168, 6, 195, 4,
  98, 97, 2, 326, 327,
  33, 160, 158, 133, 153, 144,
  362, 385, 387, 263, 373, 380,
  61, 39, 37, 0, 267, 269, 291, 405, 314, 17, 84, 181,
  78, 81, 13, 311, 308, 402, 14, 178,
  468, 473,
];

export const RENDER_DEFAULTS = {
  bodyKeypointDotRgb: [255, 255, 255],
  faceKeypointDotRgb: [255, 255, 255],
  handKeypointDotRgb: [255, 255, 255],
  handLineRgb: [0, 255, 255],
  bodyLineThickness: 4,
  handLineThickness: 2,
  bodyKeypointRadius: 4,
  faceKeypointRadius: 1,
  handKeypointRadius: 2,
};

export const YAW_BINS = [-90, -75, -60, -45, -30, -15, 0, 15, 30, 45, 60, 75, 90];
export const HEAD_POSE_ORDER = 'YXZ';
export const HEAD_POSE_LIMITS = {
  yaw: [-90, 90],
  pitch: [-75, 75],
  roll: [-45, 45],
};

function roundPoseValue(value) {
  return Math.round(finiteNumber(value, 0) * 1000000) / 1000000;
}

function radToDeg(value) {
  return (finiteNumber(value, 0) * 180) / Math.PI;
}

function degToRad(value) {
  return (finiteNumber(value, 0) * Math.PI) / 180;
}

function normalizeQuaternionLike(value) {
  let parts = null;
  if (Array.isArray(value)) {
    parts = value;
  } else if (value && typeof value === 'object') {
    parts = [value.x, value.y, value.z, value.w];
  }
  if (!parts || parts.length < 4) return new Quaternion(0, 0, 0, 1);
  const q = new Quaternion(
    finiteNumber(parts[0], 0),
    finiteNumber(parts[1], 0),
    finiteNumber(parts[2], 0),
    finiteNumber(parts[3], 1)
  );
  if (!Number.isFinite(q.lengthSq()) || q.lengthSq() <= 0) return new Quaternion(0, 0, 0, 1);
  return q.normalize();
}

function quaternionToArray(q) {
  return [roundPoseValue(q.x), roundPoseValue(q.y), roundPoseValue(q.z), roundPoseValue(q.w)];
}

export function createHeadPose({ yaw = 0, pitch = 0, roll = 0, order = HEAD_POSE_ORDER } = {}) {
  const euler = new Euler(degToRad(pitch), degToRad(yaw), degToRad(roll), order === HEAD_POSE_ORDER ? HEAD_POSE_ORDER : HEAD_POSE_ORDER);
  const q = new Quaternion().setFromEuler(euler).normalize();
  return {
    schemaVersion: 1,
    order: HEAD_POSE_ORDER,
    yaw: roundPoseValue(yaw),
    pitch: roundPoseValue(pitch),
    roll: roundPoseValue(roll),
    quaternion: quaternionToArray(q),
  };
}

export function normalizeHeadPose(value = null) {
  const src = value && typeof value === 'object' ? value : {};
  const hasQuaternion = Array.isArray(src.quaternion) || (src.quaternion && typeof src.quaternion === 'object');
  if (hasQuaternion) {
    const q = normalizeQuaternionLike(src.quaternion);
    const e = new Euler().setFromQuaternion(q, HEAD_POSE_ORDER);
    return {
      schemaVersion: 1,
      order: HEAD_POSE_ORDER,
      yaw: roundPoseValue(src.yaw ?? radToDeg(e.y)),
      pitch: roundPoseValue(src.pitch ?? radToDeg(e.x)),
      roll: roundPoseValue(src.roll ?? radToDeg(e.z)),
      quaternion: quaternionToArray(q),
    };
  }
  return createHeadPose({
    yaw: finiteNumber(src.yaw, 0),
    pitch: finiteNumber(src.pitch, 0),
    roll: finiteNumber(src.roll, 0),
  });
}

const FALLBACK_BODY_NORMALIZED = {
  nose: [0.5, 0.18, -0.06],
  neck: [0.5, 0.31, 0],
  right_shoulder: [0.38, 0.32, 0.02],
  right_elbow: [0.31, 0.48, 0.01],
  right_wrist: [0.28, 0.64, -0.02],
  left_shoulder: [0.62, 0.32, 0.02],
  left_elbow: [0.69, 0.48, 0.01],
  left_wrist: [0.72, 0.64, -0.02],
  right_hip: [0.43, 0.58, 0.03],
  right_knee: [0.41, 0.78, 0.02],
  right_ankle: [0.4, 0.96, 0.01],
  left_hip: [0.57, 0.58, 0.03],
  left_knee: [0.59, 0.78, 0.02],
  left_ankle: [0.6, 0.96, 0.01],
  right_eye: [0.465, 0.155, -0.07],
  left_eye: [0.535, 0.155, -0.07],
  right_ear: [0.43, 0.17, -0.02],
  left_ear: [0.57, 0.17, -0.02],
};

function finiteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeCanvasSize(width, height) {
  const w = Math.max(1, Math.round(finiteNumber(width, 1024)));
  const h = Math.max(1, Math.round(finiteNumber(height, 1024)));
  return { width: w, height: h };
}

function keypointFromNormalized(def, canvasWidth, canvasHeight, confidence = 1, estimated = false) {
  const [x, y, z] = def;
  return {
    id: '',
    x: x * canvasWidth,
    y: y * canvasHeight,
    z: z * Math.max(canvasWidth, canvasHeight),
    visibility: clamp(finiteNumber(confidence, 1), 0, 1),
    estimated: !!estimated,
  };
}

function zeroTriples(count) {
  return Array.from({ length: count * 3 }, () => 0);
}

export function createDefaultCalibration() {
  return {
    schemaVersion: 1,
    headPose: createHeadPose(),
    perKeypoint: {},
    reframer: {
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      anchor: 'head',
    },
    visibility: {},
  };
}

export function buildFallbackRig({
  imageWidth = 1024,
  imageHeight = 1024,
  canvasWidth = 1024,
  canvasHeight = 1024,
  characterId = '',
  portraitImageId = '',
  source = 'fallback',
} = {}) {
  const canvas = normalizeCanvasSize(canvasWidth, canvasHeight);
  const image = normalizeCanvasSize(imageWidth, imageHeight);
  const body = BODY_18.map((entry) => {
    const def = FALLBACK_BODY_NORMALIZED[entry.id] || [0.5, 0.5, 0];
    const kp = keypointFromNormalized(def, canvas.width, canvas.height, entry.id === 'neck' ? 0.5 : 0.82, entry.id === 'neck');
    kp.id = entry.id;
    return kp;
  });

  return {
    schemaVersion: 1,
    subsystem: 'posekit',
    characterId: String(characterId || ''),
    portraitImageId: String(portraitImageId || ''),
    image: {
      width: image.width,
      height: image.height,
    },
    canvas: {
      width: canvas.width,
      height: canvas.height,
    },
    body,
    face: [],
    handLeft: [],
    handRight: [],
    detector: {
      provider: source,
      status: source === 'fallback' ? 'fallback' : 'detected',
      detail: source === 'fallback' ? 'deterministic body-18 fallback; MediaPipe model assets were not used' : '',
    },
    openpose: null,
  };
}

export function fitPoseLandmarkerResultToRig({
  poseResult,
  imageWidth = 1024,
  imageHeight = 1024,
  canvasWidth = 1024,
  canvasHeight = 1024,
  characterId = '',
  portraitImageId = '',
} = {}) {
  const canvas = normalizeCanvasSize(canvasWidth, canvasHeight);
  const image = normalizeCanvasSize(imageWidth, imageHeight);
  const landmarks = Array.isArray(poseResult?.landmarks?.[0]) ? poseResult.landmarks[0] : null;
  const worldLandmarks = Array.isArray(poseResult?.worldLandmarks?.[0]) ? poseResult.worldLandmarks[0] : null;

  if (!landmarks || landmarks.length < 29) {
    return buildFallbackRig({
      imageWidth: image.width,
      imageHeight: image.height,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      characterId,
      portraitImageId,
      source: 'fallback',
    });
  }

  const body = BODY_18.map((entry) => {
    if (entry.id === 'neck') {
      const left = landmarks[11];
      const right = landmarks[12];
      const leftWorld = worldLandmarks?.[11] || null;
      const rightWorld = worldLandmarks?.[12] || null;
      const leftVis = finiteNumber(left?.visibility ?? left?.presence, 1);
      const rightVis = finiteNumber(right?.visibility ?? right?.presence, 1);
      return {
        id: entry.id,
        x: ((finiteNumber(left?.x, 0.5) + finiteNumber(right?.x, 0.5)) / 2) * canvas.width,
        y: ((finiteNumber(left?.y, 0.31) + finiteNumber(right?.y, 0.31)) / 2) * canvas.height,
        z:
          ((finiteNumber(leftWorld?.z ?? left?.z, 0) + finiteNumber(rightWorld?.z ?? right?.z, 0)) / 2) *
          Math.max(canvas.width, canvas.height),
        visibility: clamp(Math.min(leftVis, rightVis, 0.5), 0, 1),
        estimated: true,
      };
    }

    const lm = landmarks[entry.mpIdx];
    const world = worldLandmarks?.[entry.mpIdx] || null;
    return {
      id: entry.id,
      x: finiteNumber(lm?.x, 0) * canvas.width,
      y: finiteNumber(lm?.y, 0) * canvas.height,
      z: finiteNumber(world?.z ?? lm?.z, 0) * Math.max(canvas.width, canvas.height),
      visibility: clamp(finiteNumber(lm?.visibility ?? lm?.presence, 1), 0, 1),
      estimated: false,
    };
  });

  return {
    schemaVersion: 1,
    subsystem: 'posekit',
    characterId: String(characterId || ''),
    portraitImageId: String(portraitImageId || ''),
    image: {
      width: image.width,
      height: image.height,
    },
    canvas: {
      width: canvas.width,
      height: canvas.height,
    },
    body,
    face: [],
    handLeft: [],
    handRight: [],
    detector: {
      provider: 'mediapipe.tasks-vision.pose',
      status: 'detected',
      detail: '',
    },
    openpose: null,
  };
}

export function fitFaceLandmarkerResultToFace70({
  faceResult,
  canvasWidth = 1024,
  canvasHeight = 1024,
} = {}) {
  const canvas = normalizeCanvasSize(canvasWidth, canvasHeight);
  const landmarks = Array.isArray(faceResult?.faceLandmarks?.[0])
    ? faceResult.faceLandmarks[0]
    : Array.isArray(faceResult?.landmarks?.[0])
      ? faceResult.landmarks[0]
      : null;
  if (!landmarks) return [];
  return MP_FACEMESH_TO_OPENPOSE_70.map((mpIdx, faceIdx) => {
    const lm = landmarks[mpIdx] || null;
    const hasPoint = Number.isFinite(Number(lm?.x)) && Number.isFinite(Number(lm?.y));
    return {
      id: `face_${faceIdx}`,
      x: finiteNumber(lm?.x, 0) * canvas.width,
      y: finiteNumber(lm?.y, 0) * canvas.height,
      z: finiteNumber(lm?.z, 0) * Math.max(canvas.width, canvas.height),
      visibility: hasPoint ? 1 : 0,
      estimated: false,
    };
  });
}

function topHandednessCategory(handedness) {
  const list = Array.isArray(handedness)
    ? handedness
    : Array.isArray(handedness?.categories)
      ? handedness.categories
      : [];
  let best = null;
  for (const item of list) {
    const label = String(item?.categoryName || item?.displayName || item?.label || '').toLowerCase();
    const score = finiteNumber(item?.score ?? item?.confidence, label ? 1 : 0);
    if (!best || score > best.score) {
      best = {
        label,
        score,
      };
    }
  }
  return best || { label: '', score: 0 };
}

function handLandmarkConfidence(lm) {
  // HandLandmarker's JS image-mode results can expose `visibility: 0` on
  // valid 2D landmarks. Gate on presence when present; otherwise rely on
  // handedness confidence from the palm/hand classifier.
  return clamp(finiteNumber(lm?.presence, 1), 0, 1);
}

export function fitHandLandmarkerResultToHands({
  handResult,
  canvasWidth = 1024,
  canvasHeight = 1024,
  minHandDetectionConfidence = 0.5,
  minLandmarkConfidence = 0.5,
} = {}) {
  const canvas = normalizeCanvasSize(canvasWidth, canvasHeight);
  const landmarksByHand = Array.isArray(handResult?.landmarks) ? handResult.landmarks : [];
  const worldByHand = Array.isArray(handResult?.worldLandmarks) ? handResult.worldLandmarks : [];
  const handednesses = Array.isArray(handResult?.handednesses)
    ? handResult.handednesses
    : Array.isArray(handResult?.handedness)
      ? handResult.handedness
      : [];
  const out = { handLeft: [], handRight: [] };
  const scores = { handLeft: -1, handRight: -1 };

  for (let handIndex = 0; handIndex < landmarksByHand.length; handIndex += 1) {
    const landmarks = Array.isArray(landmarksByHand[handIndex]) ? landmarksByHand[handIndex] : [];
    if (landmarks.length < HAND_21.length) continue;
    const handedness = topHandednessCategory(handednesses[handIndex]);
    const target = handedness.label === 'left' ? 'handLeft' : handedness.label === 'right' ? 'handRight' : null;
    if (!target || handedness.score < minHandDetectionConfidence) continue;

    const landmarkConfidence =
      landmarks.reduce((sum, lm) => sum + handLandmarkConfidence(lm), 0) / Math.max(1, Math.min(landmarks.length, HAND_21.length));
    if (landmarkConfidence < minLandmarkConfidence) continue;

    const world = Array.isArray(worldByHand[handIndex]) ? worldByHand[handIndex] : [];
    const hand = HAND_21.map((entry) => {
      const lm = landmarks[entry.idx] || {};
      const wm = world[entry.idx] || null;
      return {
        id: `${target === 'handLeft' ? 'hand_left' : 'hand_right'}_${entry.id}`,
        x: finiteNumber(lm.x, 0) * canvas.width,
        y: finiteNumber(lm.y, 0) * canvas.height,
        z: finiteNumber(wm?.z ?? lm.z, 0) * Math.max(canvas.width, canvas.height),
        visibility: clamp(Math.min(handedness.score || 1, handLandmarkConfidence(lm)), 0, 1),
        estimated: false,
      };
    });

    if (handedness.score > scores[target]) {
      out[target] = hand;
      scores[target] = handedness.score;
    }
  }

  return out;
}

function cloneKeypoint(kp) {
  return {
    id: String(kp?.id || ''),
    x: finiteNumber(kp?.x, 0),
    y: finiteNumber(kp?.y, 0),
    z: finiteNumber(kp?.z, 0),
    visibility: clamp(finiteNumber(kp?.visibility, 0), 0, 1),
    estimated: !!kp?.estimated,
  };
}

function cloneRig(rig) {
  const fallback = buildFallbackRig();
  const src = rig && typeof rig === 'object' ? rig : fallback;
  const canvas = src.canvas || src.openpose || {};
  return {
    schemaVersion: 1,
    subsystem: 'posekit',
    characterId: String(src.characterId || ''),
    portraitImageId: String(src.portraitImageId || ''),
    image: src.image || { width: finiteNumber(canvas.canvas_width || canvas.width, 1024), height: finiteNumber(canvas.canvas_height || canvas.height, 1024) },
    canvas: {
      width: finiteNumber(canvas.width ?? canvas.canvas_width, 1024),
      height: finiteNumber(canvas.height ?? canvas.canvas_height, 1024),
    },
    body: Array.isArray(src.body) ? src.body.map(cloneKeypoint) : fallback.body.map(cloneKeypoint),
    face: Array.isArray(src.face) ? src.face.map(cloneKeypoint) : [],
    handLeft: Array.isArray(src.handLeft) ? src.handLeft.map(cloneKeypoint) : [],
    handRight: Array.isArray(src.handRight) ? src.handRight.map(cloneKeypoint) : [],
    detector: src.detector || fallback.detector,
    openpose: src.openpose || null,
  };
}

export function getRigCanvas(rig) {
  const src = rig && typeof rig === 'object' ? rig : {};
  const canvas = src.canvas || src.openpose || {};
  return normalizeCanvasSize(canvas.width ?? canvas.canvas_width, canvas.height ?? canvas.canvas_height);
}

export function applyYaw(rig, yawDegrees = 0) {
  const out = cloneRig(rig);
  const rad = (finiteNumber(yawDegrees, 0) * Math.PI) / 180;
  if (!rad) return out;
  const neck = out.body.find((kp) => kp.id === 'neck') || out.body[1] || out.body[0];
  const anchorX = finiteNumber(neck?.x, out.canvas.width / 2);
  const anchorZ = finiteNumber(neck?.z, 0);
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const focal = Math.max(out.canvas.width, out.canvas.height) * 2.2;

  for (const group of [out.body, out.face, out.handLeft, out.handRight]) {
    for (const kp of group) {
      const dx = kp.x - anchorX;
      const dz = kp.z - anchorZ;
      const rx = c * dx - s * dz;
      const rz = s * dx + c * dz;
      const perspective = focal / Math.max(1, focal + rz);
      kp.x = anchorX + rx * perspective;
      kp.z = anchorZ + rz;
    }
  }
  return out;
}

export function applyHeadRotation(rig, quaternion, anchor = null) {
  const out = cloneRig(rig);
  const q = normalizeQuaternionLike(quaternion);
  if (Math.abs(q.x) < 1e-12 && Math.abs(q.y) < 1e-12 && Math.abs(q.z) < 1e-12 && Math.abs(q.w - 1) < 1e-12) return out;

  const neck = out.body.find((kp) => kp.id === 'neck') || out.body[1] || out.body[0];
  const anchorX = Array.isArray(anchor) ? finiteNumber(anchor[0], finiteNumber(neck?.x, out.canvas.width / 2)) : finiteNumber(neck?.x, out.canvas.width / 2);
  const anchorY = Array.isArray(anchor) ? finiteNumber(anchor[1], finiteNumber(neck?.y, out.canvas.height / 2)) : finiteNumber(neck?.y, out.canvas.height / 2);
  const anchorZ = Array.isArray(anchor) ? finiteNumber(anchor[2], finiteNumber(neck?.z, 0)) : finiteNumber(neck?.z, 0);
  const focal = Math.max(out.canvas.width, out.canvas.height) * 2.2;

  for (const group of [out.body, out.face, out.handLeft, out.handRight]) {
    for (const kp of group) {
      const v = new Vector3(kp.x - anchorX, anchorY - kp.y, kp.z - anchorZ);
      v.applyQuaternion(q);
      const perspective = focal / Math.max(1, focal + v.z);
      kp.x = anchorX + v.x * perspective;
      kp.y = anchorY - v.y * perspective;
      kp.z = anchorZ + v.z;
    }
  }
  return out;
}

export function applyHeadPose(rig, pose = {}, anchor = null) {
  const normalized = normalizeHeadPose(pose);
  return applyHeadRotation(rig, normalized.quaternion, anchor);
}

function keypointConfig(calibration, keypointId) {
  const per = calibration?.perKeypoint && typeof calibration.perKeypoint === 'object' ? calibration.perKeypoint : {};
  return per[keypointId] && typeof per[keypointId] === 'object' ? per[keypointId] : null;
}

export function applyCalibration(rig, calibration = null) {
  const out = cloneRig(rig);
  const cal = calibration && typeof calibration === 'object' ? calibration : createDefaultCalibration();
  const reframer = cal.reframer && typeof cal.reframer === 'object' ? cal.reframer : createDefaultCalibration().reframer;
  const scale = clamp(finiteNumber(reframer.scale, 1), 0.3, 2);
  const offsetX = clamp(finiteNumber(reframer.offsetX, 0), -2048, 2048);
  const offsetY = clamp(finiteNumber(reframer.offsetY, 0), -2048, 2048);
  const anchor =
    reframer.anchor === 'custom' && Array.isArray(reframer.anchorPoint)
      ? [finiteNumber(reframer.anchorPoint[0], out.canvas.width / 2), finiteNumber(reframer.anchorPoint[1], out.canvas.height / 2)]
      : reframer.anchor === 'canvas_center'
        ? [out.canvas.width / 2, out.canvas.height / 2]
        : [finiteNumber(out.body[0]?.x, out.canvas.width / 2), finiteNumber(out.body[0]?.y, out.canvas.height * 0.18)];

  for (const group of [out.body, out.face, out.handLeft, out.handRight]) {
    for (const kp of group) {
      const cfg = keypointConfig(cal, kp.id);
      if (cfg?.visible === false || cal.visibility?.[kp.id] === false) kp.visibility = 0;
      const xy = Array.isArray(cfg?.offsetXY) ? cfg.offsetXY : [0, 0];
      kp.x = anchor[0] + (kp.x - anchor[0]) * scale + offsetX + finiteNumber(xy[0], 0);
      kp.y = anchor[1] + (kp.y - anchor[1]) * scale + offsetY + finiteNumber(xy[1], 0);
      kp.z += finiteNumber(cfg?.offsetZ, 0);
    }
  }
  return out;
}

function flattenKeypoints(keypoints, count) {
  const triples = [];
  for (let i = 0; i < count; i += 1) {
    const kp = keypoints[i] || null;
    if (!kp || finiteNumber(kp.visibility, 0) <= 0) {
      triples.push(0, 0, 0);
      continue;
    }
    triples.push(roundCoord(kp.x), roundCoord(kp.y), roundConfidence(kp.visibility));
  }
  return triples;
}

function roundCoord(value) {
  return Math.round(finiteNumber(value, 0) * 1000) / 1000;
}

function roundConfidence(value) {
  return Math.round(clamp(finiteNumber(value, 0), 0, 1) * 10000) / 10000;
}

export function rigToOpenposeJson(rig, { yawDegrees = 0, headPose = null, calibration = null } = {}) {
  const poseFromCalibration = calibration && typeof calibration === 'object' ? calibration.headPose : null;
  const pose = headPose || poseFromCalibration;
  const rotated = pose ? applyHeadPose(rig, pose) : applyYaw(rig, yawDegrees);
  const transformed = applyCalibration(rotated, calibration);
  const canvas = getRigCanvas(transformed);
  return {
    version: '1.0',
    people: [
      {
        pose_keypoints_2d: flattenKeypoints(transformed.body, 18),
        face_keypoints_2d: transformed.face.length ? flattenKeypoints(transformed.face, 70) : zeroTriples(70),
        hand_left_keypoints_2d: transformed.handLeft.length ? flattenKeypoints(transformed.handLeft, 21) : zeroTriples(21),
        hand_right_keypoints_2d: transformed.handRight.length ? flattenKeypoints(transformed.handRight, 21) : zeroTriples(21),
      },
    ],
    canvas_width: canvas.width,
    canvas_height: canvas.height,
  };
}

export function withOpenpose(rig, options = {}) {
  const out = cloneRig(rig);
  out.openpose = rigToOpenposeJson(out, options);
  return out;
}

export function getRigStats(rig) {
  const src = cloneRig(rig);
  const visibleBody = src.body.filter((kp) => kp.visibility > 0).length;
  return {
    bodyCount: src.body.length,
    visibleBody,
    faceCount: src.face.length,
    leftHandCount: src.handLeft.length,
    rightHandCount: src.handRight.length,
    detectorStatus: src.detector?.status || 'unknown',
    detectorProvider: src.detector?.provider || 'unknown',
  };
}

function drawLine(ctx, a, b, rgb, width) {
  ctx.strokeStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
}

function drawDot(ctx, x, y, radius, rgb) {
  ctx.fillStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function triplesToPoints(triples) {
  const points = [];
  for (let i = 0; i < triples.length; i += 3) {
    points.push([finiteNumber(triples[i], 0), finiteNumber(triples[i + 1], 0), finiteNumber(triples[i + 2], 0)]);
  }
  return points;
}

export function renderOpenposeJsonToCanvas(canvas, openposeJson, { background = '#000000', alpha = false } = {}) {
  if (!canvas || typeof canvas.getContext !== 'function') return false;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  const width = finiteNumber(openposeJson?.canvas_width, canvas.width || 1024);
  const height = finiteNumber(openposeJson?.canvas_height, canvas.height || 1024);
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  if (background === 'transparent' || alpha) ctx.clearRect(0, 0, width, height);
  else {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
  }

  const person = openposeJson?.people?.[0] || null;
  if (!person) return true;
  const body = triplesToPoints(person.pose_keypoints_2d || []);
  for (let i = 0; i < LIMB_PAIRS.length; i += 1) {
    const [ai, bi] = LIMB_PAIRS[i];
    const a = body[ai];
    const b = body[bi];
    if (!a || !b || a[2] <= 0 || b[2] <= 0) continue;
    const bgr = LIMB_COLORS_BGR[i] || [255, 255, 255];
    drawLine(ctx, a, b, [bgr[2], bgr[1], bgr[0]], RENDER_DEFAULTS.bodyLineThickness);
  }
  for (const kp of body) {
    if (kp[2] > 0) drawDot(ctx, kp[0], kp[1], RENDER_DEFAULTS.bodyKeypointRadius, RENDER_DEFAULTS.bodyKeypointDotRgb);
  }

  const face = triplesToPoints(person.face_keypoints_2d || []);
  for (const kp of face) {
    if (kp[2] > 0) drawDot(ctx, kp[0], kp[1], RENDER_DEFAULTS.faceKeypointRadius, RENDER_DEFAULTS.faceKeypointDotRgb);
  }

  for (const field of ['hand_left_keypoints_2d', 'hand_right_keypoints_2d']) {
    const hand = triplesToPoints(person[field] || []);
    for (const [ai, bi] of HAND_CONNECTIONS) {
      const a = hand[ai];
      const b = hand[bi];
      if (!a || !b || a[2] <= 0 || b[2] <= 0) continue;
      drawLine(ctx, a, b, RENDER_DEFAULTS.handLineRgb, RENDER_DEFAULTS.handLineThickness);
    }
    for (const kp of hand) {
      if (kp[2] > 0) drawDot(ctx, kp[0], kp[1], RENDER_DEFAULTS.handKeypointRadius, RENDER_DEFAULTS.handKeypointDotRgb);
    }
  }
  return true;
}

export function renderRigToCanvas(canvas, rig, { yawDegrees = 0, headPose = null, calibration = null, background = '#000000', alpha = false } = {}) {
  const openposeJson = rigToOpenposeJson(rig, { yawDegrees, headPose, calibration });
  return renderOpenposeJsonToCanvas(canvas, openposeJson, { background, alpha });
}

export function openposeJsonText(rig, options = {}) {
  return JSON.stringify(rigToOpenposeJson(rig, options), null, 2);
}
