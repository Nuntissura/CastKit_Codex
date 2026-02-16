import React from 'react';
import styles from './bulkFieldEditDialog.module.css';

type FieldOption = { id: string; label: string };

function isProtectedFieldId(fieldId: string, protectedIds: Set<string>): boolean {
  const fid = String(fieldId ?? '').trim();
  if (!fid) return true;
  if (fid === 'CHAR-ID-001') return true;
  return protectedIds.has(fid);
}

function buildFieldOptions(details: Array<CKCTemplateDetail | null>, protectedIds: Set<string>): FieldOption[] {
  const map = new Map<string, string>();

  for (const d of details) {
    const ast = d?.ast ?? null;
    if (!ast) continue;
    for (const section of ast.sections || []) {
      for (const f of section.fields || []) {
        const fid = String(f?.id ?? '').trim();
        if (!fid) continue;
        if (f.type === 'rule') continue;
        if (isProtectedFieldId(fid, protectedIds)) continue;
        if (!map.has(fid)) map.set(fid, String(f.label ?? ''));
      }
    }
  }

  return Array.from(map.entries())
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function BulkFieldEditDialog({
  isOpen,
  characterIds,
  onClose,
  onApplied,
}: {
  isOpen: boolean;
  characterIds: string[];
  onClose: () => void;
  onApplied: () => void;
}) {
  const [fieldOptions, setFieldOptions] = React.useState<FieldOption[]>([]);
  const [fieldId, setFieldId] = React.useState<string>('');
  const [operation, setOperation] = React.useState<'set' | 'append' | 'clear'>('set');
  const [valueText, setValueText] = React.useState<string>('');
  const [busy, setBusy] = React.useState<boolean>(false);
  const [loadingFields, setLoadingFields] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [resultSummary, setResultSummary] = React.useState<string | null>(null);
  const fieldSelectId = React.useId();
  const valueId = React.useId();

  React.useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setResultSummary(null);
    setBusy(false);
    setLoadingFields(true);

    let cancelled = false;
    const run = async () => {
      try {
        const protectedGlobal = await window.ckc.listProtectedFieldIdsGlobal();
        const protectedIds = new Set((protectedGlobal || []).map((x: any) => String(x ?? '').trim()).filter(Boolean));
        protectedIds.add('CHAR-ID-001');

        const templates = await window.ckc.listTemplates();
        const ids = (templates || [])
          .map((t: any) => String(t?.id ?? '').trim())
          .filter(Boolean);
        const details = await Promise.all(ids.map((tid) => window.ckc.getTemplateDetail(tid)));
        const options = buildFieldOptions(details, protectedIds);
        if (cancelled) return;
        setFieldOptions(options);
        setFieldId((prev) => (prev && options.some((o) => o.id === prev) ? prev : options[0]?.id ?? ''));
      } catch (err: unknown) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setFieldOptions([]);
        setFieldId('');
      } finally {
        if (cancelled) return;
        setLoadingFields(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;
    setOperation('set');
    setValueText('');
  }, [isOpen, fieldId]);

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

  const canApply = !busy && !loadingFields && selectionCount > 0 && !!fieldId && (operation === 'clear' || valueText.trim().length > 0);

  const apply = async () => {
    if (!canApply) return;
    setBusy(true);
    setError(null);
    setResultSummary(null);
    try {
      const res: any = await window.ckc.batchUpdateCharacterField({
        characterIds,
        fieldId,
        operation,
        valueText,
      });
      const updated = Number(res?.updated) || 0;
      const skipped = Array.isArray(res?.skipped) ? res.skipped.length : 0;
      const errors = Array.isArray(res?.errors) ? res.errors.length : 0;
      setResultSummary(`Updated ${updated}. Skipped ${skipped}. Errors ${errors}.`);
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
      aria-label="Bulk edit fields"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className={styles.panel} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <div className={styles.title}>Bulk edit fields</div>
            <div className={styles.subtitle}>{selectionCount} character(s) selected</div>
          </div>
          <button className={styles.closeBtn} type="button" onClick={onClose} disabled={busy}>
            Close
          </button>
        </div>

        <div className={styles.body}>
          {error ? <div className={styles.error}>{error}</div> : null}
          {resultSummary ? <div className={styles.result}>{resultSummary}</div> : null}

          <div className={styles.row}>
            <label className={styles.label} htmlFor={fieldSelectId}>
              Field ID
            </label>
            <select
              id={fieldSelectId}
              className={styles.control}
              value={fieldId}
              onChange={(e) => setFieldId(e.target.value)}
              disabled={busy || loadingFields}
            >
              {loadingFields ? <option value="">Loading…</option> : null}
              {!loadingFields && fieldOptions.length === 0 ? <option value="">(No editable fields found)</option> : null}
              {!loadingFields
                ? fieldOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.id}
                      {o.label ? ` — ${o.label}` : ''}
                    </option>
                  ))
                : null}
            </select>
          </div>

          <div className={styles.row}>
            <label className={styles.label}>Operation</label>
            <div className={styles.opRow}>
              <button
                type="button"
                className={styles.opBtn}
                data-active={operation === 'set' ? '1' : '0'}
                onClick={() => setOperation('set')}
                disabled={busy}
              >
                Set
              </button>
              <button
                type="button"
                className={styles.opBtn}
                data-active={operation === 'append' ? '1' : '0'}
                onClick={() => setOperation('append')}
                disabled={busy}
              >
                Append
              </button>
              <button
                type="button"
                className={styles.opBtn}
                data-active={operation === 'clear' ? '1' : '0'}
                onClick={() => setOperation('clear')}
                disabled={busy}
              >
                Clear
              </button>
            </div>
          </div>

          <div className={styles.row}>
            <label className={styles.label} htmlFor={valueId}>
              Value
            </label>
            <textarea
              id={valueId}
              className={styles.textarea}
              value={valueText}
              onChange={(e) => setValueText(e.target.value)}
              placeholder={operation === 'clear' ? '(not used for Clear)' : 'Enter the value to apply…'}
              disabled={busy || operation === 'clear'}
              rows={5}
            />
          </div>

          <div className={styles.preview}>This will update {selectionCount} character(s).</div>
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

