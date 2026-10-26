import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FILTER_DEFINITIONS,
  FILTER_NAMES,
  HISTORY_LIMIT,
  buildFilterString,
  clampFilterValue,
  createDefaultState,
  getOutputDimensions,
  isDefaultState,
  normalizeEditorState,
  resetEditorState,
  resetFilters,
  rotateLeft,
  rotateRight,
  statesEqual,
  toggleFlipX,
  toggleFlipY,
  updateFilter,
  EditorHistory,
} from '../js/editor-state.js';

function stateWith(filters = {}, overrides = {}) {
  return normalizeEditorState({
    filters: { ...createDefaultState().filters, ...filters },
    ...overrides,
  });
}

test('nilai default editor netral dan lengkap', () => {
  const state = createDefaultState();
  assert.equal(state.rotation, 0);
  assert.equal(state.flipX, false);
  assert.equal(state.flipY, false);
  assert.deepEqual(state.filters, {
    brightness: 100,
    contrast: 100,
    saturation: 100,
    grayscale: 0,
    sepia: 0,
    blur: 0,
  });
  assert.equal(FILTER_NAMES.length, 6);
  assert.equal(HISTORY_LIMIT, 50);
});

test('validasi rentang filter normalizes values', () => {
  assert.equal(clampFilterValue('brightness', 150), 150);
  assert.equal(clampFilterValue('brightness', -1), 0);
  assert.equal(clampFilterValue('brightness', 300), 200);
  assert.equal(clampFilterValue('contrast', 101.4), 101);
  assert.equal(clampFilterValue('blur', 3.45), 3.5);
});

test('nilai filter invalid kembali ke default', () => {
  for (const name of FILTER_NAMES) {
    assert.equal(clampFilterValue(name, NaN), FILTER_DEFINITIONS[name].default);
    assert.equal(clampFilterValue(name, Infinity), FILTER_DEFINITIONS[name].default);
    assert.equal(clampFilterValue(name, -Infinity), FILTER_DEFINITIONS[name].default);
    assert.equal(clampFilterValue(name, ''), FILTER_DEFINITIONS[name].default);
  }
  assert.throws(() => clampFilterValue('tidak-ada', 1), RangeError);
});

test('updateFilter membatasi nilai dan tidak memutasi state lama', () => {
  const original = createDefaultState();
  const next = updateFilter(original, 'brightness', 1000);
  assert.equal(next.filters.brightness, 200);
  assert.equal(original.filters.brightness, 100);
  assert.equal(next.filters.contrast, 100);
});

test('normalisasi state menolak input rusak', () => {
  const state = normalizeEditorState({
    filters: { brightness: NaN, contrast: '150' },
    rotation: 120,
    flipX: 1,
    flipY: 'false',
  });
  assert.equal(state.filters.brightness, 100);
  assert.equal(state.filters.contrast, 150);
  assert.equal(state.rotation, 90);
  assert.equal(state.flipX, false);
  assert.equal(state.flipY, false);
});

test('rotasi 0, 90, 180, dan 270 menghasilkan orientasi valid', () => {
  for (const rotation of [0, 90, 180, 270]) {
    const state = stateWith({}, { rotation });
    assert.equal(state.rotation, rotation);
  }
});

test('dimensi output setelah rotasi', () => {
  assert.deepEqual(getOutputDimensions(100, 200, 0), { width: 100, height: 200 });
  assert.deepEqual(getOutputDimensions(100, 200, 90), { width: 200, height: 100 });
  assert.deepEqual(getOutputDimensions(100, 200, 180), { width: 100, height: 200 });
  assert.deepEqual(getOutputDimensions(100, 200, 270), { width: 200, height: 100 });
  assert.deepEqual(getOutputDimensions(0, 100, 90), { width: 0, height: 0 });
});

test('kombinasi rotasi dan flip mempertahankan dimensi', () => {
  let state = stateWith({}, { rotation: 90 });
  state = toggleFlipX(state);
  state = toggleFlipY(state);
  assert.equal(state.rotation, 90);
  assert.equal(state.flipX, true);
  assert.equal(state.flipY, true);
  assert.deepEqual(getOutputDimensions(120, 80, state.rotation), { width: 80, height: 120 });
});

test('rotate left dan right mengubah state konsisten', () => {
  let state = createDefaultState();
  state = rotateRight(state);
  assert.equal(state.rotation, 90);
  state = rotateLeft(state);
  assert.equal(state.rotation, 0);
  state = rotateLeft(state);
  assert.equal(state.rotation, 270);
  state = rotateRight(state);
  assert.equal(state.rotation, 0);
});

