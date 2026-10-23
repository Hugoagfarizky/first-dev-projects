import test from "node:test";
import assert from "node:assert/strict";

import {
  CsvParseError,
  delimiterLabel,
  detectDelimiter,
  detectDelimiterInfo,
  isSupportedDelimiter,
  parseCsv,
} from "../js/csv-parser.js";

function assertCsvError(callback, expectedCode) {
  assert.throws(callback, (error) => {
    assert.ok(error instanceof CsvParseError);
    assert.equal(error.code, expectedCode);
    return true;
  });
}

test("H-1: karakter non-whitespace setelah kutip penutup ditolak", () => {
  assertCsvError(() => parseCsv('a,b\n1,"x"y\n'), "INVALID_CHARACTER_AFTER_QUOTE");
  assertCsvError(() => parseCsv('a,b\n"a"b"c",ok\n1,2\n'), "INVALID_CHARACTER_AFTER_QUOTE");
  assertCsvError(() => parseCsv('a,b\n1,"x"  y\n'), "INVALID_CHARACTER_AFTER_QUOTE");
});

test("H-1: error menyebut baris dan kolom karakter ilegal", () => {
  try {
    parseCsv('a,b\n1,"x"y\n');
    assert.fail("Parser seharusnya menolak karakter setelah kutip penutup.");
  } catch (error) {
    assert.ok(error instanceof CsvParseError);
    assert.equal(error.code, "INVALID_CHARACTER_AFTER_QUOTE");
    assert.match(error.message, /baris 2, kolom 6/i);
    assert.equal(error.details.length, 1);
    assert.match(error.details[0], /baris 2, kolom 6/i);
  }
});

test("H-1: header dengan karakter ilegal setelah kutip juga ditolak", () => {
  assertCsvError(() => parseCsv('"a"x,b\n1,2\n'), "INVALID_CHARACTER_AFTER_QUOTE");
});

test("H-1: sintaks CSV berpetik yang valid tetap didukung", () => {
  const parsed = parseCsv(
    'id,text\n1,"a,b"\n2,"say ""hi"""\n3,"line1\nline2"\n4,"space"  \n5,"tab"\t\n',
  );

  assert.deepEqual(parsed.headers, ["id", "text"]);
  assert.deepEqual(parsed.rows, [
    ["1", "a,b"],
    ["2", 'say "hi"'],
    ["3", "line1\nline2"],
    ["4", "space"],
    ["5", "tab"],
  ]);
  assert.equal(parsed.rowCount, 5);
});

test("H-1: spasi dan tab horizontal setelah kutip penutup diabaikan sebagai sintaks", () => {
  const parsed = parseCsv('a,b,c\n1,"x"  ,2\n3,"y"\t,4\n');
  assert.deepEqual(parsed.rows, [
    ["1", "x", "2"],
    ["3", "y", "4"],
  ]);
});

test("M-2: record yang seluruh field-nya kosong dilewati sebelum header dan di tengah data", () => {
  const parsed = parseCsv(',,\r\nname,score\r\nA,1\r\n,,\r\nB,2\r\n,,\r\n');

  assert.deepEqual(parsed.headers, ["name", "score"]);
  assert.deepEqual(parsed.rows, [
    ["A", "1"],
    ["B", "2"],
  ]);
  assert.equal(parsed.rowCount, 2);
});

test("M-2: field kosong berpetik dianggap record kosong dan field sebagian tetap dipertahankan", () => {
  const parsed = parseCsv(
    'name,score,note\nA,1,ok\n"","",""\nB,2,\n"","",\t\nC,3,ok\n',
  );

  assert.deepEqual(parsed.rows, [
    ["A", "1", "ok"],
    ["B", "2", ""],
    ["C", "3", "ok"],
  ]);
  assert.equal(parsed.rowCount, 3);
});

test("M-2: header saja dengan record kosong berdelimiter ditolak sebagai tanpa data", () => {
  assertCsvError(() => parseCsv('name,score\n,,\n'), "NO_DATA_ROWS");
});

test("M-2: file yang hanya berisi record kosong ditolak", () => {
  assertCsvError(() => parseCsv(',,\n,,\n'), "EMPTY_FILE");
  assertCsvError(() => parseCsv('"",""\n"",""\n'), "EMPTY_FILE");
});

test("M-2: baris data dengan sebagian sel kosong tidak dibuang", () => {
  const parsed = parseCsv("name,score\nA,\nB,2\n");
  assert.deepEqual(parsed.rows, [
    ["A", ""],
    ["B", "2"],
  ]);
});

