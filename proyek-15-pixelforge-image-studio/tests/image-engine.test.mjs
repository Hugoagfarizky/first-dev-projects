import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAX_DIMENSION,
  MAX_FILE_BYTES,
  MAX_PIXELS,
  SUPPORTED_IMAGE_TYPES,
  ImageValidationError,
  computePreviewScale,
  createRenderPlan,
  decodeImageFile,
  formatBytes,
  inspectImageMetadata,
  renderToCanvas,
  validateDimensions,
  validateImageFile,
} from '../js/image-engine.js';
import { createDefaultState, normalizeEditorState } from '../js/editor-state.js';

test('konstanta validasi sesuai batas yang didokumentasikan', () => {
  assert.equal(MAX_FILE_BYTES, 15 * 1024 * 1024);
  assert.equal(MAX_PIXELS, 24_000_000);
  assert.equal(MAX_DIMENSION, 12_000);
  assert.deepEqual(SUPPORTED_IMAGE_TYPES, ['image/jpeg', 'image/png', 'image/webp']);
});

test('validateImageFile menolak file kosong, terlalu besar, dan tipe tidak didukung', () => {
  assert.equal(validateImageFile({ size: 0, type: 'image/png' }).code, 'EMPTY_FILE');
  assert.equal(validateImageFile({ size: MAX_FILE_BYTES + 1, type: 'image/png' }).code, 'FILE_TOO_LARGE');
  assert.equal(validateImageFile({ size: 10, type: 'image/gif' }).code, 'UNSUPPORTED_TYPE');
  assert.equal(validateImageFile({ size: 10, type: '' }).ok, true);
  assert.equal(validateImageFile({ size: 10, type: 'image/png' }).ok, true);
});

test('validateDimensions memeriksa batas sisi dan jumlah piksel', () => {
  assert.equal(validateDimensions(100, 100).ok, true);
  assert.equal(validateDimensions(0, 100).code, 'INVALID_DIMENSIONS');
  assert.equal(validateDimensions(100.5, 100).code, 'INVALID_DIMENSIONS');
  assert.equal(validateDimensions(MAX_DIMENSION + 1, 1).code, 'DIMENSION_TOO_LARGE');
  assert.equal(validateDimensions(6000, 4001).code, 'TOO_MANY_PIXELS');
});

test('decodeImageFile memvalidasi metadata dan bitmap', async () => {
  await assert.rejects(
    () => decodeImageFile({ size: 0, type: 'image/png' }),
    (error) => error instanceof ImageValidationError && error.code === 'EMPTY_FILE',
  );

  const bitmap = { width: 10, height: 10, close() {} };
  const result = await decodeImageFile(
    { size: 10, type: 'image/png' },
    { createBitmap: async () => bitmap },
  );
  assert.equal(result.bitmap, bitmap);
  assert.equal(result.width, 10);

  await assert.rejects(
    () => decodeImageFile(
      { size: 10, type: 'image/png' },
      { createBitmap: async () => ({ width: 0, height: 10, close() {} }) },
    ),
    (error) => error instanceof ImageValidationError && error.code === 'INVALID_DIMENSIONS',
  );
});

test('computePreviewScale tidak upscale dan membatasi sisi terpanjang', () => {
  assert.equal(computePreviewScale(100, 50, 1600), 1);
  assert.equal(computePreviewScale(3200, 1600, 1600), 0.5);
  assert.equal(computePreviewScale(100, 50, 0), 1);
});

test('createRenderPlan menghitung output, skala, dan filter', () => {
  const state = normalizeEditorState({ filters: { blur: 2 }, rotation: 90 });
  const plan = createRenderPlan({
    sourceWidth: 100,
    sourceHeight: 50,
    state,
    maxDimension: 50,
    background: '#ffffff',
  });

  assert.deepEqual(plan, {
    outputWidth: 50,
    outputHeight: 100,
    renderWidth: 25,
    renderHeight: 50,
    scale: 0.5,
    background: '#ffffff',
    filterString: 'brightness(100%) contrast(100%) saturate(100%) grayscale(0%) sepia(0%) blur(1px)',
  });
});

