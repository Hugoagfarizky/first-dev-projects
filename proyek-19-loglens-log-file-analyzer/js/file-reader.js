import { DEFAULT_MAX_LINE_LENGTH, utf8ByteLength } from './log-model.js';
import { parseLogLine } from './log-parser.js';

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_LINES = 200_000;

export const READ_ERROR_CODES = Object.freeze({
  INVALID_FILE: 'invalid-file',
  FILE_TOO_LARGE: 'file-too-large',
  TOO_MANY_LINES: 'too-many-lines',
  ABORTED: 'aborted',
  READ_ERROR: 'read-error',
});

class ReaderError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ReaderError';
    this.code = code;
    this.details = details;
  }
}

function positiveInteger(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function normalizeFileSize(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function normalizeOptions(options) {
  const settings = options && typeof options === 'object' ? options : {};

  return {
    maxBytes: positiveInteger(settings.maxBytes, MAX_FILE_BYTES),
    maxLines: positiveInteger(settings.maxLines, MAX_LINES),
    maxLineLength: positiveInteger(settings.maxLineLength, DEFAULT_MAX_LINE_LENGTH),
    signal: settings.signal && typeof settings.signal === 'object'
      && typeof settings.signal.addEventListener === 'function'
      && typeof settings.signal.aborted === 'boolean'
      ? settings.signal
      : null,
    onProgress: typeof settings.onProgress === 'function' ? settings.onProgress : null,
  };
}

function readNextChunk(reader, signal) {
  if (!signal) {
    return reader.read().then((value) => ({
      aborted: false,
      done: value.done,
      value: value.value,
    }));
  }

  if (signal.aborted) {
    return Promise.resolve({ aborted: true });
  }

  return new Promise((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      signal.removeEventListener('abort', onAbort);
    };

    const onAbort = () => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve({ aborted: true });
    };

    signal.addEventListener('abort', onAbort, { once: true });

    reader.read().then(
      (value) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        resolve({ aborted: false, done: value.done, value: value.value });
      },
      (error) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        reject(error);
      },
    );
  });
}

async function cancelReader(reader) {
  if (!reader) {
    return;
  }

  try {
    await reader.cancel();
  } catch {
    // Cancellation is best-effort; the original error is more useful.
  }
}

function reportProgress(callback, state) {
  if (!callback) {
    return;
  }

  try {
    callback(state);
  } catch {
    // A UI progress callback must not break the reader.
  }
}

/**
 * Read a local file-like object using File.stream().
 *
 * The module deliberately accepts any object with a `stream()` method and an
 * optional numeric `size`; it does not access the DOM or the network.
 *
 * Success:
 *   { ok: true, records, totalLines, truncatedLines, bytesRead, fileSize, error: null }
 *
 * Failure:
 *   { ok: false, records: [], totalLines: 0, truncatedLines: 0, bytesRead,
 *     fileSize, error: { code, message, ...details } }
 */
