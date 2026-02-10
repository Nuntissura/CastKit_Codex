function detectNewline(text) {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

function splitLinesPreserveFinalEmpty(text) {
  const newline = detectNewline(text);
  const hasFinalNewline = text.endsWith(newline) || (newline === '\n' && text.endsWith('\n'));
  const rawLines = text.split(/\r?\n/);
  if (!hasFinalNewline) return { newline, hasFinalNewline, lines: rawLines };
  // If text ends with a newline, split() yields a trailing empty string; keep it.
  return { newline, hasFinalNewline, lines: rawLines };
}

module.exports = {
  detectNewline,
  splitLinesPreserveFinalEmpty,
};

