import React from 'react';
import styles from './bulkTagDialog.module.css';

function tagsTextToArray(text: string): string[] {
  const parts = String(text || '')
    .split(/[,\n\r\t]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return Array.from(new Set(parts));
}

function dedupeTagsCaseInsensitive(tags: string[]): string[] {
  const cleaned = (tags || []).map((t) => String(t).trim()).filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of cleaned) {
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

function canonicalizeTags(raw: string[], allTags: string[]): string[] {
  const byLower = new Map<string, string>();
  for (const t of allTags || []) {
    const s = String(t ?? '').trim();
    if (!s) continue;
    const k = s.toLowerCase();
    if (!byLower.has(k)) byLower.set(k, s);
  }

  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of raw || []) {
    const s = String(t ?? '').trim();
    if (!s) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(byLower.get(k) ?? s);
  }
  return out;
}

export function BulkTagDialog({
  isOpen,
  characterIds,
  allTags,
  onClose,
  onApplied,
}: {
  isOpen: boolean;
  characterIds: string[];
  allTags: string[];
  onClose: () => void;
  onApplied: () => void;
}) {
  const [addDraft, setAddDraft] = React.useState<string>('');
  const [removeDraft, setRemoveDraft] = React.useState<string>('');
  const [busy, setBusy] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const tagsDatalistId = React.useId();

  React.useEffect(() => {
    if (!isOpen) return;
    setAddDraft('');
    setRemoveDraft('');
    setBusy(false);
    setError(null);
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

  const addTagsRaw = React.useMemo(() => dedupeTagsCaseInsensitive(tagsTextToArray(addDraft)), [addDraft]);
  const removeTagsRaw = React.useMemo(() => dedupeTagsCaseInsensitive(tagsTextToArray(removeDraft)), [removeDraft]);
  const addTags = React.useMemo(() => canonicalizeTags(addTagsRaw, allTags), [addTagsRaw, allTags]);
  const removeTags = React.useMemo(() => canonicalizeTags(removeTagsRaw, allTags), [removeTagsRaw, allTags]);

  const canApply = !busy && selectionCount > 0 && (addTags.length > 0 || removeTags.length > 0);

  const apply = async () => {
    if (!canApply) return;
    setBusy(true);
    setError(null);
    try {
      await window.ckc.batchUpdateCharacterTags({ characterIds, addTags, removeTags });
      onApplied();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label="Bulk tag characters"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className={styles.panel} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <div className={styles.title}>Bulk tag</div>
            <div className={styles.subtitle}>{selectionCount} character(s) selected</div>
          </div>
          <button className={styles.closeBtn} type="button" onClick={onClose} disabled={busy}>
            Close
          </button>
        </div>

        <div className={styles.body}>
          {error ? <div className={styles.error}>{error}</div> : null}

          <div className={styles.hint}>Adds/removes manual character tags. Derived tags remain unchanged.</div>

          <div className={styles.row}>
            <div className={styles.label}>Add</div>
            <div className={styles.inputWrap}>
              <input
                className={styles.input}
                value={addDraft}
                onChange={(e) => setAddDraft(e.target.value)}
                placeholder="tag1, tag2, …"
                list={tagsDatalistId}
                disabled={busy}
              />
              <div className={styles.preview}>
                {addTags.length > 0 ? (
                  <>
                    Will add: <code>{addTags.join(', ')}</code>
                  </>
                ) : (
                  <span className={styles.muted}>(no tags to add)</span>
                )}
              </div>
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.label}>Remove</div>
            <div className={styles.inputWrap}>
              <input
                className={styles.input}
                value={removeDraft}
                onChange={(e) => setRemoveDraft(e.target.value)}
                placeholder="tag1, tag2, …"
                list={tagsDatalistId}
                disabled={busy}
              />
              <div className={styles.preview}>
                {removeTags.length > 0 ? (
                  <>
                    Will remove: <code>{removeTags.join(', ')}</code>
                  </>
                ) : (
                  <span className={styles.muted}>(no tags to remove)</span>
                )}
              </div>
            </div>
          </div>

          <datalist id={tagsDatalistId}>
            {(allTags || []).map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>

        <div className={styles.footer}>
          <button type="button" onClick={apply} disabled={!canApply}>
            Apply
          </button>
          <button type="button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

