import {
  buildFilterString,
  getOutputDimensions,
  normalizeEditorState,
} from './editor-state.js';

export const MAX_FILE_BYTES = 15 * 1024 * 1024;
export const MAX_PIXELS = 24_000_000;
export const MAX_DIMENSION = 12_000;
export const SUPPORTED_IMAGE_TYPES = Object.freeze(['image/jpeg', 'image/png', 'image/webp']);

export class ImageValidationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ImageValidationError';
    this.code = code;
  }
}

export function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value < 0) return '0 B';
  if (value < 1024) return `${Math.round(value)} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MiB`;
}

export function validateImageFile(file) {
  if (!file || typeof file !== 'object') {
    return { ok: false, code: 'INVALID_FILE', message: 'Berkas tidak valid.' };
  }

  const size = Number(file.size);
  if (!Number.isFinite(size) || size < 0) {
    return { ok: false, code: 'INVALID_FILE', message: 'Ukuran berkas tidak dapat dibaca.' };
  }
  if (size === 0) {
    return { ok: false, code: 'EMPTY_FILE', message: 'Berkas kosong (0 byte) tidak dapat diimpor.' };
  }
  if (size > MAX_FILE_BYTES) {
    return {
      ok: false,
      code: 'FILE_TOO_LARGE',
      message: `Ukuran berkas melebihi batas ${formatBytes(MAX_FILE_BYTES)}.`,
    };
  }

  const type = typeof file.type === 'string' ? file.type.toLowerCase() : '';
  if (type && !SUPPORTED_IMAGE_TYPES.includes(type)) {
    return {
      ok: false,
      code: 'UNSUPPORTED_TYPE',
      message: 'Format tidak didukung. Gunakan PNG, JPEG, atau WebP.',
    };
  }
  if (!type) {
    // MIME type may be absent; the actual container is verified during decoding.
    return { ok: true };
  }

  return { ok: true };
}

export function validateDimensions(width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    return { ok: false, code: 'INVALID_DIMENSIONS', message: 'Dimensi gambar tidak valid.' };
  }
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    return {
      ok: false,
      code: 'DIMENSION_TOO_LARGE',
      message: `Sisi gambar melebihi batas ${MAX_DIMENSION.toLocaleString('id-ID')} piksel.`,
    };
  }
  if (width * height > MAX_PIXELS) {
    return {
      ok: false,
      code: 'TOO_MANY_PIXELS',
      message: `Jumlah piksel melebihi batas ${MAX_PIXELS.toLocaleString('id-ID')} piksel.`,
    };
  }
  return { ok: true };
}

