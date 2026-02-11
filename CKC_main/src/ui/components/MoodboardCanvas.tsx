import React from 'react';
import styles from './moodboardCanvas.module.css';

type MoodboardTool = 'pen' | 'line' | 'arrow' | 'rect' | 'ellipse' | 'eraser' | 'move' | 'bucket' | 'gradient';
type MoodboardDrawTool = 'pen' | 'line' | 'arrow' | 'rect' | 'ellipse' | 'eraser';

export type MoodboardStroke = {
  tool: MoodboardDrawTool;
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
  background?: { kind: 'paper' } | { kind: 'solid'; color: string } | { kind: 'gradient'; from: string; to: string; angle: number };
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
  const dragRef = React.useRef<null | { index: number; offsetX: number; offsetY: number }>(null);
  const valueRef = React.useRef<MoodboardState>(value);
  const toolRef = React.useRef<MoodboardTool>('pen');
  const sizeRef = React.useRef<number>(3);
  const colorRef = React.useRef<string>('#111111');
  const gradientToRef = React.useRef<string>('#ffffff');
  const gradientAngleRef = React.useRef<number>(0);
  const selectedImageIndexRef = React.useRef<number | null>(null);

  const [tool, setTool] = React.useState<MoodboardTool>('pen');
  const [size, setSize] = React.useState<number>(3);
  const [color, setColor] = React.useState<string>('#111111');
  const [gradientTo, setGradientTo] = React.useState<string>('#ffffff');
  const [gradientAngle, setGradientAngle] = React.useState<number>(0);
  const [selectedImageIndex, setSelectedImageIndex] = React.useState<number | null>(null);

  React.useEffect(() => {
    valueRef.current = value;
  }, [value]);

  React.useEffect(() => {
    toolRef.current = tool;
    if (tool !== 'move') dragRef.current = null;
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
    if (selectedImageIndex == null) return;
    if (selectedImageIndex < 0 || selectedImageIndex >= value.images.length) setSelectedImageIndex(null);
  }, [selectedImageIndex, value.images.length]);

  const redraw = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const current = valueRef.current;
    const images = Array.isArray(current.images) ? current.images : [];
    const strokes = Array.isArray(current.strokes) ? current.strokes : [];
    const selectedIndex = selectedImageIndexRef.current;

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

    const bg = current.background;
    if (!bg || bg.kind === 'paper') {
      // White-ish paper surface.
      ctx.fillStyle = 'rgba(253, 245, 230, 0.96)';
      ctx.fillRect(0, 0, rect.width, rect.height);
    } else if (bg.kind === 'solid') {
      ctx.fillStyle = bg.color || 'rgba(253, 245, 230, 0.96)';
      ctx.fillRect(0, 0, rect.width, rect.height);
    } else if (bg.kind === 'gradient') {
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

    for (const img of images) {
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

    if (selectedIndex != null) {
      const sel = images[selectedIndex];
      if (sel) {
        const cx = sel.x * rect.width;
        const cy = sel.y * rect.height;
        const w = sel.w * rect.width;
        const h = sel.h * rect.height;
        const x = cx - w / 2;
        const y = cy - h / 2;
        ctx.save();
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 5]);
        ctx.strokeRect(x + 1, y + 1, Math.max(0, w - 2), Math.max(0, h - 2));
        ctx.restore();
      }
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

    for (const s of strokes) drawStroke(s);
    if (strokeRef.current) drawStroke(strokeRef.current);
  }, []);

  React.useEffect(() => {
    selectedImageIndexRef.current = selectedImageIndex;
    redraw();
  }, [selectedImageIndex, redraw]);

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
      const pt = pointFromEvent(evt, canvas);
      const current = valueRef.current;
      const currentTool = toolRef.current;

      if (currentTool === 'move') {
        const hitIndex = (() => {
          for (let i = (current.images || []).length - 1; i >= 0; i--) {
            const img = current.images[i];
            if (!img) continue;
            const w = Number(img.w) || 0;
            const h = Number(img.h) || 0;
            if (w <= 0 || h <= 0) continue;
            const left = (Number(img.x) || 0) - w / 2;
            const right = (Number(img.x) || 0) + w / 2;
            const top = (Number(img.y) || 0) - h / 2;
            const bottom = (Number(img.y) || 0) + h / 2;
            if (pt.x >= left && pt.x <= right && pt.y >= top && pt.y <= bottom) return i;
          }
          return null;
        })();

        if (hitIndex == null) {
          setSelectedImageIndex(null);
          redraw();
          return;
        }

        setSelectedImageIndex(hitIndex);
        const img = current.images[hitIndex];
        dragRef.current = { index: hitIndex, offsetX: (Number(img.x) || 0) - pt.x, offsetY: (Number(img.y) || 0) - pt.y };
        canvas.setPointerCapture(evt.pointerId);
        redraw();
        return;
      }

      if (currentTool === 'bucket') {
        const cur = valueRef.current;
        const next = { ...cur, background: { kind: 'solid' as const, color: colorRef.current } };
        valueRef.current = next;
        onChange(next);
        redraw();
        return;
      }

      if (currentTool === 'gradient') {
        const cur = valueRef.current;
        const next = {
          ...cur,
          background: {
            kind: 'gradient' as const,
            from: colorRef.current,
            to: gradientToRef.current,
            angle: Number(gradientAngleRef.current) || 0,
          },
        };
        valueRef.current = next;
        onChange(next);
        redraw();
        return;
      }

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
      const dragging = dragRef.current;
      if (dragging) {
        const pt = pointFromEvent(evt, canvas);
        const cur = valueRef.current;
        const img = cur.images[dragging.index];
        if (!img) return;
        const nextX = clamp01(pt.x + dragging.offsetX);
        const nextY = clamp01(pt.y + dragging.offsetY);
        const nextImages = cur.images.map((x, idx) => (idx === dragging.index ? { ...x, x: nextX, y: nextY } : x));
        const next = { ...cur, images: nextImages };
        valueRef.current = next;
        onChange(next);
        redraw();
        return;
      }

      if (!drawingRef.current) return;
      if (!strokeRef.current) return;
      const pt = pointFromEvent(evt, canvas);
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
      if (dragRef.current) {
        dragRef.current = null;
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
        valueRef.current = next;
        onChange(next);
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
  }, [onChange, redraw]);

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <button className={styles.toolBtn} data-active={tool === 'move' ? '1' : '0'} onClick={() => setTool('move')}>
          Move
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
        <button
          className={styles.toolBtn}
          onClick={() => {
            onChange({ ...value, background: undefined });
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
          onClick={() => {
            if (!value.strokes.length) return;
            onChange({ ...value, strokes: value.strokes.slice(0, -1) });
          }}
          disabled={!value.strokes.length}
          title="Undo last stroke"
        >
          Undo stroke
        </button>

        <button
          className={styles.toolBtn}
          onClick={() => {
            if (!value.images.length) return;
            const nextImages = value.images.slice(0, -1);
            onChange({ ...value, images: nextImages });
            setSelectedImageIndex((cur) => (cur != null && cur >= nextImages.length ? null : cur));
          }}
          disabled={!value.images.length}
          title="Remove the most recently added image"
        >
          Undo image
        </button>

        <button
          className={styles.toolBtn}
          onClick={() => {
            if (selectedImageIndex == null) return;
            if (selectedImageIndex < 0 || selectedImageIndex >= value.images.length) return;
            const nextImages = value.images.filter((_, idx) => idx !== selectedImageIndex);
            onChange({ ...value, images: nextImages });
            setSelectedImageIndex(null);
          }}
          disabled={selectedImageIndex == null || selectedImageIndex < 0 || selectedImageIndex >= value.images.length}
          title="Delete selected image"
        >
          Delete image
        </button>

        <label className={styles.toolLabel}>
          Size{' '}
          <input
            type="range"
            min={1}
            max={18}
            value={String(size)}
            onChange={(e) => setSize(Number(e.target.value) || 3)}
            disabled={tool === 'move' || tool === 'bucket' || tool === 'gradient'}
          />
        </label>

        <label className={styles.toolLabel}>
          Color{' '}
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            disabled={tool === 'eraser' || tool === 'move'}
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
            Angle{' '}
            <input
              type="range"
              min={0}
              max={360}
              value={String(gradientAngle)}
              onChange={(e) => setGradientAngle(Number(e.target.value) || 0)}
            />
          </label>
        ) : null}

        <button className={styles.toolBtn} onClick={() => onChange({ ...value, strokes: [] })}>
          Clear strokes
        </button>
      </div>

      <div className={styles.canvasWrap}>
        <canvas ref={canvasRef} className={styles.canvas} />
      </div>
    </div>
  );
}
