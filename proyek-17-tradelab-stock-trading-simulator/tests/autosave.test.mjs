import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_AUTOSAVE_DELAY,
  createAutosaveController,
} from '../js/autosave.js';

const FIXED_NOW = '2026-10-27T10:00:00.000Z';

function createFakeScheduler() {
  let current = 0;
  let nextId = 1;
  const timers = new Map();

  return {
    setTimeout(callback, delay) {
      const id = nextId;
      nextId += 1;
      timers.set(id, { callback, at: current + delay });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    tick(milliseconds = 0) {
      current += milliseconds;
      let due;
      do {
        due = [...timers.entries()]
          .filter(([, timer]) => timer.at <= current)
          .sort((left, right) => left[1].at - right[1].at || left[0] - right[0]);
        for (const [id, timer] of due) {
          if (timers.has(id)) {
            timers.delete(id);
            timer.callback();
          }
        }
      } while (due.length > 0);
    },
    get size() {
      return timers.size;
    },
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createController(save, overrides = {}) {
  const scheduler = createFakeScheduler();
  const controller = createAutosaveController({
    save,
    delay: DEFAULT_AUTOSAVE_DELAY,
    scheduler,
    now: () => FIXED_NOW,
    ...overrides,
  });
  return { controller, scheduler };
}

test('autosave memakai debounce dan hanya menyimpan state terbaru', async () => {
  const calls = [];
  const { controller, scheduler } = createController((state) => {
    calls.push(state);
    return { ok: true, status: 'saved' };
  });

  controller.schedule({ version: 1 });
  controller.schedule({ version: 2 });
  controller.schedule({ version: 3 });

  assert.equal(calls.length, 0);
  assert.equal(controller.pending, true);
  scheduler.tick(499);
  assert.equal(calls.length, 0);
  scheduler.tick(1);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].version, 3);

  await controller.flush();
  assert.equal(calls.length, 1);
  assert.equal(controller.getStatus().state, 'saved');
});

test('snapshot state diambil saat scheduling, bukan saat save dijalankan', async () => {
  const calls = [];
  const { controller, scheduler } = createController((state) => {
    calls.push(state);
    return { ok: true };
  });
  const source = { version: 1, positions: [{ symbol: 'TLAB' }] };

  controller.schedule(source);
  source.version = 2;
  source.positions[0].symbol = 'BKPI';

  scheduler.tick(500);
  await controller.flush();

  assert.equal(calls.length, 1);
  assert.equal(calls[0].version, 1);
  assert.equal(calls[0].positions[0].symbol, 'TLAB');
});

test('cancel mencegah save yang masih pending', () => {
  const calls = [];
  const { controller, scheduler } = createController((state) => {
    calls.push(state);
    return { ok: true };
  });

  controller.schedule({ version: 1 });
  const result = controller.cancel();
  scheduler.tick(1000);

  assert.equal(result.ok, true);
  assert.equal(result.cancelled, true);
  assert.equal(calls.length, 0);
  assert.equal(controller.getStatus().state, 'cancelled');
});

test('flush menjalankan save pending tepat satu kali', async () => {
  const calls = [];
  const { controller, scheduler } = createController((state) => {
    calls.push(state);
    return { ok: true };
  });

  controller.schedule({ version: 1 });
  const first = await controller.flush();
  assert.equal(first.flushed, true);
  assert.equal(first.status, 'saved');
  assert.equal(calls.length, 1);

  const second = await controller.flush();
  assert.equal(second.flushed, false);
  assert.equal(calls.length, 1);

  scheduler.tick(1000);
  assert.equal(calls.length, 1);
});

test('dispose membatalkan pekerjaan pending dan mencegah penjadwalan baru', () => {
  const calls = [];
  const { controller, scheduler } = createController((state) => {
    calls.push(state);
    return { ok: true };
  });

  controller.schedule({ version: 1 });
  const result = controller.dispose();
  scheduler.tick(1000);

  assert.equal(result.status, 'disposed');
  assert.equal(calls.length, 0);
  assert.equal(controller.getStatus().state, 'disposed');
  assert.equal(controller.schedule({ version: 2 }).ok, false);
  assert.equal(scheduler.size, 0);
});

test('save yang gagal menghasilkan status error yang jelas', async () => {
  const { controller, scheduler } = createController(() => {
    throw new Error('Disk penuh.');
  });

  controller.schedule({ version: 1 });
  scheduler.tick(500);
  const result = await controller.flush();
  const status = controller.getStatus();

  assert.equal(result.ok, false);
  assert.equal(result.status, 'error');
  assert.equal(status.state, 'error');
  assert.equal(status.lastError, 'Disk penuh.');
  assert.equal(status.lastErrorDetails.message, 'Disk penuh.');
});

test('save async yang gagal juga dilaporkan sebagai error', async () => {
  const { controller, scheduler } = createController(async () => {
    throw new Error('Penyimpanan async gagal.');
  });

  controller.schedule({ version: 1 });
  scheduler.tick(500);
  const result = await controller.flush();

  assert.equal(result.ok, false);
  assert.equal(controller.getStatus().state, 'error');
  assert.match(controller.getStatus().lastError, /async gagal/);
});

test('hasil save lama tidak menimpa state yang lebih baru', async () => {
  const firstSave = deferred();
  const calls = [];
  const { controller, scheduler } = createController((state) => {
    calls.push(state);
    if (calls.length === 1) {
      return firstSave.promise;
    }
    return { ok: true, status: 'saved' };
  });

  controller.schedule({ version: 1 });
  scheduler.tick(500);
  assert.equal(calls.length, 1);

  controller.schedule({ version: 2 });
  const flushPromise = controller.flush();
  assert.equal(controller.getStatus().state, 'scheduled');

  firstSave.resolve({ ok: true, status: 'saved' });
  const result = await flushPromise;

  assert.equal(calls.length, 2);
  assert.equal(calls[1].version, 2);
  assert.equal(result.status, 'saved');
  assert.equal(result.savedRevision, 2);
  assert.equal(controller.getStatus().savedRevision, 2);
  assert.equal(controller.getStatus().state, 'saved');
});

test('cancel menginvalidasi save async yang sudah berjalan', async () => {
  const inFlight = deferred();
  const { controller, scheduler } = createController(() => inFlight.promise);

  controller.schedule({ version: 1 });
  scheduler.tick(500);
  const flushPromise = controller.flush();
  controller.cancel();

  inFlight.resolve({ ok: true, status: 'saved' });
  await flushPromise;
  const status = controller.getStatus();

  assert.equal(status.state, 'cancelled');
  assert.equal(status.savedRevision, null);
  assert.equal(status.lastSavedAt, null);
});

test('status autosave dapat di-subscribe untuk pelaporan UI', async () => {
  const states = [];
  const { controller, scheduler } = createController(() => ({ ok: true }));
  const unsubscribe = controller.subscribe((status) => {
    states.push(status.state);
  });

  controller.schedule({ version: 1 });
  scheduler.tick(500);
  await controller.flush();
  unsubscribe();

  assert.ok(states.includes('scheduled'));
  assert.ok(states.includes('saving'));
  assert.ok(states.includes('saved'));
});

test('save in-flight lalu cancel tidak mengklaim selesai sampai operasi settle', async () => {
  const inFlight = deferred();
  const { controller, scheduler } = createController(() => inFlight.promise);

  controller.schedule({ version: 1 });
  scheduler.tick(500);
  const flushPromise = controller.flush();
  const result = controller.cancel();

  assert.equal(result.status, 'cancelling');
  assert.equal(result.inFlight, 1);
  assert.equal(result.abortRequested, true);
  assert.equal(controller.getStatus().state, 'cancelling');

  inFlight.resolve({ ok: true, status: 'saved' });
  await flushPromise;
  const status = controller.getStatus();
  assert.equal(status.state, 'cancelled');
  assert.equal(status.savedRevision, null);
  assert.equal(status.staleSaveCompleted, true);
});

test('save in-flight lalu dispose menunggu operasi settle sebelum disposed', async () => {
  const inFlight = deferred();
  const { controller, scheduler } = createController(() => inFlight.promise);

  controller.schedule({ version: 1 });
  scheduler.tick(500);
  const flushPromise = controller.flush();
  const result = controller.dispose();

  assert.equal(result.status, 'disposing');
  assert.equal(result.inFlight, 1);
  assert.equal(controller.getStatus().state, 'disposing');

  inFlight.resolve({ ok: true, status: 'saved' });
  await flushPromise;
  const status = controller.getStatus();
  assert.equal(status.state, 'disposed');
  assert.equal(status.savedRevision, null);
});

test('snapshot baru yang gagal tidak membiarkan save lama mengubah status error menjadi saved', async () => {
  const inFlight = deferred();
  let calls = 0;
  const { controller, scheduler } = createController(() => {
    calls += 1;
    return calls === 1 ? inFlight.promise : { ok: true, status: 'saved' };
  }, {
    snapshot: (portfolio) => {
      if (portfolio.version === 2) {
        throw new Error('Snapshot gagal.');
      }
      return (globalThis.structuredClone || ((value) => JSON.parse(JSON.stringify(value))))(portfolio);
    },
  });

  controller.schedule({ version: 1 });
  scheduler.tick(500);
  assert.equal(calls, 1);

  const result = controller.schedule({ version: 2 });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'snapshot-failed');
  assert.equal(controller.getStatus().state, 'error');

  inFlight.resolve({ ok: true, status: 'saved' });
  await controller.flush();
  const status = controller.getStatus();
  assert.equal(status.state, 'error');
  assert.equal(status.savedRevision, null);
  assert.equal(calls, 1);
});