function readUint16(bytes, offset, littleEndian = false) {
  if (littleEndian) return bytes[offset] | (bytes[offset + 1] << 8);
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readUint24(bytes, offset, littleEndian = true) {
  if (littleEndian) return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
  return (bytes[offset] << 16) | (bytes[offset + 1] << 8) | bytes[offset + 2];
}

function readUint32(bytes, offset, littleEndian = false) {
  if (littleEndian) {
    return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
  }
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

function mimeToFormat(type) {
  if (type === 'image/png') return 'png';
  if (type === 'image/jpeg') return 'jpeg';
  if (type === 'image/webp') return 'webp';
  return null;
}

export function inspectImageMetadata(buffer) {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 12) {
    return { ok: false, code: 'INVALID_IMAGE', message: 'Berkas gambar terlalu pendek atau tidak valid.' };
  }

  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  // PNG: fixed 8-byte signature followed by an IHDR chunk.
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    if (buffer.byteLength < 33) {
      return { ok: false, code: 'TRUNCATED_IMAGE', message: 'Header PNG tidak lengkap.' };
    }
    const width = view.getUint32(16, false);
    const height = view.getUint32(20, false);
    const dimensions = validateDimensions(width, height);
    if (!dimensions.ok) return dimensions;
    return { ok: true, format: 'png', width, height };
  }

  // JPEG: scan markers until a Start Of Frame segment is found.
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 1 < bytes.length) {
      while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
      if (offset >= bytes.length) break;
      const marker = bytes[offset];
      offset += 1;

      if (marker === 0xd9) break; // EOI
      if (marker === 0xda) break; // SOS: dimensions must already have been found
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue; // no payload

      if (offset + 2 > bytes.length) {
        return { ok: false, code: 'TRUNCATED_IMAGE', message: 'Header JPEG tidak lengkap.' };
      }
      const length = readUint16(bytes, offset, false);
      if (length < 2 || offset + length > bytes.length) {
        return { ok: false, code: 'TRUNCATED_IMAGE', message: 'Segmen JPEG tidak valid.' };
      }

      const isFrame = (marker & 0xf0) === 0xc0 && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isFrame) {
        if (length < 7 || offset + 7 > bytes.length) {
          return { ok: false, code: 'INVALID_IMAGE', message: 'Frame JPEG tidak valid.' };
        }
        const height = readUint16(bytes, offset + 3, false);
        const width = readUint16(bytes, offset + 5, false);
        const dimensions = validateDimensions(width, height);
        if (!dimensions.ok) return dimensions;
        return { ok: true, format: 'jpeg', width, height };
      }

      offset += length;
    }
    return { ok: false, code: 'INVALID_IMAGE', message: 'Header JPEG tidak berisi dimensi yang valid.' };
  }

  // WebP: RIFF container with VP8/VP8L/VP8X frame metadata.
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    if (buffer.byteLength < 30) {
      return { ok: false, code: 'TRUNCATED_IMAGE', message: 'Header WebP tidak lengkap.' };
    }

    const chunkType = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
    const chunkSize = readUint32(bytes, 16, true);
    const chunkData = 20;
    if (chunkData + chunkSize > bytes.length) {
      return { ok: false, code: 'TRUNCATED_IMAGE', message: 'Chunk WebP tidak lengkap.' };
    }

    let width = 0;
    let height = 0;

    if (chunkType === 'VP8 ') {
      if (chunkSize < 10 || chunkData + 10 > bytes.length) {
        return { ok: false, code: 'INVALID_IMAGE', message: 'Frame VP8 tidak valid.' };
      }
      if (bytes[chunkData] !== 0x9d || bytes[chunkData + 1] !== 0x01 || bytes[chunkData + 2] !== 0x2a) {
        return { ok: false, code: 'INVALID_IMAGE', message: 'Signature VP8 tidak valid.' };
      }
      width = (bytes[chunkData + 3] | (bytes[chunkData + 4] << 8)) & 0x3fff;
      height = (bytes[chunkData + 5] | (bytes[chunkData + 6] << 8)) & 0x3fff;
    } else if (chunkType === 'VP8L') {
      if (chunkSize < 5 || chunkData + 5 > bytes.length || bytes[chunkData] !== 0x2f) {
        return { ok: false, code: 'INVALID_IMAGE', message: 'Frame VP8L tidak valid.' };
      }
      const value = bytes[chunkData + 1] | (bytes[chunkData + 2] << 8) | (bytes[chunkData + 3] << 16) | (bytes[chunkData + 4] << 24);
      width = (value & 0x3fff) + 1;
      height = ((value >> 14) & 0x3fff) + 1;
    } else if (chunkType === 'VP8X') {
      if (chunkSize < 10 || chunkData + 10 > bytes.length) {
        return { ok: false, code: 'INVALID_IMAGE', message: 'Frame VP8X tidak valid.' };
      }
      width = readUint24(bytes, chunkData + 4, true) + 1;
      height = readUint24(bytes, chunkData + 7, true) + 1;
    } else {
      return { ok: false, code: 'INVALID_IMAGE', message: 'Chunk WebP pertama tidak didukung.' };
    }

    const dimensions = validateDimensions(width, height);
    if (!dimensions.ok) return dimensions;
    return { ok: true, format: 'webp', width, height };
  }

  return { ok: false, code: 'UNSUPPORTED_TYPE', message: 'Format gambar tidak didukung. Gunakan PNG, JPEG, atau WebP.' };
}

