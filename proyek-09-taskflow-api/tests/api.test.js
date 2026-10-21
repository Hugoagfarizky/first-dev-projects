import {
  after,
  before,
  beforeEach,
  describe,
  test,
} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { createApp } from "../server/app.js";
import { closeDatabase, openDatabase } from "../server/db/database.js";

const silentLogger = { error() {} };
const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function startServer(db) {
  const app = createApp({ db, logger: silentLogger });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

async function stopServer(server) {
  await new Promise((resolve) => server.close(resolve));
}

async function request(baseUrl, pathname, { method = "GET", body, rawBody } = {}) {
  const headers = {};
  const init = { method, headers };
  if (rawBody !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = rawBody;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }

  const response = await fetch(`${baseUrl}${pathname}`, init);
  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }
  return { response, status: response.status, headers: response.headers, text, body: payload };
}

function assertErrorEnvelope(result, expectedStatus, expectedCode) {
  assert.equal(result.status, expectedStatus, result.text);
  assert.ok(result.body?.error, "respons harus memiliki objek error");
  assert.equal(result.body.error.code, expectedCode);
  assert.equal(typeof result.body.error.message, "string");
  assert.ok(Array.isArray(result.body.error.details));
  assert.doesNotMatch(result.text, /SQLITE_|stack|at .*\.js:\d+/i);
}

async function createTask(baseUrl, overrides = {}) {
  const result = await request(baseUrl, "/api/v1/tasks", {
    method: "POST",
    body: {
      title: "Tugas uji",
      description: "Deskripsi uji",
      status: "todo",
      priority: "medium",
      due_date: null,
      ...overrides,
    },
  });
  assert.equal(result.status, 201, result.text);
  return result.body.data;
}

