import { formatJsonText, parseJson } from './json-formatter.js';

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function safeString(value) {
  return typeof value === 'string' ? value : '';
}

export function inspectResponse(result, options = {}) {
  const formatSpace = Number.isInteger(options.space) && options.space >= 0 ? options.space : 2;

  if (!isPlainObject(result)) {
    return {
      ok: false,
      type: 'invalid-input',
      error: 'Hasil HTTP client tidak valid.',
      status: null,
      statusText: '',
      httpOk: false,
      headers: {},
      headerEntries: [],
      body: {
        raw: null,
        formatted: null,
        isJson: false,
        truncated: false,
        size: 0,
      },
      durationMs: 0,
    };
  }

  if (result.ok !== true) {
    return {
      ok: false,
      type: result.type || 'request-failed',
      error: typeof result.error === 'string' ? result.error : 'Request gagal.',
      status: Number.isInteger(result.status) ? result.status : null,
      statusText: safeString(result.statusText),
      httpOk: false,
      headers: isPlainObject(result.headers) ? result.headers : {},
      headerEntries: isPlainObject(result.headers)
        ? Object.entries(result.headers).map(([name, value]) => ({ name, value: String(value) }))
        : [],
      body: {
        raw: result.bodyText === null || result.bodyText === undefined ? null : String(result.bodyText),
        formatted: null,
        isJson: false,
        truncated: Boolean(result.truncated),
        size: Number.isInteger(result.bodySize) ? result.bodySize : 0,
      },
      durationMs: Number.isFinite(result.durationMs) ? result.durationMs : 0,
    };
  }

  const headers = isPlainObject(result.headers) ? result.headers : {};
  const headerEntries = Object.entries(headers).map(([name, value]) => ({
    name,
    value: String(value),
  }));
  const rawBody = result.bodyText === null || result.bodyText === undefined ? '' : String(result.bodyText);
  const truncated = Boolean(result.truncated);

  let isJson = false;
  let formatted = null;
  if (rawBody.trim() !== '' && !truncated) {
    const parsed = parseJson(rawBody);
    if (parsed.ok) {
      isJson = true;
      const formattedResult = formatJsonText(rawBody, formatSpace);
      formatted = formattedResult.ok ? formattedResult.formatted : null;
    }
  }

  return {
    ok: true,
    type: 'http-response',
    error: null,
    status: result.status,
    statusText: safeString(result.statusText),
    httpOk: Boolean(result.httpOk),
    headers,
    headerEntries,
    body: {
      raw: rawBody === '' ? null : rawBody,
      formatted,
      isJson,
      truncated,
      size: Number.isInteger(result.bodySize) ? result.bodySize : new TextEncoder().encode(rawBody).length,
    },
    durationMs: Number.isFinite(result.durationMs) ? result.durationMs : 0,
  };
}