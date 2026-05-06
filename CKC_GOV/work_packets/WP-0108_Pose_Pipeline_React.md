# Work Packet: WP-0108 - Pose pipeline (React + WASM, no Python)

Date: 2026-05-06
Owner: Codex
Status: DRAFT (depends on WP-0107)

## Summary
Build the actual pose pipeline inside CKC: drop a frontal portrait, run mediapipe pose + face_mesh in a Web Worker (WASM), fit them to a canonical openpose-style 3D rig, render the rig in a Three.js viewport with orbital camera inspection, render the openpose-format 2D output at the current yaw on a canvas, and let the operator calibrate per-marker visibility + position. Replaces OpenRepose's primary capability surface with a CKC-native React implementation.

No Python sidecar. No code copied from OpenRepose — only the keypoint taxonomy, bone connectivity, color palette, and design intent are reused (all embedded verbatim below).

---

## Why
After WP-0107 lands the schema + tab shells, the Pose tab is empty. This WP makes it useful: drop a portrait, get an openpose JSON+PNG suitable for ComfyUI input, scoped to a CKC character. Recreates the small-angle adherence + facial-feature preservation that drove OpenRepose's original creation, with the same 3D-vector-projection approach, but inside CKC's image library and character workflow. This is the load-bearing slice for the LoRA-training-pair pipeline that comes later.

---

## Pre-flight read list (mandatory)

| File | Lines | Why |
|---|---|---|
| `CKC_main/package.json` | full | Existing deps + Vite version. New deps land here. |
| `CKC_main/vite.config.ts` (or `vite.config.js`) | full | Vite plugin chain + asset handling. Worker + WASM config goes here. |
| `CKC_main/src/ui/views/PoseView.tsx` | full | The placeholder this WP replaces. Read first to understand the wrapper. |
| `CKC_main/src/ui/views/CharacterView.tsx` | 1062–1090 (saveSheet pattern), 240–310 (state setup) | Backend invocation pattern (`window.ckc.foo`). Mimic for `createRig`/`updateRigCalibration`. |
| `CKC_main/app/backend/library.js` | 1395–1500 | `_importCharacterTemplateImagesToCharacter` — exemplary backend write path with content-hash addressing. The pose-PNG export will follow the same pattern. |
| `CKC_main/app/backend/library.js` | 5604–5710 | `importImages` — content-hash addressing reference. |
| `CKC_main/app/main.js` | 1382–1402 | `automationCapture` IPC handler. The CDP screenshot pattern is similar to the openpose PNG export route. |
| `CKC_GOV/PROJECT_CODEX.md` | search "Identity decoupling" | Identity rule: openpose PNG filenames must be content-hash addressed. |
| `CKC_GOV/work_packets/WP-0107_Pose_Workflow_Schema_And_Shell.md` | full | The schema + stub commands this WP fills in. |
| `CKC_GOV/work_packets/WP-0106_Forward_Compat_Hardening.md` | full | Compat invariants this WP must respect. |

External docs:
- Mediapipe Pose JS: https://developers.google.com/mediapipe/solutions/vision/pose_landmarker/web_js
- Mediapipe Face Mesh JS: https://developers.google.com/mediapipe/solutions/vision/face_landmarker/web_js
- react-three-fiber: https://r3f.docs.pmnd.rs/
- Three.js OrbitControls (via @react-three/drei): https://drei.docs.pmnd.rs/

---

## Reference data (recreate from these — DO NOT import OpenRepose source)

The following constants are the OpenRepose contract, surveyed and embedded so this WP is self-contained. Cite `D:\Projects\LLM projects\OpenRepose\.product\src\openrepose\openpose_schema.py` and `.product\src\openrepose\render\draw_openpose.py` in the implementation comments, but do not import.

### Body 18 keypoint IDs and mediapipe Pose 33 mapping

```ts
// Index 0–17 of the openpose body 18 array. Each entry: { id, mpIdx } where
// mpIdx is the mediapipe POSE_LANDMARKS index. neck (id=1) is synthesized
// as the mean of mpIdx 11 (left_shoulder) and 12 (right_shoulder).
export const BODY_18 = [
  { idx: 0,  id: 'nose',           mpIdx: 0 },
  { idx: 1,  id: 'neck',           mpIdx: null }, // synthesized: mean(mp11, mp12)
  { idx: 2,  id: 'right_shoulder', mpIdx: 12 },
  { idx: 3,  id: 'right_elbow',    mpIdx: 14 },
  { idx: 4,  id: 'right_wrist',    mpIdx: 16 },
  { idx: 5,  id: 'left_shoulder',  mpIdx: 11 },
  { idx: 6,  id: 'left_elbow',     mpIdx: 13 },
  { idx: 7,  id: 'left_wrist',     mpIdx: 15 },
  { idx: 8,  id: 'right_hip',      mpIdx: 24 },
  { idx: 9,  id: 'right_knee',     mpIdx: 26 },
  { idx: 10, id: 'right_ankle',    mpIdx: 28 },
  { idx: 11, id: 'left_hip',       mpIdx: 23 },
  { idx: 12, id: 'left_knee',      mpIdx: 25 },
  { idx: 13, id: 'left_ankle',     mpIdx: 27 },
  { idx: 14, id: 'right_eye',      mpIdx: 5 },
  { idx: 15, id: 'left_eye',       mpIdx: 2 },
  { idx: 16, id: 'right_ear',      mpIdx: 8 },
  { idx: 17, id: 'left_ear',       mpIdx: 7 },
] as const;
```