test("M-3: header a,a menghasilkan nama unik", () => {
  const parsed = parseCsv("a,a\n1,2\n");
  assert.deepEqual(parsed.headers, ["a", "a (2)"]);
  assert.equal(parsed.warnings.length, 1);
  assert.match(parsed.warnings[0], /duplikat|bentrok/i);
});

test("M-3: header a,a,a (2) tidak menghasilkan duplikat", () => {
  const parsed = parseCsv("a,a,a (2)\n1,2,3\n");
  assert.deepEqual(parsed.headers, ["a", "a (2)", "a (2) (2)"]);
  assert.equal(new Set(parsed.headers).size, parsed.headers.length);
  assert.equal(parsed.warnings.length, 2);
});

test("M-3: benturan dengan kandidat suffix yang muncul kemudian ditangani", () => {
  const parsed = parseCsv("a,a (2),a,a (3)\n1,2,3,4\n");
  assert.deepEqual(parsed.headers, ["a", "a (2)", "a (3)", "a (3) (2)"]);
  assert.equal(new Set(parsed.headers).size, 4);
  assert.equal(parsed.warnings.length, 2);
});

test("M-3: header kosong diberi nama dan tetap unik", () => {
  const parsed = parseCsv(",b,Kolom 1\n1,2,3\n");
  assert.deepEqual(parsed.headers, ["Kolom 1", "b", "Kolom 1 (2)"]);
  assert.equal(new Set(parsed.headers).size, 3);
  assert.match(parsed.warnings[0], /kosong/i);
  assert.match(parsed.warnings[1], /bentrok|duplikat/i);
});

test("M-3: spasi header dinormalisasi dan duplikat diberi warning tanpa mengubah data", () => {
  const parsed = parseCsv(" a , a ,a\n1,2,3\n");
  assert.deepEqual(parsed.headers, ["a", "a (2)", "a (3)"]);
  assert.deepEqual(parsed.rows, [["1", "2", "3"]]);
  assert.equal(parsed.warnings.length, 2);
});

test("L-3: autodeteksi menandai delimiter yang sama-sama konsisten sebagai ambigu", () => {
  const ambiguous = "name,id;note,ok\nA,1;B,2\nC,3;D,4\n";
  const info = detectDelimiterInfo(ambiguous);

  assert.equal(info.delimiter, ",");
  assert.equal(info.ambiguous, true);
  assert.ok(info.closeCandidates.some((candidate) => candidate.delimiter === ";"));

  const parsed = parseCsv(ambiguous);
  assert.deepEqual(parsed.headers, ["name", "id;note", "ok"]);
  assert.equal(parsed.delimiterAmbiguous, true);
  assert.ok(parsed.warnings.some((warning) => /ambigu/i.test(warning)));
});

test("L-3: pemisah titik koma manual menghasilkan dua kolom yang benar", () => {
  const ambiguous = "name,id;note,ok\nA,1;B,2\nC,3;D,4\n";
  const parsed = parseCsv(ambiguous, { delimiter: ";" });

  assert.deepEqual(parsed.headers, ["name,id", "note,ok"]);
  assert.deepEqual(parsed.rows, [
    ["A,1", "B,2"],
    ["C,3", "D,4"],
  ]);
  assert.equal(parsed.columnCount, 2);
  assert.equal(parsed.delimiter, ";");
  assert.equal(parsed.delimiterSource, "manual");
  assert.equal(parsed.delimiterAmbiguous, false);
  assert.deepEqual(parsed.warnings, []);
});

test("L-3: konsistensi jumlah field diprioritaskan di atas jumlah kolom terbesar", () => {
  const mixed =
    "name,alias;score\nA,1,2;10\nB,1,2;20\nC,1,2;30\nD;40\nE;50\n";
  const info = detectDelimiterInfo(mixed);

  assert.equal(detectDelimiter(mixed), ";");
  assert.equal(info.ambiguous, false);
  assert.equal(info.delimiter, ";");

  const parsed = parseCsv(mixed, { delimiter: ";" });
  assert.deepEqual(parsed.headers, ["name,alias", "score"]);
  assert.equal(parsed.rowCount, 5);
  assert.deepEqual(parsed.rows[0], ["A,1,2", "10"]);
});

test("L-3: delimiter yang tidak didukung ditolak", () => {
  assertCsvError(() => parseCsv("a,b\n1,2\n", { delimiter: "|" }), "INVALID_DELIMITER");
  assert.equal(isSupportedDelimiter(","), true);
  assert.equal(isSupportedDelimiter("|"), false);
  assert.equal(delimiterLabel("\t"), "Tab");
});
