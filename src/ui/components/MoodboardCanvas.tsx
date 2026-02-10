import React from 'react';
import styles from './moodboardCanvas.module.css';

export type MoodboardStroke = {
  tool: 'pen' | 'eraser';
  color: string;
  size: number;
  points: Array<{ x: number; y: number }>; // normalized 0..1
};

export type MoodboardImage = {
  imageId: string;
  x: number; // normalized center x
  y: number; // normalized center y
  w: number; // normalized width
  h: number; // normalized height
};

export type MoodboardState = {
  version: 1;
  strokes: MoodboardStroke[];
  images: MoodboardImage[];
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function pointFromEvent(evt: PointerEvent, canvas: HTMLCanvasElement): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const x = rect.width > 0 ? (evt.clientX - rect.left) / rect.width : 0;
  const y = rect.height > 0 ? (evt.clientY - rect.top) / rect.height : 0;
  return { x: clamp01(x), y: clamp01(y) };
}

export function MoodboardCanvas({
  value,
  onChange,
  onRequestAddImage,
}: {
  value: MoodboardState;
  onChange: (next: MoodboardState) => void;
  onRequestAddImage?: () => void;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const drawingRef = React.useRef<boolean>(false);
  const strokeRef = React.useRef<MoodboardStroke | null>(null);
  const imageCacheRef = React.useRef<Map<string, HTMLImageElement>>(new Map());

  const [tool, setTool] = React.useState<'pen' | 'eraser'>('pen');
  const [size, setSize] = React.useState<number>(3);
  const [color, setColor] = React.useState<string>('#111111');

  const redraw = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

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

    // White-ish paper surface.
    ctx.fillStyle = 'rgba(253, 245, 230, 0.96)';
    ctx.fillRect(0, 0, rect.width, rect.height);

    for (const img of value.images) {
      if (!img?.imageId) continue;
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

    const drawStroke = (s: MoodboardStroke) => {
      if (!s.points.length) return;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(1, s.size);
      if (s.tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = s.color || '#111111';
      }
      ctx.beginPath();
      const first = s.points[0];
      ctx.moveTo(first.x * rect.width, first.y * rect.height);
      for (const p of s.points.slice(1)) ctx.lineTo(p.x * rect.width, p.y * rect.height);
      ctx.stroke();
      ctx.restore();
    };

    for (const s of value.strokes) drawStroke(s);
    if (strokeRef.current) drawStroke(strokeRef.current);
  }, [value.images, value.strokes]);

  React.useEffect(() => {
    redraw();
  }, [redraw]);

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
      drawingRef.current = true;
      canvas.setPointerCapture(evt.pointerId);
      strokeRef.current = {
        tool,
        size,
        color,
        points: [pointFromEvent(evt, canvas)],
      };
      redraw();
    };

    const onPointerMove = (evt: PointerEvent) => {
      if (!drawingRef.current) return;
      if (!strokeRef.current) return;
      strokeRef.current.points.push(pointFromEvent(evt, canvas));
      redraw();
    };

    const endStroke = () => {
      if (!drawingRef.current) return;
      drawingRef.current = false;
      const done = strokeRef.current;
      strokeRef.current = null;
      if (done && done.points.length > 1) {
        onChange({ ...value, strokes: [...value.strokes, done] });
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
  }, [tool, size, color, value, onChange, redraw]);

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <button className={styles.toolBtn} data-active={tool === 'pen' ? '1' : '0'} onClick={() => setTool('pen')}>
          Pen
        </button>
        <button className={styles.toolBtn} data-active={tool === 'eraser' ? '1' : '0'} onClick={() => setTool('eraser')}>
          Eraser
        </button>

        {onRequestAddImage ? (
          <button className={styles.toolBtn} onClick={onRequestAddImage}>
            Add image
          </button>
        ) : null}

        <label className={styles.toolLabel}>
          Size{' '}
          <input
            type="range"
            min={1}
            max={18}
            value={String(size)}
            onChange={(e) => setSize(Number(e.target.value) || 3)}
          />
        </label>

        <label className={styles.toolLabel}>
          Color <input type="color" value={color} onChange={(e) => setColor(e.target.value)} disabled={tool === 'eraser'} />
        </label>

        <button className={styles.toolBtn} onClick={() => onChange({ ...value, strokes: [] })}>
          Clear
        </button>
      </div>

      <div className={styles.canvasWrap}>
        <canvas ref={canvasRef} className={styles.canvas} />
      </div>
    </div>
  );
}