test('flush menunggu save aktif walau tidak ada timer pending', async () => {
  const inFlight = deferred();
  const { controller, scheduler } = createController(() => inFlight.promise);

  controller.schedule({ version: 1 });
  scheduler.tick(500);
  assert.equal(controller.pending, false);

  const flushPromise = controller.flush();
  let resolved = false;
  flushPromise.then(() => {
    resolved = true;
  });

  await Promise.resolve();
  assert.equal(resolved, false);

  inFlight.resolve({ ok: true, status: 'saved' });
  const result = await flushPromise;
  assert.equal(resolved, true);
  assert.equal(result.status, 'saved');
  assert.equal(result.flushed, false);
  assert.equal(result.waited, true);
});

test('beberapa save async berurutan menunggu save usang selesai', async () => {
  const firstSave = deferred();
  const calls = [];
  const { controller, scheduler } = createController((state) => {
    calls.push(state);
    if (calls.length === 1) {
      return firstSave.promise;
    }
    return { ok: true, status: 'saved' };
  });

  controller.schedule({ version: 1 });
  scheduler.tick(500);
  assert.equal(calls.length, 1);

  controller.schedule({ version: 2 });
  const flushPromise = controller.flush();
  assert.equal(controller.getStatus().state, 'scheduled');

  firstSave.resolve({ ok: true, status: 'saved' });
  const result = await flushPromise;
  assert.equal(calls.length, 2);
  assert.equal(calls[1].version, 2);
  assert.equal(result.savedRevision, 2);
  assert.equal(controller.getStatus().savedRevision, 2);
});