### Bone connectivity (body 18 → openpose limb pairs)

```ts
// Index pairs into BODY_18; each pair gets one bone line in the openpose
// 2D render. Source: OpenRepose draw_openpose.py LIMB_PAIRS lines 40–58.
export const LIMB_PAIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 2],  [1, 5],  [2, 3],  [3, 4],  [5, 6],  [6, 7],
  [1, 8],  [8, 9],  [9, 10], [1, 11], [11, 12], [12, 13],
  [1, 0],  [0, 14], [14, 16], [0, 15], [15, 17],
];
```

### Bone color palette (canonical openpose, BGR → convert to RGB at use site)

```ts
// One color per LIMB_PAIRS entry, in BGR triplets to match the OpenPose
// canonical PNG output. Source: OpenRepose draw_openpose.py LIMB_COLORS_BGR
// lines 61–89. RGB at use site = [b, g, r] → [r, g, b].
export const LIMB_COLORS_BGR: ReadonlyArray<readonly [number, number, number]> = [
  [0,   0,   255],  // 0  red
  [0,   85,  255],
  [0,   170, 255],
  [0,   255, 255],  // 3  yellow
  [0,   255, 170],
  [0,   255, 85],
  [0,   255, 0],    // 6  green
  [85,  255, 0],
  [170, 255, 0],
  [255, 255, 0],    // 9  cyan
  [255, 170, 0],
  [255, 85,  0],
  [255, 0,   0],    // 12 blue
  [255, 0,   85],
  [255, 0,   170],
  [255, 0,   255],  // 15 magenta
  [170, 0,   255],
];

// Body keypoint dot color: white. Face dots: white. Hand dots: white.
// Hand line color: cyan (0,255,255). Body line thickness: 4 px. Hand line: 2 px.
// Body keypoint radius: 4 px. Face keypoint radius: 1 px. Hand keypoint radius: 2 px.
export const RENDER_DEFAULTS = {
  bodyKeypointDotRgb: [255, 255, 255] as const,
  faceKeypointDotRgb: [255, 255, 255] as const,
  handKeypointDotRgb: [255, 255, 255] as const,
  handLineRgb: [255, 255, 0] as const, // BGR (0,255,255) → RGB (255,255,0) ... no wait, BGR→RGB swap: (0,255,255) BGR = (255,255,0) RGB? — verify by quick test. The canonical OpenPose hand color is yellow per the OpenPose project, so RGB (255,255,0) is correct.
  bodyLineThickness: 4,
  handLineThickness: 2,
  bodyKeypointRadius: 4,
  faceKeypointRadius: 1,
  handKeypointRadius: 2,
} as const;
```

NOTE: BGR → RGB triplet swap — index 0 (red in BGR) is `[0,0,255]` → in RGB `[255,0,0]`. Implementation should do the swap once at the canvas drawing site, not store RGB upstream, to keep these constants byte-faithful to the OpenRepose / OpenPose canonical.

### Face 70 keypoint mapping (mediapipe FaceMesh → openpose face dlib-style)

The full 70-element index map (`MP_FACEMESH_TO_OPENPOSE_70`) lives in OpenRepose at `src/openrepose/openpose_schema.py` (search for the constant by name). Recreate as a typed const array of 70 mediapipe FaceMesh indices in `src/pose/faceMesh70.ts`. Indices 68 and 69 are the pupils — refined-landmarks indices 468 (right pupil) and 473 (left pupil).

If recreating the full mapping turns out to be load-bearing for early development: either (a) embed the dlib-68 + 2-pupil schema from the canonical OpenPose project's documentation, or (b) ship without face_mesh in WP-0108 and add it in a follow-up.  The body 18 + bone pairs above are sufficient for a functional 2D openpose PNG.

### Pose JSON output schema (canonical OpenPose JSON)

Format the pose viewport's export as standard OpenPose JSON. This is the format ComfyUI's openpose preprocessor expects.

```json
{
  "version": "1.0",
  "people": [
    {
      "pose_keypoints_2d": [x0, y0, conf0, x1, y1, conf1, /* ... 18 triples = 54 floats */],
      "face_keypoints_2d": [/* 70 triples = 210 floats; zeros where undetected */],
      "hand_left_keypoints_2d":  [/* 21 triples = 63 floats; zeros if no hand */],
      "hand_right_keypoints_2d": [/* 21 triples = 63 floats */]
    }
  ],
  "canvas_width":  1024,
  "canvas_height": 1024
}
```

