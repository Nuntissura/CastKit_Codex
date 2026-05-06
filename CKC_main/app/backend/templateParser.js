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

// Tokens that name a field's primary type. When one of these appears
// as the first token of a union, the field IS that type — the rest of
// the union are alternative-acceptable values, not enum members.
const PRIMARY_TYPE_KEYWORDS = new Set([
  'string',
  'integer',
  'number',
  'paragraph',
  'descriptor',
  'score_10',
  'list',
  'rule',
]);

// Tokens that mean "this field can be left unset / unknown / etc.".
// They are not enum values; they are metadata about optionality.
const OPTIONALITY_TOKENS = new Set([
  'optional',
  'unset',
  'unknown',
  'none',
]);

// Split the inside of a top-level `<...>` on `|`, respecting nested
// angle brackets so `other:<descriptor>` survives as one token.
function splitUnionInner(inner) {
  const tokens = [];
  let depth = 0;
  let cur = '';
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === '<') depth++;
    else if (ch === '>') depth--;
    if (ch === '|' && depth === 0) {
      const t = cur.trim();
      if (t) tokens.push(t);
      cur = '';
    } else {
      cur += ch;
    }
  }
  const last = cur.trim();
  if (last) tokens.push(last);
  return tokens;
}

function inferFieldType(rawDescriptor) {
  const trimmed = String(rawDescriptor || '').trim();
  // Rule fields commonly include inline prose after `<rule>`, e.g.
  //   `<rule> (If typed as <descriptor>, value MUST be ...)`
  // Match the leading `<rule>` token specifically.
  if (/^<\s*rule\s*>/i.test(trimmed)) return { type: 'rule' };

  // Non-union literal: <integer>, <descriptor>, <list of Foo_Block>, etc.
  // (No `|` inside the outermost angle brackets.)
  const literal = trimmed.match(/^<\s*([A-Za-z0-9_]+(?:\s+of\s+[A-Za-z0-9_]+)?)\s*>$/);
  if (literal) {
    const lit = literal[1].toLowerCase();
    if (PRIMARY_TYPE_KEYWORDS.has(lit)) return { type: lit };
    // <SomeBlock> or <list of SomeBlock>
    const block = extractBlockSchemaName(trimmed);
    if (block) return { type: block.kind, blockSchemaName: block.name };
    return { type: 'string' };
  }

  // Union form: <a | b | c | ...>
  const unionMatch = trimmed.match(/^<([\s\S]+)>$/);
  if (!unionMatch) return { type: 'string' };
  const tokens = splitUnionInner(unionMatch[1]);
  if (tokens.length === 0) return { type: 'string' };

  // Pull out structured tokens: block / list-of-block / other:<X>
  let blockSchemaName = null;
  let blockKind = null;
  let allowOtherType = null; // 'descriptor' | 'string' | null
  const literalValues = []; // genuine enum literals
  const allowedSpecialValues = []; // optional/unset/unknown/none/etc. + sentinel literals like "adult"
  let typeKeyword = null;

  for (const tok of tokens) {
    const lower = tok.toLowerCase();
    // list of XYZ_Block
    const listOfBlock = tok.match(/^list\s+of\s+([A-Za-z0-9_]+_Block)$/i);
    if (listOfBlock) {
      blockKind = 'block_list';
      blockSchemaName = listOfBlock[1];
      continue;
    }
    // Plain XYZ_Block (without "list of")
    const blockSingle = tok.match(/^([A-Za-z0-9_]+_Block)$/);
    if (blockSingle) {
      blockKind = 'block';
      blockSchemaName = blockSingle[1];
      continue;
    }
    // other:<descriptor> or other:<string>
    const otherType = tok.match(/^other:\s*<\s*([A-Za-z0-9_]+)\s*>$/i);
    if (otherType) {
      const ot = otherType[1].toLowerCase();
      allowOtherType = PRIMARY_TYPE_KEYWORDS.has(ot) ? ot : 'descriptor';
      continue;
    }
    // other:<string> with text after — like `other:<string>` is the canonical
    // Bare "other" without <X> — treat as literal enum
    if (PRIMARY_TYPE_KEYWORDS.has(lower)) {
      typeKeyword = lower;
      continue;
    }
    if (OPTIONALITY_TOKENS.has(lower)) {
      allowedSpecialValues.push(tok);
      continue;
    }
    // Anything else is a genuine enum literal value (e.g. "slim", "curvy", "adult",
    // "fictional", "original", etc.).
    literalValues.push(tok);
  }

  // Block list / single block first (they fully determine the type)
  if (blockKind === 'block_list') return { type: 'block_list', blockSchemaName };
  if (blockKind === 'block') return { type: 'block', blockSchemaName };

  // If a primary type keyword appeared, the field IS that type.
  // Literal values (e.g. "adult" inside <integer | adult>) are accepted
  // as additional sentinels.
  if (typeKeyword) {
    const out = { type: typeKeyword };
    if (allowedSpecialValues.length || literalValues.length) {
      out.allowedSpecialValues = [...allowedSpecialValues, ...literalValues];
    }
    return out;
  }

  // Pure enum (only literal values, possibly + optional/unknown sentinels +
  // optional descriptor/string fallback).
  if (literalValues.length) {
    const out = { type: 'enum', enumValues: literalValues };
    if (allowOtherType) out.allowOtherType = allowOtherType;
    if (allowedSpecialValues.length) out.allowedSpecialValues = allowedSpecialValues;
    return out;
  }

  // Only special tokens (e.g. <unknown>) — fall back to string.
  return { type: 'string', allowedSpecialValues };
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
        // WP-0103: extension flags from union-aware inference. Validators
        // honor these to skip noisy enum warnings on string fields and
        // accept descriptor / string fallbacks for enum-with-other unions.
        allowedSpecialValues: inferred.allowedSpecialValues,
        allowOtherType: inferred.allowOtherType,
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
