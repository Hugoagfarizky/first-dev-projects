function clone(value) {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function sameValue(a, b) {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

export class DiagramHistory {
  constructor(initialSnapshot = null, limit = 50) {
    const numericLimit = Number(limit);
    this.limit = Number.isFinite(numericLimit) && numericLimit > 0 ? Math.floor(numericLimit) : 50;
    this.snapshots = initialSnapshot === null || initialSnapshot === undefined ? [] : [clone(initialSnapshot)];
    this.index = this.snapshots.length - 1;
  }

  push(snapshot) {
    const next = clone(snapshot);

    if (this.snapshots.length === 0) {
      this.snapshots = [next];
      this.index = 0;
      return true;
    }

    this.snapshots = this.snapshots.slice(0, this.index + 1);

    if (sameValue(this.snapshots[this.index], next)) {
      return false;
    }

    this.snapshots.push(next);

    if (this.snapshots.length > this.limit) {
      this.snapshots.shift();
    }

    this.index = this.snapshots.length - 1;
    return true;
  }

  undo() {
    if (!this.canUndo()) {
      return null;
    }
    this.index -= 1;
    return clone(this.snapshots[this.index]);
  }

  redo() {
    if (!this.canRedo()) {
      return null;
    }
    this.index += 1;
    return clone(this.snapshots[this.index]);
  }

  canUndo() {
    return this.index > 0;
  }

  canRedo() {
    return this.index >= 0 && this.index < this.snapshots.length - 1;
  }

  current() {
    if (this.index < 0 || this.index >= this.snapshots.length) {
      return null;
    }
    return clone(this.snapshots[this.index]);
  }

  get size() {
    return this.snapshots.length;
  }

  get length() {
    return this.snapshots.length;
  }
}

// Alias agar modul berikutnya dapat memilih nama yang paling natural.
DiagramHistory.prototype.pushSnapshot = DiagramHistory.prototype.push;
DiagramHistory.prototype.getCurrent = DiagramHistory.prototype.current;
DiagramHistory.prototype.peek = DiagramHistory.prototype.current;

export function createHistory(initialSnapshot = null, limit = 50) {
  return new DiagramHistory(initialSnapshot, limit);
}

export const History = DiagramHistory;