test('save yang mengembalikan { ok: false } dilaporkan sebagai error', async () => {
  const { controller, scheduler } = createController(() => ({ ok: false, status: 'quota-exceeded', error: 'Kuota habis.' }));

  controller.schedule({ version: 1 });
  scheduler.tick(500);
  const result = await controller.flush();
  const status = controller.getStatus();

  assert.equal(result.ok, false);
  assert.equal(result.status, 'error');
  assert.equal(status.state, 'error');
  assert.equal(status.lastError, 'Kuota habis.');
});

test('error dari now() ditangani tanpa crash', () => {
  const { controller } = createController(() => ({ ok: true }), {
    now: () => {
      throw new Error('now gagal');
    },
  });

  const result = controller.schedule({ version: 1 });
  assert.equal(result.ok, true);
  assert.equal(result.status, 'scheduled');
  assert.match(result.scheduledAt, /T/);
});

test('opsi schedule null dan invalid ditangani dengan jelas', () => {
  const { controller } = createController(() => ({ ok: true }));

  const nullResult = controller.schedule({ version: 1 }, null);
  assert.equal(nullResult.ok, true);
  controller.cancel();

  const invalidResult = controller.schedule({ version: 2 }, 'bukan-objek');
  assert.equal(invalidResult.ok, false);
  assert.equal(invalidResult.code, 'invalid-options');

  const invalidDelay = controller.schedule({ version: 3 }, { delay: -1 });
  assert.equal(invalidDelay.ok, false);
  assert.equal(invalidDelay.code, 'invalid-delay');
});

test('scheduler mempertahankan konteks objek', () => {
  const calls = [];
  const scheduler = {
    context: 'scheduler-context',
    setTimeout(callback, delay) {
      calls.push(this.context);
      const id = setTimeout(callback, delay);
      return id;
    },
    clearTimeout(id) {
      clearTimeout(id);
    },
  };

  const controller = createAutosaveController({
    save: () => ({ ok: true }),
    delay: 0,
    scheduler,
    now: () => FIXED_NOW,
  });

  const result = controller.schedule({ version: 1 });
  assert.equal(result.ok, true);
  assert.deepEqual(calls, ['scheduler-context']);
});

test('cooperative AbortSignal diteruskan ke callback save', async () => {
  let receivedSignal;
  const inFlight = deferred();
  const { controller, scheduler } = createController((state, metadata) => {
    receivedSignal = metadata.signal;
    return inFlight.promise;
  });

  controller.schedule({ version: 1 });
  scheduler.tick(500);
  const flushPromise = controller.flush();
  controller.cancel();

  assert.ok(receivedSignal instanceof AbortSignal);
  assert.equal(receivedSignal.aborted, true);

  inFlight.resolve({ ok: true, status: 'saved' });
  await flushPromise;
  assert.equal(controller.getStatus().state, 'cancelled');
});
