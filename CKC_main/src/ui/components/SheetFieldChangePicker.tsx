import React from 'react';
import styles from './sheetMergeTools.module.css';

function normalizeFilter(text: string) {
  return String(text ?? '')
    .trim()
    .toLowerCase();
}

function summarize(changes: CKCSheetFieldChange[]) {
  const out = {
    total: changes.length,
    same: 0,
    add: 0,
    modify: 0,
    blank: 0,
    invalid: 0,
    protected: 0,
    issueCount: 0,
    errorCount: 0,
    warnCount: 0,
  };

  for (const c of changes) {
    if (c.changeType === 'same') out.same += 1;
    else if (c.changeType === 'add') out.add += 1;
    else if (c.changeType === 'modify') out.modify += 1;
    else if (c.changeType === 'blank') out.blank += 1;
    else if (c.changeType === 'invalid') out.invalid += 1;

    if (c.isProtected) out.protected += 1;

    const issues = Array.isArray(c.issues) ? c.issues : [];
    out.issueCount += issues.length;
    out.errorCount += issues.filter((i) => i.severity === 'error').length;
    out.warnCount += issues.filter((i) => i.severity === 'warn').length;
  }

  return out;
}

export function SheetFieldChangePicker({
  changes,
  unmapped,
  selectedFieldIds,
  setSelectedFieldIds,
  currentLabel = 'Current',
  proposedLabel = 'Proposed',
}: {
  changes: CKCSheetFieldChange[];
  unmapped: Array<{ fieldId: string; rawLine: string }>;
  selectedFieldIds: Set<string>;
  setSelectedFieldIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  currentLabel?: string;
  proposedLabel?: string;
}) {
  const [showAll, setShowAll] = React.useState<boolean>(false);
  const [filterText, setFilterText] = React.useState<string>('');

  const summary = React.useMemo(() => summarize(changes), [changes]);
  const filter = React.useMemo(() => normalizeFilter(filterText), [filterText]);

  const shown = React.useMemo(() => {
    const base = showAll ? changes : changes.filter((c) => c.changeType !== 'same');
    if (!filter) return base;
    return base.filter((c) => {
      const fid = String(c.fieldId ?? '').toLowerCase();
      const lab = String(c.label ?? '').toLowerCase();
      const sec = String(c.section ?? '').toLowerCase();
      return fid.includes(filter) || lab.includes(filter) || sec.includes(filter);
    });
  }, [changes, showAll, filter]);

  const toggle = React.useCallback(
    (fieldId: string) => {
      setSelectedFieldIds((prev) => {
        const next = new Set(prev);
        if (next.has(fieldId)) next.delete(fieldId);
        else next.add(fieldId);
        return next;
      });
    },
    [setSelectedFieldIds]
  );

  const selectDefaults = React.useCallback(() => {
    const next = new Set<string>();
    for (const c of changes) {
      if (!c.defaultSelected) continue;
      if (c.isProtected) continue;
      next.add(c.fieldId);
    }
    setSelectedFieldIds(next);
  }, [changes, setSelectedFieldIds]);

  const selectNone = React.useCallback(() => setSelectedFieldIds(new Set()), [setSelectedFieldIds]);

  const selectAllShown = React.useCallback(() => {
    const next = new Set<string>();
    for (const c of shown) {
      if (c.isProtected) continue;
      next.add(c.fieldId);
    }
    setSelectedFieldIds(next);
  }, [shown, setSelectedFieldIds]);

  const displayedUnmapped = Array.isArray(unmapped) ? unmapped : [];

  return (
    <div className={styles.panel}>
      <div className={styles.titleRow}>
        <div className={styles.title}>Preview</div>
        <div className={styles.summary}>
          <span>
            <b>{selectedFieldIds.size}</b> selected
          </span>
          <span>
            <b>{summary.add + summary.modify + summary.blank + summary.invalid}</b> changed
          </span>
          {summary.invalid ? (
            <span>
              <b>{summary.invalid}</b> invalid
            </span>
          ) : null}
          {summary.protected ? (
            <span>
              <b>{summary.protected}</b> protected
            </span>
          ) : null}
          {summary.issueCount ? (
            <span>
              <b>{summary.errorCount}</b> errors, <b>{summary.warnCount}</b> warns
            </span>
          ) : null}
        </div>
      </div>

      <div className={styles.twoCol}>
        <div>
          <div className={styles.note}>Filter</div>
          <input className={styles.input} value={filterText} onChange={(e) => setFilterText(e.target.value)} placeholder="Field ID / label / section…" />
        </div>
        <div>
          <div className={styles.note}>Visibility</div>
          <label className={styles.row}>
            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Show unchanged
          </label>
        </div>
      </div>

      <div className={styles.row}>
        <button className={styles.btn} onClick={selectDefaults} disabled={changes.length === 0}>
          Select defaults
        </button>
        <button className={styles.btn} onClick={selectAllShown} disabled={shown.length === 0}>
          Select all shown
        </button>
        <button className={styles.btn} onClick={selectNone} disabled={selectedFieldIds.size === 0}>
          Select none
        </button>
      </div>

      {displayedUnmapped.length ? (
        <div className={styles.unmapped}>
          <div className={styles.unmappedTitle}>Unmapped Field IDs</div>
          {displayedUnmapped.map((u) => (
            <div key={u.fieldId} className={styles.unmappedLine}>
              {u.rawLine}
            </div>
          ))}
        </div>
      ) : null}

      <div className={styles.changeList}>
        {shown.length === 0 ? <div className={styles.note}>No changes to show.</div> : null}
        {shown.map((c) => {
          const checked = selectedFieldIds.has(c.fieldId);
          const disableToggle = !!c.isProtected;
          const issueCount = Array.isArray(c.issues) ? c.issues.length : 0;

          return (
            <details key={c.fieldId} className={styles.changeRow}>
              <summary className={styles.changeSummary}>
                <div className={styles.checkboxWrap} onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disableToggle}
                    onChange={() => toggle(c.fieldId)}
                    title={disableToggle ? 'Protected field (cannot overwrite)' : undefined}
                  />
                </div>
                <div className={styles.fieldId}>{c.fieldId}</div>
                <div className={styles.label} title={`${c.label} (${c.section})`}>
                  {c.label} <span className={styles.note}>({c.section})</span>
                </div>
                <div className={styles.badge} data-type={c.changeType}>
                  {c.changeType}
                </div>
                {c.isProtected ? <div className={styles.badge}>protected</div> : <div />}
                {issueCount ? <div className={styles.badge}>{issueCount} issues</div> : <div />}
              </summary>

              <div className={styles.changeBody}>
                <div>
                  <div className={styles.valueTitle}>{currentLabel}</div>
                  <div className={styles.valueBox}>{String(c.currentValue ?? '')}</div>
                </div>
                <div>
                  <div className={styles.valueTitle}>{proposedLabel}</div>
                  <div className={styles.valueBox}>{String(c.proposedValue ?? '')}</div>
                </div>
                {issueCount ? (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div className={styles.valueTitle}>Issues</div>
                    <ul className={styles.issueList} style={{ marginTop: 0 }}>
                      {(c.issues || []).map((i, idx) => (
                        <li key={`${c.fieldId}-${idx}`}>
                          <span className={styles.issueSeverity} data-sev={i.severity}>
                            {i.severity}
                          </span>{' '}
                          <span className={styles.issueField}>{i.fieldId}</span>: {i.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