describe("REST API TaskFlow dengan SQLite nyata", () => {
  let temporaryDirectory;
  let db;
  let server;
  let baseUrl;

  before(async () => {
    temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "taskflow-api-test-"));
    db = openDatabase({ filename: path.join(temporaryDirectory, "test.sqlite") });
    ({ server, baseUrl } = await startServer(db));
  });

  after(async () => {
    await stopServer(server);
    closeDatabase(db);
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  });

  beforeEach(() => {
    db.exec("DELETE FROM tasks;");
  });

  test("GET /api/health melaporkan server dan database tanpa detail sensitif", async () => {
    const result = await request(baseUrl, "/api/health");
    assert.equal(result.status, 200);
    assert.equal(result.body.data.status, "ok");
    assert.equal(result.body.data.database, "connected");
    assert.equal(typeof result.body.data.uptime_seconds, "number");
    assert.equal(result.body.data.path, undefined);
    assert.equal(result.headers.get("x-powered-by"), null);
    assert.match(result.headers.get("content-security-policy"), /default-src 'self'/);
  });

  test("frontend disajikan dari public tanpa mengekspos source server", async () => {
    const page = await request(baseUrl, "/");
    assert.equal(page.status, 200);
    assert.match(page.headers.get("content-type"), /text\/html/);
    assert.match(page.text, /TaskFlow API/);

    const source = await request(baseUrl, "/server/app.js");
    assert.equal(source.status, 404);
    assert.doesNotMatch(source.text, /createApp/);

    const packageFile = await request(baseUrl, "/package.json");
    assert.equal(packageFile.status, 404);

    const dataFile = await request(baseUrl, "/data/taskflow.sqlite");
    assert.equal(dataFile.status, 404);
  });

  test("POST membuat tugas dengan ID, default, dan timestamp yang konsisten", async () => {
    const result = await request(baseUrl, "/api/v1/tasks", {
      method: "POST",
      body: {
        title: "  Belajar   REST API ",
        description: "  Bab endpoint  ",
      },
    });

    assert.equal(result.status, 201);
    assert.equal(result.headers.get("location"), `/api/v1/tasks/${result.body.data.id}`);
    assert.match(result.body.data.id, /^[0-9a-f-]{36}$/);
    assert.equal(result.body.data.title, "Belajar REST API");
    assert.equal(result.body.data.description, "Bab endpoint");
    assert.equal(result.body.data.status, "todo");
    assert.equal(result.body.data.priority, "medium");
    assert.equal(result.body.data.due_date, null);
    assert.equal(result.body.data.created_at, result.body.data.updated_at);
    assert.ok(!Number.isNaN(Date.parse(result.body.data.created_at)));
  });

  test("POST menyimpan tanggal kalender apa adanya", async () => {
    const task = await createTask(baseUrl, {
      title: "Rapat",
      due_date: "2026-02-28",
    });
    assert.equal(task.due_date, "2026-02-28");
  });

  test("GET detail mengembalikan tugas dan 404 untuk ID yang tidak ada", async () => {
    const task = await createTask(baseUrl, { title: "Detail tugas" });

    const found = await request(baseUrl, `/api/v1/tasks/${task.id}`);
    assert.equal(found.status, 200);
    assert.deepEqual(found.body.data, task);

    const missing = await request(baseUrl, `/api/v1/tasks/${randomUUID()}`);
    assertErrorEnvelope(missing, 404, "NOT_FOUND");

    const invalid = await request(baseUrl, "/api/v1/tasks/bukan-uuid");
    assertErrorEnvelope(invalid, 400, "INVALID_ID");
  });

  test("PATCH memperbarui field parsial, menjaga field lain, dan memperbarui updated_at", async () => {
    const task = await createTask(baseUrl, {
      title: "Judul awal",
      description: "Deskripsi tetap",
      priority: "low",
    });

    await sleep(5);
    const result = await request(baseUrl, `/api/v1/tasks/${task.id}`, {
      method: "PATCH",
      body: { title: "  Judul baru ", status: "in_progress" },
    });

    assert.equal(result.status, 200);
    assert.equal(result.body.data.title, "Judul baru");
    assert.equal(result.body.data.status, "in_progress");
    assert.equal(result.body.data.description, "Deskripsi tetap");
    assert.equal(result.body.data.priority, "low");
    assert.equal(result.body.data.created_at, task.created_at);
    assert.notEqual(result.body.data.updated_at, task.updated_at);
    assert.ok(result.body.data.updated_at > task.updated_at);
  });

  test("PATCH menolak payload kosong, field asing, dan nilai tidak valid", async () => {
    const task = await createTask(baseUrl);

    const empty = await request(baseUrl, `/api/v1/tasks/${task.id}`, {
      method: "PATCH",
      body: {},
    });
    assertErrorEnvelope(empty, 400, "VALIDATION_ERROR");
    assert.ok(empty.body.error.details.some((detail) => detail.field === "body"));

    const unknown = await request(baseUrl, `/api/v1/tasks/${task.id}`, {
      method: "PATCH",
      body: { title: "Masih valid", owner: "attacker" },
    });
    assertErrorEnvelope(unknown, 400, "VALIDATION_ERROR");
    assert.ok(unknown.body.error.details.some((detail) => detail.field === "owner"));

    const invalid = await request(baseUrl, `/api/v1/tasks/${task.id}`, {
      method: "PATCH",
      body: { status: "deleted", due_date: "2026-02-30" },
    });
    assertErrorEnvelope(invalid, 400, "VALIDATION_ERROR");

    const stillThere = await request(baseUrl, `/api/v1/tasks/${task.id}`);
    assert.equal(stillThere.body.data.title, task.title);
    assert.equal(stillThere.body.data.status, task.status);
  });

  test("PATCH ke ID yang tidak ada mengembalikan 404 tanpa membuat data", async () => {
    const missing = await request(baseUrl, `/api/v1/tasks/${randomUUID()}`, {
      method: "PATCH",
      body: { title: "Tidak akan dibuat" },
    });
    assertErrorEnvelope(missing, 404, "NOT_FOUND");

    const list = await request(baseUrl, "/api/v1/tasks");
    assert.equal(list.body.pagination.total, 0);
  });

  test("POST menolak payload invalid dengan detail field", async () => {
    const blank = await request(baseUrl, "/api/v1/tasks", {
      method: "POST",
      body: { title: "   " },
    });
    assertErrorEnvelope(blank, 400, "VALIDATION_ERROR");
    assert.ok(blank.body.error.details.some((detail) => detail.field === "title"));

    const unknown = await request(baseUrl, "/api/v1/tasks", {
      method: "POST",
      body: { title: "Valid", role: "admin" },
    });
    assertErrorEnvelope(unknown, 400, "VALIDATION_ERROR");
    assert.ok(unknown.body.error.details.some((detail) => detail.field === "role"));

    const badDate = await request(baseUrl, "/api/v1/tasks", {
      method: "POST",
      body: { title: "Valid", due_date: "2025-02-29" },
    });
    assertErrorEnvelope(badDate, 400, "VALIDATION_ERROR");

    const list = await request(baseUrl, "/api/v1/tasks");
    assert.equal(list.body.pagination.total, 0);
  });

  test("body kosong, JSON rusak, dan payload terlalu besar ditangani dengan format error", async () => {
    const noBody = await request(baseUrl, "/api/v1/tasks", { method: "POST" });
    assertErrorEnvelope(noBody, 400, "VALIDATION_ERROR");

    const invalidJson = await request(baseUrl, "/api/v1/tasks", {
      method: "POST",
      rawBody: '{"title":',
    });
    assertErrorEnvelope(invalidJson, 400, "INVALID_JSON");

    const tooLarge = await request(baseUrl, "/api/v1/tasks", {
      method: "POST",
      rawBody: JSON.stringify({
        title: "Besar",
        description: "x".repeat(70_000),
      }),
    });
    assertErrorEnvelope(tooLarge, 413, "PAYLOAD_TOO_LARGE");
  });

  test("DELETE mengembalikan 204, menghapus data, dan 404 pada pengulangan", async () => {
    const task = await createTask(baseUrl, { title: "Akan dihapus" });

    const deleted = await request(baseUrl, `/api/v1/tasks/${task.id}`, {
      method: "DELETE",
    });
    assert.equal(deleted.status, 204);
    assert.equal(deleted.text, "");

    const missing = await request(baseUrl, `/api/v1/tasks/${task.id}`);
    assertErrorEnvelope(missing, 404, "NOT_FOUND");

    const repeat = await request(baseUrl, `/api/v1/tasks/${task.id}`, {
      method: "DELETE",
    });
    assertErrorEnvelope(repeat, 404, "NOT_FOUND");
  });

  test("filter status, prioritas, dan pencarian judul dapat digabung", async () => {
    await createTask(baseUrl, { title: "Laporan bulanan", status: "todo", priority: "high" });
    await createTask(baseUrl, { title: "Rapat tim", status: "in_progress", priority: "medium" });
    await createTask(baseUrl, { title: "Laporan tahunan", status: "done", priority: "high" });
    await createTask(baseUrl, { title: "Belanja kantor", status: "done", priority: "low" });

    const doneHigh = await request(
      baseUrl,
      "/api/v1/tasks?status=done&priority=high",
    );
    assert.equal(doneHigh.body.pagination.total, 1);
    assert.equal(doneHigh.body.data[0].title, "Laporan tahunan");

    const search = await request(baseUrl, "/api/v1/tasks?q=laporan");
    assert.equal(search.body.pagination.total, 2);

    const combined = await request(
      baseUrl,
      "/api/v1/tasks?q=laporan&status=done",
    );
    assert.equal(combined.body.pagination.total, 1);
    assert.equal(combined.body.data[0].title, "Laporan tahunan");

    assert.deepEqual(combined.body.summary, {
      total: 4,
      todo: 1,
      in_progress: 1,
      done: 2,
    });
  });

  test("pencarian memperlakukan karakter wildcard sebagai teks biasa", async () => {
    await createTask(baseUrl, { title: "Diskon 50% untuk anggota" });
    await createTask(baseUrl, { title: "Laporan biasa" });

    const percent = await request(
      baseUrl,
      `/api/v1/tasks?q=${encodeURIComponent("50%")}`,
    );
    assert.equal(percent.body.pagination.total, 1);

    const underscore = await request(
      baseUrl,
      `/api/v1/tasks?q=${encodeURIComponent("_")}`,
    );
    assert.equal(underscore.body.pagination.total, 0);
  });

  test("pengurutan prioritas memakai urutan high-medium-low, bukan alfabetis", async () => {
    await createTask(baseUrl, { title: "Rendah", priority: "low" });
    await createTask(baseUrl, { title: "Tinggi", priority: "high" });
    await createTask(baseUrl, { title: "Sedang", priority: "medium" });

    const descending = await request(
      baseUrl,
      "/api/v1/tasks?sort=priority&order=desc&limit=50",
    );
    assert.deepEqual(
      descending.body.data.map((task) => task.title),
      ["Tinggi", "Sedang", "Rendah"],
    );

    const ascending = await request(
      baseUrl,
      "/api/v1/tasks?sort=priority&order=asc&limit=50",
    );
    assert.deepEqual(
      ascending.body.data.map((task) => task.title),
      ["Rendah", "Sedang", "Tinggi"],
    );
  });

  test("pengurutan tenggat menempatkan tugas tanpa tenggat di akhir", async () => {
    await createTask(baseUrl, { title: "Tanpa tenggat", due_date: null });
    await createTask(baseUrl, { title: "Lebih lambat", due_date: "2026-09-10" });
    await createTask(baseUrl, { title: "Lebih dekat", due_date: "2026-08-01" });

    const result = await request(
      baseUrl,
      "/api/v1/tasks?sort=due_date&order=asc&limit=50",
    );
    assert.deepEqual(
      result.body.data.map((task) => task.title),
      ["Lebih dekat", "Lebih lambat", "Tanpa tenggat"],
    );
  });

  test("pengurutan tanggal dibuat naik dan turun berfungsi", async () => {
    await createTask(baseUrl, { title: "Pertama" });
    await sleep(5);
    await createTask(baseUrl, { title: "Kedua" });
    await sleep(5);
    await createTask(baseUrl, { title: "Ketiga" });

    const newest = await request(baseUrl, "/api/v1/tasks?sort=created_at&order=desc");
    assert.deepEqual(
      newest.body.data.map((task) => task.title),
      ["Ketiga", "Kedua", "Pertama"],
    );

    const oldest = await request(baseUrl, "/api/v1/tasks?sort=created_at&order=asc");
    assert.deepEqual(
      oldest.body.data.map((task) => task.title),
      ["Pertama", "Kedua", "Ketiga"],
    );
  });

  test("pagination memberi total dan halaman yang akurat", async () => {
    for (let index = 1; index <= 12; index += 1) {
      await createTask(baseUrl, { title: `Tugas ${String(index).padStart(2, "0")}` });
    }

    const first = await request(baseUrl, "/api/v1/tasks?page=1&limit=5");
    assert.equal(first.status, 200);
    assert.equal(first.body.data.length, 5);
    assert.deepEqual(first.body.pagination, {
      page: 1,
      limit: 5,
      total: 12,
      total_pages: 3,
    });

    const last = await request(baseUrl, "/api/v1/tasks?page=3&limit=5");
    assert.equal(last.body.data.length, 2);
    assert.equal(last.body.pagination.page, 3);

    const beyond = await request(baseUrl, "/api/v1/tasks?page=9&limit=5");
    assert.equal(beyond.body.data.length, 0);
    assert.equal(beyond.body.pagination.total, 12);
    assert.equal(beyond.body.pagination.total_pages, 3);
  });

  test("query parameter invalid dan nama kolom SQL arbitrer ditolak", async () => {
    const invalidStatus = await request(baseUrl, "/api/v1/tasks?status=blocked");
    assertErrorEnvelope(invalidStatus, 400, "VALIDATION_ERROR");

    const malicious = await request(
      baseUrl,
      `/api/v1/tasks?sort=${encodeURIComponent("created_at; DROP TABLE tasks")}`,
    );
    assertErrorEnvelope(malicious, 400, "VALIDATION_ERROR");

    const invalidPage = await request(baseUrl, "/api/v1/tasks?page=0&limit=500");
    assertErrorEnvelope(invalidPage, 400, "VALIDATION_ERROR");

    const unknown = await request(baseUrl, "/api/v1/tasks?owner=me");
    assertErrorEnvelope(unknown, 400, "VALIDATION_ERROR");

    const health = await request(baseUrl, "/api/health");
    assert.equal(health.status, 200);
  });

  test("input SQL injection tidak mengubah query atau skema", async () => {
    await createTask(baseUrl, { title: "Tugas aman" });
    await createTask(baseUrl, {
      title: "Robert'); DROP TABLE tasks;--",
      description: "'; DELETE FROM tasks; --",
    });

    const search = await request(
      baseUrl,
      `/api/v1/tasks?q=${encodeURIComponent("' OR 1=1 --")}`,
    );
    assert.equal(search.status, 200);
    assert.equal(search.body.pagination.total, 0);

    const all = await request(baseUrl, "/api/v1/tasks");
    assert.equal(all.body.pagination.total, 2);
    assert.ok(all.body.data.some((task) => task.title.includes("DROP TABLE")));

    const schema = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'tasks'")
      .get();
    assert.equal(schema.name, "tasks");
  });

  test("route API yang tidak dikenal memakai envelope 404 yang konsisten", async () => {
    const missing = await request(baseUrl, "/api/v1/unknown");
    assertErrorEnvelope(missing, 404, "NOT_FOUND");

    const wrongMethod = await request(baseUrl, "/api/v1/tasks", { method: "PUT" });
    assertErrorEnvelope(wrongMethod, 404, "NOT_FOUND");
  });

  test("database yang gagal diakses tidak membuat server crash", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "taskflow-api-fail-"));
    const brokenDb = openDatabase({ filename: path.join(directory, "broken.sqlite") });
    const broken = await startServer(brokenDb);
    closeDatabase(brokenDb);

    try {
      const health = await request(broken.baseUrl, "/api/health");
      assertErrorEnvelope(health, 503, "DATABASE_UNAVAILABLE");

      const list = await request(broken.baseUrl, "/api/v1/tasks");
      assertErrorEnvelope(list, 500, "INTERNAL_ERROR");

      const again = await request(broken.baseUrl, "/api/health");
      assert.equal(again.status, 503);
    } finally {
      await stopServer(broken.server);
      closeDatabase(brokenDb);
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});

test("data tetap ada setelah koneksi dan aplikasi dibuat ulang", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "taskflow-api-persist-"));
  const filename = path.join(directory, "persist.sqlite");
  let db;
  let server;
  let baseUrl;

  try {
    db = openDatabase({ filename });
    ({ server, baseUrl } = await startServer(db));
    const created = await createTask(baseUrl, { title: "Bertahan setelah restart" });
    await stopServer(server);
    closeDatabase(db);

    db = openDatabase({ filename });
    ({ server, baseUrl } = await startServer(db));
    const result = await request(baseUrl, `/api/v1/tasks/${created.id}`);
    assert.equal(result.status, 200);
    assert.equal(result.body.data.title, "Bertahan setelah restart");
    assert.equal(result.body.data.created_at, created.created_at);
  } finally {
    if (server) await stopServer(server);
    closeDatabase(db);
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