test('flip horizontal dan vertikal dapat dibatalkan', () => {
  let state = createDefaultState();
  state = toggleFlipX(state);
  state = toggleFlipX(state);
  assert.equal(state.flipX, false);
  state = toggleFlipY(state);
  state = toggleFlipY(state);
  assert.equal(state.flipY, false);
});

test('reset filter mempertahankan transformasi', () => {
  const state = stateWith({ brightness: 200, blur: 4 }, { rotation: 90, flipX: true });
  const reset = resetFilters(state);
  assert.equal(reset.filters.brightness, 100);
  assert.equal(reset.filters.blur, 0);
  assert.equal(reset.rotation, 90);
  assert.equal(reset.flipX, true);
});

test('reset editor mengembalikan seluruh state default', () => {
  const state = stateWith({ brightness: 120 }, { rotation: 180, flipY: true });
  const reset = resetEditorState();
  assert.deepEqual(reset, createDefaultState());
  assert.equal(isDefaultState(reset), true);
  assert.equal(statesEqual(reset, state), false);
});

test('buildFilterString menggunakan saturate dan blur terukur', () => {
  const state = stateWith({ saturation: 150, blur: 2 });
  assert.equal(
    buildFilterString(state.filters, 0.5),
    'brightness(100%) contrast(100%) saturate(150%) grayscale(0%) sepia(0%) blur(1px)',
  );
});

test('statesEqual membandingkan seluruh field', () => {
  const a = stateWith({ brightness: 120 }, { rotation: 90, flipX: true });
  const b = stateWith({ brightness: 120 }, { rotation: 90, flipX: true });
  const c = stateWith({ brightness: 120 }, { rotation: 90, flipX: false });
  assert.equal(statesEqual(a, b), true);
  assert.equal(statesEqual(a, c), false);
});

test('undo dan redo mengembalikan snapshot state', () => {
  const initial = createDefaultState();
  const history = new EditorHistory(initial);
  const changed = updateFilter(initial, 'brightness', 140);
  assert.equal(history.record(changed), true);
  assert.equal(history.canUndo, true);
  assert.equal(history.current.filters.brightness, 140);
  assert.deepEqual(history.undo().filters, initial.filters);
  assert.equal(history.canRedo, true);
  assert.equal(history.redo().filters.brightness, 140);
});

test('aksi baru setelah undo membuang cabang redo', () => {
  const initial = createDefaultState();
  const history = new EditorHistory(initial);
  const first = updateFilter(initial, 'brightness', 120);
  const second = updateFilter(first, 'brightness', 180);
  history.record(first);
  history.record(second);
  assert.equal(history.undo().filters.brightness, 120);
  const replacement = updateFilter(history.current, 'contrast', 150);
  history.record(replacement);
  assert.equal(history.canRedo, false);
  assert.equal(history.current.filters.contrast, 150);
});

test('riwayat tidak mencatat state yang sama', () => {
  const initial = createDefaultState();
  const history = new EditorHistory(initial);
  assert.equal(history.record(createDefaultState()), false);
  assert.equal(history.snapshotCount, 1);
});

test('batas riwayat mempertahankan jumlah snapshot', () => {
  const history = new EditorHistory(createDefaultState(), { limit: 3 });
  history.record(updateFilter(createDefaultState(), 'brightness', 110));
  history.record(updateFilter(createDefaultState(), 'brightness', 120));
  history.record(updateFilter(createDefaultState(), 'brightness', 130));
  assert.equal(history.snapshotCount, 3);
  assert.equal(history.undoCount, 2);
  assert.equal(history.current.filters.brightness, 130);
});

test('reset state dapat di-undo dan di-redo', () => {
  const initial = createDefaultState();
  const history = new EditorHistory(initial);
  const changed = updateFilter(initial, 'brightness', 170);
  history.record(changed);
  history.record(resetEditorState());
  assert.equal(history.current.filters.brightness, 100);
  assert.equal(history.undo().filters.brightness, 170);
  assert.equal(history.redo().filters.brightness, 100);
});

test('mengganti gambar dimulai dengan riwayat baru', () => {
  const oldHistory = new EditorHistory(createDefaultState());
  oldHistory.record(updateFilter(createDefaultState(), 'brightness', 120));
  const newHistory = new EditorHistory(createDefaultState());
  assert.equal(newHistory.canUndo, false);
  assert.equal(newHistory.current.filters.brightness, 100);
});

test('limit riwayat default sesuai konstanta', () => {
  const history = new EditorHistory(createDefaultState());
  assert.equal(history.limit, HISTORY_LIMIT);
});
