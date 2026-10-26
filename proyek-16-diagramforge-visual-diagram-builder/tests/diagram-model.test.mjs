import assert from 'node:assert/strict';
import test from 'node:test';

import {
  NODE_TYPES,
  NODE_DIMENSIONS,
  LIMITS,
  createId,
  createDiagram,
  createNode,
  addNode,
  updateNode,
  removeNode,
  addEdge,
  removeEdge,
  updateEdge,
  validateDiagram,
  assertValidDiagram,
} from '../js/diagram-model.js';

test('membuat diagram kosong dengan schema dan nilai awal', () => {
  const diagram = createDiagram();

  assert.equal(diagram.app, 'diagramforge');
  assert.equal(diagram.schemaVersion, 1);
  assert.equal(typeof diagram.id, 'string');
  assert.equal(diagram.nodes.length, 0);
  assert.equal(diagram.edges.length, 0);
  assert.equal(diagram.viewport.x, 0);
  assert.equal(diagram.viewport.y, 0);
  assert.equal(diagram.viewport.zoom, 1);
  assert.equal(validateDiagram(diagram).valid, true);
});

test('ukuran node berasal dari tipe, bukan input bebas', () => {
  const node = createNode('decision', 10, 20);

  assert.equal(node.type, 'decision');
  assert.equal(node.x, 10);
  assert.equal(node.y, 20);
  assert.equal(node.width, NODE_DIMENSIONS.decision.width);
  assert.equal(node.height, NODE_DIMENSIONS.decision.height);
  assert.throws(() => createNode('process', 0, 0, { width: 999 }), /Ukuran node/);
});

test('menambah node menghasilkan diagram baru tanpa mutasi snapshot lama', () => {
  const original = createDiagram();
  const node = createNode('process', 40, 60);
  const updated = addNode(original, node);

  assert.equal(original.nodes.length, 0);
  assert.equal(updated.nodes.length, 1);
  assert.equal(updated.nodes[0].id, node.id);
  assert.notEqual(original, updated);
  assert.notEqual(original.nodes, updated.nodes);
});

test('update node tidak memutasi diagram sebelumnya', () => {
  const original = addNode(createDiagram(), createNode('process', 0, 0, { text: 'Proses' }));
  const nodeId = original.nodes[0].id;
  const updated = updateNode(original, nodeId, { text: 'Baru', x: 100 });

  assert.equal(original.nodes[0].text, 'Proses');
  assert.equal(original.nodes[0].x, 0);
  assert.equal(updated.nodes[0].text, 'Baru');
  assert.equal(updated.nodes[0].x, 100);
  assert.equal(updated.nodes[0].width, NODE_DIMENSIONS.process.width);
});

test('menghapus node juga menghapus edge yang terhubung', () => {
  const diagram = addNode(addNode(createDiagram(), createNode('process', 0, 0)), createNode('process', 100, 0));
  const sourceId = diagram.nodes[0].id;
  const targetId = diagram.nodes[1].id;
  const withEdge = addEdge(diagram, sourceId, targetId, 'alur');
  const afterDelete = removeNode(withEdge, sourceId);

  assert.equal(afterDelete.nodes.length, 1);
  assert.equal(afterDelete.edges.length, 0);
});

test('edge menolak referensi tidak valid dan self-edge', () => {
  const diagram = addNode(createDiagram(), createNode('process', 0, 0));
  const nodeId = diagram.nodes[0].id;

  assert.throws(() => addEdge(diagram, nodeId, 'tidak-ada'), /Node tujuan tidak ditemukan/);
  assert.throws(() => addEdge(diagram, nodeId, nodeId), /dirinya sendiri/);
});

test('id duplikat ditolak pada node dan edge', () => {
  const diagram = addNode(addNode(createDiagram(), createNode('process', 0, 0, { id: 'node-1' })), createNode('process', 10, 10, { id: 'node-2' }));
  const duplicateNode = createNode('process', 20, 20, { id: 'node-1' });

  assert.throws(() => addNode(diagram, duplicateNode), /ID node duplikat/);

  const withEdge = addEdge(diagram, 'node-1', 'node-2');
  assert.throws(() => addEdge(withEdge, 'node-1', 'node-2', '', { id: withEdge.edges[0].id }), /ID edge duplikat/);
});

test('validasi menolak field asing dan struktur tidak valid', () => {
  const diagram = createDiagram();
  const foreignDiagram = {
    ...diagram,
    nodes: [{ ...createNode('process', 0, 0), extra: true }],
  };
  const result = validateDiagram(foreignDiagram);

  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /field asing/);

  assert.throws(() => assertValidDiagram({ ...diagram, schemaVersion: 2 }), /schemaVersion/);
});

test('batas node dan edge ditegakkan', () => {
  let diagram = createDiagram();
  for (let i = 0; i < LIMITS.maxNodes; i += 1) {
    diagram = addNode(diagram, createNode('process', i, i, { id: `node-${i}` }));
  }
  assert.throws(() => addNode(diagram, createNode('process', 1, 1)), /Jumlah node melebihi/);

  const sourceId = 'node-0';
  const targetId = 'node-1';
  for (let i = 0; i < LIMITS.maxEdges; i += 1) {
    diagram = addEdge(diagram, sourceId, targetId, '', { id: `edge-${i}` });
  }
  assert.throws(() => addEdge(diagram, sourceId, targetId, '', { id: 'edge-overflow' }), /Jumlah edge melebihi/);
});

test('warna, teks, dan koordinat divalidasi', () => {
  assert.throws(() => createNode('process', 0, 0, { fill: 'red' }), /warna hex/);
  assert.throws(() => createNode('process', 0, 0, { text: 'x'.repeat(121) }), /maksimum 120/);
  assert.throws(() => createNode('process', LIMITS.coordinateLimit + 1, 0), /berada di luar batas/);
  assert.equal(validateDiagram(createDiagram()).valid, true);
});

test('removeEdge menghapus edge yang ada dan mempertahankan node', () => {
  const diagram = addNode(addNode(createDiagram(), createNode('process', 0, 0)), createNode('process', 10, 10));
  const [source, target] = diagram.nodes;
  const withEdge = addEdge(diagram, source.id, target.id);
  const edgeId = withEdge.edges[0].id;
  const afterRemove = removeEdge(withEdge, edgeId);

  assert.equal(afterRemove.edges.length, 0);
  assert.equal(afterRemove.nodes.length, 2);
});

test('createId menghasilkan ID aman dan unik', () => {
  const ids = new Set(Array.from({ length: 100 }, () => createId()));
  assert.equal(ids.size, 100);
  for (const id of ids) {
    assert.match(id, /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/);
  }
});

test('updateEdge memvalidasi label normal, batas, dan melebihi batas', () => {
  const diagram = addEdge(
    addNode(addNode(createDiagram(), createNode('process', 0, 0, { id: 'a' })), createNode('process', 10, 0, { id: 'b' })),
    'a',
    'b',
  );
  const edgeId = diagram.edges[0].id;

  const normal = updateEdge(diagram, edgeId, { label: 'alur' });
  assert.equal(normal.edges[0].label, 'alur');
  assert.equal(diagram.edges[0].label, '');

  const boundary = updateEdge(diagram, edgeId, { label: 'x'.repeat(80) });
  assert.equal(boundary.edges[0].label.length, 80);

  assert.throws(() => updateEdge(diagram, edgeId, { label: 'x'.repeat(81) }), /maksimum 80/);
  assert.throws(() => updateEdge(diagram, edgeId, { foo: 'bar' }), /Field edge tidak dapat diubah/);
});
