import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_JPEG_QUALITY,
  MAX_JPEG_QUALITY,
  MIN_JPEG_QUALITY,
  canvasToBlob,
  createExportFilename,
  getExportFormat,
  getExportMimeType,
  normalizeExportFormat,
  normalizeJpegQuality,
  sanitizeBaseName,
} from '../js/exporter.js';

test('normalizeJpegQuality membatasi dan memberi fallback', () => {
  assert.equal(normalizeJpegQuality(0.5), 0.5);
  assert.equal(normalizeJpegQuality(0), MIN_JPEG_QUALITY);
  assert.equal(normalizeJpegQuality(2), MAX_JPEG_QUALITY);
  assert.equal(normalizeJpegQuality(NaN), DEFAULT_JPEG_QUALITY);
  assert.equal(normalizeJpegQuality('0.7365'), 0.737);
});

test('normalizeExportFormat dan MIME', () => {
  assert.equal(normalizeExportFormat('jpg'), 'jpeg');
  assert.equal(normalizeExportFormat('image/png'), 'png');
  assert.equal(normalizeExportFormat('unknown'), 'png');
  assert.equal(getExportFormat('jpeg').extension, 'jpg');
  assert.equal(getExportMimeType('png'), 'image/png');
});

test('sanitizeBaseName menghapus path dan karakter berbahaya', () => {
  assert.equal(sanitizeBaseName('C:\\\\fakepath\\\\My Photo.PNG'), 'My-Photo');
  assert.equal(sanitizeBaseName('../../evil<>file'), 'evil-file');
  assert.equal(sanitizeBaseName('.env'), 'pixelforge-image');
  assert.equal(sanitizeBaseName('CON'), 'image-CON');
  assert.equal(sanitizeBaseName('a'.repeat(100)).length <= 60, true);
});

test('createExportFilename aman dan konsisten', () => {
  const date = new Date('2026-10-26T12:00:00.000Z');
  assert.equal(
    createExportFilename('C:\\\\fakepath\\\\Foto Uji.png', 'png', date),
    'Foto-Uji-pixelforge-2026-10-26.png',
  );
  assert.equal(
    createExportFilename('image.jpeg', 'jpeg', date),
    'image-pixelforge-2026-10-26.jpg',
  );
  assert.equal(
    createExportFilename('', 'png', new Date('2026-10-26T00:00:00.000Z')),
    'pixelforge-image-pixelforge-2026-10-26.png',
  );
});

test('canvasToBlob menolak Blob null', async () => {
  const canvas = {
    toBlob(callback, mime, quality) {
      callback(null);
    },
  };
  await assert.rejects(() => canvasToBlob(canvas, { format: 'png' }), /gagal membuat Blob/);
});

test('canvasToBlob mengembalikan Blob valid', async () => {
  const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
  const canvas = {
    toBlob(callback, mime, quality) {
      assert.equal(mime, 'image/png');
      callback(blob);
    },
  };
  const result = await canvasToBlob(canvas, { format: 'png' });
  assert.equal(result.blob, blob);
  assert.equal(result.format, 'png');
  assert.equal(result.mime, 'image/png');
});

test('canvasToBlob JPEG meneruskan kualitas', async () => {
  const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' });
  const canvas = {
    toBlob(callback, mime, quality) {
      assert.equal(mime, 'image/jpeg');
      assert.equal(quality, 0.7);
      callback(blob);
    },
  };
  const result = await canvasToBlob(canvas, { format: 'jpeg', quality: 0.7 });
  assert.equal(result.quality, 0.7);
});

test('canvasToBlob menolak canvas tanpa toBlob', async () => {
  await assert.rejects(() => canvasToBlob({}, { format: 'png' }), /tidak mendukung/);
});
