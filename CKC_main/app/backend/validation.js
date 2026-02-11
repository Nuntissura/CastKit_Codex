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

function validateValueForField(field, valueText, mode) {
  const issues = [];
  const raw = valueText ?? '';
  const str = String(raw);
  const trimmed = str.trim();

  const push = (severity, message) => issues.push({ fieldId: field.id, severity, message });

  if (!trimmed) return { issues, normalized: str };

  if (field.type === 'enum' && Array.isArray(field.enumValues) && field.enumValues.length > 0) {
    if (!field.enumValues.includes(trimmed)) {
      push('warn', `Non-canonical enum value (allowed): "${trimmed}"`);
    }
  }

  if (field.type === 'integer') {
    if (!/^-?\d+$/.test(trimmed)) push('error', 'Expected integer');
  }

  if (field.type === 'number') {
    if (!/^-?(?:\d+|\d*\.\d+)$/.test(trimmed)) push('error', 'Expected number');
  }

  if (field.type === 'score_10') {
    const r = normalizeScore10(trimmed);
    if (!r.ok) push('error', 'Expected score_10 as 0..10 or x/10');
    return { issues, normalized: r.ok ? r.normalized : str };
  }

  if (field.type === 'descriptor' && (mode === 'strict' || mode === 'hard-fail')) {
    const words = splitDescriptorWords(trimmed);
    if (words.length < 2 || words.length > 12) push('error', 'Descriptor must be 2–12 words');
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

function validateCharacterValues(templateAst, valuesById, mode = 'strict') {
  const issues = [];
  const normalized = { ...valuesById };

  const fields = templateAst.sections.flatMap((s) => s.fields);
  const byId = new Map(fields.map((f) => [f.id, f]));

  for (const [fieldId, valueText] of Object.entries(valuesById)) {
    const field = byId.get(fieldId);
    if (!field) continue;
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

