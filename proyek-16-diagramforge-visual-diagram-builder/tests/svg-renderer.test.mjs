import assert from 'node:assert/strict';
import test from 'node:test';

import {
  NODE_DIMENSIONS,
  getNodeBoundaryPoint,
  getEdgeEndpoints,
} from '../js/svg-renderer.js';

function node(type, x = 0, y = 0) {
  return {
    type,
    x,
    y,
    ...NODE_DIMENSIONS[type],
  };
}

test('dimensi node sesuai tipe', () => {
  assert.deepEqual(NODE_DIMENSIONS.startEnd, { width: 140, height: 70 });
  assert.deepEqual(NODE_DIMENSIONS.process, { width: 160, height: 80 });
  assert.deepEqual(NODE_DIMENSIONS.decision, { width: 140, height: 140 });
  assert.deepEqual(NODE_DIMENSIONS.inputOutput, { width: 160, height: 80 });
});

test('endpoint horizontal berada di tepi node', () => {
  const source = node('process', 0, 0);
  const target = node('process', 100, 0);
  const endpoints = getEdgeEndpoints(source, target);

  assert.deepEqual(endpoints.start, { x: 80, y: 0 });
  assert.deepEqual(endpoints.end, { x: 20, y: 0 });
});

test('endpoint vertikal berada di tepi node', () => {
  const source = node('process', 0, 0);
  const target = node('process', 0, 100);
  const endpoints = getEdgeEndpoints(source, target);

  assert.deepEqual(endpoints.start, { x: 0, y: 40 });
  assert.deepEqual(endpoints.end, { x: 0, y: 60 });
});

test('endpoint diagonal pada persegi panjang', () => {
  const source = node('process', 0, 0);
  const target = node('process', 100, 100);
  const endpoints = getEdgeEndpoints(source, target);

  assert.deepEqual(endpoints.start, { x: 40, y: 40 });
  assert.deepEqual(endpoints.end, { x: 60, y: 60 });
});

test('endpoint pada elips mengikuti batas bentuk', () => {
  const source = node('startEnd', 0, 0);
  const point = getNodeBoundaryPoint(source, 1, 1);

  assert.ok(Number.isFinite(point.x));
  assert.ok(Number.isFinite(point.y));
  assert.ok(point.x > 0 && point.x < 70);
  assert.ok(point.y > 0 && point.y < 35);
  assert.ok(Math.abs(point.x - point.y) < 1e-9);
});

test('endpoint pada belah ketupat mengikuti batas bentuk', () => {
  const source = node('decision', 0, 0);
  const point = getNodeBoundaryPoint(source, 1, 1);

  assert.deepEqual(point, { x: 35, y: 35 });
});

test('endpoint pada jajaran genjang mengikuti batas bentuk', () => {
  const source = node('inputOutput', 0, 0);
  const point = getNodeBoundaryPoint(source, 1, 1);

  assert.deepEqual(point, { x: 40, y: 40 });
});

test('endpoint dihitung ulang saat posisi node berubah', () => {
  const source = node('process', 10, 20);
  const target = node('process', 110, 20);
  const endpoints = getEdgeEndpoints(source, target);

  assert.deepEqual(endpoints.start, { x: 90, y: 20 });
  assert.deepEqual(endpoints.end, { x: 30, y: 20 });
});

test('node bertumpuk tidak menghasilkan NaN atau Infinity', () => {
  const source = node('process', 5, 5);
  const target = node('process', 5, 5);
  const endpoints = getEdgeEndpoints(source, target);

  assert.ok(endpoints !== null);
  assert.ok(Number.isFinite(endpoints.start.x));
  assert.ok(Number.isFinite(endpoints.start.y));
  assert.ok(Number.isFinite(endpoints.end.x));
  assert.ok(Number.isFinite(endpoints.end.y));
  assert.deepEqual(endpoints.start, { x: 5, y: 5 });
  assert.deepEqual(endpoints.end, { x: 5, y: 5 });
});

test('input invalid ditangani secara eksplisit', () => {
  assert.equal(getNodeBoundaryPoint(null, 1, 0), null);
  assert.equal(getNodeBoundaryPoint(node('process', 0, 0), Number.NaN, 0), null);
  assert.equal(getEdgeEndpoints(null, node('process', 0, 0)), null);
  assert.equal(getEdgeEndpoints(node('process', 0, 0), null), null);
});
