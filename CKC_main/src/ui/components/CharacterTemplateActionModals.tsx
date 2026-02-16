import React from 'react';
import styles from './simpleModal.module.css';

export function SaveCharacterTemplateModal({
  isOpen,
  onClose,
  characterId,
  defaultName,
}: {
  isOpen: boolean;
  onClose: () => void;
  characterId: string;
  defaultName: string;
}) {
  const [busy, setBusy] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [name, setName] = React.useState<string>('');
  const [description, setDescription] = React.useState<string>('');
  const [includeImages, setIncludeImages] = React.useState<boolean>(false);
  const [overwrite, setOverwrite] = React.useState<boolean>(true);

  React.useEffect(() => {
    if (!isOpen) return;
    setBusy(false);
    setError(null);
    setName(String(defaultName || '').trim() || 'Template');
    setDescription('');
    setIncludeImages(false);
    setOverwrite(true);
  }, [defaultName, isOpen]);

  const save = async () => {
    if (!characterId || busy) return;
    setBusy(true);
    setError(null);
    try {
      await window.ckc.saveCharacterTemplateFromCharacter({
        characterId,
        name,
        description,
        includeImages,
        overwrite,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label="Save character as template"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.panel} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.title}>Save as template</div>
          <div style={{ flex: 1 }} />
          <button className={styles.closeBtn} type="button" onClick={onClose}>
            Close
          </button>
        </div>

        {error ? <div className={styles.error}>{error}</div> : null}

        <div className={styles.body}>
          <label className={styles.field}>
            <div className={styles.label}>Template name</div>
            <input value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
          </label>

          <label className={styles.field}>
            <div className={styles.label}>Description (optional)</div>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={busy} rows={3} />
          </label>

          <label className={styles.checkRow}>
            <input type="checkbox" checked={includeImages} onChange={(e) => setIncludeImages(e.target.checked)} disabled={busy} />
            Include reference images (copies current character images)
          </label>

          <label className={styles.checkRow}>
            <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} disabled={busy} />
            Overwrite existing template if it exists
          </label>
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.primaryBtn} onClick={() => void save()} disabled={busy || !name.trim().length}>
            {busy ? 'Saving…' : 'Save template'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function CloneCharacterModal({
  isOpen,
  onClose,
  sourceCharacterId,
  defaultDisplayName,
  onCloned,
}: {
  isOpen: boolean;
  onClose: () => void;
  sourceCharacterId: string;
  defaultDisplayName: string;
  onCloned: (characterId: string) => void;
}) {
  const [busy, setBusy] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [displayName, setDisplayName] = React.useState<string>('');
  const [includeImages, setIncludeImages] = React.useState<boolean>(true);

  React.useEffect(() => {
    if (!isOpen) return;
    setBusy(false);
    setError(null);
    setDisplayName(String(defaultDisplayName || '').trim() || 'Clone');
    setIncludeImages(true);
  }, [defaultDisplayName, isOpen]);

  const clone = async () => {
    if (!sourceCharacterId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await window.ckc.cloneCharacter({ sourceCharacterId, includeImages, displayName });
      const newId = String(res?.characterId ?? '').trim();
      if (!newId) throw new Error('Clone failed');
      onCloned(newId);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label="Clone character"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.panel} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.title}>Clone character</div>
          <div style={{ flex: 1 }} />
          <button className={styles.closeBtn} type="button" onClick={onClose}>
            Close
          </button>
        </div>

        {error ? <div className={styles.error}>{error}</div> : null}

        <div className={styles.body}>
          <label className={styles.field}>
            <div className={styles.label}>New character name</div>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} disabled={busy} />
          </label>

          <label className={styles.checkRow}>
            <input type="checkbox" checked={includeImages} onChange={(e) => setIncludeImages(e.target.checked)} disabled={busy} />
            Clone with images (copies image files + metadata)
          </label>
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.primaryBtn} onClick={() => void clone()} disabled={busy || !displayName.trim().length}>
            {busy ? 'Cloning…' : 'Clone'}
          </button>
        </div>
      </div>
    </div>
  );
}

