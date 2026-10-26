import { createDiagram, createNode, addNode, updateNode, removeNode, addEdge, removeEdge, updateEdge } from './diagram-model.js';
import { DiagramHistory } from './history.js';
import { renderDiagram } from './svg-renderer.js';

const BASE_VIEWPORT_WIDTH = 1600;
const BASE_VIEWPORT_HEIGHT = 900;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;

export function clampZoom(zoom) {
  const numericZoom = Number(zoom);
  if (!Number.isFinite(numericZoom)) {
    return 1;
  }
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, numericZoom));
}

export function createDefaultViewport() {
  return { x: 0, y: 0, zoom: 1 };
}

export function normalizeViewport(viewport) {
  if (!viewport || typeof viewport !== 'object') {
    return createDefaultViewport();
  }
  return {
    x: Number.isFinite(viewport.x) ? viewport.x : 0,
    y: Number.isFinite(viewport.y) ? viewport.y : 0,
    zoom: clampZoom(viewport.zoom),
  };
}

export function zoomViewport(viewport, factor, anchor = null) {
  const current = normalizeViewport(viewport);
  const numericFactor = Number(factor);
  const safeFactor = Number.isFinite(numericFactor) && numericFactor > 0 ? numericFactor : 1;
  const nextZoom = clampZoom(current.zoom * safeFactor);
  if (nextZoom === current.zoom) {
    return current;
  }

  const currentWidth = BASE_VIEWPORT_WIDTH / current.zoom;
  const currentHeight = BASE_VIEWPORT_HEIGHT / current.zoom;
  const nextWidth = BASE_VIEWPORT_WIDTH / nextZoom;
  const nextHeight = BASE_VIEWPORT_HEIGHT / nextZoom;

  if (anchor && Number.isFinite(anchor.x) && Number.isFinite(anchor.y)) {
    const ratioX = nextWidth / currentWidth;
    const ratioY = nextHeight / currentHeight;
    return {
      x: anchor.x - (anchor.x - current.x) * ratioX,
      y: anchor.y - (anchor.y - current.y) * ratioY,
      zoom: nextZoom,
    };
  }

  const centerX = current.x + currentWidth / 2;
  const centerY = current.y + currentHeight / 2;
  return {
    x: centerX - nextWidth / 2,
    y: centerY - nextHeight / 2,
    zoom: nextZoom,
  };
}

export function panViewport(viewport, dx, dy) {
  const current = normalizeViewport(viewport);
  const safeDx = Number.isFinite(dx) ? dx : 0;
  const safeDy = Number.isFinite(dy) ? dy : 0;
  return {
    x: current.x - safeDx,
    y: current.y - safeDy,
    zoom: current.zoom,
  };
}

export function fitViewportToDiagram(diagram, baseWidth = BASE_VIEWPORT_WIDTH, baseHeight = BASE_VIEWPORT_HEIGHT, padding = 80) {
  const nodes = Array.isArray(diagram?.nodes) ? diagram.nodes : [];
  if (nodes.length === 0) {
    return createDefaultViewport();
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    const width = Number.isFinite(node.width) ? node.width : 160;
    const height = Number.isFinite(node.height) ? node.height : 80;
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    minX = Math.min(minX, node.x - halfWidth);
    maxX = Math.max(maxX, node.x + halfWidth);
    minY = Math.min(minY, node.y - halfHeight);
    maxY = Math.max(maxY, node.y + halfHeight);
  }

  const contentWidth = maxX - minX;
  const contentHeight = maxY - minY;
  const paddedWidth = Math.max(contentWidth + padding * 2, 1);
  const paddedHeight = Math.max(contentHeight + padding * 2, 1);
  const scale = Math.min(baseWidth / paddedWidth, baseHeight / paddedHeight, MAX_ZOOM);
  const zoom = clampZoom(Math.max(scale, MIN_ZOOM));
  const viewWidth = baseWidth / zoom;
  const viewHeight = baseHeight / zoom;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  return {
    x: centerX - viewWidth / 2,
    y: centerY - viewHeight / 2,
    zoom,
  };
}

