import { LOG_LEVELS } from './log-model.js';

const LEGEND_ORDER = ['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE', 'FATAL', 'UNKNOWN'];
const numberFormatter = new Intl.NumberFormat('id-ID');

export function setText(element, value) {
  if (element) {
    element.textContent = String(value ?? '');
  }
}

export function setHidden(element, hidden) {
  if (element) {
    element.hidden = Boolean(hidden);
  }
}

export function setDisabled(elements, disabled) {
  const list = Array.isArray(elements) ? elements : [elements];
  for (const element of list) {
    if (element) {
      element.disabled = Boolean(disabled);
    }
  }
}

export function announceStatus(element, message, state = 'idle') {
  if (!element) {
    return;
  }

  element.textContent = String(message ?? '');
  element.dataset.state = String(state);
}

export function formatNumber(value) {
  return Number.isFinite(value) ? numberFormatter.format(value) : '—';
}

export function formatBytes(value) {
  if (!Number.isFinite(value) || value < 0) {
    return '—';
  }

  if (value < 1024) {
    return `${formatNumber(value)} B`;
  }

  const units = ['KiB', 'MiB', 'GiB'];
  let size = value / 1024;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 1,
  }).format(size)} ${units[unitIndex]}`;
}

export function formatTimestamp(value) {
  return typeof value === 'string' && value !== '' ? value : '—';
}

export function renderLevelFilters(container, selectedLevels = LOG_LEVELS) {
  if (!container) {
    return;
  }

  const selected = new Set(Array.isArray(selectedLevels) ? selectedLevels : LOG_LEVELS);
  const fragment = document.createDocumentFragment();

  for (const level of LEGEND_ORDER) {
    const label = document.createElement('label');
    label.className = `level-option level-${level.toLowerCase()}`;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = level;
    checkbox.checked = selected.has(level);
    checkbox.dataset.levelFilter = level;

    const text = document.createElement('span');
    text.textContent = level;

    label.append(checkbox, text);
    fragment.append(label);
  }

  container.replaceChildren(fragment);
}

export function syncLevelFilters(container, selectedLevels = LOG_LEVELS) {
  if (!container) {
    return;
  }

  const selected = new Set(Array.isArray(selectedLevels) ? selectedLevels : LOG_LEVELS);
  for (const checkbox of container.querySelectorAll('input[data-level-filter]')) {
    checkbox.checked = selected.has(checkbox.value);
  }
}

export function renderLevelCounts(container, levelCounts = null) {
  if (!container) {
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const level of LEGEND_ORDER) {
    const row = document.createElement('div');
    row.className = 'level-count-row';

    const chip = document.createElement('span');
    chip.className = `level-chip level-${level.toLowerCase()}`;
    chip.textContent = level;

    const value = document.createElement('span');
    value.className = 'level-count-value';
    value.textContent = formatNumber(levelCounts?.[level] ?? 0);

    row.append(chip, value);
    fragment.append(row);
  }

  container.replaceChildren(fragment);
}

export function renderStatistics(root, statistics) {
  if (!root) {
    return;
  }

  const available = statistics && statistics.ok !== false;
  setText(root.querySelector('[data-stat-total]'), available ? formatNumber(statistics.totalLines) : '—');
  setText(root.querySelector('[data-stat-blank]'), available ? formatNumber(statistics.blankLines) : '—');
  setText(root.querySelector('[data-stat-no-time]'), available ? formatNumber(statistics.withoutTimestamp) : '—');
  setText(root.querySelector('[data-stat-first]'), available ? formatTimestamp(statistics.firstTimestampIso) : '—');
  setText(root.querySelector('[data-stat-last]'), available ? formatTimestamp(statistics.lastTimestampIso) : '—');
  renderLevelCounts(
    root.querySelector('[data-stat-levels]'),
    available ? statistics.levelCounts : null,
  );
}

export function renderFileMeta(elements, state) {
  const dataset = state.dataset;
  const loading = state.load.status === 'loading';

  if (dataset) {
    setText(elements.fileName, dataset.fileName);
    setText(elements.fileSize, formatBytes(dataset.fileSize));
    setText(elements.fileLines, formatNumber(dataset.totalLines));
    setText(elements.fileTruncated, formatNumber(dataset.truncatedLines));
    return;
  }

  if (loading) {
    setText(elements.fileName, state.load.fileName ?? 'File tanpa nama');
    setText(elements.fileSize, formatBytes(state.load.fileSize));
    setText(elements.fileLines, formatNumber(state.load.lines));
    setText(elements.fileTruncated, '—');
    return;
  }

  setText(elements.fileName, 'Belum ada file');
  setText(elements.fileSize, '—');
  setText(elements.fileLines, '—');
  setText(elements.fileTruncated, '—');
}

export function renderLoadProgress(elements, load) {
  const loading = load.status === 'loading';
  setHidden(elements.wrap, !loading);

  if (!loading) {
    return;
  }

  const progress = elements.progress;
  if (progress) {
    progress.max = 100;
    if (Number.isFinite(load.progress)) {
      progress.value = Math.round(load.progress * 100);
    } else {
      progress.removeAttribute('value');
    }
  }

  const size = load.fileSize === null
    ? `${formatBytes(load.bytesRead)} dibaca`
    : `${formatBytes(load.bytesRead)} dari ${formatBytes(load.fileSize)}`;
  const percent = Number.isFinite(load.progress)
    ? ` · ${Math.round(load.progress * 100)}%`
    : '';
  setText(elements.text, `${size}${percent} · ${formatNumber(load.lines)} baris`);
}

export function renderLoadError(element, load) {
  const error = load.error;
  setHidden(element, !error);
  if (error) {
    setText(element, `${error.message} (${error.code})`);
  } else {
    setText(element, '');
  }
}

export function renderLogRows(tbody, records, resultIndices, activeResultIndex, emptyState) {
  if (!tbody) {
    return;
  }

  const fragment = document.createDocumentFragment();

  if (!Array.isArray(records) || records.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 4;

    const empty = document.createElement('div');
    empty.className = 'table-empty';

    const title = document.createElement('strong');
    title.textContent = emptyState?.title ?? 'Tidak ada baris log.';

    const description = document.createElement('p');
    description.textContent = emptyState?.description ?? '';

    empty.append(title, description);
    cell.append(empty);
    row.append(cell);
    fragment.append(row);
    tbody.replaceChildren(fragment);
    return;
  }

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const resultIndex = resultIndices?.[index];
    const row = document.createElement('tr');
    row.className = 'log-row';
    if (Number.isInteger(resultIndex)) {
      row.dataset.resultIndex = String(resultIndex);
    }

    if (resultIndex === activeResultIndex) {
      row.classList.add('is-active');
      row.setAttribute('aria-current', 'true');
    }

    const lineCell = document.createElement('td');
    lineCell.className = 'log-line-number';
    lineCell.textContent = formatNumber(record?.lineNumber);

    const timeCell = document.createElement('td');
    timeCell.className = 'log-time';
    timeCell.textContent = formatTimestamp(record?.timestampIso);

    const levelCell = document.createElement('td');
    const level = typeof record?.level === 'string' ? record.level : 'UNKNOWN';
    const levelChip = document.createElement('span');
    levelChip.className = `level-chip level-${level.toLowerCase()}`;
    levelChip.textContent = level;
    levelCell.append(levelChip);

    const messageCell = document.createElement('td');
    const message = document.createElement('span');
    message.className = 'log-message';
    if (record?.blank === true) {
      message.classList.add('blank-marker');
      message.textContent = '(baris kosong)';
    } else {
      message.textContent = typeof record?.message === 'string' && record.message !== ''
        ? record.message
        : '—';
    }
    messageCell.append(message);

    row.append(lineCell, timeCell, levelCell, messageCell);
    fragment.append(row);
  }

  tbody.replaceChildren(fragment);
}
