import React from 'react';
import styles from './moodboardCanvas.module.css';

type MoodboardTool = 'pen' | 'line' | 'arrow' | 'rect' | 'ellipse' | 'eraser' | 'move' | 'transform' | 'text' | 'bucket' | 'gradient';
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

export type MoodboardImage = {
  id: string;
  imageId: string;
  x: number; // normalized center x
  y: number; // normalized center y
  w: number; // normalized width
  h: number; // normalized height
  name?: string;
  hidden?: boolean;
  locked?: boolean;
};

export type MoodboardText = {
  id: string;
  x: number; // normalized center x
  y: number; // normalized center y
  w: number; // normalized width
  h: number; // normalized height
  text: string;
  fontSize?: number; // px
  color?: string; // CSS color (prefer #RRGGBB)
  bg?: string; // CSS color (prefer #RRGGBB)
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
  images: MoodboardImage[];
  texts?: MoodboardText[];
  strokesHidden?: boolean;
  strokesLocked?: boolean;
};

type ResizeHandle = 'nw' | 'ne' | 'se' | 'sw';
type MoodboardItemKind = 'image' | 'text';
type SelectedItem = { kind: MoodboardItemKind; id: string } | null;

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
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

function normalizeMoodboardState(value: MoodboardState): MoodboardState {
  const images = Array.isArray(value.images) ? value.images : [];
  const texts = Array.isArray(value.texts) ? value.texts : [];
  let changed = false;
  const nextImages = images.map((img) => {
    if (img && typeof img.id === 'string' && img.id.trim().length) return img;
    changed = true;
    return { ...(img as any), id: makeMoodId('mbi_') } as MoodboardImage;
  });

  const nextTexts = texts.map((t) => {
    const hasId = !!(t && typeof t.id === 'string' && t.id.trim().length);
    const nextText = typeof (t as any)?.text === 'string' ? String((t as any).text) : '';
    if (hasId && typeof (t as any)?.text === 'string') return t;
    changed = true;
    return { ...(t as any), id: hasId ? (t as any).id : makeMoodId('mbt_'), text: nextText } as MoodboardText;
  });

  if (!changed) return value;
  const next: MoodboardState = { ...value, images: nextImages };
  if (texts.length || value.texts) next.texts = nextTexts;
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
  const dragRef = React.useRef<null | { kind: MoodboardItemKind; id: string; offsetX: number; offsetY: number; start: MoodboardState; moved: boolean }>(null);
  const resizeRef = React.useRef<
    null | { kind: MoodboardItemKind; id: string; handle: ResizeHandle; startItem: MoodboardImage | MoodboardText; startState: MoodboardState; moved: boolean }
  >(null);
  const valueRef = React.useRef<MoodboardState>(value);
  const toolRef = React.useRef<MoodboardTool>('pen');
  const sizeRef = React.useRef<number>(3);
  const colorRef = React.useRef<string>('#111111');
  const gradientToRef = React.useRef<string>('#ffffff');
  const gradientAngleRef = React.useRef<number>(0);
  const gradientModeRef = React.useRef<'linear' | 'radial'>('linear');
  const selectedItemRef = React.useRef<SelectedItem>(null);
  const internalChangeRef = React.useRef<MoodboardState | null>(null);
  const historyPastRef = React.useRef<MoodboardState[]>([]);
  const historyFutureRef = React.useRef<MoodboardState[]>([]);
  const gradientDragRef = React.useRef<null | { startPt: { x: number; y: number }; startState: MoodboardState; moved: boolean; lastAngle: number }>(null);
  const viewRef = React.useRef<ViewTransform>({ zoom: 1, panX: 0, panY: 0 });
  const panDragRef = React.useRef<null | { startSX: number; startSY: number; startPanX: number; startPanY: number }>(null);
  const isSpaceDownRef = React.useRef<boolean>(false);
  const gridRef = React.useRef<boolean>(false);
  const snapRef = React.useRef<boolean>(false);

  const [tool, setTool] = React.useState<MoodboardTool>('pen');
  const [size, setSize] = React.useState<number>(3);
  const [color, setColor] = React.useState<string>('#111111');
  const [gradientTo, setGradientTo] = React.useState<string>('#ffffff');
  const [gradientAngle, setGradientAngle] = React.useState<number>(0);
  const [gradientMode, setGradientMode] = React.useState<'linear' | 'radial'>('linear');
  const [viewZoom, setViewZoom] = React.useState<number>(1);
  const [showGrid, setShowGrid] = React.useState<boolean>(false);
  const [snapToGrid, setSnapToGrid] = React.useState<boolean>(false);
  const [selectedItem, setSelectedItem] = React.useState<SelectedItem>(null);
  const [showLayers, setShowLayers] = React.useState<boolean>(false);
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
    if (tool !== 'gradient') gradientDragRef.current = null;
  }, [tool]);

  React.useEffect(() => {
    sizeRef.current = size;
  }, [size]);

  React.useEffect(() => {
    colorRef.current = color;
  }, [color]);

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
    if (!selectedItem) return;
    if (selectedItem.kind === 'image') {
      const images = Array.isArray(value.images) ? value.images : [];
      if (!images.some((img) => img && img.id === selectedItem.id)) setSelectedItem(null);
      return;
    }
    const texts = Array.isArray(value.texts) ? value.texts : [];
    if (!texts.some((t) => t && t.id === selectedItem.id)) setSelectedItem(null);
  }, [selectedItem, value.images, value.texts]);

  const redraw = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const current = valueRef.current;
    const images = Array.isArray(current.images) ? current.images : [];
    const texts = Array.isArray(current.texts) ? current.texts : [];
    const strokes = Array.isArray(current.strokes) ? current.strokes : [];
    const selected = selectedItemRef.current;
    const selectedImage = selected?.kind === 'image' ? images.find((img) => img && img.id === selected.id) : null;
    const selectedText = selected?.kind === 'text' ? texts.find((t) => t && t.id === selected.id) : null;
    const selectedAny = selectedImage ?? selectedText;

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

    for (const img of images) {
      if (!img?.imageId) continue;
      if (img.hidden) continue;
      let el = imageCacheRef.current.get(img.imageId);
      if (!el) {
        el = new Image();
        el.crossOrigin = 'anonymous';
        el.src = `ckc://image/${encodeURIComponent(img.imageId)}`;
        el.onload = () => requestAnimationFrame(redraw);
        imageCacheRef.current.set(img.imageId, el);
      }
      if (!el.complete || !el.naturalWidth || !el.naturalHeight) continue;

      const cx = img.x * rect.width;
      const cy = img.y * rect.height;
      const w = img.w * rect.width;
      const h = img.h * rect.height;
      const x = cx - w / 2;
      const y = cy - h / 2;

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
       ctx.drawImage(el, dx, dy, dw, dh);
     }

    const drawTextItem = (t: MoodboardText) => {
      if (!t) return;
      if (t.hidden) return;
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
      ctx.fillStyle = t.bg || 'rgba(253, 245, 230, 0.96)';
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = invZoom;
      ctx.fillRect(left, top, w, h);
      ctx.strokeRect(left + 0.5 * invZoom, top + 0.5 * invZoom, Math.max(0, w - invZoom), Math.max(0, h - invZoom));

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

    for (const t of texts) drawTextItem(t);

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

    if (selectedAny && !selectedAny.hidden) {
      const cx = (Number(selectedAny.x) || 0) * rect.width;
      const cy = (Number(selectedAny.y) || 0) * rect.height;
      const w = (Number(selectedAny.w) || 0) * rect.width;
      const h = (Number(selectedAny.h) || 0) * rect.height;
      const x = cx - w / 2;
      const y = cy - h / 2;
      ctx.save();
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 2 * invZoom;
      ctx.setLineDash([6 * invZoom, 5 * invZoom]);
      ctx.strokeRect(x + invZoom, y + invZoom, Math.max(0, w - 2 * invZoom), Math.max(0, h - 2 * invZoom));
      ctx.restore();

      if (toolRef.current === 'transform') {
        const left = cx - w / 2;
        const right = cx + w / 2;
        const top = cy - h / 2;
        const bottom = cy + h / 2;

        const handleSize = 10 * invZoom;
        const half = handleSize / 2;
        const handles: Array<{ x: number; y: number }> = [
          { x: left, y: top },
          { x: right, y: top },
          { x: right, y: bottom },
          { x: left, y: bottom },
        ];

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
    gradientDragRef.current = null;
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
    gradientDragRef.current = null;
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
    selectedItemRef.current = selectedItem;
    redraw();
  }, [selectedItem, redraw]);

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
        if (currentTool === 'transform') {
          const sel = selectedItemRef.current;
          if (sel) {
            const item =
              sel.kind === 'image'
                ? (current.images || []).find((x) => x && x.id === sel.id)
                : (current.texts || []).find((x) => x && x.id === sel.id);
            if (item && !item.hidden) {
              const rect = canvas.getBoundingClientRect();
              const px = pt.x * rect.width;
              const py = pt.y * rect.height;
              const cx = item.x * rect.width;
              const cy = item.y * rect.height;
              const w = item.w * rect.width;
              const h = item.h * rect.height;
              const left = cx - w / 2;
              const right = cx + w / 2;
              const top = cy - h / 2;
              const bottom = cy + h / 2;

              const hitHandle = ((): ResizeHandle | null => {
                const half = 7 / Math.max(0.25, Math.min(6, Number(viewRef.current.zoom) || 1));
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
                setSelectedItem(sel);
                if (!item.locked) {
                  resizeRef.current = { kind: sel.kind, id: sel.id, handle: hitHandle, startItem: item, startState: current, moved: false };
                  canvas.setPointerCapture(evt.pointerId);
                }
                redraw();
                return;
              }
            }
          }
        }

        const hit = ((): SelectedItem => {
          const texts = Array.isArray(current.texts) ? current.texts : [];
          for (let i = texts.length - 1; i >= 0; i--) {
            const t = texts[i];
            if (!t || t.hidden) continue;
            const w = Number(t.w) || 0;
            const h = Number(t.h) || 0;
            if (w <= 0 || h <= 0) continue;
            const left = (Number(t.x) || 0) - w / 2;
            const right = (Number(t.x) || 0) + w / 2;
            const top = (Number(t.y) || 0) - h / 2;
            const bottom = (Number(t.y) || 0) + h / 2;
            if (pt.x >= left && pt.x <= right && pt.y >= top && pt.y <= bottom) return { kind: 'text', id: t.id };
          }

          const images = Array.isArray(current.images) ? current.images : [];
          for (let i = images.length - 1; i >= 0; i--) {
            const img = images[i];
            if (!img || img.hidden) continue;
            const w = Number(img.w) || 0;
            const h = Number(img.h) || 0;
            if (w <= 0 || h <= 0) continue;
            const left = (Number(img.x) || 0) - w / 2;
            const right = (Number(img.x) || 0) + w / 2;
            const top = (Number(img.y) || 0) - h / 2;
            const bottom = (Number(img.y) || 0) + h / 2;
            if (pt.x >= left && pt.x <= right && pt.y >= top && pt.y <= bottom) return { kind: 'image', id: img.id };
          }
          return null;
        })();

        if (hit == null) {
          setSelectedItem(null);
          redraw();
          return;
        }

        setSelectedItem(hit);
        const item =
          hit.kind === 'image'
            ? (current.images || []).find((x) => x && x.id === hit.id)
            : (current.texts || []).find((x) => x && x.id === hit.id);
        if (!item || item.locked) {
          redraw();
          return;
        }

        dragRef.current = {
          kind: hit.kind,
          id: hit.id,
          offsetX: (Number(item.x) || 0) - pt.x,
          offsetY: (Number(item.y) || 0) - pt.y,
          start: current,
          moved: false,
        };
        canvas.setPointerCapture(evt.pointerId);
        redraw();
        return;
      }

      if (currentTool === 'text') {
        const cur = valueRef.current;
        const id = makeMoodId('mbt_');
        const item: MoodboardText = {
          id,
          x: pt.x,
          y: pt.y,
          w: 0.28,
          h: 0.16,
          text: '',
          fontSize: 18,
          color: colorRef.current,
          bg: '#fdf5e6',
        };
        const next = { ...cur, texts: [...(cur.texts || []), item] };
        commit(next);
        setSelectedItem({ kind: 'text', id });
        setTool('move');
        return;
      }

      if (currentTool === 'bucket') {
        const cur = valueRef.current;
        const next = { ...cur, background: { kind: 'solid' as const, color: colorRef.current } };
        commit(next);
        return;
      }

      if (currentTool === 'gradient') {
        const startState = valueRef.current;
        const angle = Number(gradientAngleRef.current) || 0;
        const mode = gradientModeRef.current;
        gradientDragRef.current = { startPt: pt, startState, moved: false, lastAngle: angle };
        const next: MoodboardState = {
          ...startState,
          background: {
            kind: 'gradient' as const,
            from: colorRef.current,
            to: gradientToRef.current,
            angle,
            mode,
          },
        };
        valueRef.current = next;
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
        const next: MoodboardState = {
          ...gradientDrag.startState,
          background: {
            kind: 'gradient' as const,
            from: colorRef.current,
            to: gradientToRef.current,
            angle,
            mode,
          },
        };
        valueRef.current = next;
        redraw();
        return;
      }

      const resizing = resizeRef.current;
      if (resizing) {
        const pt = pointFromEvent(evt, canvas, viewRef.current);
        const basis = resizing.startItem;
        if (!basis || basis.locked) return;

        const minSize = 0.02;
        const ratio = basis.h > 0 ? basis.w / basis.h : 1;

        const isShift = !!evt.shiftKey;
        const isAlt = !!evt.altKey;

        let nextX = basis.x;
        let nextY = basis.y;
        let nextW = basis.w;
        let nextH = basis.h;

        if (isAlt) {
          let w = Math.abs(pt.x - basis.x) * 2;
          let h = Math.abs(pt.y - basis.y) * 2;
          if (isShift) {
            if (h <= 0) h = minSize;
            if (w / h > ratio) w = h * ratio;
            else h = w / ratio;
          }
          nextW = Math.min(1, Math.max(minSize, w));
          nextH = Math.min(1, Math.max(minSize, h));
          nextX = clamp01(basis.x);
          nextY = clamp01(basis.y);
        } else {
          const ax =
            resizing.handle === 'nw' || resizing.handle === 'sw' ? (basis.x + basis.w / 2) : (basis.x - basis.w / 2);
          const ay =
            resizing.handle === 'nw' || resizing.handle === 'ne' ? (basis.y + basis.h / 2) : (basis.y - basis.h / 2);

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
        if (resizing.kind === 'image') {
          const idx = (cur.images || []).findIndex((x) => x && x.id === resizing.id);
          if (idx < 0) return;
          const img = cur.images[idx];
          if (!img || img.locked) return;
          const changed = img.x !== nextX || img.y !== nextY || img.w !== nextW || img.h !== nextH;
          if (!changed) return;
          const nextImages = cur.images.map((x, i) => (i === idx ? { ...x, x: nextX, y: nextY, w: nextW, h: nextH } : x));
          const next = { ...cur, images: nextImages };
          valueRef.current = next;
          resizing.moved = true;
          redraw();
          return;
        }

        const texts = Array.isArray(cur.texts) ? cur.texts : [];
        const idx = texts.findIndex((x) => x && x.id === resizing.id);
        if (idx < 0) return;
        const t = texts[idx];
        if (!t || t.locked) return;
        const changed = t.x !== nextX || t.y !== nextY || t.w !== nextW || t.h !== nextH;
        if (!changed) return;
        const nextTexts = texts.map((x, i) => (i === idx ? { ...x, x: nextX, y: nextY, w: nextW, h: nextH } : x));
        const next = { ...cur, texts: nextTexts };
        valueRef.current = next;
        resizing.moved = true;
        redraw();
        return;
      }

      const dragging = dragRef.current;
      if (dragging) {
        const pt = pointFromEvent(evt, canvas, viewRef.current);
        const cur = valueRef.current;
        let nextX = clamp01(pt.x + dragging.offsetX);
        let nextY = clamp01(pt.y + dragging.offsetY);

        if (snapRef.current) {
          const rect = canvas.getBoundingClientRect();
          const stepX = rect.width > 0 ? 40 / rect.width : 0;
          const stepY = rect.height > 0 ? 40 / rect.height : 0;
          if (stepX > 0) nextX = clamp01(Math.round(nextX / stepX) * stepX);
          if (stepY > 0) nextY = clamp01(Math.round(nextY / stepY) * stepY);
        }

        if (dragging.kind === 'image') {
          const idx = (cur.images || []).findIndex((x) => x && x.id === dragging.id);
          if (idx < 0) return;
          const img = cur.images[idx];
          if (!img || img.locked) return;
          const changed = img.x !== nextX || img.y !== nextY;
          if (!changed) return;
          const nextImages = cur.images.map((x, i) => (i === idx ? { ...x, x: nextX, y: nextY } : x));
          const next = { ...cur, images: nextImages };
          valueRef.current = next;
          dragging.moved = true;
          redraw();
          return;
        }

        const texts = Array.isArray(cur.texts) ? cur.texts : [];
        const idx = texts.findIndex((x) => x && x.id === dragging.id);
        if (idx < 0) return;
        const t = texts[idx];
        if (!t || t.locked) return;
        const changed = t.x !== nextX || t.y !== nextY;
        if (!changed) return;
        const nextTexts = texts.map((x, i) => (i === idx ? { ...x, x: nextX, y: nextY } : x));
        const next = { ...cur, texts: nextTexts };
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

      const gradientDrag = gradientDragRef.current;
      if (gradientDrag) {
        gradientDragRef.current = null;
        setGradientAngle(gradientDrag.lastAngle);
        commit(valueRef.current, { historyPrev: gradientDrag.startState });
        return;
      }

      const resizing = resizeRef.current;
      if (resizing) {
        resizeRef.current = null;
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
        if (dragging.moved) {
          commit(valueRef.current, { historyPrev: dragging.start });
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

  const selectedText =
    selectedItem?.kind === 'text' ? (Array.isArray(value.texts) ? value.texts.find((t) => t && t.id === selectedItem.id) ?? null : null) : null;

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
          <button className={styles.toolBtn} data-active={showGrid ? '1' : '0'} onClick={toggleGrid} title="Toggle grid overlay">
            Grid
          </button>
          <button className={styles.toolBtn} data-active={snapToGrid ? '1' : '0'} onClick={toggleSnap} title="Snap move/transform to grid">
            Snap
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
            onClick={() => {
              const sel = selectedItemRef.current;
              if (!sel) return;
              const cur = valueRef.current;
              if (sel.kind === 'image') {
                const nextImages = (cur.images || []).filter((img) => img && img.id !== sel.id);
                commit({ ...cur, images: nextImages });
              } else {
                const nextTexts = (cur.texts || []).filter((t) => t && t.id !== sel.id);
                commit({ ...cur, texts: nextTexts });
              }
              setSelectedItem(null);
            }}
            disabled={!selectedItem}
            title="Delete selected item"
          >
            Delete
          </button>

        <label className={styles.toolLabel}>
          Size{' '}
          <input
            type="range"
            min={1}
            max={18}
            value={String(size)}
            onChange={(e) => setSize(Number(e.target.value) || 3)}
            disabled={tool === 'move' || tool === 'transform' || tool === 'text' || tool === 'bucket' || tool === 'gradient'}
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
        {showLayers ? (
          <div className={styles.layersPanel} aria-label="Layers">
            <div className={styles.layersHeader}>Layers</div>
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

            <div className={styles.layersList}>
              {[...(value.images || [])]
                .map((img, idx) => ({ img, idx }))
                .reverse()
                .map(({ img, idx }) => {
                  const isSelected = !!selectedItem && selectedItem.kind === 'image' && img.id === selectedItem.id;
                  return (
                    <div key={img.id} className={styles.layerRow} data-selected={isSelected ? '1' : '0'}>
                      <button
                        className={styles.layerPick}
                        type="button"
                        onClick={() => {
                          setTool('move');
                          setSelectedItem({ kind: 'image', id: img.id });
                        }}
                        title="Select layer"
                      >
                        {img.hidden ? '(hidden)' : 'Image'} {idx + 1}
                      </button>

                      <input
                        className={styles.layerNameInput}
                        value={img.name ?? ''}
                        placeholder="Name"
                        onChange={(e) => {
                          const name = e.target.value;
                          const nextImages = value.images.map((x) => (x.id === img.id ? { ...x, name } : x));
                          applyNoHistory({ ...value, images: nextImages }, { clearRedo: true });
                        }}
                      />

                      <div className={styles.layerActions}>
                        <button
                          className={styles.layerBtn}
                          data-active={img.hidden ? '1' : '0'}
                          onClick={() => {
                            const nextHidden = !img.hidden;
                            const nextImages = value.images.map((x) => (x.id === img.id ? { ...x, hidden: nextHidden } : x));
                            commit({ ...value, images: nextImages });
                            if (nextHidden && selectedItemRef.current?.kind === 'image' && selectedItemRef.current.id === img.id) setSelectedItem(null);
                          }}
                          title={img.hidden ? 'Show layer' : 'Hide layer'}
                          type="button"
                        >
                          {img.hidden ? 'Show' : 'Hide'}
                        </button>

                        <button
                          className={styles.layerBtn}
                          data-active={img.locked ? '1' : '0'}
                          onClick={() => {
                            const nextImages = value.images.map((x) => (x.id === img.id ? { ...x, locked: !img.locked } : x));
                            commit({ ...value, images: nextImages });
                          }}
                          title={img.locked ? 'Unlock layer' : 'Lock layer'}
                          type="button"
                        >
                          {img.locked ? 'Unlock' : 'Lock'}
                        </button>

                        <button
                          className={styles.layerBtn}
                          disabled={idx >= value.images.length - 1}
                          onClick={() => {
                            if (idx >= value.images.length - 1) return;
                            const next = value.images.slice();
                            const t = next[idx];
                            next[idx] = next[idx + 1];
                            next[idx + 1] = t;
                            commit({ ...value, images: next });
                          }}
                          title="Bring forward"
                          type="button"
                        >
                          Up
                        </button>

                        <button
                          className={styles.layerBtn}
                          disabled={idx >= value.images.length - 1}
                          onClick={() => {
                            if (idx >= value.images.length - 1) return;
                            const next = value.images.filter((x) => x.id !== img.id);
                            next.push(img);
                            commit({ ...value, images: next });
                          }}
                          title="Bring to top"
                          type="button"
                        >
                          Top
                        </button>

                        <button
                          className={styles.layerBtn}
                          disabled={idx <= 0}
                          onClick={() => {
                            if (idx <= 0) return;
                            const next = value.images.slice();
                            const t = next[idx];
                            next[idx] = next[idx - 1];
                            next[idx - 1] = t;
                            commit({ ...value, images: next });
                          }}
                          title="Send backward"
                          type="button"
                        >
                          Down
                        </button>

                        <button
                          className={styles.layerBtn}
                          disabled={idx <= 0}
                          onClick={() => {
                            if (idx <= 0) return;
                            const next = value.images.filter((x) => x.id !== img.id);
                            next.unshift(img);
                            commit({ ...value, images: next });
                          }}
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
              <button className={styles.layerBtn} type="button" onClick={() => setSelectedItem(null)} title="Close">
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
        <canvas ref={canvasRef} className={styles.canvas} />
      </div>
    </div>
  );
}
