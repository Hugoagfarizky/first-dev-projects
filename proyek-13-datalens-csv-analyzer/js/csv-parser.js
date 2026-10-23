export const MAX_FILE_SIZE = 10 * 1024 * 1024;

const DELIMITER_LABELS = new Map([
  [",", "Koma (,)"],
  [";", "Titik koma (;)"],
  ["\t", "Tab"],
]);

const DELIMITER_CANDIDATES = [",", ";", "\t"];
const DELIMITER_SAMPLE_LENGTH = 131072;
const DELIMITER_SAMPLE_RECORDS = 30;
const AMBIGUITY_CONSISTENCY_TOLERANCE = 0.02;

export class CsvParseError extends Error {
  constructor(code, message, details = []) {
    super(message);
    this.name = "CsvParseError";
    this.code = code;
    this.details = details;
  }
}

export function delimiterLabel(delimiter) {
  return DELIMITER_LABELS.get(delimiter) ?? "Tidak diketahui";
}

export function isSupportedDelimiter(delimiter) {
  return DELIMITER_CANDIDATES.includes(delimiter);
}

export function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function isBlankRecord(record) {
  return record.values.every((value) => String(value ?? "").trim() === "");
}

function describeCharacter(character) {
  const codePoint = character.codePointAt(0) ?? 0;
  const hex = codePoint.toString(16).toUpperCase().padStart(4, "0");

  if (character === " ") {
    return `spasi (U+${hex})`;
  }

  if (character === "\t") {
    return `tab (U+${hex})`;
  }

  return `"${character}" (U+${hex})`;
}

function scanRows(text, delimiter, { maxRecords = Infinity } = {}) {
  const records = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let afterClosingQuote = false;
  let line = 1;
  let column = 1;
  let recordLine = 1;
  let index = 0;

  const pushRow = () => {
    row.push(field);
    records.push({ values: row, line: recordLine });
    row = [];
    field = "";
    afterClosingQuote = false;
    recordLine = line;
  };

  const finishRecord = (newlineLength) => {
    line += 1;
    pushRow();
    column = 1;
    index += newlineLength;
  };

  while (index < text.length) {
    const character = text[index];

    if (inQuotes) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 2;
          column += 2;
          continue;
        }

        inQuotes = false;
        afterClosingQuote = true;
        index += 1;
        column += 1;
        continue;
      }

      if (character === "\r") {
        field += "\n";
        line += 1;
        column = 1;
        index += text[index + 1] === "\n" ? 2 : 1;
        continue;
      }

      if (character === "\n") {
        field += "\n";
        line += 1;
        column = 1;
        index += 1;
        continue;
      }

      field += character;
      index += 1;
      column += 1;
      continue;
    }

    if (afterClosingQuote) {
      if (character === delimiter) {
        row.push(field);
        field = "";
        afterClosingQuote = false;
        index += 1;
        column += 1;
        continue;
      }

      if (character === "\r" || character === "\n") {
        const newlineLength = character === "\r" && text[index + 1] === "\n" ? 2 : 1;
        finishRecord(newlineLength);

        if (records.length >= maxRecords) {
          return { records, unclosedQuote: false, unclosedQuoteLine: null, truncated: true };
        }

        continue;
      }

      // Kebijakan parser: spasi dan tab horizontal tepat setelah kutip penutup
      // dianggap bagian sintaks, bukan isi field, lalu diabaikan.
      if (character === " " || character === "\t") {
        index += 1;
        column += 1;
        continue;
      }

      throw new CsvParseError(
        "INVALID_CHARACTER_AFTER_QUOTE",
        `Karakter ${describeCharacter(character)} setelah kutip penutup tidak valid pada baris ${line}, kolom ${column}. Setelah kutip penutup hanya boleh ada delimiter, akhir baris, akhir file, atau spasi/tab horizontal.`,
        [`Baris ${line}, kolom ${column}: karakter ${describeCharacter(character)} tidak diizinkan setelah kutip penutup.`],
      );
    }

    if (character === '"' && field.length === 0) {
      inQuotes = true;
      index += 1;
      column += 1;
      continue;
    }

    if (character === delimiter) {
      row.push(field);
      field = "";
      index += 1;
      column += 1;
      continue;
    }

    if (character === "\r" || character === "\n") {
      const newlineLength = character === "\r" && text[index + 1] === "\n" ? 2 : 1;
      finishRecord(newlineLength);

      if (records.length >= maxRecords) {
        return { records, unclosedQuote: false, unclosedQuoteLine: null, truncated: true };
      }

      continue;
    }

    if (character === '"') {
      if (text[index + 1] === '"') {
        field += '"';
        index += 2;
        column += 2;
        continue;
      }

      field += '"';
      index += 1;
      column += 1;
      continue;
    }

    field += character;
    index += 1;
    column += 1;
  }

  if (field.length > 0 || row.length > 0 || afterClosingQuote) {
    pushRow();
  }

  return {
    records,
    unclosedQuote: inQuotes,
    unclosedQuoteLine: inQuotes ? recordLine : null,
    truncated: false,
  };
}

