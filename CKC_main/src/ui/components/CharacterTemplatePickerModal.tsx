import React from 'react';
import styles from './characterTemplatePickerModal.module.css';

function fmtCount(n: number, label: string) {
  const x = Number(n) || 0;
  return `${x} ${label}${x === 1 ? '' : 's'}`;
}

export function CharacterTemplatePickerModal({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (characterId: string) => void;
}) {
  const [busy, setBusy] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [templates, setTemplates] = React.useState<CKCCharacterTemplateListItem[]>([]);
  const [selectedId, setSelectedId] = React.useState<string>('');
  const [count, setCount] = React.useState<number>(1);
  const [includeImages, setIncludeImages] = React.useState<boolean>(true);
  const [numberNames, setNumberNames] = React.useState<boolean>(true);

  React.useEffect(() => {
    if (!isOpen) return;
    setBusy(false);
    setError(null);
    setTemplates([]);
    setSelectedId('');
    setCount(1);
    setIncludeImages(true);
    setNumberNames(true);

    window.ckc
      .listCharacterTemplates()
      .then((rows) => setTemplates(Array.isArray(rows) ? rows : []))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, [isOpen]);

  const selected = React.useMemo(
    () => templates.find((t) => String(t.id) === String(selectedId)) || null,
    [selectedId, templates]
  );

  React.useEffect(() => {
    if (!isOpen) return;
    if (!selected) return;
    setIncludeImages((selected.imageCount || 0) > 0);
  }, [isOpen, selected]);

  const create = async () => {
    if (!selected || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await window.ckc.createCharactersFromTemplate({
        templateId: selected.id,
        count,
        includeImages,
        numberNames,
      });
      const first = res?.created?.find((c) => c?.characterId)?.characterId ?? null;
      if (!first) throw new Error('No characters created');
      onCreated(first);
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
      aria-label="New character from template"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
      }}
    >
      <div className={styles.panel} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.title}>New from template</div>
          <div style={{ flex: 1 }} />
          <button className={styles.closeBtn} type="button" onClick={onClose}>
            Close
          </button>
        </div>

        {error ? <div className={styles.error}>{error}</div> : null}

        <div className={styles.body}>
          <div className={styles.list}>
            {templates.length === 0 ? <div className={styles.muted}>No templates found.</div> : null}
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                className={styles.item}
                data-active={selectedId === t.id ? '1' : '0'}
                onClick={() => setSelectedId(t.id)}
                title={t.isBuiltIn ? 'Built-in template' : 'User template'}
              >
                <div className={styles.itemTop}>
                  <div className={styles.itemName}>{t.name || t.id}</div>
                  <div className={styles.badges}>
                    {t.isBuiltIn ? <span className={styles.badge}>Built-in</span> : <span className={styles.badge}>User</span>}
                  </div>
                </div>
                {t.description ? <div className={styles.itemDesc}>{t.description}</div> : null}
                <div className={styles.itemMeta}>
                  {fmtCount(t.fieldCount, 'field')} • {fmtCount(t.imageCount, 'image')}
                </div>
              </button>
            ))}
          </div>

          <div className={styles.detail}>
            {!selected ? (
              <div className={styles.muted}>Select a template to see options.</div>
            ) : (
              <>
                <div className={styles.detailTitle}>{selected.name || selected.id}</div>
                {selected.description ? <div className={styles.detailDesc}>{selected.description}</div> : null}

                <div className={styles.options}>
                  <label className={styles.optionRow}>
                    <span>Count</span>
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={String(count)}
                      onChange={(e) => setCount(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
                      disabled={busy}
                    />
                  </label>

                  <label className={styles.optionRow}>
                    <span>Include images</span>
                    <input
                      type="checkbox"
                      checked={includeImages}
                      onChange={(e) => setIncludeImages(e.target.checked)}
                      disabled={busy || (selected.imageCount || 0) === 0}
                    />
                  </label>

                  <label className={styles.optionRow}>
                    <span>Number names</span>
                    <input
                      type="checkbox"
                      checked={numberNames}
                      onChange={(e) => setNumberNames(e.target.checked)}
                      disabled={busy || count <= 1}
                    />
                  </label>
                </div>

                <div className={styles.footer}>
                  <button type="button" className={styles.createBtn} onClick={() => void create()} disabled={!selected || busy}>
                    {busy ? 'Creating…' : 'Create'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

