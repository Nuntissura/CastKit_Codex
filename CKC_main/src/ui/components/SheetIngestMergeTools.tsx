import React from 'react';
import styles from './sheetMergeTools.module.css';
import { SheetFieldChangePicker } from './SheetFieldChangePicker';

export function SheetIngestMergeTools({
  characterId,
  isSheetDirty,
  onCharacterRefreshed,
}: {
  characterId: string;
  isSheetDirty: boolean;
  onCharacterRefreshed: (next: CKCCharacter) => void;
}) {
  const [inputText, setInputText] = React.useState<string>('');
  const [sourcePath, setSourcePath] = React.useState<string | null>(null);
  const [previewText, setPreviewText] = React.useState<string | null>(null);

  const [preview, setPreview] = React.useState<CKCSheetIngestPreviewResult | null>(null);
  const [selectedFieldIds, setSelectedFieldIds] = React.useState<Set<string>>(new Set());

  const [isBusy, setIsBusy] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [applyIssues, setApplyIssues] = React.useState<CKCValidationIssue[] | null>(null);

  const loadFromFile = async () => {
    setError(null);
    try {
      const res = await window.ckc.openTextFileDialog({ title: 'Import sheet block (txt/md)' });
      if (!res) return;
      setSourcePath(res.path);
      setInputText(res.text ?? '');
      setPreview(null);
      setPreviewText(null);
      setSelectedFieldIds(new Set());
      setApplyIssues(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const runPreview = async () => {
    setIsBusy(true);
    setError(null);
    setApplyIssues(null);
    try {
      const trimmed = String(inputText ?? '').trim();
      if (!trimmed) {
        setPreview(null);
        setSelectedFieldIds(new Set());
        setError('Paste text first (or import a txt/md file).');
        return;
      }

      const res = await window.ckc.ingestPreview({ characterId, inputText: trimmed });
      setPreview(res);
      setPreviewText(trimmed);
      setSelectedFieldIds(new Set((res?.changes || []).filter((c) => c.defaultSelected && !c.isProtected).map((c) => c.fieldId)));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsBusy(false);
    }
  };

  const applySelected = async () => {
    if (!preview) return;
    if (!previewText) return;
    const selected = Array.from(selectedFieldIds);
    if (selected.length === 0) return;

    setIsBusy(true);
    setError(null);
    setApplyIssues(null);
    try {
      const res = await window.ckc.ingestApply({ characterId, selectedFieldIds: selected, inputText: previewText });
      if (!res?.ok) {
        setApplyIssues(Array.isArray(res?.issues) ? res.issues : []);
        setError('Validation errors prevented applying the ingest.');
        return;
      }

      setApplyIssues(Array.isArray(res?.issues) ? res.issues : []);
      const refreshed = await window.ckc.getCharacter(characterId);
      if (refreshed) onCharacterRefreshed(refreshed);

      setPreview(null);
      setPreviewText(null);
      setSelectedFieldIds(new Set());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className={styles.root}>
      <div className={styles.panel}>
        <div className={styles.titleRow}>
          <div className={styles.title}>Sheet ingest / merge</div>
          <div className={styles.note}>Paste a block of Field IDs, preview a diff, then apply selected fields (creates a new sheet version).</div>
        </div>

        {isSheetDirty ? <div className={styles.note}>Note: sheet has unsaved edits — save the sheet first if you want to keep your draft.</div> : null}
        {preview && previewText && String(inputText ?? '').trim() !== previewText ? (
          <div className={styles.note}>Text changed since preview — run Preview again before applying.</div>
        ) : null}

        <div className={styles.row}>
          <button className={styles.btn} onClick={() => void loadFromFile()} disabled={isBusy}>
            Import txt/md…
          </button>
          <button className={styles.btn} onClick={() => void runPreview()} disabled={isBusy || !String(inputText ?? '').trim().length}>
            {isBusy ? 'Working…' : 'Preview'}
          </button>
          <button
            className={styles.btn}
            onClick={() => void applySelected()}
            disabled={
              isBusy ||
              !preview ||
              !previewText ||
              String(inputText ?? '').trim() !== previewText ||
              selectedFieldIds.size === 0
            }
          >
            Apply selected ({selectedFieldIds.size})
          </button>
        </div>

        {sourcePath ? <div className={styles.note}>Source: {sourcePath}</div> : null}

        <textarea
          className={styles.textarea}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Paste lines like:\nCHAR-ID-006 — Primary_Role: Detective\nCHAR-TIME-001: immortal\n  (two-space indent continues the value)\n"
        />
      </div>

      {error ? (
        <div className={styles.errorBox}>
          <div className={styles.errorTitle}>Error</div>
          <div>{error}</div>
        </div>
      ) : null}

      {applyIssues?.length ? (
        <div className={styles.errorBox}>
          <div className={styles.errorTitle}>Validation issues</div>
          <ul className={styles.issueList}>
            {applyIssues.map((i, idx) => (
              <li key={`${i.fieldId}-${idx}`}>
                <span className={styles.issueSeverity} data-sev={i.severity}>
                  {i.severity}
                </span>{' '}
                <span className={styles.issueField}>{i.fieldId}</span>: {i.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {preview ? (
        <SheetFieldChangePicker changes={preview.changes || []} unmapped={preview.unmapped || []} selectedFieldIds={selectedFieldIds} setSelectedFieldIds={setSelectedFieldIds} />
      ) : null}
    </div>
  );
}
