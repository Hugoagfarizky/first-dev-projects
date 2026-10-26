import { validateDiagram } from './diagram-model.js';

export const STORAGE_KEY = 'diagramforge.diagram';
export const STORAGE_SCHEMA_VERSION = 1;

function clone(value) {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function isStorageLike(storage) {
  return storage !== null && typeof storage === 'object' && typeof storage.getItem === 'function' && typeof storage.setItem === 'function';
}

function resolveStorage(storage) {
  if (storage !== undefined) {
    return { storage };
  }

  try {
    return { storage: globalThis.localStorage };
  } catch (error) {
    return {
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

function createPayload(diagram) {
  const validation = validateDiagram(diagram);
  if (!validation.valid) {
    throw new Error(validation.errors.join(' '));
  }

  return {
    app: 'diagramforge',
    schemaVersion: STORAGE_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    diagram: clone(diagram),
  };
}

export function validateStoredPayload(payload) {
  const errors = [];

  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    return { valid: false, errors: ['Payload storage harus berupa objek.'] };
  }

  const allowedRootKeys = new Set(['app', 'schemaVersion', 'savedAt', 'diagram']);
  for (const key of Object.keys(payload)) {
    if (!allowedRootKeys.has(key)) {
      errors.push(`Payload storage memiliki field asing: ${key}.`);
    }
  }

  if (payload.app !== 'diagramforge') {
    errors.push('Payload storage.app harus "diagramforge".');
  }
  if (payload.schemaVersion !== STORAGE_SCHEMA_VERSION) {
    errors.push('Payload storage.schemaVersion tidak didukung.');
  }
  if (typeof payload.savedAt !== 'string' || Number.isNaN(Date.parse(payload.savedAt))) {
    errors.push('Payload storage.savedAt harus berupa timestamp yang valid.');
  }
  if (!('diagram' in payload)) {
    errors.push('Payload storage kehilangan field wajib: diagram.');
  } else {
    const diagramResult = validateDiagram(payload.diagram);
    if (!diagramResult.valid) {
      errors.push(...diagramResult.errors);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function loadDiagram(storage) {
  const resolved = resolveStorage(storage);
  if (resolved.error) {
    return {
      status: 'unavailable',
      diagram: null,
      savedAt: null,
      error: `Storage tidak dapat diakses: ${resolved.error.message}.`,
    };
  }
  storage = resolved.storage;

  if (!isStorageLike(storage)) {
    return {
      status: 'unavailable',
      diagram: null,
      savedAt: null,
      error: 'Storage tidak tersedia.',
    };
  }

  let raw;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch (error) {
    return {
      status: 'error',
      diagram: null,
      savedAt: null,
      error: `Gagal membaca storage: ${error?.message ?? 'kesalahan tidak diketahui'}.`,
    };
  }

  if (raw === null || raw === undefined) {
    return {
      status: 'empty',
      diagram: null,
      savedAt: null,
      error: null,
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return {
      status: 'invalid',
      diagram: null,
      savedAt: null,
      error: `Data storage bukan JSON valid: ${error?.message ?? 'kesalahan tidak diketahui'}.`,
    };
  }

  const validation = validateStoredPayload(parsed);
  if (!validation.valid) {
    return {
      status: 'invalid',
      diagram: null,
      savedAt: null,
      error: validation.errors.join(' '),
    };
  }

  return {
    status: 'loaded',
    diagram: clone(parsed.diagram),
    savedAt: parsed.savedAt,
    error: null,
  };
}

export function saveDiagram(diagram, storage) {
  const resolved = resolveStorage(storage);
  if (resolved.error) {
    return {
      ok: false,
      status: 'unavailable',
      savedAt: null,
      error: `Storage tidak dapat diakses: ${resolved.error.message}.`,
    };
  }
  storage = resolved.storage;

  const validation = validateDiagram(diagram);
  if (!validation.valid) {
    return {
      ok: false,
      status: 'invalid',
      savedAt: null,
      error: validation.errors.join(' '),
    };
  }

  if (!isStorageLike(storage)) {
    return {
      ok: false,
      status: 'unavailable',
      savedAt: null,
      error: 'Storage tidak tersedia.',
    };
  }

  let payload;
  let serialized;
  try {
    payload = createPayload(diagram);
    serialized = JSON.stringify(payload);
  } catch (error) {
    return {
      ok: false,
      status: 'serialization_error',
      savedAt: null,
      error: `Gagal membuat payload storage: ${error?.message ?? 'kesalahan tidak diketahui'}.`,
    };
  }

  try {
    storage.setItem(STORAGE_KEY, serialized);
  } catch (error) {
    const isQuota = error?.name === 'QuotaExceededError' || /quota/i.test(String(error?.message ?? ''));
    return {
      ok: false,
      status: isQuota ? 'quota_exceeded' : 'write_error',
      savedAt: null,
      error: isQuota
        ? 'Penyimpanan lokal penuh. Diagram tetap berlaku di memori.'
        : `Gagal menulis storage: ${error?.message ?? 'kesalahan tidak diketahui'}.`,
    };
  }

  if (typeof storage.getItem === 'function') {
    let readBack;
    try {
      readBack = storage.getItem(STORAGE_KEY);
    } catch (error) {
      return {
        ok: false,
        status: 'verification_error',
        savedAt: null,
        error: `Gagal memverifikasi penulisan: ${error?.message ?? 'kesalahan tidak diketahui'}.`,
      };
    }

    if (readBack !== serialized) {
      return {
        ok: false,
        status: 'verification_failed',
        savedAt: null,
        error: 'Penulisan storage tidak dapat diverifikasi.',
      };
    }
  }

  return {
    ok: true,
    status: 'saved',
    savedAt: payload.savedAt,
    error: null,
  };
}

export function clearDiagram(storage) {
  const resolved = resolveStorage(storage);
  if (resolved.error) {
    return {
      ok: false,
      status: 'unavailable',
      error: `Storage tidak dapat diakses: ${resolved.error.message}.`,
    };
  }
  storage = resolved.storage;

  if (!isStorageLike(storage)) {
    return {
      ok: false,
      status: 'unavailable',
      error: 'Storage tidak tersedia.',
    };
  }

  try {
    if (typeof storage.removeItem === 'function') {
      storage.removeItem(STORAGE_KEY);
    } else {
      storage.setItem(STORAGE_KEY, '');
    }
    return { ok: true, status: 'cleared', error: null };
  } catch (error) {
    return {
      ok: false,
      status: 'clear_error',
      error: `Gagal menghapus data storage: ${error?.message ?? 'kesalahan tidak diketahui'}.`,
    };
  }
}

export const load = loadDiagram;
export const save = saveDiagram;
export const clear = clearDiagram;
export const readDiagram = loadDiagram;
export const writeDiagram = saveDiagram;
