import React from 'react';
import styles from './blockEditor.module.css';
import { SheetField } from './SheetField';
import type { BlockValue } from './blockListSerialize';

export type BlockEditorProps = {
  blockSchema: CKCTemplateBlockSchema;
  index: number;
  total: number;
  value: BlockValue;
  onChange: (next: BlockValue) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  parentFieldId: string;
  ensureSuggestionsLoaded: (suggestionKey: string) => void;
  suggestionsByKey: Record<string, string[]>;
};

export function BlockEditor({
  blockSchema,
  index,
  total,
  value,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  parentFieldId,
  ensureSuggestionsLoaded,
  suggestionsByKey,
}: BlockEditorProps) {
  const setField = (subFieldId: string, v: string) => {
    onChange({ ...value, [subFieldId]: v });
  };

  return (
    <div className={styles.block}>
      <div className={styles.blockHeader}>
        <div className={styles.blockTitle}>
          {blockSchema.name} #{index + 1}
        </div>
        <div className={styles.blockButtons}>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={onMoveUp}
            disabled={index === 0}
            title="Move up"
          >
            ↑
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={onMoveDown}
            disabled={index === total - 1}
            title="Move down"
          >
            ↓
          </button>
          <button
            type="button"
            className={`${styles.iconBtn} ${styles.danger}`}
            onClick={onRemove}
            title="Remove block"
          >
            Remove
          </button>
        </div>
      </div>

      <div className={styles.subFields}>
        {blockSchema.fields.map((subField) => {
          const subValue = value[subField.id] ?? '';
          const suggestionKey = `${parentFieldId}.${subField.id}`;
          const suggestions: string[] = (() => {
            const presets = suggestionsByKey[suggestionKey] ?? [];
            const enums =
              subField.type === 'enum' && Array.isArray(subField.enumValues) ? subField.enumValues : [];
            const seen = new Set<string>();
            const out: string[] = [];
            for (const s of [...enums, ...presets]) {
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
            <div key={subField.id} className={styles.subField}>
              <div className={styles.subFieldHeader}>
                <span className={styles.subFieldLabel}>
                  {subField.label}
                  {subField.optional ? ' (optional)' : ''}
                </span>
                <span className={styles.subFieldId}>{subField.id}</span>
              </div>
              <SheetField
                field={subField}
                value={subValue}
                onChange={(v) => setField(subField.id, v)}
                suggestionListId={`ckc-block-suggest-${parentFieldId}-${subField.id}`}
                suggestions={suggestions}
                onFocusLoadSuggestions={() => ensureSuggestionsLoaded(suggestionKey)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
