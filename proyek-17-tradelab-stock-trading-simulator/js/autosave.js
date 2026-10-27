export const DEFAULT_AUTOSAVE_DELAY = 500;

function clone(value) {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isPromiseLike(value) {
  return value !== null
    && (typeof value === 'object' || typeof value === 'function')
    && typeof value.then === 'function';
}

function errorInfo(error) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      code: error.code === undefined ? null : error.code,
    };
  }
  if (isPlainObject(error) && typeof error.message === 'string') {
    return {
      name: typeof error.name === 'string' ? error.name : 'Error',
      message: error.message,
      code: error.code === undefined ? null : error.code,
    };
  }
  return {
    name: 'Error',
    message: typeof error === 'string' ? error : 'Save gagal tanpa detail.',
    code: null,
  };
}

function isTimestamp(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function createAbortController() {
  try {
    return typeof globalThis.AbortController === 'function'
      ? new globalThis.AbortController()
      : null;
  } catch {
    return null;
  }
}

function createNow(options) {
  if (typeof options.now === 'function') {
    return () => {
      try {
        const value = options.now();
        if (value instanceof Date) {
          return value.toISOString();
        }
        return isTimestamp(value) ? value : new Date().toISOString();
      } catch {
        return new Date().toISOString();
      }
    };
  }
  return () => new Date().toISOString();
}

function isFailedSaveResult(result) {
  if (result === false) {
    return true;
  }
  if (!isPlainObject(result)) {
    return false;
  }
  if (result.ok === false) {
    return true;
  }
  return result.status === 'error'
    || result.status === 'failure'
    || result.status === 'failed'
    || result.status === 'unavailable'
    || result.status === 'read-error'
    || result.status === 'write-error'
    || result.status === 'quota-exceeded'
    || result.status === 'invalid-portfolio'
    || result.status === 'invalid-envelope'
    || result.status === 'corrupt'
    || result.status === 'unsupported-schema';
}

function failureOutcome(status, code, message, extra = {}) {
  return {
    ok: false,
    status,
    code,
    error: message,
    ...extra,
  };
}

export function createAutosaveController(options = {}) {
  if (!isPlainObject(options)) {
    throw new TypeError('Opsi autosave harus berupa objek.');
  }

  const save = options.save;
  if (typeof save !== 'function') {
    throw new TypeError('Autosave memerlukan callback save.');
  }

  const delay = options.delay ?? DEFAULT_AUTOSAVE_DELAY;
  if (!Number.isFinite(delay) || delay < 0) {
    throw new TypeError('Delay autosave harus berupa angka non-negatif.');
  }

  const scheduler = options.scheduler;
  function schedulerMethod(name) {
    if (!scheduler || typeof scheduler[name] !== 'function') {
      return null;
    }
    try {
      return scheduler[name].bind(scheduler);
    } catch {
      return null;
    }
  }

  const setTimeoutFn = options.setTimeout
    ?? schedulerMethod('setTimeout')
    ?? (typeof globalThis.setTimeout === 'function' ? globalThis.setTimeout.bind(globalThis) : null);
  const clearTimeoutFn = options.clearTimeout
    ?? schedulerMethod('clearTimeout')
    ?? (typeof globalThis.clearTimeout === 'function' ? globalThis.clearTimeout.bind(globalThis) : null);
  if (typeof setTimeoutFn !== 'function' || typeof clearTimeoutFn !== 'function') {
    throw new TypeError('Autosave memerlukan fungsi setTimeout dan clearTimeout.');
  }

  const snapshot = typeof options.snapshot === 'function' ? options.snapshot : clone;
  const now = createNow(options);
  const onStatus = typeof options.onStatus === 'function' ? options.onStatus : null;
  const onError = typeof options.onError === 'function' ? options.onError : null;
  const listeners = new Set();

  let timerId = null;
  let pending = null;
  let revision = 0;
  let disposed = false;
  let running = false;
  let lastTask = Promise.resolve();
  let activeEntry = null;
  let cancelRequested = false;
  let disposeRequested = false;
  let staleSaveCompleted = false;
  const queue = [];

  let status = {
    state: 'idle',
    pending: false,
    inFlight: 0,
    queued: 0,
    revision: 0,
    savedRevision: null,
    lastSavedAt: null,
    lastError: null,
    lastErrorDetails: null,
    cancelRequested: false,
    disposeRequested: false,
    staleSaveCompleted: false,
    disposed: false,
  };

  function getStatus() {
    return clone(status);
  }

  function publish() {
    const snapshotStatus = getStatus();
    if (onStatus) {
      try {
        onStatus(snapshotStatus);
      } catch {
        // Status listener tidak boleh menghentikan controller.
      }
    }
    for (const listener of [...listeners]) {
      try {
        listener(snapshotStatus);
      } catch {
        // Status listener tidak boleh menghentikan controller.
      }
    }
  }

  function updateStatus(patch) {
    status = {
      ...status,
      ...patch,
      revision,
      pending: pending !== null || timerId !== null,
      inFlight: running ? 1 : 0,
      queued: queue.length,
      cancelRequested,
      disposeRequested,
      staleSaveCompleted,
      disposed,
    };
    publish();
  }

  function staleOutcome(entry) {
    if (entry.started && (cancelRequested || disposeRequested)) {
      staleSaveCompleted = true;
    }
    if (disposed) {
      return failureOutcome('disposed', 'disposed', 'Controller autosave sudah dibersihkan.');
    }
    return failureOutcome('stale', 'stale', 'Save lama tidak lagi berlaku karena jadwal yang lebih baru.');
  }

  function finishSuccess(entry, result) {
    if (disposed || entry.revision !== revision) {
      return staleOutcome(entry);
    }

    const savedAt = isTimestamp(result?.savedAt) ? result.savedAt : now();
    updateStatus({
      state: 'saved',
      pending: false,
      savedRevision: entry.revision,
      lastSavedAt: savedAt,
      lastError: null,
      lastErrorDetails: null,
    });

    return {
      ok: true,
      status: 'saved',
      savedRevision: entry.revision,
      savedAt,
    };
  }

  function finishFailure(entry, error, result) {
    if (disposed || entry.revision !== revision) {
      return staleOutcome(entry);
    }

    const details = errorInfo(error);
    updateStatus({
      state: 'error',
      pending: false,
      lastError: details.message,
      lastErrorDetails: details,
    });

    if (onError) {
      try {
        onError(details, result);
      } catch {
        // Error listener tidak boleh menghentikan controller.
      }
    }

    return failureOutcome('error', 'save-failed', details.message, {
      errorDetails: details,
      saveResult: result,
    });
  }

  function finishSaveResult(entry, result) {
    if (isFailedSaveResult(result)) {
      const error = result?.error
        ?? result?.lastError
        ?? result?.errorDetails
        ?? result?.message
        ?? 'Save gagal.';
      return finishFailure(entry, error, result);
    }
    return finishSuccess(entry, result);
  }

  function startSave(entry) {
    if (disposed) {
      return Promise.resolve(failureOutcome('disposed', 'disposed', 'Controller autosave sudah dibersihkan.'));
    }
    if (entry.revision !== revision || entry.abortController?.signal.aborted) {
      return Promise.resolve(failureOutcome('stale', 'stale', 'Save lama tidak lagi berlaku.'));
    }

    entry.started = true;
    activeEntry = entry;
    updateStatus({
      state: 'saving',
      pending: false,
      lastError: null,
      lastErrorDetails: null,
    });

    let result;
    try {
      result = save(entry.snapshot, {
        revision: entry.revision,
        scheduledAt: entry.scheduledAt,
        savedAt: now(),
        signal: entry.abortController?.signal,
        isCurrent: () => entry.revision === revision
          && !disposed
          && !entry.abortController?.signal.aborted,
      });
    } catch (error) {
      return Promise.resolve(finishFailure(entry, error, null));
    }

    if (isPromiseLike(result)) {
      return Promise.resolve(result).then(
        (value) => finishSaveResult(entry, value),
        (error) => finishFailure(entry, error, null),
      );
    }

    return Promise.resolve(finishSaveResult(entry, result));
  }

  function settleTerminalState() {
    if (running || queue.length > 0) {
      return;
    }
    if (disposeRequested) {
      disposeRequested = false;
      cancelRequested = false;
      updateStatus({ state: 'disposed', pending: false });
      listeners.clear();
      return;
    }
    if (cancelRequested) {
      cancelRequested = false;
      updateStatus({ state: 'cancelled', pending: false });
    }
  }

  function abortEntry(entry) {
    if (!entry?.abortController) {
      return false;
    }
    try {
      if (entry.abortController.signal.aborted) {
        return false;
      }
      entry.abortController.abort();
      return true;
    } catch {
      return false;
    }
  }

  function abortAll() {
    let requested = false;
    if (activeEntry && abortEntry(activeEntry)) {
      requested = true;
    }
    for (const item of queue) {
      if (abortEntry(item.entry)) {
        requested = true;
      }
    }
    return requested;
  }

  function drain() {
    if (running) {
      return;
    }
    const item = queue.shift();
    if (!item) {
      settleTerminalState();
      return;
    }

    running = true;
    let task;
    try {
      task = startSave(item.entry);
    } catch (error) {
      task = Promise.resolve(finishFailure(item.entry, error, null));
    }

    Promise.resolve(task).then(
      (outcome) => {
        running = false;
        if (activeEntry === item.entry) {
          activeEntry = null;
        }
        if (!cancelRequested && !disposeRequested) {
          updateStatus({});
        }
        item.resolve(outcome);
        drain();
      },
      (error) => {
        running = false;
        if (activeEntry === item.entry) {
          activeEntry = null;
        }
        const outcome = finishFailure(item.entry, error, null);
        if (!cancelRequested && !disposeRequested) {
          updateStatus({});
        }
        item.resolve(outcome);
        drain();
      },
    );
  }

  function enqueue(entry) {
    const task = new Promise((resolve) => {
      queue.push({ entry, resolve });
      drain();
    });
    lastTask = task;
    return task;
  }

  function schedule(portfolio, scheduleOptions = {}) {
    if (disposed) {
      return failureOutcome('disposed', 'disposed', 'Controller autosave sudah dibersihkan.');
    }

    const options = scheduleOptions === null || scheduleOptions === undefined
      ? {}
      : scheduleOptions;
    if (!isPlainObject(options)) {
      return failureOutcome('error', 'invalid-options', 'Opsi schedule harus berupa objek atau null.');
    }

    const scheduleDelay = options.delay ?? delay;
    if (!Number.isFinite(scheduleDelay) || scheduleDelay < 0) {
      return failureOutcome('error', 'invalid-delay', 'Delay autosave harus berupa angka non-negatif.');
    }

    if (timerId !== null) {
      try {
        clearTimeoutFn(timerId);
      } catch {
        // Timer lama tetap tidak boleh menghalangi jadwal baru.
      }
      timerId = null;
    }
    pending = null;
    revision += 1;
    cancelRequested = false;
    disposeRequested = false;
    staleSaveCompleted = false;

    let scheduledSnapshot;
    try {
      scheduledSnapshot = snapshot(portfolio);
    } catch (error) {
      const details = errorInfo(error);
      updateStatus({
        state: 'error',
        pending: false,
        lastError: details.message,
        lastErrorDetails: details,
      });
      return failureOutcome('error', 'snapshot-failed', details.message, { errorDetails: details });
    }

    const entry = {
      snapshot: scheduledSnapshot,
      revision,
      scheduledAt: now(),
      abortController: createAbortController(),
      started: false,
    };
    pending = entry;

    if (activeEntry) {
      abortEntry(activeEntry);
    }

    try {
      timerId = setTimeoutFn(() => {
        timerId = null;
        if (pending !== entry) {
          return;
        }
        pending = null;
        enqueue(entry);
      }, scheduleDelay);
    } catch (error) {
      pending = null;
      const details = errorInfo(error);
      updateStatus({
        state: 'error',
        pending: false,
        lastError: details.message,
        lastErrorDetails: details,
      });
      return failureOutcome('error', 'timer-failed', details.message, { errorDetails: details });
    }

    updateStatus({
      state: 'scheduled',
      pending: true,
      lastError: null,
      lastErrorDetails: null,
      scheduledRevision: revision,
      scheduledAt: entry.scheduledAt,
    });

    return {
      ok: true,
      status: 'scheduled',
      code: 'scheduled',
      revision,
      delay: scheduleDelay,
      scheduledAt: entry.scheduledAt,
    };
  }

  function cancel() {
    if (disposed) {
      return failureOutcome('disposed', 'disposed', 'Controller autosave sudah dibersihkan.');
    }

    const hadPending = pending !== null || timerId !== null;
    if (timerId !== null) {
      try {
        clearTimeoutFn(timerId);
      } catch {
        // Abaikan error dari implementasi timer.
      }
      timerId = null;
    }
    pending = null;
    revision += 1;
    cancelRequested = true;
    const inFlight = running ? 1 : 0;
    const queued = queue.length;
    const abortRequested = abortAll();

    if (inFlight === 0 && queued === 0) {
      settleTerminalState();
    } else {
      updateStatus({ state: 'cancelling', pending: false });
    }

    const current = getStatus();
    return {
      ok: true,
      status: current.state,
      code: current.state,
      cancelled: hadPending,
      pendingCancelled: hadPending,
      inFlight,
      queued,
      abortRequested,
      revision,
    };
  }

  async function waitForIdle() {
    let observed;
    do {
      observed = lastTask;
      await observed;
    } while (observed !== lastTask || running || queue.length > 0);
    return getStatus();
  }

  function flush() {
    const hadPending = pending !== null || timerId !== null;
    if (!disposed) {
      if (timerId !== null) {
        try {
          clearTimeoutFn(timerId);
        } catch {
          // Abaikan error dari implementasi timer.
        }
        timerId = null;
      }

      if (pending) {
        const entry = pending;
        pending = null;
        enqueue(entry);
      }
    }

    const hadActiveWork = running || queue.length > 0;
    return waitForIdle().then((snapshotStatus) => ({
      ok: snapshotStatus.state !== 'error',
      status: snapshotStatus.state,
      code: hadPending ? 'flushed' : 'no-pending-save',
      flushed: hadPending,
      waited: hadPending || hadActiveWork,
      inFlight: snapshotStatus.inFlight,
      queued: snapshotStatus.queued,
      savedRevision: snapshotStatus.savedRevision,
      lastSavedAt: snapshotStatus.lastSavedAt,
      ...(snapshotStatus.state === 'error'
        ? { error: snapshotStatus.lastError, errorDetails: snapshotStatus.lastErrorDetails }
        : {}),
    }));
  }

  function dispose() {
    if (disposed) {
      const current = getStatus();
      return {
        ok: true,
        status: current.state,
        code: 'already-disposed',
        disposed: true,
        inFlight: current.inFlight,
        queued: current.queued,
      };
    }

    disposed = true;
    disposeRequested = true;
    cancelRequested = false;
    const hadPending = pending !== null || timerId !== null;
    if (timerId !== null) {
      try {
        clearTimeoutFn(timerId);
      } catch {
        // Abaikan error dari implementasi timer.
      }
      timerId = null;
    }
    pending = null;
    revision += 1;
    const inFlight = running ? 1 : 0;
    const queued = queue.length;
    const abortRequested = abortAll();

    if (inFlight === 0 && queued === 0) {
      settleTerminalState();
    } else {
      updateStatus({ state: 'disposing', pending: false });
    }

    const current = getStatus();
    return {
      ok: true,
      status: current.state,
      code: current.state === 'disposed' ? 'disposed' : 'disposing',
      disposed: true,
      pendingCancelled: hadPending,
      inFlight,
      queued,
      abortRequested,
      revision,
    };
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') {
      throw new TypeError('Listener status harus berupa fungsi.');
    }
    listeners.add(listener);
    try {
      listener(getStatus());
    } catch {
      // Listener tidak boleh menghentikan controller.
    }
    return () => {
      listeners.delete(listener);
    };
  }

  const controller = {
    schedule,
    cancel,
    flush,
    waitForIdle,
    dispose,
    getStatus,
    subscribe,
    get pending() {
      return pending !== null || timerId !== null;
    },
    get disposed() {
      return disposed;
    },
    get delay() {
      return delay;
    },
    get revision() {
      return revision;
    },
  };

  return controller;
}
