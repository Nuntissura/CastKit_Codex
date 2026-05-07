export type PoseKitKeypoint = {
  id: string;
  x: number;
  y: number;
  z: number;
  visibility: number;
  estimated: boolean;
};

export type PoseKitCalibration = {
  schemaVersion: 1;
  activeTool?: string;
  yaw?: number;
  headPose?: PoseKitHeadPose;
  perKeypoint: Record<
    string,
    {
      visible?: boolean;
      offsetXY?: [number, number];
      offsetZ?: number;
    }
  >;
  reframer: {
    scale: number;
    offsetX: number;
    offsetY: number;
    anchor: 'head' | 'canvas_center' | 'custom' | string;
    anchorPoint?: [number, number];
  };
  visibility: Record<string, boolean>;
};

export type PoseKitHeadPose = {
  schemaVersion: 1;
  order: 'YXZ';
  yaw: number;
  pitch: number;
  roll: number;
  quaternion: [number, number, number, number];
};

export type PoseKitRig = {
  schemaVersion: 1;
  subsystem: 'posekit';
  characterId: string;
  portraitImageId: string;
  image: { width: number; height: number };
  canvas: { width: number; height: number };
  body: PoseKitKeypoint[];
  face: PoseKitKeypoint[];
  handLeft: PoseKitKeypoint[];
  handRight: PoseKitKeypoint[];
  detector: {
    provider: string;
    status: string;
    detail?: string;
  };
  openpose: PoseKitOpenposeJson | null;
};

export type PoseKitOpenposePerson = {
  pose_keypoints_2d: number[];
  face_keypoints_2d: number[];
  hand_left_keypoints_2d: number[];
  hand_right_keypoints_2d: number[];
};

export type PoseKitOpenposeJson = {
  version: '1.0';
  people: PoseKitOpenposePerson[];
  canvas_width: number;
  canvas_height: number;
};

export type PoseKitRigStats = {
  bodyCount: number;
  visibleBody: number;
  faceCount: number;
  leftHandCount: number;
  rightHandCount: number;
  detectorStatus: string;
  detectorProvider: string;
};

export const BODY_18: ReadonlyArray<{ idx: number; id: string; mpIdx: number | null }>;
export const LIMB_PAIRS: ReadonlyArray<readonly [number, number]>;
export const LIMB_COLORS_BGR: ReadonlyArray<readonly [number, number, number]>;
export const HAND_CONNECTIONS: ReadonlyArray<readonly [number, number]>;
export const HAND_21: ReadonlyArray<{ idx: number; id: string }>;
export const MP_FACEMESH_TO_OPENPOSE_70: ReadonlyArray<number>;
export const RENDER_DEFAULTS: {
  bodyKeypointDotRgb: readonly [number, number, number];
  faceKeypointDotRgb: readonly [number, number, number];
  handKeypointDotRgb: readonly [number, number, number];
  handLineRgb: readonly [number, number, number];
  bodyLineThickness: number;
  handLineThickness: number;
  bodyKeypointRadius: number;
  faceKeypointRadius: number;
  handKeypointRadius: number;
};
export const YAW_BINS: ReadonlyArray<number>;
export const HEAD_POSE_ORDER: 'YXZ';
export const HEAD_POSE_LIMITS: {
  yaw: readonly [number, number];
  pitch: readonly [number, number];
  roll: readonly [number, number];
};

export function createDefaultCalibration(): PoseKitCalibration;
export function createHeadPose(params?: { yaw?: number; pitch?: number; roll?: number; order?: 'YXZ' }): PoseKitHeadPose;
export function normalizeHeadPose(value?: unknown): PoseKitHeadPose;
export function buildFallbackRig(params?: {
  imageWidth?: number;
  imageHeight?: number;
  canvasWidth?: number;
  canvasHeight?: number;
  characterId?: string;
  portraitImageId?: string;
  source?: string;
}): PoseKitRig;
export function fitPoseLandmarkerResultToRig(params?: {
  poseResult?: unknown;
  imageWidth?: number;
  imageHeight?: number;
  canvasWidth?: number;
  canvasHeight?: number;
  characterId?: string;
  portraitImageId?: string;
}): PoseKitRig;
export function fitFaceLandmarkerResultToFace70(params?: {
  faceResult?: unknown;
  canvasWidth?: number;
  canvasHeight?: number;
}): PoseKitKeypoint[];
export function fitHandLandmarkerResultToHands(params?: {
  handResult?: unknown;
  canvasWidth?: number;
  canvasHeight?: number;
  minHandDetectionConfidence?: number;
  minLandmarkConfidence?: number;
}): { handLeft: PoseKitKeypoint[]; handRight: PoseKitKeypoint[] };
export function getRigCanvas(rig: unknown): { width: number; height: number };
export function applyYaw(rig: unknown, yawDegrees?: number): PoseKitRig;
export function applyHeadRotation(
  rig: unknown,
  quaternion: [number, number, number, number] | { x?: number; y?: number; z?: number; w?: number },
  anchor?: [number, number] | [number, number, number] | null
): PoseKitRig;
export function applyHeadPose(
  rig: unknown,
  pose?: Partial<PoseKitHeadPose> | null,
  anchor?: [number, number] | [number, number, number] | null
): PoseKitRig;
export function applyCalibration(rig: unknown, calibration?: PoseKitCalibration | null): PoseKitRig;
export function rigToOpenposeJson(
  rig: unknown,
  options?: { yawDegrees?: number; headPose?: Partial<PoseKitHeadPose> | null; calibration?: PoseKitCalibration | null }
): PoseKitOpenposeJson;
export function withOpenpose(
  rig: unknown,
  options?: { yawDegrees?: number; headPose?: Partial<PoseKitHeadPose> | null; calibration?: PoseKitCalibration | null }
): PoseKitRig;
export function getRigStats(rig: unknown): PoseKitRigStats;
export function renderOpenposeJsonToCanvas(
  canvas: HTMLCanvasElement,
  openposeJson: PoseKitOpenposeJson,
  options?: { background?: string; alpha?: boolean }
): boolean;
export function renderRigToCanvas(
  canvas: HTMLCanvasElement,
  rig: unknown,
  options?: { yawDegrees?: number; headPose?: Partial<PoseKitHeadPose> | null; calibration?: PoseKitCalibration | null; background?: string; alpha?: boolean }
): boolean;
export function openposeJsonText(
  rig: unknown,
  options?: { yawDegrees?: number; headPose?: Partial<PoseKitHeadPose> | null; calibration?: PoseKitCalibration | null }
): string;