test('renderToCanvas menyiapkan canvas dan memanggil pipeline transformasi', () => {
  const calls = [];
  const ctx = {
    filter: '',
    imageSmoothingEnabled: false,
    imageSmoothingQuality: '',
    save() { calls.push('save'); },
    restore() { calls.push('restore'); },
    clearRect(...args) { calls.push(['clearRect', ...args]); },
    fillRect(...args) { calls.push(['fillRect', ...args]); },
    translate(...args) { calls.push(['translate', ...args]); },
    rotate(value) { calls.push(['rotate', value]); },
    scale(...args) { calls.push(['scale', ...args]); },
    drawImage(...args) { calls.push(['drawImage', ...args]); },
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext() { return ctx; },
  };
  const source = { width: 100, height: 50 };
  const state = normalizeEditorState({ filters: { blur: 4 }, rotation: 90, flipX: true });

  const plan = renderToCanvas(source, state, canvas, {
    maxDimension: 50,
    background: '#ffffff',
  });

  assert.equal(canvas.width, 25);
  assert.equal(canvas.height, 50);
  assert.equal(ctx.filter, 'brightness(100%) contrast(100%) saturate(100%) grayscale(0%) sepia(0%) blur(2px)');
  assert.equal(plan.renderWidth, 25);
  assert.equal(plan.renderHeight, 50);
  assert.deepEqual(calls[0], ['clearRect', 0, 0, 25, 50]);
  assert.deepEqual(calls[1], ['fillRect', 0, 0, 25, 50]);
  assert.ok(calls.some((call) => Array.isArray(call) && call[0] === 'drawImage'));
  assert.equal(ctx.fillStyle, '#ffffff');
});

test('renderToCanvas menolak canvas atau sumber invalid', () => {
  assert.throws(() => renderToCanvas({ width: 10, height: 10 }, createDefaultState(), null), /tidak tersedia/);
  const badCanvas = { width: 0, height: 0, getContext() { return null; } };
  assert.throws(() => renderToCanvas({ width: 10, height: 10 }, createDefaultState(), badCanvas), /tidak dapat dibuat/);
  const canvas = { width: 0, height: 0, getContext() { return { filter: '' }; } };
  assert.throws(() => renderToCanvas({ width: 0, height: 10 }, createDefaultState(), canvas), ImageValidationError);
});

test('formatBytes memformat ukuran', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(1024), '1.0 KiB');
  assert.equal(formatBytes(15 * 1024 * 1024), '15.0 MiB');
});

test('inspectImageMetadata membaca dimensi PNG, JPEG, dan WebP', () => {
  const pngBuffer = new ArrayBuffer(33);
  const png = new Uint8Array(pngBuffer);
  png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const pngView = new DataView(pngBuffer);
  pngView.setUint32(8, 13, false);
  png.set([0x49, 0x48, 0x44, 0x52], 12);
  pngView.setUint32(16, 4, false);
  pngView.setUint32(20, 3, false);

  const jpegBuffer = new ArrayBuffer(16);
  const jpeg = new Uint8Array(jpegBuffer);
  jpeg.set([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x03, 0x00, 0x04, 0x01, 0x11, 0x00, 0xff, 0xd9], 0);

  const webpBuffer = new ArrayBuffer(30);
  const webp = new Uint8Array(webpBuffer);
  const webpText = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20];
  webp.set(webpText, 0);
  new DataView(webpBuffer).setUint32(4, 22, true);
  new DataView(webpBuffer).setUint32(16, 10, true);
  webp.set([0x9d, 0x01, 0x2a, 0x04, 0x00, 0x03, 0x00], 20);

  assert.deepEqual(inspectImageMetadata(pngBuffer), { ok: true, format: 'png', width: 4, height: 3 });
  assert.deepEqual(inspectImageMetadata(jpegBuffer), { ok: true, format: 'jpeg', width: 4, height: 3 });
  assert.deepEqual(inspectImageMetadata(webpBuffer), { ok: true, format: 'webp', width: 4, height: 3 });
});

test('inspectImageMetadata menolak header invalid dan terpotong', () => {
  const pngBuffer = new ArrayBuffer(33);
  const png = new Uint8Array(pngBuffer);
  png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  new DataView(pngBuffer).setUint32(16, 20000, false);
  new DataView(pngBuffer).setUint32(20, 1, false);
  assert.equal(inspectImageMetadata(pngBuffer).code, 'DIMENSION_TOO_LARGE');

  const truncated = new ArrayBuffer(12);
  assert.equal(inspectImageMetadata(truncated).code, 'UNSUPPORTED_TYPE');

  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x05]);
  assert.equal(inspectImageMetadata(jpeg.buffer).code, 'INVALID_IMAGE');
});
