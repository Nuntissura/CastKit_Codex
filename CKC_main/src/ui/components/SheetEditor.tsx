import React from 'react';
import styles from './sheetEditor.module.css';
import { SheetField } from './SheetField';
import { BlockListEditor } from './BlockListEditor';

type Field = CKCTemplateAstField;
type Section = { title: string; fields: Field[] };

const READ_ONLY_FIELD_IDS = new Set(['CHAR-ID-001']);

function initialCollapsed(title: string): boolean {
  const t = String(title || '').toLowerCase();
  if (t.includes('data quality')) return true;
  if (t.includes('rules')) return true;
  return false;
}

export function SheetEditor({
  templateSections,
  blockSchemas,
  valuesById,
  onChange,
  focusFieldId,
  onFocusFieldHandled,
}: {
  templateSections: Section[];
  blockSchemas?: CKCTemplateBlockSchema[];
  valuesById: Record<string, string>;
  onChange: (fieldId: string, value: string) => void;
  focusFieldId?: string | null;
  onFocusFieldHandled?: () => void;
}) {
  const [suggestionsByKey, setSuggestionsByKey] = React.useState<Record<string, string[]>>({});
  const loadedSuggestionsRef = React.useRef<Set<string>>(new Set());
  const loadingSuggestionsRef = React.useRef<Set<string>>(new Set());

  const ensureSuggestionsLoaded = React.useCallback((key: string) => {
    const k = String(key ?? '').trim();
    if (!k) return;
    if (loadedSuggestionsRef.current.has(k)) return;
    if (loadingSuggestionsRef.current.has(k)) return;

    loadingSuggestionsRef.current.add(k);
    // Suggestion key is either a top-level field id (e.g. CHAR-WRK-001)
    // or a block sub-field key (parentFieldId + '.' + blockFieldId). Both
    // are fed to the same backend lookup; the backend currently keys by
    // exact field id, so block sub-fields share suggestions across all
    // characters that filled the same sub-field id.
    const lookupId = k.includes('.') ? k.split('.').slice(-1)[0] : k;
    window.ckc
      .listFieldValueSuggestions({ fieldId: lookupId, limit: 60 })
      .then((rows) => {
        const vals = Array.isArray(rows) ? rows.map((v) => String(v)).map((v) => v.trim()).filter(Boolean) : [];
        loadedSuggestionsRef.current.add(k);
        setSuggestionsByKey((prev) => ({ ...prev, [k]: vals }));
      })
      .catch(() => {
        loadedSuggestionsRef.current.add(k);
        setSuggestionsByKey((prev) => ({ ...prev, [k]: [] }));
      })
      .finally(() => {
        loadingSuggestionsRef.current.delete(k);
      });
  }, []);

  const blockSchemaByName = React.useMemo(() => {
    const map = new Map<string, CKCTemplateBlockSchema>();
    for (const b of blockSchemas ?? []) map.set(b.name, b);
    return map;
  }, [blockSchemas]);

  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    for (const s of templateSections) map[s.title] = initialCollapsed(s.title);
    return map;
  });

  React.useEffect(() => {
    setCollapsed((prev) => {
      const next = { ...prev };
      for (const s of templateSections) {
        if (next[s.title] === undefined) next[s.title] = initialCollapsed(s.title);
      }
      return next;
    });
  }, [templateSections]);

  React.useEffect(() => {
    const fid = String(focusFieldId ?? '').trim();
    if (!fid) return;

    const sectionTitle = templateSections.find((s) => s.fields.some((f) => f.id === fid))?.title ?? null;
    if (sectionTitle) {
      setCollapsed((prev) => ({ ...prev, [sectionTitle]: false }));
    }

    const t = window.setTimeout(() => {
      const el = document.getElementById(`ckc-field-${fid}`);
      if (!el) return;
      try {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      } catch {
        // ignore
      }
      const input = el.querySelector('input, textarea') as HTMLInputElement | HTMLTextAreaElement | null;
      if (input) {
        input.focus();
        try {
          input.select();
        } catch {
          // ignore
        }
      }
      onFocusFieldHandled?.();
    }, 0);

    return () => window.clearTimeout(t);
  }, [focusFieldId, onFocusFieldHandled, templateSections]);

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
                  const isReadOnly = READ_ONLY_FIELD_IDS.has(field.id);
                  const isBlockType = field.type === 'block_list' || field.type === 'block';
                  const blockSchema =
                    isBlockType && field.blockSchemaName
                      ? blockSchemaByName.get(field.blockSchemaName) ?? null
                      : null;

                  const enumValues =
                    field.type === 'enum' && Array.isArray(field.enumValues) ? field.enumValues : [];
                  const presets = suggestionsByKey[field.id] ?? [];
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
                    <div key={field.id} id={`ckc-field-${field.id}`} className={styles.field}>
                      <div className={styles.fieldHeader}>
                        <div className={styles.fieldLabel}>
                          <span className={styles.labelText}>{field.label}</span>
                          {field.optional ? <span className={styles.optionalTag}>optional</span> : null}
                        </div>
                        <div className={styles.fieldId}>{field.id}</div>
                      </div>

                      {isBlockType ? (
                        <BlockListEditor
                          field={field}
                          blockSchema={blockSchema}
                          value={value}
                          onChange={(v) => onChange(field.id, v)}
                          ensureSuggestionsLoaded={ensureSuggestionsLoaded}
                          suggestionsByKey={suggestionsByKey}
                        />
                      ) : (
                        <SheetField
                          field={field}
                          value={value}
                          onChange={(v) => onChange(field.id, v)}
                          suggestionListId={`ckc-field-suggest-${field.id}`}
                          suggestions={suggestions}
                          onFocusLoadSuggestions={() => ensureSuggestionsLoaded(field.id)}
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
