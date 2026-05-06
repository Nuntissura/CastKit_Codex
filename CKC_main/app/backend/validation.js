function splitDescriptorWords(value) {
  return String(value)
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function normalizeScore10(value) {
  const raw = String(value).trim();
  if (!raw) return { ok: true, normalized: '' };

  const slash = raw.match(/^(\d{1,2})\s*\/\s*10$/);
  if (slash) {
    const n = Number(slash[1]);
    if (Number.isInteger(n) && n >= 0 && n <= 10) return { ok: true, normalized: `${n}/10` };
    return { ok: false, normalized: raw };
  }

  const plain = raw.match(/^\d{1,2}$/);
  if (plain) {
    const n = Number(plain[0]);
    if (Number.isInteger(n) && n >= 0 && n <= 10) return { ok: true, normalized: `${n}/10` };
    return { ok: false, normalized: raw };
  }

  return { ok: false, normalized: raw };
}

function isInAllowedSpecialValues(field, trimmed) {
  if (!Array.isArray(field.allowedSpecialValues)) return false;
  return field.allowedSpecialValues.some((v) => String(v).trim() === trimmed);
}

function validateValueForField(field, valueText, mode) {
  const issues = [];
  const raw = valueText ?? '';
  const str = String(raw);
  const trimmed = str.trim();

  const push = (severity, message) => issues.push({ fieldId: field.id, severity, message });

  if (!trimmed) return { issues, normalized: str };

  // String fields accept any non-empty string. allowedSpecialValues
  // are sentinel literals (e.g. "unset") that are also valid; either way
  // we don't warn.
  if (field.type === 'string') {
    return { issues, normalized: str };
  }

  if (field.type === 'enum' && Array.isArray(field.enumValues) && field.enumValues.length > 0) {
    if (field.enumValues.includes(trimmed)) {
      return { issues, normalized: str };
    }
    if (isInAllowedSpecialValues(field, trimmed)) {
      return { issues, normalized: str };
    }
    // Extension: allowOtherType permits a fallback type in place of any
    // declared enum literal. e.g. Build: <slim | ... | other:<descriptor> | unknown>
    // accepts any 2-12 word descriptor without warning.
    if (field.allowOtherType === 'descriptor' && (mode === 'strict' || mode === 'hard-fail')) {
      const words = splitDescriptorWords(trimmed);
      if (words.length >= 2 && words.length <= 12) {
        return { issues, normalized: str };
      }
    }
    if (field.allowOtherType === 'string') {
      // Any non-empty string is fine.
      return { issues, normalized: str };
    }
    if (field.allowOtherType === 'descriptor') {
      // advisory mode: don't enforce word count, accept the value.
      return { issues, normalized: str };
    }
    push('warn', `Non-canonical enum value (allowed): "${trimmed}"`);
    return { issues, normalized: str };
  }

  if (field.type === 'integer') {
    if (isInAllowedSpecialValues(field, trimmed)) return { issues, normalized: str };
    if (!/^-?\d+$/.test(trimmed)) push('error', 'Expected integer');
  }

  if (field.type === 'number') {
    if (isInAllowedSpecialValues(field, trimmed)) return { issues, normalized: str };
    if (!/^-?(?:\d+|\d*\.\d+)$/.test(trimmed)) push('error', 'Expected number');
  }

  if (field.type === 'score_10') {
    if (isInAllowedSpecialValues(field, trimmed)) return { issues, normalized: str };
    const r = normalizeScore10(trimmed);
    if (!r.ok) push('error', 'Expected score_10 as 0..10 or x/10');
    return { issues, normalized: r.ok ? r.normalized : str };
  }

  if (field.type === 'descriptor') {
    // Sentinels like "unknown" are always fine.
    if (isInAllowedSpecialValues(field, trimmed)) return { issues, normalized: str };
    if (mode === 'strict' || mode === 'hard-fail') {
      const words = splitDescriptorWords(trimmed);
      if (words.length < 2 || words.length > 12) push('error', 'Descriptor must be 2–12 words');
    }
  }

  if (field.type === 'block' || field.type === 'block_list' || field.type === 'list') {
    // These are JSON-serialized values in our canonical export.
    try {
      JSON.parse(trimmed);
    } catch {
      push(mode === 'advisory' ? 'warn' : 'error', 'Expected JSON value');
    }
  }

  return { issues, normalized: str };
}

function validateBlockListValue(field, valueText, blockSchemasByName, mode) {
  const issues = [];
  const raw = String(valueText ?? '');
  const trimmed = raw.trim();
  if (!trimmed) return { issues, normalized: raw };

  const schema = field.blockSchemaName ? blockSchemasByName.get(field.blockSchemaName) : null;
  if (!schema) {
    // Fall back to JSON-only check (existing behavior).
    try {
      JSON.parse(trimmed);
    } catch {
      issues.push({ fieldId: field.id, severity: mode === 'advisory' ? 'warn' : 'error', message: 'Expected JSON value' });
    }
    return { issues, normalized: raw };
  }

  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    issues.push({ fieldId: field.id, severity: mode === 'advisory' ? 'warn' : 'error', message: 'Expected JSON value' });
    return { issues, normalized: raw };
  }

  const isList = field.type === 'block_list';
  const items = isList ? parsed : [parsed];
  if (isList && !Array.isArray(parsed)) {
    issues.push({ fieldId: field.id, severity: mode === 'advisory' ? 'warn' : 'error', message: 'Expected JSON array of blocks' });
    return { issues, normalized: raw };
  }
  if (!isList && (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))) {
    issues.push({ fieldId: field.id, severity: mode === 'advisory' ? 'warn' : 'error', message: 'Expected JSON object for block' });
    return { issues, normalized: raw };
  }

  const subFieldsById = new Map(schema.fields.map((f) => [f.id, f]));
  const normalizedItems = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i] ?? {};
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      issues.push({
        fieldId: isList ? `${field.id}[${i}]` : field.id,
        severity: mode === 'advisory' ? 'warn' : 'error',
        message: 'Expected block object',
      });
      normalizedItems.push(item);
      continue;
    }
    const normalizedItem = { ...item };
    for (const [subFieldId, subValue] of Object.entries(item)) {
      const subField = subFieldsById.get(subFieldId);
      if (!subField) continue; // unknown sub-field id; preserve verbatim, no warning
      const subText = subValue == null ? '' : String(subValue);
      const r = validateValueForField(subField, subText, mode);
      const path = isList ? `${field.id}[${i}].${subFieldId}` : `${field.id}.${subFieldId}`;
      for (const issue of r.issues) {
        issues.push({ ...issue, fieldId: path });
      }
      if (r.normalized !== subText) normalizedItem[subFieldId] = r.normalized;
    }
    normalizedItems.push(normalizedItem);
  }

  const reSerialized = isList ? JSON.stringify(normalizedItems) : JSON.stringify(normalizedItems[0] ?? {});
  return { issues, normalized: reSerialized };
}

