import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

export const PROJECT_ROOT = path.resolve(currentDirectory, "../..");
export const DEFAULT_DATABASE_PATH = path.join(
  PROJECT_ROOT,
  "data",
  "taskflow.sqlite",
);
export const MIGRATIONS_DIRECTORY = path.join(currentDirectory, "migrations");

function ensureDatabaseDirectory(filename) {
  if (filename === ":memory:") return;
  fs.mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
}

export function getDatabasePath(value = process.env.DB_PATH) {
  if (!value) return DEFAULT_DATABASE_PATH;
  return value === ":memory:" ? value : path.resolve(value);
}

export function runMigrations(db, migrationsDirectory = MIGRATIONS_DIRECTORY) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set(
    db
      .prepare("SELECT version FROM schema_migrations ORDER BY version")
      .all()
      .map((row) => row.version),
  );

  const files = fs
    .readdirSync(migrationsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort();

  const recordMigration = db.prepare(
    "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)",
  );

  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = fs.readFileSync(path.join(migrationsDirectory, file), "utf8");
    const applyMigration = db.transaction(() => {
      db.exec(sql);
      recordMigration.run(file, new Date().toISOString());
    });

    try {
      applyMigration();
    } catch (error) {
      throw new Error(`Migrasi ${file} gagal: ${error.message}`, {
        cause: error,
      });
    }
  }
}

export function openDatabase({
  filename = getDatabasePath(),
  migrationsDirectory = MIGRATIONS_DIRECTORY,
} = {}) {
  ensureDatabaseDirectory(filename);

  let db;
  try {
    db = new Database(filename);
    db.pragma("foreign_keys = ON");
    db.pragma("busy_timeout = 5000");
    db.pragma("journal_mode = WAL");
    db.pragma("synchronous = NORMAL");
    db.pragma("trusted_schema = OFF");
    runMigrations(db, migrationsDirectory);
    return db;
  } catch (error) {
    if (db?.open) db.close();
    throw new Error(`Database tidak dapat dibuka atau dimigrasikan: ${error.message}`, {
      cause: error,
    });
  }
}

export function closeDatabase(db) {
  if (db?.open) db.close();
}

export function checkDatabaseConnection(db) {
  const row = db.prepare("SELECT 1 AS connected").get();
  return row?.connected === 1;
}
