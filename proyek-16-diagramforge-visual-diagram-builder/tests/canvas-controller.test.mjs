import assert from 'node:assert/strict';
import test from 'node:test';

import { DiagramController } from '../js/canvas-controller.js';
import { createNode, addNode, addEdge, updateNode } from '../js/diagram-model.js';

function makeButton() {
  return {
    tagName: 'BUTTON',
    getAttribute() {
      return null;
    },
  };
}

function makeCanvasTarget() {
  return {
    tagName: 'svg',
    getAttribute() {
      return null;
    },
  };
}

function makeFakeSvg() {
  const svg = {
    addEventListener() {},
    removeEventListener() {},
    setPointerCapture() {},
    releasePointerCapture() {},
    createSVGPoint() {
      return {
        x: 0,
        y: 0,
        matrixTransform(matrix) {
          return {
            x: this.x * matrix.a + this.y * matrix.c + matrix.e,
            y: this.x * matrix.b + this.y * matrix.d + matrix.f,
          };
        },
      };
    },
    getScreenCTM() {
      return {
        a: 1,
        b: 0,
        c: 0,
        d: 1,
        e: 0,
        f: 0,
        inverse() {
          return this;
        },
      };
    },
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 800, height: 450 };
    },
    querySelector() {
      return null;
    },
  };
  return svg;
}

function fakeNodeElement(id) {
  const element = {
    dataset: { nodeId: id },
  };
  element.closest = () => element;
  return element;
}

function fakeEvent(target, clientX = 0, clientY = 0, pointerId = 1, key = '') {
  const event = {
    target,
    clientX,
    clientY,
    pointerId,
    key,
    preventDefault() {},
  };
  return event;
}

test('menambah node memperbarui state dan history', () => {
  const controller = new DiagramController();

  controller.addNode('process');

  assert.equal(controller.diagram.nodes.length, 1);
  assert.equal(controller.diagram.nodes[0].type, 'process');
  assert.equal(controller.history.canUndo(), true);
  assert.equal(controller.selection?.type, 'node');
});

test('menghapus node terpilih membersihkan konektor terkait', () => {
  const controller = new DiagramController();
  const first = createNode('process', 0, 0, { id: 'node-a' });
  const second = createNode('process', 100, 0, { id: 'node-b' });
  controller.diagram = addNode(addNode(controller.diagram, first), second);
  controller.diagram = addEdge(controller.diagram, first.id, second.id);
  controller.history = controller.history.constructor
    ? new controller.history.constructor(controller.diagram)
    : controller.history;
  controller.selection = { type: 'node', id: first.id };

  controller.deleteSelection();

  assert.equal(controller.diagram.nodes.length, 1);
  assert.equal(controller.diagram.edges.length, 0);
  assert.equal(controller.selection, null);
});

test('mode konektor membuat edge dan menolak self-edge', () => {
  const controller = new DiagramController({ svg: makeFakeSvg() });
  const first = createNode('process', 0, 0, { id: 'source' });
  const second = createNode('process', 100, 0, { id: 'target' });
  controller.diagram = addNode(addNode(controller.diagram, first), second);
  controller.history = new controller.history.constructor(controller.diagram);

  controller.startConnectMode();
  assert.equal(controller.connectMode, true);

  const sourceElement = fakeNodeElement(first.id);
  const targetElement = fakeNodeElement(second.id);
  controller.handlePointerDown(fakeEvent(sourceElement));
  assert.equal(controller.connectSourceId, first.id);

  controller.handlePointerDown(fakeEvent(targetElement));
  assert.equal(controller.diagram.edges.length, 1);
  assert.equal(controller.diagram.edges[0].from, first.id);
  assert.equal(controller.diagram.edges[0].to, second.id);
  assert.equal(controller.connectSourceId, null);

  controller.startConnectMode();
  controller.handlePointerDown(fakeEvent(sourceElement));
  controller.handlePointerDown(fakeEvent(sourceElement));
  assert.equal(controller.diagram.edges.length, 1);
  assert.equal(controller.connectSourceId, null);
});