Confidence per keypoint is the mediapipe `visibility` for body keypoints, `1.0` for face_mesh keypoints (mediapipe doesn't expose per-landmark confidence on face_mesh), and `0.0` for synthesized neck (mark as estimated). Undetected keypoints zero-fill as `[0, 0, 0]`.

### Calibration JSON shape

```ts
export type Calibration = {
  schemaVersion: 1;
  perKeypoint: Record<string, {
    visible: boolean;
    offsetXY?: [number, number];   // pixels, applied at 2D render time
    offsetZ?: number;              // scene-space units, applied at 3D render time
  }>;
  reframer: {
    scale: number;                 // [0.3, 2.0], default 1.0
    offsetX: number;               // pixels, [-2048, 2048]
    offsetY: number;               // pixels, [-2048, 2048]
    anchor: 'head' | 'canvas_center' | 'custom';
    anchorPoint?: [number, number]; // required only when anchor === 'custom'
  };
};
```

Default initialisation: `perKeypoint = {}` (all keypoints visible, no offsets); `reframer = { scale: 1, offsetX: 0, offsetY: 0, anchor: 'head' }`.

### Yaw rotation convention

- Positive degrees = avatar's head turns to **her left** (image-right).
- Rotation is around the **world Y axis** at the avatar's head/neck anchor.
- Angles are passed to internal math in **radians**; UI surfaces accept degrees.
- Right-hand rule applied. Standard rotation matrix:

```ts
function rotateAroundY(p: [number, number, number], rad: number, anchor: [number, number]): [number, number, number] {
  const [x, y, z] = p;
  const [cx, cz] = anchor;
  const c = Math.cos(rad), s = Math.sin(rad);
  return [
    c * (x - cx) - s * (z - cz) + cx,
    y,
    s * (x - cx) + c * (z - cz) + cz,
  ];
}
```

---

## Scope

### In

#### 1. New runtime dependencies (added to `CKC_main/package.json`)

```jsonc
{
  "dependencies": {
    // ... existing deps
    "@mediapipe/tasks-vision": "^0.10.18",
    "three": "^0.169.0",
    "@react-three/fiber": "^8.17.10",
    "@react-three/drei": "^9.115.0"
  },
  "devDependencies": {
    "@types/three": "^0.169.0"
  }
}
```

Why these: `@mediapipe/tasks-vision` is Google's modern unified package (replaces `@mediapipe/pose` + `@mediapipe/face_mesh` → both now via the `tasks-vision` runner). `three@0.169` is the latest stable that pairs cleanly with `@react-three/fiber@8.17`.

#### 2. Vite worker + WASM config (`vite.config.ts` adjustments)

The mediapipe runner expects to fetch its WASM blob over HTTP. Under packaged Electron (`file://`), this fails. The fix:

```ts
// In vite.config.ts (or vite.config.js):
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { copyFileSync, mkdirSync } from 'fs';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-mediapipe-wasm',
      apply: 'build',
      closeBundle() {
        // Copy the @mediapipe/tasks-vision wasm bundle into the bundled output
        // so the worker can resolve it from a relative file:// URL.
        const src = path.resolve('node_modules/@mediapipe/tasks-vision/wasm');
        const dst = path.resolve('../CKC_GOV/targets/scratch/renderer-dist/wasm');
        mkdirSync(dst, { recursive: true });
        for (const f of ['vision_wasm_internal.js', 'vision_wasm_internal.wasm', 'vision_wasm_nosimd_internal.js', 'vision_wasm_nosimd_internal.wasm']) {
          copyFileSync(path.join(src, f), path.join(dst, f));
        }
      },
    },
  ],
  base: './', // critical for Electron file:// loads — keep as-is
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        // Ensure worker chunks resolve relatively, not absolutely.
      },
    },
  },
  worker: {
    format: 'es',
  },
});
```

Worker invocation pattern (the only Vite-supported form that survives Electron packaging):

```ts
// In src/pose/poseDetectionClient.ts:
const worker = new Worker(
  new URL('../workers/poseDetection.worker.ts', import.meta.url),
  { type: 'module' }
);
```

In the worker file, override the FilesetResolver base URL to point at the copied wasm/ folder:

```ts
// src/workers/poseDetection.worker.ts
import { FilesetResolver, PoseLandmarker, FaceLandmarker } from '@mediapipe/tasks-vision';

let pose: PoseLandmarker | null = null;
let face: FaceLandmarker | null = null;

async function ensureRunners() {
  if (pose && face) return;
  // Resolve relative to the worker's URL, which inside packaged Electron
  // is something like file:///C:/.../resources/app.asar/dist/assets/poseDetection.worker.js
  // The wasm/ folder was copied by the Vite plugin into the same dist root.
  const wasmBase = new URL('../wasm', import.meta.url).href;
  const fileset = await FilesetResolver.forVisionTasks(wasmBase);

  // Model files (~10 MB total). Bundle them via the Vite asset pipeline:
  const poseModelUrl = new URL('../assets/models/pose_landmarker_full.task', import.meta.url).href;
  const faceModelUrl = new URL('../assets/models/face_landmarker.task', import.meta.url).href;

  pose = await PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: poseModelUrl, delegate: 'GPU' },
    runningMode: 'IMAGE',
    numPoses: 1,
    outputSegmentationMasks: false,
  });
  face = await FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: faceModelUrl, delegate: 'GPU' },
    runningMode: 'IMAGE',
    outputFacialTransformationMatrixes: false,
    outputFaceBlendshapes: false,
    numFaces: 1,
  });
}

self.onmessage = async (evt) => {
  const { kind, imageBytes, requestId } = evt.data;
  if (kind === 'detect') {
    try {
      await ensureRunners();
      const blob = new Blob([imageBytes]);
      const bitmap = await createImageBitmap(blob);
      const t0 = performance.now();
      const poseResult = pose!.detect(bitmap);
      const faceResult = face!.detect(bitmap);
      const durationMs = performance.now() - t0;
      self.postMessage({ kind: 'result', requestId, poseResult, faceResult, durationMs });
      bitmap.close();
    } catch (err) {
      self.postMessage({ kind: 'error', requestId, error: String((err as Error).message ?? err) });
    }
  }
};
```

Model download: pose_landmarker_full.task and face_landmarker.task ship in the renderer bundle under `src/assets/models/`. They are ~6 MB and ~3 MB respectively. Add to `package.json` postinstall script (or commit them) so they're in the repo.

#### 3. Canonical rig data model (`CKC_main/src/pose/rig.ts`)

Pure TypeScript. ~250 LOC.

```ts
import { BODY_18, LIMB_PAIRS, LIMB_COLORS_BGR } from './bodyTaxonomy';

export type Keypoint = {
  id: string;       // e.g. 'nose', 'right_shoulder'
  x: number;        // image-space px
  y: number;        // image-space px
  z: number;        // mediapipe-relative depth, [-0.5..0.5] roughly
  visibility: number; // [0..1]
  estimated: boolean; // true for synthesized keypoints (e.g. neck)
};

export type RigData = {
  schemaVersion: 1;
  body: Keypoint[];           // length 18
  face: Keypoint[];           // length 70 (or 0 if face_mesh deferred)
  handLeft?: Keypoint[];      // length 21 if available; omit otherwise
  handRight?: Keypoint[];     // length 21 if available; omit otherwise
  meta: {
    detectorVersion: string;  // mediapipe runner version string
    sourceWidth: number;
    sourceHeight: number;
    detectedAt: string;       // ISO 8601 UTC
    processingDurationMs: number;
  };
};

export function fitMediapipeToRig(
  poseResult: /* PoseLandmarker.detect return */ unknown,
  faceResult: /* FaceLandmarker.detect return */ unknown,
  imageWidth: number,
  imageHeight: number,
): RigData {
  // 1. Map mediapipe pose 33 → openpose body 18 per BODY_18 const.
  // 2. Synthesize neck (idx 1) as mean of pose[11] (left_shoulder) and pose[12] (right_shoulder).
  // 3. Map mediapipe FaceMesh refined 478 → openpose face 70 per faceMesh70.ts.
  // 4. Coordinates: convert mediapipe normalized [0,1] x/y to image-px.
  // 5. Z stays normalized (mediapipe relative).
  // 6. Visibility: copy from mediapipe pose; face uses 1.0; synthesized neck uses 0.5 + estimated:true.
  // ... (implementation ~80 LOC)
}

export function applyYaw(rig: RigData, yawRadians: number, anchor?: [number, number]): RigData {
  // anchor defaults to neck (body[1]) projected to world XZ plane:
  //   [neck.x - centerX, neck.z]
  // Apply rotateAroundY to every keypoint's (x, y, z); leave y untouched.
  // Returns a NEW rig — does not mutate input.
}

export function applyCalibration(rig: RigData, calibration: Calibration): RigData {
  // 1. Apply per-keypoint visible flag (multiplies visibility by 0 if !visible).
  // 2. Apply per-keypoint offsetXY (additive to x,y).
  // 3. Apply per-keypoint offsetZ (additive to z).
  // 4. Apply reframer: scale + offset around anchor.
}

import type { Calibration } from './calibration';

export function exportOpenposeJson(rig: RigData, options?: { yaw?: number; calibration?: Calibration }): string {
  // 1. Apply yaw + calibration.
  // 2. Flatten body to [x0, y0, conf0, x1, y1, conf1, ...].
  // 3. Same for face (zero-fill if absent), hands (zero-fill if absent).
  // 4. Wrap in canonical OpenPose JSON shape with version: "1.0", canvas_width/height from rig.meta.
  // 5. Return JSON.stringify(...).
}
```

#### 4. Worker client (`CKC_main/src/pose/poseDetectionClient.ts`)

Wraps the Web Worker with a Promise-based API. Returns `{ rig, durationMs }`.

```ts
let _worker: Worker | null = null;
const _pending = new Map<string, { resolve: (r: any) => void; reject: (e: unknown) => void }>();

function ensureWorker(): Worker {
  if (_worker) return _worker;
  _worker = new Worker(new URL('../workers/poseDetection.worker.ts', import.meta.url), { type: 'module' });
  _worker.onmessage = (e) => {
    const { requestId, kind } = e.data;
    const pending = _pending.get(requestId);
    if (!pending) return;
    _pending.delete(requestId);
    if (kind === 'error') pending.reject(new Error(e.data.error));
    else pending.resolve(e.data);
  };
  return _worker;
}

export async function detectPose(imageBytes: Uint8Array, sourceWidth: number, sourceHeight: number): Promise<{ rig: RigData; durationMs: number }> {
  const worker = ensureWorker();
  const requestId = `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  return new Promise((resolve, reject) => {
    _pending.set(requestId, { resolve: (data) => {
      const rig = fitMediapipeToRig(data.poseResult, data.faceResult, sourceWidth, sourceHeight);
      rig.meta.processingDurationMs = data.durationMs;
      resolve({ rig, durationMs: data.durationMs });
    }, reject });
    worker.postMessage({ kind: 'detect', imageBytes, requestId }, [imageBytes.buffer]);
  });
}
```

#### 5. 3D viewport (`CKC_main/src/ui/components/Pose3DViewport.tsx`)

react-three-fiber pattern (declarative; mostly JSX):

```tsx
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import React from 'react';
import type { RigData } from '../../pose/rig';
import { LIMB_PAIRS } from '../../pose/bodyTaxonomy';

