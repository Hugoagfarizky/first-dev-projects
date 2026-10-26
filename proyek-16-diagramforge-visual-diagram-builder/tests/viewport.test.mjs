import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DiagramController,
  clampZoom,
  createDefaultViewport,
  normalizeViewport,
  zoomViewport,
  panViewport,
  fitViewportToDiagram,
} from '../js/canvas-controller.js';
import { createDiagram, createNode, addNode } from '../js/diagram-model.js';

test('clampZoom membatasi nilai minimum dan maksimum', () => {
  assert.equal(clampZoom(0.1), 0.25);
  assert.equal(clampZoom(10), 4);
  assert.equal(clampZoom(1.5), 1.5);
  assert.equal(clampZoom(Number.NaN), 1);
});

test('zoom in dan zoom out mengubah viewport tanpa mengubah diagram', () => {
  const diagram = createDiagram();
  const before = JSON.stringify(diagram);

  const zoomedIn = zoomViewport(diagram.viewport, 2);
  assert.equal(zoomedIn.zoom, 2);
  assert.equal(zoomedIn.x, 400);
  assert.equal(zoomedIn.y, 225);

  const zoomedOut = zoomViewport(zoomedIn, 0.5);
  assert.equal(zoomedOut.zoom, 1);
  assert.equal(JSON.stringify(diagram), before);
});

test('zoom dengan anchor mempertahankan titik di bawah pointer', () => {
  const viewport = { x: 0, y: 0, zoom: 1 };
  const anchor = { x: 400, y: 225 };
  const next = zoomViewport(viewport, 2, anchor);

  assert.equal(next.zoom, 2);
  assert.equal(next.x, 200);
  assert.equal(next.y, 112.5);
});

test('pan mengubah viewport tanpa menambah history', () => {
  const controller = new DiagramController();
  controller.addNode('process');
  const sizeBefore = controller.history.size;
  const nodeBefore = JSON.stringify(controller.diagram.nodes);

  controller.setViewport(panViewport(controller.diagram.viewport, 100, 50));

  assert.equal(controller.history.size, sizeBefore);
  assert.equal(JSON.stringify(controller.diagram.nodes), nodeBefore);
  assert.notEqual(controller.diagram.viewport.x, 0);
  assert.notEqual(controller.diagram.viewport.y, 0);
});

test('fit-to-view menangani diagram kosong', () => {
  const viewport = fitViewportToDiagram(createDiagram());

  assert.deepEqual(viewport, createDefaultViewport());
});

test('fit-to-view memuat satu node dengan padding', () => {
  const diagram = addNode(createDiagram(), createNode('process', 100, 100));
  const viewport = fitViewportToDiagram(diagram);

  assert.ok(viewport.zoom > 1);
  assert.ok(viewport.x < 100);
  assert.ok(viewport.y < 100);
  assert.ok(viewport.x + 1600 / viewport.zoom > 100);
  assert.ok(viewport.y + 900 / viewport.zoom > 100);
});

test('fit-to-view memuat banyak node dalam area tampilan', () => {
  let diagram = createDiagram();
  for (let i = 0; i < 5; i += 1) {
    diagram = addNode(diagram, createNode('process', i * 200, i * 100, { id: `node-${i}` }));
  }

  const viewport = fitViewportToDiagram(diagram);
  const viewWidth = 1600 / viewport.zoom;
  const viewHeight = 900 / viewport.zoom;

  assert.ok(viewport.x <= 0 - 80 / viewport.zoom + 1);
  assert.ok(viewport.y <= 0 - 80 / viewport.zoom + 1);
  assert.ok(viewport.x + viewWidth >= 800 + 80 / viewport.zoom - 1);
  assert.ok(viewport.y + viewHeight >= 400 + 80 / viewport.zoom - 1);
});

test('zoom minimum dan maksimum ditegakkan', () => {
  const viewport = { x: 0, y: 0, zoom: 1 };

  assert.equal(zoomViewport(viewport, 0.01).zoom, 0.25);
  assert.equal(zoomViewport(viewport, 100).zoom, 4);
});

test('viewport tidak menambah snapshot history', () => {
  const controller = new DiagramController();
  controller.addNode('process');
  const sizeBefore = controller.history.size;

  controller.zoomIn();
  controller.panMode = true;
  controller.handlePointerDown({ button: 1, clientX: 10, clientY: 10, pointerId: 1, target: null });
  controller.handlePointerMove({ clientX: 30, clientY: 20, pointerId: 1 });
  controller.handlePointerUp({ pointerId: 1 });

  assert.equal(controller.history.size, sizeBefore);
  assert.notEqual(controller.diagram.viewport.zoom, 1);
});

test('drag node tetap tepat setelah viewport berubah', () => {
  const svg = {
    addEventListener() {},
    removeEventListener() {},
    setPointerCapture() {},
    releasePointerCapture() {},
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 800, height: 450 };
    },
    createSVGPoint() {
      return {
        x: 0,
        y: 0,
        matrixTransform(matrix) {
          return {
            x: (this.x - (matrix.e ?? 0)) / (matrix.a || 1),
            y: (this.y - (matrix.f ?? 0)) / (matrix.d || 1),
          };
        },
      };
    },
    getScreenCTM() {
      const viewport = { x: 100, y: 50, zoom: 2 };
      const scale = viewport.zoom;
      return {
        a: scale,
        b: 0,
        c: 0,
        d: scale,
        e: -viewport.x * scale,
        f: -viewport.y * scale,
        inverse() {
          return this;
        },
      };
    },
    querySelector() {
      return null;
    },
  };

  const controller = new DiagramController({ svg });
  controller.addNode('process');
  const node = controller.diagram.nodes[0];
  controller.setViewport({ x: 100, y: 50, zoom: 2 });

  const element = {
    dataset: { nodeId: node.id },
    closest() {
      return this;
    },
  };

  controller.handlePointerDown({ target: element, clientX: 0, clientY: 0, pointerId: 1, button: 0 });
  controller.handlePointerMove({ target: element, clientX: 40, clientY: 20, pointerId: 1 });
  controller.handlePointerUp({ target: element, pointerId: 1 });

  const movedNode = controller.diagram.nodes[0];
  assert.notEqual(movedNode.x, node.x);
  assert.notEqual(movedNode.y, node.y);
  assert.ok(Number.isFinite(movedNode.x));
  assert.ok(Number.isFinite(movedNode.y));
});
