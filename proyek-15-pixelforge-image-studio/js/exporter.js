export const DEFAULT_JPEG_QUALITY = 0.92;
export const MIN_JPEG_QUALITY = 0.1;
export const MAX_JPEG_QUALITY = 1;

export const EXPORT_FORMATS = Object.freeze({
  png: Object.freeze({ value: 'png', label: 'PNG', mime: 'image/png', extension: 'png' }),
  jpeg: Object.freeze({ value: 'jpeg', label: 'JPEG', mime: 'image/jpeg', extension: 'jpg' }),
});

const RESERVED_WINDOWS_NAMES = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
]);

export function normalizeJpegQuality(value) {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_JPEG_QUALITY;
  const clamped = Math.min(MAX_JPEG_QUALITY, Math.max(MIN_JPEG_QUALITY, numeric));
  return Math.round(clamped * 1000) / 1000;
}

export function normalizeExportFormat(value) {
  const normalized = String(value ?? '').toLowerCase();
  if (normalized === 'jpg' || normalized === 'jpeg' || normalized === 'image/jpeg') return 'jpeg';
  if (normalized === 'png' || normalized === 'image/png') return 'png';
  return 'png';
}

export function getExportFormat(value) {
  return EXPORT_FORMATS[normalizeExportFormat(value)];
}

export function getExportMimeType(value) {
  return getExportFormat(value).mime;
}

export function sanitizeBaseName(originalName) {
  const source = String(originalName ?? '')
    .replaceAll('\\', '/')
    .split('/')
    .pop()
    .replace(/\.[^.]+$/, '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/[-_.]{2,}/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '')
    .slice(0, 60)
    .replace(/[-_.]+$/g, '');

  if (!source) return 'pixelforge-image';
  if (RESERVED_WINDOWS_NAMES.has(source.toUpperCase())) return `image-${source}`;
  return source;
}

export function createExportFilename(originalName, format, now = new Date()) {
  const normalizedFormat = normalizeExportFormat(format);
  const extension = EXPORT_FORMATS[normalizedFormat].extension;
  const date = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  const stamp = [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
  return `${sanitizeBaseName(originalName)}-pixelforge-${stamp}.${extension}`;
}

export function revokeObjectUrlLater(url, delay = 1000) {
  if (typeof url !== 'string' || !url) return;
  if (typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function') return;
  setTimeout(() => URL.revokeObjectURL(url), delay);
}

export function canvasToBlob(canvas, options = {}) {
  if (!canvas || typeof canvas.toBlob !== 'function') {
    return Promise.reject(new Error('Canvas tidak mendukung pembuatan Blob.'));
  }

  const format = normalizeExportFormat(options.format);
  const definition = EXPORT_FORMATS[format];
  const quality = format === 'jpeg' ? normalizeJpegQuality(options.quality) : undefined;

  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    try {
      canvas.toBlob((blob) => {
        if (settled) return;
        if (!blob || !Number.isFinite(blob.size) || blob.size <= 0) {
          fail(new Error('Browser gagal membuat Blob gambar yang valid.'));
          return;
        }
        if (blob.type && !blob.type.startsWith('image/')) {
          fail(new Error('Blob yang dihasilkan bukan berkas gambar.'));
          return;
        }
        settled = true;
        resolve({ blob, format, mime: definition.mime, quality });
      }, definition.mime, quality);
    } catch {
      fail(new Error('Pembuatan Blob gambar gagal.'));
    }
  });
}
