const SVG_NS = 'http://www.w3.org/2000/svg';

export function renderCommitGraph(container, graph, options = {}) {
  if (!container) {
    return;
  }

  container.replaceChildren();

  const safeGraph = graph && typeof graph === 'object' ? graph : {
    nodes: [],
    edges: [],
    missingParents: [],
    unresolvedParents: [],
    partial: false,
    truncated: false,
    displayedCount: 0,
    totalCount: 0,
    omittedCount: 0,
    width: 220,
    height: 120,
    hasMissingParents: false,
  };

  const onSelect = typeof options.onSelect === 'function' ? options.onSelect : () => {};
  const selectedSha = typeof options.selectedSha === 'string' ? options.selectedSha : null;

  if (!Array.isArray(safeGraph.nodes) || safeGraph.nodes.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = safeGraph.totalCount > 0
      ? 'Tidak ada node graph yang dapat ditampilkan.'
      : 'Belum ada commit untuk divisualisasikan.';
    container.appendChild(empty);
    return;
  }

  const svg = document.createElementNS(SVG_NS, 'svg');
  // A group keeps the focusable nodes exposed to assistive technology.
  svg.setAttribute('role', 'group');
  svg.setAttribute('aria-label', 'Grafik ancestry commit');
  svg.setAttribute('viewBox', `0 0 ${safeGraph.width} ${safeGraph.height}`);
  svg.setAttribute('width', String(safeGraph.width));
  svg.setAttribute('height', String(safeGraph.height));
  svg.classList.add('commit-graph-svg');

  const nodeBySha = new Map(safeGraph.nodes.map((node) => [node.sha, node]));

  for (const edge of safeGraph.edges || []) {
    const from = nodeBySha.get(edge.from);
    const to = nodeBySha.get(edge.to);
    if (!from || !to) {
      continue;
    }
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', String(from.x + 16));
    line.setAttribute('y1', String(from.y + 29));
    line.setAttribute('x2', String(to.x + 16));
    line.setAttribute('y2', String(to.y + 29));
    line.classList.add('graph-edge');
    svg.appendChild(line);
  }

  for (const node of safeGraph.nodes) {
    const group = document.createElementNS(SVG_NS, 'g');
    const selected = node.sha === selectedSha || node.isSelected;
    group.classList.add('graph-node');
    if (selected) {
      group.classList.add('is-selected');
      group.setAttribute('aria-current', 'true');
    }
    group.setAttribute('tabindex', '0');
    group.setAttribute('role', 'button');
    group.setAttribute('aria-label', `${node.shortSha}: ${truncateLabel(node.message, 80)}`);
    group.dataset.sha = node.sha;
    group.dataset.focusKey = `graph:${node.sha}`;

    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', String(node.x + 16));
    circle.setAttribute('cy', String(node.y + 29));
    circle.setAttribute('r', '10');
    circle.classList.add('graph-node-circle');
    if (node.isMerge) {
      circle.classList.add('is-merge');
    }

    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('x', String(node.x + 34));
    label.setAttribute('y', String(node.y + 24));
    label.classList.add('graph-node-label');
    label.textContent = node.shortSha;

    const message = document.createElementNS(SVG_NS, 'text');
    message.setAttribute('x', String(node.x + 34));
    message.setAttribute('y', String(node.y + 40));
    message.classList.add('graph-node-message');
    message.textContent = truncateLabel(node.message, 28);

    group.append(circle, label, message);

    if (node.parentShas.some((parentSha) => !nodeBySha.has(parentSha))) {
      const marker = document.createElementNS(SVG_NS, 'text');
      marker.setAttribute('x', String(node.x + 2));
      marker.setAttribute('y', String(node.y + 16));
      marker.classList.add('graph-missing-parent');
      marker.textContent = '?';
      group.appendChild(marker);
    }

    group.addEventListener('click', () => {
      onSelect(node.sha);
    });
    group.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onSelect(node.sha);
      }
    });

    svg.appendChild(group);
  }

  container.appendChild(svg);
}

function firstLine(value) {
  return String(value ?? '').split(/\r?\n/, 1)[0] || '';
}

function truncateLabel(value, maxLength) {
  const text = firstLine(value);
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 1)}…`;
}