function Keypoints({ rig }: { rig: RigData }) {
  return (
    <group>
      {rig.body.map((kp, i) => (
        <mesh key={`body-${i}`} position={[kp.x, -kp.y, kp.z * 100]}>
          <sphereGeometry args={[6, 8, 8]} />
          <meshBasicMaterial color={kp.estimated ? 'orange' : 'white'} />
        </mesh>
      ))}
    </group>
  );
}

function Bones({ rig }: { rig: RigData }) {
  return (
    <group>
      {LIMB_PAIRS.map(([a, b], i) => {
        const ka = rig.body[a], kb = rig.body[b];
        if (!ka || !kb) return null;
        const points = [
          new THREE.Vector3(ka.x, -ka.y, ka.z * 100),
          new THREE.Vector3(kb.x, -kb.y, kb.z * 100),
        ];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        return (
          <line key={`bone-${i}`} geometry={geometry}>
            <lineBasicMaterial color="white" linewidth={2} />
          </line>
        );
      })}
    </group>
  );
}

export function Pose3DViewport({ rig, yaw }: { rig: RigData; yaw: number }) {
  // yaw is applied at the rig level (applyYaw upstream); this component
  // just renders whatever rig it receives. Camera state is owned by OrbitControls.
  return (
    <Canvas camera={{ position: [0, 0, 800], fov: 45 }} style={{ background: '#101418' }}>
      <ambientLight intensity={0.5} />
      <Keypoints rig={rig} />
      <Bones rig={rig} />
      <OrbitControls makeDefault enablePan enableRotate enableZoom />
    </Canvas>
  );
}
```

Y is inverted (image y grows downward; scene y grows upward). Z is scaled ×100 for visibility.

#### 6. 2D openpose viewport (`CKC_main/src/ui/components/Pose2DViewport.tsx`)

HTML canvas; renders one frame per state change.

```tsx
import React from 'react';
import type { RigData } from '../../pose/rig';
import { LIMB_PAIRS, LIMB_COLORS_BGR, RENDER_DEFAULTS } from '../../pose/bodyTaxonomy';
import { applyYaw, applyCalibration } from '../../pose/rig';
import type { Calibration } from '../../pose/calibration';

