export type BlockValue = Record<string, string>;

export type ParseResult = {
  list: BlockValue[];
  warning: string | null;
};

export function parseBlockList(raw: string | null | undefined): ParseResult {
  const s = String(raw ?? '').trim();
  if (!s) return { list: [], warning: null };
  let parsed: unknown;
  try {
    parsed = JSON.parse(s);
  } catch {
    return { list: [], warning: 'Stored block-list value is not valid JSON; starting fresh.' };
  }
  if (!Array.isArray(parsed)) {
    return { list: [], warning: 'Stored block-list value is not an array; starting fresh.' };
  }
  const list: BlockValue[] = [];
  for (const item of parsed) {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const obj: BlockValue = {};
      for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
        obj[k] = v == null ? '' : String(v);
      }
      list.push(obj);
    } else {
      list.push({});
    }
  }
  return { list, warning: null };
}

export function parseBlockObject(raw: string | null | undefined): { value: BlockValue; warning: string | null } {
  const s = String(raw ?? '').trim();
  if (!s) return { value: {}, warning: null };
  let parsed: unknown;
  try {
    parsed = JSON.parse(s);
  } catch {
    return { value: {}, warning: 'Stored block value is not valid JSON; starting fresh.' };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { value: {}, warning: 'Stored block value is not an object; starting fresh.' };
  }
  const obj: BlockValue = {};
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    obj[k] = v == null ? '' : String(v);
  }
  return { value: obj, warning: null };
}

export function serializeBlockList(list: BlockValue[]): string {
  if (!Array.isArray(list) || list.length === 0) return '';
  return JSON.stringify(list);
}

export function serializeBlockObject(obj: BlockValue): string {
  if (!obj || Object.keys(obj).length === 0) return '';
  return JSON.stringify(obj);
}

export function emptyBlockFor(fieldIds: string[]): BlockValue {
  const obj: BlockValue = {};
  for (const id of fieldIds) obj[id] = '';
  return obj;
}
