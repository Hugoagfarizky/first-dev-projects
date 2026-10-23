import {
  CsvParseError,
  MAX_FILE_SIZE,
  parseCsv,
} from "./csv-parser.js";
import {
  analyzeDataset,
  buildChartModel,
  formatChartSummary,
  formatDecimal,
  formatInteger,
  getNumericStats,
} from "./data-analyzer.js";
import { buildCsv, makeExportFilename } from "./csv-exporter.js";
import { DataTable } from "./data-table.js";
import { renderChart } from "./chart.js";

const BLOCKED_MIME_TYPES = new Set([
  "application/pdf",
  "application/zip",
  "application/x-7z-compressed",
  "application/x-rar-compressed",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel.sheet.macroEnabled.12",
]);

class UserFacingError extends Error {
  constructor(title, message, details = []) {
    super(message);
    this.name = "UserFacingError";
    this.title = title;
    this.details = details;
  }
}

const byId = (id) => document.getElementById(id);

const elements = {
  importPanel: byId("import-panel"),
  dropzone: byId("dropzone"),
  chooseFile: byId("choose-file"),
  fileInput: byId("file-input"),
  loadSample: byId("load-sample"),
  delimiterSelect: byId("delimiter-select"),
  reparseActive: byId("reparse-active"),
  delimiterHint: byId("delimiter-hint"),
  errorPanel: byId("error-panel"),
  errorTitle: byId("error-title"),
  errorMessage: byId("error-message"),
  errorDetails: byId("error-details"),
  errorClose: byId("error-close"),
  warningPanel: byId("warning-panel"),
  warningDetails: byId("warning-details"),
  warningClose: byId("warning-close"),
  appStatus: byId("app-status"),
  sourceBadge: byId("source-badge"),
  fileName: byId("file-card-title"),
  fileSubtitle: byId("file-subtitle"),
  fileSize: byId("file-size"),
  fileRows: byId("file-rows"),
  fileColumns: byId("file-columns"),
  fileDelimiter: byId("file-delimiter"),
  statRows: byId("stat-rows"),
  statRowsNote: byId("stat-rows-note"),
  statColumns: byId("stat-columns"),
  statColumnsNote: byId("stat-columns-note"),
  statEmpty: byId("stat-empty"),
  statEmptyNote: byId("stat-empty-note"),
  statNumeric: byId("stat-numeric"),
  statNumericNote: byId("stat-numeric-note"),
  numericColumn: byId("numeric-column"),
  statMin: byId("stat-min"),
  statMax: byId("stat-max"),
  statMean: byId("stat-mean"),
  statMedian: byId("stat-median"),
  numericNote: byId("numeric-note"),
  chartColumn: byId("chart-column"),
  chartSvg: byId("chart-svg"),
  chartEmpty: byId("chart-empty"),
  chartTitle: byId("chart-title"),
  chartSubtitle: byId("chart-subtitle"),
  chartNote: byId("chart-note"),
  chartA11y: byId("chart-a11y"),
  chartStage: byId("chart-stage"),
  table: byId("data-table"),
  tableHead: byId("data-table-head"),
  tableBody: byId("data-table-body"),
  tableEmpty: byId("table-empty"),
  tableSearch: byId("table-search"),
  pageSize: byId("page-size"),
  prevPage: byId("prev-page"),
  nextPage: byId("next-page"),
  pageInfo: byId("page-info"),
  resultCount: byId("result-count"),
  exportButton: byId("export-button"),
  exportScope: byId("export-scope"),
};

const state = {
  dataset: null,
  analysis: null,
  chartModel: null,
  source: null,
  busy: false,
};

