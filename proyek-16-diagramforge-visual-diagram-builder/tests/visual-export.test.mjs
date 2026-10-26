import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getDiagramBounds,
  calculateSvgExport,
  calculatePngDimensions,
  buildSvgMarkup,
  exportDiagramSvg,
  createExportFilename,
} from '../js/visual-export.js';
import { createDiagram, createNode, addNode } from '../js/diagram-model.js';

function makeDiagram(nodes) {
  const diagram = createDiagram();
  let next = diagram;
  for (const node of nodes) {
    next = addNode(next, node);
  }
  return next;
}

test('diagram kosong tidak memiliki bounds', () => {
  assert.equal(getDiagramBounds(createDiagram()), null);
  assert.throws(() => exportDiagramSvg(createDiagram()), /kosong/);
});

test('bounding box memperhitungkan semua node dan padding', () => {
  const diagram = makeDiagram([
    createNode('process', 0, 0, { id: 'a' }),
    createNode('process', 100, -50, { id: 'b' }),
  ]);

  const bounds = getDiagramBounds(diagram);
  assert.equal(bounds.minX, -80);
  assert.equal(bounds.maxX, 180);
  assert.equal(bounds.minY, -90);
  assert.equal(bounds.maxY, 40);

  const svg = calculateSvgExport(diagram);
  assert.equal(svg.width, 260 + 96);
  assert.equal(svg.height, 130 + 96);
  assert.equal(svg.originX, -128);
  assert.equal(svg.originY, -138);
});

test('SVG mandiri memuat namespace, marker, bentuk, dan teks', () => {
  const diagram = makeDiagram([createNode('process', 10, 20, { id: 'node-1', text: 'Proses <uji>' })]);
  const markup = exportDiagramSvg(diagram);

  assert.match(markup, /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(markup, /<marker id="diagram-arrow"/);
  assert.match(markup, /<rect/);
  assert.match(markup, /Proses &lt;uji&gt;/);
  assert.doesNotMatch(markup, /<script/);
});

test('ekspor tidak memutasi diagram', () => {
  const diagram = makeDiagram([createNode('process', 0, 0, { id: 'node-1' })]);
  const before = JSON.stringify(diagram);

  exportDiagramSvg(diagram);
  calculatePngDimensions(diagram);

  assert.equal(JSON.stringify(diagram), before);
});

test('dimensi PNG mempertahankan rasio aspek', () => {
  const diagram = makeDiagram([createNode('process', 0, 0, { id: 'a' }), createNode('process', 300, 0, { id: 'b' })]);
  const dimensions = calculatePngDimensions(diagram);

  assert.equal(dimensions.sourceWidth, 556);
  assert.equal(dimensions.sourceHeight, 176);
  assert.ok(Math.abs(dimensions.width / dimensions.height - dimensions.sourceWidth / dimensions.sourceHeight) < 0.02);
  assert.ok(dimensions.width <= 4096);
  assert.ok(dimensions.height <= 4096);
});

test('dimensi PNG dibatasi oleh jumlah piksel', () => {
  const diagram = makeDiagram([createNode('process', 0, 0, { id: 'a' })]);
  const dimensions = calculatePngDimensions(diagram, { maxDimension: 10000, maxPixels: 10000 });

  assert.ok(dimensions.width * dimensions.height <= 10000);
  assert.ok(dimensions.width >= 1);
  assert.ok(dimensions.height >= 1);
});

test('input invalid ditolak', () => {
  assert.throws(() => getDiagramBounds({ nodes: 'bukan-larik' }), /harus berupa larik/);
  assert.throws(() => exportDiagramSvg({ app: 'diagramforge', schemaVersion: 1 }), /harus berupa larik/);
  assert.throws(() => exportDiagramSvg(createDiagram()), /kosong/);
  assert.throws(() => createExportFilename(''), /tidak valid/);
});

test('nama file ekspor aman dan konsisten', () => {
  const filename = createExportFilename('svg');
  assert.match(filename, /^diagramforge-\d{4}-\d{2}-\d{2}\.svg$/);
});
