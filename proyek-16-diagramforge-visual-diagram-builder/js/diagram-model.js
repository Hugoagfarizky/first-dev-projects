const NODE_TYPES = Object.freeze([
  'startEnd',
  'process',
  'decision',
  'inputOutput',
]);

const NODE_DIMENSIONS = Object.freeze({
  startEnd: Object.freeze({ width: 140, height: 70 }),
  process: Object.freeze({ width: 160, height: 80 }),
  decision: Object.freeze({ width: 140, height: 140 }),
  inputOutput: Object.freeze({ width: 160, height: 80 }),
});

const LIMITS = Object.freeze({
  maxNodes: 200,
  maxEdges: 400,
  maxTextLength: 120,
  maxLabelLength: 80,
  maxNameLength: 80,
  coordinateLimit: 100000,
  minZoom: 0.25,
  maxZoom: 4,
});

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/;

const ROOT_KEYS = Object.freeze([
  'app',
  'schemaVersion',
  'id',
  'name',
  'createdAt',
  'updatedAt',
  'viewport',
  'nodes',
  'edges',
]);

const NODE_KEYS = Object.freeze([
  'id',
  'type',
  'x',
  'y',
  'width',
  'height',
  'text',
  'fill',
  'stroke',
  'textColor',
]);

const EDGE_KEYS = Object.freeze(['id', 'from', 'to', 'label']);
const VIEWPORT_KEYS = Object.freeze(['x', 'y', 'zoom']);

function clone(value) {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateId(value, fieldName, errors) {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    errors.push(`${fieldName} harus berupa ID aman dengan 1-64 karakter.`);
  }
}

function validateColor(value, fieldName, errors) {
  if (typeof value !== 'string' || !HEX_COLOR.test(value)) {
    errors.push(`${fieldName} harus berupa warna hex #rrggbb.`);
  }
}

function validateFiniteNumber(value, fieldName, errors, min = -Infinity, max = Infinity) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    errors.push(`${fieldName} harus berupa angka finite.`);
    return;
  }
  if (value < min || value > max) {
    errors.push(`${fieldName} berada di luar batas yang diizinkan.`);
  }
}

function validateTimestamp(value, fieldName, errors) {
  if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value) || Number.isNaN(Date.parse(value))) {
    errors.push(`${fieldName} harus berupa timestamp ISO 8601 UTC.`);
  }
}

function unknownKeys(object, allowedKeys, objectName, errors) {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(object)) {
    if (!allowed.has(key)) {
      errors.push(`${objectName} memiliki field asing: ${key}.`);
    }
  }
}

function validateNode(node, errors, nodeIds, index) {
  if (!isPlainObject(node)) {
    errors.push(`Node pada indeks ${index} harus berupa objek.`);
    return;
  }

  unknownKeys(node, NODE_KEYS, `Node ${index}`, errors);

  for (const key of NODE_KEYS) {
    if (!(key in node)) {
      errors.push(`Node ${index} kehilangan field wajib: ${key}.`);
    }
  }

  validateId(node.id, `Node ${index}.id`, errors);
  if (typeof node.id === 'string' && nodeIds.has(node.id)) {
    errors.push(`ID node duplikat: ${node.id}.`);
  }
  if (typeof node.id === 'string') {
    nodeIds.add(node.id);
  }

  if (!NODE_TYPES.includes(node.type)) {
    errors.push(`Node ${index}.type tidak valid: ${node.type}.`);
  }

  validateFiniteNumber(node.x, `Node ${index}.x`, errors, -LIMITS.coordinateLimit, LIMITS.coordinateLimit);
  validateFiniteNumber(node.y, `Node ${index}.y`, errors, -LIMITS.coordinateLimit, LIMITS.coordinateLimit);

  if (NODE_TYPES.includes(node.type)) {
    const expected = NODE_DIMENSIONS[node.type];
    if (node.width !== expected.width || node.height !== expected.height) {
      errors.push(`Ukuran node ${index} harus sesuai tipe ${node.type}.`);
    }
  } else {
    validateFiniteNumber(node.width, `Node ${index}.width`, errors, 1, LIMITS.coordinateLimit);
    validateFiniteNumber(node.height, `Node ${index}.height`, errors, 1, LIMITS.coordinateLimit);
  }

  if (typeof node.text !== 'string' || node.text.length > LIMITS.maxTextLength) {
    errors.push(`Node ${index}.text harus berupa string maksimum ${LIMITS.maxTextLength} karakter.`);
  }

  validateColor(node.fill, `Node ${index}.fill`, errors);
  validateColor(node.stroke, `Node ${index}.stroke`, errors);
  validateColor(node.textColor, `Node ${index}.textColor`, errors);
}

