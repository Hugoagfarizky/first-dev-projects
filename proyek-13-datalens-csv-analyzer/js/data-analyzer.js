const NUMERIC_PATTERN = /^[+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:[eE][+-]?\d+)?$/;
const NUMERIC_COLUMN_THRESHOLD = 0.6;
const MAX_SIGNIFICANT_DIGITS = 17;

export function isEmptyCell(value) {
  return String(value ?? "").trim() === "";
}

export function parseNumericCell(value) {
  const text = String(value ?? "").trim();

  if (text === "" || !NUMERIC_PATTERN.test(text)) {
    return null;
  }

  const numericValue = Number(text);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function normalizeZero(value) {
  return Object.is(value, -0) ? 0 : value;
}

function stableMeanAndSum(values) {
  let maximumAbsoluteValue = 0;

  for (const value of values) {
    maximumAbsoluteValue = Math.max(maximumAbsoluteValue, Math.abs(value));
  }

  if (maximumAbsoluteValue === 0) {
    return { mean: 0, sum: 0 };
  }

  let scaledSum = 0;
  for (const value of values) {
    scaledSum += value / maximumAbsoluteValue;
  }

  const scaledMean = scaledSum / values.length;
  const mean = normalizeZero(scaledMean * maximumAbsoluteValue);
  const scaledTotal = scaledSum * maximumAbsoluteValue;

  return {
    mean,
    sum: Number.isFinite(scaledTotal) ? normalizeZero(scaledTotal) : null,
  };
}

function stableMedian(sortedValues) {
  const middle = Math.floor(sortedValues.length / 2);

  if (sortedValues.length % 2 === 1) {
    return normalizeZero(sortedValues[middle]);
  }

  // Membagi dua terlebih dahulu menghindari overflow saat dua nilai tengah
  // sama-sama besar, dan menghindari overflow saat tandanya berlawanan.
  return normalizeZero(sortedValues[middle - 1] / 2 + sortedValues[middle] / 2);
}

export function analyzeDataset(dataset) {
  const profiles = dataset.headers.map((name, index) => {
    let emptyCount = 0;
    let numericCount = 0;
    let nonNumericCount = 0;

    for (const row of dataset.rows) {
      const cell = row[index];

      if (isEmptyCell(cell)) {
        emptyCount += 1;
        continue;
      }

      if (parseNumericCell(cell) === null) {
        nonNumericCount += 1;
      } else {
        numericCount += 1;
      }
    }

    const nonEmptyCount = numericCount + nonNumericCount;
    const numericRatio = nonEmptyCount === 0 ? 0 : numericCount / nonEmptyCount;

    return {
      index,
      name,
      emptyCount,
      numericCount,
      nonNumericCount,
      nonEmptyCount,
      numericRatio,
      isNumeric: numericCount > 0 && numericRatio >= NUMERIC_COLUMN_THRESHOLD,
    };
  });

  const emptyCount = profiles.reduce((sum, profile) => sum + profile.emptyCount, 0);
  const numericColumns = profiles.filter((profile) => profile.isNumeric);

  return {
    rowCount: dataset.rows.length,
    columnCount: dataset.headers.length,
    emptyCount,
    numericColumns,
    profiles,
    totalCells: dataset.rows.length * dataset.headers.length,
  };
}

export function getNumericStats(dataset, columnIndex) {
  const values = [];
  let emptyCount = 0;
  let nonNumericCount = 0;

  for (const row of dataset.rows) {
    const cell = row[columnIndex];

    if (isEmptyCell(cell)) {
      emptyCount += 1;
      continue;
    }

    const numericValue = parseNumericCell(cell);
    if (numericValue === null) {
      nonNumericCount += 1;
    } else {
      values.push(numericValue);
    }
  }

  if (values.length === 0) {
    return {
      count: 0,
      emptyCount,
      nonNumericCount,
      min: null,
      max: null,
      mean: null,
      median: null,
      sum: null,
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const { mean, sum } = stableMeanAndSum(values);

  return {
    count: values.length,
    emptyCount,
    nonNumericCount,
    min: normalizeZero(sorted[0]),
    max: normalizeZero(sorted[sorted.length - 1]),
    mean,
    median: stableMedian(sorted),
    sum,
  };
}

function interpolateBoundary(minimum, maximum, fraction) {
  if (fraction <= 0) {
    return minimum;
  }

  if (fraction >= 1) {
    return maximum;
  }

  // Rata-rata berbobot ini tetap finite untuk minimum/maximum yang berlawanan
  // tanda, berbeda dengan minimum + (maximum - minimum) * fraction.
  return normalizeZero(minimum * (1 - fraction) + maximum * fraction);
}

function intervalRatio(value, minimum, maximum) {
  const range = maximum - minimum;

  if (Number.isFinite(range) && range > 0) {
    return (value - minimum) / range;
  }

  // Untuk rentang yang overflow (misalnya -1e308 sampai 1e308), gunakan
  // setengah nilai agar operasi tetap berada dalam rentang Number yang finite.
  const halfRange = maximum / 2 - minimum / 2;

  if (Number.isFinite(halfRange) && halfRange > 0) {
    return (value / 2 - minimum / 2) / halfRange;
  }

  return 0;
}

function scientificNotationIsNeeded(absoluteValue) {
  return absoluteValue !== 0 && (absoluteValue >= 1e15 || absoluteValue < 1e-6);
}

function formatHistogramValue(value, significantDigits) {
  if (!Number.isFinite(value)) {
    return "Tidak tersedia";
  }

  const normalizedValue = normalizeZero(value);
  const absoluteValue = Math.abs(normalizedValue);
  const options = scientificNotationIsNeeded(absoluteValue)
    ? { notation: "scientific", maximumSignificantDigits: significantDigits }
    : { maximumSignificantDigits: significantDigits };

  return new Intl.NumberFormat("id-ID", options).format(normalizedValue);
}

function initialSignificantDigits(boundaries) {
  let maximumAbsoluteValue = 0;
  let minimumGap = Infinity;

  for (let index = 0; index < boundaries.length; index += 1) {
    maximumAbsoluteValue = Math.max(maximumAbsoluteValue, Math.abs(boundaries[index]));

    if (index > 0) {
      const gap = Math.abs(boundaries[index] - boundaries[index - 1]);
      if (gap > 0 && Number.isFinite(gap)) {
        minimumGap = Math.min(minimumGap, gap);
      }
    }
  }

  if (maximumAbsoluteValue === 0 || !Number.isFinite(minimumGap)) {
    return 3;
  }

  const requiredDigits = Math.ceil(Math.log10(maximumAbsoluteValue / minimumGap)) + 3;
  return Math.min(MAX_SIGNIFICANT_DIGITS, Math.max(3, requiredDigits));
}

function formatBoundaries(boundaries) {
  const initialDigits = initialSignificantDigits(boundaries);

  for (let digits = initialDigits; digits <= MAX_SIGNIFICANT_DIGITS; digits += 1) {
    const formatted = boundaries.map((boundary) => formatHistogramValue(boundary, digits));

    if (new Set(formatted).size === formatted.length) {
      return formatted;
    }
  }

  return boundaries.map((boundary) => formatHistogramValue(boundary, MAX_SIGNIFICANT_DIGITS));
}

export function getHistogram(dataset, columnIndex, binCount = 8) {
  const values = dataset.rows
    .map((row) => parseNumericCell(row[columnIndex]))
    .filter((value) => value !== null);

  if (values.length === 0) {
    return null;
  }

  values.sort((a, b) => a - b);
  const min = normalizeZero(values[0]);
  const max = normalizeZero(values[values.length - 1]);

  if (min === max) {
    return {
      labels: [formatHistogramValue(min, 12)],
      values: [values.length],
      boundaries: [min, max],
      min,
      max,
      total: values.length,
    };
  }

  const safeBinCount = Math.max(1, Math.floor(Number(binCount)) || 8);
  const counts = Array.from({ length: safeBinCount }, () => 0);

  for (const value of values) {
    const ratio = Math.min(1, Math.max(0, intervalRatio(value, min, max)));
    const index = Math.min(safeBinCount - 1, Math.floor(ratio * safeBinCount));
    counts[index] += 1;
  }

  const boundaries = Array.from({ length: safeBinCount + 1 }, (_, index) =>
    interpolateBoundary(min, max, index / safeBinCount),
  );
  const formattedBoundaries = formatBoundaries(boundaries);
  const labels = counts.map(
    (_, index) => `${formattedBoundaries[index]}–${formattedBoundaries[index + 1]}`,
  );

  return {
    labels,
    values: counts,
    boundaries,
    min,
    max,
    total: values.length,
  };
}

export function getCategoryData(dataset, columnIndex, limit = 8) {
  const frequencies = new Map();
  let emptyCount = 0;
  let nonEmptyCount = 0;

  for (const row of dataset.rows) {
    const rawValue = row[columnIndex];

    if (isEmptyCell(rawValue)) {
      emptyCount += 1;
      continue;
    }

    const value = String(rawValue).trim();
    frequencies.set(value, (frequencies.get(value) ?? 0) + 1);
    nonEmptyCount += 1;
  }

  if (nonEmptyCount === 0) {
    return null;
  }

  const sorted = [...frequencies.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "id", { sensitivity: "base" }),
  );

  const shown = sorted.slice(0, limit);

  return {
    labels: shown.map(([label]) => label),
    values: shown.map(([, count]) => count),
    emptyCount,
    total: nonEmptyCount,
    distinctCount: sorted.length,
    omittedCount: Math.max(0, sorted.length - shown.length),
  };
}

export function buildChartModel(dataset, profile) {
  if (!profile) {
    return null;
  }

  if (profile.isNumeric) {
    const histogram = getHistogram(dataset, profile.index);

    if (!histogram) {
      return null;
    }

    return {
      kind: "histogram",
      title: `Distribusi ${profile.name}`,
      subtitle: `${formatInteger(histogram.total)} nilai numerik dibagi menjadi ${histogram.values.length} kelompok.`,
      labels: histogram.labels,
      values: histogram.values,
      xAxisLabel: "Rentang nilai",
      yAxisLabel: "Jumlah baris",
      total: histogram.total,
      note: "Nilai kosong dan sel non-numerik tidak dihitung dalam grafik.",
    };
  }

  const categoryData = getCategoryData(dataset, profile.index);

  if (!categoryData) {
    return null;
  }

  const omittedNote =
    categoryData.omittedCount > 0
      ? ` ${formatInteger(categoryData.omittedCount)} kategori lain tidak ditampilkan.`
      : "";

  return {
    kind: "category",
    title: `Kategori pada ${profile.name}`,
    subtitle: `${formatInteger(categoryData.total)} nilai non-kosong, ${formatInteger(categoryData.distinctCount)} kategori unik.`,
    labels: categoryData.labels,
    values: categoryData.values,
    xAxisLabel: "Kategori",
    yAxisLabel: "Jumlah baris",
    total: categoryData.total,
    note: `${formatInteger(categoryData.emptyCount)} sel kosong tidak dimasukkan ke grafik.${omittedNote}`,
  };
}

export function formatChartSummary(model) {
  if (!model) {
    return "";
  }

  const parts = model.labels.map(
    (label, index) => `${label}: ${formatInteger(model.values[index] ?? 0)} baris`,
  );

  return `${model.title}. ${parts.join("; ")}.`;
}

export function formatInteger(value) {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(value);
}

export function formatDecimal(value, maximumFractionDigits = 4) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }

  const normalizedValue = normalizeZero(value);
  const absoluteValue = Math.abs(normalizedValue);

  if (scientificNotationIsNeeded(absoluteValue)) {
    return new Intl.NumberFormat("id-ID", {
      notation: "scientific",
      maximumSignificantDigits: Math.min(8, Math.max(3, maximumFractionDigits + 2)),
    }).format(normalizedValue);
  }

  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  }).format(normalizedValue);
}
