import React from 'react';
import styles from './sheetEditor.module.css';

type Field = CKCTemplateAstField;
type Section = { title: string; fields: Field[] };

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
                  const label = `${field.label}${field.optional ? ' (optional)' : ''}`;

                  return (
                    <div key={field.id} className={styles.field}>
                      <div className={styles.fieldHeader}>
                        <div className={styles.fieldLabel}>{label}</div>
                        <div className={styles.fieldId}>{field.id}</div>
                      </div>

                      {isRule ? (
                        <pre className={styles.ruleText}>{value}</pre>
                      ) : field.type === 'enum' && field.enumValues?.length ? (
                        <select
                          className={styles.select}
                          value={value.trim().length ? value : ''}
                          onChange={(e) => onChange(field.id, e.target.value)}
                        >
                          <option value="">(blank)</option>
                          {field.enumValues.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : rows <= 3 ? (
                        <input
                          className={styles.input}
                          value={value}
                          onChange={(e) => onChange(field.id, e.target.value)}
                          placeholder={field.templateDescriptor ? field.templateDescriptor : undefined}
                        />
                      ) : (
                        <textarea
                          className={styles.textarea}
                          rows={rows}
                          value={value}
                          onChange={(e) => onChange(field.id, e.target.value)}
                          placeholder={field.templateDescriptor ? field.templateDescriptor : undefined}
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

