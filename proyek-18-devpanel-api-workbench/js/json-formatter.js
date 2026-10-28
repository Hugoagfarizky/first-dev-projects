function isString(value) {
  return typeof value === 'string';
}

function parseResult(ok, value, error) {
  return {
    ok,
    valid: ok,
    value: ok ? value : null,
    error: ok ? null : error,
  };
}

export function parseJson(text) {
  if (!isString(text)) {
    return parseResult(false, null, 'Input JSON harus berupa string.');
  }
  if (text.trim() === '') {
    return parseResult(false, null, 'Input JSON kosong.');
  }
  try {
    return parseResult(true, JSON.parse(text), null);
  } catch (error) {
    return parseResult(false, null, `JSON tidak valid: ${error.message}`);
  }
}

export function formatJson(value, space = 2) {
  try {
    const indent = Number.isInteger(space) && space >= 0 ? space : 2;
    const result = JSON.stringify(value, null, indent);
    if (result === undefined) {
      throw new Error('Nilai tidak dapat diserialisasi ke JSON.');
    }
    return result;
  } catch (error) {
    throw new Error(`Gagal memformat JSON: ${error.message}`);
  }
}

export function compactJson(value) {
  try {
    const result = JSON.stringify(value);
    if (result === undefined) {
      throw new Error('Nilai tidak dapat diserialisasi ke JSON.');
    }
    return result;
  } catch (error) {
    throw new Error(`Gagal memampatkan JSON: ${error.message}`);
  }
}

export function formatJsonText(text, space = 2) {
  const parsed = parseJson(text);
  if (!parsed.ok) {
    return {
      ok: false,
      valid: false,
      formatted: null,
      error: parsed.error,
    };
  }
  try {
    return {
      ok: true,
      valid: true,
      formatted: formatJson(parsed.value, space),
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      valid: false,
      formatted: null,
      error: error.message,
    };
  }
}

export function compactJsonText(text) {
  const parsed = parseJson(text);
  if (!parsed.ok) {
    return {
      ok: false,
      valid: false,
      compact: null,
      error: parsed.error,
    };
  }
  try {
    return {
      ok: true,
      valid: true,
      compact: compactJson(parsed.value),
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      valid: false,
      compact: null,
      error: error.message,
    };
  }
}