export function Pose2DViewport({
  rig, yaw, calibration, width, height,
}: {
  rig: RigData;
  yaw: number;
  calibration: Calibration;
  width: number;
  height: number;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    const transformed = applyCalibration(applyYaw(rig, yaw), calibration);

    // Bones
    ctx.lineCap = 'round';
    for (let i = 0; i < LIMB_PAIRS.length; i++) {
      const [a, b] = LIMB_PAIRS[i];
      const ka = transformed.body[a], kb = transformed.body[b];
      if (!ka || !kb) continue;
      if (ka.visibility <= 0 || kb.visibility <= 0) continue;
      const [bg, gg, rg] = LIMB_COLORS_BGR[i]; // BGR
      ctx.strokeStyle = `rgb(${rg}, ${gg}, ${bg})`; // RGB swap at use site
      ctx.lineWidth = RENDER_DEFAULTS.bodyLineThickness;
      ctx.beginPath();
      ctx.moveTo(ka.x, ka.y);
      ctx.lineTo(kb.x, kb.y);
      ctx.stroke();
    }

    // Keypoints
    ctx.fillStyle = `rgb(${RENDER_DEFAULTS.bodyKeypointDotRgb.join(',')})`;
    for (const kp of transformed.body) {
      if (kp.visibility <= 0) continue;
      ctx.beginPath();
      ctx.arc(kp.x, kp.y, RENDER_DEFAULTS.bodyKeypointRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Face dots
    ctx.fillStyle = `rgb(${RENDER_DEFAULTS.faceKeypointDotRgb.join(',')})`;
    for (const kp of transformed.face) {
      if (kp.visibility <= 0) continue;
      ctx.beginPath();
      ctx.arc(kp.x, kp.y, RENDER_DEFAULTS.faceKeypointRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hands omitted in this slice; future WP.
  }, [rig, yaw, calibration, width, height]);

  return <canvas ref={canvasRef} width={width} height={height} style={{ width: '100%', height: 'auto', background: '#000' }} />;
}
```

Export to PNG: extract via `canvas.toBlob('image/png')` once the frame is rendered. `exportOpenposePng` helper:

```ts
export function exportOpenposePngBlob(rig: RigData, yaw: number, calibration: Calibration, width: number, height: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    // ... duplicate the render logic above against this off-screen canvas
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('toBlob returned null')), 'image/png');
  });
}
```

Determinism: every input → same canvas state → same byte output (canvas + toBlob is deterministic for the same browser version; pin via the test).

#### 7. Calibration / Markers / Reframer panels

Three React components in `src/ui/components/`:

- `CalibrationPanel.tsx` — a list of every keypoint with: visibility checkbox, X offset slider [-50..+50], Y offset slider, Z offset slider. Renders ~30 rows; collapsible by region (body/face/hands).
- `MarkersPanel.tsx` — same data but visibility-only, fewer rows, faster to scan.
- `ReframerPanel.tsx` — four controls (scale, offsetX, offsetY, anchor radio). Live binding to the parent's `calibration` state.

All three accept `{ calibration, onChange }` props. The parent (Pose tab) holds the `Calibration` object in `useState`, debounces a save by 500 ms, and POSTs to `updateRigCalibration` via `window.ckc`.

Auto-save:

```ts
const [calibration, setCalibration] = React.useState<Calibration>(initialCalibration);
React.useEffect(() => {
  if (!rigId) return;
  const t = setTimeout(() => {
    window.ckc.updateRigCalibration({ rigId, calibrationJson: JSON.stringify(calibration) });
  }, 500);
  return () => clearTimeout(t);
}, [calibration, rigId]);
```

#### 8. Backend wiring (replaces WP-0107 stubs in `CKC_main/app/backend/library.js`)

```js
// Replace the WP-0107 createRig stub with the real impl:
async createRig({ characterId, portraitImageId, poseJson } = {}) {
  const cid = String(characterId ?? '').trim();
  const pid = String(portraitImageId ?? '').trim();
  if (!cid) throw new Error('createRig: characterId is required');
  if (!pid) throw new Error('createRig: portraitImageId is required');
  if (!poseJson || typeof poseJson !== 'string') throw new Error('createRig: poseJson is required');

  // Validate pose JSON shape (fail-fast).
  let parsed;
  try { parsed = JSON.parse(poseJson); } catch { throw new Error('createRig: poseJson is not valid JSON'); }
  if (!parsed.schemaVersion || !Array.isArray(parsed.body)) {
    throw new Error('createRig: poseJson does not match RigData schema');
  }

  const rigId = randomId('rig_');
  await run(
    this.db,
    `INSERT INTO Rig(rig_id, character_id, portrait_image_id, pose_json) VALUES(?, ?, ?, ?)`,
    [rigId, cid, pid, poseJson]
  );
  await this._audit('rig.create', cid, { rigId, portraitImageId: pid });
  return { ok: true, rigId };
}

