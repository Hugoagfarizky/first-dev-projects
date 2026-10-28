export const HTTP_METHODS = Object.freeze(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
export const DEFAULT_REQUEST_TIMEOUT_MS = 10000;
export const MAX_REQUEST_TIMEOUT_MS = 120000;

const METHOD_SET = new Set(HTTP_METHODS);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validation(ok, errors, value) {
  return {
    ok,
    valid: ok,
    errors: [...errors],
    value,
  };
}

export function validateMethod(value) {
  const errors = [];
  if (typeof value !== 'string') {
    errors.push('Method harus berupa string.');
    return validation(false, errors, null);
  }
  const method = value.trim().toUpperCase();
  if (!METHOD_SET.has(method)) {
    errors.push(`Method tidak didukung: ${value}.`);
    return validation(false, errors, null);
  }
  return validation(true, errors, method);
}

export function validateUrl(value) {
  const errors = [];
  if (typeof value !== 'string' || value.trim() === '') {
    errors.push('URL harus berupa string non-kosong.');
    return validation(false, errors, null);
  }
  if (/[\u0000-\u001f\u007f]/.test(value)) {
    errors.push('URL tidak boleh mengandung karakter kontrol.');
    return validation(false, errors, null);
  }

  let parsed;
  try {
    parsed = new URL(value.trim());
  } catch {
    errors.push('URL tidak valid.');
    return validation(false, errors, null);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    errors.push('URL harus menggunakan protokol http: atau https:.');
  }
  if (parsed.username !== '' || parsed.password !== '') {
    errors.push('URL tidak boleh mengandung username atau password.');
  }
  if (parsed.hostname === '') {
    errors.push('URL harus memiliki host.');
  }

  if (errors.length > 0) {
    return validation(false, errors, null);
  }

  return validation(true, errors, parsed.href);
}

export function validateTimeout(value, options = {}) {
  const errors = [];
  const defaultTimeout = Number.isInteger(options.defaultTimeoutMs)
    ? options.defaultTimeoutMs
    : DEFAULT_REQUEST_TIMEOUT_MS;

  if (value === undefined || value === null) {
    return validation(true, errors, defaultTimeout);
  }
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    errors.push('Timeout harus berupa integer.');
    return validation(false, errors, null);
  }
  if (value <= 0) {
    errors.push('Timeout harus lebih besar dari 0.');
  }
  if (value > MAX_REQUEST_TIMEOUT_MS) {
    errors.push(`Timeout maksimum adalah ${MAX_REQUEST_TIMEOUT_MS} ms.`);
  }
  if (errors.length > 0) {
    return validation(false, errors, null);
  }
  return validation(true, errors, value);
}

export function validateRequest(request) {
  const errors = [];
  if (!isPlainObject(request)) {
    return {
      ok: false,
      valid: false,
      errors: ['Request harus berupa objek.'],
      request: null,
    };
  }

  const methodResult = validateMethod(request.method);
  if (!methodResult.valid) {
    errors.push(...methodResult.errors);
  }

  const urlResult = validateUrl(request.url);
  if (!urlResult.valid) {
    errors.push(...urlResult.errors);
  }

  const timeoutResult = validateTimeout(request.timeoutMs, {
    defaultTimeoutMs: request.defaultTimeoutMs,
  });
  if (!timeoutResult.valid) {
    errors.push(...timeoutResult.errors);
  }

  if (errors.length > 0) {
    return {
      ok: false,
      valid: false,
      errors,
      request: null,
    };
  }

  return {
    ok: true,
    valid: true,
    errors: [],
    request: {
      method: methodResult.value,
      url: urlResult.value,
      timeoutMs: timeoutResult.value,
    },
  };
}