let chartResizeFrame = 0;

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "—";
  }

  if (bytes < 1024) {
    return `${formatInteger(bytes)} B`;
  }

  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${formatDecimal(value, 1)} ${units[unitIndex]}`;
}

function announce(message) {
  elements.appStatus.textContent = message;
}

function hideError() {
  elements.errorPanel.hidden = true;
}

function showError(title, message, details = []) {
  elements.errorTitle.textContent = title;
  elements.errorMessage.textContent = message;
  elements.errorDetails.replaceChildren();

  if (details.length > 0) {
    for (const detail of details) {
      const item = document.createElement("li");
      item.textContent = detail;
      elements.errorDetails.append(item);
    }
    elements.errorDetails.hidden = false;
  } else {
    elements.errorDetails.hidden = true;
  }

  elements.errorPanel.hidden = false;
  announce(`${title}. ${message}`);
}

function hideWarnings() {
  elements.warningPanel.hidden = true;
  elements.warningDetails.replaceChildren();
}

function showWarnings(warnings) {
  elements.warningDetails.replaceChildren();

  if (!warnings || warnings.length === 0) {
    elements.warningPanel.hidden = true;
    return;
  }

  for (const warning of warnings) {
    const item = document.createElement("li");
    item.textContent = warning;
    elements.warningDetails.append(item);
  }

  elements.warningPanel.hidden = false;
}

function selectedDelimiter() {
  const value = elements.delimiterSelect.value;
  return value === "" ? undefined : value;
}

function updateDelimiterUi() {
  const selectedLabel = elements.delimiterSelect.selectedOptions[0]?.textContent ?? "Deteksi otomatis";

  if (state.dataset) {
    const sourceLabel = state.dataset.delimiterSource === "manual" ? "manual" : "otomatis";
    elements.delimiterHint.textContent = `Dataset aktif memakai ${state.dataset.delimiterLabel} (${sourceLabel}). Pilihan "${selectedLabel}" dipakai untuk impor berikutnya; klik "Terapkan ulang" untuk memproses ulang file aktif tanpa mengganti file.`;
  } else {
    elements.delimiterHint.textContent = `Pilihan "${selectedLabel}" dipakai saat impor berikutnya. Deteksi otomatis dapat memilih pemisah yang salah pada file yang ambigu.`;
  }

  elements.reparseActive.disabled = state.busy || !state.source;
}

function setBusy(isBusy) {
  state.busy = isBusy;
  elements.importPanel.setAttribute("aria-busy", String(isBusy));
  elements.dropzone.classList.toggle("is-busy", isBusy);
  elements.chooseFile.disabled = isBusy;
  elements.loadSample.disabled = isBusy;
  elements.fileInput.disabled = isBusy;
  elements.delimiterSelect.disabled = isBusy;
  elements.reparseActive.disabled = isBusy || !state.source;
}

function updateExportUi(exportState) {
  const count = exportState.count;
  const total = exportState.total;

  if (!state.dataset) {
    elements.exportButton.disabled = true;
    elements.exportButton.textContent = "Ekspor CSV";
    elements.exportScope.textContent = "Belum ada data untuk diekspor.";
    elements.exportButton.removeAttribute("title");
    return;
  }

  elements.exportButton.textContent =
    count > 0 ? `Ekspor CSV (${formatInteger(count)})` : "Ekspor CSV (0)";
  elements.exportButton.disabled = count === 0;

  if (count === 0) {
    elements.exportScope.textContent = "Tidak ada baris yang dapat diekspor.";
    elements.exportButton.removeAttribute("title");
    return;
  }

  if (exportState.isFiltered) {
    elements.exportScope.textContent = `Hasil filter aktif: ${formatInteger(
      count,
    )} dari ${formatInteger(total)} baris · urutan tabel saat ini.`;
    elements.exportButton.title = "Mengunduh hanya baris yang cocok dengan pencarian aktif.";
  } else {
    elements.exportScope.textContent = `Seluruh dataset: ${formatInteger(
      count,
    )} baris · urutan tabel saat ini.`;
    elements.exportButton.title = "Mengunduh seluruh baris dataset dalam urutan tabel saat ini.";
  }
}

const dataTable = new DataTable(
  {
    table: elements.table,
    head: elements.tableHead,
    body: elements.tableBody,
    emptyState: elements.tableEmpty,
    search: elements.tableSearch,
    pageSize: elements.pageSize,
    prev: elements.prevPage,
    next: elements.nextPage,
    pageInfo: elements.pageInfo,
    resultCount: elements.resultCount,
  },
  { onStateChange: updateExportUi },
);

function updateStats(analysis) {
  if (!analysis) {
    elements.statRows.textContent = "—";
    elements.statRowsNote.textContent = "Belum ada dataset";
    elements.statColumns.textContent = "—";
    elements.statColumnsNote.textContent = "Header tidak dihitung sebagai baris";
    elements.statEmpty.textContent = "—";
    elements.statEmptyNote.textContent = "Dihitung dari seluruh sel data";
    elements.statNumeric.textContent = "—";
    elements.statNumericNote.textContent = "Minimal 60% nilai terisi berupa angka";
    return;
  }

  elements.statRows.textContent = formatInteger(analysis.rowCount);
  elements.statRowsNote.textContent = "Header tidak dihitung sebagai baris";
  elements.statColumns.textContent = formatInteger(analysis.columnCount);
  elements.statColumnsNote.textContent = `${formatInteger(analysis.totalCells)} sel data`;
  elements.statEmpty.textContent = formatInteger(analysis.emptyCount);

  const emptyPercentage =
    analysis.totalCells === 0 ? 0 : (analysis.emptyCount / analysis.totalCells) * 100;

  elements.statEmptyNote.textContent = `${formatDecimal(
    emptyPercentage,
    1,
  )}% dari total sel`;
  elements.statNumeric.textContent = formatInteger(analysis.numericColumns.length);
  elements.statNumericNote.textContent = `Dari ${formatInteger(analysis.columnCount)} kolom`;
}

function resetNumericStats(message) {
  elements.statMin.textContent = "—";
  elements.statMax.textContent = "—";
  elements.statMean.textContent = "—";
  elements.statMedian.textContent = "—";
  elements.numericNote.textContent = message;
}

function renderNumericStats(columnIndex) {
  if (!state.dataset || columnIndex === null) {
    resetNumericStats("Pilih kolom numerik untuk melihat statistiknya.");
    return;
  }

  const stats = getNumericStats(state.dataset, columnIndex);
  const profile = state.analysis.profiles[columnIndex];

  if (stats.count === 0) {
    resetNumericStats(`Kolom "${profile.name}" tidak memiliki nilai numerik yang valid.`);
    return;
  }

  elements.statMin.textContent = formatDecimal(stats.min);
  elements.statMax.textContent = formatDecimal(stats.max);
  elements.statMean.textContent = formatDecimal(stats.mean);
  elements.statMedian.textContent = formatDecimal(stats.median);
  elements.numericNote.textContent = `Dihitung dari ${formatInteger(
    stats.count,
  )} nilai numerik pada "${profile.name}". ${formatInteger(
    stats.emptyCount,
  )} sel kosong dan ${formatInteger(
    stats.nonNumericCount,
  )} nilai non-numerik tidak dihitung.`;
}

function populateNumericColumns(analysis) {
  elements.numericColumn.replaceChildren();

  if (!analysis || analysis.numericColumns.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Tidak ada kolom numerik";
    elements.numericColumn.append(option);
    elements.numericColumn.disabled = true;
    resetNumericStats(
      "Tidak ada kolom dengan minimal 60% nilai terisi yang dapat dibaca sebagai angka.",
    );
    return;
  }

  for (const profile of analysis.numericColumns) {
    const option = document.createElement("option");
    option.value = String(profile.index);
    option.textContent = profile.name;
    elements.numericColumn.append(option);
  }

  elements.numericColumn.disabled = false;
  elements.numericColumn.value = String(analysis.numericColumns[0].index);
  renderNumericStats(analysis.numericColumns[0].index);
}

function showChartEmpty(title, subtitle, note) {
  state.chartModel = null;
  elements.chartSvg.setAttribute("hidden", "");
  elements.chartSvg.replaceChildren();
  elements.chartEmpty.hidden = false;
  elements.chartTitle.textContent = title;
  elements.chartSubtitle.textContent = subtitle;
  elements.chartNote.textContent = note;
  elements.chartA11y.textContent = "";
}

function renderChartSelection() {
  if (!state.dataset) {
    showChartEmpty(
      "Belum ada grafik",
      "Impor data untuk membuat visualisasi pertama.",
      "Kolom numerik ditampilkan sebagai histogram; kolom teks sebagai kategori terbanyak.",
    );
    return;
  }

  const columnIndex = Number(elements.chartColumn.value);
  const profile = state.analysis.profiles[columnIndex];

  if (!profile) {
    showChartEmpty(
      "Pilih kolom",
      "Pilih salah satu kolom untuk membuat grafik.",
      "Grafik dihitung langsung dari nilai pada kolom yang dipilih.",
    );
    return;
  }

  const model = buildChartModel(state.dataset, profile);

  if (!model) {
    showChartEmpty(
      `Tidak ada data untuk ${profile.name}`,
      "Kolom ini tidak memiliki nilai yang dapat divisualisasikan.",
      "Nilai kosong tidak dapat membentuk grafik. Pilih kolom lain atau impor dataset berbeda.",
    );
    return;
  }

  state.chartModel = model;
  elements.chartTitle.textContent = model.title;
  elements.chartSubtitle.textContent = model.subtitle;
  elements.chartNote.textContent = model.note;
  elements.chartEmpty.hidden = true;
  elements.chartSvg.removeAttribute("hidden");
  renderChart(elements.chartSvg, model);
  elements.chartA11y.textContent = formatChartSummary(model);
}

function populateChartColumns(analysis) {
  elements.chartColumn.replaceChildren();

  if (!analysis) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Belum ada data";
    elements.chartColumn.append(option);
    elements.chartColumn.disabled = true;
    renderChartSelection();
    return;
  }

  for (const profile of analysis.profiles) {
    const option = document.createElement("option");
    option.value = String(profile.index);
    option.textContent = profile.name;
    elements.chartColumn.append(option);
  }

  elements.chartColumn.disabled = false;
  const firstNumeric = analysis.numericColumns[0] ?? analysis.profiles[0];
  elements.chartColumn.value = String(firstNumeric.index);
  renderChartSelection();
}

function updateFileCard(dataset) {
  elements.sourceBadge.hidden = false;
  elements.sourceBadge.textContent = dataset.isSample ? "Contoh" : "File lokal";
  elements.fileName.textContent = dataset.sourceName;
  elements.fileSubtitle.textContent = dataset.isSample
    ? "Data contoh bawaan DataLens, dimuat dari repository."
    : "File lokal yang diproses di memori browser.";
  elements.fileSize.textContent = formatBytes(dataset.fileSize);
  elements.fileRows.textContent = formatInteger(dataset.rowCount);
  elements.fileColumns.textContent = formatInteger(dataset.columnCount);
  elements.fileDelimiter.textContent = dataset.delimiterLabel;
}

function applyDataset(dataset) {
  const analysis = analyzeDataset(dataset);
  state.dataset = dataset;
  state.analysis = analysis;

  hideError();
  updateFileCard(dataset);
  updateStats(analysis);
  populateNumericColumns(analysis);
  populateChartColumns(analysis);
  dataTable.setDataset(dataset);
  showWarnings(dataset.warnings);
  announce(
    `Dataset ${dataset.sourceName} dimuat: ${formatInteger(
      dataset.rowCount,
    )} baris, ${formatInteger(dataset.columnCount)} kolom, pemisah ${dataset.delimiterLabel}.`,
  );
}

function validateFileMetadata(file) {
  if (!(file instanceof File)) {
    throw new UserFacingError("File tidak ditemukan", "Pilih file CSV dari perangkat Anda.");
  }

  if (file.size === 0) {
    throw new UserFacingError(
      "File kosong",
      "File yang dipilih berukuran 0 byte. Pilih CSV yang memiliki header dan minimal satu baris data.",
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new UserFacingError(
      "File terlalu besar",
      `Ukuran file ${formatBytes(
        file.size,
      )} melebihi batas 10 MB. Pecah dataset menjadi beberapa file lalu impor satu per satu.`,
    );
  }

  const mimeType = String(file.type ?? "").toLowerCase();

  if (mimeType.startsWith("image/") || mimeType.startsWith("audio/") || mimeType.startsWith("video/") || mimeType.startsWith("font/")) {
    throw new UserFacingError(
      "File bukan CSV",
      `File terdeteksi sebagai ${mimeType}. Pilih file teks CSV, TSV, atau TXT.`,
    );
  }

  if (BLOCKED_MIME_TYPES.has(mimeType)) {
    throw new UserFacingError(
      "File bukan CSV",
      `Tipe file ${mimeType} tidak didukung. DataLens hanya membaca CSV berbasis teks.`,
    );
  }
}

async function readUtf8File(file) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  if (bytes.length === 0) {
    throw new UserFacingError("File kosong", "File tidak memiliki isi yang dapat dibaca.");
  }

  const sampleLength = Math.min(bytes.length, 8192);
  let controlCharacters = 0;

  for (let index = 0; index < sampleLength; index += 1) {
    const byte = bytes[index];

    if (byte === 0) {
      throw new UserFacingError(
        "File bukan teks",
        "File mengandung data biner, bukan teks CSV. Pilih file CSV atau TSV yang valid.",
      );
    }

    if (byte < 9 || (byte > 13 && byte < 32)) {
      controlCharacters += 1;
    }
  }

  if (sampleLength > 0 && controlCharacters / sampleLength > 0.02) {
    throw new UserFacingError(
      "File bukan teks",
      "File tampak berisi data biner. DataLens hanya membaca CSV berbasis teks UTF-8.",
    );
  }

  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new UserFacingError(
      "Encoding tidak didukung",
      "File bukan UTF-8 yang valid. Simpan ulang CSV sebagai UTF-8 lalu coba lagi.",
    );
  }

  if (text.replaceAll("\uFEFF", "").trim() === "") {
    throw new UserFacingError(
      "File kosong",
      "File tidak berisi teks yang dapat dibaca. Tambahkan header dan minimal satu baris data.",
    );
  }

  return text;
}

function handleLoadError(error) {
  let title = "Impor gagal";
  let message = "File tidak dapat diproses.";
  let details = [];

  if (error instanceof CsvParseError) {
    title = "Struktur CSV tidak valid";
    message = error.message;
    details = error.details;
  } else if (error instanceof UserFacingError) {
    title = error.title;
    message = error.message;
    details = error.details;
  } else {
    message =
      "Terjadi kesalahan tak terduga saat membaca file. Coba file lain atau muat ulang halaman.";
  }

  if (!state.dataset) {
    dataTable.showEmptyState("File belum berhasil diimpor. Perbaiki CSV lalu coba lagi.");
  }

  showError(title, message, details);
}

async function loadFile(file, { delimiter = selectedDelimiter() } = {}) {
  if (!file || state.busy) {
    return;
  }

  hideError();
  setBusy(true);
  announce("Membaca file CSV secara lokal…");

  try {
    validateFileMetadata(file);
    const text = await readUtf8File(file);
    const parsed = parseCsv(text, { delimiter });

    applyDataset({
      ...parsed,
      sourceName: file.name || "dataset.csv",
      fileSize: file.size,
      isSample: false,
    });
    state.source = { kind: "file", file };
    updateDelimiterUi();
  } catch (error) {
    handleLoadError(error);
  } finally {
    setBusy(false);
    elements.fileInput.value = "";
  }
}

async function loadSample({ delimiter = selectedDelimiter() } = {}) {
  if (state.busy) {
    return;
  }

  hideError();
  setBusy(true);
  announce("Memuat data contoh…");

  try {
    if (window.location.protocol === "file:") {
      throw new UserFacingError(
        "Server HTTP diperlukan",
        "Data contoh dimuat melalui fetch. Jalankan proyek dengan static HTTP server lokal, lalu buka melalui localhost.",
      );
    }

    const response = await fetch("data/sample-data.csv", { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();
    const parsed = parseCsv(text, { delimiter });

    applyDataset({
      ...parsed,
      sourceName: "sample-data.csv",
      fileSize: new TextEncoder().encode(text).byteLength,
      isSample: true,
    });
    state.source = { kind: "sample" };
    updateDelimiterUi();
  } catch (error) {
    if (error instanceof UserFacingError || error instanceof CsvParseError) {
      handleLoadError(error);
    } else {
      handleLoadError(
        new UserFacingError(
          "Data contoh gagal dimuat",
          "Pastikan proyek dijalankan melalui static HTTP server lokal dan file data/sample-data.csv tersedia.",
        ),
      );
    }
  } finally {
    setBusy(false);
  }
}

function reparseActiveDataset() {
  if (!state.source || state.busy) {
    return;
  }

  if (state.source.kind === "file") {
    loadFile(state.source.file, { delimiter: selectedDelimiter() });
    return;
  }

  loadSample({ delimiter: selectedDelimiter() });
}

function exportCurrentRows() {
  if (!state.dataset) {
    return;
  }

  dataTable.flushSearch();
  const exportState = dataTable.getExportState();

  if (exportState.count === 0) {
    announce("Tidak ada baris yang dapat diekspor.");
    return;
  }

  const csv = buildCsv(state.dataset.headers, exportState.rows);
  const fileName = makeExportFilename(state.dataset.sourceName, {
    filtered: exportState.isFiltered,
    rowCount: exportState.count,
  });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const downloadLink = document.createElement("a");

  downloadLink.href = objectUrl;
  downloadLink.download = fileName;
  downloadLink.rel = "noopener";
  document.body.append(downloadLink);
  downloadLink.click();
  downloadLink.remove();

  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);

  announce(
    `CSV ${exportState.isFiltered ? "hasil filter" : "seluruh dataset"} dengan ${formatInteger(
      exportState.count,
    )} baris sedang diunduh sebagai ${fileName}.`,
  );
}

function setupDragAndDrop() {
  let dragDepth = 0;

  elements.dropzone.addEventListener("dragenter", (event) => {
    event.preventDefault();
    dragDepth += 1;
    elements.dropzone.classList.add("is-dragging");
  });

  elements.dropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy";
    }
  });

  elements.dropzone.addEventListener("dragleave", (event) => {
    event.preventDefault();
    dragDepth = Math.max(0, dragDepth - 1);

    if (dragDepth === 0) {
      elements.dropzone.classList.remove("is-dragging");
    }
  });

  elements.dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    dragDepth = 0;
    elements.dropzone.classList.remove("is-dragging");
    const files = event.dataTransfer?.files;

    if (!files || files.length === 0) {
      showError("Tidak ada file", "Letakkan satu file CSV ke area impor.");
      return;
    }

    loadFile(files[0]);
  });
}

function setupNavigation() {
  const links = [...document.querySelectorAll(".site-nav a")];
  const sections = links
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);
  let frame = 0;

  const updateActiveLink = () => {
    frame = 0;
    const marker = window.scrollY + 150;
    let activeId = sections[0]?.id;

    for (const section of sections) {
      if (section.offsetTop <= marker) {
        activeId = section.id;
      }
    }

    for (const link of links) {
      const isActive = link.getAttribute("href") === `#${activeId}`;
      link.classList.toggle("is-active", isActive);

      if (isActive) {
        link.setAttribute("aria-current", "location");
      } else {
        link.removeAttribute("aria-current");
      }
    }
  };

  window.addEventListener(
    "scroll",
    () => {
      if (frame === 0) {
        frame = window.requestAnimationFrame(updateActiveLink);
      }
    },
    { passive: true },
  );

  window.addEventListener("resize", updateActiveLink, { passive: true });
  updateActiveLink();
}