async updateRigCalibration({ rigId, calibrationJson } = {}) {
  const rid = String(rigId ?? '').trim();
  if (!rid) throw new Error('updateRigCalibration: rigId is required');
  const cj = String(calibrationJson ?? '');
  if (!cj.trim()) throw new Error('updateRigCalibration: calibrationJson is required');
  try { JSON.parse(cj); } catch { throw new Error('updateRigCalibration: calibrationJson is not valid JSON'); }
  await run(
    this.db,
    `UPDATE Rig SET calibration_json = ?, updated_at = CURRENT_TIMESTAMP WHERE rig_id = ?`,
    [cj, rid]
  );
  return { ok: true, rigId: rid };
}

async setRigPortrait({ rigId, portraitImageId } = {}) {
  const rid = String(rigId ?? '').trim();
  const pid = String(portraitImageId ?? '').trim();
  if (!rid || !pid) throw new Error('setRigPortrait: rigId and portraitImageId are required');
  await run(this.db, `UPDATE Rig SET portrait_image_id = ?, updated_at = CURRENT_TIMESTAMP WHERE rig_id = ?`, [pid, rid]);
  return { ok: true };
}

// New backend method to persist the exported openpose PNG. The renderer
// produces a Buffer (from canvas.toBlob), passes it via IPC; this writes
// it under characters/<id>/images/openpose/<hashPrefix>.png and creates
// an ImageAsset row linked to the rig.
async exportOpenposePng({ rigId, pngBytes } = {}) {
  const rid = String(rigId ?? '').trim();
  if (!rid) throw new Error('exportOpenposePng: rigId is required');
  if (!Buffer.isBuffer(pngBytes)) throw new Error('exportOpenposePng: pngBytes must be a Buffer');

  const rig = await this.getRig({ rigId: rid });
  if (!rig) throw new Error(`exportOpenposePng: rigId ${rid} not found`);
  const cid = rig.character_id;
  const paths = this.getCharacterPaths(cid);
  const opDir = path.join(paths.base, 'images', 'openpose');
  ensureDir(opDir);

  const fileHash = sha256Hex(pngBytes);
  const hashPrefix = fileHash.slice(0, 16);
  const fileName = `${hashPrefix}.png`;
  const dest = path.join(opDir, fileName);
  fs.writeFileSync(dest, pngBytes);

  const rel = path.posix.join('images', 'openpose', fileName);
  const imageId = randomId('img_');
  await run(
    this.db,
    `INSERT INTO ImageAsset(image_id, character_id, relative_path, file_hash, favorite, rating, notes, tags_json, storage_mode, source_note, openpose_png_path, rig_id)
     VALUES(?, ?, ?, ?, 0, 0, '', '[]', 'copy', 'openpose export', ?, ?)`,
    [imageId, cid, rel, fileHash, rel, rid]
  );
  await this._audit('rig.exportOpenposePng', cid, { rigId: rid, imageId, fileHash });
  return { ok: true, imageId, relativePath: rel, fileHash };
}
```

Add `setRigPortrait` and `exportOpenposePng` to:
- preload.js
- vite-env.d.ts
- main.js IPC handlers
- automationCommandMap (`backend` array)
- automationManual feature group commands list

Same pattern as WP-0107.

#### 9. Pose tab UI assembly

Replace `src/ui/views/PoseView.tsx` body:

```tsx
import React from 'react';
import styles from './poseView.module.css';
import { Pose3DViewport } from '../components/Pose3DViewport';
import { Pose2DViewport, exportOpenposePngBlob } from '../components/Pose2DViewport';
import { CalibrationPanel } from '../components/CalibrationPanel';
import { MarkersPanel } from '../components/MarkersPanel';
import { ReframerPanel } from '../components/ReframerPanel';
import { detectPose } from '../../pose/poseDetectionClient';
import type { RigData } from '../../pose/rig';
import type { Calibration } from '../../pose/calibration';

