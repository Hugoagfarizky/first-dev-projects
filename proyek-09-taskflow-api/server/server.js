import { createApp } from "./app.js";
import {
  closeDatabase,
  getDatabasePath,
  openDatabase,
} from "./db/database.js";

const host = process.env.HOST || "127.0.0.1";
const rawPort = process.env.PORT || "3000";
const port = Number(rawPort);
const databasePath = getDatabasePath();

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  console.error(`PORT tidak valid: ${rawPort}`);
  process.exit(1);
}

let db;
try {
  db = openDatabase({ filename: databasePath });
} catch (error) {
  console.error("Aplikasi gagal dimulai karena database bermasalah.");
  console.error(error.message);
  process.exit(1);
}

const app = createApp({ db });
const server = app.listen(port, host, () => {
  console.log(`TaskFlow API berjalan di http://${host}:${port}`);
  console.log("Buka frontend hanya melalui alamat tersebut, bukan public/index.html langsung.");
  console.log(`Database SQLite: ${databasePath}`);
});

server.on("error", (error) => {
  console.error(`Server gagal berjalan: ${error.message}`);
  closeDatabase(db);
  process.exit(1);
});

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\nMenerima ${signal}. Menutup server dan database...`);

  const forceExit = setTimeout(() => {
    console.error("Penutupan melewati batas waktu.");
    process.exit(1);
  }, 5_000);
  forceExit.unref();

  server.close((error) => {
    clearTimeout(forceExit);
    closeDatabase(db);
    if (error) {
      console.error(`Gagal menutup server: ${error.message}`);
      process.exitCode = 1;
      return;
    }
    console.log("Server dan database ditutup dengan aman.");
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
