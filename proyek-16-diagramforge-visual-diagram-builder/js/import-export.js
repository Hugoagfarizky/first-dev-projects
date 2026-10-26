import { validateDiagram } from './diagram-model.js';

const MAX_IMPORT_BYTES = 1024 * 1024;

function clone(value) {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

export const IMPORT_SIZE_LIMIT = MAX_IMPORT_BYTES;

function normalizeInput(input) {
  if (typeof input === 'string') {
    return {
      text: input,
      size: new TextEncoder().encode(input).length,
    };
  }

  if (input !== null && typeof input === 'object') {
    if (typeof input.text === 'string') {
      const size = Number.isFinite(input.size) ? input.size : new TextEncoder().encode(input.text).length;
      return { text: input.text, size };
    }
    if (typeof input.content === 'string') {
      const size = Number.isFinite(input.size) ? input.size : new TextEncoder().encode(input.content).length;
      return { text: input.content, size };
    }
  }

  throw new Error('Input impor harus berupa teks JSON.');
}

export function validateImportPayload(payload) {
  const errors = [];

  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    return { valid: false, errors: ['Payload impor harus berupa objek.'] };
  }

  const allowedRootKeys = new Set(['app', 'schemaVersion', 'exportedAt', 'diagram']);
  for (const key of Object.keys(payload)) {
    if (!allowedRootKeys.has(key)) {
      errors.push(`Payload impor memiliki field asing: ${key}.`);
    }
  }

  if (payload.app !== 'diagramforge') {
    errors.push('Payload impor.app harus "diagramforge".');
  }
  if (payload.schemaVersion !== 1) {
    errors.push('Payload impor.schemaVersion harus 1.');
  }
  if (typeof payload.exportedAt !== 'string' || Number.isNaN(Date.parse(payload.exportedAt))) {
    errors.push('Payload impor.exportedAt harus berupa timestamp yang valid.');
  }
  if (!('diagram' in payload)) {
    errors.push('Payload impor kehilangan field wajib: diagram.');
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

export function exportDiagramJson(diagram) {
  const validation = validateDiagram(diagram);
  if (!validation.valid) {
    throw new Error(validation.errors.join(' '));
  }

  const payload = {
    app: 'diagramforge',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    diagram: clone(diagram),
  };

  return JSON.stringify(payload, null, 2);
}

export function importDiagramJson(input, options = {}) {
  const maxSize = Number.isFinite(options.maxSize) && options.maxSize > 0 ? options.maxSize : MAX_IMPORT_BYTES;
  const source = normalizeInput(input);

  if (source.size > maxSize) {
    throw new Error(`Ukuran file impor melebihi batas ${maxSize} byte.`);
  }

  let parsed;
  try {
    parsed = JSON.parse(source.text);
  } catch (error) {
    throw new Error(`JSON impor tidak valid: ${error?.message ?? 'kesalahan tidak diketahui'}.`);
  }

  const validation = validateImportPayload(parsed);
  if (!validation.valid) {
    throw new Error(validation.errors.join(' '));
  }

  return clone(parsed.diagram);
}

export const exportDiagram = exportDiagramJson;
export const exportDiagramJsonString = exportDiagramJson;
export const importDiagram = importDiagramJson;
export const parseDiagramJson = importDiagramJson;
export const validateImport = validateImportPayload;
export const importSizeLimit = MAX_IMPORT_BYTES;
