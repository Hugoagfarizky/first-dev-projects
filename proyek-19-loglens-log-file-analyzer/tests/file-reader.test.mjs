import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_FILE_BYTES,
  MAX_LINES,
  READ_ERROR_CODES,
  readLogFile,
} from '../js/file-reader.js';

const encoder = new TextEncoder();

function bytes(text) {
  return encoder.encode(text);
}

function totalBytes(chunks) {
  return chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
}

function hasUnpairedSurrogate(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        return true;
      }
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true;
    }
  }

  return false;
}

function makeFile(chunks, options = {}) {
  const computedSize = totalBytes(chunks);
  let streamCalls = 0;

  return {
    size: Object.prototype.hasOwnProperty.call(options, 'size')
      ? options.size
      : computedSize,
    get streamCalls() {
      return streamCalls;
    },
    stream() {
      streamCalls += 1;

      if (options.throwOnStream) {
        throw new Error('stream factory failed');
      }

      let index = 0;
      const errorAfter = options.errorAfter ?? null;

      return new ReadableStream({
        pull(controller) {
          if (errorAfter !== null && index >= errorAfter) {
            controller.error(new Error('stream failed'));
            return;
          }

          if (index >= chunks.length) {
            controller.close();
            return;
          }

          controller.enqueue(chunks[index]);
          index += 1;
        },
        cancel() {
          options.onCancel?.();
        },
      });
    },
  };
}

function makeDelayedFile(chunks, delayMs) {
  let index = 0;
  return {
    size: totalBytes(chunks),
    stream() {
      return new ReadableStream({
        async pull(controller) {
          if (index >= chunks.length) {
            controller.close();
            return;
          }

          const chunk = chunks[index];
          index += 1;
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          controller.enqueue(chunk);
        },
      });
    },
  };
}

test('reads an empty file successfully', async () => {
  const result = await readLogFile(makeFile([], { size: 0 }));

  assert.equal(result.ok, true);
  assert.deepEqual(result.records, []);
  assert.equal(result.totalLines, 0);
  assert.equal(result.truncatedLines, 0);
  assert.equal(result.bytesRead, 0);
  assert.equal(result.fileSize, 0);
  assert.equal(result.error, null);
});

test('reads LF records and preserves line numbers', async () => {
  const result = await readLogFile(makeFile([bytes('a\nb\nc')]));

  assert.equal(result.ok, true);
  assert.deepEqual(result.records.map((record) => record.raw), ['a', 'b', 'c']);
  assert.deepEqual(result.records.map((record) => record.lineNumber), [1, 2, 3]);
  assert.equal(result.totalLines, 3);
});

test('handles CRLF and CR, including separators split across chunks', async () => {
  const crlf = await readLogFile(makeFile([bytes('a\r'), bytes('\nb')]));
  assert.deepEqual(crlf.records.map((record) => record.raw), ['a', 'b']);

  const cr = await readLogFile(makeFile([bytes('a\r'), bytes('b')]));
  assert.deepEqual(cr.records.map((record) => record.raw), ['a', 'b']);

  const mixed = await readLogFile(makeFile([bytes('a\r\nb\nc\r')]));
  assert.deepEqual(mixed.records.map((record) => record.raw), ['a', 'b', 'c']);
});

test('handles UTF-8 multibyte characters split across chunks', async () => {
  const accent = bytes('é\n');
  const result = await readLogFile(makeFile([
    accent.slice(0, 1),
    accent.slice(1),
  ]));

  assert.equal(result.ok, true);
  assert.equal(result.records[0].raw, 'é');

  const emoji = bytes('🙂\n');
  const emojiResult = await readLogFile(makeFile([
    emoji.slice(0, 2),
    emoji.slice(2),
  ]));

  assert.equal(emojiResult.records[0].raw, '🙂');
});

test('removes a BOM at the start of the file only', async () => {
  const result = await readLogFile(makeFile([bytes('\uFEFFa\nb')]));

  assert.equal(result.records[0].raw, 'a');
  assert.equal(result.records[1].raw, 'b');
});

test('removes a BOM split across chunks', async () => {
  const bom = Uint8Array.from([0xef, 0xbb, 0xbf]);
  const result = await readLogFile(makeFile([
    bom.slice(0, 2),
    bom.slice(2),
    bytes('a'),
  ]));

  assert.equal(result.ok, true);
  assert.equal(result.records[0].raw, 'a');
});

