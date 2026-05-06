import React from 'react';
import styles from './helpModal.module.css';

type Format = 'markdown' | 'json' | 'index';

type ManualEnvelope = {
  ok?: boolean;
  manualVersion?: string;
  markdown?: string;
  index?: unknown[];
  // For JSON, the full manual shape spreads over additional keys.
  [key: string]: unknown;
};

export function HelpModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [format, setFormat] = React.useState<Format>('markdown');
  const [data, setData] = React.useState<ManualEnvelope | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const ckc = (window as any).ckc;
    if (!ckc?.automationGetManual) {
      setError('automationGetManual not available on the preload bridge.');
      setLoading(false);
      return;
    }
    ckc
      .automationGetManual({ format })
      .then((res: ManualEnvelope) => {
        if (cancelled) return;
        setData(res);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, format]);

  React.useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const version = typeof data?.manualVersion === 'string' ? data.manualVersion : '';

  let bodyText: string;
  if (loading) {
    bodyText = 'Loading manual…';
  } else if (error) {
    bodyText = '';
  } else if (format === 'markdown') {
    bodyText = typeof data?.markdown === 'string' ? data.markdown : 'No markdown returned.';
  } else if (format === 'index') {
    bodyText = JSON.stringify(data?.index ?? null, null, 2);
  } else {
    bodyText = JSON.stringify(data ?? null, null, 2);
  }

  return (
    <div
      className={styles.backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="LLM Operator Manual"
    >
      <div className={styles.panel}>
        <div className={styles.header}>
          <div className={styles.title}>LLM / Operator Manual</div>
          <div className={styles.tabs}>
            <button
              className={styles.tab}
              data-active={format === 'markdown' ? '1' : '0'}
              onClick={() => setFormat('markdown')}
              type="button"
            >
              Markdown
            </button>
            <button
              className={styles.tab}
              data-active={format === 'index' ? '1' : '0'}
              onClick={() => setFormat('index')}
              type="button"
            >
              Index
            </button>
            <button
              className={styles.tab}
              data-active={format === 'json' ? '1' : '0'}
              onClick={() => setFormat('json')}
              type="button"
            >
              JSON
            </button>
          </div>
          <div className={styles.subtitle}>{version ? `v${version}` : ''}</div>
          <button className={styles.close} type="button" aria-label="Close help" onClick={onClose}>
            ×
          </button>
        </div>
        <div className={styles.body}>
          {error ? (
            <div className={styles.error}>Failed to load manual: {error}</div>
          ) : !bodyText ? (
            <div className={styles.empty}>No content.</div>
          ) : (
            <pre className={styles.pre}>{bodyText}</pre>
          )}
        </div>
      </div>
    </div>
  );
}
