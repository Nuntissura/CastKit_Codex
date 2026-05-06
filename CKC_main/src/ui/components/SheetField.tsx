import React from 'react';
import styles from './sheetEditor.module.css';

type Field = CKCTemplateAstField;

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

export type SheetFieldProps = {
  field: Field;
  value: string;
  onChange: (value: string) => void;
  suggestionListId: string;
  suggestions: string[];
  onFocusLoadSuggestions?: () => void;
  readOnly?: boolean;
};

export function SheetField({
  field,
  value,
  onChange,
  suggestionListId,
  suggestions,
  onFocusLoadSuggestions,
  readOnly,
}: SheetFieldProps) {
  const isRule = field.type === 'rule';
  const rows = inputRowsForField(field);
  const placeholder = field.templateDescriptor || undefined;

  if (isRule) {
    return <pre className={styles.ruleText}>{value}</pre>;
  }

  if (field.type === 'enum' && field.enumValues?.length) {
    return (
      <>
        <input
          className={styles.input}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => onFocusLoadSuggestions?.()}
          list={suggestions.length ? suggestionListId : undefined}
          placeholder={placeholder}
          readOnly={readOnly}
        />
        {suggestions.length ? (
          <datalist id={suggestionListId}>
            {suggestions.map((opt) => (
              <option key={opt} value={opt} />
            ))}
          </datalist>
        ) : null}
      </>
    );
  }

  if (rows <= 3) {
    return (
      <>
        <input
          className={styles.input}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => onFocusLoadSuggestions?.()}
          list={suggestions.length ? suggestionListId : undefined}
          placeholder={placeholder}
          readOnly={readOnly}
        />
        {suggestions.length ? (
          <datalist id={suggestionListId}>
            {suggestions.map((opt) => (
              <option key={opt} value={opt} />
            ))}
          </datalist>
        ) : null}
      </>
    );
  }

  return (
    <textarea
      className={styles.textarea}
      rows={rows}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => onFocusLoadSuggestions?.()}
      placeholder={placeholder}
      readOnly={readOnly}
    />
  );
}