test('does not create a phantom line after a trailing newline', async () => {
  for (const text of ['a\n', 'a\r\n', 'a\r']) {
    const result = await readLogFile(makeFile([bytes(text)]));
    assert.equal(result.totalLines, 1, JSON.stringify(text));
    assert.equal(result.records[0].raw, 'a');
  }
});

test('preserves blank lines', async () => {
  const result = await readLogFile(makeFile([bytes('a\n\nb')]));

  assert.equal(result.totalLines, 3);
  assert.equal(result.records[1].blank, true);
  assert.equal(result.records[1].raw, '');
});

test('reports progress with processed bytes', async () => {
  const states = [];
  const file = makeFile([bytes('ab'), bytes('cd')]);
  const result = await readLogFile(file, {
    onProgress: (state) => states.push(state),
  });

  assert.equal(result.ok, true);
  assert.ok(states.length >= 3);
  assert.equal(states[0].bytesRead, 0);
  assert.equal(states[states.length - 1].bytesRead, 4);
  assert.equal(states[states.length - 1].fileSize, 4);
  assert.equal(states[states.length - 1].progress, 1);
  assert.equal(states[states.length - 1].lines, 1);
});

test('keeps progress usable when file size is unavailable', async () => {
  const states = [];
  const result = await readLogFile(makeFile([bytes('a')], { size: null }), {
    onProgress: (state) => states.push(state),
  });

  assert.equal(result.ok, true);
  assert.equal(result.fileSize, null);
  assert.equal(states[0].progress, null);
  assert.equal(states[states.length - 1].bytesRead, 1);
});

test('aborts before reading when the signal is already aborted', async () => {
  const controller = new AbortController();
  controller.abort();
  const file = makeFile([bytes('a')], { size: 1 });

  const result = await readLogFile(file, { signal: controller.signal });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, READ_ERROR_CODES.ABORTED);
  assert.deepEqual(result.records, []);
  assert.equal(file.streamCalls, 0);
});

test('aborts during reading and reports cancellation', async () => {
  const controller = new AbortController();
  const file = makeFile([bytes('a\n'), bytes('b\n'), bytes('c\n')], {
    size: 6,
  });

  const result = await readLogFile(file, {
    signal: controller.signal,
    onProgress: (state) => {
      if (state.bytesRead > 0) {
        controller.abort();
      }
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, READ_ERROR_CODES.ABORTED);
  assert.deepEqual(result.records, []);
});

test('aborts while a pending read is waiting', async () => {
  const controller = new AbortController();
  const file = makeDelayedFile([bytes('a')], 100);
  const pending = readLogFile(file, { signal: controller.signal });

  setTimeout(() => controller.abort(), 10);
  const result = await pending;

  assert.equal(result.ok, false);
  assert.equal(result.error.code, READ_ERROR_CODES.ABORTED);
  assert.deepEqual(result.records, []);
});

test('returns a structured read-error for stream failures', async () => {
  const result = await readLogFile(makeFile([bytes('a')], { errorAfter: 1 }));

  assert.equal(result.ok, false);
  assert.equal(result.error.code, READ_ERROR_CODES.READ_ERROR);
  assert.deepEqual(result.records, []);
});

test('rejects a file whose declared size exceeds 20 MiB without opening it', async () => {
  const file = makeFile([], { size: MAX_FILE_BYTES + 1 });
  const result = await readLogFile(file);

  assert.equal(result.ok, false);
  assert.equal(result.error.code, READ_ERROR_CODES.FILE_TOO_LARGE);
  assert.equal(result.error.maxBytes, MAX_FILE_BYTES);
  assert.deepEqual(result.records, []);
  assert.equal(file.streamCalls, 0);
});

test('enforces the byte limit when the declared size is unavailable', async () => {
  const file = makeFile([bytes('123456')], { size: null });
  const result = await readLogFile(file, { maxBytes: 5 });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, READ_ERROR_CODES.FILE_TOO_LARGE);
  assert.deepEqual(result.records, []);
});

test('rejects files exceeding the line limit without returning partial records', async () => {
  const file = makeFile([bytes('a\nb\nc')]);
  const result = await readLogFile(file, { maxLines: 2 });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, READ_ERROR_CODES.TOO_MANY_LINES);
  assert.equal(result.error.maxLines, 2);
  assert.deepEqual(result.records, []);
  assert.equal(result.totalLines, 0);
});

