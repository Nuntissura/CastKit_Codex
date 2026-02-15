import React from 'react';
import styles from './referenceWindowView.module.css';

function safeString(v: unknown): string {
  return v == null ? '' : String(v);
}

export function ReferenceWindowView() {
  const [imageId, setImageId] = React.useState<string | null>(null);
  const [alwaysOnTop, setAlwaysOnTop] = React.useState<boolean>(false);
  const [clickThrough, setClickThrough] = React.useState<boolean>(false);
  const [opacity, setOpacity] = React.useState<number>(1);
  const [error, setError] = React.useState<string | null>(null);
  const [reloadToken, setReloadToken] = React.useState<number>(0);

  React.useEffect(() => {
    window.ckc
      .getReferenceWindowState()
      .then((st: any) => {
        setImageId(typeof st?.imageId === 'string' ? st.imageId : null);
        setAlwaysOnTop(!!st?.alwaysOnTop);
        setClickThrough(!!st?.clickThrough);
        if (typeof st?.opacity === 'number' && Number.isFinite(st.opacity)) setOpacity(st.opacity);
      })
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    const unsubSel = window.ckc.onReferenceSelection((payload: any) => {
      const id = typeof payload?.imageId === 'string' ? payload.imageId : null;
      setImageId(id);
      setReloadToken((n) => n + 1);
    });

    const unsubState = window.ckc.onReferenceWindowState((payload: any) => {
      if (payload && typeof payload.alwaysOnTop === 'boolean') setAlwaysOnTop(!!payload.alwaysOnTop);
      if (payload && typeof payload.clickThrough === 'boolean') setClickThrough(!!payload.clickThrough);
      if (payload && typeof payload.opacity === 'number' && Number.isFinite(payload.opacity)) setOpacity(payload.opacity);
    });

    return () => {
      try {
        unsubSel?.();
      } catch {
        // ignore
      }
      try {
        unsubState?.();
      } catch {
        // ignore
      }
    };
  }, []);

  const toggleAlwaysOnTop = React.useCallback(async () => {
    const next = !alwaysOnTop;
    setAlwaysOnTop(next);
    setError(null);
    try {
      await window.ckc.setReferenceWindowOptions({ alwaysOnTop: next });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : safeString(err));
    }
  }, [alwaysOnTop]);

  const toggleClickThrough = React.useCallback(async () => {
    const next = !clickThrough;
    setClickThrough(next);
    setError(null);
    try {
      await window.ckc.setReferenceWindowOptions({ clickThrough: next });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : safeString(err));
    }
  }, [clickThrough]);

  const setOpacityLive = React.useCallback(async (nextRaw: number) => {
    const next = Math.max(0.15, Math.min(1, Number(nextRaw) || 1));
    setOpacity(next);
    setError(null);
    try {
      await window.ckc.setReferenceWindowOptions({ opacity: next });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : safeString(err));
    }
  }, []);

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.title}>Reference</div>
        <div className={styles.headerRight}>
          <button className={styles.btn} data-active={alwaysOnTop ? '1' : '0'} onClick={() => void toggleAlwaysOnTop()}>
            Always on top
          </button>
          <button
            className={styles.btn}
            data-active={clickThrough ? '1' : '0'}
            onClick={() => void toggleClickThrough()}
            title="Hotkey: Ctrl/Cmd+Alt+T"
          >
            Click-through
          </button>
          <div className={styles.opacityGroup} title="Opacity">
            <span className={styles.opacityLabel}>Opacity</span>
            <input
              className={styles.opacitySlider}
              type="range"
              min={0.15}
              max={1}
              step={0.01}
              value={String(opacity)}
              onChange={(e) => void setOpacityLive(Number(e.target.value))}
            />
            <span className={styles.opacityValue}>{Math.round(opacity * 100)}%</span>
          </div>
          <button
            className={styles.btn}
            onClick={() => {
              try {
                void window.ckc.closeReferenceWindow();
              } catch {
                window.close();
              }
            }}
          >
            Close
          </button>
        </div>
      </div>

      {error ? <div className={styles.error}>{error}</div> : null}
      {clickThrough ? (
        <div className={styles.hint} role="status">
          Click-through is ON. Use hotkey <b>Ctrl/Cmd+Alt+T</b> to toggle it off.
        </div>
      ) : null}

      <div className={styles.body}>
        {imageId ? (
          <img
            className={styles.img}
            src={`ckc://image/${encodeURIComponent(imageId)}?r=${reloadToken}`}
            alt=""
            onError={() => setError('Failed to load image (missing file or invalid media).')}
          />
        ) : (
          <div className={styles.placeholder}>No image selected in the main window.</div>
        )}
      </div>
    </div>
  );
}