export function PoseView({ onBack, characterId, portraitImageId }: {
  onBack: () => void;
  characterId?: string;
  portraitImageId?: string;
}) {
  const [rigId, setRigId] = React.useState<string | null>(null);
  const [rig, setRig] = React.useState<RigData | null>(null);
  const [yaw, setYaw] = React.useState<number>(0);
  const [calibration, setCalibration] = React.useState<Calibration>(/* default */);
  const [activePanel, setActivePanel] = React.useState<'calibration' | 'markers' | 'reframer'>('calibration');

  // Drag-drop, detect, save flow:
  const onPortraitDrop = async (file: File) => {
    const buf = new Uint8Array(await file.arrayBuffer());
    const img = await createImageBitmap(new Blob([buf]));
    const { rig } = await detectPose(buf, img.width, img.height);
    setRig(rig);
    if (characterId && portraitImageId) {
      const r: any = await window.ckc.createRig({ characterId, portraitImageId, poseJson: JSON.stringify(rig) });
      if (r?.ok) setRigId(r.rigId);
    }
  };

  // ... layout: sidebar with panel buttons + ActivePanel; center with 3D + 2D; right with yaw + export.
}
```

#### 10. Tests

`test/pose_rig_math.test.js` (Node test runner):

```js
const test = require('node:test');
const assert = require('node:assert/strict');

// Use a small fixture mediapipe output. Ship at test/fixtures/pose/aeri_face_0.json
const fixture = require('./fixtures/pose/aeri_face_0.json');

// Import the rig module — it's pure TS but compile via ts-node or pre-build to .js for tests.
// Simpler: ship a JS-export shim at app/backend/posemath.js that re-exports rig math
// for tests, and the renderer also imports it via vite's TS support.
const { fitMediapipeToRig, applyYaw } = require('../app/backend/posemath');

test('fitMediapipeToRig: body has 18 keypoints', () => {
  const rig = fitMediapipeToRig(fixture.poseResult, fixture.faceResult, 1024, 1024);
  assert.equal(rig.body.length, 18);
});

test('applyYaw: 0 radians = identity', () => {
  const rig = fitMediapipeToRig(fixture.poseResult, fixture.faceResult, 1024, 1024);
  const out = applyYaw(rig, 0);
  for (let i = 0; i < rig.body.length; i++) {
    assert.equal(out.body[i].x, rig.body[i].x);
  }
});

