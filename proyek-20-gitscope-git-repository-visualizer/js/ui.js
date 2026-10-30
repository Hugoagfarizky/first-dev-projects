export function setHidden(element, hidden) {
  if (element) {
    element.hidden = Boolean(hidden);
  }
}

export function setText(element, value) {
  if (!element) {
    return;
  }
  const next = String(value ?? '');
  if (element.textContent !== next) {
    element.textContent = next;
  }
}

export function announceStatus(element, message, state = 'idle') {
  if (!element) return;
  const next = String(message ?? '');
  if (element.textContent !== next) {
    element.textContent = next;
  }
  element.dataset.state = String(state);
}

export function clearContainer(container) {
  if (container) {
    container.replaceChildren();
  }
}

export function createTextElement(tag, text, className = '') {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = String(text ?? '');
  return element;
}
