import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  DESCRIPTION_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  isValidDateKey,
  isValidTaskId,
  validateCreateTask,
  validateListQuery,
  validateUpdateTask,
} from "../server/utils/validation.js";

test("create memvalidasi judul, menormalkan spasi, dan memberi nilai default", () => {
  const result = validateCreateTask({
    title: "  Belajar   REST   API  ",
    description: "  Latihan endpoint dan database.  ",
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.title, "Belajar REST API");
  assert.equal(result.value.description, "Latihan endpoint dan database.");
  assert.equal(result.value.status, "todo");
  assert.equal(result.value.priority, "medium");
  assert.equal(result.value.due_date, null);
});

test("create menolak judul kosong, hanya spasi, dan judul terlalu panjang", () => {
  for (const title of ["", "   ", "\n\t"]) {
    const result = validateCreateTask({ title });
    assert.equal(result.ok, false);
    assert.ok(result.details.some((detail) => detail.field === "title"));
  }

  const tooLong = validateCreateTask({ title: "a".repeat(TITLE_MAX_LENGTH + 1) });
  assert.equal(tooLong.ok, false);
  assert.match(
    tooLong.details.find((detail) => detail.field === "title").message,
    /maksimal/i,
  );
});

test("create menolak deskripsi bukan teks atau melebihi batas", () => {
  const wrongType = validateCreateTask({ title: "Valid", description: 42 });
  assert.equal(wrongType.ok, false);
  assert.ok(wrongType.details.some((detail) => detail.field === "description"));

  const tooLong = validateCreateTask({
    title: "Valid",
    description: "d".repeat(DESCRIPTION_MAX_LENGTH + 1),
  });
  assert.equal(tooLong.ok, false);
  assert.ok(tooLong.details.some((detail) => detail.field === "description"));
});

test("create menolak status dan prioritas di luar daftar", () => {
  const result = validateCreateTask({
    title: "Tugas",
    status: "archived",
    priority: "urgent",
  });

  assert.equal(result.ok, false);
  assert.deepEqual(
    result.details.map((detail) => detail.field).sort(),
    ["priority", "status"],
  );
});

test("validasi tanggal memeriksa kalender, bukan hanya pola", () => {
  assert.equal(isValidDateKey("2024-02-29"), true);
  assert.equal(isValidDateKey("2026-10-21"), true);
  assert.equal(isValidDateKey("2025-02-29"), false);
  assert.equal(isValidDateKey("2026-04-31"), false);
  assert.equal(isValidDateKey("2026-13-01"), false);
  assert.equal(isValidDateKey("2026-1-01"), false);
  assert.equal(isValidDateKey("1899-12-31"), false);
  assert.equal(isValidDateKey("2201-01-01"), false);

  const result = validateCreateTask({ title: "Tugas", due_date: "2026-02-30" });
  assert.equal(result.ok, false);
  assert.ok(result.details.some((detail) => detail.field === "due_date"));
});

test("create menolak field yang tidak dikenal", () => {
  const result = validateCreateTask({
    title: "Valid",
    id: randomUUID(),
    created_at: "2020-01-01T00:00:00.000Z",
  });

  assert.equal(result.ok, false);
  assert.deepEqual(
    result.details.map((detail) => detail.field).sort(),
    ["created_at", "id"],
  );
});

test("update kosong ditolak dan update parsial hanya mengembalikan field yang dikirim", () => {
  const empty = validateUpdateTask({});
  assert.equal(empty.ok, false);
  assert.ok(empty.details.some((detail) => detail.field === "body"));

  const partial = validateUpdateTask({
    title: "  Judul baru ",
    due_date: null,
  });
  assert.equal(partial.ok, true);
  assert.deepEqual(partial.value, { title: "Judul baru", due_date: null });
});

test("update menolak field tidak dikenal dan nilai tidak valid", () => {
  const unknown = validateUpdateTask({ title: "Valid", owner: "someone" });
  assert.equal(unknown.ok, false);
  assert.ok(unknown.details.some((detail) => detail.field === "owner"));

  const invalid = validateUpdateTask({ status: "blocked", priority: "critical" });
  assert.equal(invalid.ok, false);
  assert.ok(invalid.details.some((detail) => detail.field === "status"));
  assert.ok(invalid.details.some((detail) => detail.field === "priority"));
});

test("query daftar memakai default dan mem-parse nilai yang diizinkan", () => {
  const defaults = validateListQuery({});
  assert.equal(defaults.ok, true);
  assert.deepEqual(defaults.value, {
    q: null,
    status: null,
    priority: null,
    sort: "created_at",
    order: "desc",
    page: 1,
    limit: 10,
  });

  const parsed = validateListQuery({
    q: "  laporan  ",
    status: "in_progress",
    priority: "high",
    sort: "due_date",
    order: "asc",
    page: "3",
    limit: "25",
  });
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.value, {
    q: "laporan",
    status: "in_progress",
    priority: "high",
    sort: "due_date",
    order: "asc",
    page: 3,
    limit: 25,
  });
});

test("query daftar menolak nama kolom arbitrer, filter, dan halaman tidak valid", () => {
  const maliciousSort = validateListQuery({
    sort: "created_at; DROP TABLE tasks",
  });
  assert.equal(maliciousSort.ok, false);
  assert.ok(maliciousSort.details.some((detail) => detail.field === "sort"));

  const invalid = validateListQuery({
    status: "blocked",
    priority: "urgent",
    order: "random",
    page: "0",
    limit: "51",
    unexpected: "yes",
  });
  assert.equal(invalid.ok, false);
  const fields = new Set(invalid.details.map((detail) => detail.field));
  for (const field of ["status", "priority", "order", "page", "limit", "unexpected"]) {
    assert.ok(fields.has(field), `detail untuk ${field} harus ada`);
  }
});

test("query daftar menolak nilai ganda dan angka pecahan", () => {
  const duplicate = validateListQuery({ status: ["todo", "done"] });
  assert.equal(duplicate.ok, false);

  const fractional = validateListQuery({ page: "1.5", limit: "10.0" });
  assert.equal(fractional.ok, false);
  const fields = new Set(fractional.details.map((detail) => detail.field));
  assert.ok(fields.has("page"));
  assert.ok(fields.has("limit"));
});

test("ID tugas hanya menerima UUID yang aman", () => {
  assert.equal(isValidTaskId(randomUUID()), true);
  assert.equal(isValidTaskId("not-a-uuid"), false);
  assert.equal(isValidTaskId(""), false);
  assert.equal(isValidTaskId("../../etc/passwd"), false);
  assert.equal(
    isValidTaskId("123e4567-e89b-12d3-a456-426614174000' OR 1=1 --"),
    false,
  );
});
