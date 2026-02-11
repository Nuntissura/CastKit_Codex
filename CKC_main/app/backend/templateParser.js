const { sha256Hex } = require('./crypto');

function normalizeDashVariants(value) {
  // Support literal em dash, en dash, hyphen, and common mojibake sequences.
  return value
    .replaceAll('â€”', '—')
    .replaceAll('–', '—')
    .replaceAll('-', '—');
}

function parseTemplateVersionFromHeader(lines) {
  // Example: "CHARACTER SHEET — (v1.13.9)"
  const firstNonEmpty = lines.find((l) => l.trim().length > 0);
  if (!firstNonEmpty) return 'unknown';
  const m = firstNonEmpty.match(/\(v([0-9]+(?:\.[0-9]+)*)\)/i);
  return m ? m[1] : 'unknown';
}

function isAllCapsHeader(line) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  // Allow uppercase words plus common punctuation used in the template headers.
  // Intentionally excludes ":" to avoid capturing field lines.
  return /^[A-Z0-9][A-Z0-9_\s&/()\-_,.;—–]+$/.test(trimmed) && !trimmed.includes(':');
}

function isBlockSchemaHeader(line) {
  const trimmed = line.trim();
  // Examples: Hustle_Block, Animal_Comparison_Block, Face_Profile_Block
  return /^[A-Za-z0-9_]+_Block$/.test(trimmed);
}

function extractEnumValues(rawDescriptor) {
  const match = rawDescriptor.match(/<([^>|]+(?:\|[^>|]+)+)>/);
  if (!match) return undefined;
  return match[1].split('|').map((v) => v.trim());
}

function extractBlockSchemaName(rawDescriptor) {
  // "<list of Hustle_Block | optional>" => Hustle_Block
  const listOf = rawDescriptor.match(/<\s*list\s+of\s+([A-Za-z0-9_]+_Block)\b/i);
  if (listOf) return { kind: 'block_list', name: listOf[1] };

  // "<Sex_Profile_Block | optional>" => Sex_Profile_Block
  const single = rawDescriptor.match(/<\s*([A-Za-z0-9_]+_Block)\b/i);
  if (single) return { kind: 'block', name: single[1] };

  return undefined;
}

function inferFieldType(rawDescriptor) {
  const lower = rawDescriptor.toLowerCase();

  if (lower.includes('<rule>')) return { type: 'rule' };
  if (lower.includes('<integer>')) return { type: 'integer' };
  if (lower.includes('<number>')) return { type: 'number' };
  if (lower.includes('<paragraph>')) return { type: 'paragraph' };
  if (lower.includes('<descriptor>')) return { type: 'descriptor' };
  if (lower.includes('<score_10>')) return { type: 'score_10' };

  const blockInfo = extractBlockSchemaName(rawDescriptor);
  if (blockInfo) return { type: blockInfo.kind, blockSchemaName: blockInfo.name };

  if (/\<.*\|.*\>/.test(rawDescriptor)) {
    const enumValues = extractEnumValues(rawDescriptor);
    if (enumValues) return { type: 'enum', enumValues };
  }

  if (lower.includes('<list of')) return { type: 'block_list' };
  if (lower.includes('<list>')) return { type: 'list' };
  if (lower.includes('<list')) return { type: 'list' };

  return { type: 'string' };
}

function isOptionalDescriptor(rawDescriptor) {
  // Template uses "| optional" or "| unset"
  return /\boptional\b/i.test(rawDescriptor) || /\bunset\b/i.test(rawDescriptor);
}

function parseTemplate(content, templateId, sourcePath = null) {
  const lines = content.split(/\r?\n/);

  const version = parseTemplateVersionFromHeader(lines);
  const hash = sha256Hex(Buffer.from(content, 'utf8'));

  const sections = [];
  const blockSchemas = [];
  const unmappedLines = [];

  let currentSection = null;
  let currentBlock = null;

  // Field ID lines: "CHAR-ID-002 — Name: <string>"
  // Accept em dash, en dash, and hyphen.
  const fieldLineRegex = /^([A-Z0-9]+-[A-Z0-9]+-[0-9A-Z]+)\s*(?:—|–|-)\s*([^:]+):\s*(.*)$/;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (isBlockSchemaHeader(trimmed)) {
      currentBlock = { name: trimmed, fields: [] };
      blockSchemas.push(currentBlock);
      continue;
    }

    const fieldMatch = trimmed.match(fieldLineRegex);
    if (fieldMatch) {
      const id = fieldMatch[1];
      const label = fieldMatch[2].trim();
      const rawDescriptor = fieldMatch[3].trim();

      const inferred = inferFieldType(rawDescriptor);

      const field = {
        id,
        label,
        type: inferred.type,
        optional: isOptionalDescriptor(rawDescriptor),
        enumValues: inferred.enumValues,
        blockSchemaName: inferred.blockSchemaName,
        section: currentBlock ? `BLOCK:${currentBlock.name}` : (currentSection?.title || 'General'),
        value: null,
        templateDescriptor: rawDescriptor,
      };

      if (currentBlock) currentBlock.fields.push(field);
      else {
        if (!currentSection) {
          currentSection = { title: 'IDENTITY', fields: [] };
          sections.push(currentSection);
        }
        currentSection.fields.push(field);
      }
      continue;
    }

    if (!currentBlock && isAllCapsHeader(trimmed)) {
      currentSection = { title: trimmed, fields: [] };
      sections.push(currentSection);
      continue;
    }

    // Exiting a block schema is implicit: next section header resets.
    if (currentBlock && isAllCapsHeader(trimmed)) {
      currentBlock = null;
      currentSection = { title: trimmed, fields: [] };
      sections.push(currentSection);
      continue;
    }

    unmappedLines.push(trimmed);
  }

  return {
    id: templateId,
    version,
    hash,
    sourcePath,
    sections,
    blockSchemas,
    unmappedLines,
  };
}

module.exports = {
  parseTemplate,
  normalizeDashVariants,
};
