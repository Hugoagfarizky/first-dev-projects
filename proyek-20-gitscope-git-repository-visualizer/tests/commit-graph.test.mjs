import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCommitGraph } from '../js/commit-graph.js';

function commit(sha, parents = [], message = sha, date = '2024-01-01T00:00:00Z') {
  return {
    sha,
    shortSha: sha.slice(0, 7),
    message,
    authorName: 'Octocat',
    authorDate: date,
    parentShas: parents,
  };
}

test('returns an empty graph for no commits', () => {
  const graph = buildCommitGraph([]);
  assert.equal(graph.nodes.length, 0);
  assert.equal(graph.edges.length, 0);
  assert.equal(graph.partial, false);
  assert.equal(graph.truncated, false);
});

test('builds a linear chain', () => {
  const graph = buildCommitGraph([
    commit('c3', ['c2'], 'third', '2024-01-03T00:00:00Z'),
    commit('c2', ['c1'], 'second', '2024-01-02T00:00:00Z'),
    commit('c1', [], 'first', '2024-01-01T00:00:00Z'),
  ]);

  assert.equal(graph.nodes.length, 3);
  assert.equal(graph.edges.length, 2);
  assert.deepEqual(graph.edges, [
    { from: 'c3', to: 'c2' },
    { from: 'c2', to: 'c1' },
  ]);
  assert.equal(graph.partial, false);
});

test('builds merge edges for multiple parents', () => {
  const graph = buildCommitGraph([
    commit('merge', ['main', 'feature'], 'merge', '2024-01-03T00:00:00Z'),
    commit('main', ['base'], 'main', '2024-01-02T00:00:00Z'),
    commit('feature', ['base'], 'feature', '2024-01-02T00:00:00Z'),
    commit('base', [], 'base', '2024-01-01T00:00:00Z'),
  ]);

  assert.equal(graph.nodes.length, 4);
  const mergeEdges = graph.edges.filter((edge) => edge.from === 'merge');
  assert.equal(mergeEdges.length, 2);
  assert.ok(mergeEdges.some((edge) => edge.to === 'main'));
  assert.ok(mergeEdges.some((edge) => edge.to === 'feature'));
});

test('marks missing parents', () => {
  const graph = buildCommitGraph([
    commit('child', ['missing-parent'], 'child'),
  ]);

  assert.equal(graph.nodes.length, 1);
  assert.equal(graph.edges.length, 0);
  assert.equal(graph.partial, true);
  assert.deepEqual(graph.missingParents, ['missing-parent']);
  assert.equal(graph.unresolvedParents[0].reason, 'not_loaded');
});

test('deduplicates nodes by SHA', () => {
  const graph = buildCommitGraph([
    commit('same', [], 'first'),
    commit('same', ['other'], 'duplicate'),
  ]);

  assert.equal(graph.nodes.length, 1);
  assert.deepEqual(graph.nodes[0].parentShas, []);
});

test('does not create self edges', () => {
  const graph = buildCommitGraph([
    commit('loop', ['loop'], 'loop'),
  ]);

  assert.equal(graph.nodes.length, 1);
  assert.equal(graph.edges.length, 0);
});

test('handles invalid or malformed input', () => {
  const graph = buildCommitGraph(null);
  assert.equal(graph.nodes.length, 0);
  assert.equal(graph.edges.length, 0);

  const malformed = buildCommitGraph([
    null,
    { sha: '' },
    { message: 'no sha' },
    commit('valid', [''], 'valid'),
  ]);
  assert.equal(malformed.nodes.length, 1);
  assert.equal(malformed.nodes[0].sha, 'valid');
});

test('is deterministic for the same input', () => {
  const commits = [
    commit('b', ['a'], 'b', '2024-01-02T00:00:00Z'),
    commit('a', [], 'a', '2024-01-01T00:00:00Z'),
  ];
  const first = buildCommitGraph(commits);
  const second = buildCommitGraph(commits);

  assert.deepEqual(first.nodes.map((node) => ({ sha: node.sha, x: node.x, y: node.y, lane: node.lane })), second.nodes.map((node) => ({ sha: node.sha, x: node.x, y: node.y, lane: node.lane })));
  assert.deepEqual(first.edges, second.edges);
});

test('truncates graph at the configured node limit', () => {
  const commits = Array.from({ length: 5 }, (_, index) =>
    commit(`c${index}`, [], `commit ${index}`, `2024-01-0${index + 1}T00:00:00Z`),
  );
  const graph = buildCommitGraph(commits, { maxNodes: 3 });

  assert.equal(graph.displayedCount, 3);
  assert.equal(graph.totalCount, 5);
  assert.equal(graph.omittedCount, 2);
  assert.equal(graph.truncated, true);
});

test('parents are visually older than children', () => {
  const graph = buildCommitGraph([
    commit('child', ['parent'], 'child', '2024-01-02T00:00:00Z'),
    commit('parent', [], 'parent', '2024-01-01T00:00:00Z'),
  ]);

  const child = graph.nodes.find((node) => node.sha === 'child');
  const parent = graph.nodes.find((node) => node.sha === 'parent');
  assert.ok(child.y < parent.y);
});

test('keeps the loaded merge edge and marks the unloaded parent', () => {
  const graph = buildCommitGraph([
    commit('merge', ['loaded', 'not-yet-loaded'], 'merge', '2024-01-03T00:00:00Z'),
    commit('loaded', ['base'], 'loaded', '2024-01-02T00:00:00Z'),
    commit('base', [], 'base', '2024-01-01T00:00:00Z'),
  ]);

  assert.equal(graph.edges.length, 2);
  assert.equal(graph.edges.filter((edge) => edge.from === 'merge').length, 1);
  assert.ok(graph.edges.some((edge) => edge.from === 'merge' && edge.to === 'loaded'));
  assert.deepEqual(graph.missingParents, ['not-yet-loaded']);
  assert.equal(graph.unresolvedParents[0].reason, 'not_loaded');
  assert.equal(graph.partial, true);
});

test('marks valid commits omitted by the node limit as not displayed', () => {
  const graph = buildCommitGraph([
    commit('child', ['parent'], 'child', '2024-01-02T00:00:00Z'),
    commit('parent', ['grandparent'], 'parent', '2024-01-01T00:00:00Z'),
    commit('grandparent', [], 'grandparent', '2023-12-31T00:00:00Z'),
  ], { maxNodes: 2 });

  assert.equal(graph.truncated, true);
  assert.equal(graph.unresolvedParents.length, 1);
  assert.equal(graph.unresolvedParents[0].sha, 'grandparent');
  assert.equal(graph.unresolvedParents[0].reason, 'not_displayed');
});

test('handles cyclic parent data without looping forever', () => {
  const graph = buildCommitGraph([
    commit('a', ['b'], 'a', '2024-01-02T00:00:00Z'),
    commit('b', ['a'], 'b', '2024-01-01T00:00:00Z'),
  ]);

  assert.equal(graph.nodes.length, 2);
  assert.equal(graph.edges.length, 2);
});

test('deduplicates repeated parent entries', () => {
  const graph = buildCommitGraph([
    commit('child', ['parent', 'parent'], 'child', '2024-01-02T00:00:00Z'),
    commit('parent', [], 'parent', '2024-01-01T00:00:00Z'),
  ]);

  assert.deepEqual(graph.edges, [{ from: 'child', to: 'parent' }]);
});
