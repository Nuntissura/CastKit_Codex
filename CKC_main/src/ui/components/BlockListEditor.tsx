import React from 'react';
import styles from './blockEditor.module.css';
import { BlockEditor } from './BlockEditor';
import { SheetField } from './SheetField';
import {
  parseBlockList,
  parseBlockObject,
  serializeBlockList,
  serializeBlockObject,
  emptyBlockFor,
  type BlockValue,
} from './blockListSerialize';

export type BlockListEditorProps = {
  field: CKCTemplateAstField;
  blockSchema: CKCTemplateBlockSchema | null;
  value: string;
  onChange: (next: string) => void;
  ensureSuggestionsLoaded: (key: string) => void;
  suggestionsByKey: Record<string, string[]>;
};

export function BlockListEditor({
  field,
  blockSchema,
  value,
  onChange,
  ensureSuggestionsLoaded,
  suggestionsByKey,
}: BlockListEditorProps) {
  if (!blockSchema) {
    return (
      <SheetField
        field={field}
        value={value}
        onChange={onChange}
        suggestionListId={`ckc-field-suggest-${field.id}`}
        suggestions={[]}
      />
    );
  }

  const isSingle = field.type === 'block';

  // Parse stored JSON once per render; the source of truth is the parent's
  // draftValuesById string, not local state.
  const parsed = isSingle
    ? (() => {
        const r = parseBlockObject(value);
        return { list: [r.value], warning: r.warning };
      })()
    : parseBlockList(value);
  const list: BlockValue[] = parsed.list;
  const warning = parsed.warning;

  const fieldIds = blockSchema.fields.map((f) => f.id);

  const commit = (next: BlockValue[]) => {
    if (isSingle) {
      const obj = next[0] ?? {};
      onChange(serializeBlockObject(obj));
    } else {
      onChange(serializeBlockList(next));
    }
  };

  const onItemChange = (idx: number, nextItem: BlockValue) => {
    const next = list.slice();
    next[idx] = nextItem;
    commit(next);
  };

  const onAdd = () => {
    if (isSingle && list.length > 0) return;
    const next = list.slice();
    next.push(emptyBlockFor(fieldIds));
    commit(next);
  };

  const onRemove = (idx: number) => {
    const next = list.slice();
    next.splice(idx, 1);
    commit(next);
  };

  const onMoveUp = (idx: number) => {
    if (idx === 0) return;
    const next = list.slice();
    const [item] = next.splice(idx, 1);
    next.splice(idx - 1, 0, item);
    commit(next);
  };

  const onMoveDown = (idx: number) => {
    if (idx >= list.length - 1) return;
    const next = list.slice();
    const [item] = next.splice(idx, 1);
    next.splice(idx + 1, 0, item);
    commit(next);
  };

  // Single-block mode: don't render an "empty" block UI when the value is empty;
  // show an Add button instead.
  const showSingleEmpty = isSingle && Object.values(list[0] ?? {}).every((v) => !String(v ?? '').trim());

  return (
    <div className={styles.list}>
      {warning ? <div className={styles.warning}>{warning}</div> : null}
      {!isSingle && list.length === 0 ? (
        <div className={styles.empty}>No {blockSchema.name} entries — click + Add to create one.</div>
      ) : null}
      {isSingle && showSingleEmpty ? (
        <div className={styles.empty}>No {blockSchema.name} — click + Add to create one.</div>
      ) : null}

      {(isSingle ? (showSingleEmpty ? [] : list) : list).map((item, idx) => (
        <BlockEditor
          key={idx}
          blockSchema={blockSchema}
          index={idx}
          total={list.length}
          value={item}
          onChange={(next) => onItemChange(idx, next)}
          onRemove={() => onRemove(idx)}
          onMoveUp={() => onMoveUp(idx)}
          onMoveDown={() => onMoveDown(idx)}
          parentFieldId={field.id}
          ensureSuggestionsLoaded={ensureSuggestionsLoaded}
          suggestionsByKey={suggestionsByKey}
        />
      ))}

      {!isSingle || showSingleEmpty ? (
        <div className={styles.addRow}>
          <button type="button" className={styles.addBtn} onClick={onAdd}>
            + Add {blockSchema.name}
          </button>
        </div>
      ) : null}
    </div>
  );
}
