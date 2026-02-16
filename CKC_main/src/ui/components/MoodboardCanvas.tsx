import React from 'react';
import styles from './moodboardCanvas.module.css';

type MoodboardTool =
  | 'pen'
  | 'line'
  | 'arrow'
  | 'rect'
  | 'ellipse'
  | 'eraser'
  | 'move'
  | 'transform'
  | 'text'
  | 'shape'
  | 'connector'
  | 'bucket'
  | 'gradient';
type MoodboardDrawTool = 'pen' | 'line' | 'arrow' | 'rect' | 'ellipse' | 'eraser';

function randomHex(bytes = 8): string {
  try {
    const arr = new Uint8Array(bytes);
    crypto.getRandomValues(arr);
    return Array.from(arr)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return Math.random().toString(16).slice(2);
  }
}

export function makeMoodId(prefix: string): string {
  return `${prefix}${randomHex(12)}`;
}

export type MoodboardStroke = {
  tool: MoodboardDrawTool;
  color: string;
  size: number;
  points: Array<{ x: number; y: number }>; // normalized 0..1
};

export type MoodboardBlendMode = 'normal' | 'multiply' | 'screen';

export type MoodboardShadowStyle = {
  color?: string; // prefer #RRGGBB
  opacity?: number; // 0..1
  blur?: number; // px
  offsetX?: number; // px
  offsetY?: number; // px
};

export type MoodboardOutlineStyle = {
  color?: string; // prefer #RRGGBB
  width?: number; // px
};

export type MoodboardLayerStyle = {
  opacity?: number; // 0..1
  blend?: MoodboardBlendMode;
  shadow?: MoodboardShadowStyle;
  outline?: MoodboardOutlineStyle;
};

export type MoodboardImage = {
  id: string;
  imageId: string;
  x: number; // normalized center x
  y: number; // normalized center y
  w: number; // normalized width
  h: number; // normalized height
  rot?: number; // degrees (clockwise)
  z?: number; // z-order (higher draws on top)
  name?: string;
  folderId?: string;
  tags?: string[];
  style?: MoodboardLayerStyle;
  mask?: { shapeId: string }; // clip this image to a shape frame (optional)
  groupId?: string;
  hidden?: boolean;
  locked?: boolean;
};

export type MoodboardText = {
  id: string;
  x: number; // normalized center x
  y: number; // normalized center y
  w: number; // normalized width
  h: number; // normalized height
  rot?: number; // degrees (clockwise)
  z?: number; // z-order (higher draws on top)
  name?: string;
  folderId?: string;
  tags?: string[];
  style?: MoodboardLayerStyle;
  text: string;
  fontSize?: number; // px
  color?: string; // CSS color (prefer #RRGGBB)
  bg?: string; // CSS color (prefer #RRGGBB)
  groupId?: string;
  hidden?: boolean;
  locked?: boolean;
};

export type MoodboardFill =
  | { kind: 'none' }
  | { kind: 'solid'; color: string }
  | { kind: 'gradient'; from: string; to: string; angle: number; mode?: 'linear' | 'radial' };

export type MoodboardShape = {
  id: string;
  shape: 'rect' | 'ellipse';
  x: number; // normalized center x
  y: number; // normalized center y
  w: number; // normalized width
  h: number; // normalized height
  rot?: number; // degrees (clockwise)
  z?: number; // z-order (higher draws on top)
  fill?: MoodboardFill;
  stroke?: { color: string; width: number };
  name?: string;
  folderId?: string;
  tags?: string[];
  style?: MoodboardLayerStyle;
  groupId?: string;
  hidden?: boolean;
  locked?: boolean;
};

export type MoodboardConnector = {
  id: string;
  kind: 'line' | 'arrow';
  ax: number; // normalized endpoint A x
  ay: number; // normalized endpoint A y
  bx: number; // normalized endpoint B x
  by: number; // normalized endpoint B y
  z?: number; // z-order (higher draws on top)
  color?: string; // CSS color (prefer #RRGGBB)
  width?: number; // px
  name?: string;
  folderId?: string;
  tags?: string[];
  style?: MoodboardLayerStyle;
  groupId?: string;
  hidden?: boolean;
  locked?: boolean;
};

export type MoodboardGuide = {
  id: string;
  axis: 'x' | 'y';
  pos: number; // normalized 0..1
  hidden?: boolean;
  locked?: boolean;
};

export type MoodboardFolder = {
  id: string;
  name: string;
  parentId?: string;
  hidden?: boolean;
  locked?: boolean;
};

export type MoodboardState = {
  version: 1;
  background?:
    | { kind: 'paper' }
    | { kind: 'solid'; color: string }
    | { kind: 'gradient'; from: string; to: string; angle: number; mode?: 'linear' | 'radial' };
  strokes: MoodboardStroke[];
  shapes?: MoodboardShape[];
  connectors?: MoodboardConnector[];
  images: MoodboardImage[];
  texts?: MoodboardText[];
  guides?: MoodboardGuide[];
  folders?: MoodboardFolder[];
  strokesHidden?: boolean;
  strokesLocked?: boolean;
};

type ResizeHandle = 'nw' | 'ne' | 'se' | 'sw';
type MoodboardItemKind = 'image' | 'text' | 'shape' | 'connector';
type SelectedItem = { kind: MoodboardItemKind; id: string };
type Selection = SelectedItem[];

type ClipboardItem =
  | { kind: 'shape'; item: MoodboardShape; z: number }
  | { kind: 'connector'; item: MoodboardConnector; z: number }
  | { kind: 'image'; item: MoodboardImage; z: number }
  | { kind: 'text'; item: MoodboardText; z: number };
type ClipboardPayload = {
  items: ClipboardItem[];
  bounds: { left: number; top: number; right: number; bottom: number; cx: number; cy: number };
};

const KIND_Z_BASE: Record<MoodboardItemKind, number> = {
  shape: 0,
  connector: 500,
  image: 1000,
  text: 2000,
};

function zFor(kind: MoodboardItemKind, index: number, z: unknown): number {
  const n = Number(z);
  return Number.isFinite(n) ? n : KIND_Z_BASE[kind] + index;
}

