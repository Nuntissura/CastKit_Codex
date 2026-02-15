import React from 'react';
import styles from './sheetEditor.module.css';

type Field = CKCTemplateAstField;
type Section = { title: string; fields: Field[] };

const READ_ONLY_FIELD_IDS = new Set(['CHAR-ID-001']);

function initialCollapsed(title: string): boolean {
  const t = String(title || '').toLowerCase();
  if (t.includes('data quality')) return true;
  if (t.includes('rules')) return true;
  return false;
}

function inputRowsForField(field: Field): number {
  switch (field.type) {
    case 'paragraph':
      return 6;
    case 'list':
    case 'block':
    case 'block_list':
      return 5;
    default:
      return 3;
  }
}

export function SheetEditor({
  templateSections,
  valuesById,
  onChange,
}: {
  templateSections: Section[];
  valuesById: Record<string, string>;
  onChange: (fieldId: string, value: string) => void;
}) {
  const [suggestionsByFieldId, setSuggestionsByFieldId] = React.useState<Record<string, string[]>>({});
  const loadedSuggestionsRef = React.useRef<Set<string>>(new Set());
  const loadingSuggestionsRef = React.useRef<Set<string>>(new Set());

  const ensureSuggestionsLoaded = React.useCallback((fieldId: string) => {
    const fid = String(fieldId ?? '').trim();
    if (!fid) return;
    if (loadedSuggestionsRef.current.has(fid)) return;
    if (loadingSuggestionsRef.current.has(fid)) return;

    loadingSuggestionsRef.current.add(fid);
    window.ckc
      .listFieldValueSuggestions({ fieldId: fid, limit: 60 })
      .then((rows) => {
        const vals = Array.isArray(rows) ? rows.map((v) => String(v)).map((v) => v.trim()).filter(Boolean) : [];
        loadedSuggestionsRef.current.add(fid);
        setSuggestionsByFieldId((prev) => ({ ...prev, [fid]: vals }));
      })
      .catch(() => {
        loadedSuggestionsRef.current.add(fid);
        setSuggestionsByFieldId((prev) => ({ ...prev, [fid]: [] }));
      })
      .finally(() => {
        loadingSuggestionsRef.current.delete(fid);
      });
  }, []);

  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    for (const s of templateSections) map[s.title] = initialCollapsed(s.title);
    return map;
  });

  React.useEffect(() => {
    // Ensure new/changed sections get a default collapsed state.
    setCollapsed((prev) => {
      const next = { ...prev };
      for (const s of templateSections) {
        if (next[s.title] === undefined) next[s.title] = initialCollapsed(s.title);
      }
      return next;
    });
  }, [templateSections]);

  return (
    <div className={styles.root}>
      {templateSections.map((section) => {
        const isCollapsed = !!collapsed[section.title];
        return (
          <div key={section.title} className={styles.section}>
            <button
              className={styles.sectionHeader}
              onClick={() => setCollapsed((prev) => ({ ...prev, [section.title]: !prev[section.title] }))}
              data-collapsed={isCollapsed ? '1' : '0'}
              type="button"
            >
              <div className={styles.sectionTitle}>{section.title}</div>
              <div className={styles.sectionMeta}>{isCollapsed ? 'Show' : 'Hide'}</div>
            </button>

            {!isCollapsed ? (
              <div className={styles.fields}>
                {section.fields.map((field) => {
                  const value = valuesById[field.id] ?? '';
                  const isRule = field.type === 'rule';
                  const rows = inputRowsForField(field);
                  const listId = `ckc-field-suggest-${field.id}`;
                  const presets = suggestionsByFieldId[field.id] ?? [];
                  const enumValues = field.type === 'enum' && Array.isArray(field.enumValues) ? field.enumValues : [];
                  const isReadOnly = READ_ONLY_FIELD_IDS.has(field.id);

                  const suggestions = (() => {
                    const seen = new Set<string>();
                    const out: string[] = [];
                    for (const s of [...enumValues, ...presets]) {
                      const v = String(s ?? '').trim();
                      if (!v) continue;
                      const k = v.toLowerCase();
                      if (seen.has(k)) continue;
                      seen.add(k);
                      out.push(v);
                    }
                    return out;
                  })();

                  return (
                    <div key={field.id} className={styles.field}>
                      <div className={styles.fieldHeader}>
                        <div className={styles.fieldLabel}>
                          <span className={styles.labelText}>{field.label}</span>
                          {field.optional ? <span className={styles.optionalTag}>optional</span> : null}
                        </div>
                        <div className={styles.fieldId}>{field.id}</div>
                      </div>

                      {isRule ? (
                        <pre className={styles.ruleText}>{value}</pre>
                      ) : field.type === 'enum' && field.enumValues?.length ? (
                        <>
                          <input
                            className={styles.input}
                            value={value}
                            onChange={(e) => onChange(field.id, e.target.value)}
                            onFocus={() => ensureSuggestionsLoaded(field.id)}
                            list={suggestions.length ? listId : undefined}
                            placeholder={field.templateDescriptor ? field.templateDescriptor : undefined}
                            readOnly={isReadOnly}
                          />
                          {suggestions.length ? (
                            <datalist id={listId}>
                              {suggestions.map((opt) => (
                                <option key={opt} value={opt} />
                              ))}
                            </datalist>
                          ) : null}
                        </>
                      ) : rows <= 3 ? (
                        <>
                          <input
                            className={styles.input}
                            value={value}
                            onChange={(e) => onChange(field.id, e.target.value)}
                            onFocus={() => ensureSuggestionsLoaded(field.id)}
                            list={suggestions.length ? listId : undefined}
                            placeholder={field.templateDescriptor ? field.templateDescriptor : undefined}
                            readOnly={isReadOnly}
                          />
                          {suggestions.length ? (
                            <datalist id={listId}>
                              {suggestions.map((opt) => (
                                <option key={opt} value={opt} />
                              ))}
                            </datalist>
                          ) : null}
                        </>
                      ) : (
                        <textarea
                          className={styles.textarea}
                          rows={rows}
                          value={value}
                          onChange={(e) => onChange(field.id, e.target.value)}
                          onFocus={() => ensureSuggestionsLoaded(field.id)}
                          placeholder={field.templateDescriptor ? field.templateDescriptor : undefined}
                          readOnly={isReadOnly}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
