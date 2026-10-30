const MAX_GRAPH_NODES = 100;
const NODE_WIDTH = 152;
const NODE_HEIGHT = 58;
const HORIZONTAL_GAP = 24;
const VERTICAL_GAP = 24;
const PADDING = 20;

export function buildCommitGraph(commits, options = {}) {
  const maxNodes = normalizePositiveInteger(options.maxNodes, MAX_GRAPH_NODES);
  const selectedSha = typeof options.selectedSha === 'string' ? options.selectedSha : null;

  if (!Array.isArray(commits) || commits.length === 0) {
    return emptyGraph(0, maxNodes);
  }

  const seenCommits = new Set();
  const validCommits = commits
    .filter(isValidCommit)
    .map((commit) => ({
      sha: commit.sha,
      shortSha: typeof commit.shortSha === 'string' && commit.shortSha !== ''
        ? commit.shortSha
        : commit.sha.slice(0, 7),
      message: typeof commit.message === 'string' ? commit.message : '',
      author: commit.authorName || commit.authorLogin || null,
      date: commit.authorDate || null,
      parentShas: Array.isArray(commit.parentShas)
        ? commit.parentShas.filter((sha) => typeof sha === 'string' && sha !== '')
        : [],
      rawParentShas: Array.isArray(commit.parentShas) ? [...commit.parentShas] : [],
    }))
    .filter((commit) => {
      if (seenCommits.has(commit.sha)) {
        return false;
      }
      seenCommits.add(commit.sha);
      return true;
    });

  if (validCommits.length === 0) {
    return emptyGraph(commits.length, maxNodes);
  }

  const ordered = [...validCommits].sort(compareCommits);
  const displayedCommits = ordered.slice(0, maxNodes);
  const displayedShas = new Set(displayedCommits.map((commit) => commit.sha));
  const allShas = new Set(validCommits.map((commit) => commit.sha));

  const depthMemo = new Map();
  const visiting = new Set();
  for (const commit of displayedCommits) {
    computeDepth(commit.sha, displayedCommits, depthMemo, visiting);
  }

  const nodesByDepth = new Map();
  for (const commit of displayedCommits) {
    const depth = depthMemo.get(commit.sha) || 0;
    if (!nodesByDepth.has(depth)) {
      nodesByDepth.set(depth, []);
    }
    nodesByDepth.get(depth).push(commit);
  }

  const depths = [...nodesByDepth.keys()].sort((a, b) => b - a);
  const nodes = [];
  let maxLane = 0;

  for (const depth of depths) {
    const group = nodesByDepth.get(depth).sort((a, b) => a.sha.localeCompare(b.sha));
    group.forEach((commit, lane) => {
      maxLane = Math.max(maxLane, lane);
      nodes.push({
        sha: commit.sha,
        shortSha: commit.shortSha,
        message: commit.message,
        author: commit.author,
        date: commit.date,
        parentShas: [...commit.parentShas],
        depth,
        lane,
        x: PADDING + lane * (NODE_WIDTH + HORIZONTAL_GAP),
        y: PADDING + (depths.indexOf(depth)) * (NODE_HEIGHT + VERTICAL_GAP),
        isSelected: commit.sha === selectedSha,
        isMerge: commit.parentShas.length > 1,
      });
    });
  }

  const nodeBySha = new Map(nodes.map((node) => [node.sha, node]));
  const edges = [];
  const edgeKeys = new Set();
  const unresolvedParents = [];
  const unresolvedSet = new Set();

  for (const node of nodes) {
    const rawParents = Array.isArray(node.rawParentShas) ? node.rawParentShas : node.parentShas;
    for (const parentSha of rawParents) {
      if (typeof parentSha !== 'string' || parentSha === '') {
        const invalidKey = '__invalid_parent__';
        if (!unresolvedSet.has(invalidKey)) {
          unresolvedSet.add(invalidKey);
          unresolvedParents.push({
            sha: null,
            reason: 'invalid',
          });
        }
        continue;
      }
      if (parentSha === node.sha) {
        continue;
      }
      if (nodeBySha.has(parentSha)) {
        const edgeKey = `${node.sha}->${parentSha}`;
        if (!edgeKeys.has(edgeKey)) {
          edgeKeys.add(edgeKey);
          edges.push({ from: node.sha, to: parentSha });
        }
      } else if (!unresolvedSet.has(parentSha)) {
        unresolvedSet.add(parentSha);
        unresolvedParents.push({
          sha: parentSha,
          reason: allShas.has(parentSha) ? 'not_displayed' : 'not_loaded',
        });
      }
    }
  }

  const maxDepthIndex = Math.max(0, depths.length - 1);
  const width = PADDING * 2 + (maxLane + 1) * NODE_WIDTH + maxLane * HORIZONTAL_GAP;
  const height = PADDING * 2 + (maxDepthIndex + 1) * NODE_HEIGHT + maxDepthIndex * VERTICAL_GAP;

  const truncated = validCommits.length > maxNodes;
  const partial = unresolvedParents.length > 0 || truncated;

  return {
    nodes,
    edges,
    missingParents: unresolvedParents.map((item) => item.sha),
    unresolvedParents,
    partial,
    isPartial: partial,
    truncated,
    isTruncated: truncated,
    displayedCount: nodes.length,
    totalCount: validCommits.length,
    omittedCount: Math.max(0, validCommits.length - nodes.length),
    maxNodes,
    width: Math.max(width, NODE_WIDTH + PADDING * 2),
    height: Math.max(height, NODE_HEIGHT + PADDING * 2),
    hasMissingParents: unresolvedParents.length > 0,
  };
}

function emptyGraph(totalCount, maxNodes) {
  return {
    nodes: [],
    edges: [],
    missingParents: [],
    unresolvedParents: [],
    partial: false,
    isPartial: false,
    truncated: totalCount > maxNodes,
    isTruncated: totalCount > maxNodes,
    displayedCount: 0,
    totalCount,
    omittedCount: totalCount,
    maxNodes,
    width: NODE_WIDTH + PADDING * 2,
    height: NODE_HEIGHT + PADDING * 2,
    hasMissingParents: false,
  };
}

function isValidCommit(commit) {
  return Boolean(commit && typeof commit === 'object' && !Array.isArray(commit) && typeof commit.sha === 'string' && commit.sha !== '');
}

function compareCommits(a, b) {
  const aTime = parseTime(a.date);
  const bTime = parseTime(b.date);
  if (aTime !== null && bTime !== null && aTime !== bTime) {
    return bTime - aTime;
  }
  if (aTime === null && bTime !== null) {
    return 1;
  }
  if (aTime !== null && bTime === null) {
    return -1;
  }
  return a.sha.localeCompare(b.sha);
}

function parseTime(value) {
  if (typeof value !== 'string' || value === '') {
    return null;
  }
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

function computeDepth(sha, commits, memo, visiting) {
  if (memo.has(sha)) {
    return memo.get(sha);
  }
  if (visiting.has(sha)) {
    return 0;
  }

  const commit = commits.find((item) => item.sha === sha);
  if (!commit) {
    memo.set(sha, 0);
    return 0;
  }

  visiting.add(sha);
  let maxParentDepth = -1;
  for (const parentSha of commit.parentShas) {
    if (commits.some((item) => item.sha === parentSha)) {
      maxParentDepth = Math.max(maxParentDepth, computeDepth(parentSha, commits, memo, visiting));
    }
  }
  visiting.delete(sha);
  const depth = maxParentDepth + 1;
  memo.set(sha, depth);
  return depth;
}

function normalizePositiveInteger(value, fallback) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    return fallback;
  }
  return number;
}