test('accepts exactly the maximum number of lines', async () => {
  const result = await readLogFile(makeFile([bytes('a\nb\n')]), { maxLines: 2 });

  assert.equal(result.ok, true);
  assert.equal(result.totalLines, 2);
});

test('rejects a file with more than 200,000 physical lines', async () => {
  const result = await readLogFile(makeFile([bytes('x\n'.repeat(MAX_LINES + 1))]));

  assert.equal(result.ok, false);
  assert.equal(result.error.code, READ_ERROR_CODES.TOO_MANY_LINES);
  assert.equal(result.error.maxLines, MAX_LINES);
  assert.deepEqual(result.records, []);
});

test('truncates overlong lines and marks them', async () => {
  const result = await readLogFile(makeFile([bytes('abcdefghij')]), {
    maxLineLength: 5,
  });

  assert.equal(result.ok, true);
  assert.equal(result.records[0].raw, 'abcde');
  assert.equal(result.records[0].lineTruncated, true);
  assert.equal(result.truncatedLines, 1);
});

test('bounds an overlong line split across chunks', async () => {
  const result = await readLogFile(makeFile([
    bytes('abc'),
    bytes('def'),
    bytes('ghi'),
  ]), { maxLineLength: 4 });

  assert.equal(result.ok, true);
  assert.equal(result.records[0].raw, 'abcd');
  assert.equal(result.records[0].lineTruncated, true);
});

test('accepts a multibyte line exactly at the UTF-8 byte limit', async () => {
  const text = '🙂a';
  const result = await readLogFile(makeFile([bytes(text)]), { maxLineLength: 5 });

  assert.equal(result.ok, true);
  assert.equal(result.records[0].raw, text);
  assert.equal(result.records[0].lineTruncated, false);
  assert.equal(result.truncatedLines, 0);
});

test('truncates a multibyte line across chunks without splitting a code point', async () => {
  const emoji = bytes('🙂');
  const result = await readLogFile(makeFile([
    emoji.slice(0, 2),
    emoji.slice(2),
    bytes('a'),
    bytes('bc'),
  ]), { maxLineLength: 5 });

  assert.equal(result.ok, true);
  assert.equal(result.records[0].raw, '🙂a');
  assert.equal(result.records[0].lineTruncated, true);
  assert.equal(result.truncatedLines, 1);
  assert.equal(hasUnpairedSurrogate(result.records[0].raw), false);
});

test('bounds an overlong multibyte line spanning chunks and keeps later lines intact', async () => {
  const result = await readLogFile(makeFile([
    bytes('🙂'),
    bytes('🙂'),
    bytes('🙂'),
    bytes('\nnext\n'),
  ]), { maxLineLength: 8 });

  assert.equal(result.ok, true);
  assert.equal(result.totalLines, 2);
  assert.equal(result.records[0].raw, '🙂🙂');
  assert.equal(result.records[0].lineTruncated, true);
  assert.equal(result.records[1].raw, 'next');
  assert.equal(result.records[1].lineTruncated, false);
  assert.equal(result.records[1].lineNumber, 2);
  assert.equal(result.truncatedLines, 1);
  assert.equal(hasUnpairedSurrogate(result.records[0].raw), false);
});

test('does not include a character that cannot fit within the byte limit', async () => {
  const result = await readLogFile(makeFile([bytes('🙂')]), { maxLineLength: 3 });

  assert.equal(result.ok, true);
  assert.equal(result.records[0].raw, '');
  assert.equal(result.records[0].blank, true);
  assert.equal(result.records[0].lineTruncated, true);
  assert.equal(result.truncatedLines, 1);
});

test('accepts the default line limit constant', async () => {
  assert.equal(MAX_LINES, 200_000);
});

test('rejects invalid file-like sources', async () => {
  for (const source of [null, undefined, {}, { stream: 42 }]) {
    const result = await readLogFile(source);
    assert.equal(result.ok, false);
    assert.equal(result.error.code, READ_ERROR_CODES.INVALID_FILE);
  }

  const throwing = makeFile([], { throwOnStream: true });
  const result = await readLogFile(throwing);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, READ_ERROR_CODES.INVALID_FILE);
});

test('does not let a throwing progress callback break reading', async () => {
  const result = await readLogFile(makeFile([bytes('a')]), {
    onProgress: () => {
      throw new Error('UI callback failed');
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.totalLines, 1);
});
