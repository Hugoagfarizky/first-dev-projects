import { validateMethod, validateUrl, validateTimeout } from './request-model.js';

export const DEFAULT_MAX_RESPONSE_BODY_BYTES = 1024 * 1024;

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function errorResult(type, message, extra = {}) {
  return {
    ok: false,
    type,
    error: message,
    ...extra,
  };
}

function headersToObject(headers) {
  const result = {};
  if (headers && typeof headers.forEach === 'function') {
    headers.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }
  if (isPlainObject(headers)) {
    return { ...headers };
  }
  return result;
}

async function readBodyWithLimit(response, limit) {
  const contentLengthHeader = response.headers?.get?.('content-length');
  const declaredSize = contentLengthHeader === null || contentLengthHeader === undefined
    ? null
    : Number(contentLengthHeader);

  if (declaredSize !== null && Number.isFinite(declaredSize) && declaredSize > limit) {
    try {
      await response.body?.cancel?.();
    } catch {
      // Ignore cleanup errors.
    }
    return {
      bodyText: null,
      bodySize: declaredSize,
      truncated: true,
      readError: null,
    };
  }

  if (response.body && typeof response.body.getReader === 'function') {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let received = 0;
    let text = '';
    let truncated = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        if (received + value.byteLength > limit) {
          const allowed = limit - received;
          if (allowed > 0) {
            text += decoder.decode(value.slice(0, allowed), { stream: true });
            received += allowed;
          }
          truncated = true;
          try {
            await reader.cancel();
          } catch {
            // Ignore cleanup errors.
          }
          break;
        }
        text += decoder.decode(value, { stream: true });
        received += value.byteLength;
      }
      if (!truncated) {
        text += decoder.decode();
      }
      return { bodyText: text, bodySize: received, truncated, readError: null };
    } catch (error) {
      try {
        await reader.cancel();
      } catch {
        // Ignore cleanup errors.
      }
      return { bodyText: null, bodySize: received, truncated, readError: error };
    }
  }

  try {
    const text = await response.text();
    const bytes = new TextEncoder().encode(text);
    if (bytes.length > limit) {
      const truncatedText = new TextDecoder().decode(bytes.slice(0, limit));
      return { bodyText: truncatedText, bodySize: bytes.length, truncated: true, readError: null };
    }
    return { bodyText: text, bodySize: bytes.length, truncated: false, readError: null };
  } catch (error) {
    return { bodyText: null, bodySize: 0, truncated: false, readError: error };
  }
}

export async function sendRequest(request, options = {}) {
  const fetchImpl = typeof options.fetchImpl === 'function' ? options.fetchImpl : globalThis.fetch;
  const now = typeof options.now === 'function' ? options.now : nowMs;
  const setTimeoutFn = typeof options.setTimeoutFn === 'function'
    ? options.setTimeoutFn
    : (typeof globalThis.setTimeout === 'function' ? globalThis.setTimeout.bind(globalThis) : null);
  const clearTimeoutFn = typeof options.clearTimeoutFn === 'function'
    ? options.clearTimeoutFn
    : (typeof globalThis.clearTimeout === 'function' ? globalThis.clearTimeout.bind(globalThis) : null);
  const maxBytes = Number.isInteger(options.maxResponseBodyBytes) && options.maxResponseBodyBytes > 0
    ? options.maxResponseBodyBytes
    : DEFAULT_MAX_RESPONSE_BODY_BYTES;

  if (!isPlainObject(request)) {
    return errorResult('invalid-request', 'Request harus berupa objek.', {
      durationMs: 0,
      validationErrors: ['Request harus berupa objek.'],
    });
  }

  const methodResult = validateMethod(request.method);
  const urlResult = validateUrl(request.url);
  const timeoutResult = validateTimeout(request.timeoutMs, {
    defaultTimeoutMs: request.defaultTimeoutMs,
  });
  const errors = [];
  if (!methodResult.valid) errors.push(...methodResult.errors);
  if (!urlResult.valid) errors.push(...urlResult.errors);
  if (!timeoutResult.valid) errors.push(...timeoutResult.errors);
  if (errors.length > 0) {
    return errorResult('invalid-request', errors.join(' '), {
      durationMs: 0,
      validationErrors: errors,
    });
  }

  const normalizedRequest = {
    method: methodResult.value,
    url: urlResult.value,
    timeoutMs: timeoutResult.value,
    headers: isPlainObject(request.headers) ? request.headers : {},
    body: request.body === undefined ? null : request.body,
  };
  const externalSignal = options.signal instanceof AbortSignal ? options.signal : null;

  let controller = null;
  let timeoutId = null;
  let timedOut = false;
  let abortedByUser = false;

  if (externalSignal?.aborted) {
    return errorResult('aborted', 'Request was aborted.', { durationMs: 0 });
  }

  if (normalizedRequest.timeoutMs > 0 || externalSignal) {
    if (typeof AbortController === 'function') {
      controller = new AbortController();
    }
  }

  if (controller && externalSignal) {
    externalSignal.addEventListener('abort', () => {
      abortedByUser = true;
      try {
        controller.abort();
      } catch {
        // Ignore abort errors.
      }
    }, { once: true });
  }

  if (controller && normalizedRequest.timeoutMs > 0 && setTimeoutFn) {
    timeoutId = setTimeoutFn(() => {
      timedOut = true;
      try {
        controller.abort();
      } catch {
        // Ignore abort errors.
      }
    }, normalizedRequest.timeoutMs);
  }

  const signal = controller ? controller.signal : externalSignal;
  const startedAt = now();
  let response;

  try {
    if (typeof fetchImpl !== 'function') {
      throw new Error('Fetch API tidak tersedia.');
    }
    response = await fetchImpl(normalizedRequest.url, {
      method: normalizedRequest.method,
      headers: normalizedRequest.headers,
      body: normalizedRequest.body,
      signal,
    });
  } catch (error) {
    const durationMs = Math.max(0, now() - startedAt);
    if (timeoutId !== null && clearTimeoutFn) {
      try {
        clearTimeoutFn(timeoutId);
      } catch {
        // Ignore timer errors.
      }
    }
    if (timedOut) {
      return errorResult('timeout', 'Request timed out.', { durationMs });
    }
    if (abortedByUser || externalSignal?.aborted) {
      return errorResult('aborted', 'Request was aborted.', { durationMs });
    }
    return errorResult('network-error', 'Network request failed.', { durationMs });
  }

  if (timeoutId !== null && clearTimeoutFn) {
    try {
      clearTimeoutFn(timeoutId);
    } catch {
      // Ignore timer errors.
    }
  }

  const durationMs = Math.max(0, now() - startedAt);
  const headers = headersToObject(response.headers);

  const bodyResult = await readBodyWithLimit(response, maxBytes);
  if (bodyResult.readError) {
    return errorResult('response-read-error', 'Failed to read response body.', {
      status: response.status,
      statusText: response.statusText,
      headers,
      durationMs,
      bodySize: bodyResult.bodySize,
      truncated: bodyResult.truncated,
    });
  }

  return {
    ok: true,
    httpOk: response.status >= 200 && response.status < 300,
    status: response.status,
    statusText: response.statusText,
    headers,
    bodyText: bodyResult.bodyText,
    bodySize: bodyResult.bodySize,
    truncated: bodyResult.truncated,
    durationMs,
  };
}

export function createHttpClient(options = {}) {
  return {
    sendRequest: (request, requestOptions = {}) => sendRequest(request, { ...options, ...requestOptions }),
  };
}