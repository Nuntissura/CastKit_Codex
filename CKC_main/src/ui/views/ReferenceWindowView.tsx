import React from 'react';
import styles from './referenceWindowView.module.css';

function safeString(v: unknown): string {
  return v == null ? '' : String(v);
}

export function ReferenceWindowView() {
  const [imageId, setImageId] = React.useState<string | null>(null);
  const [alwaysOnTop, setAlwaysOnTop] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [reloadToken, setReloadToken] = React.useState<number>(0);

  React.useEffect(() => {
    window.ckc
      .getReferenceWindowState()
      .then((st: any) => {
        setImageId(typeof st?.imageId === 'string' ? st.imageId : null);
        setAlwaysOnTop(!!st?.alwaysOnTop);
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

