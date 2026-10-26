import assert from 'node:assert/strict';
import test from 'node:test';

import {
  STORAGE_KEY,
  loadDiagram,
  saveDiagram,
  clearDiagram,
  validateStoredPayload,
} from '../js/storage.js';
import { createDiagram, createNode, addNode } from '../js/diagram-model.js';

class MockStorage {
  constructor(initial = {}) {
    this.data = new Map(Object.entries(initial));
    this.failGet = false;
    this.failSet = false;
    this.failRemove = false;
    this.quota = false;
    this.verifyMismatch = false;
  }

  getItem(key) {
    if (this.failGet) throw new Error('getItem gagal');
    return this.data.has(key) ? this.data.get(key) : null;
  }

  setItem(key, value) {
    if (this.failSet) throw new Error('setItem gagal');
    if (this.quota) {
      const error = new Error('QuotaExceededError');
      error.name = 'QuotaExceededError';
      throw error;
    }
    if (this.verifyMismatch) {
      this.data.set(key, `${value}X`);
    } else {
      this.data.set(key, value);
    }
  }

  removeItem(key) {
    if (this.failRemove) throw new Error('removeItem gagal');
    this.data.delete(key);
  }
}

test('loadDiagram mengembalikan status empty saat storage kosong', () => {
  const storage = new MockStorage();
  const result = loadDiagram(storage);

  assert.equal(result.status, 'empty');
  assert.equal(result.diagram, null);
  assert.equal(result.error, null);
});

test('loadDiagram memuat payload valid', () => {
  const diagram = createDiagram({ name: 'Diagram uji' });
  const storage = new MockStorage();
  const saved = saveDiagram(diagram, storage);
  assert.equal(saved.ok, true);

  const loaded = loadDiagram(storage);
  assert.equal(loaded.status, 'loaded');
  assert.equal(loaded.diagram.name, 'Diagram uji');
  assert.equal(loaded.savedAt, saved.savedAt);
});

test('loadDiagram menolak JSON rusak', () => {
  const storage = new MockStorage({ [STORAGE_KEY]: '{rusak' });
  const result = loadDiagram(storage);

  assert.equal(result.status, 'invalid');
  assert.equal(result.diagram, null);
  assert.match(result.error, /JSON valid/);
});

test('loadDiagram menolak schema tidak didukung', () => {
  const storage = new MockStorage({
    [STORAGE_KEY]: JSON.stringify({
      app: 'diagramforge',
      schemaVersion: 2,
      savedAt: new Date().toISOString(),
      diagram: createDiagram(),
    }),
  });
  const result = loadDiagram(storage);

  assert.equal(result.status, 'invalid');
  assert.match(result.error, /schemaVersion/);
});

test('loadDiagram menangani error pembacaan storage', () => {
  const storage = new MockStorage();
  storage.failGet = true;
  const result = loadDiagram(storage);

  assert.equal(result.status, 'error');
  assert.equal(result.diagram, null);
  assert.match(result.error, /getItem gagal/);
});

test('loadDiagram mengembalikan unavailable jika storage tidak tersedia', () => {
  const result = loadDiagram(null);

  assert.equal(result.status, 'unavailable');
  assert.equal(result.diagram, null);
});

test('saveDiagram berhasil dan memverifikasi penulisan', () => {
  const storage = new MockStorage();
  const diagram = createDiagram();
  const result = saveDiagram(diagram, storage);

  assert.equal(result.ok, true);
  assert.equal(result.status, 'saved');
  assert.equal(typeof result.savedAt, 'string');
  assert.equal(storage.data.get(STORAGE_KEY) !== undefined, true);
});

test('saveDiagram tidak menyatakan tersimpan ketika setItem gagal', () => {
  const storage = new MockStorage();
  storage.failSet = true;
  const diagram = createDiagram();
  const result = saveDiagram(diagram, storage);

  assert.equal(result.ok, false);
  assert.equal(result.status, 'write_error');
  assert.equal(result.savedAt, null);
});

test('saveDiagram mendeteksi quota penuh', () => {
  const storage = new MockStorage();
  storage.quota = true;
  const diagram = createDiagram();
  const result = saveDiagram(diagram, storage);

  assert.equal(result.ok, false);
  assert.equal(result.status, 'quota_exceeded');
  assert.match(result.error, /penuh/);
});

test('saveDiagram gagal jika verifikasi read-back tidak cocok', () => {
  const storage = new MockStorage();
  storage.verifyMismatch = true;
  const diagram = createDiagram();
  const result = saveDiagram(diagram, storage);

  assert.equal(result.ok, false);
  assert.equal(result.status, 'verification_failed');
});

test('saveDiagram tidak menulis data invalid', () => {
  const storage = new MockStorage();
  const invalid = { app: 'diagramforge', schemaVersion: 1 };
  const result = saveDiagram(invalid, storage);

  assert.equal(result.ok, false);
  assert.equal(result.status, 'invalid');
  assert.equal(storage.data.has(STORAGE_KEY), false);
});

test('clearDiagram menghapus data dan menangani error', () => {
  const storage = new MockStorage();
  const diagram = createDiagram();
  saveDiagram(diagram, storage);

  const cleared = clearDiagram(storage);
  assert.equal(cleared.ok, true);
  assert.equal(storage.data.has(STORAGE_KEY), false);

  const failing = new MockStorage();
  failing.failRemove = true;
  const failed = clearDiagram(failing);
  assert.equal(failed.ok, false);
  assert.equal(failed.status, 'clear_error');
});

test('validateStoredPayload menolak field asing', () => {
  const result = validateStoredPayload({
    app: 'diagramforge',
    schemaVersion: 1,
    savedAt: new Date().toISOString(),
    diagram: createDiagram(),
    extra: true,
  });

  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /field asing/);
});

test('saveDiagram tidak menimpa data lama jika diagram invalid', () => {
  const storage = new MockStorage();
  const valid = createDiagram({ name: 'Lama' });
  saveDiagram(valid, storage);

  const invalid = { ...valid, nodes: 'bukan-larik' };
  const result = saveDiagram(invalid, storage);

  assert.equal(result.ok, false);
  const loaded = loadDiagram(storage);
  assert.equal(loaded.status, 'loaded');
  assert.equal(loaded.diagram.name, 'Lama');
});

test('akses global localStorage yang gagal tidak melempar error', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const hadOwnProperty = Object.prototype.hasOwnProperty.call(globalThis, 'localStorage');

  try {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('global localStorage gagal');
      },
    });

    const loaded = loadDiagram();
    assert.equal(loaded.status, 'unavailable');
    assert.match(loaded.error, /tidak dapat diakses/);

    const saved = saveDiagram(createDiagram());
    assert.equal(saved.ok, false);
    assert.equal(saved.status, 'unavailable');
    assert.match(saved.error, /tidak dapat diakses/);

    const cleared = clearDiagram();
    assert.equal(cleared.ok, false);
    assert.equal(cleared.status, 'unavailable');
    assert.match(cleared.error, /tidak dapat diakses/);
  } finally {
    if (hadOwnProperty) {
      if (descriptor) {
        Object.defineProperty(globalThis, 'localStorage', descriptor);
      } else {
        delete globalThis.localStorage;
      }
    } else {
      delete globalThis.localStorage;
    }
  }
});
