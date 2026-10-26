import { NODE_DIMENSIONS } from './svg-renderer.js';
import { getEdgeEndpoints } from './svg-renderer.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const EXPORT_PADDING = 48;
const MAX_PNG_DIMENSION = 4096;
const MAX_PNG_PIXELS = 16777216;
const MIN_PNG_DIMENSION = 1;

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function nodeDimensions(node) {
  if (node && Number.isFinite(node.width) && Number.isFinite(node.height)) {
    return { width: node.width, height: node.height };
  }
  return NODE_DIMENSIONS[node?.type] ?? { width: 160, height: 80 };
}

export function getDiagramBounds(diagram) {
  if (!diagram || typeof diagram !== 'object' || Array.isArray(diagram)) {
    throw new Error('Diagram harus berupa objek.');
  }
  if (!Array.isArray(diagram.nodes)) {
    throw new Error('Diagram.nodes harus berupa larik.');
  }
  const nodes = diagram.nodes;
  if (nodes.length === 0) {
    return null;
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    if (!node || !isFiniteNumber(node.x) || !isFiniteNumber(node.y)) {
      throw new Error('Node memiliki koordinat yang tidak valid.');
    }
    const { width, height } = nodeDimensions(node);
    minX = Math.min(minX, node.x - width / 2);
    maxX = Math.max(maxX, node.x + width / 2);
    minY = Math.min(minY, node.y - height / 2);
    maxY = Math.max(maxY, node.y + height / 2);
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function calculateSvgExport(diagram, options = {}) {
  const bounds = getDiagramBounds(diagram);
  if (!bounds) {
    throw new Error('Diagram kosong tidak dapat diekspor.');
  }

  const padding = Number.isFinite(options.padding) && options.padding >= 0 ? options.padding : EXPORT_PADDING;
  const width = Math.max(1, Math.ceil(bounds.width + padding * 2));
  const height = Math.max(1, Math.ceil(bounds.height + padding * 2));
  const originX = bounds.minX - padding;
  const originY = bounds.minY - padding;

  return {
    width,
    height,
    originX,
    originY,
    bounds,
  };
}

export function calculatePngDimensions(diagram, options = {}) {
  const { width: sourceWidth, height: sourceHeight } = calculateSvgExport(diagram, options);
  const maxDimension = Number.isFinite(options.maxDimension) && options.maxDimension > 0
    ? Math.floor(options.maxDimension)
    : MAX_PNG_DIMENSION;
  const maxPixels = Number.isFinite(options.maxPixels) && options.maxPixels > 0
    ? Math.floor(options.maxPixels)
    : MAX_PNG_PIXELS;

  let scale = 1;
  if (sourceWidth > maxDimension || sourceHeight > maxDimension) {
    scale = Math.min(scale, maxDimension / Math.max(sourceWidth, sourceHeight));
  }
  const sourcePixels = sourceWidth * sourceHeight;
  if (sourcePixels > maxPixels) {
    scale = Math.min(scale, Math.sqrt(maxPixels / sourcePixels));
  }

  const width = Math.max(MIN_PNG_DIMENSION, Math.floor(sourceWidth * scale));
  const height = Math.max(MIN_PNG_DIMENSION, Math.floor(sourceHeight * scale));

  return {
    width,
    height,
    scale,
    sourceWidth,
    sourceHeight,
  };
}

function nodeShapeMarkup(node) {
  const { width, height } = nodeDimensions(node);
  const halfWidth = width / 2;
  const halfHeight = height / 2;

  switch (node.type) {
    case 'startEnd':
      return `<ellipse cx="${node.x}" cy="${node.y}" rx="${halfWidth}" ry="${halfHeight}" fill="${escapeXml(node.fill)}" stroke="${escapeXml(node.stroke)}" stroke-width="2" />`;
    case 'decision':
      return `<polygon points="${node.x},${node.y - halfHeight} ${node.x + halfWidth},${node.y} ${node.x},${node.y + halfHeight} ${node.x - halfWidth},${node.y}" fill="${escapeXml(node.fill)}" stroke="${escapeXml(node.stroke)}" stroke-width="2" />`;
    case 'inputOutput': {
      const slant = Math.min(24, halfWidth * 0.35);
      const points = [
        [node.x - halfWidth + slant, node.y - halfHeight],
        [node.x + halfWidth + slant, node.y - halfHeight],
        [node.x + halfWidth - slant, node.y + halfHeight],
        [node.x - halfWidth - slant, node.y + halfHeight],
      ].map((point) => point.join(',')).join(' ');
      return `<polygon points="${points}" fill="${escapeXml(node.fill)}" stroke="${escapeXml(node.stroke)}" stroke-width="2" />`;
    }
    case 'process':
    default:
      return `<rect x="${node.x - halfWidth}" y="${node.y - halfHeight}" width="${width}" height="${height}" rx="8" fill="${escapeXml(node.fill)}" stroke="${escapeXml(node.stroke)}" stroke-width="2" />`;
  }
}

export function buildSvgMarkup(diagram, options = {}) {
  const { width, height, originX, originY } = calculateSvgExport(diagram, options);
  const nodes = Array.isArray(diagram?.nodes) ? diagram.nodes : [];
  const edges = Array.isArray(diagram?.edges) ? diagram.edges : [];
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));

  const edgeMarkup = edges.map((edge) => {
    const source = nodeMap.get(edge.from);
    const target = nodeMap.get(edge.to);
    if (!source || !target) {
      return '';
    }
    const endpoints = getEdgeEndpoints(source, target);
    if (!endpoints) {
      return '';
    }
    return `<line x1="${endpoints.start.x}" y1="${endpoints.start.y}" x2="${endpoints.end.x}" y2="${endpoints.end.y}" stroke="#1f2937" stroke-width="2" marker-end="url(#diagram-arrow)" />`;
  }).join('');

  const nodeMarkup = nodes.map((node) => {
    const text = `<text x="${node.x}" y="${node.y}" text-anchor="middle" dominant-baseline="middle" fill="${escapeXml(node.textColor)}" font-size="14" font-family="system-ui, -apple-system, Segoe UI, sans-serif">${escapeXml(node.text)}</text>`;
    return `<g>${nodeShapeMarkup(node)}${text}</g>`;
  }).join('');

  return [
    `<svg xmlns="${SVG_NS}" width="${width}" height="${height}" viewBox="${originX} ${originY} ${width} ${height}" role="img" aria-label="DiagramForge diagram">`,
    '<defs>',
    '<marker id="diagram-arrow" markerWidth="10" markerHeight="10" refX="9" refY="3.5" orient="auto">',
    '<path d="M0,0 L0,7 L9,3.5 z" fill="#1f2937" />',
    '</marker>',
    '</defs>',
    `<rect x="${originX}" y="${originY}" width="${width}" height="${height}" fill="#ffffff" />`,
    `<g class="diagram-edges">${edgeMarkup}</g>`,
    `<g class="diagram-nodes">${nodeMarkup}</g>`,
    '</svg>',
  ].join('');
}