function delimiterStatistics(text, delimiter) {
  const sample = text.slice(0, DELIMITER_SAMPLE_LENGTH);
  let result;

  try {
    result = scanRows(sample, delimiter, { maxRecords: DELIMITER_SAMPLE_RECORDS });
  } catch {
    return {
      delimiter,
      label: delimiterLabel(delimiter),
      valid: false,
      columns: 0,
      consistency: 0,
      recordCount: 0,
      score: -1,
    };
  }

  let records = result.records.filter((record) => !isBlankRecord(record));

  // Sampel dapat berhenti di tengah record berpetik. Record terakhir yang
  // belum tertutup tidak dipakai untuk menilai konsistensi delimiter.
  if (result.unclosedQuote && records.length > 0) {
    records = records.slice(0, -1);
  }

  const counts = records.map((record) => record.values.length);

  if (counts.length === 0) {
    return {
      delimiter,
      label: delimiterLabel(delimiter),
      valid: false,
      columns: 0,
      consistency: 0,
      recordCount: 0,
      score: -1,
    };
  }

  const frequencies = new Map();
  for (const count of counts) {
    frequencies.set(count, (frequencies.get(count) ?? 0) + 1);
  }

  let modeCount = 0;
  let modeFrequency = 0;
  for (const [count, frequency] of frequencies) {
    if (frequency > modeFrequency || (frequency === modeFrequency && count > modeCount)) {
      modeCount = count;
      modeFrequency = frequency;
    }
  }

  if (modeCount < 2) {
    return {
      delimiter,
      label: delimiterLabel(delimiter),
      valid: false,
      columns: modeCount,
      consistency: modeFrequency / counts.length,
      recordCount: counts.length,
      score: 0,
    };
  }

  const consistency = modeFrequency / counts.length;

  return {
    delimiter,
    label: delimiterLabel(delimiter),
    valid: true,
    columns: modeCount,
    consistency,
    recordCount: counts.length,
    score: consistency * 1000000 + modeCount * 1000 + modeFrequency,
  };
}

export function detectDelimiterInfo(text) {
  const candidates = DELIMITER_CANDIDATES.map((delimiter) => delimiterStatistics(text, delimiter));
  const viable = candidates
    .filter((candidate) => candidate.valid)
    .sort(
      (a, b) =>
        b.consistency - a.consistency ||
        b.columns - a.columns ||
        b.recordCount - a.recordCount ||
        b.score - a.score ||
        DELIMITER_CANDIDATES.indexOf(a.delimiter) - DELIMITER_CANDIDATES.indexOf(b.delimiter),
    );

  if (viable.length === 0) {
    return {
      delimiter: ",",
      label: delimiterLabel(","),
      ambiguous: false,
      candidates,
      closeCandidates: [],
    };
  }

  const best = viable[0];
  const closeCandidates = viable.filter(
    (candidate) =>
      candidate !== best &&
      candidate.consistency >= best.consistency - AMBIGUITY_CONSISTENCY_TOLERANCE,
  );

  return {
    delimiter: best.delimiter,
    label: best.label,
    ambiguous: closeCandidates.length > 0,
    candidates,
    closeCandidates,
  };
}

export function detectDelimiter(text) {
  return detectDelimiterInfo(text).delimiter;
}

function makeUniqueHeader(baseHeader, usedHeaders) {
  if (!usedHeaders.has(baseHeader)) {
    return baseHeader;
  }

  let suffix = 2;
  while (usedHeaders.has(`${baseHeader} (${suffix})`)) {
    suffix += 1;
  }

  return `${baseHeader} (${suffix})`;
}

