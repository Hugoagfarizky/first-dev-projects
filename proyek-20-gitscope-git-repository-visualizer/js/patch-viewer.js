export const MAX_PATCH_CHARS = 100000;
export const MAX_PATCH_LINES = 2000;

/**
 * Split a unified diff patch into classified lines without touching the DOM.
 * Truncation happens before the caller creates elements, so a very large patch
 * cannot produce an unbounded number of nodes.
 */
export function parsePatch(patch, {
  maxChars = MAX_PATCH_CHARS,
  maxLines = MAX_PATCH_LINES,
} = {}) {
  if (typeof patch !== 'string' || patch === '') {
    return {
      available: false,
      lines: [],
      truncated: false,
      truncatedChars: false,
      truncatedLines: false,
      totalLines: 0,
    };
  }

  const charLimit = normalizeLimit(maxChars, MAX_PATCH_CHARS);
  const lineLimit = normalizeLimit(maxLines, MAX_PATCH_LINES);
  const truncatedChars = patch.length > charLimit;
  const text = truncatedChars ? patch.slice(0, charLimit) : patch;
  const rawLines = text.split('\n');
  if (rawLines.length > 0 && rawLines[rawLines.length - 1] === '') {
    rawLines.pop();
  }

  const totalLines = rawLines.length;
  const truncatedLines = totalLines > lineLimit;
  const lines = rawLines.slice(0, lineLimit).map((line) => {
    const normalized = line.endsWith('\r') ? line.slice(0, -1) : line;
    return {
      text: normalized,
      type: classifyPatchLine(normalized),
    };
  });

  return {
    available: true,
    lines,
    truncated: truncatedChars || truncatedLines,
    truncatedChars,
    truncatedLines,
    totalLines,
  };
}

export function classifyPatchLine(line) {
  if (typeof line !== 'string') {
    return 'context';
  }
  if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('diff --git')) {
    return 'meta';
  }
  if (line.startsWith('@@')) {
    return 'hunk';
  }
  if (line.startsWith('\\')) {
    return 'meta';
  }
  if (line.startsWith('+')) {
    return 'addition';
  }
  if (line.startsWith('-')) {
    return 'deletion';
  }
  return 'context';
}

function normalizeLimit(value, fallback) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    return fallback;
  }
  return number;
}