function validateEdge(edge, errors, edgeIds, nodeIds, index) {
  if (!isPlainObject(edge)) {
    errors.push(`Edge pada indeks ${index} harus berupa objek.`);
    return;
  }

  unknownKeys(edge, EDGE_KEYS, `Edge ${index}`, errors);

  for (const key of EDGE_KEYS) {
    if (!(key in edge)) {
      errors.push(`Edge ${index} kehilangan field wajib: ${key}.`);
    }
  }

  validateId(edge.id, `Edge ${index}.id`, errors);
  if (typeof edge.id === 'string' && edgeIds.has(edge.id)) {
    errors.push(`ID edge duplikat: ${edge.id}.`);
  }
  if (typeof edge.id === 'string') {
    edgeIds.add(edge.id);
  }

  validateId(edge.from, `Edge ${index}.from`, errors);
  validateId(edge.to, `Edge ${index}.to`, errors);

  if (typeof edge.from === 'string' && typeof edge.to === 'string' && edge.from === edge.to) {
    errors.push(`Edge ${index} tidak boleh menghubungkan node ke dirinya sendiri.`);
  }

  if (typeof edge.from === 'string' && !nodeIds.has(edge.from)) {
    errors.push(`Edge ${index}.from merujuk ke node yang tidak ada: ${edge.from}.`);
  }
  if (typeof edge.to === 'string' && !nodeIds.has(edge.to)) {
    errors.push(`Edge ${index}.to merujuk ke node yang tidak ada: ${edge.to}.`);
  }

  if (typeof edge.label !== 'string' || edge.label.length > LIMITS.maxLabelLength) {
    errors.push(`Edge ${index}.label harus berupa string maksimum ${LIMITS.maxLabelLength} karakter.`);
  }
}

