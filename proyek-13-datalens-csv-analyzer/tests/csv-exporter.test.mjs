import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCsv,
  escapeCsvField,
  needsFormulaProtection,
  sanitizeSpreadsheetCell,
} from "../js/csv-exporter.js";

test("L-1: prefiks formula setelah whitespace dan karakter tak terlihat dilindungi", () => {
  const dangerous = [
    "=1+1",
    "+SUM(A1:A2)",
    "-2+3",
    "-SUM(A1:A2)",
    "@cmd",
    "  =1+1",
    "\t@cmd",
    "\u0000=1+1",
    "\u0001@cmd",
    "\u001f-SUM(A1:A2)",
    "\u200b+SUM(A1:A2)",
    "\ufeff=1+1",
    "\u0085@cmd",
  ];

  for (const value of dangerous) {
    assert.equal(needsFormulaProtection(value), true, `Harus dilindungi: ${JSON.stringify(value)}`);
    assert.equal(sanitizeSpreadsheetCell(value), `'${value}`);
  }
});

test("L-1: angka negatif valid tidak diubah menjadi teks", () => {
  for (const value of ["-5", "-1.2", "-1e3", "  -5", "\t-1.2"]) {
    assert.equal(needsFormulaProtection(value), false, `Tidak boleh dilindungi: ${JSON.stringify(value)}`);
    assert.equal(sanitizeSpreadsheetCell(value), value);
  }
});

test("L-1: teks aman dan apostrof yang sudah ada tidak diubah", () => {
  assert.equal(needsFormulaProtection("safe"), false);
  assert.equal(needsFormulaProtection("'=1+1"), false);
  assert.equal(sanitizeSpreadsheetCell("safe"), "safe");
  assert.equal(sanitizeSpreadsheetCell("\u0000safe"), "\u0000safe");
});

test("L-1: string CSV mentah memakai apostrof, escaping, BOM, dan CRLF yang benar", () => {
  const csv = buildCsv(
    ["label"],
    [
      ["\u0000=1+1"],
      ["\u0001@cmd"],
      ["\u001f-SUM(A1:A2)"],
      ["\u200b+SUM(A1:A2)"],
      ["\ufeff=1+1"],
      ["-5"],
      ["-1.2"],
      ["-1e3"],
      ["a,b"],
      ['quote "inside"'],
      ["line1\nline2"],
    ],
  );

  const expected =
    "\uFEFFlabel\r\n" +
    "'\u0000=1+1\r\n" +
    "'\u0001@cmd\r\n" +
    "'\u001f-SUM(A1:A2)\r\n" +
    "'\u200b+SUM(A1:A2)\r\n" +
    "'\uFEFF=1+1\r\n" +
    "-5\r\n" +
    "-1.2\r\n" +
    "-1e3\r\n" +
    '"a,b"\r\n' +
    '"quote ""inside"""\r\n' +
    '"line1\nline2"\r\n';

  assert.equal(csv, expected);
});

test("L-1: header berisiko juga dilindungi dan escaping field tetap benar", () => {
  assert.equal(buildCsv(["=header"], [["safe"]]), "\uFEFF'=header\r\nsafe\r\n");
  assert.equal(escapeCsvField('a"b'), '"a""b"');
  assert.equal(escapeCsvField("a,b"), '"a,b"');
  assert.equal(escapeCsvField("a\nb"), '"a\nb"');
});
