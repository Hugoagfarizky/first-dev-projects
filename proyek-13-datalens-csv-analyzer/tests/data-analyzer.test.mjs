import test from "node:test";
import assert from "node:assert/strict";

import {
  buildChartModel,
  formatChartSummary,
  formatDecimal,
  formatInteger,
  getHistogram,
  getNumericStats,
} from "../js/data-analyzer.js";

function numericDataset(values, header = "value") {
  return {
    headers: [header],
    rows: values.map((value) => [String(value)]),
  };
}

function assertClose(actual, expected, tolerance = 1e-12) {
  const scale = Math.max(1, Math.abs(expected));
  assert.ok(
    Math.abs(actual - expected) <= scale * tolerance,
    `Expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

test("L-2: statistik dasar mengabaikan sel kosong dan non-numerik", () => {
  const dataset = {
    headers: ["amount"],
    rows: [["10"], [""], ["20"], ["abc"], ["30"]],
  };
  const stats = getNumericStats(dataset, 0);

  assert.equal(stats.count, 3);
  assert.equal(stats.emptyCount, 1);
  assert.equal(stats.nonNumericCount, 1);
  assert.equal(stats.min, 10);
  assert.equal(stats.max, 30);
  assert.equal(stats.mean, 20);
  assert.equal(stats.median, 20);
  assert.equal(stats.sum, 60);
});

test("L-2: mean dan median tidak overflow untuk -1e308 dan 1e308", () => {
  const stats = getNumericStats(numericDataset(["-1e308", "1e308"]), 0);

  assert.equal(stats.min, -1e308);
  assert.equal(stats.max, 1e308);
  assert.equal(stats.mean, 0);
  assert.equal(stats.median, 0);
  assert.equal(stats.sum, 0);
  assert.ok(Number.isFinite(stats.mean));
  assert.ok(Number.isFinite(stats.median));
});

test("L-2: nilai besar yang sama tetap menghasilkan statistik finite", () => {
  const stats = getNumericStats(numericDataset(["1e308", "1e308"]), 0);

  assert.equal(stats.mean, 1e308);
  assert.equal(stats.median, 1e308);
  assert.equal(stats.min, 1e308);
  assert.equal(stats.max, 1e308);
  assert.equal(stats.sum, null);
  assert.ok(Number.isFinite(stats.mean));
  assert.ok(Number.isFinite(stats.median));
});

test("L-2: mean campuran besar negatif dan positif tetap finite", () => {
  const stats = getNumericStats(numericDataset(["-1e308", "1e308", "1e308"]), 0);
  const expectedMean = 1e308 / 3;

  assert.equal(stats.min, -1e308);
  assert.equal(stats.max, 1e308);
  assert.equal(stats.median, 1e308);
  assert.equal(stats.count, 3);
  assertClose(stats.mean, expectedMean);
  assert.ok(Number.isFinite(stats.mean));
});

test("L-2: data konstan termasuk nol dan nilai desimal ditangani", () => {
  const zeroStats = getNumericStats(numericDataset(["0", "0", "0"]), 0);
  const decimalStats = getNumericStats(numericDataset(["0.01", "0.01"]), 0);

  assert.equal(zeroStats.mean, 0);
  assert.equal(zeroStats.median, 0);
  assert.equal(zeroStats.sum, 0);
  assert.equal(decimalStats.mean, 0.01);
  assert.equal(decimalStats.median, 0.01);
});

test("M-4: label histogram desimal kecil unik dan rentangnya benar", () => {
  const histogram = getHistogram(numericDataset(["0", "0.01", "0.02", "0.03", "0.04", "0.05"]), 0, 8);

  assert.deepEqual(histogram.labels, [
    "0–0,00625",
    "0,00625–0,0125",
    "0,0125–0,01875",
    "0,01875–0,025",
    "0,025–0,03125",
    "0,03125–0,0375",
    "0,0375–0,04375",
    "0,04375–0,05",
  ]);
  assert.equal(new Set(histogram.labels).size, histogram.labels.length);
  assert.deepEqual(histogram.values, [1, 1, 0, 1, 1, 0, 1, 1]);
  assert.equal(
    histogram.values.reduce((sum, value) => sum + value, 0),
    histogram.total,
  );
  assert.equal(histogram.total, 6);
  assert.equal(histogram.boundaries.length, 9);
  assert.equal(histogram.boundaries[0], 0);
  assert.equal(histogram.boundaries.at(-1), 0.05);
  assertClose(histogram.boundaries[1], 0.00625);
  assertClose(histogram.boundaries[3], 0.01875);
  assertClose(histogram.boundaries[8], 0.05);

  for (const label of histogram.labels) {
    assert.ok(label.length > 0);
    assert.doesNotMatch(label, /NaN|Infinity|Tidak tersedia/);
    assert.notEqual(label.split("–")[0], label.split("–")[1]);
  }
});

test("M-4: label desimal lebih kecil juga unik dan tidak membulat menjadi rentang nol", () => {
  const histogram = getHistogram(
    numericDataset(["0", "0.0001", "0.0002", "0.0003", "0.0004", "0.0005"]),
    0,
    8,
  );

  assert.equal(new Set(histogram.labels).size, 8);
  assert.equal(histogram.values.reduce((sum, value) => sum + value, 0), 6);
  assert.equal(histogram.boundaries[0], 0);
  assertClose(histogram.boundaries.at(-1), 0.0005);
  assert.ok(
    histogram.labels.every((label) => {
      const [start, end] = label.split("–");
      return start !== end;
    }),
  );
});

test("M-4: ringkasan aksesibel memakai label histogram yang sama", () => {
  const dataset = numericDataset(["0", "0.01", "0.02", "0.03", "0.04", "0.05"]);
  const histogram = getHistogram(dataset, 0, 8);
  const model = buildChartModel(dataset, { index: 0, name: "value", isNumeric: true });
  const summary = formatChartSummary(model);

  for (const label of histogram.labels) {
    assert.ok(summary.includes(label), `Ringkasan tidak memuat label ${label}`);
  }

  assert.match(summary, /0–0,00625: 1 baris/);
  assert.match(summary, /0,0125–0,01875: 0 baris/);
});

test("M-4: data konstan menghasilkan satu label yang jelas tanpa NaN atau em dash", () => {
  const constant = getHistogram(numericDataset(["5", "5", "5"]), 0, 8);
  const zero = getHistogram(numericDataset(["0", "0"]), 0, 8);

  assert.deepEqual(constant.labels, ["5"]);
  assert.deepEqual(constant.values, [3]);
  assert.deepEqual(constant.boundaries, [5, 5]);
  assert.deepEqual(zero.labels, ["0"]);
  assert.deepEqual(zero.values, [2]);
  assert.doesNotMatch(constant.labels[0], /NaN|Infinity|—/);
});

test("L-2: histogram rentang ekstrem tidak overflow dan tidak kehilangan observasi", () => {
  const dataset = numericDataset(["-1e308", "1e308"]);
  const histogram = getHistogram(dataset, 0, 8);

  assert.deepEqual(histogram.values, [1, 0, 0, 0, 0, 0, 0, 1]);
  assert.equal(histogram.total, 2);
  assert.equal(
    histogram.values.reduce((sum, value) => sum + value, 0),
    histogram.total,
  );
  assert.equal(histogram.boundaries.length, 9);
  assert.equal(histogram.boundaries[0], -1e308);
  assert.equal(histogram.boundaries.at(-1), 1e308);
  assert.ok(histogram.boundaries.every((value) => Number.isFinite(value)));
  assert.equal(new Set(histogram.labels).size, histogram.labels.length);
  assert.ok(histogram.labels.every((label) => !/NaN|Infinity|—/.test(label)));
});

test("L-2: histogram nilai besar konstan dan campuran tetap finite", () => {
  const constant = getHistogram(numericDataset(["1e308", "1e308", "1e308"]), 0, 8);
  const mixed = getHistogram(
    numericDataset(["-1e308", "-5e307", "0", "5e307", "1e308", "1e308"]),
    0,
    8,
  );

  assert.equal(constant.total, 3);
  assert.equal(constant.values.length, 1);
  assert.equal(constant.labels.length, 1);
  assert.equal(mixed.total, 6);
  assert.equal(
    mixed.values.reduce((sum, value) => sum + value, 0),
    mixed.total,
  );
  assert.ok(mixed.boundaries.every((value) => Number.isFinite(value)));
});

test("L-2: format statistik ekstrem tidak menghasilkan em dash atau Infinity", () => {
  assert.doesNotMatch(formatDecimal(1e308), /—|Infinity|NaN/);
  assert.doesNotMatch(formatDecimal(-1e308), /—|Infinity|NaN/);
  assert.equal(formatInteger(1000), "1.000");
});
