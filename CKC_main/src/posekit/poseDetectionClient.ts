import { buildFallbackRig, withOpenpose } from './core.mjs';

type DetectPoseParams = {
  image: HTMLImageElement;
  characterId?: string | null;
  portraitImageId?: string | null;
  canvasWidth?: number;
  canvasHeight?: number;
  timeoutMs?: number;
  poseModelAssetPath?: string | null;
  faceModelAssetPath?: string | null;
};

type WorkerResult = {
  kind: 'result' | 'error';
  requestId: string;
  rig?: unknown;
  fallback?: boolean;
  durationMs?: number;
  error?: string;
};

function randomRequestId(): string {
  return `pose_${Date.now().toString(36)}_${Math.random().toString(16).slice(2)}`;
}

function fallbackRig(params: DetectPoseParams, detail: string) {
  const rig = buildFallbackRig({
    imageWidth: params.image.naturalWidth || params.image.width || 1024,
    imageHeight: params.image.naturalHeight || params.image.height || 1024,
    canvasWidth: params.canvasWidth || 1024,
    canvasHeight: params.canvasHeight || 1024,
    characterId: params.characterId || '',
    portraitImageId: params.portraitImageId || '',
    source: 'fallback',
  });
  rig.detector.detail = detail;
  return withOpenpose(rig);
}

function defaultAssetUrl(fileName: string): string {
  return new URL(`posekit_models/${fileName}`, window.location.href).href;
}

async function imageBitmapFromElement(image: HTMLImageElement): Promise<ImageBitmap | null> {
  if (!image.complete && typeof image.decode === 'function') {
    try {
      await image.decode();
    } catch {
      // Fall through to the other bitmap paths; decode can reject for custom protocols.
    }
  }

  try {
    return await createImageBitmap(image);
  } catch {
    // Some Electron custom-protocol images do not survive the direct
    // HTMLImageElement path, even though the same URL is fetchable.
  }

  const src = image.currentSrc || image.src || '';
  if (src) {
    try {
      const response = await fetch(src);
      if (response.ok) {
        return await createImageBitmap(await response.blob());
      }
    } catch {
      // Canvas draw is the last renderer-side fallback.
    }
  }

  try {
    const width = image.naturalWidth || image.width || 1024;
    const height = image.naturalHeight || image.height || 1024;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0, width, height);
    return await createImageBitmap(canvas);
  } catch {
    return null;
  }
}

export async function detectPoseFromImage(params: DetectPoseParams): Promise<{
  rig: unknown;
  fallback: boolean;
  durationMs: number;
}> {
  const startedAt = performance.now();
  if (!params.image) {
    return {
      rig: fallbackRig(params, 'No image element was provided.'),
      fallback: true,
      durationMs: 0,
    };
  }

  if (typeof Worker === 'undefined') {
    return {
      rig: fallbackRig(params, 'Web Workers are not available in this renderer.'),
      fallback: true,
      durationMs: Math.round(performance.now() - startedAt),
    };
  }

  const requestId = randomRequestId();
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await imageBitmapFromElement(params.image);
  } catch {
    bitmap = null;
  }

  return new Promise((resolve) => {
    const worker = new Worker(new URL('./poseDetection.worker.ts', import.meta.url), { type: 'module' });
    const timeout = window.setTimeout(() => {
      worker.terminate();
      resolve({
        rig: fallbackRig(params, 'Pose worker timed out.'),
        fallback: true,
        durationMs: Math.round(performance.now() - startedAt),
      });
    }, Math.max(1000, params.timeoutMs || 15000));

    worker.onmessage = (event: MessageEvent<WorkerResult>) => {
      const payload = event.data;
      if (!payload || payload.requestId !== requestId) return;
      window.clearTimeout(timeout);
      worker.terminate();
      if (payload.kind === 'result' && payload.rig) {
        resolve({
          rig: payload.rig,
          fallback: !!payload.fallback,
          durationMs: Number(payload.durationMs) || Math.round(performance.now() - startedAt),
        });
        return;
      }
      resolve({
        rig: fallbackRig(params, payload.error || 'Pose worker failed.'),
        fallback: true,
        durationMs: Number(payload.durationMs) || Math.round(performance.now() - startedAt),
      });
    };

    worker.onerror = (event) => {
      window.clearTimeout(timeout);
      worker.terminate();
      resolve({
        rig: fallbackRig(params, event.message || 'Pose worker could not start.'),
        fallback: true,
        durationMs: Math.round(performance.now() - startedAt),
      });
    };

    const message = {
      kind: 'detect',
      requestId,
      imageBitmap: bitmap || undefined,
      imageWidth: params.image.naturalWidth || params.image.width || 1024,
      imageHeight: params.image.naturalHeight || params.image.height || 1024,
      canvasWidth: params.canvasWidth || 1024,
      canvasHeight: params.canvasHeight || 1024,
      characterId: params.characterId || '',
      portraitImageId: params.portraitImageId || '',
      poseModelAssetPath: params.poseModelAssetPath || defaultAssetUrl('pose_landmarker_lite.task'),
      faceModelAssetPath: params.faceModelAssetPath || defaultAssetUrl('face_landmarker.task'),
    };

    if (bitmap) worker.postMessage(message, [bitmap]);
    else worker.postMessage(message);
  });
}
