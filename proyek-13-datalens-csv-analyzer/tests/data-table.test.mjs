import test from "node:test";
import assert from "node:assert/strict";

import { compareCellValues, compareEntries } from "../js/data-table.js";

function entriesFrom(values) {
  return values.map((value, index) => ({ row: [value, `row-${index}`], index }));
}

function sortedValues(values, direction) {
  return entriesFrom(values)
    .sort(
      (a, b) =>
        compareEntries(a, b, 0, direction) || a.index - b.index,
    )
    .map((entry) => entry.row[0]);
}

test("M-1: urutan naik menempatkan angka lebih dahulu, teks sesudahnya, kosong di akhir", () => {
  const values = [10, "2a", "1e2", ""];
  assert.deepEqual(sortedValues(values, 1), [10, "1e2", "2a", ""]);
});

test("M-1: urutan turun membalik urutan nonkosong dan tetap menempatkan kosong di akhir", () => {
  const values = [10, "2a", "1e2", ""];
  assert.deepEqual(sortedValues(values, -1), ["2a", "1e2", 10, ""]);
});

test("M-1: sel kosong dan whitespace selalu di akhir pada kedua arah", () => {
  const values = ["   ", "b", "a", "\t", 2, 10];

  assert.deepEqual(sortedValues(values, 1), [2, 10, "a", "b", "   ", "\t"]);
  assert.deepEqual(sortedValues(values, -1), ["b", "a", 10, 2, "   ", "\t"]);
});

test("M-1: klasifikasi angka tegas dan tidak mengubah teks seperti 2a", () => {
  assert.equal(compareCellValues(10, "2a") < 0, true);
  assert.equal(compareCellValues("2a", 10) > 0, true);
  assert.equal(compareCellValues("1e2", 10) > 0, true);
  assert.equal(compareCellValues("2a", "2a"), 0);
  assert.equal(compareCellValues("10", "10"), 0);
});

test("M-1: comparator konsisten dan transitif untuk campuran angka, teks, dan kosong", () => {
  const entries = entriesFrom(["10", "2a", "1e2", "", "-5", "abc", "2", "  "]);

  for (const a of entries) {
    assert.equal(compareEntries(a, a, 0, 1), 0);
    assert.equal(Math.sign(compareEntries(a, a, 0, -1)), 0);

    for (const b of entries) {
      const forward = Math.sign(compareEntries(a, b, 0, 1));
      const reverse = Math.sign(compareEntries(b, a, 0, 1));
      assert.equal(forward, reverse === 0 ? 0 : -reverse);
    }
  }

  for (const a of entries) {
    for (const b of entries) {
      for (const c of entries) {
        if (compareEntries(a, b, 0, 1) <= 0 && compareEntries(b, c, 0, 1) <= 0) {
          assert.ok(
            compareEntries(a, c, 0, 1) <= 0,
            "Comparator naik tidak transitif",
          );
        }

        if (compareEntries(a, b, 0, -1) <= 0 && compareEntries(b, c, 0, -1) <= 0) {
          assert.ok(
            compareEntries(a, c, 0, -1) <= 0,
            "Comparator turun tidak transitif",
          );
        }
      }
    }
  }
});
