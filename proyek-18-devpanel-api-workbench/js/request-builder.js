import { validateMethod, validateUrl, validateTimeout, HTTP_METHODS } from './request-model.js';

const SENSITIVE_HEADER_NAMES = new Set(['authorization', 'cookie', 'x-api-key']);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function clone(value) {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function failure(errors, extra = {}) {
  return {
    ok: false,
    valid: false,
    errors: [...errors],
    ...extra,
  };
}

function success(value) {
  return {
    ok: true,
    valid: true,
    errors: [],
    ...value,
  };
}

export function normalizeQueryParams(value) {
  const errors = [];
  if (value === undefined || value === null) {
    return success({ params: [] });
  }

  let params = [];
  if (Array.isArray(value)) {
    for (const item of value) {
      if (!isPlainObject(item)) {
        errors.push('Setiap query parameter harus berupa objek.');
        continue;
      }
      if (typeof item.key !== 'string' || item.key.trim() === '') {
        errors.push('Query parameter key harus berupa string non-kosong.');
        continue;
      }
      const enabled = item.enabled === undefined ? true : Boolean(item.enabled);
      params.push({
        key: item.key,
        value: item.value === undefined || item.value === null ? '' : String(item.value),
        enabled,
      });
    }
  } else if (isPlainObject(value)) {
    for (const [key, itemValue] of Object.entries(value)) {
      if (key.trim() === '') {
        errors.push('Query parameter key harus berupa string non-kosong.');
        continue;
      }
      params.push({
        key,
        value: itemValue === undefined || itemValue === null ? '' : String(itemValue),
        enabled: true,
      });
    }
  } else {
    errors.push('Query parameters harus berupa objek atau larik.');
  }

  if (errors.length > 0) {
    return failure(errors, { params: [] });
  }
  return success({ params });
}

export function appendQueryParams(url, params) {
  const urlResult = validateUrl(url);
  if (!urlResult.valid) {
    return failure(urlResult.errors, { url: null });
  }

  const paramsResult = normalizeQueryParams(params);
  if (!paramsResult.ok) {
    return failure(paramsResult.errors, { url: null });
  }

  let parsed;
  try {
    parsed = new URL(urlResult.value);
  } catch {
    return failure(['URL tidak valid.'], { url: null });
  }

  for (const param of paramsResult.params) {
    if (param.enabled) {
      parsed.searchParams.append(param.key, param.value);
    }
  }

  return success({ url: parsed.href });
}

export function normalizeHeaders(value, options = {}) {
  const errors = [];
  if (value === undefined || value === null) {
    return success({ headers: {}, sensitiveHeaders: [] });
  }

  const entries = [];
  if (Array.isArray(value)) {
    for (const item of value) {
      if (!isPlainObject(item)) {
        errors.push('Setiap header harus berupa objek.');
        continue;
      }
      entries.push([item.key, item.value]);
    }
  } else if (isPlainObject(value)) {
    for (const [key, headerValue] of Object.entries(value)) {
      entries.push([key, headerValue]);
    }
  } else {
    errors.push('Headers harus berupa objek atau larik.');
  }

  const headers = {};
  const seen = new Map();
  const sensitiveHeaders = [];

  for (const [rawKey, rawValue] of entries) {
    if (typeof rawKey !== 'string' || rawKey.trim() === '') {
      errors.push('Nama header harus berupa string non-kosong.');
      continue;
    }
    const key = rawKey.trim();
    if (!/^[!#$%&'*+.^_`|~A-Za-z0-9-]+$/.test(key)) {
      errors.push(`Nama header tidak valid: ${key}.`);
      continue;
    }
    if (typeof rawValue !== 'string') {
      errors.push(`Nilai header ${key} harus berupa string.`);
      continue;
    }
    if (/[\r\n\u0000-\u001f\u007f]/.test(rawValue)) {
      errors.push(`Nilai header ${key} tidak boleh mengandung karakter kontrol.`);
      continue;
    }

    const lower = key.toLowerCase();
    if (seen.has(lower)) {
      errors.push(`Header duplikat (case-insensitive): ${key}.`);
      continue;
    }
    seen.set(lower, key);

    headers[key] = rawValue;
    if (SENSITIVE_HEADER_NAMES.has(lower)) {
      sensitiveHeaders.push(key);
    }
  }

  if (errors.length > 0) {
    return failure(errors, { headers: {}, sensitiveHeaders: [] });
  }
  return success({ headers, sensitiveHeaders });
}

export function buildJsonBody(method, bodyText, contentType) {
  const methodResult = validateMethod(method);
  if (!methodResult.valid) {
    return failure(methodResult.errors, { body: null, contentType: null });
  }
  const normalizedMethod = methodResult.value;

  if (bodyText === undefined || bodyText === null || String(bodyText).trim() === '') {
    return success({ body: null, contentType: null });
  }

  if (normalizedMethod === 'GET') {
    return failure(['GET tidak boleh memiliki request body.'], { body: null, contentType: null });
  }

  const text = String(bodyText);
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return failure(['Body JSON tidak valid.'], { body: null, contentType: null });
  }

  const finalContentType = typeof contentType === 'string' && contentType.trim() !== ''
    ? contentType.trim()
    : 'application/json';

  return success({
    body: text,
    contentType: finalContentType,
    parsed,
  });
}

export function buildRequest(input) {
  if (!isPlainObject(input)) {
    return failure(['Input request builder harus berupa objek.'], { request: null });
  }

  const methodResult = validateMethod(input.method);
  const urlResult = validateUrl(input.url);
  const timeoutResult = validateTimeout(input.timeoutMs, {
    defaultTimeoutMs: input.defaultTimeoutMs,
  });

  const queryResult = normalizeQueryParams(input.queryParams);
  const headerResult = normalizeHeaders(input.headers);
  const bodyResult = buildJsonBody(
    methodResult.valid ? methodResult.value : input.method,
    input.body,
    input.contentType,
  );

  const errors = [];
  if (!methodResult.valid) errors.push(...methodResult.errors);
  if (!urlResult.valid) errors.push(...urlResult.errors);
  if (!timeoutResult.valid) errors.push(...timeoutResult.errors);
  if (!queryResult.ok) errors.push(...queryResult.errors);
  if (!headerResult.ok) errors.push(...headerResult.errors);
  if (!bodyResult.ok) errors.push(...bodyResult.errors);

  if (errors.length > 0) {
    return failure(errors, {
      request: null,
      sensitiveHeaders: headerResult.ok ? headerResult.sensitiveHeaders : [],
    });
  }

  const urlWithQuery = appendQueryParams(urlResult.value, queryResult.params);
  if (!urlWithQuery.ok) {
    return failure(urlWithQuery.errors, {
      request: null,
      sensitiveHeaders: headerResult.sensitiveHeaders,
    });
  }

  const headers = clone(headerResult.headers);
  if (bodyResult.body !== null && !Object.keys(headers).some((key) => key.toLowerCase() === 'content-type')) {
    headers['Content-Type'] = bodyResult.contentType;
  }

  const request = {
    method: methodResult.value,
    url: urlWithQuery.url,
    timeoutMs: timeoutResult.value,
    headers,
    body: bodyResult.body,
  };

  return success({
    request,
    sensitiveHeaders: headerResult.sensitiveHeaders,
  });
}

export { HTTP_METHODS };