test('drag node menghasilkan satu perubahan history', () => {
  const svg = makeFakeSvg();
  const controller = new DiagramController({ svg });

  controller.addNode('process');
  const node = controller.diagram.nodes[0];
  const originalX = node.x;
  const originalY = node.y;
  const sizeBeforeDrag = controller.history.size;

  const element = fakeNodeElement(node.id);
  controller.handlePointerDown(fakeEvent(element, 0, 0, 1));
  controller.handlePointerMove(fakeEvent(element, 10, 10, 1));
  controller.handlePointerUp(fakeEvent(element, 10, 10, 1));

  assert.equal(controller.history.size, sizeBeforeDrag + 1);
  assert.notEqual(controller.diagram.nodes[0].x, originalX);
  assert.notEqual(controller.diagram.nodes[0].y, originalY);

  controller.undo();
  assert.equal(controller.diagram.nodes[0].x, originalX);
  assert.equal(controller.diagram.nodes[0].y, originalY);

  controller.redo();
  assert.notEqual(controller.diagram.nodes[0].x, originalX);
});

test('pointer cancel tidak meninggalkan state drag yang rusak', () => {
  const svg = makeFakeSvg();
  const controller = new DiagramController({ svg });

  controller.addNode('process');
  const node = controller.diagram.nodes[0];
  const originalX = node.x;
  const originalY = node.y;
  const sizeBefore = controller.history.size;

  const element = fakeNodeElement(node.id);
  controller.handlePointerDown(fakeEvent(element, 0, 0, 1));
  controller.handlePointerMove(fakeEvent(element, 10, 10, 1));
  controller.handlePointerCancel(fakeEvent(element, 10, 10, 1));

  assert.equal(controller.drag, null);
  assert.equal(controller.diagram.nodes[0].x, originalX);
  assert.equal(controller.diagram.nodes[0].y, originalY);
  assert.equal(controller.history.size, sizeBefore);
});

test('perubahan teks dan warna node dapat di-commit dan di-undo', () => {
  const controller = new DiagramController();
  controller.addNode('process');
  const node = controller.diagram.nodes[0];

  const nextText = updateNode(controller.diagram, node.id, { text: 'Node baru' });
  const sizeBeforeText = controller.history.size;
  controller.commitDiagram(nextText);
  assert.equal(controller.diagram.nodes[0].text, 'Node baru');
  assert.equal(controller.history.size, sizeBeforeText + 1);

  controller.undo();
  assert.equal(controller.diagram.nodes[0].text, 'Proses');

  const nextColor = updateNode(controller.diagram, controller.diagram.nodes[0].id, { fill: '#ff0000' });
  const sizeBeforeColor = controller.history.size;
  controller.commitDiagram(nextColor);
  assert.equal(controller.diagram.nodes[0].fill, '#ff0000');
  assert.equal(controller.history.size, sizeBeforeColor);
  assert.equal(controller.history.canRedo(), false);

  controller.undo();
  assert.notEqual(controller.diagram.nodes[0].fill, '#ff0000');
});

test('penghapusan node membersihkan konektor terkait', () => {
  const controller = new DiagramController();
  const first = createNode('process', 0, 0, { id: 'a' });
  const second = createNode('process', 100, 0, { id: 'b' });
  controller.diagram = addNode(addNode(controller.diagram, first), second);
  controller.diagram = addEdge(controller.diagram, first.id, second.id);
  controller.history = new controller.history.constructor(controller.diagram);
  controller.selection = { type: 'node', id: first.id };

  controller.deleteSelection();

  assert.equal(controller.diagram.nodes.length, 1);
  assert.equal(controller.diagram.edges.length, 0);
});