function clone(value) {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function deepEqual(a, b) {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

function nodeExists(diagram, nodeId) {
  return diagram.nodes.some((node) => node.id === nodeId);
}

function edgeExists(diagram, edgeId) {
  return diagram.edges.some((edge) => edge.id === edgeId);
}

function normalizeSelection(diagram, selection) {
  if (!selection) {
    return null;
  }
  if (selection.type === 'node' && nodeExists(diagram, selection.id)) {
    return selection;
  }
  if (selection.type === 'edge' && edgeExists(diagram, selection.id)) {
    return selection;
  }
  return null;
}

function toSvgPoint(svg, clientX, clientY) {
  if (!svg || typeof svg.createSVGPoint !== 'function') {
    return null;
  }
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const ctm = typeof svg.getScreenCTM === 'function' ? svg.getScreenCTM() : null;
  if (!ctm || typeof ctm.inverse !== 'function') {
    return null;
  }
  const transformed = point.matrixTransform(ctm.inverse());
  if (!Number.isFinite(transformed.x) || !Number.isFinite(transformed.y)) {
    return null;
  }
  return { x: transformed.x, y: transformed.y };
}

export class DiagramController {
  constructor(config = {}) {
    this.svg = config.svg ?? config.canvas ?? null;
    this.statusEl = config.statusEl ?? config.status ?? null;
    this.infoEl = config.infoEl ?? config.info ?? null;
    this.inspectorEl = config.inspectorEl ?? config.inspector ?? null;
    this.emptyStateEl = config.emptyStateEl ?? config.emptyState ?? null;
    this.buttons = config.buttons ?? {};
    this.keyTarget = config.keyTarget ?? null;

    this.diagram = createDiagram();
    this.history = new DiagramHistory(this.diagram);
    this.selection = null;
    this.connectMode = false;
    this.connectSourceId = null;
    this.panMode = false;
    this.isPanning = false;
    this.spacePressed = false;
    this.panStart = null;
    this.drag = null;
    this.textEditBase = null;

    this.boundPointerDown = this.handlePointerDown.bind(this);
    this.boundPointerMove = this.handlePointerMove.bind(this);
    this.boundPointerUp = this.handlePointerUp.bind(this);
    this.boundPointerCancel = this.handlePointerCancel.bind(this);
    this.boundKeyDown = this.handleKeyDown.bind(this);
    this.boundKeyUp = this.handleKeyUp.bind(this);
    this.boundWheel = this.handleWheel.bind(this);

    if (this.svg && typeof this.svg.addEventListener === 'function') {
      this.svg.addEventListener('pointerdown', this.boundPointerDown);
      this.svg.addEventListener('pointermove', this.boundPointerMove);
      this.svg.addEventListener('pointerup', this.boundPointerUp);
      this.svg.addEventListener('pointercancel', this.boundPointerCancel);
      this.svg.addEventListener('wheel', this.boundWheel, { passive: false });
    }

    const keyTarget = config.keyTarget ?? (typeof document !== 'undefined' ? document : null);
    if (keyTarget && typeof keyTarget.addEventListener === 'function') {
      keyTarget.addEventListener('keydown', this.boundKeyDown);
      keyTarget.addEventListener('keyup', this.boundKeyUp);
    }

    this.renderAll();
  }

  get selectedNode() {
    if (this.selection?.type !== 'node') {
      return null;
    }
    return this.diagram.nodes.find((node) => node.id === this.selection.id) ?? null;
  }

  get selectedEdge() {
    if (this.selection?.type !== 'edge') {
      return null;
    }
    return this.diagram.edges.find((edge) => edge.id === this.selection.id) ?? null;
  }

  deepEqual(a, b) {
    return deepEqual(a, b);
  }

  renderCanvas() {
    if (!this.svg) {
      return;
    }
    const previousFocusId = typeof document !== 'undefined' ? document.activeElement?.dataset?.nodeId ?? null : null;
    renderDiagram(this.svg, this.diagram, {
      selectedNodeId: this.selection?.type === 'node' ? this.selection.id : null,
      selectedEdgeId: this.selection?.type === 'edge' ? this.selection.id : null,
      connectSourceId: this.connectSourceId,
    });

    if (previousFocusId && typeof document !== 'undefined') {
      const element = this.svg.querySelector(`[data-node-id="${previousFocusId}"]`);
      element?.focus();
    }
  }

  updateStatus(message = '') {
    const base = `${this.diagram.nodes.length} node, ${this.diagram.edges.length} edge`;
    const mode = this.connectMode ? 'Mode konektor aktif' : this.panMode ? 'Mode pan aktif' : 'Mode pilih';
    const historyStatus = `Undo: ${this.history.canUndo() ? 'tersedia' : 'tidak'}, Redo: ${this.history.canRedo() ? 'tersedia' : 'tidak'}`;
    const zoomStatus = `Zoom: ${Math.round(this.diagram.viewport.zoom * 100)}%`;

    if (this.statusEl) {
      this.statusEl.textContent = message
        ? `${message} | ${base} | ${mode} | ${zoomStatus} | ${historyStatus}`
        : `${base} | ${mode} | ${zoomStatus} | ${historyStatus}`;
    }

    if (this.infoEl) {
      this.infoEl.textContent = `${this.diagram.nodes.length} node, ${this.diagram.edges.length} edge`;
    }

    if (this.buttons?.undo) {
      this.buttons.undo.disabled = !this.history.canUndo();
    }
    if (this.buttons?.redo) {
      this.buttons.redo.disabled = !this.history.canRedo();
    }
    if (this.buttons?.delete) {
      this.buttons.delete.disabled = !this.selection;
    }
    if (this.buttons?.connect) {
      this.buttons.connect.textContent = this.connectMode ? 'Mode konektor: aktif' : 'Mode konektor';
      this.buttons.connect.setAttribute('aria-pressed', String(this.connectMode));
    }
    if (this.buttons?.pan) {
      this.buttons.pan.textContent = this.panMode ? 'Pan: aktif' : 'Pan';
      this.buttons.pan.setAttribute('aria-pressed', String(this.panMode));
    }
    if (this.buttons?.zoomIn) {
      this.buttons.zoomIn.disabled = this.diagram.viewport.zoom >= MAX_ZOOM;
    }
    if (this.buttons?.zoomOut) {
      this.buttons.zoomOut.disabled = this.diagram.viewport.zoom <= MIN_ZOOM;
    }
  }

  updateEmptyState() {
    if (!this.emptyStateEl) {
      return;
    }
    this.emptyStateEl.hidden = this.diagram.nodes.length > 0;
  }

  updateInspector() {
    if (!this.inspectorEl) {
      return;
    }

    while (this.inspectorEl.firstChild) {
      this.inspectorEl.removeChild(this.inspectorEl.firstChild);
    }

    const heading = document.createElement('h2');
    heading.textContent = 'Inspector';
    this.inspectorEl.appendChild(heading);

    if (this.selection?.type === 'node') {
      const node = this.selectedNode;
      if (!node) {
        this.selection = null;
        this.renderAll();
        return;
      }

      const info = document.createElement('p');
      info.textContent = `Node: ${node.type} (${node.id})`;
      this.inspectorEl.appendChild(info);

      const textLabel = document.createElement('label');
      textLabel.textContent = 'Teks';
      const textInput = document.createElement('input');
      textInput.type = 'text';
      textInput.maxLength = 120;
      textInput.value = node.text;
      textInput.setAttribute('aria-label', 'Teks node');
      textLabel.appendChild(textInput);
      this.inspectorEl.appendChild(textLabel);

      this.textEditBase = clone(this.diagram);

      textInput.addEventListener('focus', () => {
        this.textEditBase = clone(this.diagram);
      });

      textInput.addEventListener('input', () => {
        try {
          this.diagram = updateNode(this.diagram, node.id, { text: textInput.value });
          this.renderCanvas();
          this.updateStatus();
        } catch (error) {
          this.updateStatus(`Gagal mengubah teks: ${error?.message ?? 'kesalahan tidak diketahui'}`);
        }
      });

      textInput.addEventListener('blur', () => {
        if (this.textEditBase && !deepEqual(this.textEditBase, this.diagram)) {
          const pushed = this.history.push(this.diagram);
          if (pushed) {
            this.diagram = this.history.current();
          }
          this.textEditBase = clone(this.diagram);
          this.updateStatus();
        }
      });

      textInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          textInput.blur();
        }
      });

      const colorLabel = document.createElement('label');
      colorLabel.textContent = 'Warna isi';
      const colorInput = document.createElement('input');
      colorInput.type = 'color';
      colorInput.value = node.fill;
      colorInput.setAttribute('aria-label', 'Warna isi node');
      colorLabel.appendChild(colorInput);
      this.inspectorEl.appendChild(colorLabel);

      colorInput.addEventListener('change', () => {
        try {
          const next = updateNode(this.diagram, node.id, { fill: colorInput.value });
          this.commitDiagram(next);
          this.textEditBase = clone(this.diagram);
        } catch (error) {
          this.updateStatus(`Gagal mengubah warna: ${error?.message ?? 'kesalahan tidak diketahui'}`);
        }
      });

      const strokeLabel = document.createElement('label');
      strokeLabel.textContent = 'Warna garis';
      const strokeInput = document.createElement('input');
      strokeInput.type = 'color';
      strokeInput.value = node.stroke;
      strokeInput.setAttribute('aria-label', 'Warna garis node');
      strokeLabel.appendChild(strokeInput);
      this.inspectorEl.appendChild(strokeLabel);

      strokeInput.addEventListener('change', () => {
        try {
          const next = updateNode(this.diagram, node.id, { stroke: strokeInput.value });
          this.commitDiagram(next);
          this.textEditBase = clone(this.diagram);
        } catch (error) {
          this.updateStatus(`Gagal mengubah warna garis: ${error?.message ?? 'kesalahan tidak diketahui'}`);
        }
      });

      const textColorLabel = document.createElement('label');
      textColorLabel.textContent = 'Warna teks';
      const textInputColor = document.createElement('input');
      textInputColor.type = 'color';
      textInputColor.value = node.textColor;
      textInputColor.setAttribute('aria-label', 'Warna teks node');
      textColorLabel.appendChild(textInputColor);
      this.inspectorEl.appendChild(textColorLabel);

      textInputColor.addEventListener('change', () => {
        try {
          const next = updateNode(this.diagram, node.id, { textColor: textInputColor.value });
          this.commitDiagram(next);
          this.textEditBase = clone(this.diagram);
        } catch (error) {
          this.updateStatus(`Gagal mengubah warna teks: ${error?.message ?? 'kesalahan tidak diketahui'}`);
        }
      });

      const dimensions = document.createElement('p');
      dimensions.textContent = `Ukuran: ${node.width} × ${node.height}`;
      this.inspectorEl.appendChild(dimensions);
    } else if (this.selection?.type === 'edge') {
      const edge = this.selectedEdge;
      if (!edge) {
        this.selection = null;
        this.renderAll();
        return;
      }

      const info = document.createElement('p');
      info.textContent = `Edge: ${edge.id}`;
      this.inspectorEl.appendChild(info);

      const connection = document.createElement('p');
      connection.textContent = `Dari ${edge.from} ke ${edge.to}`;
      this.inspectorEl.appendChild(connection);

      const labelLabel = document.createElement('label');
      labelLabel.textContent = 'Label';
      const labelInput = document.createElement('input');
      labelInput.type = 'text';
      labelInput.maxLength = 80;
      labelInput.value = edge.label;
      labelInput.setAttribute('aria-label', 'Label edge');
      labelLabel.appendChild(labelInput);
      this.inspectorEl.appendChild(labelLabel);

      labelInput.addEventListener('change', () => {
        try {
          const next = updateEdgeLabel(this.diagram, edge.id, labelInput.value);
          this.commitDiagram(next);
        } catch (error) {
          this.updateStatus(`Gagal mengubah label: ${error?.message ?? 'kesalahan tidak diketahui'}`);
        }
      });
    } else {
      const empty = document.createElement('p');
      empty.textContent = 'Pilih node atau edge untuk mengedit propertinya.';
      this.inspectorEl.appendChild(empty);
    }
  }

  renderAll() {
    this.renderCanvas();
    this.updateInspector();
    this.updateEmptyState();
    this.updateStatus();
  }

  commitDiagram(nextDiagram) {
    if (deepEqual(this.diagram, nextDiagram)) {
      this.renderAll();
      return false;
    }
    const pushed = this.history.push(nextDiagram);
    this.diagram = pushed ? this.history.current() : nextDiagram;
    this.renderAll();
    return pushed;
  }

  addNode(type) {
    const count = this.diagram.nodes.length;
    const x = 800 + (count % 5) * 32 - 64;
    const y = 450 + Math.floor(count / 5) * 32 - 64;

    try {
      const node = createNode(type, x, y);
      const next = addNode(this.diagram, node);
      this.selection = { type: 'node', id: node.id };
      this.connectSourceId = null;
      this.commitDiagram(next);
      this.updateStatus(`Node ${type} ditambahkan.`);
    } catch (error) {
      this.updateStatus(`Gagal menambah node: ${error?.message ?? 'kesalahan tidak diketahui'}.`);
    }
  }

  deleteSelection() {
    if (this.selection?.type === 'node') {
      try {
        const next = removeNode(this.diagram, this.selection.id);
        this.selection = null;
        this.commitDiagram(next);
        this.updateStatus('Node dihapus.');
      } catch (error) {
        this.updateStatus(`Gagal menghapus node: ${error?.message ?? 'kesalahan tidak diketahui'}.`);
      }
      return;
    }

    if (this.selection?.type === 'edge') {
      try {
        const next = removeEdge(this.diagram, this.selection.id);
        this.selection = null;
        this.commitDiagram(next);
        this.updateStatus('Konektor dihapus.');
      } catch (error) {
        this.updateStatus(`Gagal menghapus konektor: ${error?.message ?? 'kesalahan tidak diketahui'}.`);
      }
      return;
    }

    this.updateStatus('Tidak ada node atau edge yang dipilih.');
  }

  startConnectMode() {
    this.connectMode = true;
    this.connectSourceId = null;
    this.selection = null;
    this.renderAll();
    this.updateStatus('Mode konektor aktif. Pilih node sumber.');
  }

  cancelConnectMode() {
    if (this.connectMode || this.connectSourceId) {
      this.connectMode = false;
      this.connectSourceId = null;
      this.renderAll();
      this.updateStatus('Mode konektor dibatalkan.');
    }
  }

  toggleConnectMode() {
    if (this.connectMode) {
      this.cancelConnectMode();
    } else {
      this.startConnectMode();
    }
  }

  togglePanMode() {
    this.panMode = !this.panMode;
    if (this.svg?.style) {
      this.svg.style.cursor = this.panMode ? 'grab' : '';
    }
    this.updateStatus(this.panMode ? 'Mode pan aktif.' : 'Mode pan nonaktif.');
  }

  zoomIn() {
    this.setViewport(zoomViewport(this.diagram.viewport, 1.25));
  }

  zoomOut() {
    this.setViewport(zoomViewport(this.diagram.viewport, 1 / 1.25));
  }

  resetZoom() {
    this.setViewport(createDefaultViewport());
  }

  fitToView() {
    this.setViewport(fitViewportToDiagram(this.diagram));
  }

  setViewport(viewport) {
    const nextViewport = normalizeViewport(viewport);
    this.diagram = { ...this.diagram, viewport: nextViewport };
    this.renderCanvas();
    this.updateStatus();
  }

  handleWheel(event) {
    if (!this.svg) {
      return;
    }
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
    const anchor = toSvgPoint(this.svg, event.clientX, event.clientY);
    this.setViewport(zoomViewport(this.diagram.viewport, factor, anchor));
  }

  handleKeyUp(event) {
    if (event.code === 'Space' || event.key === ' ') {
      this.spacePressed = false;
      if (this.isPanning) {
        this.isPanning = false;
        this.panStart = null;
        this.updateStatus('Pan selesai.');
      }
    }
  }

  undo() {
    const next = this.history.undo();
    if (!next) {
      this.updateStatus('Tidak ada aksi yang dapat di-undo.');
      return;
    }
    this.diagram = next;
    this.selection = normalizeSelection(this.diagram, this.selection);
    this.connectSourceId = this.connectSourceId && nodeExists(this.diagram, this.connectSourceId) ? this.connectSourceId : null;
    this.renderAll();
    this.updateStatus('Undo berhasil.');
  }

  redo() {
    const next = this.history.redo();
    if (!next) {
      this.updateStatus('Tidak ada aksi yang dapat di-redo.');
      return;
    }
    this.diagram = next;
    this.selection = normalizeSelection(this.diagram, this.selection);
    this.connectSourceId = this.connectSourceId && nodeExists(this.diagram, this.connectSourceId) ? this.connectSourceId : null;
    this.renderAll();
    this.updateStatus('Redo berhasil.');
  }

  handleKeyDown(event) {
    const target = event.target;
    const isForm = Boolean(target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable));
    const isInteractiveControl = Boolean(target && (isForm || target.tagName === 'BUTTON' || target.tagName === 'A' || target.getAttribute?.('role') === 'button' || target.getAttribute?.('role') === 'link'));

    if (event.code === 'Space' || event.key === ' ') {
      if (isInteractiveControl) {
        return;
      }
      event.preventDefault();
      this.spacePressed = true;
      if (this.svg?.style) {
        this.svg.style.cursor = 'grab';
      }
      return;
    }

    if (event.key === 'Escape') {
      this.cancelConnectMode();
      this.selection = null;
      if (target && typeof target.blur === 'function' && target !== this.svg) {
        target.blur();
      }
      this.renderAll();
      this.updateStatus('Seleksi dibatalkan.');
      return;
    }

    if (isForm) {
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) {
        this.redo();
      } else {
        this.undo();
      }
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      this.redo();
      return;
    }

    if (!isForm && (event.key === '+' || event.key === '=')) {
      event.preventDefault();
      this.zoomIn();
      return;
    }

    if (!isForm && event.key === '-') {
      event.preventDefault();
      this.zoomOut();
      return;
    }

    if (!isForm && event.key === '0') {
      event.preventDefault();
      this.fitToView();
      return;
    }

    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      this.deleteSelection();
      return;
    }

    if (this.selection?.type === 'node' && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
      const node = this.selectedNode;
      if (!node) {
        return;
      }
      const dx = event.key === 'ArrowRight' ? 10 : event.key === 'ArrowLeft' ? -10 : 0;
      const dy = event.key === 'ArrowDown' ? 10 : event.key === 'ArrowUp' ? -10 : 0;
      try {
        const next = updateNode(this.diagram, node.id, { x: node.x + dx, y: node.y + dy });
        this.commitDiagram(next);
        this.updateStatus('Node dipindahkan dengan keyboard.');
      } catch (error) {
        this.updateStatus(`Gagal memindahkan node: ${error?.message ?? 'kesalahan tidak diketahui'}.`);
      }
    }
  }

  handlePointerDown(event) {
    if (!this.svg) {
      return;
    }

    const isPanGesture = this.panMode || this.spacePressed || event.button === 1;
    if (isPanGesture) {
      this.isPanning = true;
      this.panStart = {
        clientX: event.clientX,
        clientY: event.clientY,
        viewport: clone(this.diagram.viewport),
      };
      if (this.svg.style) {
        this.svg.style.cursor = 'grabbing';
      }
      try {
        this.svg.setPointerCapture(event.pointerId);
      } catch {
        // Ignore environments without pointer capture.
      }
      this.updateStatus('Pan aktif.');
      return;
    }

    const point = toSvgPoint(this.svg, event.clientX, event.clientY);
    if (!point) {
      return;
    }

    const nodeElement = typeof event.target?.closest === 'function' ? event.target.closest('[data-node-id]') : null;
    const edgeElement = typeof event.target?.closest === 'function' ? event.target.closest('[data-edge-id]') : null;

    if (this.connectMode && nodeElement) {
      const nodeId = nodeElement.dataset.nodeId;
      if (this.connectSourceId === null) {
        this.connectSourceId = nodeId;
        this.selection = { type: 'node', id: nodeId };
        this.renderAll();
        this.updateStatus('Node sumber dipilih. Pilih node tujuan.');
        return;
      }

      if (this.connectSourceId === nodeId) {
        this.connectSourceId = null;
        this.selection = { type: 'node', id: nodeId };
        this.renderAll();
        this.updateStatus('Pemilihan sumber konektor dibatalkan.');
        return;
      }

      const oldEdgeIds = new Set(this.diagram.edges.map((edge) => edge.id));
      try {
        const next = addEdge(this.diagram, this.connectSourceId, nodeId);
        const newEdge = next.edges.find((edge) => !oldEdgeIds.has(edge.id));
        this.commitDiagram(next);
        this.selection = newEdge ? { type: 'edge', id: newEdge.id } : null;
        this.connectSourceId = null;
        this.updateStatus('Konektor dibuat.');
      } catch (error) {
        this.updateStatus(`Gagal membuat konektor: ${error?.message ?? 'kesalahan tidak diketahui'}.`);
      }
      return;
    }

    if (nodeElement) {
      const nodeId = nodeElement.dataset.nodeId;
      this.selection = { type: 'node', id: nodeId };
      this.drag = {
        pointerId: event.pointerId,
        nodeId,
        start: point,
        baseDiagram: clone(this.diagram),
        latestDiagram: clone(this.diagram),
        moved: false,
      };
      try {
        this.svg.setPointerCapture(event.pointerId);
      } catch {
        // Browser or test environment may not support pointer capture.
      }
      this.renderAll();
      return;
    }

    if (edgeElement) {
      this.selection = { type: 'edge', id: edgeElement.dataset.edgeId };
      this.renderAll();
      return;
    }

    this.selection = null;
    if (typeof this.svg?.focus === 'function') {
      this.svg.focus();
    }
    this.renderAll();
  }

  handlePointerMove(event) {
    if (this.isPanning) {
      if (!this.panStart || !this.svg) {
        return;
      }
      const rect = typeof this.svg.getBoundingClientRect === 'function' ? this.svg.getBoundingClientRect() : null;
      if (!rect || rect.width <= 0 || rect.height <= 0) {
        return;
      }
      const viewport = this.diagram.viewport;
      const viewWidth = BASE_VIEWPORT_WIDTH / viewport.zoom;
      const viewHeight = BASE_VIEWPORT_HEIGHT / viewport.zoom;
      const scaleX = viewWidth / rect.width;
      const scaleY = viewHeight / rect.height;
      const dx = (event.clientX - this.panStart.clientX) * scaleX;
      const dy = (event.clientY - this.panStart.clientY) * scaleY;
      this.setViewport(panViewport(this.panStart.viewport, dx, dy));
      return;
    }

    if (!this.drag || event.pointerId !== this.drag.pointerId) {
      return;
    }

    const point = toSvgPoint(this.svg, event.clientX, event.clientY);
    if (!point) {
      return;
    }

    const dx = point.x - this.drag.start.x;
    const dy = point.y - this.drag.start.y;
    if (!this.drag.moved && Math.hypot(dx, dy) < 3) {
      return;
    }

    const baseNode = this.drag.baseDiagram.nodes.find((node) => node.id === this.drag.nodeId);
    if (!baseNode) {
      this.handlePointerCancel(event);
      return;
    }

    const snappedX = Math.round((baseNode.x + dx) / 10) * 10;
    const snappedY = Math.round((baseNode.y + dy) / 10) * 10;

    try {
      const next = updateNode(this.drag.baseDiagram, this.drag.nodeId, { x: snappedX, y: snappedY });
      this.drag.latestDiagram = next;
      this.drag.moved = true;
      this.diagram = next;
      this.renderCanvas();
    } catch (error) {
      this.updateStatus(`Gagal memindahkan node: ${error?.message ?? 'kesalahan tidak diketahui'}.`);
    }
  }

  handlePointerUp(event) {
    if (this.isPanning) {
      this.isPanning = false;
      this.panStart = null;
      if (this.svg.style) {
        this.svg.style.cursor = this.panMode ? 'grab' : '';
      }
      try {
        if (typeof this.svg.releasePointerCapture === 'function') {
          this.svg.releasePointerCapture(event.pointerId);
        }
      } catch {
        // Ignore environments without pointer capture.
      }
      this.updateStatus('Pan selesai.');
      return;
    }

    if (!this.drag || event.pointerId !== this.drag.pointerId) {
      return;
    }

    const drag = this.drag;
    this.drag = null;

    try {
      if (typeof this.svg.releasePointerCapture === 'function') {
        this.svg.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Ignore environments without pointer capture.
    }

    if (drag.moved && drag.latestDiagram && !deepEqual(drag.baseDiagram, drag.latestDiagram)) {
      const pushed = this.history.push(drag.latestDiagram);
      this.diagram = pushed ? this.history.current() : drag.latestDiagram;
      this.selection = { type: 'node', id: drag.nodeId };
      this.updateStatus('Node dipindahkan.');
    } else {
      this.diagram = drag.baseDiagram;
      this.selection = { type: 'node', id: drag.nodeId };
    }

    this.renderAll();
  }

  handlePointerCancel(event) {
    if (this.isPanning) {
      this.isPanning = false;
      this.panStart = null;
      if (this.svg.style) {
        this.svg.style.cursor = this.panMode ? 'grab' : '';
      }
      this.updateStatus('Pan dibatalkan.');
      return;
    }

    if (!this.drag || (event && event.pointerId !== undefined && event.pointerId !== this.drag.pointerId)) {
      return;
    }

    const drag = this.drag;
    this.drag = null;
    this.diagram = drag.baseDiagram;
    this.selection = { type: 'node', id: drag.nodeId };
    this.renderAll();
    this.updateStatus('Drag dibatalkan.');
  }

  destroy() {
    if (this.svg && typeof this.svg.removeEventListener === 'function') {
      this.svg.removeEventListener('pointerdown', this.boundPointerDown);
      this.svg.removeEventListener('pointermove', this.boundPointerMove);
      this.svg.removeEventListener('pointerup', this.boundPointerUp);
      this.svg.removeEventListener('pointercancel', this.boundPointerCancel);
      this.svg.removeEventListener('wheel', this.boundWheel);
    }
    const keyTarget = this.keyTarget ?? (typeof document !== 'undefined' ? document : null);
    if (keyTarget && typeof keyTarget.removeEventListener === 'function') {
      keyTarget.removeEventListener('keydown', this.boundKeyDown);
      keyTarget.removeEventListener('keyup', this.boundKeyUp);
    }
  }
}

function updateEdgeLabel(diagram, edgeId, label) {
  return updateEdge(diagram, edgeId, { label });
}
