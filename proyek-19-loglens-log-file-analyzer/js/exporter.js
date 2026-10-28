const FALLBACK_STEM = 'loglens-filtered';
const LOG_SUFFIX = '.log';
const MAX_FILENAME_BYTES = 255;
const MAX_FILENAME_UNITS = 255;
const MAX_STEM_BYTES = MAX_FILENAME_BYTES - LOG_SUFFIX.length;
const MAX_STEM_UNITS = MAX_FILENAME_UNITS - LOG_SUFFIX.length;
const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001f\u007f-\u009f]/g;
const BIDI_CONTROL_CHARS = /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;
const RESERVED_WINDOWS_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9]|conin\$|conout\$|clock\$)$/i;
const EDGE_CHARS = /^[.\-\s]+|[.\-\s]+$/g;
const TRAILING_INVALID_CHARS = /[.\-\s]+$/g;

function replaceUnpairedSurrogates(value) {
  let result = '';

  for (const character of value.normalize('NFC')) {
    const codePoint = character.codePointAt(0);
    if (character.length === 1 && codePoint >= 0xd800 && codePoint <= 0xdfff) {
      result += '-';
    } else {
      result += character;
    }
  }

  return result;
}

function codePointByteLength(codePoint) {
  if (codePoint <= 0x7f) {
    return 1;
  }
  if (codePoint <= 0x7ff) {
    return 2;
  }
  if (codePoint <= 0xffff) {
    return 3;
  }
  return 4;
}

function truncateStem(stem) {
  let bytes = 0;
  let units = 0;
  let end = 0;

  for (const character of stem) {
    const characterBytes = codePointByteLength(character.codePointAt(0));
    if (bytes + characterBytes > MAX_STEM_BYTES
      || units + character.length > MAX_STEM_UNITS) {
      break;
    }

    bytes += characterBytes;
    units += character.length;
    end += character.length;
  }

  return stem.slice(0, end).replace(TRAILING_INVALID_CHARS, '');
}

/**
 * Sanitize a user-facing export name into a safe single-component `.log`
 * filename. Path components are discarded, unsafe characters and Unicode
 * bidi controls are replaced, Windows device names are prefixed, and the
 * result is limited to 255 UTF-8 bytes and 255 UTF-16 code units including
 * the suffix.
 */
export function sanitizeExportFilename(value) {
  const source = typeof value === 'string' ? replaceUnpairedSurrogates(value).trim() : '';

  if (source === '') {
    return `${FALLBACK_STEM}${LOG_SUFFIX}`;
  }

  const base = (source.split(/[\\/]/).pop() || '')
    .replace(INVALID_FILENAME_CHARS, '-')
    .replace(BIDI_CONTROL_CHARS, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

  let stem = base.replace(EDGE_CHARS, '');
  stem = stem.replace(/\.log$/i, '').replace(TRAILING_INVALID_CHARS, '');

  if (stem === '') {
    return `${FALLBACK_STEM}${LOG_SUFFIX}`;
  }

  if (RESERVED_WINDOWS_NAME.test(stem.split('.', 1)[0])) {
    stem = `log-${stem}`;
  }

  stem = truncateStem(stem);
  return `${stem === '' ? FALLBACK_STEM : stem}${LOG_SUFFIX}`;
}

/**
 * Build export text and metadata without creating a Blob or touching the DOM.
 * Every record becomes exactly one output line, followed by a final LF when
 * there is at least one record. Empty raw lines are preserved.
 */
export function buildExport(records, options = {}) {
  const settings = options && typeof options === 'object' ? options : {};
  const filename = sanitizeExportFilename(settings.filename);

  if (!Array.isArray(records)) {
    return {
      ok: false,
      content: '',
      filename,
      lineCount: 0,
      byteLength: 0,
      mimeType: 'text/plain;charset=utf-8',
      lineEnding: '\n',
      error: {
        code: 'invalid-records',
        message: 'Records harus berupa array.',
      },
    };
  }

  const lines = records.map((record) => {
    const raw = typeof record?.raw === 'string' ? record.raw : String(record?.raw ?? '');
    return raw.replace(/\r\n|\r|\n/g, '');
  });

  const content = lines.length === 0 ? '' : `${lines.join('\n')}\n`;
  const byteLength = new TextEncoder().encode(content).byteLength;

  return {
    ok: true,
    content,
    filename,
    lineCount: lines.length,
    byteLength,
    mimeType: 'text/plain;charset=utf-8',
    lineEnding: '\n',
    error: null,
  };
}