export async function readLogFile(file, options = {}) {
  const settings = normalizeOptions(options);
  const fileSize = normalizeFileSize(file?.size);
  const fail = (code, message, details = {}) => ({
    ok: false,
    records: [],
    totalLines: 0,
    truncatedLines: 0,
    bytesRead: details.bytesRead ?? 0,
    fileSize,
    error: {
      code,
      message,
      ...details,
    },
  });

  if (!file || typeof file.stream !== 'function') {
    return fail(READ_ERROR_CODES.INVALID_FILE, 'Sumber file tidak valid.');
  }

  if (fileSize !== null && fileSize > settings.maxBytes) {
    return fail(READ_ERROR_CODES.FILE_TOO_LARGE, 'File melebihi batas ukuran.', {
      fileSize,
      maxBytes: settings.maxBytes,
      bytesRead: 0,
    });
  }

  if (settings.signal?.aborted) {
    return fail(READ_ERROR_CODES.ABORTED, 'Pembacaan file dibatalkan.', {
      bytesRead: 0,
      fileSize,
    });
  }

  let reader;
  let bytesRead = 0;
  let lineNumber = 0;
  let lineBuffer = '';
  let lineBytes = 0;
  let skipNextLf = false;
  let streamStarted = false;
  let truncatedLines = 0;

  const records = [];
  const decoder = new TextDecoder('utf-8', { fatal: false, ignoreBOM: true });

  const progressState = () => ({
    bytesRead,
    fileSize,
    lines: lineNumber,
    progress: fileSize === null || fileSize === 0
      ? null
      : Math.min(1, bytesRead / fileSize),
  });

  const emitLine = () => {
    if (lineNumber >= settings.maxLines) {
      throw new ReaderError(
        READ_ERROR_CODES.TOO_MANY_LINES,
        'File melebihi batas jumlah baris.',
        {
          maxLines: settings.maxLines,
          linesRead: lineNumber,
          bytesRead,
          fileSize,
        },
      );
    }

    lineNumber += 1;
    const record = parseLogLine(lineBuffer, lineNumber, {
      maxLineLength: settings.maxLineLength,
    });

    if (record.lineTruncated) {
      truncatedLines += 1;
    }

    records.push(record);
    lineBuffer = '';
    lineBytes = 0;
  };

  const appendText = (text) => {
    // Allow up to four extra bytes (the widest UTF-8 code point) beyond the
    // limit so the parser can detect overflow without buffering the whole line.
    const bufferByteLimit = settings.maxLineLength + 4;

    for (const character of text) {
      if (character === '\r') {
        emitLine();
        skipNextLf = true;
        continue;
      }

      if (character === '\n') {
        if (skipNextLf) {
          skipNextLf = false;
        } else {
          emitLine();
        }
        continue;
      }

      skipNextLf = false;

      const characterBytes = utf8ByteLength(character);
      if (lineBytes + characterBytes <= bufferByteLimit) {
        lineBuffer += character;
        lineBytes += characterBytes;
      }
    }
  };

  const processDecodedText = (text) => {
    if (text.length === 0) {
      return;
    }

    let content = text;
    if (!streamStarted) {
      if (content.charCodeAt(0) === 0xFEFF) {
        content = content.slice(1);
      }
      streamStarted = true;
    }

    if (content.length > 0) {
      appendText(content);
    }
  };

  try {
    let stream;
    try {
      stream = file.stream();
    } catch {
      throw new ReaderError(READ_ERROR_CODES.INVALID_FILE, 'Sumber file tidak valid.');
    }

    if (!stream || typeof stream.getReader !== 'function') {
      throw new ReaderError(READ_ERROR_CODES.INVALID_FILE, 'Sumber file tidak valid.');
    }

    try {
      reader = stream.getReader();
    } catch {
      throw new ReaderError(READ_ERROR_CODES.INVALID_FILE, 'Sumber file tidak valid.');
    }

    reportProgress(settings.onProgress, progressState());

    while (true) {
      if (settings.signal?.aborted) {
        await cancelReader(reader);
        return fail(READ_ERROR_CODES.ABORTED, 'Pembacaan file dibatalkan.', {
          bytesRead,
          fileSize,
        });
      }

      const step = await readNextChunk(reader, settings.signal);
      if (step.aborted) {
        await cancelReader(reader);
        return fail(READ_ERROR_CODES.ABORTED, 'Pembacaan file dibatalkan.', {
          bytesRead,
          fileSize,
        });
      }

      if (step.done) {
        break;
      }

      const chunk = step.value;
      const chunkBytes = chunk && typeof chunk.byteLength === 'number'
        ? chunk.byteLength
        : 0;
      bytesRead += chunkBytes;

      if (bytesRead > settings.maxBytes) {
        throw new ReaderError(
          READ_ERROR_CODES.FILE_TOO_LARGE,
          'File melebihi batas ukuran.',
          {
            maxBytes: settings.maxBytes,
            bytesRead,
            fileSize,
          },
        );
      }

      const decoded = decoder.decode(chunk, { stream: true });
      processDecodedText(decoded);
      reportProgress(settings.onProgress, progressState());
    }

    if (settings.signal?.aborted) {
      await cancelReader(reader);
      return fail(READ_ERROR_CODES.ABORTED, 'Pembacaan file dibatalkan.', {
        bytesRead,
        fileSize,
      });
    }

    processDecodedText(decoder.decode());

    if (lineBuffer !== '') {
      emitLine();
    }

    reportProgress(settings.onProgress, progressState());

    return {
      ok: true,
      records,
      totalLines: records.length,
      truncatedLines,
      bytesRead,
      fileSize,
      error: null,
    };
  } catch (error) {
    await cancelReader(reader);

    if (error instanceof ReaderError) {
      return fail(error.code, error.message, {
        ...error.details,
        bytesRead,
        fileSize,
      });
    }

    return fail(READ_ERROR_CODES.READ_ERROR, 'Gagal membaca file log.', {
      bytesRead,
      fileSize,
    });
  } finally {
    if (reader) {
      try {
        reader.releaseLock();
      } catch {
        // The stream may already be closed or cancelled.
      }
    }
  }
}
