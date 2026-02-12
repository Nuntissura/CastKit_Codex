import React from 'react';
import styles from './sheetMergeTools.module.css';
import { SheetFieldChangePicker } from './SheetFieldChangePicker';

function shortId(id: string) {
  const s = String(id ?? '');
  if (s.length <= 10) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function formatVersionLabel(v: CKCSheetVersionListItem) {
  const created = String(v.createdAt ?? '');
  const src = String(v.source ?? '');
  const notes = String(v.notes ?? '').trim();
  const notePart = notes ? ` — ${notes}` : '';
  return `${created} [${src}] ${shortId(v.id)}${notePart}`;
}

export function SheetVersionTools({
  characterId,
  isSheetDirty,
  onCharacterRefreshed,
}: {
  characterId: string;
  isSheetDirty: boolean;
  onCharacterRefreshed: (next: CKCCharacter) => void;
}) {
  const [versions, setVersions] = React.useState<CKCSheetVersionListItem[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  const [diffFromId, setDiffFromId] = React.useState<string>('');
  const [diffToId, setDiffToId] = React.useState<string>('');
  const [diffResult, setDiffResult] = React.useState<CKCSheetVersionDiffResult | null>(null);
  const [isDiffBusy, setIsDiffBusy] = React.useState<boolean>(false);

  const [revertVersionId, setRevertVersionId] = React.useState<string>('');
  const [revertPreview, setRevertPreview] = React.useState<CKCSheetIngestPreviewResult | null>(null);
  const [revertSelectedFieldIds, setRevertSelectedFieldIds] = React.useState<Set<string>>(new Set());
  const [revertIssues, setRevertIssues] = React.useState<CKCValidationIssue[] | null>(null);
  const [isRevertBusy, setIsRevertBusy] = React.useState<boolean>(false);

  const loadVersions = React.useCallback(async () => {
    setIsLoadingVersions(true);
    setError(null);
    try {
      const rows = await window.ckc.listVersions(characterId);
      const list = Array.isArray(rows) ? rows : [];
      setVersions(list);

      if (!diffFromId && list[0]?.id) setDiffFromId(list[0].id);
      if (!diffToId && list[1]?.id) setDiffToId(list[1].id);
      if (!revertVersionId && list[0]?.id) setRevertVersionId(list[0].id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoadingVersions(false);
    }
  }, [characterId, diffFromId, diffToId, revertVersionId]);

  React.useEffect(() => {
    void loadVersions();
    setDiffResult(null);
    setRevertPreview(null);
    setRevertSelectedFieldIds(new Set());
    setRevertIssues(null);
  }, [characterId, loadVersions]);

  const runDiff = async () => {
    if (!diffFromId || !diffToId || diffFromId === diffToId) return;
    setIsDiffBusy(true);
    setError(null);
    try {
      const res = await window.ckc.diffVersions({ characterId, fromVersionId: diffFromId, toVersionId: diffToId });
      setDiffResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsDiffBusy(false);
    }
  };

  const runRevertPreview = async () => {
    if (!revertVersionId) return;
    setIsRevertBusy(true);
    setError(null);
    setRevertIssues(null);
    try {
      const res = await window.ckc.revertPreviewFromVersion({ characterId, versionId: revertVersionId });
      setRevertPreview(res);
      setRevertSelectedFieldIds(new Set());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRevertBusy(false);
    }
  };

  const applyRevertSelected = async () => {
    if (!revertPreview || !revertVersionId) return;
    const selected = Array.from(revertSelectedFieldIds);
    if (selected.length === 0) return;

    setIsRevertBusy(true);
    setError(null);
    setRevertIssues(null);
    try {
      const res = await window.ckc.revertApplyFromVersion({ characterId, versionId: revertVersionId, selectedFieldIds: selected });
      if (!res?.ok) {
        setRevertIssues(Array.isArray(res?.issues) ? res.issues : []);
        setError('Validation errors prevented applying the revert.');
        return;
      }

      setRevertIssues(Array.isArray(res?.issues) ? res.issues : []);
      const refreshed = await window.ckc.getCharacter(characterId);
      if (refreshed) onCharacterRefreshed(refreshed);

      await loadVersions();
      setRevertPreview(null);
      setRevertSelectedFieldIds(new Set());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRevertBusy(false);
    }
  };

  return (
    <div className={styles.root}>
      <div className={styles.panel}>
        <div className={styles.titleRow}>
          <div className={styles.title}>Sheet versions</div>
          <div className={styles.note}>Browse versions, diff any two, and selectively revert fields (creates a new version).</div>
        </div>

        {isSheetDirty ? <div className={styles.note}>Note: sheet has unsaved edits — reverting will overwrite them.</div> : null}

        <div className={styles.row}>
          <button className={styles.btn} onClick={() => void loadVersions()} disabled={isLoadingVersions || isDiffBusy || isRevertBusy}>
            {isLoadingVersions ? 'Loading…' : 'Refresh versions'}
          </button>
          <div className={styles.note}>{versions.length ? `${versions.length} version(s)` : 'No versions yet.'}</div>
        </div>
      </div>

      {error ? (
        <div className={styles.errorBox}>
          <div className={styles.errorTitle}>Error</div>
          <div>{error}</div>
        </div>
      ) : null}

      <div className={styles.panel}>
        <div className={styles.title}>Diff two versions</div>

        <div className={styles.twoCol}>
          <div>
            <div className={styles.note}>From</div>
            <select className={styles.select} value={diffFromId} onChange={(e) => setDiffFromId(e.target.value)} disabled={!versions.length || isDiffBusy}>
              <option value="">(select)</option>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {formatVersionLabel(v)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className={styles.note}>To</div>
            <select className={styles.select} value={diffToId} onChange={(e) => setDiffToId(e.target.value)} disabled={!versions.length || isDiffBusy}>
              <option value="">(select)</option>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {formatVersionLabel(v)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.row}>
          <button className={styles.btn} onClick={() => void runDiff()} disabled={isDiffBusy || !diffFromId || !diffToId || diffFromId === diffToId}>
            {isDiffBusy ? 'Diffing…' : 'Run diff'}
          </button>
          {diffResult ? <div className={styles.note}>{diffResult.changeCount} field change(s)</div> : null}
        </div>

        {diffResult ? (
          <div className={styles.changeList}>
            {(diffResult.changes || []).length === 0 ? <div className={styles.note}>No differences.</div> : null}
            {(diffResult.changes || []).map((c) => (
              <details key={c.fieldId} className={styles.changeRow}>
                <summary className={styles.changeSummary}>
                  <div />
                  <div className={styles.fieldId}>{c.fieldId}</div>
                  <div className={styles.label} title={`${c.label} (${c.section})`}>
                    {c.label} <span className={styles.note}>({c.section})</span>
                  </div>
                  <div className={styles.badge}>diff</div>
                  <div />
                  <div />
                </summary>
                <div className={styles.changeBody}>
                  <div>
                    <div className={styles.valueTitle}>From</div>
                    <div className={styles.valueBox}>{String(c.fromValue ?? '')}</div>
                  </div>
                  <div>
                    <div className={styles.valueTitle}>To</div>
                    <div className={styles.valueBox}>{String(c.toValue ?? '')}</div>
                  </div>
                </div>
              </details>
            ))}
          </div>
        ) : null}
      </div>

      <div className={styles.panel}>
        <div className={styles.title}>Selective revert from a version</div>
        <div className={styles.note}>Preview changes vs current, pick fields to take from the chosen version, then apply (creates a new version).</div>

        <div className={styles.twoCol}>
          <div>
            <div className={styles.note}>Version</div>
            <select
              className={styles.select}
              value={revertVersionId}
              onChange={(e) => setRevertVersionId(e.target.value)}
              disabled={!versions.length || isRevertBusy}
            >
              <option value="">(select)</option>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {formatVersionLabel(v)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className={styles.note}>Actions</div>
            <div className={styles.row}>
              <button className={styles.btn} onClick={() => void runRevertPreview()} disabled={isRevertBusy || !revertVersionId}>
                {isRevertBusy ? 'Working…' : 'Preview revert'}
              </button>
              <button
                className={styles.btn}
                onClick={() => void applyRevertSelected()}
                disabled={isRevertBusy || !revertPreview || revertSelectedFieldIds.size === 0}
              >
                Apply selected ({revertSelectedFieldIds.size})
              </button>
            </div>
          </div>
        </div>

        {revertIssues?.length ? (
          <div className={styles.errorBox}>
            <div className={styles.errorTitle}>Validation issues</div>
            <ul className={styles.issueList}>
              {revertIssues.map((i, idx) => (
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

        {revertPreview ? (
          <SheetFieldChangePicker
            changes={revertPreview.changes || []}
            unmapped={revertPreview.unmapped || []}
            selectedFieldIds={revertSelectedFieldIds}
            setSelectedFieldIds={setRevertSelectedFieldIds}
            currentLabel="Current"
            proposedLabel="From version"
          />
        ) : null}
      </div>
    </div>
  );
}