function normalizeHeaders(rawHeaders) {
  const warnings = [];
  const usedHeaders = new Set();
  const headers = [];

  rawHeaders.forEach((rawHeader, index) => {
    const trimmedHeader = String(rawHeader ?? "").trim();
    const wasEmpty = trimmedHeader === "";
    const baseHeader = wasEmpty ? `Kolom ${index + 1}` : trimmedHeader;
    const normalizedHeader = makeUniqueHeader(baseHeader, usedHeaders);

    usedHeaders.add(normalizedHeader);
    headers.push(normalizedHeader);

    if (wasEmpty) {
      if (normalizedHeader === baseHeader) {
        warnings.push(`Header kolom ${index + 1} kosong dan diberi nama "${normalizedHeader}".`);
      } else {
        warnings.push(
          `Header kolom ${index + 1} kosong; nama "${baseHeader}" sudah dipakai sehingga kolom diberi nama "${normalizedHeader}".`,
        );
      }
      return;
    }

    if (normalizedHeader !== baseHeader) {
      warnings.push(
        `Header "${baseHeader}" duplikat atau bentrok dengan nama hasil normalisasi; kolom ${index + 1} diberi nama "${normalizedHeader}".`,
      );
    }
  });

  return { headers, warnings };
}

function buildDelimiterWarning(detection) {
  const alternatives = [detection.label, ...detection.closeCandidates.map((candidate) => candidate.label)];
  const labels = alternatives.join(" dan ");
  return `Deteksi pemisah ambigu: ${labels} sama-sama menghasilkan struktur yang konsisten. DataLens memilih ${detection.label}. Jika hasilnya tidak sesuai, pilih pemisah secara manual lalu terapkan ulang.`;
}

export function parseCsv(text, { delimiter: forcedDelimiter } = {}) {
  if (typeof text !== "string") {
    throw new CsvParseError("INVALID_INPUT", "Isi CSV harus berupa teks.");
  }

  if (forcedDelimiter !== undefined && !isSupportedDelimiter(forcedDelimiter)) {
    throw new CsvParseError(
      "INVALID_DELIMITER",
      "Pemisah yang dipilih tidak didukung. Gunakan koma, titik koma, atau tab.",
    );
  }

  const cleanedText = stripBom(text);

  if (cleanedText.trim() === "") {
    throw new CsvParseError("EMPTY_FILE", "File CSV kosong. Tambahkan header dan minimal satu baris data.");
  }

  const detection = forcedDelimiter === undefined ? detectDelimiterInfo(cleanedText) : null;
  const delimiter = forcedDelimiter ?? detection.delimiter;
  const scan = scanRows(cleanedText, delimiter);

  if (scan.unclosedQuote) {
    throw new CsvParseError(
      "UNCLOSED_QUOTE",
      `Tanda kutip pada baris sekitar ${scan.unclosedQuoteLine ?? 1} tidak ditutup. Periksa field yang berisi tanda kutip.`,
    );
  }

  const records = scan.records.filter((record) => !isBlankRecord(record));

  if (records.length === 0) {
    throw new CsvParseError("EMPTY_FILE", "File CSV tidak memiliki header atau baris data yang dapat dibaca.");
  }

  const headerRecord = records[0];
  const { headers, warnings } = normalizeHeaders(headerRecord.values);

  if (detection?.ambiguous) {
    warnings.unshift(buildDelimiterWarning(detection));
  }

  if (headers.length < 2) {
    throw new CsvParseError(
      "ONE_COLUMN",
      "CSV hanya memiliki satu kolom. DataLens memerlukan minimal dua kolom agar dapat dianalisis.",
    );
  }

  const bodyRecords = records.slice(1);

  if (bodyRecords.length === 0) {
    throw new CsvParseError("NO_DATA_ROWS", "CSV hanya berisi header. Tambahkan minimal satu baris data.");
  }

  const mismatches = [];
  for (const record of bodyRecords) {
    if (record.values.length !== headers.length) {
      mismatches.push({
        line: record.line,
        expected: headers.length,
        actual: record.values.length,
      });
    }
  }

  if (mismatches.length > 0) {
    const preview = mismatches.slice(0, 5).map(
      (mismatch) => `Baris ${mismatch.line}: ${mismatch.actual} kolom (seharusnya ${mismatch.expected}).`,
    );

    if (mismatches.length > preview.length) {
      preview.push(`Dan ${mismatches.length - preview.length} baris lain dengan masalah serupa.`);
    }

    throw new CsvParseError(
      "ROW_LENGTH_MISMATCH",
      `Struktur CSV tidak konsisten pada ${mismatches.length} baris. Perbaiki jumlah kolom atau tanda kutip sebelum mengimpor.`,
      preview,
    );
  }

  return {
    headers,
    rows: bodyRecords.map((record) => record.values),
    delimiter,
    delimiterLabel: delimiterLabel(delimiter),
    delimiterSource: forcedDelimiter === undefined ? "auto" : "manual",
    delimiterAmbiguous: Boolean(detection?.ambiguous),
    warnings,
    rowCount: bodyRecords.length,
    columnCount: headers.length,
  };
}
