const SVG_NS = 'http://www.w3.org/2000/svg';
const BASE_VIEWPORT_WIDTH = 1600;
const BASE_VIEWPORT_HEIGHT = 900;

function normalizeViewport(viewport) {
  if (!viewport || typeof viewport !== 'object') {
    return { x: 0, y: 0, zoom: 1 };
  }
  const x = Number.isFinite(viewport.x) ? viewport.x : 0;
  const y = Number.isFinite(viewport.y) ? viewport.y : 0;
  const zoom = Number.isFinite(viewport.zoom) ? Math.min(4, Math.max(0.25, viewport.zoom)) : 1;
  return { x, y, zoom };
}

export const NODE_DIMENSIONS = Object.freeze({
  startEnd: Object.freeze({ width: 140, height: 70 }),
  process: Object.freeze({ width: 160, height: 80 }),
  decision: Object.freeze({ width: 140, height: 140 }),
  inputOutput: Object.freeze({ width: 160, height: 80 }),
});

const PARALLELOGRAM_SLANT = 24;

function clonePoint(point) {
  return { x: point.x, y: point.y };
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function nodeCenter(node) {
  return { x: node.x, y: node.y };
}

function dimensionsFor(node) {
  return NODE_DIMENSIONS[node.type] ?? { width: 160, height: 80 };
}

function parallelogramVertices(node) {
  const { x, y } = node;
  const { width, height } = dimensionsFor(node);
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const slant = Math.min(PARALLELOGRAM_SLANT, halfWidth * 0.35);

  return [
    { x: x - halfWidth + slant, y: y - halfHeight },
    { x: x + halfWidth + slant, y: y - halfHeight },
    { x: x + halfWidth - slant, y: y + halfHeight },
    { x: x - halfWidth - slant, y: y + halfHeight },
  ];
}

function polygonVertices(node) {
  const { x, y } = node;
  const { width, height } = dimensionsFor(node);
  const halfWidth = width / 2;
  const halfHeight = height / 2;

  switch (node.type) {
    case 'startEnd':
      return null;
    case 'decision':
      return [
        { x, y: y - halfHeight },
        { x: x + halfWidth, y },
        { x, y: y + halfHeight },
        { x: x - halfWidth, y },
      ];
    case 'inputOutput':
      return parallelogramVertices(node);
    case 'process':
    default:
      return [
        { x: x - halfWidth, y: y - halfHeight },
        { x: x + halfWidth, y: y - halfHeight },
        { x: x + halfWidth, y: y + halfHeight },
        { x: x - halfWidth, y: y + halfHeight },
      ];
  }
}

function intersectConvexPolygon(vertices, dx, dy) {
  if (!isFiniteNumber(dx) || !isFiniteNumber(dy) || (dx === 0 && dy === 0)) {
    return null;
  }

  let bestT = Infinity;
  let bestPoint = null;

  for (let index = 0; index < vertices.length; index += 1) {
    const start = vertices[index];
    const end = vertices[(index + 1) % vertices.length];
    const edgeX = end.x - start.x;
    const edgeY = end.y - start.y;
    const cross = dx * edgeY - dy * edgeX;

    if (Math.abs(cross) < 1e-12) {
      continue;
    }

    const t = (start.x * edgeY - start.y * edgeX) / cross;
    const s = (start.x * dy - start.y * dx) / cross;

    if (t >= -1e-9 && s >= -1e-9 && s <= 1 + 1e-9 && t < bestT) {
      bestT = t;
      bestPoint = {
        x: dx * t,
        y: dy * t,
      };
    }
  }

  if (!bestPoint || !Number.isFinite(bestPoint.x) || !Number.isFinite(bestPoint.y)) {
    return null;
  }

  return bestPoint;
}

export function getNodeBoundaryPoint(node, dxOrTarget, dy) {
  if (!node || !isFiniteNumber(node.x) || !isFiniteNumber(node.y)) {
    return null;
  }

  let dx = dxOrTarget;
  let dyValue = dy;

  if (dxOrTarget && typeof dxOrTarget === 'object' && isFiniteNumber(dxOrTarget.x) && isFiniteNumber(dxOrTarget.y)) {
    dx = dxOrTarget.x - node.x;
    dyValue = dxOrTarget.y - node.y;
  }

  if (!isFiniteNumber(dx) || !isFiniteNumber(dyValue)) {
    return null;
  }

  const { width, height } = dimensionsFor(node);
  const halfWidth = width / 2;
  const halfHeight = height / 2;

  if (dx === 0 && dyValue === 0) {
    return clonePoint(nodeCenter(node));
  }

  if (node.type === 'startEnd') {
    const t = 1 / Math.sqrt((dx / halfWidth) ** 2 + (dyValue / halfHeight) ** 2);
    const point = {
      x: node.x + dx * t,
      y: node.y + dyValue * t,
    };
    return Number.isFinite(point.x) && Number.isFinite(point.y) ? point : clonePoint(nodeCenter(node));
  }

  const vertices = polygonVertices(node);
  const relativePoint = intersectConvexPolygon(vertices.map((point) => ({
    x: point.x - node.x,
    y: point.y - node.y,
  })), dx, dyValue);

  if (!relativePoint) {
    return clonePoint(nodeCenter(node));
  }

  const point = {
    x: node.x + relativePoint.x,
    y: node.y + relativePoint.y,
  };

  return Number.isFinite(point.x) && Number.isFinite(point.y) ? point : clonePoint(nodeCenter(node));
}

export function getEdgeEndpoints(sourceNode, targetNode) {
  if (!sourceNode || !targetNode) {
    return null;
  }

  const dx = targetNode.x - sourceNode.x;
  const dy = targetNode.y - sourceNode.y;

  const start = getNodeBoundaryPoint(sourceNode, dx, dy);
  const end = getNodeBoundaryPoint(targetNode, -dx, -dy);

  if (!start || !end) {
    return null;
  }

  return { start, end };
}

export function renderDiagram(svg, diagram, options = {}) {
  if (!svg || typeof document === 'undefined') {
    return;
  }

  svg.setAttribute('xmlns', SVG_NS);
  const viewport = normalizeViewport(diagram?.viewport);
  const viewBoxWidth = 1600 / viewport.zoom;
  const viewBoxHeight = 900 / viewport.zoom;
  svg.setAttribute('viewBox', `${viewport.x} ${viewport.y} ${viewBoxWidth} ${viewBoxHeight}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Diagram DiagramForge');

  while (svg.firstChild) {
    svg.removeChild(svg.firstChild);
  }

  const defs = document.createElementNS(SVG_NS, 'defs');

  const marker = document.createElementNS(SVG_NS, 'marker');
  marker.setAttribute('id', 'diagram-arrow');
  marker.setAttribute('markerWidth', '10');
  marker.setAttribute('markerHeight', '10');
  marker.setAttribute('refX', '9');
  marker.setAttribute('refY', '3.5');
  marker.setAttribute('orient', 'auto');
  const markerPath = document.createElementNS(SVG_NS, 'path');
  markerPath.setAttribute('d', 'M0,0 L0,7 L9,3.5 z');
  markerPath.setAttribute('fill', '#1f2937');
  marker.appendChild(markerPath);
  defs.appendChild(marker);

  const gridPattern = document.createElementNS(SVG_NS, 'pattern');
  gridPattern.setAttribute('id', 'diagram-grid');
  gridPattern.setAttribute('width', '24');
  gridPattern.setAttribute('height', '24');
  gridPattern.setAttribute('patternUnits', 'userSpaceOnUse');
  const gridPath = document.createElementNS(SVG_NS, 'path');
  gridPath.setAttribute('d', 'M 24 0 L 0 0 0 24');
  gridPath.setAttribute('fill', 'none');
  gridPath.setAttribute('stroke', '#d9e2ec');
  gridPath.setAttribute('stroke-width', '1');
  gridPattern.appendChild(gridPath);
  defs.appendChild(gridPattern);

  svg.appendChild(defs);

  const background = document.createElementNS(SVG_NS, 'rect');
  background.setAttribute('x', String(viewport.x));
  background.setAttribute('y', String(viewport.y));
  background.setAttribute('width', String(viewBoxWidth));
  background.setAttribute('height', String(viewBoxHeight));
  background.setAttribute('fill', '#f8fafc');
  svg.appendChild(background);

  const grid = document.createElementNS(SVG_NS, 'rect');
  grid.setAttribute('x', String(viewport.x));
  grid.setAttribute('y', String(viewport.y));
  grid.setAttribute('width', String(viewBoxWidth));
  grid.setAttribute('height', String(viewBoxHeight));
  grid.setAttribute('fill', 'url(#diagram-grid)');
  svg.appendChild(grid);

  const edgesGroup = document.createElementNS(SVG_NS, 'g');
  edgesGroup.setAttribute('class', 'diagram-edges');
  const nodesGroup = document.createElementNS(SVG_NS, 'g');
  nodesGroup.setAttribute('class', 'diagram-nodes');

  const nodes = Array.isArray(diagram?.nodes) ? diagram.nodes : [];
  const edges = Array.isArray(diagram?.edges) ? diagram.edges : [];
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));

  for (const edge of edges) {
    const source = nodeMap.get(edge.from);
    const target = nodeMap.get(edge.to);
    if (!source || !target) {
      continue;
    }

    const endpoints = getEdgeEndpoints(source, target);
    if (!endpoints) {
      continue;
    }

    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', String(endpoints.start.x));
    line.setAttribute('y1', String(endpoints.start.y));
    line.setAttribute('x2', String(endpoints.end.x));
    line.setAttribute('y2', String(endpoints.end.y));
    line.setAttribute('stroke', '#1f2937');
    line.setAttribute('stroke-width', '2');
    line.setAttribute('marker-end', 'url(#diagram-arrow)');
    line.setAttribute('class', options.selectedEdgeId === edge.id ? 'diagram-edge is-selected' : 'diagram-edge');
    line.setAttribute('data-edge-id', edge.id);
    edgesGroup.appendChild(line);
  }

  for (const node of nodes) {
    const group = document.createElementNS(SVG_NS, 'g');
    group.setAttribute('class', 'diagram-node');
    group.setAttribute('data-node-id', node.id);
    group.setAttribute('tabindex', '0');
    group.setAttribute('role', 'button');
    group.setAttribute('aria-label', node.text || node.type);

    const isSelected = options.selectedNodeId === node.id;
    const isConnectSource = options.connectSourceId === node.id;
    if (isSelected) {
      group.classList.add('is-selected');
    }
    if (isConnectSource) {
      group.classList.add('is-connect-source');
    }

    let shape;
    switch (node.type) {
      case 'startEnd':
        shape = document.createElementNS(SVG_NS, 'ellipse');
        shape.setAttribute('cx', String(node.x));
        shape.setAttribute('cy', String(node.y));
        shape.setAttribute('rx', String(node.width / 2));
        shape.setAttribute('ry', String(node.height / 2));
        break;
      case 'decision':
        shape = document.createElementNS(SVG_NS, 'polygon');
        shape.setAttribute('points', [
          `${node.x},${node.y - node.height / 2}`,
          `${node.x + node.width / 2},${node.y}`,
          `${node.x},${node.y + node.height / 2}`,
          `${node.x - node.width / 2},${node.y}`,
        ].join(' '));
        break;
      case 'inputOutput':
        shape = document.createElementNS(SVG_NS, 'polygon');
        shape.setAttribute('points', parallelogramVertices(node).map((point) => `${point.x},${point.y}`).join(' '));
        break;
      case 'process':
      default:
        shape = document.createElementNS(SVG_NS, 'rect');
        shape.setAttribute('x', String(node.x - node.width / 2));
        shape.setAttribute('y', String(node.y - node.height / 2));
        shape.setAttribute('width', String(node.width));
        shape.setAttribute('height', String(node.height));
        shape.setAttribute('rx', '8');
        break;
    }

    shape.setAttribute('fill', node.fill);
    shape.setAttribute('stroke', node.stroke);
    shape.setAttribute('stroke-width', '2');
    group.appendChild(shape);

    const text = document.createElementNS(SVG_NS, 'text');
    text.setAttribute('x', String(node.x));
    text.setAttribute('y', String(node.y));
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('fill', node.textColor);
    text.setAttribute('font-size', '14');
    text.setAttribute('font-family', 'system-ui, -apple-system, Segoe UI, sans-serif');
    text.textContent = node.text;
    group.appendChild(text);

    nodesGroup.appendChild(group);
  }

  svg.appendChild(edgesGroup);
  svg.appendChild(nodesGroup);
}

export const getNodeBoundary = getNodeBoundaryPoint;
export const boundaryPoint = getNodeBoundaryPoint;
export const edgeEndpoints = getEdgeEndpoints;
export const calculateEdgeEndpoints = getEdgeEndpoints;
export const render = renderDiagram;