export function exportDiagramSvg(diagram, options = {}) {
  const markup = buildSvgMarkup(diagram, options);
  if (typeof markup !== 'string' || markup.length === 0) {
    throw new Error('SVG ekspor tidak valid.');
  }
  return markup;
}

export function createExportFilename(extension) {
  const safeExtension = String(extension).replace(/[^a-z0-9]/gi, '').toLowerCase();
  if (!safeExtension) {
    throw new Error('Ekstensi file tidak valid.');
  }
  return `diagramforge-${new Date().toISOString().slice(0, 10)}.${safeExtension}`;
}

export async function exportDiagramPng(diagram, options = {}) {
  if (typeof document === 'undefined') {
    throw new Error('Ekspor PNG memerlukan lingkungan browser.');
  }

  const markup = exportDiagramSvg(diagram, options);
  const dimensions = calculatePngDimensions(diagram, options);
  const svgBlob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  try {
    const image = new Image();
    image.decoding = 'async';
    await new Promise((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('SVG tidak dapat didekode untuk PNG.'));
      image.src = url;
    });

    const canvas = document.createElement('canvas');
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas 2D tidak tersedia.');
    }

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, dimensions.width, dimensions.height);
    context.drawImage(image, 0, 0, dimensions.width, dimensions.height);

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((result) => {
        if (!result || result.size === 0) {
          reject(new Error('Blob PNG tidak valid.'));
        } else {
          resolve(result);
        }
      }, 'image/png');
    });

    if (!blob || blob.size === 0) {
      throw new Error('Blob PNG tidak valid.');
    }
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function downloadBlob(blob, filename, revokeDelay = 1500) {
  if (!blob || blob.size <= 0) {
    throw new Error('Blob unduhan tidak valid.');
  }
  if (typeof document === 'undefined') {
    throw new Error('Unduhan memerlukan lingkungan browser.');
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, revokeDelay);

  return filename;
}

export const exportSvg = exportDiagramSvg;
export const exportPng = exportDiagramPng;
export const buildSvg = buildSvgMarkup;
export const getBounds = getDiagramBounds;
export const calculatePngSize = calculatePngDimensions;