function setupChartResize() {
  if (typeof ResizeObserver === "undefined") {
    return;
  }

  const observer = new ResizeObserver(() => {
    if (!state.chartModel || elements.chartSvg.hasAttribute("hidden")) {
      return;
    }

    window.cancelAnimationFrame(chartResizeFrame);
    chartResizeFrame = window.requestAnimationFrame(() => {
      renderChart(elements.chartSvg, state.chartModel);
    });
  });

  observer.observe(elements.chartStage);
}

function setupEvents() {
  elements.chooseFile.addEventListener("click", () => elements.fileInput.click());

  elements.fileInput.addEventListener("change", () => {
    const file = elements.fileInput.files?.[0];

    if (file) {
      loadFile(file);
    }
  });

  elements.loadSample.addEventListener("click", loadSample);
  elements.delimiterSelect.addEventListener("change", updateDelimiterUi);
  elements.reparseActive.addEventListener("click", reparseActiveDataset);
  elements.errorClose.addEventListener("click", hideError);
  elements.warningClose.addEventListener("click", hideWarnings);

  elements.numericColumn.addEventListener("change", () => {
    if (elements.numericColumn.value === "") {
      resetNumericStats("Pilih kolom numerik untuk melihat statistiknya.");
      return;
    }

    renderNumericStats(Number(elements.numericColumn.value));
  });

  elements.chartColumn.addEventListener("change", renderChartSelection);
  elements.exportButton.addEventListener("click", exportCurrentRows);

  setupDragAndDrop();
  setupNavigation();
  setupChartResize();
}

function initialize() {
  updateStats(null);
  resetNumericStats("Impor data untuk melihat statistik kolom numerik.");
  setupEvents();
  updateDelimiterUi();
  announce("DataLens siap. Impor CSV atau muat data contoh untuk mulai.");
}

initialize();
