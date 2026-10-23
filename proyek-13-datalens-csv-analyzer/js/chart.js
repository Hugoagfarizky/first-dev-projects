import { formatInteger } from "./data-analyzer.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const BAR_COLOR = "#0f766e";
const GRID_COLOR = "#dfe5dd";
const TEXT_COLOR = "#42504a";
const AXIS_COLOR = "#9aa69f";

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);

  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, String(value));
  }

  return element;
}

function shortLabel(label, maxLength) {
  const text = String(label);
  return text.length > maxLength ? `${text.slice(0, Math.max(1, maxLength - 1))}…` : text;
}

function niceStep(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return 1;
  }

  const exponent = Math.floor(Math.log10(value));
  const magnitude = 10 ** exponent;
  const fraction = value / magnitude;

  let niceFraction = 1;
  if (fraction > 5) {
    niceFraction = 10;
  } else if (fraction > 2) {
    niceFraction = 5;
  } else if (fraction > 1) {
    niceFraction = 2;
  }

  return Math.max(1, niceFraction * magnitude);
}

function chartGeometry(svg) {
  const containerWidth = svg.parentElement?.getBoundingClientRect().width ?? 720;
  const width = Math.max(280, Math.floor(containerWidth || 720));
  const compact = width < 540;

  return {
    width,
    height: compact ? 330 : 370,
    compact,
    margin: {
      top: 24,
      right: compact ? 10 : 22,
      bottom: compact ? 94 : 82,
      left: compact ? 45 : 58,
    },
  };
}

function appendTitle(svg, model) {
  const title = svgElement("title");
  title.textContent = model.title;

  const description = svgElement("desc");
  description.textContent = `${model.subtitle} ${model.labels
    .map((label, index) => `${label}: ${formatInteger(model.values[index] ?? 0)} baris`)
    .join("; ")}.`;

  svg.append(title, description);
}

function appendGrid(svg, plot, topValue, tickCount) {
  const group = svgElement("g", { "aria-hidden": "true" });

  for (let tick = 0; tick <= tickCount; tick += 1) {
    const value = (topValue / tickCount) * tick;
    const y = plot.bottom - (value / topValue) * plot.height;

    group.append(
      svgElement("line", {
        x1: plot.left,
        x2: plot.right,
        y1: y,
        y2: y,
        stroke: GRID_COLOR,
        "stroke-width": tick === 0 ? 1.4 : 1,
      }),
    );

    const label = svgElement("text", {
      x: plot.left - 8,
      y: y + 4,
      "text-anchor": "end",
      fill: TEXT_COLOR,
      "font-size": 11,
    });
    label.textContent = formatInteger(Math.round(value));
    group.append(label);
  }

  svg.append(group);
}

export function renderChart(svg, model) {
  if (!model || model.labels.length === 0 || model.values.length === 0) {
    svg.replaceChildren();
    svg.setAttribute("aria-hidden", "true");
    return;
  }

  const { width, height, compact, margin } = chartGeometry(svg);
  const plot = {
    left: margin.left,
    right: width - margin.right,
    top: margin.top,
    bottom: height - margin.bottom,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };

  svg.replaceChildren();
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `${model.title}. Grafik batang berisi ${model.labels.length} kategori.`);
  svg.removeAttribute("aria-hidden");
  svg.dataset.chartKind = model.kind;

  appendTitle(svg, model);

  const maximum = Math.max(1, ...model.values);
  const step = niceStep(maximum / 4);
  const topValue = Math.max(step, Math.ceil(maximum / step) * step);
  const tickCount = Math.max(1, Math.round(topValue / step));
  const plotHeight = plot.height;

  appendGrid(svg, plot, topValue, tickCount);

  const slotWidth = plot.width / model.values.length;
  const gap = Math.min(compact ? 5 : 10, slotWidth * 0.22);
  const barWidth = Math.max(6, slotWidth - gap);
  const barGroup = svgElement("g");
  const rotateLabels = compact || model.labels.some((label) => String(label).length > 12);
  const labelLimit = compact ? 10 : 14;

  model.values.forEach((value, index) => {
    const barHeight = (value / topValue) * plotHeight;
    const x = plot.left + slotWidth * index + gap / 2;
    const y = plot.bottom - barHeight;

    const rect = svgElement("rect", {
      x,
      y,
      width: barWidth,
      height: Math.max(value > 0 ? 2 : 0, barHeight),
      rx: Math.min(4, barWidth / 4),
      fill: BAR_COLOR,
    });
    rect.dataset.label = model.labels[index];
    rect.dataset.value = String(value);

    const tooltip = svgElement("title");
    tooltip.textContent = `${model.labels[index]}: ${formatInteger(value)} baris`;
    rect.append(tooltip);
    barGroup.append(rect);

    const valueLabel = svgElement("text", {
      x: x + barWidth / 2,
      y: Math.max(plot.top + 10, y - 7),
      "text-anchor": "middle",
      fill: TEXT_COLOR,
      "font-size": compact ? 10 : 11,
      "font-weight": 700,
    });
    valueLabel.textContent = formatInteger(value);
    barGroup.append(valueLabel);

    const xLabel = svgElement("text", {
      x: x + barWidth / 2,
      y: plot.bottom + 18,
      "text-anchor": rotateLabels ? "end" : "middle",
      fill: TEXT_COLOR,
      "font-size": compact ? 10 : 11,
    });

    if (rotateLabels) {
      xLabel.setAttribute("transform", `rotate(-35 ${x + barWidth / 2} ${plot.bottom + 18})`);
    }

    xLabel.textContent = shortLabel(model.labels[index], labelLimit);
    barGroup.append(xLabel);
  });

  svg.append(barGroup);

  const axis = svgElement("g", { "aria-hidden": "true" });
  axis.append(
    svgElement("line", {
      x1: plot.left,
      x2: plot.right,
      y1: plot.bottom,
      y2: plot.bottom,
      stroke: AXIS_COLOR,
      "stroke-width": 1.2,
    }),
  );

  const yAxisLabel = svgElement("text", {
    x: 14,
    y: plot.top + plotHeight / 2,
    transform: `rotate(-90 14 ${plot.top + plotHeight / 2})`,
    "text-anchor": "middle",
    fill: TEXT_COLOR,
    "font-size": 11,
  });
  yAxisLabel.textContent = model.yAxisLabel;

  const xAxisLabel = svgElement("text", {
    x: plot.left + plot.width / 2,
    y: height - 12,
    "text-anchor": "middle",
    fill: TEXT_COLOR,
    "font-size": 11,
  });
  xAxisLabel.textContent = model.xAxisLabel;

  axis.append(yAxisLabel, xAxisLabel);
  svg.append(axis);
}
