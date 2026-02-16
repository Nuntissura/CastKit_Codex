import React from 'react';
import styles from './batchExportDialog.module.css';

function joinPath(a: string, b: string): string {
  const left = String(a || '').replace(/[\\/]+$/, '');
  if (!left) return String(b || '');
  return `${left}\\${String(b || '').replace(/^[\\/]+/, '')}`;
}

function toIsoSafeTimestamp(d: Date): string {
  return d.toISOString().replaceAll(':', '-').replaceAll('.', '-');
}

type ExportMode = 'share_pack' | 'bundle' | 'web_portfolio';

export function BatchExportDialog({
  isOpen,
  characterIds,
  defaultExportsDir,
  onClose,
  onExported,
}: {
  isOpen: boolean;
  characterIds: string[];
  defaultExportsDir: string | null;
  onClose: () => void;
  onExported: (outDir: string | null) => void;
}) {
  const [exportMode, setExportMode] = React.useState<ExportMode>('share_pack');
  const [outDirBase, setOutDirBase] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState<{ done: number; total: number; label: string } | null>(null);
  const cancelRef = React.useRef<{ cancelled: boolean }>({ cancelled: false });

  React.useEffect(() => {
    if (!isOpen) return;
    setExportMode('share_pack');
    setOutDirBase(null);
    setError(null);
    setBusy(false);
    setProgress(null);
    cancelRef.current.cancelled = false;
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (evt: KeyboardEvent) => {
      if (evt.key !== 'Escape') return;
      evt.preventDefault();
      if (!busy) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, isOpen, onClose]);

  if (!isOpen) return null;

  const selectionCount = Array.isArray(characterIds) ? characterIds.length : 0;

  const fallback = String(defaultExportsDir ?? '').trim() || null;
  const base = outDirBase ? outDirBase : fallback;

  const chooseFolder = async () => {
    setError(null);
    try {
      const picked = await window.ckc.selectFolderDialog({ title: 'Select batch export base folder' });
      if (picked) setOutDirBase(String(picked));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const startExport = async () => {
    if (busy) return;
    if (selectionCount === 0) return;
    if (!base) {
      setError('Unable to determine export base folder.');
      return;
    }

    setBusy(true);
    setError(null);
    cancelRef.current.cancelled = false;

    const batchDir = joinPath(base, `batch-${toIsoSafeTimestamp(new Date())}`);

    try {
      if (exportMode === 'web_portfolio') {
        setProgress({ done: 0, total: 1, label: 'Exporting web portfolio…' });
        await window.ckc.exportWebPortfolio({ outDir: batchDir, characterIds, format: 'portfolio', imageMode: 'all', fieldMode: 'safe' });
        onExported(batchDir);
        return;
      }

      for (let i = 0; i < characterIds.length; i++) {
        if (cancelRef.current.cancelled) {
          setError('Export cancelled.');
          return;
        }
        const characterId = String(characterIds[i] ?? '').trim();
        if (!characterId) continue;

        setProgress({ done: i, total: characterIds.length, label: `Exporting ${i + 1}/${characterIds.length}…` });
        const character = await window.ckc.getCharacter(characterId);
        if (!character) continue;

        if (exportMode === 'bundle') {
          await window.ckc.exportBundle({ characterId, outDir: batchDir });
          continue;
        }

        const imageIds = (character.images || []).map((img) => String(img?.id ?? '').trim()).filter(Boolean);
        await window.ckc.exportSharePack({ characterId, outDir: batchDir, includeSheet: true, imageIds });
      }

      setProgress({ done: characterIds.length, total: characterIds.length, label: 'Done.' });
      onExported(batchDir);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      cancelRef.current.cancelled = false;
    }
  };

  const cancel = () => {
    cancelRef.current.cancelled = true;
  };

  const openBase = async () => {
    if (!base) return;
    try {
      await window.ckc.openPath(base);
    } catch {
      // ignore
    }
  };

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label="Batch export"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className={styles.panel} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <div className={styles.title}>Batch export</div>
            <div className={styles.subtitle}>{selectionCount} character(s) selected</div>
          </div>
          <button className={styles.closeBtn} type="button" onClick={onClose} disabled={busy}>
            Close
          </button>
        </div>

        <div className={styles.body}>
          {error ? <div className={styles.error}>{error}</div> : null}
          {progress ? (
            <div className={styles.progress}>
              <div className={styles.progressTop}>
                <div className={styles.progressLabel}>{progress.label}</div>
                <div className={styles.progressNums}>
                  {progress.done}/{progress.total}
                </div>
              </div>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{
                    width: `${progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>
          ) : null}

          <div className={styles.row}>
            <div className={styles.label}>Mode</div>
            <div className={styles.opRow}>
              <button
                type="button"
                className={styles.opBtn}
                data-active={exportMode === 'share_pack' ? '1' : '0'}
                onClick={() => setExportMode('share_pack')}
                disabled={busy}
                title="Exports one share pack per character (sheet + images)"
              >
                Share packs
              </button>
              <button
                type="button"
                className={styles.opBtn}
                data-active={exportMode === 'bundle' ? '1' : '0'}
                onClick={() => setExportMode('bundle')}
                disabled={busy}
                title="Exports per-character bundles (txt + md + pdf)"
              >
                Bundles
              </button>
              <button
                type="button"
                className={styles.opBtn}
                data-active={exportMode === 'web_portfolio' ? '1' : '0'}
                onClick={() => setExportMode('web_portfolio')}
                disabled={busy}
                title="Exports a single static HTML portfolio for the selection"
              >
                Web portfolio
              </button>
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.label}>Base folder</div>
            <div className={styles.baseRow}>
              <div className={styles.basePath}>
                {base ? (
                  <>
                    <code>{base}</code>
                    <div className={styles.muted}>Batch exports will be created under a new `batch-…` subfolder.</div>
                  </>
                ) : (
                  <span className={styles.muted}>(unknown)</span>
                )}
              </div>
              <div className={styles.baseButtons}>
                <button type="button" onClick={chooseFolder} disabled={busy}>
                  Choose…
                </button>
                <button type="button" onClick={() => setOutDirBase(null)} disabled={busy || !outDirBase}>
                  Reset
                </button>
                <button type="button" onClick={openBase} disabled={!base}>
                  Open
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          {busy ? (
            <button type="button" onClick={cancel}>
              Cancel
            </button>
          ) : null}
          <button type="button" onClick={startExport} disabled={busy || selectionCount === 0 || !base}>
            Start export
          </button>
          <button type="button" onClick={onClose} disabled={busy}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