function validateCharacterValues(templateAst, valuesById, mode = 'strict') {
  const issues = [];
  const normalized = { ...valuesById };

  const fields = templateAst.sections.flatMap((s) => s.fields);
  const byId = new Map(fields.map((f) => [f.id, f]));
  const blockSchemasByName = new Map((templateAst.blockSchemas || []).map((b) => [b.name, b]));

  for (const [fieldId, valueText] of Object.entries(valuesById)) {
    const field = byId.get(fieldId);
    if (!field) continue;
    if (field.type === 'block_list' || field.type === 'block') {
      const r = validateBlockListValue(field, valueText, blockSchemasByName, mode);
      issues.push(...r.issues);
      if (r.normalized !== valueText) normalized[fieldId] = r.normalized;
      continue;
    }
    const r = validateValueForField(field, valueText, mode);
    issues.push(...r.issues);
    if (r.normalized !== valueText) normalized[fieldId] = r.normalized;
  }

  return { issues, normalizedValuesById: normalized };
}

function classifyChangeType(currentValue, proposedValue, validationIssuesForField) {
  const cur = currentValue ?? '';
  const prop = proposedValue ?? '';

  if (!String(prop).trim()) return 'blank';
  if (validationIssuesForField.some((i) => i.severity === 'error')) return 'invalid';
  if (!String(cur).trim()) return 'add';
  if (String(cur) === String(prop)) return 'same';
  return 'modify';
}

module.exports = {
  validateCharacterValues,
  validateValueForField,
  classifyChangeType,
  normalizeScore10,
};

