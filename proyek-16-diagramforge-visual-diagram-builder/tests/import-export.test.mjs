import assert from 'node:assert/strict';
import test from 'node:test';

import {
  exportDiagramJson,
  importDiagramJson,
  validateImportPayload,
  IMPORT_SIZE_LIMIT,
} from '../js/import-export.js';
import { createDiagram, createNode, addNode, addEdge } from '../js/diagram-model.js';

test('round-trip ekspor dan impor JSON mempertahankan diagram', () => {
  const firstNode = createNode('process', 10, 20, { text: 'A' });
  const secondNode = createNode('decision', 100, 20, { text: 'B' });
  const source = addEdge(
    addNode(addNode(createDiagram({ name: 'Diagram uji' }), firstNode), secondNode),
    firstNode.id,
    secondNode.id,
  );
  const sourceNodes = source.nodes.map((node) => node.id);
  const sourceEdges = source.edges.map((edge) => edge.id);

  const json = exportDiagramJson(source);
  assert.equal(typeof json, 'string');
  assert.match(json, /\n  /);

  const imported = importDiagramJson(json);
  assert.equal(imported.name, 'Diagram uji');
  assert.deepEqual(imported.nodes.map((node) => node.id), sourceNodes);
  assert.deepEqual(imported.edges.map((edge) => edge.id), sourceEdges);
  assert.equal(imported.nodes[0].text, 'A');
});

test('ekspor tidak memutasi diagram sumber', () => {
  const source = addNode(createDiagram(), createNode('process', 0, 0, { text: 'Awal' }));
  const before = JSON.stringify(source);

  exportDiagramJson(source);
  assert.equal(JSON.stringify(source), before);
});

test('impor menolak JSON rusak', () => {
  assert.throws(() => importDiagramJson('{bukan json'), /JSON impor tidak valid/);
});

test('impor menolak field asing', () => {
  const payload = {
    app: 'diagramforge',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    diagram: createDiagram(),
    extra: true,
  };

  const result = validateImportPayload(payload);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /field asing/);
  assert.throws(() => importDiagramJson(JSON.stringify(payload)), /field asing/);
});

test('impor menolak ID node duplikat', () => {
  const diagram = createDiagram();
  const node = createNode('process', 0, 0, { id: 'dup' });
  const payload = {
    app: 'diagramforge',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    diagram: {
      ...diagram,
      nodes: [node, { ...node, x: 10 }],
    },
  };

  assert.throws(() => importDiagramJson(JSON.stringify(payload)), /ID node duplikat/);
});

test('impor menolak node tidak valid', () => {
  const diagram = createDiagram();
  const payload = {
    app: 'diagramforge',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    diagram: {
      ...diagram,
      nodes: [{ ...createNode('process', 0, 0), fill: 'merah' }],
    },
  };

  assert.throws(() => importDiagramJson(JSON.stringify(payload)), /warna hex/);
});

test('impor menolak edge yang merujuk node tidak ada', () => {
  const diagram = createDiagram();
  const payload = {
    app: 'diagramforge',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    diagram: {
      ...diagram,
      edges: [{
        id: 'edge-1',
        from: 'tidak-ada',
        to: 'juga-tidak-ada',
        label: '',
      }],
    },
  };

  assert.throws(() => importDiagramJson(JSON.stringify(payload)), /merujuk ke node yang tidak ada/);
});

test('impor menolak data melebihi batas ukuran', () => {
  const largeText = 'x'.repeat(IMPORT_SIZE_LIMIT + 1);
  assert.throws(() => importDiagramJson(largeText), /melebihi batas/);
});

test('impor menolak jumlah node melebihi batas', () => {
  const diagram = createDiagram();
  const nodes = Array.from({ length: 201 }, (_, index) => createNode('process', index, index, { id: `node-${index}` }));
  const payload = {
    app: 'diagramforge',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    diagram: { ...diagram, nodes },
  };

  assert.throws(() => importDiagramJson(JSON.stringify(payload)), /Jumlah node melebihi/);
});

test('validasi impor tidak mengubah diagram sumber', () => {
  const source = addNode(createDiagram(), createNode('process', 0, 0, { text: 'Awal' }));
  const before = JSON.stringify(source);
  const invalidPayload = {
    app: 'diagramforge',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    diagram: { ...source, nodes: [{ ...source.nodes[0], text: 'x'.repeat(121) }] },
  };

  assert.throws(() => importDiagramJson(JSON.stringify(invalidPayload)));
  assert.equal(JSON.stringify(source), before);
});

test('impor menerima input objek dengan text dan size', () => {
  const diagram = createDiagram({ name: 'Objek' });
  const json = exportDiagramJson(diagram);
  const imported = importDiagramJson({ text: json, size: new TextEncoder().encode(json).length });

  assert.equal(imported.name, 'Objek');
});
