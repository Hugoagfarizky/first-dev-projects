export function clearContainer(container) {
  if (container) {
    container.replaceChildren();
  }
}

export function createElement(tag, options = {}) {
  const element = document.createElement(tag);
  if (options.className) element.className = options.className;
  if (options.text !== undefined) element.textContent = options.text;
  if (options.type) element.type = options.type;
  return element;
}

export function renderKeyValueTable(container, rows, options = {}) {
  if (!container) return;
  container.replaceChildren();
  for (const row of rows) {
    const tr = document.createElement('tr');
    const keyCell = document.createElement('td');
    const keyInput = document.createElement('input');
    keyInput.type = 'text';
    keyInput.value = row.key || '';
    keyInput.addEventListener('input', () => options.onKeyChange?.(row.id, keyInput.value));
    keyCell.appendChild(keyInput);

    const valueCell = document.createElement('td');
    const valueInput = document.createElement('input');
    valueInput.type = 'text';
    valueInput.value = row.value || '';
    valueInput.addEventListener('input', () => options.onValueChange?.(row.id, valueInput.value));
    valueCell.appendChild(valueInput);

    const enabledCell = document.createElement('td');
    if (options.showEnabled) {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = row.enabled !== false;
      checkbox.addEventListener('change', () => options.onEnabledChange?.(row.id, checkbox.checked));
      enabledCell.appendChild(checkbox);
    }

    const actionCell = document.createElement('td');
    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.textContent = 'Hapus';
    removeButton.addEventListener('click', () => options.onRemove?.(row.id));
    actionCell.appendChild(removeButton);

    tr.append(keyCell, valueCell, enabledCell, actionCell);
    container.appendChild(tr);
  }
}

export function renderStatus(container, text, type = 'info') {
  if (!container) return;
  container.textContent = text;
  container.dataset.statusType = type;
}

export function renderResponse(container, inspected) {
  if (!container) return;
  container.replaceChildren();
  if (!inspected) {
    const empty = document.createElement('p');
    empty.textContent = 'Belum ada respons.';
    container.appendChild(empty);
    return;
  }
  if (!inspected.ok) {
    const error = document.createElement('p');
    error.className = 'error';
    error.textContent = inspected.error || 'Request gagal.';
    container.appendChild(error);
    return;
  }

  const meta = document.createElement('div');
  meta.className = 'response-meta';
  const status = document.createElement('strong');
  status.textContent = `${inspected.status} ${inspected.statusText}`;
  const duration = document.createElement('span');
  duration.textContent = `${inspected.durationMs} ms`;
  const size = document.createElement('span');
  size.textContent = `${inspected.body.size} bytes`;
  meta.append(status, duration, size);
  container.appendChild(meta);

  if (inspected.body.truncated) {
    const warning = document.createElement('p');
    warning.className = 'warning';
    warning.textContent = 'Respons terpotong karena melebihi batas ukuran.';
    container.appendChild(warning);
  }

  const headersTitle = document.createElement('h3');
  headersTitle.textContent = 'Response headers';
  container.appendChild(headersTitle);
  const headers = document.createElement('pre');
  headers.textContent = inspected.headerEntries.map((entry) => `${entry.name}: ${entry.value}`).join('\n');
  container.appendChild(headers);

  const bodyTitle = document.createElement('h3');
  bodyTitle.textContent = 'Response body';
  container.appendChild(bodyTitle);
  const body = document.createElement('pre');
  body.textContent = inspected.body.formatted || inspected.body.raw || '';
  container.appendChild(body);
}

export function renderList(container, items, renderItem) {
  if (!container) return;
  container.replaceChildren();
  for (const item of items) {
    container.appendChild(renderItem(item));
  }
}