test('applyYaw: 90° rotates nose to expected position', () => { /* ... */ });
test('applyCalibration: invisible flag zeroes visibility', () => { /* ... */ });
test('exportOpenposeJson: shape matches canonical OpenPose JSON', () => { /* ... */ });
```

Move pose math to `app/backend/posemath.js` (CommonJS) so backend tests can import without a bundler. The renderer imports from `src/pose/rig.ts` (TS wrapper that re-exports the JS module).

`test/pose_export_png_invariants.test.js` — uses `node-canvas` (already an Electron dep) to render a fixture rig + assert SHA-256 stability.

`test/backend_rig_lifecycle.test.js` — full `createRig` / `updateRigCalibration` / `setRigPortrait` round-trip on PG + SQLite (use the existing fixture pattern from `test/backend_character_scripts.test.js`).

Test fixture (`test/fixtures/pose/aeri_face_0.json`): produced by running detectPose on Aeri's master_base portrait once, captured as static JSON. ~5 KB.

#### 11. Spec bump (next available). Manual MANUAL_VERSION → `'2026-05-06.wp-0108'`. Test suite Section M.4 filled in with check rows for every shipped surface.

#### 12. Ship as packaged build. v0.2.12.

### Out

- ComfyUI integration (the "Replay in ComfyUI" button is wired in WP-0109; this WP renders it disabled).
- Multi-image batch yaw export (drag a folder, get N openpose PNGs at -90°→+90° in 15° increments). Slot for future.
- Hand pose detection (mediapipe Hands runner). Slot for future.
- Custom keypoint set authoring. Slot for future.
- Animation / interpolation between rigs. Out of scope.
- LoRA training pair extraction. Out of scope.

---

## Acceptance criteria

- [ ] Drop a 1024×1024 portrait into the Pose tab → mediapipe pose + face_mesh runs in the worker → `RigData` materializes within 1 second on a typical operator machine; UI thread does not block during inference (verify by attempting a UI interaction during detection).
- [ ] 3D viewport renders the rig with all 33 body + 70 face keypoints (or all 33 body if face_mesh deferred); orbital camera works smoothly; yaw slider rotates the rig (NOT the camera).
- [ ] 2D openpose viewport renders the canonical openpose colors at the current yaw; flipping yaw to ±90° clamps face_mesh keypoints to the visible hemisphere (or omits face entirely if face_mesh deferred).
- [ ] Calibration / Markers / Reframer panels live-update both viewports; auto-save persists changes to `Rig.calibration_json` within 1 second of last edit.
- [ ] Export openpose PNG produces a deterministic file (same SHA-256 across runs given the same inputs); file lands at `characters/<id>/images/openpose/<hash>.png`; `ImageAsset` row created with `openpose_png_path` populated and `rig_id` linking back to the source rig.
- [ ] `Rig`-related backend commands (`createRig`, `updateRigCalibration`, `setRigPortrait`, `exportOpenposePng`) wired through preload + main.js + automation map + manual + vite-env.d.ts.
- [ ] All new tests pass; existing tests still pass.
- [ ] Spec bumped, manual bumped, test suite Section M.4 filled in.
- [ ] `npm run package:win` produces v0.2.12; smoke against the packaged build verifies pose detection (worker WASM resolves correctly), viewports render, export works.

---

## Test plan

- **Unit (math)**: rig math + yaw + calibration with fixture inputs.
- **Unit (worker)**: detection round-trip on a tiny image (with WASM available).
- **Unit (backend)**: rig lifecycle CRUD on both providers.
- **Smoke (manual, dev)**: full pipeline on Aeri's master_base portrait. Compare 0° / +15° / -15° / +90° outputs visually.
- **Smoke (manual, packaged)**: same flow on v0.2.12 NSIS install — specifically verify WASM loads under `file://`.

---

## Governance checklist

- [ ] Task Board: WP-0108 → IN_PROGRESS / DONE.
- [ ] Spec bump + archive.
- [ ] Codex bullet referencing the OpenRepose absorption rule.
- [ ] Planning-checkpoint commit pushed before code changes.
- [ ] Shipping-checkpoint commit after impl.
- [ ] In-app manual updated in same commit.
- [ ] Test suite Section M.4 filled.
- [ ] Live verification via CDP — captures of Pose tab with rig loaded, 3D viewport at multiple yaws, 2D viewport at multiple yaws, exported openpose PNG.
- [ ] NAS mirror backup script run after shipping commit.

---

## Implementation notes

- The face_mesh path is the most expensive part of WP-0108. If timeline pressure builds, ship body-only first and put face in a follow-up. Body-only still produces a valid OpenPose JSON (face_keypoints_2d = zero-filled 210 floats).
- WASM in packaged Electron is the highest-risk slice. Validate the packaging recipe early — build the installer with a minimal "load mediapipe and detect a 1×1 px image" smoke before doing anything else.
- The keypoint taxonomy is embedded above. Recreate `src/pose/bodyTaxonomy.ts` from those constants. Cite OpenRepose's `openpose_schema.py` and `draw_openpose.py` in implementation comments for authority, but no source-file copy.
- `node-canvas` is already pulled in transitively by Electron; verify before using it in `pose_export_png_invariants.test.js`. If not, use `pixelmatch` against a pre-rendered baseline.
- Identity decoupling: openpose PNGs land at `characters/<id>/images/openpose/<hash>.png`; never include character name. The export path is content-hash-addressed exactly like `importImages`.
- The "Replay in ComfyUI" button is rendered disabled with a tooltip pointing at WP-0109. Don't try to wire it here.

---

## Risks / mitigations

- **Risk**: mediapipe WASM doesn't load cleanly under Electron's `file://` packaging. **Mitigation**: the asset-copy Vite plugin + `FilesetResolver.forVisionTasks(wasmBase)` override above. Validate against a smoke build before writing the rest of the WP.
- **Risk**: 3D viewport perf on integrated GPUs. **Mitigation**: react-three-fiber + instanced sphere geometry; frame budget cap via `useFrame` invalidate-only-on-change pattern. Default to 60 fps; degrade to 30 fps on detected slow GPU.
- **Risk**: pose detection fails on stylized portraits (anime, painted). **Mitigation**: ship the manual calibration path as recovery — operator places keypoints by hand on the 2D viewport (click-to-set mode) and the 3D viewport reflects. (This is also OpenRepose's escape hatch.)
- **Risk**: yaw rotation distorts face_mesh in unflattering ways at extreme angles. **Mitigation**: face_mesh keypoints clamped to visible hemisphere; document the tradeoff; future WP could add per-yaw retargeting.
- **Risk**: `exportOpenposePngBlob` produces non-deterministic bytes due to canvas implementation differences. **Mitigation**: pin Electron version; the test asserts byte stability across runs on the SAME build, not across builds.

---

## Rollback

Revert the WP commit. Pose tab returns to the WP-0107 placeholder. `Rig` rows already created stay valid (their `pose_json` is opaque and survives schema-level read; the renderer just won't display them until WP-0108 lands again).