function compareZAsc(
  a: { kind: MoodboardItemKind; index: number; z: number },
  b: { kind: MoodboardItemKind; index: number; z: number }
): number {
  if (a.z !== b.z) return a.z - b.z;
  const ba = KIND_Z_BASE[a.kind];
  const bb = KIND_Z_BASE[b.kind];
  if (ba !== bb) return ba - bb;
  return a.index - b.index;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function clampRange(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function normalizeBlendMode(value: unknown): MoodboardBlendMode {
  const s = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (s === 'multiply') return 'multiply';
  if (s === 'screen') return 'screen';
  return 'normal';
}

function canvasCompositeForBlend(blend: MoodboardBlendMode): GlobalCompositeOperation {
  if (blend === 'multiply') return 'multiply';
  if (blend === 'screen') return 'screen';
  return 'source-over';
}

function parseHexRgb(hex: string): null | { r: number; g: number; b: number } {
  const raw = typeof hex === 'string' ? hex.trim() : '';
  if (!raw) return null;
  const m = raw.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!m) return null;
  let h = m[1] as string;
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = Number.parseInt(h, 16);
  if (!Number.isFinite(n)) return null;
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

function rgbaFromHex(hex: string, alpha: number): string {
  const rgb = parseHexRgb(hex);
  const a = clampRange(Number(alpha) || 0, 0, 1);
  if (!rgb) return `rgba(0,0,0,${a})`;
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${a})`;
}

function cleanLayerStyle(style: MoodboardLayerStyle | undefined): MoodboardLayerStyle | undefined {
  if (!style) return undefined;
  const out: MoodboardLayerStyle = { ...style };

  if (out.opacity != null) {
    const op = clampRange(Number(out.opacity) || 0, 0, 1);
    if (op >= 0.999) delete out.opacity;
    else out.opacity = op;
  }

  if (out.blend != null) {
    const blend = normalizeBlendMode(out.blend);
    if (blend === 'normal') delete out.blend;
    else out.blend = blend;
  }

  if (out.shadow != null) {
    const shIn = out.shadow;
    const blur = Math.max(0, Number(shIn?.blur) || 0);
    const offsetX = Number(shIn?.offsetX) || 0;
    const offsetY = Number(shIn?.offsetY) || 0;
    const opacity = clampRange(Number(shIn?.opacity) || 0, 0, 1);
    const color = typeof shIn?.color === 'string' && shIn.color.trim() ? shIn.color.trim() : '#000000';

    if (opacity <= 0 || (blur <= 0 && !offsetX && !offsetY)) delete out.shadow;
    else out.shadow = { color, opacity, blur, offsetX, offsetY };
  }

  if (out.outline != null) {
    const olIn = out.outline;
    const width = Math.max(0, Number(olIn?.width) || 0);
    const color = typeof olIn?.color === 'string' && olIn.color.trim() ? olIn.color.trim() : '#111111';
    if (width <= 0) delete out.outline;
    else out.outline = { color, width };
  }

  if (!out.opacity && !out.blend && !out.shadow && !out.outline) return undefined;
  return out;
}

function normalizeAngleDeg(deg: number): number {
  const n = Number(deg);
  if (!Number.isFinite(n)) return 0;
  let d = n % 360;
  if (d < 0) d += 360;
  if (Object.is(d, -0)) d = 0;
  return d;
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toLocalXY(x: number, y: number, cx: number, cy: number, rotDeg: number): { x: number; y: number } {
  const rot = normalizeAngleDeg(rotDeg);
  if (!rot) return { x: x - cx, y: y - cy };
  const rad = degToRad(rot);
  const cos = Math.cos(-rad);
  const sin = Math.sin(-rad);
  const dx = x - cx;
  const dy = y - cy;
  return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
}

function fromLocalXY(x: number, y: number, cx: number, cy: number, rotDeg: number): { x: number; y: number } {
  const rot = normalizeAngleDeg(rotDeg);
  if (!rot) return { x: cx + x, y: cy + y };
  const rad = degToRad(rot);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { x: cx + x * cos - y * sin, y: cy + x * sin + y * cos };
}

function pointInRotatedRect(pt: { x: number; y: number }, box: { x: number; y: number; w: number; h: number; rot?: number }): boolean {
  const w = Number(box.w) || 0;
  const h = Number(box.h) || 0;
  if (w <= 0 || h <= 0) return false;
  const cx = Number(box.x) || 0;
  const cy = Number(box.y) || 0;
  const rotDeg = Number((box as any).rot) || 0;
  const local = toLocalXY(pt.x, pt.y, cx, cy, rotDeg);
  return Math.abs(local.x) <= w / 2 && Math.abs(local.y) <= h / 2;
}

function pointInRotatedEllipse(pt: { x: number; y: number }, box: { x: number; y: number; w: number; h: number; rot?: number }): boolean {
  const w = Number(box.w) || 0;
  const h = Number(box.h) || 0;
  if (w <= 0 || h <= 0) return false;
  const cx = Number(box.x) || 0;
  const cy = Number(box.y) || 0;
  const rotDeg = Number((box as any).rot) || 0;
  const local = toLocalXY(pt.x, pt.y, cx, cy, rotDeg);
  const rx = w / 2;
  const ry = h / 2;
  if (rx <= 0 || ry <= 0) return false;
  const nx = local.x / rx;
  const ny = local.y / ry;
  return nx * nx + ny * ny <= 1;
}

function bestSnapDelta(
  targets: number[],
  points: number[],
  tol: number
): null | { delta: number; line: number } {
  if (!Number.isFinite(tol) || tol <= 0) return null;
  let bestAbs = Infinity;
  let bestDelta = 0;
  let bestLine = 0;
  for (const t of targets) {
    const tt = Number(t);
    if (!Number.isFinite(tt)) continue;
    for (const p of points) {
      const pp = Number(p);
      if (!Number.isFinite(pp)) continue;
      const d = tt - pp;
      const ad = Math.abs(d);
      if (ad <= tol && ad < bestAbs) {
        bestAbs = ad;
        bestDelta = d;
        bestLine = tt;
      }
    }
  }
  return bestAbs < Infinity ? { delta: bestDelta, line: bestLine } : null;
}

function computeEffectiveFolderFlags(folders: MoodboardFolder[]): Map<string, { hidden: boolean; locked: boolean }> {
  const list = Array.isArray(folders) ? folders : [];
  const byId = new Map<string, MoodboardFolder>();
  for (const f of list) {
    if (!f || typeof f.id !== 'string' || !f.id.trim()) continue;
    byId.set(f.id, f);
  }

  const memo = new Map<string, { hidden: boolean; locked: boolean }>();
  const visiting = new Set<string>();
  const visit = (id: string): { hidden: boolean; locked: boolean } => {
    const known = memo.get(id);
    if (known) return known;
    if (visiting.has(id)) {
      const f = byId.get(id);
      const out = { hidden: !!f?.hidden, locked: !!f?.locked };
      memo.set(id, out);
      return out;
    }
    const f = byId.get(id);
    if (!f) {
      const out = { hidden: false, locked: false };
      memo.set(id, out);
      return out;
    }
    visiting.add(id);
    const parentId = typeof f.parentId === 'string' && f.parentId.trim() ? f.parentId.trim() : '';
    const parent = parentId ? visit(parentId) : { hidden: false, locked: false };
    visiting.delete(id);
    const out = { hidden: parent.hidden || !!f.hidden, locked: parent.locked || !!f.locked };
    memo.set(id, out);
    return out;
  };

  for (const id of byId.keys()) visit(id);
  return memo;
}

function folderIdOf(item: any): string {
  return typeof item?.folderId === 'string' ? item.folderId.trim() : '';
}

function isItemEffectivelyHidden(item: any, folderFlags: Map<string, { hidden: boolean; locked: boolean }>): boolean {
  if (!item) return true;
  if (item.hidden) return true;
  const fid = folderIdOf(item);
  if (!fid) return false;
  return !!folderFlags.get(fid)?.hidden;
}

function isItemEffectivelyLocked(item: any, folderFlags: Map<string, { hidden: boolean; locked: boolean }>): boolean {
  if (!item) return false;
  if (item.locked) return true;
  const fid = folderIdOf(item);
  if (!fid) return false;
  return !!folderFlags.get(fid)?.locked;
}

function normalizeTagList(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const out: string[] = [];
  for (const t of tags) {
    const s = typeof t === 'string' ? t.trim() : '';
    if (!s) continue;
    out.push(s);
  }
  return out;
}

function parseTagsInput(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

type ViewTransform = { zoom: number; panX: number; panY: number };

function pointFromEvent(evt: PointerEvent, canvas: HTMLCanvasElement, view?: ViewTransform): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
  const sx = evt.clientX - rect.left;
  const sy = evt.clientY - rect.top;

  if (view && (view.zoom !== 1 || view.panX !== 0 || view.panY !== 0)) {
    const zoom = Math.max(0.01, Number(view.zoom) || 1);
    const panX = Number(view.panX) || 0;
    const panY = Number(view.panY) || 0;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const px = (sx - cx - panX) / zoom + cx;
    const py = (sy - cy - panY) / zoom + cy;
    return { x: clamp01(px / rect.width), y: clamp01(py / rect.height) };
  }

  return { x: clamp01(sx / rect.width), y: clamp01(sy / rect.height) };
}

function pointFromClient(clientX: number, clientY: number, canvas: HTMLCanvasElement, view?: ViewTransform): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
  const sx = clientX - rect.left;
  const sy = clientY - rect.top;

  if (view && (view.zoom !== 1 || view.panX !== 0 || view.panY !== 0)) {
    const zoom = Math.max(0.01, Number(view.zoom) || 1);
    const panX = Number(view.panX) || 0;
    const panY = Number(view.panY) || 0;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const px = (sx - cx - panX) / zoom + cx;
    const py = (sy - cy - panY) / zoom + cy;
    return { x: clamp01(px / rect.width), y: clamp01(py / rect.height) };
  }

  return { x: clamp01(sx / rect.width), y: clamp01(sy / rect.height) };
}

function normalizeMoodboardState(value: MoodboardState): MoodboardState {
  const images = Array.isArray(value.images) ? value.images : [];
  const texts = Array.isArray(value.texts) ? value.texts : [];
  const rawShapes = (value as any)?.shapes;
  const shapes = Array.isArray(rawShapes) ? (rawShapes as MoodboardShape[]) : [];
  const rawConnectors = (value as any)?.connectors;
  const connectors = Array.isArray(rawConnectors) ? (rawConnectors as MoodboardConnector[]) : [];
  const rawGuides = (value as any)?.guides;
  const guides = Array.isArray(rawGuides) ? (rawGuides as MoodboardGuide[]) : [];
  const rawFolders = (value as any)?.folders;
  const folders = Array.isArray(rawFolders) ? (rawFolders as MoodboardFolder[]) : [];
  let changed = false;
  const nextImages = images.map((img) => {
    if (img && typeof img.id === 'string' && img.id.trim().length) return img;
    changed = true;
    return { ...(img as any), id: makeMoodId('mbi_') } as MoodboardImage;
  });

  const nextShapes = shapes.map((s: any) => {
    const hasId = !!(s && typeof s.id === 'string' && s.id.trim().length);
    const shape = s?.shape === 'ellipse' ? 'ellipse' : 'rect';
    if (hasId && (s?.shape === 'rect' || s?.shape === 'ellipse')) return s as MoodboardShape;
    changed = true;
    return { ...(s as any), id: hasId ? String(s.id) : makeMoodId('mbs_'), shape } as MoodboardShape;
  });

  const nextConnectors = connectors.map((c: any) => {
    const hasId = !!(c && typeof c.id === 'string' && c.id.trim().length);
    const kind = c?.kind === 'arrow' ? 'arrow' : 'line';
    if (hasId && (c?.kind === 'line' || c?.kind === 'arrow')) return c as MoodboardConnector;
    changed = true;
    return { ...(c as any), id: hasId ? String(c.id) : makeMoodId('mbc_'), kind } as MoodboardConnector;
  });

  const nextTexts = texts.map((t) => {
    const hasId = !!(t && typeof t.id === 'string' && t.id.trim().length);
    const nextText = typeof (t as any)?.text === 'string' ? String((t as any).text) : '';
    if (hasId && typeof (t as any)?.text === 'string') return t;
    changed = true;
    return { ...(t as any), id: hasId ? (t as any).id : makeMoodId('mbt_'), text: nextText } as MoodboardText;
  });

  const nextGuides = guides.map((g: any) => {
    const hasId = !!(g && typeof g.id === 'string' && g.id.trim().length);
    const axis = g?.axis === 'y' ? 'y' : 'x';
    const pos = clamp01(Number(g?.pos) || 0);
    if (hasId && (g?.axis === 'x' || g?.axis === 'y') && Number.isFinite(Number(g?.pos))) return g as MoodboardGuide;
    changed = true;
    return { ...(g as any), id: hasId ? String(g.id) : makeMoodId('mbg_'), axis, pos } as MoodboardGuide;
  });

  const nextFolders = folders.map((f: any) => {
    const hasId = !!(f && typeof f.id === 'string' && f.id.trim().length);
    const name = typeof f?.name === 'string' && f.name.trim() ? String(f.name) : 'Folder';
    const parentId = typeof f?.parentId === 'string' && f.parentId.trim() ? String(f.parentId) : undefined;
    if (hasId && typeof f?.name === 'string') return f as MoodboardFolder;
    changed = true;
    return { ...(f as any), id: hasId ? String(f.id) : makeMoodId('mbf_'), name, parentId } as MoodboardFolder;
  });

  if (rawShapes !== undefined && !Array.isArray(rawShapes)) changed = true;
  if (rawConnectors !== undefined && !Array.isArray(rawConnectors)) changed = true;
  if (rawGuides !== undefined && !Array.isArray(rawGuides)) changed = true;
  if (rawFolders !== undefined && !Array.isArray(rawFolders)) changed = true;
  if (!changed) return value;
  const next: MoodboardState = { ...value, images: nextImages };
  if (shapes.length || rawShapes !== undefined) next.shapes = nextShapes;
  if (connectors.length || rawConnectors !== undefined) next.connectors = nextConnectors;
  if (texts.length || value.texts) next.texts = nextTexts;
  if (guides.length || rawGuides !== undefined) next.guides = nextGuides;
  if (folders.length || rawFolders !== undefined) next.folders = nextFolders;
  return next;
}

export function MoodboardCanvas({
  value,
  onChange,
  onRequestAddImage,
  canvasRefOverride,
}: {
  value: MoodboardState;
  onChange: (next: MoodboardState) => void;
  onRequestAddImage?: () => void;
  canvasRefOverride?: React.RefObject<HTMLCanvasElement | null>;
}) {
  const internalCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const canvasRef = canvasRefOverride ?? internalCanvasRef;
  const drawingRef = React.useRef<boolean>(false);
  const strokeRef = React.useRef<MoodboardStroke | null>(null);
  const imageCacheRef = React.useRef<Map<string, HTMLImageElement>>(new Map());
  const dragRef = React.useRef<
    | null
    | {
        startPt: { x: number; y: number };
        startState: MoodboardState;
        units: Array<{
          key: string;
          kind: 'group' | 'item';
          groupId?: string;
          bounds: { left: number; top: number; right: number; bottom: number; cx: number; cy: number; w: number; h: number };
          items: Array<
            | { kind: 'connector'; id: string; startAX: number; startAY: number; startBX: number; startBY: number }
            | { kind: Exclude<MoodboardItemKind, 'connector'>; id: string; startX: number; startY: number }
          >;
        }>;
        moved: boolean;
      }
  >(null);
  const resizeRef = React.useRef<
    | null
    | {
        kind: 'item';
        itemKind: Exclude<MoodboardItemKind, 'connector'>;
        id: string;
        handle: ResizeHandle;
        startItem: MoodboardImage | MoodboardText | MoodboardShape;
        startState: MoodboardState;
        moved: boolean;
      }
    | {
        kind: 'group';
        groupId: string;
        handle: ResizeHandle;
        startBounds: { left: number; top: number; right: number; bottom: number; cx: number; cy: number; w: number; h: number };
        startItems: Array<
          | { kind: 'connector'; id: string; ax: number; ay: number; bx: number; by: number; locked?: boolean }
          | { kind: Exclude<MoodboardItemKind, 'connector'>; id: string; x: number; y: number; w: number; h: number; locked?: boolean }
        >;
        startState: MoodboardState;
        moved: boolean;
      }
  >(null);
  const rotateRef = React.useRef<
    | null
    | {
        itemKind: Exclude<MoodboardItemKind, 'connector'>;
        id: string;
        startItem: MoodboardImage | MoodboardText | MoodboardShape;
        startState: MoodboardState;
        startAngleRad: number;
        startRotDeg: number;
        moved: boolean;
      }
  >(null);
  const valueRef = React.useRef<MoodboardState>(value);
  const toolRef = React.useRef<MoodboardTool>('pen');
  const sizeRef = React.useRef<number>(3);
  const colorRef = React.useRef<string>('#111111');
  const shapeKindRef = React.useRef<'rect' | 'ellipse'>('rect');
  const connectorKindRef = React.useRef<'line' | 'arrow'>('line');
  const gradientToRef = React.useRef<string>('#ffffff');
  const gradientAngleRef = React.useRef<number>(0);
  const gradientModeRef = React.useRef<'linear' | 'radial'>('linear');
  const selectionRef = React.useRef<Selection>([]);
  const internalChangeRef = React.useRef<MoodboardState | null>(null);
  const historyPastRef = React.useRef<MoodboardState[]>([]);
  const historyFutureRef = React.useRef<MoodboardState[]>([]);
  const gradientDragRef = React.useRef<
    null | {
      startPt: { x: number; y: number };
      startState: MoodboardState;
      moved: boolean;
      lastAngle: number;
      target: 'background' | 'shapes';
      shapeIds?: string[];
    }
  >(null);
  const shapeDragRef = React.useRef<
    null | { startPt: { x: number; y: number }; startState: MoodboardState; shapeId: string; shape: 'rect' | 'ellipse'; moved: boolean }
  >(null);
  const connectorDragRef = React.useRef<
    null | { startPt: { x: number; y: number }; startState: MoodboardState; connectorId: string; moved: boolean }
  >(null);
  const connectorEditRef = React.useRef<
    null | { startState: MoodboardState; connectorId: string; endpoint: 'a' | 'b'; moved: boolean }
  >(null);
  const viewRef = React.useRef<ViewTransform>({ zoom: 1, panX: 0, panY: 0 });
  const panDragRef = React.useRef<null | { startSX: number; startSY: number; startPanX: number; startPanY: number }>(null);
  const isSpaceDownRef = React.useRef<boolean>(false);
  const gridRef = React.useRef<boolean>(false);
  const snapRef = React.useRef<boolean>(false);
  const snapGuidesRef = React.useRef<boolean>(true);
  const snapObjectsRef = React.useRef<boolean>(true);
  const boxSelectRef = React.useRef<
    null | { startPt: { x: number; y: number }; curPt: { x: number; y: number }; startSel: Selection; additive: boolean; moved: boolean }
  >(null);
  const clipboardRef = React.useRef<ClipboardPayload | null>(null);
  const pasteSerialRef = React.useRef<number>(0);
  const contextMenuElRef = React.useRef<HTMLDivElement | null>(null);
  const guideDragRef = React.useRef<null | { guideId: string; axis: 'x' | 'y'; startState: MoodboardState; moved: boolean }>(null);
  const snapPreviewRef = React.useRef<null | { xs: number[]; ys: number[] }>(null);

  const [tool, setTool] = React.useState<MoodboardTool>('pen');
  const [size, setSize] = React.useState<number>(3);
  const [color, setColor] = React.useState<string>('#111111');
  const [shapeKind, setShapeKind] = React.useState<'rect' | 'ellipse'>('rect');
  const [connectorKind, setConnectorKind] = React.useState<'line' | 'arrow'>('line');
  const [gradientTo, setGradientTo] = React.useState<string>('#ffffff');
  const [gradientAngle, setGradientAngle] = React.useState<number>(0);
  const [gradientMode, setGradientMode] = React.useState<'linear' | 'radial'>('linear');
  const [viewZoom, setViewZoom] = React.useState<number>(1);
  const [showGrid, setShowGrid] = React.useState<boolean>(false);
  const [snapToGrid, setSnapToGrid] = React.useState<boolean>(false);
  const [selection, setSelection] = React.useState<Selection>([]);
  const [showLayers, setShowLayers] = React.useState<boolean>(false);
  const [layersSearch, setLayersSearch] = React.useState<string>('');
  const [moveSelectionFolderPick, setMoveSelectionFolderPick] = React.useState<string>('');
  const [activeFolderId, setActiveFolderId] = React.useState<string>('');
  const [collapsedFolderIds, setCollapsedFolderIds] = React.useState<Set<string>>(() => new Set());
  const [showInspector, setShowInspector] = React.useState<boolean>(false);
  const [showRulers, setShowRulers] = React.useState<boolean>(false);
  const [snapGuides, setSnapGuides] = React.useState<boolean>(true);
  const [snapObjects, setSnapObjects] = React.useState<boolean>(true);
  const [contextMenu, setContextMenu] = React.useState<null | { x: number; y: number }>(null);
  const [, setHistoryVersion] = React.useState<number>(0);

  const canUndo = historyPastRef.current.length > 0;
  const canRedo = historyFutureRef.current.length > 0;

  const pushHistory = React.useCallback((prev: MoodboardState) => {
    historyPastRef.current.push(prev);
    if (historyPastRef.current.length > 80) historyPastRef.current.shift();
    historyFutureRef.current = [];
    setHistoryVersion((v) => (v + 1) % 1_000_000);
  }, []);

  React.useEffect(() => {
    const normalized = normalizeMoodboardState(value);
    const prev = valueRef.current;
    const isInternal = internalChangeRef.current === value;
    if (isInternal) internalChangeRef.current = null;
    valueRef.current = normalized;
    if (normalized !== value) {
      internalChangeRef.current = normalized;
      onChange(normalized);
      return;
    }
    if (!isInternal && prev !== value) pushHistory(prev);
  }, [value, onChange, pushHistory]);

  React.useEffect(() => {
    toolRef.current = tool;
    if (tool !== 'move' && tool !== 'transform') dragRef.current = null;
    if (tool !== 'transform') resizeRef.current = null;
    if (tool !== 'transform') rotateRef.current = null;
    if (tool !== 'transform') connectorEditRef.current = null;
    if (tool !== 'gradient') gradientDragRef.current = null;
    if (tool !== 'shape') shapeDragRef.current = null;
    if (tool !== 'connector') connectorDragRef.current = null;
    if (tool !== 'move') boxSelectRef.current = null;
    if (tool !== 'move' && tool !== 'transform') guideDragRef.current = null;
    snapPreviewRef.current = null;
    setContextMenu(null);
  }, [tool]);

  React.useEffect(() => {
    sizeRef.current = size;
  }, [size]);

  React.useEffect(() => {
    colorRef.current = color;
  }, [color]);

  React.useEffect(() => {
    shapeKindRef.current = shapeKind;
  }, [shapeKind]);

  React.useEffect(() => {
    connectorKindRef.current = connectorKind;
  }, [connectorKind]);

  React.useEffect(() => {
    gradientToRef.current = gradientTo;
  }, [gradientTo]);

  React.useEffect(() => {
    gradientAngleRef.current = gradientAngle;
  }, [gradientAngle]);

  React.useEffect(() => {
    gradientModeRef.current = gradientMode;
  }, [gradientMode]);

  React.useEffect(() => {
    if (!selection.length) return;
    const images = Array.isArray(value.images) ? value.images : [];
    const texts = Array.isArray(value.texts) ? value.texts : [];
    const shapes = Array.isArray(value.shapes) ? value.shapes : [];
    const connectors = Array.isArray(value.connectors) ? value.connectors : [];
    const imageById = new Map(images.map((img) => [img.id, img]));
    const textById = new Map(texts.map((t) => [t.id, t]));
    const shapeById = new Map(shapes.map((s) => [s.id, s]));
    const connectorById = new Map(connectors.map((c) => [c.id, c]));
    const folderFlags = computeEffectiveFolderFlags(Array.isArray(value.folders) ? value.folders : []);
    const next = selection.filter((sel) => {
      const it =
        sel.kind === 'image'
          ? imageById.get(sel.id)
          : sel.kind === 'text'
            ? textById.get(sel.id)
            : sel.kind === 'shape'
              ? shapeById.get(sel.id)
              : connectorById.get(sel.id);
      return !!it && !isItemEffectivelyHidden(it, folderFlags);
    });
    if (next.length === selection.length && next.every((x, i) => x.kind === selection[i].kind && x.id === selection[i].id)) return;
    selectionRef.current = next;
    setSelection(next);
  }, [selection, value.images, value.texts, value.shapes, value.connectors, value.folders]);

  const redraw = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const current = valueRef.current;
    const shapes = Array.isArray(current.shapes) ? current.shapes : [];
    const connectors = Array.isArray(current.connectors) ? current.connectors : [];
    const images = Array.isArray(current.images) ? current.images : [];
    const texts = Array.isArray(current.texts) ? current.texts : [];
    const strokes = Array.isArray(current.strokes) ? current.strokes : [];
    const shapeById = new Map(shapes.map((s) => [s.id, s]));
    const connectorById = new Map(connectors.map((c) => [c.id, c]));
    const imageById = new Map(images.map((img) => [img.id, img]));
    const textById = new Map(texts.map((t) => [t.id, t]));
    const maskShapeIds = new Set<string>();
    for (const img of images) {
      const sid = (img as any)?.mask?.shapeId;
      if (typeof sid === 'string' && sid.trim()) maskShapeIds.add(sid);
    }

    const folderFlags = computeEffectiveFolderFlags(Array.isArray(current.folders) ? current.folders : []);
    const isHidden = (item: any): boolean => isItemEffectivelyHidden(item, folderFlags);
    const isLocked = (item: any): boolean => isItemEffectivelyLocked(item, folderFlags);

    const selection = Array.isArray(selectionRef.current) ? selectionRef.current : [];
    const groupIds = new Set<string>();
    for (const sel of selection) {
      const item =
        sel.kind === 'image'
          ? imageById.get(sel.id)
          : sel.kind === 'text'
            ? textById.get(sel.id)
            : sel.kind === 'shape'
              ? shapeById.get(sel.id)
              : connectorById.get(sel.id);
      const gid = String((item as any)?.groupId ?? '').trim();
      if (gid) groupIds.add(gid);
    }

    const selectionUnits: Array<{ kind: 'group' | 'item'; key: string; bounds: { left: number; top: number; right: number; bottom: number } }> = [];
    for (const gid of groupIds) {
      const members: Array<MoodboardImage | MoodboardText | MoodboardShape | MoodboardConnector> = [];
      for (const c of connectors) if (c && !isHidden(c) && String((c as any).groupId ?? '') === gid) members.push(c);
      for (const s of shapes) if (s && !isHidden(s) && String((s as any).groupId ?? '') === gid) members.push(s);
      for (const img of images) if (img && !isHidden(img) && String((img as any).groupId ?? '') === gid) members.push(img);
      for (const t of texts) if (t && !isHidden(t) && String((t as any).groupId ?? '') === gid) members.push(t);
      if (!members.length) continue;
      let left = Infinity;
      let top = Infinity;
      let right = -Infinity;
      let bottom = -Infinity;
      for (const m of members) {
        if ((m as any).ax !== undefined && (m as any).bx !== undefined) {
          const ax = Number((m as any).ax) || 0;
          const ay = Number((m as any).ay) || 0;
          const bx = Number((m as any).bx) || 0;
          const by = Number((m as any).by) || 0;
          left = Math.min(left, Math.min(ax, bx));
          top = Math.min(top, Math.min(ay, by));
          right = Math.max(right, Math.max(ax, bx));
          bottom = Math.max(bottom, Math.max(ay, by));
        } else {
          const cx = Number((m as any).x) || 0;
          const cy = Number((m as any).y) || 0;
          const w = Number((m as any).w) || 0;
          const h = Number((m as any).h) || 0;
          left = Math.min(left, cx - w / 2);
          top = Math.min(top, cy - h / 2);
          right = Math.max(right, cx + w / 2);
          bottom = Math.max(bottom, cy + h / 2);
        }
      }
      selectionUnits.push({ kind: 'group', key: `g:${gid}`, bounds: { left, top, right, bottom } });
    }

    for (const sel of selection) {
      const item =
        sel.kind === 'image'
          ? imageById.get(sel.id)
          : sel.kind === 'text'
            ? textById.get(sel.id)
            : sel.kind === 'shape'
              ? shapeById.get(sel.id)
              : connectorById.get(sel.id);
      if (!item || isHidden(item)) continue;
      const gid = String((item as any).groupId ?? '').trim();
      if (gid && groupIds.has(gid)) continue; // covered by group unit
      if (sel.kind === 'connector') {
        const ax = Number((item as any).ax) || 0;
        const ay = Number((item as any).ay) || 0;
        const bx = Number((item as any).bx) || 0;
        const by = Number((item as any).by) || 0;
        selectionUnits.push({
          kind: 'item',
          key: `${sel.kind}:${sel.id}`,
          bounds: { left: Math.min(ax, bx), top: Math.min(ay, by), right: Math.max(ax, bx), bottom: Math.max(ay, by) },
        });
      } else {
        const cx = Number((item as any).x) || 0;
        const cy = Number((item as any).y) || 0;
        const w = Number((item as any).w) || 0;
        const h = Number((item as any).h) || 0;
        selectionUnits.push({
          kind: 'item',
          key: `${sel.kind}:${sel.id}`,
          bounds: { left: cx - w / 2, top: cy - h / 2, right: cx + w / 2, bottom: cy + h / 2 },
        });
      }
    }

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);

    const view = viewRef.current;
    const zoom = Math.max(0.25, Math.min(6, Number(view.zoom) || 1));
    const invZoom = 1 / zoom;
    const panX = Number(view.panX) || 0;
    const panY = Number(view.panY) || 0;

    // Always fill the full viewport so panning/zooming never reveals transparency.
    ctx.fillStyle = 'rgba(253, 245, 230, 0.96)';
    ctx.fillRect(0, 0, rect.width, rect.height);

    ctx.save();
    ctx.translate(rect.width / 2 + panX, rect.height / 2 + panY);
    ctx.scale(zoom, zoom);
    ctx.translate(-rect.width / 2, -rect.height / 2);

    const bg = current.background;
    if (!bg || bg.kind === 'paper') {
      // White-ish paper surface.
      ctx.fillStyle = 'rgba(253, 245, 230, 0.96)';
      ctx.fillRect(0, 0, rect.width, rect.height);
    } else if (bg.kind === 'solid') {
      ctx.fillStyle = bg.color || 'rgba(253, 245, 230, 0.96)';
      ctx.fillRect(0, 0, rect.width, rect.height);
    } else if (bg.kind === 'gradient') {
      const mode = bg.mode || 'linear';
      if (mode === 'radial') {
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const radius = Math.sqrt(rect.width * rect.width + rect.height * rect.height) / 2;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        g.addColorStop(0, bg.from || '#000000');
        g.addColorStop(1, bg.to || '#ffffff');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, rect.width, rect.height);
      } else {
        const angle = Number(bg.angle) || 0;
        const rad = (angle * Math.PI) / 180;
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const len = Math.sqrt(rect.width * rect.width + rect.height * rect.height) / 2;
        const dx = Math.cos(rad) * len;
        const dy = Math.sin(rad) * len;
        const g = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
        g.addColorStop(0, bg.from || '#000000');
        g.addColorStop(1, bg.to || '#ffffff');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, rect.width, rect.height);
      }
    }

    if (gridRef.current) {
      const step = 40;
      ctx.save();
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.lineWidth = invZoom;
      ctx.beginPath();
      for (let x = 0; x <= rect.width; x += step) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, rect.height);
      }
      for (let y = 0; y <= rect.height; y += step) {
        ctx.moveTo(0, y);
        ctx.lineTo(rect.width, y);
      }
      ctx.stroke();
      ctx.restore();
     }

    const guides = Array.isArray(current.guides) ? current.guides : [];
    if (guides.length) {
      ctx.save();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2 * invZoom;
      ctx.setLineDash([4 * invZoom, 4 * invZoom]);
      for (const g of guides) {
        if (!g || (g as any).hidden) continue;
        const pos = Number((g as any).pos) || 0;
        if ((g as any).axis === 'y') {
          const y = pos * rect.height;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(rect.width, y);
          ctx.stroke();
        } else {
          const x = pos * rect.width;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, rect.height);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    const snapPrev = snapPreviewRef.current;
    if (snapPrev && (snapPrev.xs.length || snapPrev.ys.length)) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 69, 0, 0.65)';
      ctx.lineWidth = 2 * invZoom;
      ctx.setLineDash([]);
      for (const x0 of snapPrev.xs) {
        const x = Number(x0) * rect.width;
        if (!Number.isFinite(x)) continue;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, rect.height);
        ctx.stroke();
      }
      for (const y0 of snapPrev.ys) {
        const y = Number(y0) * rect.height;
        if (!Number.isFinite(y)) continue;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(rect.width, y);
        ctx.stroke();
      }
      ctx.restore();
    }

    const applyLayerStyleToCtx = (item: any, opts?: { shadow?: boolean }) => {
      const style = ((item as any)?.style || null) as MoodboardLayerStyle | null;
      const opacity = style && style.opacity != null ? clampRange(Number(style.opacity) || 0, 0, 1) : 1;
      ctx.globalAlpha = opacity;
      ctx.globalCompositeOperation = canvasCompositeForBlend(normalizeBlendMode(style?.blend));

      const sh = opts?.shadow === false ? null : (style?.shadow || null);
      if (sh) {
        const shOpacity = clampRange(Number(sh.opacity) || 0.35, 0, 1);
        const shColor = typeof sh.color === 'string' && sh.color.trim() ? sh.color.trim() : '#000000';
        ctx.shadowColor = rgbaFromHex(shColor, shOpacity);
        ctx.shadowBlur = Math.max(0, Number(sh.blur) || 12) * invZoom;
        ctx.shadowOffsetX = (Number(sh.offsetX) || 0) * invZoom;
        ctx.shadowOffsetY = (Number(sh.offsetY) || 8) * invZoom;
      } else {
        ctx.shadowColor = 'rgba(0,0,0,0)';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      }

      return style || undefined;
    };

    const clearShadow = () => {
      ctx.shadowColor = 'rgba(0,0,0,0)';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    };

    const drawShapeItem = (s: MoodboardShape) => {
      if (!s) return;
      if (isHidden(s)) return;
      const cx = (Number(s.x) || 0) * rect.width;
      const cy = (Number(s.y) || 0) * rect.height;
      const w = (Number(s.w) || 0) * rect.width;
      const h = (Number(s.h) || 0) * rect.height;
      if (w <= 0 || h <= 0) return;
      const left = cx - w / 2;
      const top = cy - h / 2;

      ctx.save();
      const style = applyLayerStyleToCtx(s);
      const rotDeg = normalizeAngleDeg(Number(s.rot) || 0);
      if (rotDeg) {
        const rad = degToRad(rotDeg);
        ctx.translate(cx, cy);
        ctx.rotate(rad);
        ctx.translate(-cx, -cy);
      }
      ctx.beginPath();
      if (s.shape === 'ellipse') ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
      else ctx.rect(left, top, w, h);

      const fill = maskShapeIds.has(String(s.id)) ? ({ kind: 'none' } as const) : s.fill;
      if (fill && fill.kind !== 'none') {
        if (fill.kind === 'solid') {
          ctx.fillStyle = fill.color || 'rgba(0,0,0,0)';
          ctx.fill();
        } else if (fill.kind === 'gradient') {
          const mode = fill.mode || 'linear';
          if (mode === 'radial') {
            const radius = Math.sqrt(w * w + h * h) / 2;
            const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
            g.addColorStop(0, fill.from || '#000000');
            g.addColorStop(1, fill.to || '#ffffff');
            ctx.fillStyle = g;
            ctx.fill();
          } else {
            const angle = Number(fill.angle) || 0;
            const rad = (angle * Math.PI) / 180;
            const len = Math.sqrt(w * w + h * h) / 2;
            const dx = Math.cos(rad) * len;
            const dy = Math.sin(rad) * len;
            const g = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
            g.addColorStop(0, fill.from || '#000000');
            g.addColorStop(1, fill.to || '#ffffff');
            ctx.fillStyle = g;
            ctx.fill();
          }
        }
      }

      if (s.stroke && Number.isFinite(Number(s.stroke.width)) && Number(s.stroke.width) > 0) {
        ctx.strokeStyle = s.stroke.color || '#111111';
        ctx.lineWidth = Math.max(1, Number(s.stroke.width) || 1) * invZoom;
        ctx.stroke();
      }

      const outline = style?.outline;
      if (outline && Number.isFinite(Number(outline.width)) && Number(outline.width) > 0) {
        clearShadow();
        ctx.strokeStyle = outline.color || '#111111';
        ctx.lineWidth = Math.max(1, Number(outline.width) || 1) * invZoom;
        ctx.stroke();
      }

      ctx.restore();
    };

    const drawConnectorItem = (c: MoodboardConnector) => {
      if (!c) return;
      if (isHidden(c)) return;
      const ax = (Number(c.ax) || 0) * rect.width;
      const ay = (Number(c.ay) || 0) * rect.height;
      const bx = (Number(c.bx) || 0) * rect.width;
      const by = (Number(c.by) || 0) * rect.height;
      const widthPx = Math.max(1, Number(c.width) || 3);

      ctx.save();
      applyLayerStyleToCtx(c);
      ctx.strokeStyle = c.color || '#111111';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = widthPx * invZoom;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();

      if (c.kind === 'arrow') {
        const dx = bx - ax;
        const dy = by - ay;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0.001) {
          const angle = Math.atan2(dy, dx);
          const headLen = Math.max(10, widthPx * 4) * invZoom;
          const a1 = angle + Math.PI * 0.82;
          const a2 = angle - Math.PI * 0.82;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(bx + Math.cos(a1) * headLen, by + Math.sin(a1) * headLen);
          ctx.moveTo(bx, by);
          ctx.lineTo(bx + Math.cos(a2) * headLen, by + Math.sin(a2) * headLen);
          ctx.stroke();
        }
      }

      ctx.restore();
    };

    const drawImageItem = (img: MoodboardImage) => {
      if (!img?.imageId) return;
      if (isHidden(img)) return;
      let el = imageCacheRef.current.get(img.imageId);
      if (!el) {
        el = new Image();
        el.crossOrigin = 'anonymous';
        el.src = `ckc://image/${encodeURIComponent(img.imageId)}`;
        el.onload = () => requestAnimationFrame(redraw);
        imageCacheRef.current.set(img.imageId, el);
      }
      if (!el.complete || !el.naturalWidth || !el.naturalHeight) return;

      const cx = (Number(img.x) || 0) * rect.width;
      const cy = (Number(img.y) || 0) * rect.height;
      const w = (Number(img.w) || 0) * rect.width;
      const h = (Number(img.h) || 0) * rect.height;
      if (w <= 0 || h <= 0) return;

      // Contain within the desired rect, preserving aspect ratio.
      const srcAspect = el.naturalWidth / el.naturalHeight;
      const dstAspect = w / h;
      let dw = w;
      let dh = h;
      if (srcAspect > dstAspect) {
        dh = w / srcAspect;
      } else {
        dw = h * srcAspect;
      }
      const dx = cx - dw / 2;
      const dy = cy - dh / 2;

      const imgRotDeg = normalizeAngleDeg(Number(img.rot) || 0);
      const imgRot = imgRotDeg ? degToRad(imgRotDeg) : 0;
      const drawImage = () => {
        if (!imgRot) {
          ctx.drawImage(el, dx, dy, dw, dh);
          return;
        }
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(imgRot);
        ctx.translate(-cx, -cy);
        ctx.drawImage(el, dx, dy, dw, dh);
        ctx.restore();
      };

      const maskShapeId = (img as any)?.mask?.shapeId;
      const maskShape =
        typeof maskShapeId === 'string' && maskShapeId.trim() ? (shapeById.get(maskShapeId.trim()) as MoodboardShape | undefined) : undefined;

      ctx.save();
      const style = applyLayerStyleToCtx(img);

      let outlineMask: null | { cx: number; cy: number; w: number; h: number; rotDeg: number; shape: 'rect' | 'ellipse' } = null;
      if (maskShape) {
        const mcx = (Number(maskShape.x) || 0) * rect.width;
        const mcy = (Number(maskShape.y) || 0) * rect.height;
        const mw = (Number(maskShape.w) || 0) * rect.width;
        const mh = (Number(maskShape.h) || 0) * rect.height;
        if (mw > 0 && mh > 0) {
          outlineMask = { cx: mcx, cy: mcy, w: mw, h: mh, rotDeg: normalizeAngleDeg(Number(maskShape.rot) || 0), shape: maskShape.shape };
          const mleft = mcx - mw / 2;
          const mtop = mcy - mh / 2;
          ctx.save();
          ctx.save();
          const maskRotDeg = outlineMask.rotDeg;
          if (maskRotDeg) {
            const rad = degToRad(maskRotDeg);
            ctx.translate(mcx, mcy);
            ctx.rotate(rad);
            ctx.translate(-mcx, -mcy);
          }
          ctx.beginPath();
          if (outlineMask.shape === 'ellipse') ctx.ellipse(mcx, mcy, mw / 2, mh / 2, 0, 0, Math.PI * 2);
          else ctx.rect(mleft, mtop, mw, mh);
          ctx.restore();
          ctx.clip();
          drawImage();
          ctx.restore();
        } else {
          drawImage();
        }
      } else {
        drawImage();
      }

      const outline = style?.outline;
      if (outline && Number.isFinite(Number(outline.width)) && Number(outline.width) > 0) {
        clearShadow();
        ctx.strokeStyle = outline.color || '#111111';
        ctx.lineWidth = Math.max(1, Number(outline.width) || 1) * invZoom;
        if (outlineMask) {
          const mcx = outlineMask.cx;
          const mcy = outlineMask.cy;
          const mw = outlineMask.w;
          const mh = outlineMask.h;
          const mleft = mcx - mw / 2;
          const mtop = mcy - mh / 2;
          ctx.save();
          if (outlineMask.rotDeg) {
            const rad = degToRad(outlineMask.rotDeg);
            ctx.translate(mcx, mcy);
            ctx.rotate(rad);
            ctx.translate(-mcx, -mcy);
          }
          ctx.beginPath();
          if (outlineMask.shape === 'ellipse') ctx.ellipse(mcx, mcy, mw / 2, mh / 2, 0, 0, Math.PI * 2);
          else ctx.rect(mleft, mtop, mw, mh);
          ctx.restore();
          ctx.stroke();
        } else {
          ctx.save();
          if (imgRot) {
            ctx.translate(cx, cy);
            ctx.rotate(imgRot);
            ctx.translate(-cx, -cy);
          }
          ctx.beginPath();
          ctx.rect(dx, dy, dw, dh);
          ctx.restore();
          ctx.stroke();
        }
      }

      ctx.restore();
    };

    const drawTextItem = (t: MoodboardText) => {
      if (!t) return;
      if (isHidden(t)) return;
      const cx = (Number(t.x) || 0) * rect.width;
      const cy = (Number(t.y) || 0) * rect.height;
      const w = (Number(t.w) || 0) * rect.width;
      const h = (Number(t.h) || 0) * rect.height;
      if (w <= 0 || h <= 0) return;
      const left = cx - w / 2;
      const top = cy - h / 2;

      const padding = 8;
      const fontSize = Math.max(10, Number(t.fontSize) || 18);
      const lineHeight = fontSize * 1.25;
      const maxWidth = Math.max(0, w - padding * 2);
      const bottomLimit = top + h - padding;

      ctx.save();
      const style = applyLayerStyleToCtx(t);
      const rotDeg = normalizeAngleDeg(Number(t.rot) || 0);
      if (rotDeg) {
        const rad = degToRad(rotDeg);
        ctx.translate(cx, cy);
        ctx.rotate(rad);
        ctx.translate(-cx, -cy);
      }
      ctx.fillStyle = t.bg || 'rgba(253, 245, 230, 0.96)';
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = invZoom;
      ctx.fillRect(left, top, w, h);
      ctx.strokeRect(left + 0.5 * invZoom, top + 0.5 * invZoom, Math.max(0, w - invZoom), Math.max(0, h - invZoom));

      const outline = style?.outline;
      if (outline && Number.isFinite(Number(outline.width)) && Number(outline.width) > 0) {
        clearShadow();
        ctx.strokeStyle = outline.color || '#111111';
        ctx.lineWidth = Math.max(1, Number(outline.width) || 1) * invZoom;
        ctx.strokeRect(left + 0.5 * invZoom, top + 0.5 * invZoom, Math.max(0, w - invZoom), Math.max(0, h - invZoom));
      }

      clearShadow(); // do not shadow glyphs
      ctx.beginPath();
      ctx.rect(left, top, w, h);
      ctx.clip();

      ctx.font = `${fontSize}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial`;
      ctx.fillStyle = t.color || '#111111';
      ctx.textBaseline = 'top';

      let y = top + padding;
      const x = left + padding;
      const paras = String(t.text || '').split(/\r?\n/);
      for (const para of paras) {
        if (y + lineHeight > bottomLimit) break;
        if (!para.trim()) {
          y += lineHeight;
          continue;
        }
        const words = para.split(/\s+/).filter(Boolean);
        let line = '';
        for (const word of words) {
          const test = line ? `${line} ${word}` : word;
          const m = ctx.measureText(test);
          if (m.width > maxWidth && line) {
            ctx.fillText(line, x, y);
            y += lineHeight;
            if (y + lineHeight > bottomLimit) break;
            line = word;
          } else {
            line = test;
          }
        }
        if (y + lineHeight > bottomLimit) break;
        if (line) {
          ctx.fillText(line, x, y);
          y += lineHeight;
        }
      }

      ctx.restore();
    };

    const drawItems: Array<{
      kind: MoodboardItemKind;
      index: number;
      z: number;
      item: MoodboardShape | MoodboardConnector | MoodboardImage | MoodboardText;
    }> = [];
    for (let i = 0; i < shapes.length; i++) {
      const s = shapes[i];
      if (!s || isHidden(s)) continue;
      drawItems.push({ kind: 'shape', index: i, z: zFor('shape', i, (s as any).z), item: s });
    }
    for (let i = 0; i < connectors.length; i++) {
      const c = connectors[i];
      if (!c || isHidden(c)) continue;
      drawItems.push({ kind: 'connector', index: i, z: zFor('connector', i, (c as any).z), item: c });
    }
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      if (!img || isHidden(img)) continue;
      drawItems.push({ kind: 'image', index: i, z: zFor('image', i, (img as any).z), item: img });
    }
    for (let i = 0; i < texts.length; i++) {
      const t = texts[i];
      if (!t || isHidden(t)) continue;
      drawItems.push({ kind: 'text', index: i, z: zFor('text', i, (t as any).z), item: t });
    }

    drawItems.sort(compareZAsc);
    for (const it of drawItems) {
      if (it.kind === 'shape') drawShapeItem(it.item as MoodboardShape);
      else if (it.kind === 'connector') drawConnectorItem(it.item as MoodboardConnector);
      else if (it.kind === 'image') drawImageItem(it.item as MoodboardImage);
      else drawTextItem(it.item as MoodboardText);
    }

    const drawStroke = (s: MoodboardStroke) => {
      if (!s.points.length) return;
      ctx.save();

      const size = Math.max(1, s.size);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = size;

      if (s.tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = s.color || '#111111';
      }

      const first = s.points[0];
      const last = s.points[s.points.length - 1] ?? first;

      if (s.tool === 'pen' || s.tool === 'eraser') {
        ctx.beginPath();
        ctx.moveTo(first.x * rect.width, first.y * rect.height);
        for (const p of s.points.slice(1)) ctx.lineTo(p.x * rect.width, p.y * rect.height);
        ctx.stroke();
        ctx.restore();
        return;
      }

      if (s.points.length < 2) {
        ctx.restore();
        return;
      }

      const x0 = first.x * rect.width;
      const y0 = first.y * rect.height;
      const x1 = last.x * rect.width;
      const y1 = last.y * rect.height;

      if (s.tool === 'line' || s.tool === 'arrow') {
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();

        if (s.tool === 'arrow') {
          const dx = x1 - x0;
          const dy = y1 - y0;
          const angle = Math.atan2(dy, dx);
          const headLen = Math.max(10, size * 4);
          const a1 = angle + Math.PI * 0.82;
          const a2 = angle - Math.PI * 0.82;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x1 + Math.cos(a1) * headLen, y1 + Math.sin(a1) * headLen);
          ctx.moveTo(x1, y1);
          ctx.lineTo(x1 + Math.cos(a2) * headLen, y1 + Math.sin(a2) * headLen);
          ctx.stroke();
        }

        ctx.restore();
        return;
      }

      const left = Math.min(x0, x1);
      const top = Math.min(y0, y1);
      const w = Math.abs(x1 - x0);
      const h = Math.abs(y1 - y0);

      if (s.tool === 'rect') {
        ctx.strokeRect(left, top, w, h);
        ctx.restore();
        return;
      }

      if (s.tool === 'ellipse') {
        ctx.beginPath();
        ctx.ellipse(left + w / 2, top + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        return;
      }

      ctx.restore();
    };

    if (!current.strokesHidden) {
      for (const s of strokes) drawStroke(s);
      if (strokeRef.current) drawStroke(strokeRef.current);
    }

    if (selectionUnits.length) {
      const onlySel = selection.length === 1 ? selection[0] : null;
      const onlyBoxItem =
        onlySel?.kind === 'image'
          ? imageById.get(onlySel.id)
          : onlySel?.kind === 'text'
            ? textById.get(onlySel.id)
            : onlySel?.kind === 'shape'
              ? shapeById.get(onlySel.id)
              : null;

      for (const u of selectionUnits) {
        if (onlySel && onlyBoxItem && u.key === `${onlySel.kind}:${onlySel.id}`) {
          const cx = (Number((onlyBoxItem as any).x) || 0) * rect.width;
          const cy = (Number((onlyBoxItem as any).y) || 0) * rect.height;
          const w = (Number((onlyBoxItem as any).w) || 0) * rect.width;
          const h = (Number((onlyBoxItem as any).h) || 0) * rect.height;
          if (w <= 0 || h <= 0) continue;
          const rotDeg = normalizeAngleDeg(Number((onlyBoxItem as any).rot) || 0);
          const nw = fromLocalXY(-w / 2, -h / 2, cx, cy, rotDeg);
          const ne = fromLocalXY(w / 2, -h / 2, cx, cy, rotDeg);
          const se = fromLocalXY(w / 2, h / 2, cx, cy, rotDeg);
          const sw = fromLocalXY(-w / 2, h / 2, cx, cy, rotDeg);
          ctx.save();
          ctx.strokeStyle = 'rgba(0,0,0,0.55)';
          ctx.lineWidth = 2 * invZoom;
          ctx.setLineDash([6 * invZoom, 5 * invZoom]);
          ctx.beginPath();
          ctx.moveTo(nw.x, nw.y);
          ctx.lineTo(ne.x, ne.y);
          ctx.lineTo(se.x, se.y);
          ctx.lineTo(sw.x, sw.y);
          ctx.closePath();
          ctx.stroke();
          ctx.restore();
          continue;
        }

        const left = u.bounds.left * rect.width;
        const top = u.bounds.top * rect.height;
        const right = u.bounds.right * rect.width;
        const bottom = u.bounds.bottom * rect.height;
        const w = right - left;
        const h = bottom - top;
        if (w <= 0 || h <= 0) continue;
        ctx.save();
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.lineWidth = 2 * invZoom;
        ctx.setLineDash([6 * invZoom, 5 * invZoom]);
        ctx.strokeRect(left + invZoom, top + invZoom, Math.max(0, w - 2 * invZoom), Math.max(0, h - 2 * invZoom));
        ctx.restore();
      }

      if (toolRef.current === 'transform' && selectionUnits.length === 1) {
        const u = selectionUnits[0];
        const left = u.bounds.left * rect.width;
        const top = u.bounds.top * rect.height;
        const right = u.bounds.right * rect.width;
        const bottom = u.bounds.bottom * rect.height;

        const handleSize = 10 * invZoom;
        const half = handleSize / 2;
        const handles: Array<{ x: number; y: number }> = [];
        let rotateHandle: null | { x: number; y: number; topMidX: number; topMidY: number } = null;
        const only = selection.length === 1 ? selection[0] : null;
        if (only?.kind === 'connector') {
          const conn = connectorById.get(only.id);
          if (conn && !isHidden(conn)) {
            handles.push(
              { x: (Number(conn.ax) || 0) * rect.width, y: (Number(conn.ay) || 0) * rect.height },
              { x: (Number(conn.bx) || 0) * rect.width, y: (Number(conn.by) || 0) * rect.height }
            );
          }
        } else if (only && onlyBoxItem && (only.kind === 'image' || only.kind === 'text' || only.kind === 'shape')) {
          const cx = (Number((onlyBoxItem as any).x) || 0) * rect.width;
          const cy = (Number((onlyBoxItem as any).y) || 0) * rect.height;
          const w = (Number((onlyBoxItem as any).w) || 0) * rect.width;
          const h = (Number((onlyBoxItem as any).h) || 0) * rect.height;
          if (w > 0 && h > 0) {
            const rotDeg = normalizeAngleDeg(Number((onlyBoxItem as any).rot) || 0);
            const nw = fromLocalXY(-w / 2, -h / 2, cx, cy, rotDeg);
            const ne = fromLocalXY(w / 2, -h / 2, cx, cy, rotDeg);
            const se = fromLocalXY(w / 2, h / 2, cx, cy, rotDeg);
            const sw = fromLocalXY(-w / 2, h / 2, cx, cy, rotDeg);
            handles.push(nw, ne, se, sw);

            const offset = 22 * invZoom;
            const topMid = fromLocalXY(0, -h / 2, cx, cy, rotDeg);
            const hp = fromLocalXY(0, -h / 2 - offset, cx, cy, rotDeg);
            rotateHandle = { x: hp.x, y: hp.y, topMidX: topMid.x, topMidY: topMid.y };
          }
        }
        if (!handles.length) {
          handles.push(
            { x: left, y: top },
            { x: right, y: top },
            { x: right, y: bottom },
            { x: left, y: bottom }
          );
        }

        ctx.save();
        ctx.fillStyle = 'rgba(253, 245, 230, 0.96)';
        ctx.strokeStyle = 'rgba(0,0,0,0.7)';
        ctx.lineWidth = 2 * invZoom;
        for (const p of handles) {
          ctx.beginPath();
          ctx.rect(p.x - half, p.y - half, handleSize, handleSize);
          ctx.fill();
          ctx.stroke();
        }
        if (rotateHandle) {
          const r = 8 * invZoom;
          ctx.beginPath();
          ctx.moveTo(rotateHandle.topMidX, rotateHandle.topMidY);
          ctx.lineTo(rotateHandle.x, rotateHandle.y);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(rotateHandle.x, rotateHandle.y, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    const box = boxSelectRef.current;
    if (box) {
      const left = Math.min(box.startPt.x, box.curPt.x) * rect.width;
      const right = Math.max(box.startPt.x, box.curPt.x) * rect.width;
      const top = Math.min(box.startPt.y, box.curPt.y) * rect.height;
      const bottom = Math.max(box.startPt.y, box.curPt.y) * rect.height;
      const w = right - left;
      const h = bottom - top;
      if (w > 0 && h > 0) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.06)';
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.lineWidth = 2 * invZoom;
        ctx.setLineDash([6 * invZoom, 5 * invZoom]);
        ctx.fillRect(left, top, w, h);
        ctx.strokeRect(left + invZoom, top + invZoom, Math.max(0, w - 2 * invZoom), Math.max(0, h - 2 * invZoom));
        ctx.restore();
      }
    }

    ctx.restore();
  }, []);

  const applyNoHistory = React.useCallback(
    (next: MoodboardState, opts?: { clearRedo?: boolean }) => {
      internalChangeRef.current = next;
      valueRef.current = next;
      if (opts?.clearRedo && historyFutureRef.current.length) {
        historyFutureRef.current = [];
        setHistoryVersion((v) => (v + 1) % 1_000_000);
      }
      onChange(next);
      redraw();
    },
    [onChange, redraw],
  );

  const commit = React.useCallback(
    (next: MoodboardState, opts?: { historyPrev?: MoodboardState }) => {
      const prev = opts?.historyPrev ?? valueRef.current;
      pushHistory(prev);
      internalChangeRef.current = next;
      valueRef.current = next;
      onChange(next);
      redraw();
    },
    [onChange, pushHistory, redraw],
  );

  const undo = React.useCallback(() => {
    const past = historyPastRef.current;
    if (!past.length) return;
    dragRef.current = null;
    resizeRef.current = null;
    rotateRef.current = null;
    guideDragRef.current = null;
    snapPreviewRef.current = null;
    gradientDragRef.current = null;
    shapeDragRef.current = null;
    connectorDragRef.current = null;
    connectorEditRef.current = null;
    boxSelectRef.current = null;
    setContextMenu(null);
    drawingRef.current = false;
    strokeRef.current = null;
    const cur = valueRef.current;
    const prev = past.pop() as MoodboardState;
    historyFutureRef.current.push(cur);
    internalChangeRef.current = prev;
    valueRef.current = prev;
    onChange(prev);
    setHistoryVersion((v) => (v + 1) % 1_000_000);
    redraw();
  }, [commit, redraw]);

  const redo = React.useCallback(() => {
    const future = historyFutureRef.current;
    if (!future.length) return;
    dragRef.current = null;
    resizeRef.current = null;
    rotateRef.current = null;
    guideDragRef.current = null;
    snapPreviewRef.current = null;
    gradientDragRef.current = null;
    shapeDragRef.current = null;
    connectorDragRef.current = null;
    connectorEditRef.current = null;
    boxSelectRef.current = null;
    setContextMenu(null);
    drawingRef.current = false;
    strokeRef.current = null;
    const cur = valueRef.current;
    const next = future.pop() as MoodboardState;
    historyPastRef.current.push(cur);
    if (historyPastRef.current.length > 80) historyPastRef.current.shift();
    internalChangeRef.current = next;
    valueRef.current = next;
    onChange(next);
    setHistoryVersion((v) => (v + 1) % 1_000_000);
    redraw();
  }, [commit, redraw]);

  React.useEffect(() => {
    selectionRef.current = selection;
    redraw();
  }, [selection, redraw]);

  React.useEffect(() => {
    const onKeyDown = (evt: KeyboardEvent) => {
      if (!(evt.ctrlKey || evt.metaKey)) return;
      if (evt.altKey) return;
      const target = evt.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || (target as any).isContentEditable) return;
      }
      const k = String(evt.key || '').toLowerCase();
      if (k === 'z') {
        evt.preventDefault();
        if (evt.shiftKey) redo();
        else undo();
      } else if (k === 'y') {
        evt.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [redo, undo]);

  React.useEffect(() => {
    if (!contextMenu) return;
    const onMouseDown = (evt: MouseEvent) => {
      const el = contextMenuElRef.current;
      if (el && evt.target instanceof Node && el.contains(evt.target)) return;
      setContextMenu(null);
    };
    const onKeyDown = (evt: KeyboardEvent) => {
      if (evt.key === 'Escape') setContextMenu(null);
    };
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [contextMenu]);

  React.useEffect(() => {
    const isTypingTarget = (target: EventTarget | null): boolean => {
      const el = target as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || (el as any).isContentEditable;
    };

    const onKeyDown = (evt: KeyboardEvent) => {
      if (evt.code !== 'Space') return;
      if (isTypingTarget(evt.target)) return;
      isSpaceDownRef.current = true;
      evt.preventDefault();
    };

    const onKeyUp = (evt: KeyboardEvent) => {
      if (evt.code !== 'Space') return;
      isSpaceDownRef.current = false;
      evt.preventDefault();
    };

    const onBlur = () => {
      isSpaceDownRef.current = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  React.useEffect(() => {
    redraw();
  }, [redraw]);

  React.useEffect(() => {
    redraw();
  }, [value, redraw]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ro = new ResizeObserver(() => redraw());
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [redraw]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onPointerDown = (evt: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const sx = evt.clientX - rect.left;
      const sy = evt.clientY - rect.top;
      if (evt.button !== 0) return;

      if (isSpaceDownRef.current) {
        const view = viewRef.current;
        panDragRef.current = { startSX: sx, startSY: sy, startPanX: Number(view.panX) || 0, startPanY: Number(view.panY) || 0 };
        canvas.setPointerCapture(evt.pointerId);
        redraw();
        return;
      }

      const pt = pointFromEvent(evt, canvas, viewRef.current);
      const current = valueRef.current;
      const currentTool = toolRef.current;

      if (currentTool === 'move' || currentTool === 'transform') {
        const shapes = Array.isArray(current.shapes) ? current.shapes : [];
        const connectors = Array.isArray(current.connectors) ? current.connectors : [];
        const images = Array.isArray(current.images) ? current.images : [];
        const texts = Array.isArray(current.texts) ? current.texts : [];
        const shapeById = new Map(shapes.map((s) => [s.id, s]));
        const connectorById = new Map(connectors.map((c) => [c.id, c]));
        const imageById = new Map(images.map((img) => [img.id, img]));
        const textById = new Map(texts.map((t) => [t.id, t]));
        const folderFlags = computeEffectiveFolderFlags(Array.isArray(current.folders) ? current.folders : []);
        const isHiddenItem = (it: any): boolean => isItemEffectivelyHidden(it, folderFlags);
        const isLockedItem = (it: any): boolean => isItemEffectivelyLocked(it, folderFlags);

        const keyOf = (sel: SelectedItem) => `${sel.kind}:${sel.id}`;

        const membersForGroup = (gid: string): Selection => {
          const out: Selection = [];
          for (const c of connectors) {
            if (!c || isHiddenItem(c)) continue;
            if (String((c as any).groupId ?? '') === gid) out.push({ kind: 'connector', id: c.id });
          }
          for (const s of shapes) {
            if (!s || isHiddenItem(s)) continue;
            if (String((s as any).groupId ?? '') === gid) out.push({ kind: 'shape', id: s.id });
          }
          for (const t of texts) {
            if (!t || isHiddenItem(t)) continue;
            if (String((t as any).groupId ?? '') === gid) out.push({ kind: 'text', id: t.id });
          }
          for (const img of images) {
            if (!img || isHiddenItem(img)) continue;
            if (String((img as any).groupId ?? '') === gid) out.push({ kind: 'image', id: img.id });
          }
          return out;
        };

        const unitForHit = (hit: SelectedItem): Selection => {
          const item =
            hit.kind === 'image'
              ? imageById.get(hit.id)
              : hit.kind === 'text'
                ? textById.get(hit.id)
                : hit.kind === 'shape'
                  ? shapeById.get(hit.id)
                  : connectorById.get(hit.id);
          const gid = String((item as any)?.groupId ?? '').trim();
          if (!gid) return [hit];
          const members = membersForGroup(gid);
          const rest = members.filter((m) => keyOf(m) !== keyOf(hit));
          return [hit, ...rest];
        };

        const buildSelectionUnits = (selList: Selection) => {
          const groupIds = new Set<string>();
          for (const s of selList) {
            const item =
              s.kind === 'image'
                ? imageById.get(s.id)
                : s.kind === 'text'
                  ? textById.get(s.id)
                  : s.kind === 'shape'
                    ? shapeById.get(s.id)
                    : connectorById.get(s.id);
            const gid = String((item as any)?.groupId ?? '').trim();
            if (gid) groupIds.add(gid);
          }

          const units: Array<{
            kind: 'group' | 'item';
            key: string;
            groupId?: string;
            item?: SelectedItem;
            members: Selection;
            bounds: { left: number; top: number; right: number; bottom: number; cx: number; cy: number; w: number; h: number };
          }> = [];

          for (const gid of groupIds) {
            const members = membersForGroup(gid);
            if (!members.length) continue;
            let left = Infinity;
            let top = Infinity;
            let right = -Infinity;
            let bottom = -Infinity;
            for (const m of members) {
              const it =
                m.kind === 'image'
                  ? imageById.get(m.id)
                  : m.kind === 'text'
                    ? textById.get(m.id)
                    : m.kind === 'shape'
                      ? shapeById.get(m.id)
                      : connectorById.get(m.id);
              if (!it || isHiddenItem(it)) continue;
              if (m.kind === 'connector') {
                const ax = Number((it as any).ax) || 0;
                const ay = Number((it as any).ay) || 0;
                const bx = Number((it as any).bx) || 0;
                const by = Number((it as any).by) || 0;
                left = Math.min(left, Math.min(ax, bx));
                top = Math.min(top, Math.min(ay, by));
                right = Math.max(right, Math.max(ax, bx));
                bottom = Math.max(bottom, Math.max(ay, by));
              } else {
                const cx = Number((it as any).x) || 0;
                const cy = Number((it as any).y) || 0;
                const w = Number((it as any).w) || 0;
                const h = Number((it as any).h) || 0;
                left = Math.min(left, cx - w / 2);
                top = Math.min(top, cy - h / 2);
                right = Math.max(right, cx + w / 2);
                bottom = Math.max(bottom, cy + h / 2);
              }
            }
            const w = right - left;
            const h = bottom - top;
            units.push({
              kind: 'group',
              key: `g:${gid}`,
              groupId: gid,
              members,
              bounds: { left, top, right, bottom, cx: left + w / 2, cy: top + h / 2, w, h },
            });
          }

          for (const s of selList) {
            const it =
              s.kind === 'image'
                ? imageById.get(s.id)
                : s.kind === 'text'
                  ? textById.get(s.id)
                  : s.kind === 'shape'
                    ? shapeById.get(s.id)
                    : connectorById.get(s.id);
            if (!it || isHiddenItem(it)) continue;
            const gid = String((it as any).groupId ?? '').trim();
            if (gid && groupIds.has(gid)) continue;
            let cx = 0;
            let cy = 0;
            let w = 0;
            let h = 0;
            if (s.kind === 'connector') {
              const ax = Number((it as any).ax) || 0;
              const ay = Number((it as any).ay) || 0;
              const bx = Number((it as any).bx) || 0;
              const by = Number((it as any).by) || 0;
              const left = Math.min(ax, bx);
              const right = Math.max(ax, bx);
              const top = Math.min(ay, by);
              const bottom = Math.max(ay, by);
              w = right - left;
              h = bottom - top;
              cx = left + w / 2;
              cy = top + h / 2;
            } else {
              cx = Number((it as any).x) || 0;
              cy = Number((it as any).y) || 0;
              w = Number((it as any).w) || 0;
              h = Number((it as any).h) || 0;
            }
            units.push({
              kind: 'item',
              key: `${s.kind}:${s.id}`,
              item: s,
              members: [s],
              bounds: { left: cx - w / 2, top: cy - h / 2, right: cx + w / 2, bottom: cy + h / 2, cx, cy, w, h },
            });
          }

          return units;
        };

        if (currentTool === 'transform') {
          const curSel = Array.isArray(selectionRef.current) ? selectionRef.current : [];
          const units = buildSelectionUnits(curSel);
          if (units.length === 1) {
            const u = units[0];
            const rect = canvas.getBoundingClientRect();
            const px = pt.x * rect.width;
            const py = pt.y * rect.height;

            if (u.kind === 'item' && u.item?.kind === 'connector') {
              const conn = connectorById.get(u.item.id);
              if (conn && !isHiddenItem(conn) && !isLockedItem(conn)) {
                const zoom = Math.max(0.25, Math.min(6, Number(viewRef.current.zoom) || 1));
                const half = 9 / zoom;
                const ax = (Number(conn.ax) || 0) * rect.width;
                const ay = (Number(conn.ay) || 0) * rect.height;
                const bx = (Number(conn.bx) || 0) * rect.width;
                const by = (Number(conn.by) || 0) * rect.height;
                const da = Math.hypot(px - ax, py - ay);
                const db = Math.hypot(px - bx, py - by);
                if (da <= half || db <= half) {
                  connectorEditRef.current = { startState: current, connectorId: conn.id, endpoint: da <= db ? 'a' : 'b', moved: false };
                  canvas.setPointerCapture(evt.pointerId);
                  redraw();
                  return;
                }
              }
            }

            if (u.kind === 'item' && u.item && u.item.kind !== 'connector') {
              const it =
                u.item.kind === 'image'
                  ? imageById.get(u.item.id)
                  : u.item.kind === 'text'
                    ? textById.get(u.item.id)
                    : shapeById.get(u.item.id);
              if (it && !isHiddenItem(it) && !isLockedItem(it)) {
                const zoom = Math.max(0.25, Math.min(6, Number(viewRef.current.zoom) || 1));
                const rotDeg = normalizeAngleDeg(Number((it as any).rot) || 0);
                const icx = (Number((it as any).x) || 0) * rect.width;
                const icy = (Number((it as any).y) || 0) * rect.height;
                const iw = (Number((it as any).w) || 0) * rect.width;
                const ih = (Number((it as any).h) || 0) * rect.height;
                if (iw > 0 && ih > 0) {
                  const offset = 22 / zoom;
                  const radius = 8 / zoom;
                  const hp = fromLocalXY(0, -ih / 2 - offset, icx, icy, rotDeg);
                  if (Math.hypot(px - hp.x, py - hp.y) <= radius) {
                    rotateRef.current = {
                      itemKind: u.item.kind,
                      id: u.item.id,
                      startItem: it,
                      startState: current,
                      startAngleRad: Math.atan2(py - icy, px - icx),
                      startRotDeg: rotDeg,
                      moved: false,
                    };
                    canvas.setPointerCapture(evt.pointerId);
                    redraw();
                    return;
                  }
                }
              }
            }

            const left = u.bounds.left * rect.width;
            const right = u.bounds.right * rect.width;
            const top = u.bounds.top * rect.height;
            const bottom = u.bounds.bottom * rect.height;

            const hitHandle = ((): ResizeHandle | null => {
              const half = 7 / Math.max(0.25, Math.min(6, Number(viewRef.current.zoom) || 1));
              if (u.kind === 'item' && u.item && u.item.kind !== 'connector') {
                const it =
                  u.item.kind === 'image'
                    ? imageById.get(u.item.id)
                    : u.item.kind === 'text'
                      ? textById.get(u.item.id)
                      : shapeById.get(u.item.id);
                if (it && !isHiddenItem(it)) {
                  const icx = (Number((it as any).x) || 0) * rect.width;
                  const icy = (Number((it as any).y) || 0) * rect.height;
                  const iw = (Number((it as any).w) || 0) * rect.width;
                  const ih = (Number((it as any).h) || 0) * rect.height;
                  const rotDeg = normalizeAngleDeg(Number((it as any).rot) || 0);
                  const checks: Array<{ h: ResizeHandle; x: number; y: number }> = [
                    { h: 'nw', ...fromLocalXY(-iw / 2, -ih / 2, icx, icy, rotDeg) },
                    { h: 'ne', ...fromLocalXY(iw / 2, -ih / 2, icx, icy, rotDeg) },
                    { h: 'se', ...fromLocalXY(iw / 2, ih / 2, icx, icy, rotDeg) },
                    { h: 'sw', ...fromLocalXY(-iw / 2, ih / 2, icx, icy, rotDeg) },
                  ];
                  for (const c of checks) {
                    if (Math.abs(px - c.x) <= half && Math.abs(py - c.y) <= half) return c.h;
                  }
                }
                return null;
              }
              const checks: Array<{ h: ResizeHandle; x: number; y: number }> = [
                { h: 'nw', x: left, y: top },
                { h: 'ne', x: right, y: top },
                { h: 'se', x: right, y: bottom },
                { h: 'sw', x: left, y: bottom },
              ];
              for (const c of checks) {
                if (Math.abs(px - c.x) <= half && Math.abs(py - c.y) <= half) return c.h;
              }
              return null;
            })();

            if (hitHandle) {
              if (u.kind === 'item' && u.item && u.item.kind !== 'connector') {
                const it =
                  u.item.kind === 'image'
                    ? imageById.get(u.item.id)
                    : u.item.kind === 'text'
                      ? textById.get(u.item.id)
                      : shapeById.get(u.item.id);
                if (!it || isHiddenItem(it) || isLockedItem(it)) {
                  redraw();
                  return;
                }
                resizeRef.current = {
                  kind: 'item',
                  itemKind: u.item.kind,
                  id: u.item.id,
                  handle: hitHandle,
                  startItem: it,
                  startState: current,
                  moved: false,
                };
                canvas.setPointerCapture(evt.pointerId);
                redraw();
                return;
              }

              if (u.kind === 'group' && u.groupId) {
                const members = membersForGroup(u.groupId);
                const startItems: Array<
                  | { kind: 'connector'; id: string; ax: number; ay: number; bx: number; by: number; locked?: boolean }
                  | { kind: Exclude<MoodboardItemKind, 'connector'>; id: string; x: number; y: number; w: number; h: number; locked?: boolean }
                > = [];
                for (const m of members) {
                  if (m.kind === 'connector') {
                    const c = connectorById.get(m.id);
                    if (!c || isHiddenItem(c)) continue;
                    startItems.push({
                      kind: 'connector',
                      id: c.id,
                      ax: Number(c.ax) || 0,
                      ay: Number(c.ay) || 0,
                      bx: Number(c.bx) || 0,
                      by: Number(c.by) || 0,
                      locked: isLockedItem(c),
                    });
                    continue;
                  }

                  const it = m.kind === 'image' ? imageById.get(m.id) : m.kind === 'text' ? textById.get(m.id) : shapeById.get(m.id);
                  if (!it || isHiddenItem(it)) continue;
                  startItems.push({
                    kind: m.kind,
                    id: m.id,
                    x: Number((it as any).x) || 0,
                    y: Number((it as any).y) || 0,
                    w: Number((it as any).w) || 0,
                    h: Number((it as any).h) || 0,
                    locked: isLockedItem(it),
                  });
                }
                if (!startItems.some((x) => !x.locked)) {
                  redraw();
                  return;
                }
                resizeRef.current = {
                  kind: 'group',
                  groupId: u.groupId,
                  handle: hitHandle,
                  startBounds: u.bounds,
                  startItems,
                  startState: current,
                  moved: false,
                };
                canvas.setPointerCapture(evt.pointerId);
                redraw();
                return;
              }
            }
          }
        }

        const guides = Array.isArray(current.guides) ? current.guides : [];
        if (guides.length) {
          const rect = canvas.getBoundingClientRect();
          const zoom = Math.max(0.25, Math.min(6, Number(viewRef.current.zoom) || 1));
          const tol = 6 / zoom;
          const px = pt.x * rect.width;
          const py = pt.y * rect.height;

          let best: MoodboardGuide | null = null;
          let bestDist = Infinity;
          for (const g of guides) {
            if (!g || (g as any).hidden || (g as any).locked) continue;
            const pos = Number((g as any).pos) || 0;
            const axis = (g as any).axis === 'y' ? 'y' : 'x';
            const dist = axis === 'y' ? Math.abs(py - pos * rect.height) : Math.abs(px - pos * rect.width);
            if (dist < bestDist) {
              bestDist = dist;
              best = g;
            }
          }

          if (best && bestDist <= tol) {
            guideDragRef.current = { guideId: best.id, axis: best.axis, startState: current, moved: false };
            snapPreviewRef.current = null;
            setContextMenu(null);
            canvas.setPointerCapture(evt.pointerId);
            redraw();
            return;
          }
        }

        const hit = ((): SelectedItem | null => {
          const candidates: Array<{ kind: MoodboardItemKind; id: string; z: number; index: number }> = [];
          for (let i = 0; i < shapes.length; i++) {
            const s = shapes[i];
            if (!s || isHiddenItem(s)) continue;
            candidates.push({ kind: 'shape', id: s.id, z: zFor('shape', i, (s as any).z), index: i });
          }
          for (let i = 0; i < connectors.length; i++) {
            const c = connectors[i];
            if (!c || isHiddenItem(c)) continue;
            candidates.push({ kind: 'connector', id: c.id, z: zFor('connector', i, (c as any).z), index: i });
          }
          for (let i = 0; i < images.length; i++) {
            const img = images[i];
            if (!img || isHiddenItem(img)) continue;
            candidates.push({ kind: 'image', id: img.id, z: zFor('image', i, (img as any).z), index: i });
          }
          for (let i = 0; i < texts.length; i++) {
            const t = texts[i];
            if (!t || isHiddenItem(t)) continue;
            candidates.push({ kind: 'text', id: t.id, z: zFor('text', i, (t as any).z), index: i });
          }

          const rect = canvas.getBoundingClientRect();
          const zoom = Math.max(0.25, Math.min(6, Number(viewRef.current.zoom) || 1));
          const px = pt.x * rect.width;
          const py = pt.y * rect.height;
          const maskShapeIds = new Set<string>();
          for (const img of images) {
            const sid = (img as any)?.mask?.shapeId;
            if (typeof sid === 'string' && sid.trim()) maskShapeIds.add(sid.trim());
          }

          candidates.sort(compareZAsc);
          for (let i = candidates.length - 1; i >= 0; i--) {
            const c = candidates[i];
            if (c.kind === 'text') {
              const t = texts[c.index];
              if (!t || isHiddenItem(t)) continue;
              if (pointInRotatedRect(pt, t)) return { kind: 'text', id: t.id };
              continue;
            }

            if (c.kind === 'image') {
              const img = images[c.index];
              if (!img || isHiddenItem(img)) continue;
              if (pointInRotatedRect(pt, img)) {
                const maskShapeId = (img as any)?.mask?.shapeId;
                if (typeof maskShapeId === 'string' && maskShapeId.trim()) {
                  const s = shapeById.get(maskShapeId.trim());
                  if (s) {
                    if (s.shape === 'ellipse') {
                      if (!pointInRotatedEllipse(pt, s)) continue;
                    } else {
                      if (!pointInRotatedRect(pt, s)) continue;
                    }
                  }
                }
                return { kind: 'image', id: img.id };
              }
              continue;
            }

            if (c.kind === 'connector') {
              const conn = connectors[c.index];
              if (!conn || isHiddenItem(conn)) continue;
              const ax = (Number(conn.ax) || 0) * rect.width;
              const ay = (Number(conn.ay) || 0) * rect.height;
              const bx = (Number(conn.bx) || 0) * rect.width;
              const by = (Number(conn.by) || 0) * rect.height;
              const widthPx = Math.max(1, Number(conn.width) || 3);
              const tol = Math.max(8, widthPx * 2) / zoom;

              const vx = bx - ax;
              const vy = by - ay;
              const wx = px - ax;
              const wy = py - ay;
              const c1 = vx * wx + vy * wy;
              const c2 = vx * vx + vy * vy;
              let dist = 0;
              if (c2 <= 0.000001) {
                dist = Math.hypot(px - ax, py - ay);
              } else if (c1 <= 0) {
                dist = Math.hypot(px - ax, py - ay);
              } else if (c1 >= c2) {
                dist = Math.hypot(px - bx, py - by);
              } else {
                const b = c1 / c2;
                const projX = ax + b * vx;
                const projY = ay + b * vy;
                dist = Math.hypot(px - projX, py - projY);
              }

              if (dist <= tol) return { kind: 'connector', id: conn.id };
              continue;
            }

            const s = shapes[c.index];
            if (!s || isHiddenItem(s)) continue;
            const w = Number(s.w) || 0;
            const h = Number(s.h) || 0;
            if (w <= 0 || h <= 0) continue;
            const cx = Number(s.x) || 0;
            const cy = Number(s.y) || 0;
            const rx = w / 2;
            const ry = h / 2;

            if (maskShapeIds.has(String(s.id))) {
              const strokeWidthPx =
                s.stroke && Number.isFinite(Number(s.stroke.width)) && Number(s.stroke.width) > 0 ? Math.max(1, Number(s.stroke.width) || 1) : 1;
              const tol = Math.max(8, strokeWidthPx * 2) / zoom;

              const cxPx = cx * rect.width;
              const cyPx = cy * rect.height;
              const rxPx = rx * rect.width;
              const ryPx = ry * rect.height;
              const localPx = toLocalXY(px, py, cxPx, cyPx, Number(s.rot) || 0);

              if (s.shape === 'ellipse') {
                if (rxPx <= 0 || ryPx <= 0) continue;
                const nx = localPx.x / rxPx;
                const ny = localPx.y / ryPx;
                const r = Math.sqrt(nx * nx + ny * ny);
                const dist = Math.abs(r - 1) * Math.min(rxPx, ryPx);
                if (dist <= tol) return { kind: 'shape', id: s.id };
              } else {
                const left = -rxPx;
                const right = rxPx;
                const top = -ryPx;
                const bottom = ryPx;
                if (localPx.x < left - tol || localPx.x > right + tol || localPx.y < top - tol || localPx.y > bottom + tol) continue;
                const edgeDist = Math.min(
                  Math.abs(localPx.x - left),
                  Math.abs(localPx.x - right),
                  Math.abs(localPx.y - top),
                  Math.abs(localPx.y - bottom)
                );
                if (edgeDist <= tol) return { kind: 'shape', id: s.id };
              }
              continue;
            }

            if (s.shape === 'ellipse') {
              if (pointInRotatedEllipse(pt, s)) return { kind: 'shape', id: s.id };
            } else {
              if (pointInRotatedRect(pt, s)) return { kind: 'shape', id: s.id };
            }
          }

          return null;
        })();

        if (hit == null) {
          if (currentTool === 'move' && evt.button === 0) {
            const prevSel = Array.isArray(selectionRef.current) ? selectionRef.current : [];
            const additive = !!evt.shiftKey;
            const startSel = additive ? prevSel : [];
            if (!additive && prevSel.length) {
              selectionRef.current = [];
              setSelection([]);
            }
            boxSelectRef.current = { startPt: pt, curPt: pt, startSel, additive, moved: false };
            setContextMenu(null);
            canvas.setPointerCapture(evt.pointerId);
            redraw();
            return;
          }

          selectionRef.current = [];
          setSelection([]);
          redraw();
          return;
        }

        const prevSel = Array.isArray(selectionRef.current) ? selectionRef.current : [];
        const prevSet = new Set(prevSel.map(keyOf));
        const unitMembers = unitForHit(hit);
        const unitKeys = new Set(unitMembers.map(keyOf));
        const unitAllSelected = unitMembers.every((m) => prevSet.has(keyOf(m)));

        if (evt.shiftKey) {
          let next: Selection;
          if (unitAllSelected) {
            next = prevSel.filter((s) => !unitKeys.has(keyOf(s)));
          } else {
            const withoutHit = prevSel.filter((s) => keyOf(s) !== keyOf(hit));
            const out: Selection = [hit, ...withoutHit];
            const nextSet = new Set(out.map(keyOf));
            for (const m of unitMembers) {
              const k = keyOf(m);
              if (nextSet.has(k)) continue;
              out.push(m);
              nextSet.add(k);
            }
            next = out;
          }
          selectionRef.current = next;
          setSelection(next);
          redraw();
          return;
        }

        let nextSel: Selection;
        if (unitAllSelected) {
          nextSel = [hit, ...prevSel.filter((s) => keyOf(s) !== keyOf(hit))];
        } else {
          nextSel = unitMembers;
        }
        selectionRef.current = nextSel;
        setSelection(nextSel);

        const hitItem =
          hit.kind === 'image'
            ? imageById.get(hit.id)
            : hit.kind === 'text'
              ? textById.get(hit.id)
              : hit.kind === 'shape'
                ? shapeById.get(hit.id)
                : connectorById.get(hit.id);
        if (!hitItem || isLockedItem(hitItem)) {
          redraw();
          return;
        }

        const units = buildSelectionUnits(nextSel);
        const dragUnits: Array<{
          key: string;
          kind: 'group' | 'item';
          groupId?: string;
          bounds: { left: number; top: number; right: number; bottom: number; cx: number; cy: number; w: number; h: number };
          items: Array<
            | { kind: 'connector'; id: string; startAX: number; startAY: number; startBX: number; startBY: number }
            | { kind: Exclude<MoodboardItemKind, 'connector'>; id: string; startX: number; startY: number }
          >;
        }> = [];
        for (const u of units) {
          const items: Array<
            | { kind: 'connector'; id: string; startAX: number; startAY: number; startBX: number; startBY: number }
            | { kind: Exclude<MoodboardItemKind, 'connector'>; id: string; startX: number; startY: number }
          > = [];
          let left = Infinity;
          let top = Infinity;
          let right = -Infinity;
          let bottom = -Infinity;
          for (const m of u.members) {
            if (m.kind === 'connector') {
              const conn = connectorById.get(m.id);
              if (!conn || isHiddenItem(conn) || isLockedItem(conn)) continue;
              const ax = Number(conn.ax) || 0;
              const ay = Number(conn.ay) || 0;
              const bx = Number(conn.bx) || 0;
              const by = Number(conn.by) || 0;
              left = Math.min(left, Math.min(ax, bx));
              top = Math.min(top, Math.min(ay, by));
              right = Math.max(right, Math.max(ax, bx));
              bottom = Math.max(bottom, Math.max(ay, by));
              items.push({ kind: 'connector', id: conn.id, startAX: ax, startAY: ay, startBX: bx, startBY: by });
              continue;
            }

            const it = m.kind === 'image' ? imageById.get(m.id) : m.kind === 'text' ? textById.get(m.id) : shapeById.get(m.id);
            if (!it || isHiddenItem(it) || isLockedItem(it)) continue;
            const cx = Number((it as any).x) || 0;
            const cy = Number((it as any).y) || 0;
            const w = Number((it as any).w) || 0;
            const h = Number((it as any).h) || 0;
            left = Math.min(left, cx - w / 2);
            top = Math.min(top, cy - h / 2);
            right = Math.max(right, cx + w / 2);
            bottom = Math.max(bottom, cy + h / 2);
            items.push({ kind: m.kind, id: m.id, startX: cx, startY: cy });
          }
          if (!items.length) continue;
          const w = right - left;
          const h = bottom - top;
          dragUnits.push({
            key: u.key,
            kind: u.kind,
            groupId: u.groupId,
            bounds: { left, top, right, bottom, cx: left + w / 2, cy: top + h / 2, w, h },
            items,
          });
        }
        if (!dragUnits.length) {
          redraw();
          return;
        }

        dragRef.current = { startPt: pt, startState: current, units: dragUnits, moved: false };
        canvas.setPointerCapture(evt.pointerId);
        redraw();
        return;
      }

      if (currentTool === 'shape') {
        const cur = valueRef.current;
        const shapes = Array.isArray(cur.shapes) ? cur.shapes : [];
        const connectors = Array.isArray(cur.connectors) ? cur.connectors : [];
        const images = Array.isArray(cur.images) ? cur.images : [];
        const texts = Array.isArray(cur.texts) ? cur.texts : [];
        const folderFlags = computeEffectiveFolderFlags(Array.isArray(cur.folders) ? cur.folders : []);
        const isHiddenItem = (it: any): boolean => isItemEffectivelyHidden(it, folderFlags);
        const maxZ = Math.max(
          0,
          ...shapes.map((s, i) => zFor('shape', i, (s as any).z)),
          ...connectors.map((c, i) => zFor('connector', i, (c as any).z)),
          ...images.map((img, i) => zFor('image', i, (img as any).z)),
          ...texts.map((t, i) => zFor('text', i, (t as any).z))
        );

        const id = makeMoodId('mbs_');
        const item: MoodboardShape = {
          id,
          shape: shapeKindRef.current,
          x: pt.x,
          y: pt.y,
          w: 0.001,
          h: 0.001,
          z: maxZ + 1,
          fill: { kind: 'solid' as const, color: '#ffffff' },
          stroke: { color: 'rgba(0,0,0,0.25)', width: 1 },
        };
        valueRef.current = { ...cur, shapes: [...shapes, item] };
        shapeDragRef.current = { startPt: pt, startState: cur, shapeId: id, shape: item.shape, moved: false };
        selectionRef.current = [{ kind: 'shape', id }];
        setSelection([{ kind: 'shape', id }]);
        canvas.setPointerCapture(evt.pointerId);
        redraw();
        return;
      }

      if (currentTool === 'connector') {
        const cur = valueRef.current;
        const shapes = Array.isArray(cur.shapes) ? cur.shapes : [];
        const connectors = Array.isArray(cur.connectors) ? cur.connectors : [];
        const images = Array.isArray(cur.images) ? cur.images : [];
        const texts = Array.isArray(cur.texts) ? cur.texts : [];
        const maxZ = Math.max(
          0,
          ...shapes.map((s, i) => zFor('shape', i, (s as any).z)),
          ...connectors.map((c, i) => zFor('connector', i, (c as any).z)),
          ...images.map((img, i) => zFor('image', i, (img as any).z)),
          ...texts.map((t, i) => zFor('text', i, (t as any).z))
        );

        const id = makeMoodId('mbc_');
        const item: MoodboardConnector = {
          id,
          kind: connectorKindRef.current,
          ax: pt.x,
          ay: pt.y,
          bx: pt.x,
          by: pt.y,
          z: maxZ + 1,
          color: colorRef.current,
          width: sizeRef.current,
        };
        valueRef.current = { ...cur, connectors: [...connectors, item] };
        connectorDragRef.current = { startPt: pt, startState: cur, connectorId: id, moved: false };
        selectionRef.current = [{ kind: 'connector', id }];
        setSelection([{ kind: 'connector', id }]);
        canvas.setPointerCapture(evt.pointerId);
        redraw();
        return;
      }

      if (currentTool === 'text') {
        const cur = valueRef.current;
        const shapes = Array.isArray(cur.shapes) ? cur.shapes : [];
        const connectors = Array.isArray(cur.connectors) ? cur.connectors : [];
        const images = Array.isArray(cur.images) ? cur.images : [];
        const texts = Array.isArray(cur.texts) ? cur.texts : [];
        const maxZ = Math.max(
          0,
          ...shapes.map((s, i) => zFor('shape', i, (s as any).z)),
          ...connectors.map((c, i) => zFor('connector', i, (c as any).z)),
          ...images.map((img, i) => zFor('image', i, (img as any).z)),
          ...texts.map((t, i) => zFor('text', i, (t as any).z))
        );
        const id = makeMoodId('mbt_');
        const item: MoodboardText = {
          id,
          x: pt.x,
          y: pt.y,
          w: 0.28,
          h: 0.16,
          z: maxZ + 1,
          text: '',
          fontSize: 18,
          color: colorRef.current,
          bg: '#fdf5e6',
        };
        const next = { ...cur, texts: [...(cur.texts || []), item] };
        commit(next);
        selectionRef.current = [{ kind: 'text', id }];
        setSelection([{ kind: 'text', id }]);
        setTool('move');
        return;
      }

      if (currentTool === 'bucket') {
        const cur = valueRef.current;
        const sel = Array.isArray(selectionRef.current) ? selectionRef.current : [];
        const shapeIds = sel.filter((s) => s.kind === 'shape').map((s) => s.id);
        if (shapeIds.length) {
          const shapes = Array.isArray(cur.shapes) ? cur.shapes : [];
          const folderFlags = computeEffectiveFolderFlags(Array.isArray(cur.folders) ? cur.folders : []);
          const idSet = new Set(shapeIds);
          const nextShapes = shapes.map((s) => {
            if (!s || isItemEffectivelyHidden(s, folderFlags) || isItemEffectivelyLocked(s, folderFlags)) return s;
            if (!idSet.has(s.id)) return s;
            return { ...s, fill: { kind: 'solid' as const, color: colorRef.current } };
          });
          commit({ ...cur, shapes: nextShapes });
          return;
        }

        const next = { ...cur, background: { kind: 'solid' as const, color: colorRef.current } };
        commit(next);
        return;
      }

      if (currentTool === 'gradient') {
        const startState = valueRef.current;
        const angle = Number(gradientAngleRef.current) || 0;
        const mode = gradientModeRef.current;
        const sel = Array.isArray(selectionRef.current) ? selectionRef.current : [];
        const shapeIdsAll = sel.filter((s) => s.kind === 'shape').map((s) => s.id);
        const startShapes = Array.isArray(startState.shapes) ? startState.shapes : [];
        const byId = new Map(startShapes.map((s) => [s.id, s]));
        const folderFlags = computeEffectiveFolderFlags(Array.isArray(startState.folders) ? startState.folders : []);
        const shapeIds = shapeIdsAll.filter((id) => {
          const s = byId.get(id);
          return !!s && !isItemEffectivelyHidden(s, folderFlags) && !isItemEffectivelyLocked(s, folderFlags);
        });

        if (shapeIds.length) {
          gradientDragRef.current = { startPt: pt, startState, moved: false, lastAngle: angle, target: 'shapes', shapeIds };
          const idSet = new Set(shapeIds);
          const nextShapes = startShapes.map((s) =>
            idSet.has(s.id)
              ? { ...s, fill: { kind: 'gradient' as const, from: colorRef.current, to: gradientToRef.current, angle, mode } }
              : s
          );
          valueRef.current = { ...startState, shapes: nextShapes };
        } else {
          gradientDragRef.current = { startPt: pt, startState, moved: false, lastAngle: angle, target: 'background' };
          valueRef.current = {
            ...startState,
            background: {
              kind: 'gradient' as const,
              from: colorRef.current,
              to: gradientToRef.current,
              angle,
              mode,
            },
          };
        }
        canvas.setPointerCapture(evt.pointerId);
        redraw();
        return;
      }

      if (current.strokesLocked) return;
      drawingRef.current = true;
      canvas.setPointerCapture(evt.pointerId);
      strokeRef.current = {
        tool: currentTool,
        size: sizeRef.current,
        color: colorRef.current,
        points: currentTool === 'pen' || currentTool === 'eraser' ? [pt] : [pt, pt],
      };
      redraw();
    };

    const onPointerMove = (evt: PointerEvent) => {
      const panning = panDragRef.current;
      if (panning) {
        const rect = canvas.getBoundingClientRect();
        const sx = evt.clientX - rect.left;
        const sy = evt.clientY - rect.top;
        const dx = sx - panning.startSX;
        const dy = sy - panning.startSY;
        viewRef.current.panX = panning.startPanX + dx;
        viewRef.current.panY = panning.startPanY + dy;
        redraw();
        return;
      }

      const boxSel = boxSelectRef.current;
      if (boxSel) {
        const pt = pointFromEvent(evt, canvas, viewRef.current);
        boxSel.curPt = pt;
        if (!boxSel.moved) {
          const rect = canvas.getBoundingClientRect();
          const zoom = Math.max(0.25, Math.min(6, Number(viewRef.current.zoom) || 1));
          const dxPx = (pt.x - boxSel.startPt.x) * rect.width * zoom;
          const dyPx = (pt.y - boxSel.startPt.y) * rect.height * zoom;
          if (Math.hypot(dxPx, dyPx) >= 4) boxSel.moved = true;
        }
        redraw();
        return;
      }

      const guideDrag = guideDragRef.current;
      if (guideDrag) {
        const pt = pointFromEvent(evt, canvas, viewRef.current);
        const pos = guideDrag.axis === 'y' ? pt.y : pt.x;
        const startGuides = Array.isArray(guideDrag.startState.guides) ? guideDrag.startState.guides : [];
        const nextGuides = startGuides.map((g) => (g && g.id === guideDrag.guideId ? { ...g, pos } : g));
        valueRef.current = { ...guideDrag.startState, guides: nextGuides };
        guideDrag.moved = true;
        snapPreviewRef.current = null;
        redraw();
        return;
      }

      const shapeDrag = shapeDragRef.current;
      if (shapeDrag) {
        const pt = pointFromEvent(evt, canvas, viewRef.current);
        const start = shapeDrag.startPt;
        let left = 0;
        let right = 0;
        let top = 0;
        let bottom = 0;

        if (evt.altKey) {
          let w = Math.abs(pt.x - start.x) * 2;
          let h = Math.abs(pt.y - start.y) * 2;
          if (evt.shiftKey) {
            const m = Math.max(w, h);
            w = m;
            h = m;
          }
          left = start.x - w / 2;
          right = start.x + w / 2;
          top = start.y - h / 2;
          bottom = start.y + h / 2;
        } else {
          let w = Math.abs(pt.x - start.x);
          let h = Math.abs(pt.y - start.y);
          if (evt.shiftKey) {
            const m = Math.max(w, h);
            w = m;
            h = m;
          }
          if (pt.x >= start.x) {
            left = start.x;
            right = start.x + w;
          } else {
            left = start.x - w;
            right = start.x;
          }
          if (pt.y >= start.y) {
            top = start.y;
            bottom = start.y + h;
          } else {
            top = start.y - h;
            bottom = start.y;
          }
        }

        left = clamp01(left);
        right = clamp01(right);
        top = clamp01(top);
        bottom = clamp01(bottom);

        const minSize = 0.01;
        const w = Math.min(1, Math.max(minSize, right - left));
        const h = Math.min(1, Math.max(minSize, bottom - top));
        const cx = clamp01(left + w / 2);
        const cy = clamp01(top + h / 2);

        const cur = valueRef.current;
        const shapes = Array.isArray(cur.shapes) ? cur.shapes : [];
        const idx = shapes.findIndex((s) => s && s.id === shapeDrag.shapeId);
        if (idx < 0) return;
        const basis = shapes[idx];
        const folderFlags = computeEffectiveFolderFlags(Array.isArray(cur.folders) ? cur.folders : []);
        if (!basis || isItemEffectivelyLocked(basis, folderFlags)) return;

        const nextShapes = shapes.map((s, i) => (i === idx ? { ...s, x: cx, y: cy, w, h } : s));
        valueRef.current = { ...cur, shapes: nextShapes };
        shapeDrag.moved = true;
        redraw();
        return;
      }

      const connectorEdit = connectorEditRef.current;
      if (connectorEdit) {
        const pt = pointFromEvent(evt, canvas, viewRef.current);
        const cur = valueRef.current;
        const connectors = Array.isArray(cur.connectors) ? cur.connectors : [];
        const idx = connectors.findIndex((c) => c && c.id === connectorEdit.connectorId);
        if (idx < 0) return;
        const basis = connectors[idx];
        const folderFlags = computeEffectiveFolderFlags(Array.isArray(cur.folders) ? cur.folders : []);
        if (!basis || isItemEffectivelyHidden(basis, folderFlags) || isItemEffectivelyLocked(basis, folderFlags)) return;
        const nextConn =
          connectorEdit.endpoint === 'a'
            ? { ...basis, ax: pt.x, ay: pt.y }
            : { ...basis, bx: pt.x, by: pt.y };
        const nextConnectors = connectors.map((c, i) => (i === idx ? nextConn : c));
        valueRef.current = { ...cur, connectors: nextConnectors };
        connectorEdit.moved = true;
        redraw();
        return;
      }

      const connectorDrag = connectorDragRef.current;
      if (connectorDrag) {
        const pt = pointFromEvent(evt, canvas, viewRef.current);
        const cur = valueRef.current;
        const connectors = Array.isArray(cur.connectors) ? cur.connectors : [];
        const idx = connectors.findIndex((c) => c && c.id === connectorDrag.connectorId);
        if (idx < 0) return;
        const basis = connectors[idx];
        const folderFlags = computeEffectiveFolderFlags(Array.isArray(cur.folders) ? cur.folders : []);
        if (!basis || isItemEffectivelyHidden(basis, folderFlags) || isItemEffectivelyLocked(basis, folderFlags)) return;
        let bx = pt.x;
        let by = pt.y;
        if (evt.shiftKey) {
          const dx = bx - connectorDrag.startPt.x;
          const dy = by - connectorDrag.startPt.y;
          if (Math.abs(dx) >= Math.abs(dy)) by = connectorDrag.startPt.y;
          else bx = connectorDrag.startPt.x;
        }
        const nextConnectors = connectors.map((c, i) => (i === idx ? { ...c, bx, by } : c));
        valueRef.current = { ...cur, connectors: nextConnectors };
        connectorDrag.moved = true;
        redraw();
        return;
      }

      const gradientDrag = gradientDragRef.current;
      if (gradientDrag) {
        const pt = pointFromEvent(evt, canvas, viewRef.current);
        const mode = gradientModeRef.current;
        let angle = gradientDrag.lastAngle;
        if (mode === 'linear') {
          const dx = pt.x - gradientDrag.startPt.x;
          const dy = pt.y - gradientDrag.startPt.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len > 0.001) {
            angle = (Math.atan2(dy, dx) * 180) / Math.PI;
            angle = ((angle % 360) + 360) % 360;
            if (evt.shiftKey) angle = Math.round(angle / 15) * 15;
            gradientDrag.moved = true;
            gradientDrag.lastAngle = angle;
          }
        }

        if (gradientDrag.target === 'shapes' && gradientDrag.shapeIds?.length) {
          const startShapes = Array.isArray(gradientDrag.startState.shapes) ? gradientDrag.startState.shapes : [];
          const idSet = new Set(gradientDrag.shapeIds);
          const nextShapes = startShapes.map((s) =>
            idSet.has(s.id)
              ? { ...s, fill: { kind: 'gradient' as const, from: colorRef.current, to: gradientToRef.current, angle, mode } }
              : s
          );
          valueRef.current = { ...gradientDrag.startState, shapes: nextShapes };
        } else {
          valueRef.current = {
            ...gradientDrag.startState,
            background: {
              kind: 'gradient' as const,
              from: colorRef.current,
              to: gradientToRef.current,
              angle,
              mode,
            },
          };
        }
        redraw();
        return;
      }

      const rotating = rotateRef.current;
      if (rotating) {
        const pt = pointFromEvent(evt, canvas, viewRef.current);
        const basis = rotating.startItem;
        const cur = valueRef.current;
        const folderFlags = computeEffectiveFolderFlags(Array.isArray(cur.folders) ? cur.folders : []);
        if (!basis || isItemEffectivelyLocked(basis, folderFlags)) return;

        const rect = canvas.getBoundingClientRect();
        const cx = Number((basis as any).x) || 0;
        const cy = Number((basis as any).y) || 0;
        const cxPx = cx * rect.width;
        const cyPx = cy * rect.height;
        const px = pt.x * rect.width;
        const py = pt.y * rect.height;

        const ang = Math.atan2(py - cyPx, px - cxPx);
        let delta = ang - rotating.startAngleRad;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        let nextRot = rotating.startRotDeg + (delta * 180) / Math.PI;
        if (evt.shiftKey) nextRot = Math.round(nextRot / 15) * 15;
        nextRot = normalizeAngleDeg(nextRot);

        if (rotating.itemKind === 'image') {
          const idx = (cur.images || []).findIndex((x) => x && x.id === rotating.id);
          if (idx < 0) return;
          const img = cur.images[idx];
          if (!img || isItemEffectivelyLocked(img, folderFlags)) return;
          if (normalizeAngleDeg(Number(img.rot) || 0) === nextRot) return;
          const nextImages = cur.images.map((x, i) => (i === idx ? { ...x, rot: nextRot } : x));
          valueRef.current = { ...cur, images: nextImages };
          rotating.moved = true;
          redraw();
          return;
        }

        if (rotating.itemKind === 'shape') {
          const shapes = Array.isArray(cur.shapes) ? cur.shapes : [];
          const idx = shapes.findIndex((x) => x && x.id === rotating.id);
          if (idx < 0) return;
          const s = shapes[idx];
          if (!s || isItemEffectivelyLocked(s, folderFlags)) return;
          if (normalizeAngleDeg(Number(s.rot) || 0) === nextRot) return;
          const nextShapes = shapes.map((x, i) => (i === idx ? { ...x, rot: nextRot } : x));
          valueRef.current = { ...cur, shapes: nextShapes };
          rotating.moved = true;
          redraw();
          return;
        }

        const texts = Array.isArray(cur.texts) ? cur.texts : [];
        const idx = texts.findIndex((x) => x && x.id === rotating.id);
        if (idx < 0) return;
        const t = texts[idx];
        if (!t || isItemEffectivelyLocked(t, folderFlags)) return;
        if (normalizeAngleDeg(Number(t.rot) || 0) === nextRot) return;
        const nextTexts = texts.map((x, i) => (i === idx ? { ...x, rot: nextRot } : x));
        valueRef.current = { ...cur, texts: nextTexts };
        rotating.moved = true;
        redraw();
        return;
      }

      const resizing = resizeRef.current;
      if (resizing) {
        const pt = pointFromEvent(evt, canvas, viewRef.current);

        if (resizing.kind === 'item') {
          const basis = resizing.startItem;
          const folderFlags = computeEffectiveFolderFlags(Array.isArray(valueRef.current.folders) ? valueRef.current.folders : []);
          if (!basis || isItemEffectivelyLocked(basis, folderFlags)) return;

          const minSize = 0.02;
          const ratio = (basis as any).h > 0 ? (basis as any).w / (basis as any).h : 1;

          const isShift = !!evt.shiftKey;
          const isAlt = !!evt.altKey;

          let nextX = Number((basis as any).x) || 0;
          let nextY = Number((basis as any).y) || 0;
          let nextW = Number((basis as any).w) || 0;
          let nextH = Number((basis as any).h) || 0;

          const rotDeg = normalizeAngleDeg(Number((basis as any).rot) || 0);
          if (rotDeg) {
            const startX = nextX;
            const startY = nextY;
            const startW = nextW;
            const startH = nextH;
            const local = toLocalXY(pt.x, pt.y, startX, startY, rotDeg);

            if (isAlt) {
              let w = Math.abs(local.x) * 2;
              let h = Math.abs(local.y) * 2;
              if (isShift) {
                if (h <= 0) h = minSize;
                if (w / h > ratio) w = h * ratio;
                else h = w / ratio;
              }
              nextW = Math.min(1, Math.max(minSize, w));
              nextH = Math.min(1, Math.max(minSize, h));
              nextX = clamp01(startX);
              nextY = clamp01(startY);
            } else {
              const anchor =
                resizing.handle === 'nw'
                  ? { x: startW / 2, y: startH / 2 }
                  : resizing.handle === 'ne'
                    ? { x: -startW / 2, y: startH / 2 }
                    : resizing.handle === 'se'
                      ? { x: -startW / 2, y: -startH / 2 }
                      : { x: startW / 2, y: -startH / 2 };

              let w = Math.abs(anchor.x - local.x);
              let h = Math.abs(anchor.y - local.y);
              if (isShift) {
                if (h <= 0) h = minSize;
                if (w / h > ratio) w = h * ratio;
                else h = w / ratio;
              }
              nextW = Math.min(1, Math.max(minSize, w));
              nextH = Math.min(1, Math.max(minSize, h));

              const centerLocal = { x: (anchor.x + local.x) / 2, y: (anchor.y + local.y) / 2 };
              const center = fromLocalXY(centerLocal.x, centerLocal.y, startX, startY, rotDeg);
              nextX = clamp01(center.x);
              nextY = clamp01(center.y);
            }
          } else if (isAlt) {
            let w = Math.abs(pt.x - nextX) * 2;
            let h = Math.abs(pt.y - nextY) * 2;
            if (isShift) {
              if (h <= 0) h = minSize;
              if (w / h > ratio) w = h * ratio;
              else h = w / ratio;
            }
            nextW = Math.min(1, Math.max(minSize, w));
            nextH = Math.min(1, Math.max(minSize, h));
            nextX = clamp01(nextX);
            nextY = clamp01(nextY);
          } else {
            const ax =
              resizing.handle === 'nw' || resizing.handle === 'sw'
                ? nextX + nextW / 2
                : nextX - nextW / 2;
            const ay =
              resizing.handle === 'nw' || resizing.handle === 'ne'
                ? nextY + nextH / 2
                : nextY - nextH / 2;

            let w = Math.abs(ax - pt.x);
            let h = Math.abs(ay - pt.y);
            if (isShift) {
              if (h <= 0) h = minSize;
              if (w / h > ratio) w = h * ratio;
              else h = w / ratio;
            }

            nextW = Math.min(1, Math.max(minSize, w));
            nextH = Math.min(1, Math.max(minSize, h));

            if (resizing.handle === 'nw') {
              nextX = ax - nextW / 2;
              nextY = ay - nextH / 2;
            } else if (resizing.handle === 'ne') {
              nextX = ax + nextW / 2;
              nextY = ay - nextH / 2;
            } else if (resizing.handle === 'se') {
              nextX = ax + nextW / 2;
              nextY = ay + nextH / 2;
            } else {
              nextX = ax - nextW / 2;
              nextY = ay + nextH / 2;
            }

            nextX = clamp01(nextX);
            nextY = clamp01(nextY);
          }

          if (snapRef.current) {
            const rect = canvas.getBoundingClientRect();
            const stepX = rect.width > 0 ? 40 / rect.width : 0;
            const stepY = rect.height > 0 ? 40 / rect.height : 0;
            if (stepX > 0) {
              nextX = clamp01(Math.round(nextX / stepX) * stepX);
              nextW = Math.min(1, Math.max(minSize, Math.round(nextW / stepX) * stepX));
            }
            if (stepY > 0) {
              nextY = clamp01(Math.round(nextY / stepY) * stepY);
              nextH = Math.min(1, Math.max(minSize, Math.round(nextH / stepY) * stepY));
            }
          }

          const cur = valueRef.current;
          const folderFlagsNow = computeEffectiveFolderFlags(Array.isArray(cur.folders) ? cur.folders : []);
          if (resizing.itemKind === 'image') {
            const idx = (cur.images || []).findIndex((x) => x && x.id === resizing.id);
            if (idx < 0) return;
            const img = cur.images[idx];
            if (!img || isItemEffectivelyLocked(img, folderFlagsNow)) return;
            const changed = img.x !== nextX || img.y !== nextY || img.w !== nextW || img.h !== nextH;
            if (!changed) return;
            const nextImages = cur.images.map((x, i) => (i === idx ? { ...x, x: nextX, y: nextY, w: nextW, h: nextH } : x));
            const next = { ...cur, images: nextImages };
            valueRef.current = next;
            resizing.moved = true;
            redraw();
            return;
          }

          if (resizing.itemKind === 'shape') {
            const shapes = Array.isArray(cur.shapes) ? cur.shapes : [];
            const idx = shapes.findIndex((x) => x && x.id === resizing.id);
            if (idx < 0) return;
            const s = shapes[idx];
            if (!s || isItemEffectivelyLocked(s, folderFlagsNow)) return;
            const changed = s.x !== nextX || s.y !== nextY || s.w !== nextW || s.h !== nextH;
            if (!changed) return;
            const nextShapes = shapes.map((x, i) => (i === idx ? { ...x, x: nextX, y: nextY, w: nextW, h: nextH } : x));
            const next = { ...cur, shapes: nextShapes };
            valueRef.current = next;
            resizing.moved = true;
            redraw();
            return;
          }

          const texts = Array.isArray(cur.texts) ? cur.texts : [];
          const idx = texts.findIndex((x) => x && x.id === resizing.id);
          if (idx < 0) return;
          const t = texts[idx];
          if (!t || isItemEffectivelyLocked(t, folderFlagsNow)) return;
          const changed = t.x !== nextX || t.y !== nextY || t.w !== nextW || t.h !== nextH;
          if (!changed) return;
          const nextTexts = texts.map((x, i) => (i === idx ? { ...x, x: nextX, y: nextY, w: nextW, h: nextH } : x));
          const next = { ...cur, texts: nextTexts };
          valueRef.current = next;
          resizing.moved = true;
          redraw();
          return;
        }

        const start = resizing.startBounds;
        const minSize = 0.02;
        const ratio = start.h > 0 ? start.w / start.h : 1;
        const isShift = !!evt.shiftKey;
        const isAlt = !!evt.altKey;

        let nextCx = start.cx;
        let nextCy = start.cy;
        let nextW = start.w;
        let nextH = start.h;

        if (isAlt) {
          let w = Math.abs(pt.x - start.cx) * 2;
          let h = Math.abs(pt.y - start.cy) * 2;
          if (isShift) {
            if (h <= 0) h = minSize;
            if (w / h > ratio) w = h * ratio;
            else h = w / ratio;
          }
          nextW = Math.min(1, Math.max(minSize, w));
          nextH = Math.min(1, Math.max(minSize, h));
          nextCx = clamp01(start.cx);
          nextCy = clamp01(start.cy);
        } else {
          const anchorX =
            resizing.handle === 'nw' || resizing.handle === 'sw' ? start.right : start.left;
          const anchorY =
            resizing.handle === 'nw' || resizing.handle === 'ne' ? start.bottom : start.top;

          let w = Math.abs(anchorX - pt.x);
          let h = Math.abs(anchorY - pt.y);
          if (isShift) {
            if (h <= 0) h = minSize;
            if (w / h > ratio) w = h * ratio;
            else h = w / ratio;
          }
          nextW = Math.min(1, Math.max(minSize, w));
          nextH = Math.min(1, Math.max(minSize, h));

          let left = 0;
          let top = 0;
          if (resizing.handle === 'nw') {
            left = anchorX - nextW;
            top = anchorY - nextH;
          } else if (resizing.handle === 'ne') {
            left = anchorX;
            top = anchorY - nextH;
          } else if (resizing.handle === 'se') {
            left = anchorX;
            top = anchorY;
          } else {
            left = anchorX - nextW;
            top = anchorY;
          }
          let right = left + nextW;
          let bottom = top + nextH;

          if (left < 0) {
            right -= left;
            left = 0;
          }
          if (right > 1) {
            left -= right - 1;
            right = 1;
          }
          if (top < 0) {
            bottom -= top;
            top = 0;
          }
          if (bottom > 1) {
            top -= bottom - 1;
            bottom = 1;
          }

          nextW = Math.max(minSize, right - left);
          nextH = Math.max(minSize, bottom - top);
          nextCx = clamp01(left + nextW / 2);
          nextCy = clamp01(top + nextH / 2);
        }

        if (snapRef.current) {
          const rect = canvas.getBoundingClientRect();
          const stepX = rect.width > 0 ? 40 / rect.width : 0;
          const stepY = rect.height > 0 ? 40 / rect.height : 0;
          if (stepX > 0) {
            nextCx = clamp01(Math.round(nextCx / stepX) * stepX);
            nextW = Math.min(1, Math.max(minSize, Math.round(nextW / stepX) * stepX));
          }
          if (stepY > 0) {
            nextCy = clamp01(Math.round(nextCy / stepY) * stepY);
            nextH = Math.min(1, Math.max(minSize, Math.round(nextH / stepY) * stepY));
          }
        }

        const scaleX = start.w > 0 ? nextW / start.w : 1;
        const scaleY = start.h > 0 ? nextH / start.h : 1;

        const updates = new Map<
          string,
          | { kind: 'box'; x: number; y: number; w: number; h: number }
          | { kind: 'connector'; ax: number; ay: number; bx: number; by: number }
        >();
        for (const it of resizing.startItems) {
          if (it.locked) continue;
          if (it.kind === 'connector') {
            const relAX = start.w > 0 ? (it.ax - start.cx) / start.w : 0;
            const relAY = start.h > 0 ? (it.ay - start.cy) / start.h : 0;
            const relBX = start.w > 0 ? (it.bx - start.cx) / start.w : 0;
            const relBY = start.h > 0 ? (it.by - start.cy) / start.h : 0;
            const ax = clamp01(nextCx + relAX * nextW);
            const ay = clamp01(nextCy + relAY * nextH);
            const bx = clamp01(nextCx + relBX * nextW);
            const by = clamp01(nextCy + relBY * nextH);
            updates.set(`connector:${it.id}`, { kind: 'connector', ax, ay, bx, by });
            continue;
          }

          const relX = start.w > 0 ? (it.x - start.cx) / start.w : 0;
          const relY = start.h > 0 ? (it.y - start.cy) / start.h : 0;
          const x = clamp01(nextCx + relX * nextW);
          const y = clamp01(nextCy + relY * nextH);
          const w = Math.min(1, Math.max(minSize, (Number(it.w) || 0) * scaleX));
          const h = Math.min(1, Math.max(minSize, (Number(it.h) || 0) * scaleY));
          updates.set(`${it.kind}:${it.id}`, { kind: 'box', x, y, w, h });
        }
        if (!updates.size) return;

        const cur = valueRef.current;
        const shapes = Array.isArray(cur.shapes) ? cur.shapes : [];
        const nextShapes = shapes.map((s) => {
          const u = updates.get(`shape:${s.id}`);
          return u && u.kind === 'box' ? { ...s, x: u.x, y: u.y, w: u.w, h: u.h } : s;
        });
        const connectors = Array.isArray(cur.connectors) ? cur.connectors : [];
        const nextConnectors = connectors.map((c) => {
          const u = updates.get(`connector:${c.id}`);
          return u && u.kind === 'connector' ? { ...c, ax: u.ax, ay: u.ay, bx: u.bx, by: u.by } : c;
        });
        const nextImages = (cur.images || []).map((img) => {
          const u = updates.get(`image:${img.id}`);
          return u && u.kind === 'box' ? { ...img, x: u.x, y: u.y, w: u.w, h: u.h } : img;
        });
        const nextTexts = (cur.texts || []).map((t) => {
          const u = updates.get(`text:${t.id}`);
          return u && u.kind === 'box' ? { ...t, x: u.x, y: u.y, w: u.w, h: u.h } : t;
        });
        const next: MoodboardState = { ...cur, images: nextImages, texts: nextTexts };
        if (shapes.length || cur.shapes) next.shapes = nextShapes;
        if (connectors.length || cur.connectors) next.connectors = nextConnectors;
        valueRef.current = next;
        resizing.moved = true;
        redraw();
        return;
      }

      const dragging = dragRef.current;
      if (dragging) {
        const pt = pointFromEvent(evt, canvas, viewRef.current);
        const dx0 = pt.x - dragging.startPt.x;
        const dy0 = pt.y - dragging.startPt.y;
        if (!Number.isFinite(dx0) || !Number.isFinite(dy0)) return;

        const cur = valueRef.current;
        const rect = canvas.getBoundingClientRect();
        const zoom = Math.max(0.25, Math.min(6, Number(viewRef.current.zoom) || 1));
        const stepX = rect.width > 0 ? 40 / rect.width : 0;
        const stepY = rect.height > 0 ? 40 / rect.height : 0;
        const tolX = rect.width > 0 ? (8 / zoom) / rect.width : 0;
        const tolY = rect.height > 0 ? (8 / zoom) / rect.height : 0;

        const selList = Array.isArray(selectionRef.current) ? selectionRef.current : [];
        const selSet = new Set(selList.map((s) => `${s.kind}:${s.id}`));
        const folderFlags = computeEffectiveFolderFlags(Array.isArray(cur.folders) ? cur.folders : []);
        const isHiddenItem = (it: any): boolean => isItemEffectivelyHidden(it, folderFlags);

        const candX: number[] = [];
        const candY: number[] = [];
        const curGuides = Array.isArray(cur.guides) ? cur.guides : [];
        if (snapGuidesRef.current) {
          for (const g of curGuides) {
            if (!g || (g as any).hidden) continue;
            const pos = Number((g as any).pos);
            if (!Number.isFinite(pos)) continue;
            if ((g as any).axis === 'y') candY.push(pos);
            else candX.push(pos);
          }
        }

        if (snapObjectsRef.current) {
          const shapes = Array.isArray(cur.shapes) ? cur.shapes : [];
          for (const s of shapes) {
            if (!s || isHiddenItem(s)) continue;
            if (selSet.has(`shape:${s.id}`)) continue;
            const cx = Number((s as any).x) || 0;
            const cy = Number((s as any).y) || 0;
            const w = Number((s as any).w) || 0;
            const h = Number((s as any).h) || 0;
            if (w <= 0 || h <= 0) continue;
            candX.push(cx - w / 2, cx, cx + w / 2);
            candY.push(cy - h / 2, cy, cy + h / 2);
          }

          const images = Array.isArray(cur.images) ? cur.images : [];
          for (const img of images) {
            if (!img || isHiddenItem(img)) continue;
            if (selSet.has(`image:${img.id}`)) continue;
            const cx = Number((img as any).x) || 0;
            const cy = Number((img as any).y) || 0;
            const w = Number((img as any).w) || 0;
            const h = Number((img as any).h) || 0;
            if (w <= 0 || h <= 0) continue;
            candX.push(cx - w / 2, cx, cx + w / 2);
            candY.push(cy - h / 2, cy, cy + h / 2);
          }

          const texts = Array.isArray(cur.texts) ? cur.texts : [];
          for (const t of texts) {
            if (!t || isHiddenItem(t)) continue;
            if (selSet.has(`text:${t.id}`)) continue;
            const cx = Number((t as any).x) || 0;
            const cy = Number((t as any).y) || 0;
            const w = Number((t as any).w) || 0;
            const h = Number((t as any).h) || 0;
            if (w <= 0 || h <= 0) continue;
            candX.push(cx - w / 2, cx, cx + w / 2);
            candY.push(cy - h / 2, cy, cy + h / 2);
          }
        }

        const updates = new Map<
          string,
          | { kind: 'pos'; x: number; y: number }
          | { kind: 'connector'; ax: number; ay: number; bx: number; by: number }
        >();

        const snapXs: number[] = [];
        const snapYs: number[] = [];

        for (const u of dragging.units) {
          let dx = dx0;
          let dy = dy0;
          let snappedX: number | null = null;
          let snappedY: number | null = null;

          if (snapRef.current && (snapGuidesRef.current || snapObjectsRef.current)) {
            const sx = bestSnapDelta(candX, [u.bounds.left + dx, u.bounds.cx + dx, u.bounds.right + dx], tolX);
            if (sx) {
              dx += sx.delta;
              snappedX = sx.line;
              snapXs.push(sx.line);
            }
            const sy = bestSnapDelta(candY, [u.bounds.top + dy, u.bounds.cy + dy, u.bounds.bottom + dy], tolY);
            if (sy) {
              dy += sy.delta;
              snappedY = sy.line;
              snapYs.push(sy.line);
            }
          }

          if (snapRef.current) {
            if (stepX > 0 && snappedX == null) {
              const desired = u.bounds.cx + dx;
              const snapped = Math.round(desired / stepX) * stepX;
              dx = snapped - u.bounds.cx;
            }
            if (stepY > 0 && snappedY == null) {
              const desired = u.bounds.cy + dy;
              const snapped = Math.round(desired / stepY) * stepY;
              dy = snapped - u.bounds.cy;
            }
          }

          dx = Math.max(-u.bounds.left, Math.min(1 - u.bounds.right, dx));
          dy = Math.max(-u.bounds.top, Math.min(1 - u.bounds.bottom, dy));

          for (const it of u.items) {
            if (it.kind === 'connector') {
              const ax = clamp01(it.startAX + dx);
              const ay = clamp01(it.startAY + dy);
              const bx = clamp01(it.startBX + dx);
              const by = clamp01(it.startBY + dy);
              updates.set(`connector:${it.id}`, { kind: 'connector', ax, ay, bx, by });
            } else {
              const x = clamp01(it.startX + dx);
              const y = clamp01(it.startY + dy);
              updates.set(`${it.kind}:${it.id}`, { kind: 'pos', x, y });
            }
          }
        }

        if (snapRef.current) {
          const xs = Array.from(new Set(snapXs.map((n) => Number(n)).filter((n) => Number.isFinite(n))));
          const ys = Array.from(new Set(snapYs.map((n) => Number(n)).filter((n) => Number.isFinite(n))));
          snapPreviewRef.current = xs.length || ys.length ? { xs, ys } : null;
        } else {
          snapPreviewRef.current = null;
        }

        if (!updates.size) return;

        let changed = false;
        const shapes = Array.isArray(cur.shapes) ? cur.shapes : [];
        const nextShapes = shapes.map((s) => {
          const u = updates.get(`shape:${s.id}`);
          if (!u || u.kind !== 'pos') return s;
          if (s.x !== u.x || s.y !== u.y) changed = true;
          return { ...s, x: u.x, y: u.y };
        });
        const connectors = Array.isArray(cur.connectors) ? cur.connectors : [];
        const nextConnectors = connectors.map((c) => {
          const u = updates.get(`connector:${c.id}`);
          if (!u || u.kind !== 'connector') return c;
          if (c.ax !== u.ax || c.ay !== u.ay || c.bx !== u.bx || c.by !== u.by) changed = true;
          return { ...c, ax: u.ax, ay: u.ay, bx: u.bx, by: u.by };
        });
        const nextImages = (cur.images || []).map((img) => {
          const u = updates.get(`image:${img.id}`);
          if (!u || u.kind !== 'pos') return img;
          if (img.x !== u.x || img.y !== u.y) changed = true;
          return { ...img, x: u.x, y: u.y };
        });
        const nextTexts = (cur.texts || []).map((t) => {
          const u = updates.get(`text:${t.id}`);
          if (!u || u.kind !== 'pos') return t;
          if (t.x !== u.x || t.y !== u.y) changed = true;
          return { ...t, x: u.x, y: u.y };
        });
        if (!changed) return;

        const next: MoodboardState = { ...cur, images: nextImages, texts: nextTexts };
        if (shapes.length || cur.shapes) next.shapes = nextShapes;
        if (connectors.length || cur.connectors) next.connectors = nextConnectors;
        valueRef.current = next;
        dragging.moved = true;
        redraw();
        return;
      }

      if (!drawingRef.current) return;
      if (!strokeRef.current) return;
      const pt = pointFromEvent(evt, canvas, viewRef.current);
      if (strokeRef.current.tool === 'pen' || strokeRef.current.tool === 'eraser') {
        strokeRef.current.points.push(pt);
      } else {
        if (strokeRef.current.points.length === 0) strokeRef.current.points = [pt, pt];
        else if (strokeRef.current.points.length === 1) strokeRef.current.points = [strokeRef.current.points[0], pt];
        else strokeRef.current.points[strokeRef.current.points.length - 1] = pt;
      }
      redraw();
    };

    const endStroke = () => {
      if (panDragRef.current) {
        panDragRef.current = null;
        redraw();
        return;
      }

      const boxSel = boxSelectRef.current;
      if (boxSel) {
        boxSelectRef.current = null;

        if (!boxSel.moved) {
          if (!boxSel.additive) {
            selectionRef.current = [];
            setSelection([]);
          } else {
            selectionRef.current = boxSel.startSel;
            setSelection(boxSel.startSel);
          }
          redraw();
          return;
        }

        const cur = valueRef.current;
        const shapes = Array.isArray(cur.shapes) ? cur.shapes : [];
        const connectors = Array.isArray(cur.connectors) ? cur.connectors : [];
        const images = Array.isArray(cur.images) ? cur.images : [];
        const texts = Array.isArray(cur.texts) ? cur.texts : [];
        const folderFlags = computeEffectiveFolderFlags(Array.isArray(cur.folders) ? cur.folders : []);
        const isHiddenItem = (it: any): boolean => isItemEffectivelyHidden(it, folderFlags);

        const leftSel = Math.min(boxSel.startPt.x, boxSel.curPt.x);
        const rightSel = Math.max(boxSel.startPt.x, boxSel.curPt.x);
        const topSel = Math.min(boxSel.startPt.y, boxSel.curPt.y);
        const bottomSel = Math.max(boxSel.startPt.y, boxSel.curPt.y);

        const hits: Array<{ kind: MoodboardItemKind; id: string; z: number }> = [];
        for (let i = 0; i < shapes.length; i++) {
          const s = shapes[i];
          if (!s || isHiddenItem(s)) continue;
          const w = Number(s.w) || 0;
          const h = Number(s.h) || 0;
          if (w <= 0 || h <= 0) continue;
          const cx = Number(s.x) || 0;
          const cy = Number(s.y) || 0;
          const l = cx - w / 2;
          const r = cx + w / 2;
          const t = cy - h / 2;
          const b = cy + h / 2;
          if (r < leftSel || l > rightSel || b < topSel || t > bottomSel) continue;
          hits.push({ kind: 'shape', id: s.id, z: zFor('shape', i, (s as any).z) });
        }
        for (let i = 0; i < connectors.length; i++) {
          const c = connectors[i];
          if (!c || isHiddenItem(c)) continue;
          const ax = Number(c.ax) || 0;
          const ay = Number(c.ay) || 0;
          const bx = Number(c.bx) || 0;
          const by = Number(c.by) || 0;
          const l = Math.min(ax, bx);
          const r = Math.max(ax, bx);
          const t = Math.min(ay, by);
          const b = Math.max(ay, by);
          if (r < leftSel || l > rightSel || b < topSel || t > bottomSel) continue;
          hits.push({ kind: 'connector', id: c.id, z: zFor('connector', i, (c as any).z) });
        }
        for (let i = 0; i < images.length; i++) {
          const img = images[i];
          if (!img || isHiddenItem(img)) continue;
          const w = Number(img.w) || 0;
          const h = Number(img.h) || 0;
          if (w <= 0 || h <= 0) continue;
          const cx = Number(img.x) || 0;
          const cy = Number(img.y) || 0;
          const l = cx - w / 2;
          const r = cx + w / 2;
          const t = cy - h / 2;
          const b = cy + h / 2;
          if (r < leftSel || l > rightSel || b < topSel || t > bottomSel) continue;
          hits.push({ kind: 'image', id: img.id, z: zFor('image', i, (img as any).z) });
        }
        for (let i = 0; i < texts.length; i++) {
          const t0 = texts[i];
          if (!t0 || isHiddenItem(t0)) continue;
          const w = Number(t0.w) || 0;
          const h = Number(t0.h) || 0;
          if (w <= 0 || h <= 0) continue;
          const cx = Number(t0.x) || 0;
          const cy = Number(t0.y) || 0;
          const l = cx - w / 2;
          const r = cx + w / 2;
          const t = cy - h / 2;
          const b = cy + h / 2;
          if (r < leftSel || l > rightSel || b < topSel || t > bottomSel) continue;
          hits.push({ kind: 'text', id: t0.id, z: zFor('text', i, (t0 as any).z) });
        }

        hits.sort((a, b) => b.z - a.z);

        const groupIds = new Set<string>();
        const getGroupId = (s: SelectedItem): string => {
          const it =
            s.kind === 'image'
              ? images.find((x) => x && x.id === s.id)
              : s.kind === 'text'
                ? texts.find((x) => x && x.id === s.id)
                : s.kind === 'connector'
                  ? connectors.find((x) => x && x.id === s.id)
                  : shapes.find((x) => x && x.id === s.id);
          return String((it as any)?.groupId ?? '').trim();
        };
        for (const h of hits) {
          const gid = getGroupId({ kind: h.kind, id: h.id });
          if (gid) groupIds.add(gid);
        }

        const outMap = new Map<string, SelectedItem>();
        if (boxSel.additive) {
          for (const s of boxSel.startSel) outMap.set(`${s.kind}:${s.id}`, s);
        }
        for (const h of hits) outMap.set(`${h.kind}:${h.id}`, { kind: h.kind, id: h.id });
        if (groupIds.size) {
          for (const s of shapes) {
            if (!s || isHiddenItem(s)) continue;
            if (groupIds.has(String((s as any).groupId ?? '').trim())) outMap.set(`shape:${s.id}`, { kind: 'shape', id: s.id });
          }
          for (const c of connectors) {
            if (!c || isHiddenItem(c)) continue;
            if (groupIds.has(String((c as any).groupId ?? '').trim())) outMap.set(`connector:${c.id}`, { kind: 'connector', id: c.id });
          }
          for (const img of images) {
            if (!img || isHiddenItem(img)) continue;
            if (groupIds.has(String((img as any).groupId ?? '').trim())) outMap.set(`image:${img.id}`, { kind: 'image', id: img.id });
          }
          for (const t of texts) {
            if (!t || isHiddenItem(t)) continue;
            if (groupIds.has(String((t as any).groupId ?? '').trim())) outMap.set(`text:${t.id}`, { kind: 'text', id: t.id });
          }
        }

        const nextSel = Array.from(outMap.values());
        selectionRef.current = nextSel;
        setSelection(nextSel);
        redraw();
        return;
      }

      const shapeDrag = shapeDragRef.current;
      if (shapeDrag) {
        shapeDragRef.current = null;
        if (!shapeDrag.moved) {
          const cur = valueRef.current;
          const shapes = Array.isArray(cur.shapes) ? cur.shapes : [];
          const folderFlags = computeEffectiveFolderFlags(Array.isArray(cur.folders) ? cur.folders : []);
          const idx = shapes.findIndex((s) => s && s.id === shapeDrag.shapeId);
          if (idx >= 0) {
            const s = shapes[idx];
            if (s && !isItemEffectivelyLocked(s, folderFlags)) {
              const defaultW = shapeDrag.shape === 'ellipse' ? 0.18 : 0.22;
              const defaultH = shapeDrag.shape === 'ellipse' ? 0.18 : 0.16;
              let x = clamp01(Number(s.x) || shapeDrag.startPt.x);
              let y = clamp01(Number(s.y) || shapeDrag.startPt.y);
              const w = Math.min(1, Math.max(0.01, defaultW));
              const h = Math.min(1, Math.max(0.01, defaultH));
              x = clamp01(Math.max(w / 2, Math.min(1 - w / 2, x)));
              y = clamp01(Math.max(h / 2, Math.min(1 - h / 2, y)));
              const nextShapes = shapes.map((it, i) => (i === idx ? { ...it, x, y, w, h } : it));
              valueRef.current = { ...cur, shapes: nextShapes };
            }
          }
        }

        commit(valueRef.current, { historyPrev: shapeDrag.startState });
        return;
      }

      const connectorEdit = connectorEditRef.current;
      if (connectorEdit) {
        connectorEditRef.current = null;
        if (connectorEdit.moved) {
          commit(valueRef.current, { historyPrev: connectorEdit.startState });
          return;
        }
        redraw();
        return;
      }

      const connectorDrag = connectorDragRef.current;
      if (connectorDrag) {
        connectorDragRef.current = null;
        if (!connectorDrag.moved) {
          const cur = valueRef.current;
          const connectors = Array.isArray(cur.connectors) ? cur.connectors : [];
          const folderFlags = computeEffectiveFolderFlags(Array.isArray(cur.folders) ? cur.folders : []);
          const idx = connectors.findIndex((c) => c && c.id === connectorDrag.connectorId);
          if (idx >= 0) {
            const c = connectors[idx];
            if (c && !isItemEffectivelyLocked(c, folderFlags)) {
              const defaultLen = 0.18;
              const ax = clamp01(Number(c.ax) || connectorDrag.startPt.x);
              const ay = clamp01(Number(c.ay) || connectorDrag.startPt.y);
              const bx = clamp01(Math.max(0, Math.min(1, ax + defaultLen)));
              const by = ay;
              const nextConnectors = connectors.map((it, i) => (i === idx ? { ...it, ax, ay, bx, by } : it));
              valueRef.current = { ...cur, connectors: nextConnectors };
            }
          }
        }

        commit(valueRef.current, { historyPrev: connectorDrag.startState });
        return;
      }

      const gradientDrag = gradientDragRef.current;
      if (gradientDrag) {
        gradientDragRef.current = null;
        setGradientAngle(gradientDrag.lastAngle);
        commit(valueRef.current, { historyPrev: gradientDrag.startState });
        return;
      }

      const guideDrag = guideDragRef.current;
      if (guideDrag) {
        guideDragRef.current = null;
        snapPreviewRef.current = null;
        if (guideDrag.moved) {
          commit(valueRef.current, { historyPrev: guideDrag.startState });
          return;
        }
        redraw();
        return;
      }

      const rotating = rotateRef.current;
      if (rotating) {
        rotateRef.current = null;
        snapPreviewRef.current = null;
        if (rotating.moved) {
          commit(valueRef.current, { historyPrev: rotating.startState });
          return;
        }
        redraw();
        return;
      }

      const resizing = resizeRef.current;
      if (resizing) {
        resizeRef.current = null;
        snapPreviewRef.current = null;
        if (resizing.moved) {
          commit(valueRef.current, { historyPrev: resizing.startState });
          return;
        }
        redraw();
        return;
      }

      const dragging = dragRef.current;
      if (dragging) {
        dragRef.current = null;
        snapPreviewRef.current = null;
        if (dragging.moved) {
          commit(valueRef.current, { historyPrev: dragging.startState });
          return;
        }
        redraw();
        return;
      }

      if (!drawingRef.current) return;
      drawingRef.current = false;
      const done = strokeRef.current;
      strokeRef.current = null;
      if (done && done.points.length > 1) {
        const cur = valueRef.current;
        const next = { ...cur, strokes: [...cur.strokes, done] };
        commit(next);
        return;
      }
      redraw();
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', endStroke);
    canvas.addEventListener('pointercancel', endStroke);
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', endStroke);
      canvas.removeEventListener('pointercancel', endStroke);
    };
  }, [commit, redraw]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (evt: WheelEvent) => {
      evt.preventDefault();
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const view = viewRef.current;
      const prevZoom = Math.max(0.25, Math.min(6, Number(view.zoom) || 1));
      const panX = Number(view.panX) || 0;
      const panY = Number(view.panY) || 0;
      const sx = evt.clientX - rect.left;
      const sy = evt.clientY - rect.top;

      const factor = Math.exp(-(evt.deltaY || 0) * 0.001);
      const nextZoom = Math.max(0.25, Math.min(6, prevZoom * factor));
      if (!Number.isFinite(nextZoom) || nextZoom === prevZoom) return;

      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const paperX = (sx - cx - panX) / prevZoom + cx;
      const paperY = (sy - cy - panY) / prevZoom + cy;
      view.zoom = nextZoom;
      view.panX = sx - cx - (paperX - cx) * nextZoom;
      view.panY = sy - cy - (paperY - cy) * nextZoom;
      setViewZoom(nextZoom);
      redraw();
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel as any);
  }, [redraw]);

  const setZoomAnchored = React.useCallback(
    (nextZoom: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const view = viewRef.current;
      const prevZoom = Math.max(0.25, Math.min(6, Number(view.zoom) || 1));
      const clamped = Math.max(0.25, Math.min(6, nextZoom));
      const panX = Number(view.panX) || 0;
      const panY = Number(view.panY) || 0;
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const sx = cx;
      const sy = cy;
      const paperX = (sx - cx - panX) / prevZoom + cx;
      const paperY = (sy - cy - panY) / prevZoom + cy;
      view.zoom = clamped;
      view.panX = sx - cx - (paperX - cx) * clamped;
      view.panY = sy - cy - (paperY - cy) * clamped;
      setViewZoom(clamped);
      redraw();
    },
    [redraw],
  );

  const resetView = React.useCallback(() => {
    viewRef.current.zoom = 1;
    viewRef.current.panX = 0;
    viewRef.current.panY = 0;
    setViewZoom(1);
    redraw();
  }, [redraw]);

  const toggleGrid = React.useCallback(() => {
    setShowGrid((v) => {
      const next = !v;
      gridRef.current = next;
      redraw();
      return next;
    });
  }, [redraw]);

  const toggleSnap = React.useCallback(() => {
    setSnapToGrid((v) => {
      const next = !v;
      snapRef.current = next;
      return next;
    });
  }, []);

  const toggleSnapGuides = React.useCallback(() => {
    setSnapGuides((v) => {
      const next = !v;
      snapGuidesRef.current = next;
      return next;
    });
  }, []);

  const toggleSnapObjects = React.useCallback(() => {
    setSnapObjects((v) => {
      const next = !v;
      snapObjectsRef.current = next;
      return next;
    });
  }, []);

  const buildSelectionUnitsForArrange = React.useCallback((state: MoodboardState, selList: Selection) => {
    const shapes = Array.isArray(state.shapes) ? state.shapes : [];
    const connectors = Array.isArray(state.connectors) ? state.connectors : [];
    const images = Array.isArray(state.images) ? state.images : [];
    const texts = Array.isArray(state.texts) ? state.texts : [];
    const shapeById = new Map(shapes.map((s) => [s.id, s]));
    const connectorById = new Map(connectors.map((c) => [c.id, c]));
    const imageById = new Map(images.map((img) => [img.id, img]));
    const textById = new Map(texts.map((t) => [t.id, t]));
    const folderFlags = computeEffectiveFolderFlags(Array.isArray(state.folders) ? state.folders : []);
    const isHiddenItem = (it: any): boolean => isItemEffectivelyHidden(it, folderFlags);

    const membersForGroup = (gid: string): Selection => {
      const out: Selection = [];
      for (const c of connectors) {
        if (!c || isHiddenItem(c)) continue;
        if (String((c as any).groupId ?? '') === gid) out.push({ kind: 'connector', id: c.id });
      }
      for (const s of shapes) {
        if (!s || isHiddenItem(s)) continue;
        if (String((s as any).groupId ?? '') === gid) out.push({ kind: 'shape', id: s.id });
      }
      for (const t of texts) {
        if (!t || isHiddenItem(t)) continue;
        if (String((t as any).groupId ?? '') === gid) out.push({ kind: 'text', id: t.id });
      }
      for (const img of images) {
        if (!img || isHiddenItem(img)) continue;
        if (String((img as any).groupId ?? '') === gid) out.push({ kind: 'image', id: img.id });
      }
      return out;
    };

    const groupIds = new Set<string>();
    for (const s of selList) {
      const it =
        s.kind === 'image'
          ? imageById.get(s.id)
          : s.kind === 'text'
            ? textById.get(s.id)
            : s.kind === 'connector'
              ? connectorById.get(s.id)
              : shapeById.get(s.id);
      const gid = String((it as any)?.groupId ?? '').trim();
      if (gid) groupIds.add(gid);
    }

    const units: Array<{
      kind: 'group' | 'item';
      key: string;
      groupId?: string;
      members: Selection;
      bounds: { left: number; top: number; right: number; bottom: number; cx: number; cy: number; w: number; h: number };
    }> = [];

    for (const gid of groupIds) {
      const members = membersForGroup(gid);
      if (!members.length) continue;
      let left = Infinity;
      let top = Infinity;
      let right = -Infinity;
      let bottom = -Infinity;
      for (const m of members) {
        if (m.kind === 'connector') {
          const it = connectorById.get(m.id);
          if (!it || isHiddenItem(it)) continue;
          const ax = Number((it as any).ax) || 0;
          const ay = Number((it as any).ay) || 0;
          const bx = Number((it as any).bx) || 0;
          const by = Number((it as any).by) || 0;
          left = Math.min(left, Math.min(ax, bx));
          top = Math.min(top, Math.min(ay, by));
          right = Math.max(right, Math.max(ax, bx));
          bottom = Math.max(bottom, Math.max(ay, by));
          continue;
        }
        const it = m.kind === 'image' ? imageById.get(m.id) : m.kind === 'text' ? textById.get(m.id) : shapeById.get(m.id);
        if (!it || isHiddenItem(it)) continue;
        const cx = Number((it as any).x) || 0;
        const cy = Number((it as any).y) || 0;
        const w = Number((it as any).w) || 0;
        const h = Number((it as any).h) || 0;
        left = Math.min(left, cx - w / 2);
        top = Math.min(top, cy - h / 2);
        right = Math.max(right, cx + w / 2);
        bottom = Math.max(bottom, cy + h / 2);
      }
      const w = right - left;
      const h = bottom - top;
      units.push({ kind: 'group', key: `g:${gid}`, groupId: gid, members, bounds: { left, top, right, bottom, cx: left + w / 2, cy: top + h / 2, w, h } });
    }

    for (const s of selList) {
      const it =
        s.kind === 'image'
          ? imageById.get(s.id)
          : s.kind === 'text'
            ? textById.get(s.id)
            : s.kind === 'connector'
              ? connectorById.get(s.id)
              : shapeById.get(s.id);
      if (!it || isHiddenItem(it)) continue;
      const gid = String((it as any).groupId ?? '').trim();
      if (gid && groupIds.has(gid)) continue;
      let cx = 0;
      let cy = 0;
      let w = 0;
      let h = 0;
      if (s.kind === 'connector') {
        const ax = Number((it as any).ax) || 0;
        const ay = Number((it as any).ay) || 0;
        const bx = Number((it as any).bx) || 0;
        const by = Number((it as any).by) || 0;
        const left = Math.min(ax, bx);
        const right = Math.max(ax, bx);
        const top = Math.min(ay, by);
        const bottom = Math.max(ay, by);
        w = right - left;
        h = bottom - top;
        cx = left + w / 2;
        cy = top + h / 2;
      } else {
        cx = Number((it as any).x) || 0;
        cy = Number((it as any).y) || 0;
        w = Number((it as any).w) || 0;
        h = Number((it as any).h) || 0;
      }
      units.push({ kind: 'item', key: `${s.kind}:${s.id}`, members: [s], bounds: { left: cx - w / 2, top: cy - h / 2, right: cx + w / 2, bottom: cy + h / 2, cx, cy, w, h } });
    }

    return units;
  }, []);

  const translateSelectionUnits = React.useCallback(
    (mode: 'align-left' | 'align-center' | 'align-right' | 'align-top' | 'align-middle' | 'align-bottom' | 'dist-h' | 'dist-v' | 'tidy') => {
      const curSel = Array.isArray(selectionRef.current) ? selectionRef.current : [];
      if (curSel.length < 2 && mode !== 'tidy') return;
      const cur = valueRef.current;
      const folderFlags = computeEffectiveFolderFlags(Array.isArray(cur.folders) ? cur.folders : []);
      const isHiddenItem = (it: any): boolean => isItemEffectivelyHidden(it, folderFlags);
      const isLockedItem = (it: any): boolean => isItemEffectivelyLocked(it, folderFlags);
      const units = buildSelectionUnitsForArrange(cur, curSel);
      if (units.length < 2 && mode !== 'tidy') return;

      const updates = new Map<
        string,
        | { kind: 'pos'; x: number; y: number }
        | { kind: 'connector'; ax: number; ay: number; bx: number; by: number }
      >();
      const getItem = (s: SelectedItem) =>
        s.kind === 'image'
          ? (cur.images || []).find((x) => x && x.id === s.id)
          : s.kind === 'text'
            ? (cur.texts || []).find((x) => x && x.id === s.id)
            : s.kind === 'connector'
              ? (Array.isArray(cur.connectors) ? cur.connectors : []).find((x) => x && x.id === s.id)
              : (Array.isArray(cur.shapes) ? cur.shapes : []).find((x) => x && x.id === s.id);

      const applyTranslate = (unit: (typeof units)[number], dx: number, dy: number) => {
        const clampedDx = Math.max(-unit.bounds.left, Math.min(1 - unit.bounds.right, dx));
        const clampedDy = Math.max(-unit.bounds.top, Math.min(1 - unit.bounds.bottom, dy));
        for (const m of unit.members) {
          const it: any = getItem(m);
          if (!it || isHiddenItem(it) || isLockedItem(it)) continue;
          if (m.kind === 'connector') {
            const ax = clamp01((Number(it.ax) || 0) + clampedDx);
            const ay = clamp01((Number(it.ay) || 0) + clampedDy);
            const bx = clamp01((Number(it.bx) || 0) + clampedDx);
            const by = clamp01((Number(it.by) || 0) + clampedDy);
            updates.set(`${m.kind}:${m.id}`, { kind: 'connector', ax, ay, bx, by });
            continue;
          }
          updates.set(`${m.kind}:${m.id}`, { kind: 'pos', x: clamp01((Number(it.x) || 0) + clampedDx), y: clamp01((Number(it.y) || 0) + clampedDy) });
        }
      };

      if (mode === 'align-left' || mode === 'align-center' || mode === 'align-right') {
        const leftAll = Math.min(...units.map((u) => u.bounds.left));
        const rightAll = Math.max(...units.map((u) => u.bounds.right));
        const centerAll = leftAll + (rightAll - leftAll) / 2;
        for (const u of units) {
          const dx = mode === 'align-left' ? leftAll - u.bounds.left : mode === 'align-right' ? rightAll - u.bounds.right : centerAll - u.bounds.cx;
          applyTranslate(u, dx, 0);
        }
      } else if (mode === 'align-top' || mode === 'align-middle' || mode === 'align-bottom') {
        const topAll = Math.min(...units.map((u) => u.bounds.top));
        const bottomAll = Math.max(...units.map((u) => u.bounds.bottom));
        const midAll = topAll + (bottomAll - topAll) / 2;
        for (const u of units) {
          const dy = mode === 'align-top' ? topAll - u.bounds.top : mode === 'align-bottom' ? bottomAll - u.bounds.bottom : midAll - u.bounds.cy;
          applyTranslate(u, 0, dy);
        }
      } else if (mode === 'dist-h') {
        if (units.length < 3) return;
        const sorted = units.slice().sort((a, b) => a.bounds.cx - b.bounds.cx);
        const left = sorted[0].bounds.cx;
        const right = sorted[sorted.length - 1].bounds.cx;
        const step = (right - left) / (sorted.length - 1);
        for (let i = 0; i < sorted.length; i++) {
          const desired = left + step * i;
          applyTranslate(sorted[i], desired - sorted[i].bounds.cx, 0);
        }
      } else if (mode === 'dist-v') {
        if (units.length < 3) return;
        const sorted = units.slice().sort((a, b) => a.bounds.cy - b.bounds.cy);
        const top = sorted[0].bounds.cy;
        const bottom = sorted[sorted.length - 1].bounds.cy;
        const step = (bottom - top) / (sorted.length - 1);
        for (let i = 0; i < sorted.length; i++) {
          const desired = top + step * i;
          applyTranslate(sorted[i], 0, desired - sorted[i].bounds.cy);
        }
      } else if (mode === 'tidy') {
        if (!units.length) return;
        const leftAll = Math.min(...units.map((u) => u.bounds.left));
        const topAll = Math.min(...units.map((u) => u.bounds.top));
        const maxW = Math.max(...units.map((u) => u.bounds.w));
        const maxH = Math.max(...units.map((u) => u.bounds.h));
        const gap = 0.02;
        const cols = Math.max(1, Math.ceil(Math.sqrt(units.length)));
        const sorted = units.slice().sort((a, b) => a.bounds.top - b.bounds.top || a.bounds.left - b.bounds.left || a.key.localeCompare(b.key));
        for (let i = 0; i < sorted.length; i++) {
          const row = Math.floor(i / cols);
          const col = i % cols;
          const desiredCx = leftAll + col * (maxW + gap) + maxW / 2;
          const desiredCy = topAll + row * (maxH + gap) + maxH / 2;
          applyTranslate(sorted[i], desiredCx - sorted[i].bounds.cx, desiredCy - sorted[i].bounds.cy);
        }
      }

      if (!updates.size) return;
      const shapes = Array.isArray(cur.shapes) ? cur.shapes : [];
      const nextShapes = shapes.map((s) => {
        const u = updates.get(`shape:${s.id}`);
        return u && u.kind === 'pos' ? { ...s, x: u.x, y: u.y } : s;
      });
      const nextImages = (cur.images || []).map((img) => {
        const u = updates.get(`image:${img.id}`);
        return u && u.kind === 'pos' ? { ...img, x: u.x, y: u.y } : img;
      });
      const nextTexts = (cur.texts || []).map((t) => {
        const u = updates.get(`text:${t.id}`);
        return u && u.kind === 'pos' ? { ...t, x: u.x, y: u.y } : t;
      });
      const connectors = Array.isArray(cur.connectors) ? cur.connectors : [];
      const nextConnectors = connectors.map((c) => {
        const u = updates.get(`connector:${c.id}`);
        return u && u.kind === 'connector' ? { ...c, ax: u.ax, ay: u.ay, bx: u.bx, by: u.by } : c;
      });
      const next: MoodboardState = { ...cur, images: nextImages, texts: nextTexts };
      if (shapes.length || cur.shapes) next.shapes = nextShapes;
      if (connectors.length || cur.connectors) next.connectors = nextConnectors;
      commit(next);
    },
    [buildSelectionUnitsForArrange, commit]
  );

  const groupSelection = React.useCallback(() => {
    const curSel = Array.isArray(selectionRef.current) ? selectionRef.current : [];
    if (curSel.length < 2) return;
    const gid = makeMoodId('mbg_');
    const cur = valueRef.current;
    const keys = new Set(curSel.map((s) => `${s.kind}:${s.id}`));
    const shapes = Array.isArray(cur.shapes) ? cur.shapes : [];
    const connectors = Array.isArray(cur.connectors) ? cur.connectors : [];
    const nextShapes = shapes.map((s) => (keys.has(`shape:${s.id}`) ? { ...s, groupId: gid } : s));
    const nextConnectors = connectors.map((c) => (keys.has(`connector:${c.id}`) ? { ...c, groupId: gid } : c));
    const nextImages = (cur.images || []).map((img) => (keys.has(`image:${img.id}`) ? { ...img, groupId: gid } : img));
    const nextTexts = (cur.texts || []).map((t) => (keys.has(`text:${t.id}`) ? { ...t, groupId: gid } : t));
    const next: MoodboardState = { ...cur, images: nextImages, texts: nextTexts };
    if (shapes.length || cur.shapes) next.shapes = nextShapes;
    if (connectors.length || cur.connectors) next.connectors = nextConnectors;
    commit(next);
  }, [commit]);

  const ungroupSelection = React.useCallback(() => {
    const curSel = Array.isArray(selectionRef.current) ? selectionRef.current : [];
    if (!curSel.length) return;
    const cur = valueRef.current;
    const shapes = Array.isArray(cur.shapes) ? cur.shapes : [];
    const connectors = Array.isArray(cur.connectors) ? cur.connectors : [];
    const images = Array.isArray(cur.images) ? cur.images : [];
    const texts = Array.isArray(cur.texts) ? cur.texts : [];
    const shapeById = new Map(shapes.map((s) => [s.id, s]));
    const connectorById = new Map(connectors.map((c) => [c.id, c]));
    const imageById = new Map(images.map((img) => [img.id, img]));
    const textById = new Map(texts.map((t) => [t.id, t]));
    const groupIds = new Set<string>();
    for (const s of curSel) {
      const it =
        s.kind === 'image'
          ? imageById.get(s.id)
          : s.kind === 'text'
            ? textById.get(s.id)
            : s.kind === 'connector'
              ? connectorById.get(s.id)
              : shapeById.get(s.id);
      const gid = String((it as any)?.groupId ?? '').trim();
      if (gid) groupIds.add(gid);
    }
    if (!groupIds.size) return;
    const nextShapes = shapes.map((s) => (s && groupIds.has(String((s as any).groupId ?? '')) ? { ...s, groupId: undefined } : s));
    const nextConnectors = connectors.map((c) => (c && groupIds.has(String((c as any).groupId ?? '')) ? { ...c, groupId: undefined } : c));
    const nextImages = images.map((img) => (img && groupIds.has(String((img as any).groupId ?? '')) ? { ...img, groupId: undefined } : img));
    const nextTexts = texts.map((t) => (t && groupIds.has(String((t as any).groupId ?? '')) ? { ...t, groupId: undefined } : t));
    const next: MoodboardState = { ...cur, images: nextImages, texts: nextTexts };
    if (shapes.length || cur.shapes) next.shapes = nextShapes;
    if (connectors.length || cur.connectors) next.connectors = nextConnectors;
    commit(next);
  }, [commit]);

  const applyMaskFromSelection = React.useCallback(() => {
    const curSel = Array.isArray(selectionRef.current) ? selectionRef.current : [];
    const imgSel = curSel.filter((s) => s.kind === 'image');
    const shapeSel = curSel.filter((s) => s.kind === 'shape');
    if (imgSel.length !== 1 || shapeSel.length !== 1) return;
    const cur = valueRef.current;
    const images = Array.isArray(cur.images) ? cur.images : [];
    const nextImages = images.map((img) => (img && img.id === imgSel[0].id ? { ...img, mask: { shapeId: shapeSel[0].id } } : img));
    const next: MoodboardState = { ...cur, images: nextImages };
    commit(next);
    selectionRef.current = [{ kind: 'image', id: imgSel[0].id }];
    setSelection([{ kind: 'image', id: imgSel[0].id }]);
  }, [commit]);

  const removeMaskFromSelection = React.useCallback(() => {
    const curSel = Array.isArray(selectionRef.current) ? selectionRef.current : [];
    const imgSel = curSel.filter((s) => s.kind === 'image');
    if (imgSel.length !== 1) return;
    const cur = valueRef.current;
    const images = Array.isArray(cur.images) ? cur.images : [];
    const nextImages = images.map((img) => (img && img.id === imgSel[0].id ? { ...img, mask: undefined } : img));
    const next: MoodboardState = { ...cur, images: nextImages };
    commit(next);
  }, [commit]);

  const buildClipboardPayload = React.useCallback((state: MoodboardState, selList: Selection): ClipboardPayload | null => {
    const shapes = Array.isArray(state.shapes) ? state.shapes : [];
    const connectors = Array.isArray(state.connectors) ? state.connectors : [];
    const images = Array.isArray(state.images) ? state.images : [];
    const texts = Array.isArray(state.texts) ? state.texts : [];
    const folderFlags = computeEffectiveFolderFlags(Array.isArray(state.folders) ? state.folders : []);
    const isHiddenItem = (it: any): boolean => isItemEffectivelyHidden(it, folderFlags);

    const shapeIndexById = new Map(shapes.map((s, i) => [s.id, i]));
    const connectorIndexById = new Map(connectors.map((c, i) => [c.id, i]));
    const imageIndexById = new Map(images.map((img, i) => [img.id, i]));
    const textIndexById = new Map(texts.map((t, i) => [t.id, i]));

    const shapeById = new Map(shapes.map((s) => [s.id, s]));
    const connectorById = new Map(connectors.map((c) => [c.id, c]));
    const imageById = new Map(images.map((img) => [img.id, img]));
    const textById = new Map(texts.map((t) => [t.id, t]));

    const groupIds = new Set<string>();
    for (const s of selList) {
      const it =
        s.kind === 'image'
          ? imageById.get(s.id)
          : s.kind === 'text'
            ? textById.get(s.id)
            : s.kind === 'connector'
              ? connectorById.get(s.id)
              : shapeById.get(s.id);
      const gid = String((it as any)?.groupId ?? '').trim();
      if (gid) groupIds.add(gid);
    }

    const expanded = new Map<string, SelectedItem>();
    for (const s of selList) expanded.set(`${s.kind}:${s.id}`, s);
    if (groupIds.size) {
      for (const s of shapes) {
        if (!s || isHiddenItem(s)) continue;
        if (groupIds.has(String((s as any).groupId ?? '').trim())) expanded.set(`shape:${s.id}`, { kind: 'shape', id: s.id });
      }
      for (const c of connectors) {
        if (!c || isHiddenItem(c)) continue;
        if (groupIds.has(String((c as any).groupId ?? '').trim())) expanded.set(`connector:${c.id}`, { kind: 'connector', id: c.id });
      }
      for (const img of images) {
        if (!img || isHiddenItem(img)) continue;
        if (groupIds.has(String((img as any).groupId ?? '').trim())) expanded.set(`image:${img.id}`, { kind: 'image', id: img.id });
      }
      for (const t of texts) {
        if (!t || isHiddenItem(t)) continue;
        if (groupIds.has(String((t as any).groupId ?? '').trim())) expanded.set(`text:${t.id}`, { kind: 'text', id: t.id });
      }
    }

    const items: ClipboardItem[] = [];
    for (const s of expanded.values()) {
      if (s.kind === 'shape') {
        const it = shapeById.get(s.id);
        if (!it || isHiddenItem(it)) continue;
        const idx = shapeIndexById.get(it.id) ?? 0;
        items.push({ kind: 'shape', item: { ...it }, z: zFor('shape', idx, (it as any).z) });
      } else if (s.kind === 'connector') {
        const it = connectorById.get(s.id);
        if (!it || isHiddenItem(it)) continue;
        const idx = connectorIndexById.get(it.id) ?? 0;
        items.push({ kind: 'connector', item: { ...it }, z: zFor('connector', idx, (it as any).z) });
      } else if (s.kind === 'image') {
        const it = imageById.get(s.id);
        if (!it || isHiddenItem(it)) continue;
        const idx = imageIndexById.get(it.id) ?? 0;
        items.push({ kind: 'image', item: { ...it }, z: zFor('image', idx, (it as any).z) });
      } else {
        const it = textById.get(s.id);
        if (!it || isHiddenItem(it)) continue;
        const idx = textIndexById.get(it.id) ?? 0;
        items.push({ kind: 'text', item: { ...it }, z: zFor('text', idx, (it as any).z) });
      }
    }
    if (!items.length) return null;

    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (const it of items) {
      if (it.kind === 'connector') {
        const ax = Number(it.item.ax) || 0;
        const ay = Number(it.item.ay) || 0;
        const bx = Number(it.item.bx) || 0;
        const by = Number(it.item.by) || 0;
        left = Math.min(left, Math.min(ax, bx));
        top = Math.min(top, Math.min(ay, by));
        right = Math.max(right, Math.max(ax, bx));
        bottom = Math.max(bottom, Math.max(ay, by));
        continue;
      }
      const cx = Number((it.item as any).x) || 0;
      const cy = Number((it.item as any).y) || 0;
      const w = Number((it.item as any).w) || 0;
      const h = Number((it.item as any).h) || 0;
      left = Math.min(left, cx - w / 2);
      top = Math.min(top, cy - h / 2);
      right = Math.max(right, cx + w / 2);
      bottom = Math.max(bottom, cy + h / 2);
    }
    if (!Number.isFinite(left) || !Number.isFinite(top) || !Number.isFinite(right) || !Number.isFinite(bottom)) return null;
    const w = right - left;
    const h = bottom - top;
    return { items, bounds: { left, top, right, bottom, cx: left + w / 2, cy: top + h / 2 } };
  }, []);

  const pastePayload = React.useCallback(
    (payload: ClipboardPayload, opts?: { bumpSerial?: boolean }) => {
      if (!payload.items.length) return;
      const cur = valueRef.current;
      const shapes = Array.isArray(cur.shapes) ? cur.shapes : [];
      const connectors = Array.isArray(cur.connectors) ? cur.connectors : [];
      const images = Array.isArray(cur.images) ? cur.images : [];
      const texts = Array.isArray(cur.texts) ? cur.texts : [];

      const basePx = 20;
      const canvas = canvasRef.current;
      const rect = canvas ? canvas.getBoundingClientRect() : null;
      let mult = 1;
      if (opts?.bumpSerial) {
        pasteSerialRef.current += 1;
        mult = pasteSerialRef.current;
      }
      const dx = rect && rect.width > 0 ? (basePx * mult) / rect.width : 0.02 * mult;
      const dy = rect && rect.height > 0 ? (basePx * mult) / rect.height : 0.02 * mult;

      const maxZ = Math.max(
        0,
        ...shapes.map((s, i) => zFor('shape', i, (s as any).z)),
        ...connectors.map((c, i) => zFor('connector', i, (c as any).z)),
        ...images.map((img, i) => zFor('image', i, (img as any).z)),
        ...texts.map((t, i) => zFor('text', i, (t as any).z))
      );

      const groupIdMap = new Map<string, string>();
      const shapeIdMap = new Map<string, string>();
      for (const it of payload.items) {
        const gid = String((it.item as any)?.groupId ?? '').trim();
        if (gid && !groupIdMap.has(gid)) groupIdMap.set(gid, makeMoodId('mbg_'));
        if (it.kind === 'shape') shapeIdMap.set(it.item.id, makeMoodId('mbs_'));
      }

      const sorted = payload.items.slice().sort((a, b) => a.z - b.z);
      const newSel: Selection = [];
      const addShapes: MoodboardShape[] = [];
      const addConnectors: MoodboardConnector[] = [];
      const addImages: MoodboardImage[] = [];
      const addTexts: MoodboardText[] = [];

      let z = maxZ + 1;
      for (const it of sorted) {
        const gid = String((it.item as any)?.groupId ?? '').trim();
        const nextGroupId = gid ? groupIdMap.get(gid) : undefined;

        if (it.kind === 'shape') {
          const nextId = shapeIdMap.get(it.item.id) || makeMoodId('mbs_');
          addShapes.push({
            ...it.item,
            id: nextId,
            x: clamp01((Number(it.item.x) || 0) + dx),
            y: clamp01((Number(it.item.y) || 0) + dy),
            z: z++,
            groupId: nextGroupId,
          });
          newSel.push({ kind: 'shape', id: nextId });
          continue;
        }

        if (it.kind === 'connector') {
          const nextId = makeMoodId('mbc_');
          addConnectors.push({
            ...it.item,
            id: nextId,
            ax: clamp01((Number(it.item.ax) || 0) + dx),
            ay: clamp01((Number(it.item.ay) || 0) + dy),
            bx: clamp01((Number(it.item.bx) || 0) + dx),
            by: clamp01((Number(it.item.by) || 0) + dy),
            z: z++,
            groupId: nextGroupId,
          });
          newSel.push({ kind: 'connector', id: nextId });
          continue;
        }

        if (it.kind === 'image') {
          const nextId = makeMoodId('mbi_');
          const maskShapeId = String((it.item as any)?.mask?.shapeId ?? '').trim();
          const nextMaskShapeId = maskShapeId && shapeIdMap.has(maskShapeId) ? shapeIdMap.get(maskShapeId) : maskShapeId || undefined;
          addImages.push({
            ...it.item,
            id: nextId,
            x: clamp01((Number(it.item.x) || 0) + dx),
            y: clamp01((Number(it.item.y) || 0) + dy),
            z: z++,
            groupId: nextGroupId,
            mask: nextMaskShapeId ? { shapeId: String(nextMaskShapeId) } : undefined,
          });
          newSel.push({ kind: 'image', id: nextId });
          continue;
        }

        const nextId = makeMoodId('mbt_');
        addTexts.push({
          ...it.item,
          id: nextId,
          x: clamp01((Number(it.item.x) || 0) + dx),
          y: clamp01((Number(it.item.y) || 0) + dy),
          z: z++,
          groupId: nextGroupId,
        });
        newSel.push({ kind: 'text', id: nextId });
      }

      const nextShapes = [...shapes, ...addShapes];
      const nextConnectors = [...connectors, ...addConnectors];
      const nextImages = [...images, ...addImages];
      const nextTexts = [...texts, ...addTexts];

      const next: MoodboardState = { ...cur, images: nextImages, texts: nextTexts };
      if (nextShapes.length || cur.shapes) next.shapes = nextShapes;
      if (nextConnectors.length || cur.connectors) next.connectors = nextConnectors;
      if (nextTexts.length || cur.texts) next.texts = nextTexts;
      commit(next);

      selectionRef.current = newSel;
      setSelection(newSel);
    },
    [commit]
  );

  const copySelection = React.useCallback(() => {
    const curSel = Array.isArray(selectionRef.current) ? selectionRef.current : [];
    if (!curSel.length) return;
    const payload = buildClipboardPayload(valueRef.current, curSel);
    if (!payload) return;
    clipboardRef.current = payload;
    pasteSerialRef.current = 0;
  }, [buildClipboardPayload]);

  const pasteClipboard = React.useCallback(() => {
    const payload = clipboardRef.current;
    if (!payload) return;
    pastePayload(payload, { bumpSerial: true });
  }, [pastePayload]);

  const duplicateSelection = React.useCallback(() => {
    const curSel = Array.isArray(selectionRef.current) ? selectionRef.current : [];
    if (!curSel.length) return;
    const payload = buildClipboardPayload(valueRef.current, curSel);
    if (!payload) return;
    pastePayload(payload);
  }, [buildClipboardPayload, pastePayload]);

  const deleteSelection = React.useCallback(() => {
    const sel = Array.isArray(selectionRef.current) ? selectionRef.current : [];
    if (!sel.length) return;
    const cur = valueRef.current;
    const keys = new Set(sel.map((s) => `${s.kind}:${s.id}`));
    const deletedShapeIds = new Set(sel.filter((s) => s.kind === 'shape').map((s) => s.id));
    const shapes = Array.isArray(cur.shapes) ? cur.shapes : [];
    const connectors = Array.isArray(cur.connectors) ? cur.connectors : [];
    const nextShapes = shapes.filter((s) => s && !keys.has(`shape:${s.id}`));
    const nextConnectors = connectors.filter((c) => c && !keys.has(`connector:${c.id}`));
    const nextImagesRaw = (cur.images || []).filter((img) => img && !keys.has(`image:${img.id}`));
    const nextImages = nextImagesRaw.map((img) => {
      const maskShapeId = String((img as any)?.mask?.shapeId ?? '').trim();
      return maskShapeId && deletedShapeIds.has(maskShapeId) ? { ...img, mask: undefined } : img;
    });
    const nextTexts = (cur.texts || []).filter((t) => t && !keys.has(`text:${t.id}`));
    const next: MoodboardState = { ...cur, images: nextImages, texts: nextTexts };
    if (nextShapes.length || cur.shapes) next.shapes = nextShapes;
    if (nextConnectors.length || cur.connectors) next.connectors = nextConnectors;
    if (nextTexts.length || cur.texts) next.texts = nextTexts;
    commit(next);
    selectionRef.current = [];
    setSelection([]);
  }, [commit]);

  const nudgeSelection = React.useCallback(
    (dirX: number, dirY: number, big: boolean) => {
      const curSel = Array.isArray(selectionRef.current) ? selectionRef.current : [];
      if (!curSel.length) return;
      const cur = valueRef.current;
      const units = buildSelectionUnitsForArrange(cur, curSel);
      if (!units.length) return;

      const canvas = canvasRef.current;
      const rect = canvas ? canvas.getBoundingClientRect() : null;
      if (!rect || rect.width <= 0 || rect.height <= 0) return;

      const stepX = 40 / rect.width;
      const stepY = 40 / rect.height;
      const pxStep = big ? 20 : 5;
      const dx = snapRef.current ? (dirX * stepX * (big ? 2 : 1)) : (dirX * pxStep) / rect.width;
      const dy = snapRef.current ? (dirY * stepY * (big ? 2 : 1)) : (dirY * pxStep) / rect.height;
      if (!dx && !dy) return;

      const updates = new Map<
        string,
        | { kind: 'pos'; x: number; y: number }
        | { kind: 'connector'; ax: number; ay: number; bx: number; by: number }
      >();

      const shapes = Array.isArray(cur.shapes) ? cur.shapes : [];
      const connectors = Array.isArray(cur.connectors) ? cur.connectors : [];
      const images = Array.isArray(cur.images) ? cur.images : [];
      const texts = Array.isArray(cur.texts) ? cur.texts : [];
      const folderFlags = computeEffectiveFolderFlags(Array.isArray(cur.folders) ? cur.folders : []);
      const shapeById = new Map(shapes.map((s) => [s.id, s]));
      const connectorById = new Map(connectors.map((c) => [c.id, c]));
      const imageById = new Map(images.map((img) => [img.id, img]));
      const textById = new Map(texts.map((t) => [t.id, t]));

      for (const u of units) {
        const clampedDx = Math.max(-u.bounds.left, Math.min(1 - u.bounds.right, dx));
        const clampedDy = Math.max(-u.bounds.top, Math.min(1 - u.bounds.bottom, dy));
        for (const m of u.members) {
          const it =
            m.kind === 'image'
              ? imageById.get(m.id)
              : m.kind === 'text'
                ? textById.get(m.id)
                : m.kind === 'connector'
                  ? connectorById.get(m.id)
                  : shapeById.get(m.id);
          if (!it || isItemEffectivelyHidden(it, folderFlags) || isItemEffectivelyLocked(it, folderFlags)) continue;

          if (m.kind === 'connector') {
            let ax = clamp01((Number((it as any).ax) || 0) + clampedDx);
            let ay = clamp01((Number((it as any).ay) || 0) + clampedDy);
            let bx = clamp01((Number((it as any).bx) || 0) + clampedDx);
            let by = clamp01((Number((it as any).by) || 0) + clampedDy);
            if (snapRef.current) {
              if (stepX > 0) {
                ax = clamp01(Math.round(ax / stepX) * stepX);
                bx = clamp01(Math.round(bx / stepX) * stepX);
              }
              if (stepY > 0) {
                ay = clamp01(Math.round(ay / stepY) * stepY);
                by = clamp01(Math.round(by / stepY) * stepY);
              }
            }
            updates.set(`connector:${m.id}`, { kind: 'connector', ax, ay, bx, by });
            continue;
          }

          let x = clamp01((Number((it as any).x) || 0) + clampedDx);
          let y = clamp01((Number((it as any).y) || 0) + clampedDy);
          if (snapRef.current) {
            if (stepX > 0) x = clamp01(Math.round(x / stepX) * stepX);
            if (stepY > 0) y = clamp01(Math.round(y / stepY) * stepY);
          }
          updates.set(`${m.kind}:${m.id}`, { kind: 'pos', x, y });
        }
      }

      if (!updates.size) return;
      const nextShapes = shapes.map((s) => {
        const u = updates.get(`shape:${s.id}`);
        return u && u.kind === 'pos' ? { ...s, x: u.x, y: u.y } : s;
      });
      const nextConnectors = connectors.map((c) => {
        const u = updates.get(`connector:${c.id}`);
        return u && u.kind === 'connector' ? { ...c, ax: u.ax, ay: u.ay, bx: u.bx, by: u.by } : c;
      });
      const nextImages = images.map((img) => {
        const u = updates.get(`image:${img.id}`);
        return u && u.kind === 'pos' ? { ...img, x: u.x, y: u.y } : img;
      });
      const nextTexts = texts.map((t) => {
        const u = updates.get(`text:${t.id}`);
        return u && u.kind === 'pos' ? { ...t, x: u.x, y: u.y } : t;
      });

      const next: MoodboardState = { ...cur, images: nextImages, texts: nextTexts };
      if (nextShapes.length || cur.shapes) next.shapes = nextShapes;
      if (nextConnectors.length || cur.connectors) next.connectors = nextConnectors;
      if (nextTexts.length || cur.texts) next.texts = nextTexts;
      commit(next);
    },
    [buildSelectionUnitsForArrange, commit]
  );

  React.useEffect(() => {
    const isTypingTarget = (target: EventTarget | null): boolean => {
      const el = target as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || (el as any).isContentEditable;
    };

    const onKeyDown = (evt: KeyboardEvent) => {
      if (!(evt.ctrlKey || evt.metaKey)) return;
      if (evt.altKey) return;
      if (isTypingTarget(evt.target)) return;
      const k = String(evt.key || '').toLowerCase();
      if (k === 'c') {
        evt.preventDefault();
        copySelection();
      } else if (k === 'v') {
        evt.preventDefault();
        pasteClipboard();
      } else if (k === 'd') {
        evt.preventDefault();
        duplicateSelection();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [copySelection, pasteClipboard, duplicateSelection]);

  React.useEffect(() => {
    const isTypingTarget = (target: EventTarget | null): boolean => {
      const el = target as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || (el as any).isContentEditable;
    };

    const onKeyDown = (evt: KeyboardEvent) => {
      if (isTypingTarget(evt.target)) return;
      if (evt.ctrlKey || evt.metaKey || evt.altKey) return;
      const k = String(evt.key || '');
      if (k === 'ArrowLeft') {
        evt.preventDefault();
        nudgeSelection(-1, 0, evt.shiftKey);
      } else if (k === 'ArrowRight') {
        evt.preventDefault();
        nudgeSelection(1, 0, evt.shiftKey);
      } else if (k === 'ArrowUp') {
        evt.preventDefault();
        nudgeSelection(0, -1, evt.shiftKey);
      } else if (k === 'ArrowDown') {
        evt.preventDefault();
        nudgeSelection(0, 1, evt.shiftKey);
      } else if (k === 'Delete' || k === 'Backspace') {
        evt.preventDefault();
        deleteSelection();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deleteSelection, nudgeSelection]);

  const arrangeUnits = React.useMemo(() => buildSelectionUnitsForArrange(value, selection), [buildSelectionUnitsForArrange, value, selection]);
  const canArrange = arrangeUnits.length >= 2;
  const canDistribute = arrangeUnits.length >= 3;
  const canGroup = selection.length >= 2;
  const canUngroup = arrangeUnits.some((u) => u.kind === 'group');

  const layerOrderAsc = React.useMemo(() => {
    const shapes = Array.isArray(value.shapes) ? value.shapes : [];
    const connectors = Array.isArray(value.connectors) ? value.connectors : [];
    const images = Array.isArray(value.images) ? value.images : [];
    const texts = Array.isArray(value.texts) ? value.texts : [];
    const refs: Array<{ kind: MoodboardItemKind; id: string; z: number; index: number }> = [];
    for (let i = 0; i < shapes.length; i++) {
      const s = shapes[i];
      if (!s) continue;
      refs.push({ kind: 'shape', id: s.id, z: zFor('shape', i, (s as any).z), index: i });
    }
    for (let i = 0; i < connectors.length; i++) {
      const c = connectors[i];
      if (!c) continue;
      refs.push({ kind: 'connector', id: c.id, z: zFor('connector', i, (c as any).z), index: i });
    }
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      if (!img) continue;
      refs.push({ kind: 'image', id: img.id, z: zFor('image', i, (img as any).z), index: i });
    }
    for (let i = 0; i < texts.length; i++) {
      const t = texts[i];
      if (!t) continue;
      refs.push({ kind: 'text', id: t.id, z: zFor('text', i, (t as any).z), index: i });
    }
    refs.sort(compareZAsc);
    return refs;
  }, [value.images, value.shapes, value.texts, value.connectors]);

  const layerPosByKey = React.useMemo(() => {
    return new Map(layerOrderAsc.map((r, i) => [`${r.kind}:${r.id}`, i]));
  }, [layerOrderAsc]);

  const reorderLayer = React.useCallback(
    (target: SelectedItem, action: 'up' | 'down' | 'top' | 'bottom') => {
      const cur = valueRef.current;
      const shapes = Array.isArray(cur.shapes) ? cur.shapes : [];
      const connectors = Array.isArray(cur.connectors) ? cur.connectors : [];
      const images = Array.isArray(cur.images) ? cur.images : [];
      const texts = Array.isArray(cur.texts) ? cur.texts : [];
      const refs: Array<{ kind: MoodboardItemKind; id: string; z: number; index: number }> = [];
      for (let i = 0; i < shapes.length; i++) {
        const s = shapes[i];
        if (!s) continue;
        refs.push({ kind: 'shape', id: s.id, z: zFor('shape', i, (s as any).z), index: i });
      }
      for (let i = 0; i < connectors.length; i++) {
        const c = connectors[i];
        if (!c) continue;
        refs.push({ kind: 'connector', id: c.id, z: zFor('connector', i, (c as any).z), index: i });
      }
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        if (!img) continue;
        refs.push({ kind: 'image', id: img.id, z: zFor('image', i, (img as any).z), index: i });
      }
      for (let i = 0; i < texts.length; i++) {
        const t = texts[i];
        if (!t) continue;
        refs.push({ kind: 'text', id: t.id, z: zFor('text', i, (t as any).z), index: i });
      }
      refs.sort(compareZAsc);
      const key = `${target.kind}:${target.id}`;
      const idx = refs.findIndex((r) => `${r.kind}:${r.id}` === key);
      if (idx < 0) return;

      let nextIdx = idx;
      if (action === 'up') nextIdx = Math.min(refs.length - 1, idx + 1);
      else if (action === 'down') nextIdx = Math.max(0, idx - 1);
      else if (action === 'top') nextIdx = refs.length - 1;
      else nextIdx = 0;

      if (nextIdx === idx) return;
      const [moved] = refs.splice(idx, 1);
      refs.splice(nextIdx, 0, moved);

      const zByKey = new Map<string, number>();
      for (let i = 0; i < refs.length; i++) zByKey.set(`${refs[i].kind}:${refs[i].id}`, i);

      const nextShapes = shapes.map((s, i) => ({ ...s, z: zByKey.get(`shape:${s.id}`) ?? zFor('shape', i, (s as any).z) }));
      const nextConnectors = connectors.map((c, i) => ({ ...c, z: zByKey.get(`connector:${c.id}`) ?? zFor('connector', i, (c as any).z) }));
      const nextImages = images.map((img, i) => ({ ...img, z: zByKey.get(`image:${img.id}`) ?? zFor('image', i, (img as any).z) }));
      const nextTexts = texts.map((t, i) => ({ ...t, z: zByKey.get(`text:${t.id}`) ?? zFor('text', i, (t as any).z) }));

      const next: MoodboardState = { ...cur, images: nextImages };
      if (shapes.length || cur.shapes) next.shapes = nextShapes;
      if (connectors.length || cur.connectors) next.connectors = nextConnectors;
      if (texts.length || cur.texts) next.texts = nextTexts;
      commit(next);
    },
    [commit]
  );

  const createFolder = React.useCallback(
    (opts?: { parentId?: string }) => {
      const cur = valueRef.current;
      const folders = Array.isArray(cur.folders) ? cur.folders : [];
      const parentIdRaw = typeof opts?.parentId === 'string' ? opts?.parentId.trim() : '';
      const parentId = parentIdRaw && folders.some((f) => f && f.id === parentIdRaw) ? parentIdRaw : undefined;

      const usedNames = new Set(folders.map((f) => String(f?.name || '').trim()).filter(Boolean));
      let name = 'Folder';
      if (usedNames.has(name)) {
        for (let i = 2; i < 10_000; i++) {
          const candidate = `Folder ${i}`;
          if (!usedNames.has(candidate)) {
            name = candidate;
            break;
          }
        }
      }

      const nextFolders = [...folders, { id: makeMoodId('mbf_'), name, parentId } satisfies MoodboardFolder];
      commit({ ...cur, folders: nextFolders });
    },
    [commit]
  );

  const renameFolder = React.useCallback(
    (folderId: string) => {
      const cur = valueRef.current;
      const folders = Array.isArray(cur.folders) ? cur.folders : [];
      const f = folders.find((x) => x && x.id === folderId);
      if (!f) return;
      const nextName = window.prompt('Folder name', String(f.name || '').trim() || 'Folder');
      if (nextName == null) return;
      const name = String(nextName).trim() || 'Folder';
      const nextFolders = folders.map((x) => (x && x.id === folderId ? { ...x, name } : x));
      commit({ ...cur, folders: nextFolders });
    },
    [commit]
  );

  const deleteFolder = React.useCallback(
    (folderId: string) => {
      const cur = valueRef.current;
      const folders = Array.isArray(cur.folders) ? cur.folders : [];
      const f = folders.find((x) => x && x.id === folderId);
      if (!f) return;
      if (!window.confirm(`Delete folder "${String(f.name || 'Folder')}"? Layers will be moved out.`)) return;

      const parentId = typeof f.parentId === 'string' && f.parentId.trim() ? f.parentId.trim() : undefined;
      const nextFolders = folders
        .filter((x) => x && x.id !== folderId)
        .map((x) => (x && String(x.parentId || '').trim() === folderId ? { ...x, parentId } : x));

      const clearFolder = (it: any) => {
        const fid = folderIdOf(it);
        return fid && fid === folderId ? { ...it, folderId: undefined } : it;
      };

      const shapes = Array.isArray(cur.shapes) ? cur.shapes : [];
      const connectors = Array.isArray(cur.connectors) ? cur.connectors : [];
      const texts = Array.isArray(cur.texts) ? cur.texts : [];
      const nextShapes = shapes.map((s) => (s ? clearFolder(s) : s));
      const nextConnectors = connectors.map((c) => (c ? clearFolder(c) : c));
      const nextImages = (cur.images || []).map((img) => (img ? clearFolder(img) : img));
      const nextTexts = texts.map((t) => (t ? clearFolder(t) : t));

      const next: MoodboardState = { ...cur, images: nextImages, texts: nextTexts, folders: nextFolders };
      if (shapes.length || cur.shapes) next.shapes = nextShapes;
      if (connectors.length || cur.connectors) next.connectors = nextConnectors;
      if (texts.length || cur.texts) next.texts = nextTexts;
      if (nextFolders.length || cur.folders) next.folders = nextFolders;
      commit(next);

      if (activeFolderId === folderId) setActiveFolderId('');
      setCollapsedFolderIds((prev) => {
        const nextSet = new Set(prev);
        nextSet.delete(folderId);
        return nextSet;
      });
    },
    [activeFolderId, commit]
  );

  const setFolderForSelection = React.useCallback(
    (folderId: string | null) => {
      const sel = Array.isArray(selectionRef.current) ? selectionRef.current : [];
      if (!sel.length) return;
      const cur = valueRef.current;
      const folders = Array.isArray(cur.folders) ? cur.folders : [];
      const fidRaw = typeof folderId === 'string' ? folderId.trim() : '';
      const nextFolderId = fidRaw && folders.some((f) => f && f.id === fidRaw) ? fidRaw : undefined;

      const keys = new Set(sel.map((s) => `${s.kind}:${s.id}`));
      const shapes = Array.isArray(cur.shapes) ? cur.shapes : [];
      const connectors = Array.isArray(cur.connectors) ? cur.connectors : [];
      const texts = Array.isArray(cur.texts) ? cur.texts : [];

      const nextShapes = shapes.map((s) => (s && keys.has(`shape:${s.id}`) ? { ...s, folderId: nextFolderId } : s));
      const nextConnectors = connectors.map((c) => (c && keys.has(`connector:${c.id}`) ? { ...c, folderId: nextFolderId } : c));
      const nextImages = (cur.images || []).map((img) => (img && keys.has(`image:${img.id}`) ? { ...img, folderId: nextFolderId } : img));
      const nextTexts = texts.map((t) => (t && keys.has(`text:${t.id}`) ? { ...t, folderId: nextFolderId } : t));

      const next: MoodboardState = { ...cur, images: nextImages, texts: nextTexts };
      if (shapes.length || cur.shapes) next.shapes = nextShapes;
      if (connectors.length || cur.connectors) next.connectors = nextConnectors;
      if (texts.length || cur.texts) next.texts = nextTexts;
      if (folders.length || cur.folders) next.folders = folders;
      commit(next);
    },
    [commit]
  );

  const setTagsForSelection = React.useCallback(() => {
    const sel = Array.isArray(selectionRef.current) ? selectionRef.current : [];
    if (!sel.length) return;
    const cur = valueRef.current;
    const shapes = Array.isArray(cur.shapes) ? cur.shapes : [];
    const connectors = Array.isArray(cur.connectors) ? cur.connectors : [];
    const images = Array.isArray(cur.images) ? cur.images : [];
    const texts = Array.isArray(cur.texts) ? cur.texts : [];
    const shapeById = new Map(shapes.map((s) => [s.id, s]));
    const connectorById = new Map(connectors.map((c) => [c.id, c]));
    const imageById = new Map(images.map((img) => [img.id, img]));
    const textById = new Map(texts.map((t) => [t.id, t]));

    const first = sel[0];
    const firstItem =
      first.kind === 'shape'
        ? shapeById.get(first.id)
        : first.kind === 'connector'
          ? connectorById.get(first.id)
          : first.kind === 'image'
            ? imageById.get(first.id)
            : textById.get(first.id);
    const curTags = normalizeTagList((firstItem as any)?.tags);
    const nextRaw = window.prompt('Tags (comma-separated)', curTags.join(', '));
    if (nextRaw == null) return;
    const nextTags = parseTagsInput(String(nextRaw));
    const tags = nextTags.length ? nextTags : undefined;

    const keys = new Set(sel.map((s) => `${s.kind}:${s.id}`));
    const nextShapes = shapes.map((s) => (s && keys.has(`shape:${s.id}`) ? { ...s, tags } : s));
    const nextConnectors = connectors.map((c) => (c && keys.has(`connector:${c.id}`) ? { ...c, tags } : c));
    const nextImages = images.map((img) => (img && keys.has(`image:${img.id}`) ? { ...img, tags } : img));
    const nextTexts = texts.map((t) => (t && keys.has(`text:${t.id}`) ? { ...t, tags } : t));

    const next: MoodboardState = { ...cur, images: nextImages, texts: nextTexts };
    if (shapes.length || cur.shapes) next.shapes = nextShapes;
    if (connectors.length || cur.connectors) next.connectors = nextConnectors;
    if (nextTexts.length || cur.texts) next.texts = nextTexts;
    commit(next);
  }, [commit]);

  const toggleFolderHidden = React.useCallback(
    (folderId: string) => {
      const cur = valueRef.current;
      const folders = Array.isArray(cur.folders) ? cur.folders : [];
      if (!folders.some((f) => f && f.id === folderId)) return;
      const eff = computeEffectiveFolderFlags(folders).get(folderId);
      const effectiveHidden = !!eff?.hidden;
      const nextFolders = folders.map((f) => (f && f.id === folderId ? { ...f, hidden: !effectiveHidden } : f));
      commit({ ...cur, folders: nextFolders });
    },
    [commit]
  );

  const toggleFolderLocked = React.useCallback(
    (folderId: string) => {
      const cur = valueRef.current;
      const folders = Array.isArray(cur.folders) ? cur.folders : [];
      if (!folders.some((f) => f && f.id === folderId)) return;
      const eff = computeEffectiveFolderFlags(folders).get(folderId);
      const effectiveLocked = !!eff?.locked;
      const nextFolders = folders.map((f) => (f && f.id === folderId ? { ...f, locked: !effectiveLocked } : f));
      commit({ ...cur, folders: nextFolders });
    },
    [commit]
  );

  const layerShapes = Array.isArray(value.shapes) ? value.shapes : [];
  const layerConnectors = Array.isArray(value.connectors) ? value.connectors : [];
  const layerImages = Array.isArray(value.images) ? value.images : [];
  const layerTexts = Array.isArray(value.texts) ? value.texts : [];
  const layerFolders = Array.isArray(value.folders) ? value.folders : [];
  const shapeById = new Map(layerShapes.map((s) => [s.id, s]));
  const connectorById = new Map(layerConnectors.map((c) => [c.id, c]));
  const imageById = new Map(layerImages.map((img) => [img.id, img]));
  const textById = new Map(layerTexts.map((t) => [t.id, t]));
  const folderById = React.useMemo(() => new Map(layerFolders.map((f) => [f.id, f])), [layerFolders]);
  const folderFlagsForUi = React.useMemo(() => computeEffectiveFolderFlags(layerFolders), [layerFolders]);

  const selectedText =
    selection.length === 1 && selection[0]?.kind === 'text'
      ? Array.isArray(value.texts)
        ? value.texts.find((t) => t && t.id === selection[0].id) ?? null
        : null
      : null;

  const selectedBoxSel = selection.length === 1 ? selection[0] : null;
  const selectedBoxItem =
    selectedBoxSel?.kind === 'image'
      ? layerImages.find((img) => img && img.id === selectedBoxSel.id) ?? null
      : selectedBoxSel?.kind === 'shape'
        ? layerShapes.find((s) => s && s.id === selectedBoxSel.id) ?? null
        : selectedBoxSel?.kind === 'text'
          ? layerTexts.find((t) => t && t.id === selectedBoxSel.id) ?? null
          : null;

  const selectedInspectorItem =
    selectedBoxSel?.kind === 'image'
      ? imageById.get(selectedBoxSel.id) ?? null
      : selectedBoxSel?.kind === 'shape'
        ? shapeById.get(selectedBoxSel.id) ?? null
        : selectedBoxSel?.kind === 'text'
          ? textById.get(selectedBoxSel.id) ?? null
          : selectedBoxSel?.kind === 'connector'
            ? connectorById.get(selectedBoxSel.id) ?? null
            : null;

  const selectedInspectorLocked = selectedInspectorItem ? isItemEffectivelyLocked(selectedInspectorItem, folderFlagsForUi) : false;
  const selectedInspectorStyle = (selectedInspectorItem as any)?.style as MoodboardLayerStyle | undefined;
  const selectedInspectorOpacityPct = Math.round(clampRange(Number(selectedInspectorStyle?.opacity ?? 1) || 1, 0, 1) * 100);
  const selectedInspectorBlend = normalizeBlendMode(selectedInspectorStyle?.blend);
  const selectedInspectorShadow = selectedInspectorStyle?.shadow;
  const selectedInspectorOutline = selectedInspectorStyle?.outline;

  const colorForPicker = (raw: unknown, fallback: string): string => {
    const s = typeof raw === 'string' ? raw.trim() : '';
    if (!parseHexRgb(s)) return fallback;
    return s.startsWith('#') ? s : `#${s}`;
  };

  const maskShapeIdsForUi = React.useMemo(() => {
    const out = new Set<string>();
    for (const img of layerImages) {
      const sid = (img as any)?.mask?.shapeId;
      if (typeof sid === 'string' && sid.trim()) out.add(sid.trim());
    }
    return out;
  }, [layerImages]);

  const layersTree = React.useMemo(() => {
    type LayerRef = { kind: MoodboardItemKind; id: string };
    type LayerTreeRow = { kind: 'folder'; id: string; depth: number } | { kind: 'item'; ref: LayerRef; depth: number };

    const folders = Array.isArray(layerFolders) ? layerFolders : [];
    const byId = new Map<string, MoodboardFolder>();
    for (const f of folders) {
      if (!f || typeof f.id !== 'string' || !f.id.trim()) continue;
      byId.set(f.id, f);
    }

    const childFoldersByParent = new Map<string, MoodboardFolder[]>();
    const rootFolders: MoodboardFolder[] = [];
    for (const f of folders) {
      if (!f || typeof f.id !== 'string' || !f.id.trim()) continue;
      const parentId = typeof f.parentId === 'string' ? f.parentId.trim() : '';
      if (!parentId || parentId === f.id || !byId.has(parentId)) {
        rootFolders.push(f);
        continue;
      }
      const list = childFoldersByParent.get(parentId) || [];
      list.push(f);
      childFoldersByParent.set(parentId, list);
    }

    const folderOptions: Array<{ id: string; label: string; depth: number }> = [];
    const walkFolderOptions = (f: MoodboardFolder, depth: number) => {
      folderOptions.push({ id: f.id, label: String(f.name || 'Folder'), depth });
      const kids = childFoldersByParent.get(f.id) || [];
      for (const k of kids) walkFolderOptions(k, depth + 1);
    };
    for (const f of rootFolders) walkFolderOptions(f, 0);

    const shapeByIdLocal = new Map(layerShapes.map((s) => [s.id, s]));
    const connectorByIdLocal = new Map(layerConnectors.map((c) => [c.id, c]));
    const imageByIdLocal = new Map(layerImages.map((img) => [img.id, img]));
    const textByIdLocal = new Map(layerTexts.map((t) => [t.id, t]));

    const getItem = (ref: LayerRef): any => {
      if (ref.kind === 'shape') return shapeByIdLocal.get(ref.id);
      if (ref.kind === 'connector') return connectorByIdLocal.get(ref.id);
      if (ref.kind === 'image') return imageByIdLocal.get(ref.id);
      return textByIdLocal.get(ref.id);
    };

    const fallbackNameFor = (ref: LayerRef, item: any): string => {
      if (ref.kind === 'shape') {
        const base = String((item as any)?.shape) === 'ellipse' ? 'Ellipse' : 'Rect';
        return `${maskShapeIdsForUi.has(ref.id) ? 'Frame: ' : ''}${base}`;
      }
      if (ref.kind === 'connector') return `Connector: ${String((item as any)?.kind) === 'arrow' ? 'Arrow' : 'Line'}`;
      if (ref.kind === 'image') return String((item as any)?.mask?.shapeId || '').trim() ? 'Image (masked)' : 'Image';
      const raw = String((item as any)?.text || '').trim();
      const first = raw.split(/\r?\n/)[0] || '';
      const snippet = first.length > 28 ? `${first.slice(0, 28)}…` : first;
      return snippet ? `Text: ${snippet}` : 'Text';
    };

    const displayNameFor = (ref: LayerRef, item: any): string => {
      const n = String((item as any)?.name || '').trim();
      return n || fallbackNameFor(ref, item);
    };

    const layerOrderDesc = layerOrderAsc.slice().reverse();
    const itemsByFolder = new Map<string, LayerRef[]>();
    const rootItems: LayerRef[] = [];
    for (const r of layerOrderDesc) {
      const ref: LayerRef = { kind: r.kind, id: r.id };
      const it = getItem(ref);
      if (!it) continue;
      const fid = folderIdOf(it);
      if (fid && byId.has(fid)) {
        const list = itemsByFolder.get(fid) || [];
        list.push(ref);
        itemsByFolder.set(fid, list);
      } else {
        rootItems.push(ref);
      }
    }

    const q = String(layersSearch || '').trim().toLowerCase();
    const visibleItemKeys = new Set<string>();
    const visibleFolderIds = new Set<string>();

    const addFolderChain = (folderId: string) => {
      let curId = folderId;
      let guard = 0;
      while (curId && byId.has(curId) && guard++ < 1000) {
        if (visibleFolderIds.has(curId)) break;
        visibleFolderIds.add(curId);
        const f = byId.get(curId);
        const pid = typeof f?.parentId === 'string' ? f.parentId.trim() : '';
        curId = pid && pid !== curId ? pid : '';
      }
    };

    if (q) {
      for (const f of folders) {
        if (!f || typeof f.id !== 'string') continue;
        const name = String(f.name || '').trim().toLowerCase();
        if (name.includes(q)) addFolderChain(f.id);
      }

      for (const r of layerOrderDesc) {
        const ref: LayerRef = { kind: r.kind, id: r.id };
        const it = getItem(ref);
        if (!it) continue;
        const name = displayNameFor(ref, it).toLowerCase();
        const tags = normalizeTagList((it as any)?.tags)
          .join(' ')
          .toLowerCase();
        if (!name.includes(q) && !tags.includes(q)) continue;
        visibleItemKeys.add(`${ref.kind}:${ref.id}`);
        const fid = folderIdOf(it);
        if (fid) addFolderChain(fid);
      }
    }

    const rows: LayerTreeRow[] = [];
    const forceExpand = !!q;
    const isCollapsed = (id: string) => !forceExpand && collapsedFolderIds.has(id);

    const walk = (f: MoodboardFolder, depth: number) => {
      if (q && !visibleFolderIds.has(f.id)) return;
      rows.push({ kind: 'folder', id: f.id, depth });
      if (isCollapsed(f.id)) return;
      const kids = childFoldersByParent.get(f.id) || [];
      for (const k of kids) walk(k, depth + 1);
      const items = itemsByFolder.get(f.id) || [];
      for (const ref of items) {
        const key = `${ref.kind}:${ref.id}`;
        if (q && !visibleItemKeys.has(key)) continue;
        rows.push({ kind: 'item', ref, depth: depth + 1 });
      }
    };

    for (const f of rootFolders) walk(f, 0);
    for (const ref of rootItems) {
      const key = `${ref.kind}:${ref.id}`;
      if (q && !visibleItemKeys.has(key)) continue;
      rows.push({ kind: 'item', ref, depth: 0 });
    }

    return { rows, folderOptions };
  }, [
    collapsedFolderIds,
    layerConnectors,
    layerFolders,
    layerImages,
    layerOrderAsc,
    layerShapes,
    layerTexts,
    layersSearch,
    maskShapeIdsForUi,
  ]);

  const maskSelImageId = selection.length === 2 ? selection.find((s) => s.kind === 'image')?.id ?? null : null;
  const maskSelShapeId = selection.length === 2 ? selection.find((s) => s.kind === 'shape')?.id ?? null : null;
  const canApplyMask = !!maskSelImageId && !!maskSelShapeId;
  const selectedImageForMask =
    selection.length === 1 && selection[0]?.kind === 'image' ? layerImages.find((img) => img && img.id === selection[0].id) ?? null : null;
  const canRemoveMask = !!(selectedImageForMask as any)?.mask?.shapeId;

  const updateSelectedBoxItem = React.useCallback(
    (patch: Partial<{ x: number; y: number; w: number; h: number; rot: number }>) => {
      const sel = selectedBoxSel;
      if (!sel || (sel.kind !== 'image' && sel.kind !== 'shape' && sel.kind !== 'text')) return;
      const cur = valueRef.current;
      const folderFlags = computeEffectiveFolderFlags(Array.isArray(cur.folders) ? cur.folders : []);
      const minSize = 0.02;

      const applyPatch = (box: any) => {
        const next = { ...box };
        if (patch.x != null) next.x = clamp01(Number(patch.x) || 0);
        if (patch.y != null) next.y = clamp01(Number(patch.y) || 0);
        if (patch.w != null) next.w = Math.min(1, Math.max(minSize, Number(patch.w) || minSize));
        if (patch.h != null) next.h = Math.min(1, Math.max(minSize, Number(patch.h) || minSize));
        if (patch.rot != null) next.rot = normalizeAngleDeg(Number(patch.rot) || 0);
        return next;
      };

      if (sel.kind === 'image') {
        const idx = (cur.images || []).findIndex((img) => img && img.id === sel.id);
        if (idx < 0) return;
        const img = cur.images[idx];
        if (!img || isItemEffectivelyLocked(img, folderFlags)) return;
        const nextImages = cur.images.map((x, i) => (i === idx ? applyPatch(x) : x));
        commit({ ...cur, images: nextImages });
        return;
      }

      if (sel.kind === 'shape') {
        const shapes = Array.isArray(cur.shapes) ? cur.shapes : [];
        const idx = shapes.findIndex((s) => s && s.id === sel.id);
        if (idx < 0) return;
        const s = shapes[idx];
        if (!s || isItemEffectivelyLocked(s, folderFlags)) return;
        const nextShapes = shapes.map((x, i) => (i === idx ? applyPatch(x) : x));
        commit({ ...cur, shapes: nextShapes });
        return;
      }

      const texts = Array.isArray(cur.texts) ? cur.texts : [];
      const idx = texts.findIndex((t) => t && t.id === sel.id);
      if (idx < 0) return;
      const t = texts[idx];
      if (!t || isItemEffectivelyLocked(t, folderFlags)) return;
      const nextTexts = texts.map((x, i) => (i === idx ? applyPatch(x) : x));
      commit({ ...cur, texts: nextTexts });
    },
    [commit, selectedBoxSel]
  );

  const updateSelectedLayerStyle = React.useCallback(
    (patcher: (prev: MoodboardLayerStyle | undefined) => MoodboardLayerStyle | undefined, mode: 'commit' | 'noHistory' = 'commit') => {
      const sel = selectedBoxSel;
      if (!sel) return;
      const cur = valueRef.current;
      const folderFlags = computeEffectiveFolderFlags(Array.isArray(cur.folders) ? cur.folders : []);
      const apply = (next: MoodboardState) => {
        if (mode === 'noHistory') applyNoHistory(next, { clearRedo: true });
        else commit(next);
      };

      const patchItem = (item: any) => {
        const nextStyle = cleanLayerStyle(patcher((item as any)?.style as MoodboardLayerStyle | undefined));
        return { ...item, style: nextStyle };
      };

      if (sel.kind === 'image') {
        const idx = (cur.images || []).findIndex((img) => img && img.id === sel.id);
        if (idx < 0) return;
        const img = cur.images[idx];
        if (!img || isItemEffectivelyLocked(img, folderFlags)) return;
        const nextImages = cur.images.map((x, i) => (i === idx ? (patchItem(x) as MoodboardImage) : x));
        apply({ ...cur, images: nextImages });
        return;
      }

      if (sel.kind === 'shape') {
        const shapes = Array.isArray(cur.shapes) ? cur.shapes : [];
        const idx = shapes.findIndex((s) => s && s.id === sel.id);
        if (idx < 0) return;
        const s = shapes[idx];
        if (!s || isItemEffectivelyLocked(s, folderFlags)) return;
        const nextShapes = shapes.map((x, i) => (i === idx ? (patchItem(x) as MoodboardShape) : x));
        apply({ ...cur, shapes: nextShapes });
        return;
      }

      if (sel.kind === 'text') {
        const texts = Array.isArray(cur.texts) ? cur.texts : [];
        const idx = texts.findIndex((t) => t && t.id === sel.id);
        if (idx < 0) return;
        const t = texts[idx];
        if (!t || isItemEffectivelyLocked(t, folderFlags)) return;
        const nextTexts = texts.map((x, i) => (i === idx ? (patchItem(x) as MoodboardText) : x));
        apply({ ...cur, texts: nextTexts });
        return;
      }

      if (sel.kind === 'connector') {
        const connectors = Array.isArray(cur.connectors) ? cur.connectors : [];
        const idx = connectors.findIndex((c) => c && c.id === sel.id);
        if (idx < 0) return;
        const c = connectors[idx];
        if (!c || isItemEffectivelyLocked(c, folderFlags)) return;
        const nextConnectors = connectors.map((x, i) => (i === idx ? (patchItem(x) as MoodboardConnector) : x));
        apply({ ...cur, connectors: nextConnectors });
      }
    },
    [applyNoHistory, commit, selectedBoxSel]
  );

  const addGuide = React.useCallback(
    (axis: 'x' | 'y', pos: number) => {
      const cur = valueRef.current;
      const guides = Array.isArray(cur.guides) ? cur.guides : [];
      const g: MoodboardGuide = { id: makeMoodId('mbg_'), axis, pos: clamp01(Number(pos) || 0) };
      commit({ ...cur, guides: [...guides, g] });
    },
    [commit]
  );

  return (
      <div className={styles.root}>
        <div className={styles.toolbar}>
          <button className={styles.toolBtn} data-active={tool === 'move' ? '1' : '0'} onClick={() => setTool('move')}>
            Move
          </button>
          <button className={styles.toolBtn} data-active={tool === 'transform' ? '1' : '0'} onClick={() => setTool('transform')}>
            Transform
          </button>
          <button className={styles.toolBtn} data-active={tool === 'text' ? '1' : '0'} onClick={() => setTool('text')}>
            Text
          </button>
          <button className={styles.toolBtn} data-active={tool === 'shape' ? '1' : '0'} onClick={() => setTool('shape')}>
            Shape
          </button>
          {tool === 'shape' ? (
            <label className={styles.toolLabel}>
              Kind{' '}
              <select value={shapeKind} onChange={(e) => setShapeKind((e.target.value as any) || 'rect')}>
                <option value="rect">Rect</option>
                <option value="ellipse">Ellipse</option>
              </select>
            </label>
          ) : null}
          <button className={styles.toolBtn} data-active={tool === 'connector' ? '1' : '0'} onClick={() => setTool('connector')}>
            Connector
          </button>
          {tool === 'connector' ? (
            <label className={styles.toolLabel}>
              Kind{' '}
              <select value={connectorKind} onChange={(e) => setConnectorKind((e.target.value as any) || 'line')}>
                <option value="line">Line</option>
                <option value="arrow">Arrow</option>
              </select>
            </label>
          ) : null}
         <button className={styles.toolBtn} data-active={tool === 'pen' ? '1' : '0'} onClick={() => setTool('pen')}>
           Pen
         </button>
        <button className={styles.toolBtn} data-active={tool === 'line' ? '1' : '0'} onClick={() => setTool('line')}>
          Line
        </button>
        <button className={styles.toolBtn} data-active={tool === 'arrow' ? '1' : '0'} onClick={() => setTool('arrow')}>
          Arrow
        </button>
        <button className={styles.toolBtn} data-active={tool === 'rect' ? '1' : '0'} onClick={() => setTool('rect')}>
          Rect
        </button>
        <button className={styles.toolBtn} data-active={tool === 'ellipse' ? '1' : '0'} onClick={() => setTool('ellipse')}>
          Ellipse
        </button>
        <button className={styles.toolBtn} data-active={tool === 'eraser' ? '1' : '0'} onClick={() => setTool('eraser')}>
          Eraser
        </button>
        <button className={styles.toolBtn} data-active={tool === 'bucket' ? '1' : '0'} onClick={() => setTool('bucket')}>
          Bucket
        </button>
          <button className={styles.toolBtn} data-active={tool === 'gradient' ? '1' : '0'} onClick={() => setTool('gradient')}>
            Gradient
          </button>
          <button className={styles.toolBtn} data-active={showLayers ? '1' : '0'} onClick={() => setShowLayers((v) => !v)}>
            Layers
          </button>
          <button className={styles.toolBtn} data-active={showInspector ? '1' : '0'} onClick={() => setShowInspector((v) => !v)}>
            Inspector
          </button>
          <button className={styles.toolBtn} data-active={showGrid ? '1' : '0'} onClick={toggleGrid} title="Toggle grid overlay">
            Grid
          </button>
          <button className={styles.toolBtn} data-active={snapToGrid ? '1' : '0'} onClick={toggleSnap} title="Snap move/transform to grid">
            Snap
          </button>
          <button className={styles.toolBtn} data-active={showRulers ? '1' : '0'} onClick={() => setShowRulers((v) => !v)} title="Show rulers (click to add guides)">
            Rulers
          </button>
          <button
            className={styles.toolBtn}
            data-active={snapGuides ? '1' : '0'}
            onClick={toggleSnapGuides}
            title="Snap to guides (when Snap is on)"
          >
            Guidesnap
          </button>
          <button
            className={styles.toolBtn}
            data-active={snapObjects ? '1' : '0'}
            onClick={toggleSnapObjects}
            title="Snap to other objects (when Snap is on)"
          >
            Align
          </button>
          <button className={styles.toolBtn} onClick={() => setZoomAnchored(viewZoom / 1.15)} title="Zoom out (mouse wheel)">
            -
          </button>
          <button className={styles.toolBtn} onClick={() => setZoomAnchored(viewZoom * 1.15)} title="Zoom in (mouse wheel)">
            +
          </button>
          <button className={styles.toolBtn} onClick={resetView} title="Reset view (zoom + pan). Pan: hold Space + drag">
            {Math.round(viewZoom * 100)}%
          </button>
          <button
            className={styles.toolBtn}
            onClick={() => {
              commit({ ...value, background: undefined });
           }}
           title="Reset background to paper"
         >
           Paper
         </button>

        {onRequestAddImage ? (
          <button className={styles.toolBtn} onClick={onRequestAddImage}>
            Add image
          </button>
        ) : null}

        <button
          className={styles.toolBtn}
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          Undo
        </button>

        <button className={styles.toolBtn} onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y / Ctrl+Shift+Z)">
          Redo
        </button>

        <button
            className={styles.toolBtn}
            onClick={deleteSelection}
            disabled={selection.length === 0}
            title="Delete selected item(s)"
          >
            Delete
          </button>

        {canApplyMask ? (
          <button className={styles.toolBtn} onClick={applyMaskFromSelection} title="Clip selected image to selected shape (frame)">
            Mask
          </button>
        ) : null}
        {canRemoveMask ? (
          <button className={styles.toolBtn} onClick={removeMaskFromSelection} title="Remove mask from selected image">
            Unmask
          </button>
        ) : null}

        <details
          style={{
            border: '1px solid var(--glass-border)',
            padding: '6px 8px',
            background: 'transparent',
          }}
        >
          <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)', userSelect: 'none' }}>
            Arrange{' '}
            <span style={{ color: 'var(--text-secondary)' }}>
              (<b>{arrangeUnits.length}</b> unit{arrangeUnits.length === 1 ? '' : 's'})
            </span>
          </summary>

          <div style={{ marginTop: 8, color: 'var(--text-secondary)' }}>Shift+click to multi-select. Grouped items move/transform together.</div>

          <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className={styles.toolBtn} disabled={!canArrange} onClick={() => translateSelectionUnits('align-left')}>
              Align L
            </button>
            <button className={styles.toolBtn} disabled={!canArrange} onClick={() => translateSelectionUnits('align-center')}>
              Align C
            </button>
            <button className={styles.toolBtn} disabled={!canArrange} onClick={() => translateSelectionUnits('align-right')}>
              Align R
            </button>
            <button className={styles.toolBtn} disabled={!canArrange} onClick={() => translateSelectionUnits('align-top')}>
              Top
            </button>
            <button className={styles.toolBtn} disabled={!canArrange} onClick={() => translateSelectionUnits('align-middle')}>
              Mid
            </button>
            <button className={styles.toolBtn} disabled={!canArrange} onClick={() => translateSelectionUnits('align-bottom')}>
              Bottom
            </button>
            <button className={styles.toolBtn} disabled={!canDistribute} onClick={() => translateSelectionUnits('dist-h')}>
              Dist H
            </button>
            <button className={styles.toolBtn} disabled={!canDistribute} onClick={() => translateSelectionUnits('dist-v')}>
              Dist V
            </button>
            <button className={styles.toolBtn} disabled={!canArrange} onClick={() => translateSelectionUnits('tidy')}>
              Tidy
            </button>
            <button className={styles.toolBtn} disabled={!canGroup} onClick={groupSelection} title="Create a group (move/transform as a unit)">
              Group
            </button>
            <button className={styles.toolBtn} disabled={!canUngroup} onClick={ungroupSelection} title="Remove grouping from selected groups">
              Ungroup
            </button>
          </div>
        </details>

        <label className={styles.toolLabel}>
          Size{' '}
          <input
            type="range"
            min={1}
            max={18}
            value={String(size)}
            onChange={(e) => setSize(Number(e.target.value) || 3)}
            disabled={
              tool === 'move' || tool === 'transform' || tool === 'text' || tool === 'shape' || tool === 'bucket' || tool === 'gradient'
            }
          />
        </label>

        <label className={styles.toolLabel}>
          Color{' '}
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            disabled={tool === 'eraser' || tool === 'move' || tool === 'transform'}
          />
        </label>

        {tool === 'gradient' ? (
          <label className={styles.toolLabel}>
            To{' '}
            <input type="color" value={gradientTo} onChange={(e) => setGradientTo(e.target.value)} />
          </label>
        ) : null}

        {tool === 'gradient' ? (
          <label className={styles.toolLabel}>
            Mode{' '}
            <select value={gradientMode} onChange={(e) => setGradientMode((e.target.value as any) || 'linear')}>
              <option value="linear">Linear</option>
              <option value="radial">Radial</option>
            </select>
          </label>
        ) : null}

        {tool === 'gradient' ? (
          <label className={styles.toolLabel}>
            Angle{' '}
            <input
              type="range"
              min={0}
              max={360}
              value={String(gradientAngle)}
              onChange={(e) => setGradientAngle(Number(e.target.value) || 0)}
              disabled={gradientMode === 'radial'}
            />
          </label>
        ) : null}

        <button className={styles.toolBtn} onClick={() => commit({ ...value, strokes: [] })}>
          Clear strokes
        </button>
      </div>

      <div className={styles.canvasWrap}>
        {showRulers ? (
          <>
            <div className={styles.rulerCorner} aria-hidden="true" />
            <div
              className={styles.rulerTop}
              title="Ruler (top). Click to add a vertical guide."
              onPointerDown={(e) => {
                e.preventDefault();
                const canvas = canvasRef.current;
                if (!canvas) return;
                const pt = pointFromClient(e.clientX, e.clientY, canvas, viewRef.current);
                addGuide('x', pt.x);
              }}
            />
            <div
              className={styles.rulerLeft}
              title="Ruler (left). Click to add a horizontal guide."
              onPointerDown={(e) => {
                e.preventDefault();
                const canvas = canvasRef.current;
                if (!canvas) return;
                const pt = pointFromClient(e.clientX, e.clientY, canvas, viewRef.current);
                addGuide('y', pt.y);
              }}
            />
          </>
        ) : null}
        {showLayers ? (
          <div className={styles.layersPanel} aria-label="Layers">
            <div className={styles.layersHeader}>
              <div>Layers</div>
              <button className={styles.layerBtn} type="button" onClick={() => setShowLayers(false)} title="Close">
                Close
              </button>
            </div>

            <div className={styles.layersTools}>
              <input
                className={styles.layersSearch}
                value={layersSearch}
                onChange={(e) => setLayersSearch(e.target.value)}
                placeholder="Search layers…"
              />

              <div className={styles.layersToolsRow}>
                <button
                  className={styles.layerBtn}
                  type="button"
                  onClick={() => createFolder({ parentId: activeFolderId || undefined })}
                  title={activeFolderId ? 'Create folder inside the selected folder' : 'Create folder at root'}
                >
                  New folder
                </button>

                <button className={styles.layerBtn} type="button" onClick={setTagsForSelection} disabled={!selection.length} title="Set tags on selection">
                  Tags…
                </button>

                <select
                  className={styles.layersSelect}
                  value={moveSelectionFolderPick}
                  disabled={!selection.length}
                  onChange={(e) => {
                    const v = String(e.target.value || '');
                    if (!v) return;
                    if (v === '__none__') setFolderForSelection(null);
                    else setFolderForSelection(v);
                    setMoveSelectionFolderPick('');
                  }}
                  title="Move selection to folder"
                >
                  <option value="">Move selection…</option>
                  <option value="__none__">(no folder)</option>
                  {layersTree.folderOptions.map((f) => (
                    <option key={f.id} value={f.id}>
                      {`${'\u00A0'.repeat(f.depth * 2)}${f.label}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.layersToolsHint}>
                <span>
                  Folder target:{' '}
                  {activeFolderId ? String(folderById.get(activeFolderId)?.name || 'Folder') : 'Root'}
                </span>
                {activeFolderId ? (
                  <button className={styles.layerBtn} type="button" onClick={() => setActiveFolderId('')} title="Clear folder target">
                    Clear
                  </button>
                ) : null}
              </div>
            </div>
            <div className={styles.layerRow}>
              <div className={styles.layerName}>Ink</div>
              <div className={styles.layerActions}>
                <button
                  className={styles.layerBtn}
                  data-active={value.strokesHidden ? '1' : '0'}
                  onClick={() => commit({ ...value, strokesHidden: !value.strokesHidden })}
                  title={value.strokesHidden ? 'Show strokes' : 'Hide strokes'}
                  type="button"
                >
                  {value.strokesHidden ? 'Hidden' : 'Visible'}
                </button>
                <button
                  className={styles.layerBtn}
                  data-active={value.strokesLocked ? '1' : '0'}
                  onClick={() => commit({ ...value, strokesLocked: !value.strokesLocked })}
                  title={value.strokesLocked ? 'Unlock strokes' : 'Lock strokes'}
                  type="button"
                >
                  {value.strokesLocked ? 'Locked' : 'Unlocked'}
                </button>
              </div>
            </div>

            <div className={styles.foldersHeader}>Folders</div>
            <div className={styles.foldersList}>
              {layersTree.folderOptions.length ? (
                layersTree.folderOptions.map((fo) => {
                  const f = folderById.get(fo.id);
                  if (!f) return null;
                  const effectiveHidden = !!folderFlagsForUi.get(fo.id)?.hidden;
                  const effectiveLocked = !!folderFlagsForUi.get(fo.id)?.locked;
                  const padLeft = 8 + fo.depth * 14;
                  return (
                    <div
                      key={`folder:${fo.id}`}
                      className={`${styles.layerRow} ${styles.folderRow}`}
                      data-selected={activeFolderId === fo.id ? '1' : '0'}
                      style={{ paddingLeft: `${padLeft}px` }}
                    >
                      <button
                        className={styles.layerPick}
                        type="button"
                        onClick={() => setActiveFolderId(fo.id)}
                        title="Select folder (sets folder target)"
                      >
                        {effectiveHidden ? '(hidden) ' : ''}
                        {String(f.name || 'Folder')}
                      </button>

                      <div className={styles.layerActions}>
                        <button
                          className={styles.layerBtn}
                          data-active={effectiveHidden ? '1' : '0'}
                          onClick={() => toggleFolderHidden(fo.id)}
                          title={effectiveHidden ? 'Show folder contents' : 'Hide folder contents'}
                          type="button"
                        >
                          {effectiveHidden ? 'Show' : 'Hide'}
                        </button>
                        <button
                          className={styles.layerBtn}
                          data-active={effectiveLocked ? '1' : '0'}
                          onClick={() => toggleFolderLocked(fo.id)}
                          title={effectiveLocked ? 'Unlock folder contents' : 'Lock folder contents'}
                          type="button"
                        >
                          {effectiveLocked ? 'Unlock' : 'Lock'}
                        </button>
                        <button className={styles.layerBtn} type="button" onClick={() => renameFolder(fo.id)} title="Rename folder">
                          Rename
                        </button>
                        <button className={styles.layerBtn} type="button" onClick={() => createFolder({ parentId: fo.id })} title="New subfolder">
                          +Sub
                        </button>
                        <button
                          className={styles.layerBtn}
                          type="button"
                          onClick={() => setFolderForSelection(fo.id)}
                          disabled={!selection.length}
                          title="Move selection into this folder"
                        >
                          Put sel
                        </button>
                        <button className={styles.layerBtn} type="button" onClick={() => deleteFolder(fo.id)} title="Delete folder">
                          Del
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className={styles.layersEmpty}>No folders yet.</div>
              )}
            </div>

            <div className={styles.layersList}>
              {layerOrderAsc
                .slice()
                .reverse()
                .map((ref) => {
                  const key = `${ref.kind}:${ref.id}`;
                  const pos = layerPosByKey.get(key) ?? 0;
                  const isTop = pos >= layerOrderAsc.length - 1;
                  const isBottom = pos <= 0;

                  const item =
                    ref.kind === 'shape'
                      ? shapeById.get(ref.id)
                      : ref.kind === 'connector'
                        ? connectorById.get(ref.id)
                        : ref.kind === 'image'
                          ? imageById.get(ref.id)
                          : textById.get(ref.id);
                  if (!item) return null;

                  const isSelected = selection.some((s) => s.kind === ref.kind && s.id === ref.id);
                  const hidden = isItemEffectivelyHidden(item, folderFlagsForUi);
                  const locked = isItemEffectivelyLocked(item, folderFlagsForUi);
                  const gid = String((item as any).groupId ?? '').trim();

                  const fallbackName =
                    ref.kind === 'shape'
                      ? `${maskShapeIdsForUi.has(ref.id) ? 'Frame: ' : ''}${(item as any).shape === 'ellipse' ? 'Ellipse' : 'Rect'}`
                      : ref.kind === 'connector'
                        ? `Connector: ${String((item as any).kind) === 'arrow' ? 'Arrow' : 'Line'}`
                        : ref.kind === 'image'
                          ? (String((item as any)?.mask?.shapeId || '').trim() ? 'Image (masked)' : 'Image')
                          : (() => {
                              const raw = String((item as any).text || '').trim();
                              const first = raw.split(/\r?\n/)[0] || '';
                              const snippet = first.length > 28 ? `${first.slice(0, 28)}…` : first;
                              return snippet ? `Text: ${snippet}` : 'Text';
                            })();

                  const displayName = String((item as any).name || '').trim() || fallbackName;
                  const q = String(layersSearch || '').trim().toLowerCase();
                  if (q) {
                    const tags = normalizeTagList((item as any)?.tags)
                      .join(' ')
                      .toLowerCase();
                    const name = displayName.toLowerCase();
                    if (!name.includes(q) && !tags.includes(q)) return null;
                  }

                  return (
                    <div key={key} className={styles.layerRow} data-selected={isSelected ? '1' : '0'}>
                      <button
                        className={styles.layerPick}
                        type="button"
                        onClick={() => {
                            setTool('move');
                            if (gid) {
                              const members: Selection = [];
                              for (const c of layerConnectors) {
                                if (!c || isItemEffectivelyHidden(c, folderFlagsForUi)) continue;
                                if (String((c as any).groupId ?? '') === gid) members.push({ kind: 'connector', id: c.id });
                              }
                              for (const s of layerShapes) {
                                if (!s || isItemEffectivelyHidden(s, folderFlagsForUi)) continue;
                                if (String((s as any).groupId ?? '') === gid) members.push({ kind: 'shape', id: s.id });
                              }
                              for (const t of layerTexts) {
                                if (!t || isItemEffectivelyHidden(t, folderFlagsForUi)) continue;
                                if (String((t as any).groupId ?? '') === gid) members.push({ kind: 'text', id: t.id });
                              }
                              for (const img of layerImages) {
                                if (!img || isItemEffectivelyHidden(img, folderFlagsForUi)) continue;
                                if (String((img as any).groupId ?? '') === gid) members.push({ kind: 'image', id: img.id });
                              }
                            const hit: SelectedItem = { kind: ref.kind, id: ref.id };
                            const rest = members.filter((m) => !(m.kind === hit.kind && m.id === hit.id));
                            const nextSel: Selection = [hit, ...rest];
                            selectionRef.current = nextSel;
                            setSelection(nextSel);
                            return;
                          }
                          selectionRef.current = [{ kind: ref.kind, id: ref.id }];
                          setSelection([{ kind: ref.kind, id: ref.id }]);
                        }}
                        title="Select layer"
                      >
                        {hidden ? '(hidden) ' : ''}
                        {displayName}
                      </button>

                      <input
                        className={styles.layerNameInput}
                        value={String((item as any).name ?? '')}
                        placeholder="Name"
                        onChange={(e) => {
                          const name = e.target.value;
                          const cur = valueRef.current;
                          if (ref.kind === 'shape') {
                            const shapes = Array.isArray(cur.shapes) ? cur.shapes : [];
                            const nextShapes = shapes.map((s) => (s.id === ref.id ? { ...s, name } : s));
                            applyNoHistory({ ...cur, shapes: nextShapes }, { clearRedo: true });
                          } else if (ref.kind === 'connector') {
                            const connectors = Array.isArray(cur.connectors) ? cur.connectors : [];
                            const nextConnectors = connectors.map((c) => (c.id === ref.id ? { ...c, name } : c));
                            applyNoHistory({ ...cur, connectors: nextConnectors }, { clearRedo: true });
                          } else if (ref.kind === 'image') {
                            const nextImages = (cur.images || []).map((img) => (img.id === ref.id ? { ...img, name } : img));
                            applyNoHistory({ ...cur, images: nextImages }, { clearRedo: true });
                          } else {
                            const texts = Array.isArray(cur.texts) ? cur.texts : [];
                            const nextTexts = texts.map((t) => (t.id === ref.id ? { ...t, name } : t));
                            applyNoHistory({ ...cur, texts: nextTexts }, { clearRedo: true });
                          }
                        }}
                      />

                      <div className={styles.layerActions}>
                        <button
                          className={styles.layerBtn}
                          data-active={hidden ? '1' : '0'}
                          onClick={() => {
                            const cur = valueRef.current;
                            const nextHidden = !hidden;
                            if (ref.kind === 'shape') {
                              const shapes = Array.isArray(cur.shapes) ? cur.shapes : [];
                              const nextShapes = shapes.map((s) => (s.id === ref.id ? { ...s, hidden: nextHidden } : s));
                              commit({ ...cur, shapes: nextShapes });
                            } else if (ref.kind === 'connector') {
                              const connectors = Array.isArray(cur.connectors) ? cur.connectors : [];
                              const nextConnectors = connectors.map((c) => (c.id === ref.id ? { ...c, hidden: nextHidden } : c));
                              commit({ ...cur, connectors: nextConnectors });
                            } else if (ref.kind === 'image') {
                              const nextImages = (cur.images || []).map((img) => (img.id === ref.id ? { ...img, hidden: nextHidden } : img));
                              commit({ ...cur, images: nextImages });
                            } else {
                              const texts = Array.isArray(cur.texts) ? cur.texts : [];
                              const nextTexts = texts.map((t) => (t.id === ref.id ? { ...t, hidden: nextHidden } : t));
                              commit({ ...cur, texts: nextTexts });
                            }

                            if (nextHidden) {
                              const prev = Array.isArray(selectionRef.current) ? selectionRef.current : [];
                              if (prev.some((s) => s.kind === ref.kind && s.id === ref.id)) {
                                const nextSel = prev.filter((s) => !(s.kind === ref.kind && s.id === ref.id));
                                selectionRef.current = nextSel;
                                setSelection(nextSel);
                              }
                            }
                          }}
                          title={hidden ? 'Show layer' : 'Hide layer'}
                          type="button"
                        >
                          {hidden ? 'Show' : 'Hide'}
                        </button>

                        <button
                          className={styles.layerBtn}
                          data-active={locked ? '1' : '0'}
                          onClick={() => {
                            const cur = valueRef.current;
                            if (ref.kind === 'shape') {
                              const shapes = Array.isArray(cur.shapes) ? cur.shapes : [];
                              const nextShapes = shapes.map((s) => (s.id === ref.id ? { ...s, locked: !locked } : s));
                              commit({ ...cur, shapes: nextShapes });
                            } else if (ref.kind === 'connector') {
                              const connectors = Array.isArray(cur.connectors) ? cur.connectors : [];
                              const nextConnectors = connectors.map((c) => (c.id === ref.id ? { ...c, locked: !locked } : c));
                              commit({ ...cur, connectors: nextConnectors });
                            } else if (ref.kind === 'image') {
                              const nextImages = (cur.images || []).map((img) => (img.id === ref.id ? { ...img, locked: !locked } : img));
                              commit({ ...cur, images: nextImages });
                            } else {
                              const texts = Array.isArray(cur.texts) ? cur.texts : [];
                              const nextTexts = texts.map((t) => (t.id === ref.id ? { ...t, locked: !locked } : t));
                              commit({ ...cur, texts: nextTexts });
                            }
                          }}
                          title={locked ? 'Unlock layer' : 'Lock layer'}
                          type="button"
                        >
                          {locked ? 'Unlock' : 'Lock'}
                        </button>

                        <button
                          className={styles.layerBtn}
                          disabled={isTop}
                          onClick={() => reorderLayer({ kind: ref.kind, id: ref.id }, 'up')}
                          title="Bring forward"
                          type="button"
                        >
                          Up
                        </button>

                        <button
                          className={styles.layerBtn}
                          disabled={isTop}
                          onClick={() => reorderLayer({ kind: ref.kind, id: ref.id }, 'top')}
                          title="Bring to top"
                          type="button"
                        >
                          Top
                        </button>

                        <button
                          className={styles.layerBtn}
                          disabled={isBottom}
                          onClick={() => reorderLayer({ kind: ref.kind, id: ref.id }, 'down')}
                          title="Send backward"
                          type="button"
                        >
                          Down
                        </button>

                        <button
                          className={styles.layerBtn}
                          disabled={isBottom}
                          onClick={() => reorderLayer({ kind: ref.kind, id: ref.id }, 'bottom')}
                          title="Send to bottom"
                          type="button"
                        >
                          Bottom
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        ) : null}
        {selectedText ? (
          <div className={styles.textPanel} aria-label="Text">
            <div className={styles.textHeader}>
              <div>Text</div>
              <button
                className={styles.layerBtn}
                type="button"
                onClick={() => {
                  selectionRef.current = [];
                  setSelection([]);
                }}
                title="Close"
              >
                Close
              </button>
            </div>

            <textarea
              className={styles.textArea}
              value={selectedText.text ?? ''}
              onChange={(e) => {
                const texts = Array.isArray(value.texts) ? value.texts : [];
                const nextTexts = texts.map((t) => (t && t.id === selectedText.id ? { ...t, text: e.target.value } : t));
                applyNoHistory({ ...value, texts: nextTexts }, { clearRedo: true });
              }}
              placeholder="Write a note…"
            />

            <div className={styles.textRow}>
              <label className={styles.textField}>
                Color <input type="color" value={selectedText.color || '#111111'} onChange={(e) => {
                  const texts = Array.isArray(value.texts) ? value.texts : [];
                  const nextTexts = texts.map((t) => (t && t.id === selectedText.id ? { ...t, color: e.target.value } : t));
                  applyNoHistory({ ...value, texts: nextTexts }, { clearRedo: true });
                }} />
              </label>
              <label className={styles.textField}>
                BG <input type="color" value={selectedText.bg || '#fdf5e6'} onChange={(e) => {
                  const texts = Array.isArray(value.texts) ? value.texts : [];
                  const nextTexts = texts.map((t) => (t && t.id === selectedText.id ? { ...t, bg: e.target.value } : t));
                  applyNoHistory({ ...value, texts: nextTexts }, { clearRedo: true });
                }} />
              </label>
              <label className={styles.textField}>
                Size{' '}
                <input
                  className={styles.textSize}
                  type="range"
                  min={10}
                  max={48}
                  value={String(selectedText.fontSize ?? 18)}
                  onChange={(e) => {
                    const n = Number(e.target.value) || 18;
                    const texts = Array.isArray(value.texts) ? value.texts : [];
                    const nextTexts = texts.map((t) => (t && t.id === selectedText.id ? { ...t, fontSize: n } : t));
                    applyNoHistory({ ...value, texts: nextTexts }, { clearRedo: true });
                  }}
                />
              </label>
            </div>
          </div>
        ) : null}
        {showInspector && selectedBoxSel && selectedInspectorItem ? (
          <div key={`${selectedBoxSel.kind}:${selectedBoxSel.id}`} className={styles.inspectorPanel} aria-label="Inspector">
            <div className={styles.inspectorHeader}>
              <div>Inspector</div>
              <button className={styles.layerBtn} type="button" onClick={() => setShowInspector(false)} title="Close">
                Close
              </button>
            </div>

            {selectedBoxItem ? (
              <div className={styles.inspectorGrid}>
                <label className={styles.inspectorField}>
                  X%
                  <input
                    className={styles.inspectorInput}
                    type="number"
                    step="0.1"
                    defaultValue={String(Math.round(((Number((selectedBoxItem as any).x) || 0) * 1000)) / 10)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
                    }}
                    onBlur={(e) => {
                      const n = Number(e.currentTarget.value);
                      if (!Number.isFinite(n)) return;
                      updateSelectedBoxItem({ x: n / 100 });
                    }}
                  />
                </label>

                <label className={styles.inspectorField}>
                  Y%
                  <input
                    className={styles.inspectorInput}
                    type="number"
                    step="0.1"
                    defaultValue={String(Math.round(((Number((selectedBoxItem as any).y) || 0) * 1000)) / 10)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
                    }}
                    onBlur={(e) => {
                      const n = Number(e.currentTarget.value);
                      if (!Number.isFinite(n)) return;
                      updateSelectedBoxItem({ y: n / 100 });
                    }}
                  />
                </label>

                <label className={styles.inspectorField}>
                  W%
                  <input
                    className={styles.inspectorInput}
                    type="number"
                    step="0.1"
                    defaultValue={String(Math.round(((Number((selectedBoxItem as any).w) || 0) * 1000)) / 10)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
                    }}
                    onBlur={(e) => {
                      const n = Number(e.currentTarget.value);
                      if (!Number.isFinite(n)) return;
                      updateSelectedBoxItem({ w: n / 100 });
                    }}
                  />
                </label>

                <label className={styles.inspectorField}>
                  H%
                  <input
                    className={styles.inspectorInput}
                    type="number"
                    step="0.1"
                    defaultValue={String(Math.round(((Number((selectedBoxItem as any).h) || 0) * 1000)) / 10)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
                    }}
                    onBlur={(e) => {
                      const n = Number(e.currentTarget.value);
                      if (!Number.isFinite(n)) return;
                      updateSelectedBoxItem({ h: n / 100 });
                    }}
                  />
                </label>

                <label className={styles.inspectorField}>
                  Rot°
                  <input
                    className={styles.inspectorInput}
                    type="number"
                    step="1"
                    defaultValue={String(Math.round(normalizeAngleDeg(Number((selectedBoxItem as any).rot) || 0)))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
                    }}
                    onBlur={(e) => {
                      const n = Number(e.currentTarget.value);
                      if (!Number.isFinite(n)) return;
                      updateSelectedBoxItem({ rot: n });
                    }}
                  />
                </label>
              </div>
            ) : null}

            <div className={styles.inspectorSection}>
              <div className={styles.inspectorSectionTitle}>Style</div>

              <div className={styles.inspectorGrid}>
                <label className={styles.inspectorField}>
                  Opacity%
                  <input
                    className={styles.inspectorInput}
                    type="number"
                    step="1"
                    min={0}
                    max={100}
                    disabled={selectedInspectorLocked}
                    defaultValue={String(selectedInspectorOpacityPct)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
                    }}
                    onBlur={(e) => {
                      const n = Number(e.currentTarget.value);
                      if (!Number.isFinite(n)) return;
                      const pct = clampRange(n, 0, 100);
                      updateSelectedLayerStyle((prev) => ({ ...(prev || {}), opacity: pct / 100 }), 'commit');
                    }}
                  />
                </label>

                <label className={styles.inspectorField}>
                  Blend
                  <select
                    className={styles.inspectorInput}
                    value={selectedInspectorBlend}
                    disabled={selectedInspectorLocked}
                    onChange={(e) => {
                      const nextBlend = normalizeBlendMode(e.currentTarget.value);
                      updateSelectedLayerStyle((prev) => ({ ...(prev || {}), blend: nextBlend }), 'commit');
                    }}
                  >
                    <option value="normal">Normal</option>
                    <option value="multiply">Multiply</option>
                    <option value="screen">Screen</option>
                  </select>
                </label>

                <label className={`${styles.inspectorField} ${styles.inspectorSpan2}`}>
                  <span className={styles.inspectorCheck}>
                    <input
                      type="checkbox"
                      checked={!!selectedInspectorShadow}
                      disabled={selectedInspectorLocked}
                      onChange={(e) => {
                        const enable = e.currentTarget.checked;
                        updateSelectedLayerStyle((prev) => {
                          const next = { ...(prev || {}) } as MoodboardLayerStyle;
                          if (enable) {
                            next.shadow = prev?.shadow ?? { color: '#000000', opacity: 0.35, blur: 12, offsetX: 0, offsetY: 8 };
                          } else {
                            next.shadow = undefined;
                          }
                          return next;
                        }, 'commit');
                      }}
                    />{' '}
                    Shadow
                  </span>
                </label>

                {selectedInspectorShadow ? (
                  <>
                    <label className={styles.inspectorField}>
                      Blur px
                      <input
                        className={styles.inspectorInput}
                        type="number"
                        step="1"
                        min={0}
                        disabled={selectedInspectorLocked}
                        defaultValue={String(Number(selectedInspectorShadow.blur) || 12)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
                        }}
                        onBlur={(e) => {
                          const n = Number(e.currentTarget.value);
                          if (!Number.isFinite(n)) return;
                          updateSelectedLayerStyle((prev) => {
                            const next = { ...(prev || {}) } as MoodboardLayerStyle;
                            const sh = { ...(next.shadow || {}) } as MoodboardShadowStyle;
                            sh.blur = Math.max(0, n);
                            next.shadow = sh;
                            return next;
                          }, 'commit');
                        }}
                      />
                    </label>

                    <label className={styles.inspectorField}>
                      Alpha%
                      <input
                        className={styles.inspectorInput}
                        type="number"
                        step="1"
                        min={0}
                        max={100}
                        disabled={selectedInspectorLocked}
                        defaultValue={String(Math.round(clampRange(Number(selectedInspectorShadow.opacity) || 0.35, 0, 1) * 100))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
                        }}
                        onBlur={(e) => {
                          const n = Number(e.currentTarget.value);
                          if (!Number.isFinite(n)) return;
                          const pct = clampRange(n, 0, 100);
                          updateSelectedLayerStyle((prev) => {
                            const next = { ...(prev || {}) } as MoodboardLayerStyle;
                            const sh = { ...(next.shadow || {}) } as MoodboardShadowStyle;
                            sh.opacity = pct / 100;
                            next.shadow = sh;
                            return next;
                          }, 'commit');
                        }}
                      />
                    </label>

                    <label className={styles.inspectorField}>
                      Off X
                      <input
                        className={styles.inspectorInput}
                        type="number"
                        step="1"
                        disabled={selectedInspectorLocked}
                        defaultValue={String(Number(selectedInspectorShadow.offsetX) || 0)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
                        }}
                        onBlur={(e) => {
                          const n = Number(e.currentTarget.value);
                          if (!Number.isFinite(n)) return;
                          updateSelectedLayerStyle((prev) => {
                            const next = { ...(prev || {}) } as MoodboardLayerStyle;
                            const sh = { ...(next.shadow || {}) } as MoodboardShadowStyle;
                            sh.offsetX = n;
                            next.shadow = sh;
                            return next;
                          }, 'commit');
                        }}
                      />
                    </label>

                    <label className={styles.inspectorField}>
                      Off Y
                      <input
                        className={styles.inspectorInput}
                        type="number"
                        step="1"
                        disabled={selectedInspectorLocked}
                        defaultValue={String(Number(selectedInspectorShadow.offsetY) || 8)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
                        }}
                        onBlur={(e) => {
                          const n = Number(e.currentTarget.value);
                          if (!Number.isFinite(n)) return;
                          updateSelectedLayerStyle((prev) => {
                            const next = { ...(prev || {}) } as MoodboardLayerStyle;
                            const sh = { ...(next.shadow || {}) } as MoodboardShadowStyle;
                            sh.offsetY = n;
                            next.shadow = sh;
                            return next;
                          }, 'commit');
                        }}
                      />
                    </label>

                    <label className={`${styles.inspectorField} ${styles.inspectorSpan2}`}>
                      Shadow color
                      <input
                        type="color"
                        disabled={selectedInspectorLocked}
                        value={colorForPicker(selectedInspectorShadow.color, '#000000')}
                        onChange={(e) => {
                          const v = e.currentTarget.value;
                          updateSelectedLayerStyle((prev) => {
                            const next = { ...(prev || {}) } as MoodboardLayerStyle;
                            const sh = { ...(next.shadow || {}) } as MoodboardShadowStyle;
                            sh.color = v;
                            next.shadow = sh;
                            return next;
                          }, 'noHistory');
                        }}
                      />
                    </label>
                  </>
                ) : null}

                {selectedBoxItem ? (
                  <>
                    <label className={`${styles.inspectorField} ${styles.inspectorSpan2}`}>
                      <span className={styles.inspectorCheck}>
                        <input
                          type="checkbox"
                          checked={!!selectedInspectorOutline}
                          disabled={selectedInspectorLocked}
                          onChange={(e) => {
                            const enable = e.currentTarget.checked;
                            updateSelectedLayerStyle((prev) => {
                              const next = { ...(prev || {}) } as MoodboardLayerStyle;
                              if (enable) {
                                next.outline = prev?.outline ?? { color: '#111111', width: 2 };
                              } else {
                                next.outline = undefined;
                              }
                              return next;
                            }, 'commit');
                          }}
                        />{' '}
                        Outline
                      </span>
                    </label>

                    {selectedInspectorOutline ? (
                      <>
                        <label className={styles.inspectorField}>
                          Width px
                          <input
                            className={styles.inspectorInput}
                            type="number"
                            step="1"
                            min={0}
                            disabled={selectedInspectorLocked}
                            defaultValue={String(Number(selectedInspectorOutline.width) || 2)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
                            }}
                            onBlur={(e) => {
                              const n = Number(e.currentTarget.value);
                              if (!Number.isFinite(n)) return;
                              updateSelectedLayerStyle((prev) => {
                                const next = { ...(prev || {}) } as MoodboardLayerStyle;
                                const ol = { ...(next.outline || {}) } as MoodboardOutlineStyle;
                                ol.width = Math.max(0, n);
                                next.outline = ol;
                                return next;
                              }, 'commit');
                            }}
                          />
                        </label>

                        <label className={styles.inspectorField}>
                          Color
                          <input
                            type="color"
                            disabled={selectedInspectorLocked}
                            value={colorForPicker(selectedInspectorOutline.color, '#111111')}
                            onChange={(e) => {
                              const v = e.currentTarget.value;
                              updateSelectedLayerStyle((prev) => {
                                const next = { ...(prev || {}) } as MoodboardLayerStyle;
                                const ol = { ...(next.outline || {}) } as MoodboardOutlineStyle;
                                ol.color = v;
                                next.outline = ol;
                                return next;
                              }, 'noHistory');
                            }}
                          />
                        </label>
                      </>
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
        {contextMenu ? (
          <div
            ref={contextMenuElRef}
            className={styles.contextMenu}
            style={{ left: contextMenu.x, top: contextMenu.y }}
            role="menu"
          >
            <button
              className={styles.contextMenuItem}
              type="button"
              onClick={() => {
                duplicateSelection();
                setContextMenu(null);
              }}
              disabled={selection.length === 0}
            >
              Duplicate
            </button>
            <button
              className={styles.contextMenuItem}
              type="button"
              onClick={() => {
                copySelection();
                setContextMenu(null);
              }}
              disabled={selection.length === 0}
            >
              Copy
            </button>
            <button
              className={styles.contextMenuItem}
              type="button"
              onClick={() => {
                pasteClipboard();
                setContextMenu(null);
              }}
              disabled={!clipboardRef.current}
            >
              Paste
            </button>
            <button
              className={styles.contextMenuItem}
              type="button"
              onClick={() => {
                deleteSelection();
                setContextMenu(null);
              }}
              disabled={selection.length === 0}
            >
              Delete
            </button>

            <div className={styles.contextMenuSep} />

            <button
              className={styles.contextMenuItem}
              type="button"
              onClick={() => {
                if (selection.length === 1) reorderLayer(selection[0], 'up');
                setContextMenu(null);
              }}
              disabled={selection.length !== 1}
            >
              Bring forward
            </button>
            <button
              className={styles.contextMenuItem}
              type="button"
              onClick={() => {
                if (selection.length === 1) reorderLayer(selection[0], 'down');
                setContextMenu(null);
              }}
              disabled={selection.length !== 1}
            >
              Send backward
            </button>
            <button
              className={styles.contextMenuItem}
              type="button"
              onClick={() => {
                if (selection.length === 1) reorderLayer(selection[0], 'top');
                setContextMenu(null);
              }}
              disabled={selection.length !== 1}
            >
              Bring to front
            </button>
            <button
              className={styles.contextMenuItem}
              type="button"
              onClick={() => {
                if (selection.length === 1) reorderLayer(selection[0], 'bottom');
                setContextMenu(null);
              }}
              disabled={selection.length !== 1}
            >
              Send to back
            </button>

            <div className={styles.contextMenuSep} />

            <button
              className={styles.contextMenuItem}
              type="button"
              onClick={() => {
                groupSelection();
                setContextMenu(null);
              }}
              disabled={!canGroup}
            >
              Group
            </button>
            <button
              className={styles.contextMenuItem}
              type="button"
              onClick={() => {
                ungroupSelection();
                setContextMenu(null);
              }}
              disabled={!canUngroup}
            >
              Ungroup
            </button>
          </div>
        ) : null}
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          onContextMenu={(e) => {
            e.preventDefault();
            const rect = e.currentTarget.getBoundingClientRect();
            setContextMenu({ x: e.clientX - rect.left, y: e.clientY - rect.top });
          }}
        />
      </div>
    </div>
  );
}