export function validateDiagram(diagram) {
  const errors = [];

  if (!isPlainObject(diagram)) {
    return { valid: false, errors: ['Diagram harus berupa objek.'] };
  }

  unknownKeys(diagram, ROOT_KEYS, 'Diagram', errors);

  for (const key of ROOT_KEYS) {
    if (!(key in diagram)) {
      errors.push(`Diagram kehilangan field wajib: ${key}.`);
    }
  }

  if (diagram.app !== 'diagramforge') {
    errors.push('Diagram.app harus "diagramforge".');
  }

  if (diagram.schemaVersion !== 1) {
    errors.push('Diagram.schemaVersion harus 1.');
  }

  validateId(diagram.id, 'Diagram.id', errors);

  if (typeof diagram.name !== 'string' || diagram.name.length === 0 || diagram.name.length > LIMITS.maxNameLength) {
    errors.push(`Diagram.name harus berupa string 1-${LIMITS.maxNameLength} karakter.`);
  }

  validateTimestamp(diagram.createdAt, 'Diagram.createdAt', errors);
  validateTimestamp(diagram.updatedAt, 'Diagram.updatedAt', errors);

  if (!isPlainObject(diagram.viewport)) {
    errors.push('Diagram.viewport harus berupa objek.');
  } else {
    unknownKeys(diagram.viewport, VIEWPORT_KEYS, 'Diagram.viewport', errors);
    for (const key of VIEWPORT_KEYS) {
      if (!(key in diagram.viewport)) {
        errors.push(`Diagram.viewport kehilangan field wajib: ${key}.`);
      }
    }
    validateFiniteNumber(diagram.viewport.x, 'Diagram.viewport.x', errors, -LIMITS.coordinateLimit, LIMITS.coordinateLimit);
    validateFiniteNumber(diagram.viewport.y, 'Diagram.viewport.y', errors, -LIMITS.coordinateLimit, LIMITS.coordinateLimit);
    validateFiniteNumber(diagram.viewport.zoom, 'Diagram.viewport.zoom', errors, LIMITS.minZoom, LIMITS.maxZoom);
  }

  if (!Array.isArray(diagram.nodes)) {
    errors.push('Diagram.nodes harus berupa larik.');
  }
  if (!Array.isArray(diagram.edges)) {
    errors.push('Diagram.edges harus berupa larik.');
  }

  if (Array.isArray(diagram.nodes) && diagram.nodes.length > LIMITS.maxNodes) {
    errors.push(`Jumlah node melebihi batas ${LIMITS.maxNodes}.`);
  }
  if (Array.isArray(diagram.edges) && diagram.edges.length > LIMITS.maxEdges) {
    errors.push(`Jumlah edge melebihi batas ${LIMITS.maxEdges}.`);
  }

  const nodeIds = new Set();
  if (Array.isArray(diagram.nodes)) {
    diagram.nodes.forEach((node, index) => validateNode(node, errors, nodeIds, index));
  }

  const edgeIds = new Set();
  if (Array.isArray(diagram.edges)) {
    diagram.edges.forEach((edge, index) => validateEdge(edge, errors, edgeIds, nodeIds, index));
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function assertValidDiagram(diagram) {
  const result = validateDiagram(diagram);
  if (!result.valid) {
    throw new Error(result.errors.join(' '));
  }
  return diagram;
}

export function createId() {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }
  if (typeof cryptoApi?.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  }
  throw new Error('Web Crypto API tidak tersedia untuk membuat ID aman.');
}

function defaultText(type) {
  switch (type) {
    case 'startEnd':
      return 'Mulai';
    case 'process':
      return 'Proses';
    case 'decision':
      return 'Keputusan?';
    case 'inputOutput':
      return 'Input/Output';
    default:
      return '';
  }
}

function defaultFill(type) {
  switch (type) {
    case 'startEnd':
      return '#e8f7ef';
    case 'process':
      return '#e8f1ff';
    case 'decision':
      return '#fff4e5';
    case 'inputOutput':
      return '#f3e8ff';
    default:
      return '#e8f1ff';
  }
}

function defaultStroke(type) {
  switch (type) {
    case 'startEnd':
      return '#1f7a4d';
    case 'process':
      return '#1f4b99';
    case 'decision':
      return '#9a5b00';
    case 'inputOutput':
      return '#6b2fa0';
    default:
      return '#1f4b99';
  }
}

function defaultTextColor() {
  return '#10203a';
}

export function createDiagram(options = {}) {
  if (!isPlainObject(options)) {
    throw new Error('Opsi diagram harus berupa objek.');
  }

  const now = new Date().toISOString();
  const diagram = {
    app: 'diagramforge',
    schemaVersion: 1,
    id: options.id ?? createId(),
    name: options.name ?? 'Diagram tanpa judul',
    createdAt: options.createdAt ?? now,
    updatedAt: options.updatedAt ?? now,
    viewport: clone(options.viewport ?? { x: 0, y: 0, zoom: 1 }),
    nodes: clone(options.nodes ?? []),
    edges: clone(options.edges ?? []),
  };

  assertValidDiagram(diagram);
  return diagram;
}

export function createNode(type, x = 0, y = 0, options = {}) {
  if (!NODE_TYPES.includes(type)) {
    throw new Error(`Tipe node tidak valid: ${type}.`);
  }
  if (!isPlainObject(options)) {
    throw new Error('Opsi node harus berupa objek.');
  }
  if (Object.prototype.hasOwnProperty.call(options, 'width') || Object.prototype.hasOwnProperty.call(options, 'height')) {
    throw new Error('Ukuran node ditentukan oleh tipe node, bukan input bebas.');
  }

  const errors = [];
  validateFiniteNumber(x, 'x', errors, -LIMITS.coordinateLimit, LIMITS.coordinateLimit);
  validateFiniteNumber(y, 'y', errors, -LIMITS.coordinateLimit, LIMITS.coordinateLimit);
  if (errors.length > 0) {
    throw new Error(errors.join(' '));
  }

  const size = NODE_DIMENSIONS[type];
  const node = {
    id: options.id ?? createId(),
    type,
    x,
    y,
    width: size.width,
    height: size.height,
    text: options.text ?? defaultText(type),
    fill: options.fill ?? defaultFill(type),
    stroke: options.stroke ?? defaultStroke(type),
    textColor: options.textColor ?? defaultTextColor(),
  };

  const validation = validateNodeForCreation(node);
  if (!validation.valid) {
    throw new Error(validation.errors.join(' '));
  }

  return node;
}

function validateNodeForCreation(node) {
  const errors = [];
  const ids = new Set();
  validateNode(node, errors, ids, 0);
  return { valid: errors.length === 0, errors };
}

export function addNode(diagram, node) {
  const validDiagram = assertValidDiagram(clone(diagram));
  const nodeValidation = validateNodeForCreation(node);
  if (!nodeValidation.valid) {
    throw new Error(nodeValidation.errors.join(' '));
  }
  if (validDiagram.nodes.some((existing) => existing.id === node.id)) {
    throw new Error(`ID node duplikat: ${node.id}.`);
  }
  if (validDiagram.nodes.length >= LIMITS.maxNodes) {
    throw new Error(`Jumlah node melebihi batas ${LIMITS.maxNodes}.`);
  }

  const next = clone(validDiagram);
  next.nodes.push(clone(node));
  next.updatedAt = new Date().toISOString();
  assertValidDiagram(next);
  return next;
}

export function updateNode(diagram, nodeId, changes) {
  const validDiagram = assertValidDiagram(clone(diagram));
  if (!isPlainObject(changes)) {
    throw new Error('Perubahan node harus berupa objek.');
  }

  const index = validDiagram.nodes.findIndex((node) => node.id === nodeId);
  if (index === -1) {
    throw new Error(`Node tidak ditemukan: ${nodeId}.`);
  }

  const allowedChanges = new Set(['type', 'x', 'y', 'text', 'fill', 'stroke', 'textColor']);
  for (const key of Object.keys(changes)) {
    if (!allowedChanges.has(key)) {
      throw new Error(`Field node tidak dapat diubah: ${key}.`);
    }
  }

  const next = clone(validDiagram);
  const node = next.nodes[index];

  if (changes.type !== undefined) {
    if (!NODE_TYPES.includes(changes.type)) {
      throw new Error(`Tipe node tidak valid: ${changes.type}.`);
    }
    node.type = changes.type;
    node.width = NODE_DIMENSIONS[changes.type].width;
    node.height = NODE_DIMENSIONS[changes.type].height;
  }
  if (changes.x !== undefined) {
    const errors = [];
    validateFiniteNumber(changes.x, 'x', errors, -LIMITS.coordinateLimit, LIMITS.coordinateLimit);
    if (errors.length) throw new Error(errors.join(' '));
    node.x = changes.x;
  }
  if (changes.y !== undefined) {
    const errors = [];
    validateFiniteNumber(changes.y, 'y', errors, -LIMITS.coordinateLimit, LIMITS.coordinateLimit);
    if (errors.length) throw new Error(errors.join(' '));
    node.y = changes.y;
  }
  if (changes.text !== undefined) {
    if (typeof changes.text !== 'string' || changes.text.length > LIMITS.maxTextLength) {
      throw new Error(`Teks node maksimum ${LIMITS.maxTextLength} karakter.`);
    }
    node.text = changes.text;
  }
  if (changes.fill !== undefined) {
    if (!HEX_COLOR.test(changes.fill)) throw new Error('fill harus berupa warna hex #rrggbb.');
    node.fill = changes.fill;
  }
  if (changes.stroke !== undefined) {
    if (!HEX_COLOR.test(changes.stroke)) throw new Error('stroke harus berupa warna hex #rrggbb.');
    node.stroke = changes.stroke;
  }
  if (changes.textColor !== undefined) {
    if (!HEX_COLOR.test(changes.textColor)) throw new Error('textColor harus berupa warna hex #rrggbb.');
    node.textColor = changes.textColor;
  }

  const validation = validateNodeForCreation(node);
  if (!validation.valid) {
    throw new Error(validation.errors.join(' '));
  }

  next.updatedAt = new Date().toISOString();
  assertValidDiagram(next);
  return next;
}

export function removeNode(diagram, nodeId) {
  const validDiagram = assertValidDiagram(clone(diagram));
  if (!validDiagram.nodes.some((node) => node.id === nodeId)) {
    throw new Error(`Node tidak ditemukan: ${nodeId}.`);
  }

  const next = clone(validDiagram);
  next.nodes = next.nodes.filter((node) => node.id !== nodeId);
  next.edges = next.edges.filter((edge) => edge.from !== nodeId && edge.to !== nodeId);
  next.updatedAt = new Date().toISOString();
  assertValidDiagram(next);
  return next;
}

export function addEdge(diagram, from, to, label = '', options = {}) {
  const validDiagram = assertValidDiagram(clone(diagram));
  if (!isPlainObject(options)) {
    throw new Error('Opsi edge harus berupa objek.');
  }

  if (from === to) {
    throw new Error('Edge tidak boleh menghubungkan node ke dirinya sendiri.');
  }
  if (!validDiagram.nodes.some((node) => node.id === from)) {
    throw new Error(`Node sumber tidak ditemukan: ${from}.`);
  }
  if (!validDiagram.nodes.some((node) => node.id === to)) {
    throw new Error(`Node tujuan tidak ditemukan: ${to}.`);
  }
  if (typeof label !== 'string' || label.length > LIMITS.maxLabelLength) {
    throw new Error(`Label edge maksimum ${LIMITS.maxLabelLength} karakter.`);
  }

  const edge = {
    id: options.id ?? createId(),
    from,
    to,
    label,
  };

  const edgeValidation = validateEdgeForCreation(edge, validDiagram.nodes);
  if (!edgeValidation.valid) {
    throw new Error(edgeValidation.errors.join(' '));
  }
  if (validDiagram.edges.some((existing) => existing.id === edge.id)) {
    throw new Error(`ID edge duplikat: ${edge.id}.`);
  }
  if (validDiagram.edges.length >= LIMITS.maxEdges) {
    throw new Error(`Jumlah edge melebihi batas ${LIMITS.maxEdges}.`);
  }

  const next = clone(validDiagram);
  next.edges.push(clone(edge));
  next.updatedAt = new Date().toISOString();
  assertValidDiagram(next);
  return next;
}

function validateEdgeForCreation(edge, nodes) {
  const errors = [];
  const ids = new Set();
  validateEdge(edge, errors, ids, new Set(nodes.map((node) => node.id)), 0);
  return { valid: errors.length === 0, errors };
}

export function removeEdge(diagram, edgeId) {
  const validDiagram = assertValidDiagram(clone(diagram));
  if (!validDiagram.edges.some((edge) => edge.id === edgeId)) {
    throw new Error(`Edge tidak ditemukan: ${edgeId}.`);
  }

  const next = clone(validDiagram);
  next.edges = next.edges.filter((edge) => edge.id !== edgeId);
  next.updatedAt = new Date().toISOString();
  assertValidDiagram(next);
  return next;
}

export function updateEdge(diagram, edgeId, changes) {
  const validDiagram = assertValidDiagram(clone(diagram));
  if (!isPlainObject(changes)) {
    throw new Error('Perubahan edge harus berupa objek.');
  }

  const index = validDiagram.edges.findIndex((edge) => edge.id === edgeId);
  if (index === -1) {
    throw new Error(`Edge tidak ditemukan: ${edgeId}.`);
  }

  const allowedChanges = new Set(['label']);
  for (const key of Object.keys(changes)) {
    if (!allowedChanges.has(key)) {
      throw new Error(`Field edge tidak dapat diubah: ${key}.`);
    }
  }

  const next = clone(validDiagram);
  const edge = next.edges[index];

  if (changes.label !== undefined) {
    if (typeof changes.label !== 'string' || changes.label.length > LIMITS.maxLabelLength) {
      throw new Error(`Label edge maksimum ${LIMITS.maxLabelLength} karakter.`);
    }
    edge.label = changes.label;
  }

  next.updatedAt = new Date().toISOString();
  assertValidDiagram(next);
  return next;
}

export {
  NODE_TYPES,
  NODE_DIMENSIONS,
  LIMITS,
};

export const addNodeToDiagram = addNode;
export const updateNodeInDiagram = updateNode;
export const removeNodeFromDiagram = removeNode;
export const addEdgeToDiagram = addEdge;
export const removeEdgeFromDiagram = removeEdge;
export const updateEdgeInDiagram = updateEdge;
export const validate = validateDiagram;
export const getLimits = () => clone(LIMITS);
export const getNodeDimensions = (type) => clone(NODE_DIMENSIONS[type]);
export const nodeTypes = NODE_TYPES;
export const nodeDimensions = NODE_DIMENSIONS;
export const limits = LIMITS;
