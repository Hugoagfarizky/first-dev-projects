import { LIMITS } from './task-model.js';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export class History {
  constructor(initialState, options = {}) {
    const requested = Number.isInteger(options.limit)
      ? options.limit
      : LIMITS.HISTORY_LIMIT;
    this.limit = Math.max(1, Math.min(200, requested));
    this.entries = [{ state: clone(initialState), label: 'Kondisi awal' }];
    this.index = 0;
  }

  get current() {
    return clone(this.entries[this.index].state);
  }

  get canUndo() {
    return this.index > 0;
  }

  get canRedo() {
    return this.index < this.entries.length - 1;
  }

  get undoCount() {
    return this.index;
  }

  get redoCount() {
    return this.entries.length - 1 - this.index;
  }

  get size() {
    return this.entries.length - 1;
  }

  record(nextState, label = 'Perubahan') {
    if (sameValue(this.current, nextState)) return false;
    this.entries = this.entries.slice(0, this.index + 1);
    this.entries.push({ state: clone(nextState), label: String(label) });
    if (this.entries.length > this.limit + 1) {
      this.entries.splice(0, this.entries.length - (this.limit + 1));
    }
    this.index = this.entries.length - 1;
    return true;
  }

  undo() {
    if (!this.canUndo) return null;
    const label = this.entries[this.index].label;
    this.index -= 1;
    return { state: clone(this.entries[this.index].state), label };
  }

  redo() {
    if (!this.canRedo) return null;
    this.index += 1;
    return {
      state: clone(this.entries[this.index].state),
      label: this.entries[this.index].label,
    };
  }
}