export async function decodeImageFile(file, options = {}) {
  const validation = validateImageFile(file);
  if (!validation.ok) throw new ImageValidationError(validation.code, validation.message);

  const type = typeof file.type === 'string' ? file.type.toLowerCase() : '';

  if (typeof file.arrayBuffer === 'function') {
    let buffer;
    try {
      buffer = await file.arrayBuffer();
    } catch {
      throw new ImageValidationError('READ_FAILED', 'Berkas gambar tidak dapat dibaca.');
    }
    const metadata = inspectImageMetadata(buffer);
    if (!metadata.ok) throw new ImageValidationError(metadata.code, metadata.message);

    const expectedFormat = mimeToFormat(type);
    if (expectedFormat && expectedFormat !== metadata.format) {
      throw new ImageValidationError('TYPE_MISMATCH', 'Tipe berkas tidak sesuai dengan isi gambar.');
    }
  } else if (!type || !SUPPORTED_IMAGE_TYPES.includes(type)) {
    throw new ImageValidationError('UNSUPPORTED_TYPE', 'Format gambar tidak didukung. Gunakan PNG, JPEG, atau WebP.');
  }

  const decode = options.createBitmap ?? globalThis.createImageBitmap;
  if (typeof decode !== 'function') {
    throw new ImageValidationError(
      'DECODE_UNAVAILABLE',
      'Browser ini tidak menyediakan createImageBitmap untuk membaca gambar.',
    );
  }

  let bitmap;
  try {
    try {
      bitmap = await decode(file, { imageOrientation: 'from-image' });
    } catch {
      bitmap = await decode(file);
    }
  } catch {
    throw new ImageValidationError(
      'DECODE_FAILED',
      'Berkas tidak dapat didekode sebagai gambar yang didukung.',
    );
  }

  const dimensions = validateDimensions(bitmap.width, bitmap.height);
  if (!dimensions.ok) {
    bitmap.close?.();
    throw new ImageValidationError(dimensions.code, dimensions.message);
  }

  return {
    bitmap,
    width: bitmap.width,
    height: bitmap.height,
  };
}

export function computePreviewScale(outputWidth, outputHeight, maxDimension = 1600) {
  const longest = Math.max(Number(outputWidth) || 0, Number(outputHeight) || 0);
  if (!Number.isFinite(maxDimension) || maxDimension <= 0) return 1;
  if (longest <= 0) return 1;
  return Math.min(1, maxDimension / longest);
}

export function createRenderPlan({
  sourceWidth,
  sourceHeight,
  state,
  maxDimension = Infinity,
  background = null,
}) {
  const normalizedState = normalizeEditorState(state);
  const output = getOutputDimensions(sourceWidth, sourceHeight, normalizedState.rotation);
  const scale = computePreviewScale(output.width, output.height, maxDimension);
  const renderWidth = Math.max(1, Math.round(output.width * scale));
  const renderHeight = Math.max(1, Math.round(output.height * scale));

  return {
    outputWidth: output.width,
    outputHeight: output.height,
    renderWidth,
    renderHeight,
    scale,
    background,
    filterString: buildFilterString(normalizedState.filters, scale),
  };
}

export function renderToCanvas(source, state, canvas, options = {}) {
  if (!source || !canvas) {
    throw new Error('Sumber gambar atau canvas tidak tersedia.');
  }
  if (typeof canvas.getContext !== 'function') {
    throw new Error('Canvas 2D tidak tersedia.');
  }

  const sourceWidth = Number(source.naturalWidth ?? source.width);
  const sourceHeight = Number(source.naturalHeight ?? source.height);
  const dimensions = validateDimensions(sourceWidth, sourceHeight);
  if (!dimensions.ok) {
    throw new ImageValidationError(dimensions.code, dimensions.message);
  }

  const normalizedState = normalizeEditorState(state);
  const plan = createRenderPlan({
    sourceWidth,
    sourceHeight,
    state: normalizedState,
    maxDimension: options.maxDimension ?? Infinity,
    background: options.background ?? null,
  });

  const context = canvas.getContext('2d', { alpha: true });
  if (!context) throw new Error('Context Canvas 2D tidak dapat dibuat.');
  if (typeof context.filter !== 'string') {
    throw new Error('Browser ini tidak mendukung filter Canvas 2D.');
  }

  canvas.width = plan.renderWidth;
  canvas.height = plan.renderHeight;
  context.clearRect(0, 0, plan.renderWidth, plan.renderHeight);

  if (plan.background) {
    context.fillStyle = plan.background;
    context.fillRect(0, 0, plan.renderWidth, plan.renderHeight);
  }

  context.save();
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.translate(plan.renderWidth / 2, plan.renderHeight / 2);
  context.rotate((normalizedState.rotation * Math.PI) / 180);
  context.scale(normalizedState.flipX ? -1 : 1, normalizedState.flipY ? -1 : 1);
  context.filter = plan.filterString;
  context.drawImage(
    source,
    (-sourceWidth * plan.scale) / 2,
    (-sourceHeight * plan.scale) / 2,
    sourceWidth * plan.scale,
    sourceHeight * plan.scale,
  );
  context.restore();

  return plan;
}
