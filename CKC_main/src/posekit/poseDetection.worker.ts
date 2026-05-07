import { buildFallbackRig, fitFaceLandmarkerResultToFace70, fitPoseLandmarkerResultToRig, withOpenpose } from './core.mjs';
import ModuleFactory from '@mediapipe/tasks-vision/vision_wasm_module_internal.js';

const wasmModuleFactory =
  typeof ModuleFactory === 'function'
    ? ModuleFactory
    : ModuleFactory &&
        typeof ModuleFactory === 'object' &&
        'default' in ModuleFactory &&
        typeof ModuleFactory.default === 'function'
      ? ModuleFactory.default
      : null;

Object.assign(self, {
  ModuleFactory: wasmModuleFactory,
  custom_dbg: console.warn.bind(console),
});

type DetectRequest = {
  kind: 'detect';
  requestId: string;
  imageBitmap?: ImageBitmap;
  imageWidth?: number;
  imageHeight?: number;
  canvasWidth?: number;
  canvasHeight?: number;
  characterId?: string;
  portraitImageId?: string;
  poseModelAssetPath?: string;
  faceModelAssetPath?: string;
};

async function createTask<T>(
  create: (delegate: 'GPU' | 'CPU') => Promise<T>,
  close: (task: T) => void
): Promise<T> {
  let lastError: unknown = null;
  // CPU is the default for Electron automation: the GPU delegate can hang
  // Chromium's renderer/GPU process on some Windows driver stacks, while CPU
  // stays deterministic enough for one-shot image detection.
  for (const delegate of ['CPU'] as const) {
    let task: T | null = null;
    try {
      Object.assign(self, {
        ModuleFactory: wasmModuleFactory,
        Module: undefined,
        custom_dbg: console.warn.bind(console),
      });
      task = await create(delegate);
      return task;
    } catch (err) {
      lastError = err;
      if (task) {
        try {
          close(task);
        } catch {
          // Ignore cleanup failure from a half-created MediaPipe task.
        }
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError || 'MediaPipe task creation failed.'));
}

async function runMediapipe(request: DetectRequest) {
  if (!request.imageBitmap) {
    throw new Error('Pose worker could not create an image bitmap from the selected image.');
  }
  if (!request.poseModelAssetPath) {
    throw new Error('MediaPipe model assets are not configured.');
  }

  const vision = await import('@mediapipe/tasks-vision');
  const wasmBinaryPath =
    self.location.protocol === 'file:'
      ? new URL('../wasm/vision_wasm_module_internal.wasm', import.meta.url).href
      : new URL('/wasm/vision_wasm_module_internal.wasm', self.location.origin).href;
  const fileset = {
    wasmLoaderPath: '',
    wasmBinaryPath,
  };
  const pose = await createTask(
    (delegate) =>
      vision.PoseLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: request.poseModelAssetPath,
          delegate,
        },
        runningMode: 'IMAGE',
        numPoses: 1,
        outputSegmentationMasks: false,
      }),
    (task) => task.close()
  );
  let face: { detect: (image: ImageBitmap) => unknown; close: () => void } | null = null;
  try {
    if (request.faceModelAssetPath) {
      face = await createTask(
        (delegate) =>
          vision.FaceLandmarker.createFromOptions(fileset, {
            baseOptions: {
              modelAssetPath: request.faceModelAssetPath,
              delegate,
            },
            runningMode: 'IMAGE',
            numFaces: 1,
            outputFaceBlendshapes: false,
            outputFacialTransformationMatrixes: false,
          }),
        (task) => task.close()
      );
    }
    const poseResult = pose.detect(request.imageBitmap);
    const rig = fitPoseLandmarkerResultToRig({
      poseResult,
      imageWidth: request.imageWidth,
      imageHeight: request.imageHeight,
      canvasWidth: request.canvasWidth,
      canvasHeight: request.canvasHeight,
      characterId: request.characterId,
      portraitImageId: request.portraitImageId,
    });
    if (face) {
      const faceResult = face.detect(request.imageBitmap);
      const face70 = fitFaceLandmarkerResultToFace70({
        faceResult,
        canvasWidth: request.canvasWidth,
        canvasHeight: request.canvasHeight,
      });
      if (face70.length) {
        rig.face = face70;
        rig.detector.provider = 'mediapipe.tasks-vision.pose+face';
      }
    }
    return withOpenpose(rig);
  } finally {
    pose.close();
    face?.close();
  }
}

function fallback(request: DetectRequest, detail: string) {
  const rig = buildFallbackRig({
    imageWidth: request.imageWidth,
    imageHeight: request.imageHeight,
    canvasWidth: request.canvasWidth,
    canvasHeight: request.canvasHeight,
    characterId: request.characterId,
    portraitImageId: request.portraitImageId,
    source: 'fallback',
  });
  rig.detector.detail = detail;
  return withOpenpose(rig);
}

self.onmessage = async (event: MessageEvent<DetectRequest>) => {
  const request = event.data;
  if (!request || request.kind !== 'detect') return;
  const startedAt = performance.now();
  try {
    let rig: unknown = null;
    let usedFallback = false;
    try {
      rig = await runMediapipe(request);
    } catch (err) {
      usedFallback = true;
      rig = fallback(request, err instanceof Error ? err.message : String(err));
    }
    request.imageBitmap?.close?.();
    self.postMessage({
      kind: 'result',
      requestId: request.requestId,
      rig,
      fallback: usedFallback,
      durationMs: Math.round(performance.now() - startedAt),
    });
  } catch (err) {
    request.imageBitmap?.close?.();
    self.postMessage({
      kind: 'error',
      requestId: request.requestId,
      error: err instanceof Error ? err.message : String(err),
      durationMs: Math.round(performance.now() - startedAt),
    });
  }
};
