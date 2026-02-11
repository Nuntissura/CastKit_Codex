const { splitLinesPreserveFinalEmpty, detectNewline } = require('./text');

function fieldIdRegexSource() {
  // Allow trailing letters, e.g. CHAR-ID-002A
  return '([A-Z0-9]+-[A-Z0-9]+-[0-9A-Z]+)';
}

function buildSheetFieldLineRegex() {
  // Capture:
  // 1) fieldId
  // 2) separator with surrounding whitespace (preserve)
  // 3) label (no colon)
  // 4) whitespace after colon (preserve)
  // 5) value (rest of line)
  return new RegExp(
    `^${fieldIdRegexSource()}(\\s*(?:—|–|-|â€”)+\\s*)([^:]+):(\\s*)(.*)$`
  );
}

const SHEET_FIELD_LINE_REGEX = buildSheetFieldLineRegex();

function parseSheetText(text) {
  const { newline, hasFinalNewline, lines } = splitLinesPreserveFinalEmpty(text);
  const fieldSpans = new Map();
  const fieldValues = new Map();
  const fieldMeta = new Map();

  let currentFieldId = null;
  let currentSpan = null;
  let currentValueLines = null;

  const flushCurrent = () => {
    if (!currentFieldId || !currentSpan || !currentValueLines) return;
    fieldSpans.set(currentFieldId, currentSpan);
    fieldValues.set(currentFieldId, currentValueLines.join('\n'));
    currentFieldId = null;
    currentSpan = null;
    currentValueLines = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const match = line.match(SHEET_FIELD_LINE_REGEX);
    if (match) {
      flushCurrent();

      const fieldId = match[1];
      const sepWithWs = match[2];
      const label = match[3];
      const postColonWs = match[4];
      const value = match[5] ?? '';

      const prefix = `${fieldId}${sepWithWs}${label}:${postColonWs}`;
      currentFieldId = fieldId;
      currentSpan = { start: i, end: i, prefix };
      currentValueLines = [value];
      fieldMeta.set(fieldId, { label: label.trim(), sepWithWs, postColonWs });
      continue;
    }

    // Continuation lines: indented by two spaces.
    if (currentFieldId && typeof line === 'string' && line.startsWith('  ')) {
      currentSpan.end = i;
      currentValueLines.push(line.slice(2));
      continue;
    }

    flushCurrent();
  }

  flushCurrent();

  return {
    newline,
    hasFinalNewline,
    lines,
    fieldSpans,
    fieldValues,
    fieldMeta,
  };
}

function serializeMultilineValue(value) {
  const str = value ?? '';
  const parts = String(str).split('\n');
  return {
    firstLine: parts[0] ?? '',
    continuation: parts.slice(1),
  };
}

function applyFieldUpdatesToParsedSheet(parsed, updatesById) {
  const updates = [];
  for (const [fieldId, newValue] of Object.entries(updatesById)) {
    const span = parsed.fieldSpans.get(fieldId);
    if (!span) continue;
    updates.push({ fieldId, span, newValue: newValue ?? '' });
  }

  // Apply back-to-front so indices remain valid.
  updates.sort((a, b) => b.span.start - a.span.start);

  const lines = parsed.lines.slice();
  for (const u of updates) {
    const { firstLine, continuation } = serializeMultilineValue(u.newValue);
    const replacement = [u.span.prefix + firstLine, ...continuation.map((l) => `  ${l}`)];
    lines.splice(u.span.start, u.span.end - u.span.start + 1, ...replacement);
  }

  const out = lines.join(parsed.newline);
  // Preserve trailing newline only if it existed.
  if (parsed.hasFinalNewline && !out.endsWith(parsed.newline)) return out + parsed.newline;
  return out;
}

function extractFieldAssignmentsFromText(text) {
  const newline = detectNewline(text);
  const lines = text.split(/\r?\n/);

  const assignments = new Map();
  const rawById = new Map();
  const unmappedRawLines = [];

  const idOnlyRegex = new RegExp(`^\\s*${fieldIdRegexSource()}\\s*[:=]\\s*(.*)$`);
  const fullFieldRegex = new RegExp(`^\\s*${fieldIdRegexSource()}\\s*(?:—|–|-|â€”)+\\s*([^:]+):\\s*(.*)$`);

  let currentFieldId = null;
  let currentValueLines = null;
  let currentRawStart = null;

  const flush = () => {
    if (!currentFieldId || !currentValueLines) return;
    assignments.set(currentFieldId, currentValueLines.join('\n'));
    rawById.set(currentFieldId, currentRawStart ?? `${currentFieldId}: ${currentValueLines[0] ?? ''}`);
    currentFieldId = null;
    currentValueLines = null;
    currentRawStart = null;
  };

  for (const rawLine of lines) {
    if (!rawLine || !rawLine.trim().length) {
      flush();
      continue;
    }

    let match = rawLine.match(idOnlyRegex);
    if (match) {
      flush();
      currentFieldId = match[1];
      currentRawStart = rawLine;
      currentValueLines = [match[2] ?? ''];
      continue;
    }

    match = rawLine.match(fullFieldRegex);
    if (match) {
      flush();
      currentFieldId = match[1];
      currentRawStart = rawLine;
      currentValueLines = [match[3] ?? ''];
      continue;
    }

    if (currentFieldId && rawLine.startsWith('  ')) {
      currentValueLines.push(rawLine.slice(2));
      continue;
    }

    flush();
    unmappedRawLines.push(rawLine);
  }

  flush();

  return {
    newline,
    assignments,
    rawById,
    unmappedRawLines,
  };
}

function generateCanonicalSheetText(templateAst, meta, valuesById = {}) {
  const newline = '\n';
  const lines = [];

  if (meta?.templateId) lines.push(`TEMPLATE_ID: ${meta.templateId}`);
  if (meta?.templateVersion) lines.push(`TEMPLATE_VERSION: ${meta.templateVersion}`);
  if (meta?.templateHash) lines.push(`TEMPLATE_HASH: ${meta.templateHash}`);
  if (meta?.characterId) lines.push(`CHARACTER_ID: ${meta.characterId}`);
  if (meta?.displayName) lines.push(`DISPLAY_NAME: ${meta.displayName}`);
  lines.push('');

  for (const section of templateAst.sections) {
    lines.push(section.title);
    for (const field of section.fields) {
      const value = Object.prototype.hasOwnProperty.call(valuesById, field.id) ? valuesById[field.id] : '';
      const { firstLine, continuation } = serializeMultilineValue(value);
      lines.push(`${field.id} — ${field.label}: ${firstLine}`);
      for (const cont of continuation) lines.push(`  ${cont}`);
    }
    lines.push('');
  }

  return lines.join(newline);
}

module.exports = {
  SHEET_FIELD_LINE_REGEX,
  parseSheetText,
  applyFieldUpdatesToParsedSheet,
  extractFieldAssignmentsFromText,
  generateCanonicalSheetText,
};
