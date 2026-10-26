export const FILTER_DEFINITIONS = Object.freeze({
  brightness: Object.freeze({ label: 'Brightness', min: 0, max: 200, step: 1, default: 100, unit: '%' }),
  contrast: Object.freeze({ label: 'Contrast', min: 0, max: 200, step: 1, default: 100, unit: '%' }),
  saturation: Object.freeze({ label: 'Saturation', min: 0, max: 200, step: 1, default: 100, unit: '%' }),
  grayscale: Object.freeze({ label: 'Grayscale', min: 0, max: 100, step: 1, default: 0, unit: '%' }),
  sepia: Object.freeze({ label: 'Sepia', min: 0, max: 100, step: 1, default: 0, unit: '%' }),
  blur: Object.freeze({ label: 'Blur', min: 0, max: 10, step: 0.1, default: 0, unit: 'px' }),
});

export const FILTER_NAMES = Object.freeze(Object.keys(FILTER_DEFINITIONS));
export const HISTORY_LIMIT = 50;
export const ROTATIONS = Object.freeze([0, 90, 180, 270]);

const DEFAULT_FILTERS = Object.freeze(
  Object.fromEntries(FILTER_NAMES.map((name) => [name, FILTER_DEFINITIONS[name].default])),
);

function decimalPlaces(step) {
  const text = String(step);
  if (!text.includes('.')) return 0;
  return text.split('.')[1].length;
}

function roundTo(value, places) {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function cloneEditorState(state) {
  return {
    filters: { ...state.filters },
    rotation: state.rotation,
    flipX: state.flipX,
    flipY: state.flipY,
  };
}

export function createDefaultState() {
  return {
    filters: { ...DEFAULT_FILTERS },
    rotation: 0,
    flipX: false,
    flipY: false,
  };
}

export function clampFilterValue(name, value) {
  const definition = FILTER_DEFINITIONS[name];
  if (!definition) throw new RangeError(`Filter tidak dikenal: ${name}`);

  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric) || (typeof value === 'string' && value.trim() === '')) {
    return definition.default;
  }

  const clamped = Math.min(definition.max, Math.max(definition.min, numeric));
  const stepped = definition.min + Math.round((clamped - definition.min) / definition.step) * definition.step;
  return roundTo(stepped, decimalPlaces(definition.step));
}

export function normalizeRotation(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return ((Math.round(numeric / 90) * 90) % 360 + 360) % 360;
}

export function normalizeEditorState(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const filterSource = source.filters && typeof source.filters === 'object' ? source.filters : source;
  const filters = {};
  for (const name of FILTER_NAMES) {
    filters[name] = clampFilterValue(name, filterSource[name]);
  }

  return {
    filters,
    rotation: normalizeRotation(source.rotation),
    flipX: source.flipX === true,
    flipY: source.flipY === true,
  };
}

export function updateFilter(state, name, value) {
  const normalized = normalizeEditorState(state);
  return {
    ...normalized,
    filters: {
      ...normalized.filters,
      [name]: clampFilterValue(name, value),
    },
  };
}

export function resetFilters(state) {
  const normalized = normalizeEditorState(state);
  return { ...normalized, filters: { ...DEFAULT_FILTERS } };
}

export function rotateLeft(state) {
  const normalized = normalizeEditorState(state);
  return { ...normalized, rotation: (normalized.rotation + 270) % 360 };
}

export function rotateRight(state) {
  const normalized = normalizeEditorState(state);
  return { ...normalized, rotation: (normalized.rotation + 90) % 360 };
}

export function toggleFlipX(state) {
  const normalized = normalizeEditorState(state);
  return { ...normalized, flipX: !normalized.flipX };
}

export function toggleFlipY(state) {
  const normalized = normalizeEditorState(state);
  return { ...normalized, flipY: !normalized.flipY };
}

export function resetEditorState() {
  return createDefaultState();
}

export function getOutputDimensions(width, height, rotation = 0) {
  const safeWidth = Math.max(0, Math.round(Number(width) || 0));
  const safeHeight = Math.max(0, Math.round(Number(height) || 0));
  if (safeWidth === 0 || safeHeight === 0) return { width: 0, height: 0 };
  return normalizeRotation(rotation) % 180 === 0
    ? { width: safeWidth, height: safeHeight }
    : { width: safeHeight, height: safeWidth };
}

export function buildFilterString(filters, scale = 1) {
  const normalized = normalizeEditorState({ filters }).filters;
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const blur = roundTo(normalized.blur * safeScale, 2);
  return [
    `brightness(${normalized.brightness}%)`,
    `contrast(${normalized.contrast}%)`,
    `saturate(${normalized.saturation}%)`,
    `grayscale(${normalized.grayscale}%)`,
    `sepia(${normalized.sepia}%)`,
    `blur(${blur}px)`,
  ].join(' ');
}

export function formatFilterValue(name, value) {
  const definition = FILTER_DEFINITIONS[name];
  if (!definition) return '';
  return `${clampFilterValue(name, value)}${definition.unit}`;
}

export function statesEqual(left, right) {
  if (!left || !right) return false;
  if (left.rotation !== right.rotation || left.flipX !== right.flipX || left.flipY !== right.flipY) {
    return false;
  }
  return FILTER_NAMES.every((name) => left.filters?.[name] === right.filters?.[name]);
}

export function isDefaultState(state) {
  return statesEqual(normalizeEditorState(state), createDefaultState());
}

export class EditorHistory {
  constructor(initialState = createDefaultState(), options = {}) {
    const requested = Number.isInteger(options.limit) ? options.limit : HISTORY_LIMIT;
    this.limit = Math.max(1, Math.min(200, requested));
    this.entries = [cloneEditorState(normalizeEditorState(initialState))];
    this.index = 0;
  }

  get current() {
    return cloneEditorState(this.entries[this.index]);
  }

  get canUndo() {
    return this.index > 0;
  }

  get canRedo() {
    return this.index < this.entries.length - 1;
  }

  get undoCount() {
    return this.index;
  }

  get redoCount() {
    return this.entries.length - 1 - this.index;
  }

  get snapshotCount() {
    return this.entries.length;
  }

  record(nextState) {
    const normalized = cloneEditorState(normalizeEditorState(nextState));
    if (statesEqual(this.entries[this.index], normalized)) return false;

    this.entries = this.entries.slice(0, this.index + 1);
    this.entries.push(normalized);
    if (this.entries.length > this.limit) {
      this.entries.splice(0, this.entries.length - this.limit);
    }
    this.index = this.entries.length - 1;
    return true;
  }

  undo() {
    if (!this.canUndo) return null;
    this.index -= 1;
    return this.current;
  }

  redo() {
    if (!this.canRedo) return null;
    this.index += 1;
    return this.current;
  }

  reset(initialState = createDefaultState()) {
    this.entries = [cloneEditorState(normalizeEditorState(initialState))];
    this.index = 0;
  }
}