test('keyboard Delete dan Arrow mengubah state dengan benar', () => {
  const controller = new DiagramController();
  controller.addNode('process');
  const node = controller.diagram.nodes[0];
  const originalX = node.x;
  const originalY = node.y;

  controller.selection = { type: 'node', id: node.id };
  const deleteEvent = fakeEvent(null, 0, 0, 1, 'Delete');
  controller.handleKeyDown(deleteEvent);
  assert.equal(controller.diagram.nodes.length, 0);

  controller.addNode('process');
  const newNode = controller.diagram.nodes[0];
  controller.selection = { type: 'node', id: newNode.id };
  const arrowEvent = fakeEvent(null, 0, 0, 1, 'ArrowRight');
  controller.handleKeyDown(arrowEvent);
  assert.equal(controller.diagram.nodes[0].x, newNode.x + 10);
  assert.equal(controller.diagram.nodes[0].y, newNode.y);

  const undoEvent = fakeEvent(null, 0, 0, 1, 'z');
  undoEvent.ctrlKey = true;
  controller.handleKeyDown(undoEvent);
  assert.equal(controller.diagram.nodes[0].x, newNode.x);
});

test('shortcut undo dan redo bekerja', () => {
  const controller = new DiagramController();
  controller.addNode('process');
  const sizeBeforeUndo = controller.history.size;

  const undoEvent = { key: 'z', ctrlKey: true, shiftKey: false, target: { tagName: 'DIV' }, preventDefault() {} };
  controller.handleKeyDown(undoEvent);
  assert.equal(controller.history.canRedo(), true);

  const redoEvent = { key: 'z', ctrlKey: true, shiftKey: true, target: { tagName: 'DIV' }, preventDefault() {} };
  controller.handleKeyDown(redoEvent);
  assert.equal(controller.history.canUndo(), true);
  assert.equal(controller.history.size, sizeBeforeUndo);
});

test('Space pada kontrol interaktif tidak mengaktifkan pan', () => {
  const controller = new DiagramController();
  const button = makeButton();
  let prevented = false;
  const event = {
    code: 'Space',
    key: ' ',
    target: button,
    preventDefault() {
      prevented = true;
    },
  };

  controller.handleKeyDown(event);

  assert.equal(controller.spacePressed, false);
  assert.equal(prevented, false);
});

test('Space pada area kanvas mengaktifkan pan', () => {
  const controller = new DiagramController();
  const canvas = makeCanvasTarget();
  let prevented = false;
  const event = {
    code: 'Space',
    key: ' ',
    target: canvas,
    preventDefault() {
      prevented = true;
    },
  };

  controller.handleKeyDown(event);

  assert.equal(controller.spacePressed, true);
  assert.equal(prevented, true);
});

test('mode Pan dapat diaktifkan dan dinonaktifkan', () => {
  const controller = new DiagramController();

  controller.togglePanMode();
  assert.equal(controller.panMode, true);

  controller.togglePanMode();
  assert.equal(controller.panMode, false);
});

test('Space + drag menggeser viewport tanpa menambah history', () => {
  const svg = makeFakeSvg();
  const controller = new DiagramController({ svg });
  controller.addNode('process');

  const canvas = makeCanvasTarget();
  let prevented = false;
  controller.handleKeyDown({
    code: 'Space',
    key: ' ',
    target: canvas,
    preventDefault() {
      prevented = true;
    },
  });
  assert.equal(controller.spacePressed, true);
  assert.equal(prevented, true);

  const emptyTarget = {
    dataset: {},
    closest() {
      return null;
    },
  };
  const sizeBefore = controller.history.size;
  const viewportBefore = { ...controller.diagram.viewport };

  controller.handlePointerDown(fakeEvent(emptyTarget, 0, 0, 1, ''));
  controller.handlePointerMove(fakeEvent(emptyTarget, 20, 10, 1, ''));
  controller.handlePointerUp(fakeEvent(emptyTarget, 20, 10, 1, ''));

  assert.equal(controller.history.size, sizeBefore);
  assert.notEqual(controller.diagram.viewport.x, viewportBefore.x);
  assert.notEqual(controller.diagram.viewport.y, viewportBefore.y);
});