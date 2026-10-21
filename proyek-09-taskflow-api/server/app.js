import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { checkDatabaseConnection } from "./db/database.js";
import { createTasksRouter } from "./routes/tasks.js";
import { createTasksService } from "./services/tasksService.js";
import { createErrorHandler } from "./middleware/errorHandler.js";
import { notFound } from "./middleware/notFound.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIRECTORY = path.resolve(currentDirectory, "../public");

export function createApp({ db, logger = console, bodyLimit = "64kb" } = {}) {
  if (!db) throw new Error("Database wajib diberikan saat membuat aplikasi.");

  const app = express();
  app.disable("x-powered-by");

  app.use((request, response, next) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    );
    next();
  });

  app.use(express.json({ limit: bodyLimit, strict: true }));

  app.use("/api", (request, response, next) => {
    response.setHeader("Cache-Control", "no-store");
    next();
  });

  app.get("/api/health", (request, response) => {
    try {
      if (!checkDatabaseConnection(db)) {
        throw new Error("Pemeriksaan koneksi database gagal.");
      }
      response.json({
        data: {
          status: "ok",
          database: "connected",
          uptime_seconds: Math.round(process.uptime()),
        },
      });
    } catch (error) {
      logger.error?.("[GET /api/health] Pemeriksaan database gagal", error);
      response.status(503).json({
        error: {
          code: "DATABASE_UNAVAILABLE",
          message: "Database tidak dapat diakses.",
          details: [],
        },
      });
    }
  });

  const service = createTasksService(db);
  app.use("/api/v1/tasks", createTasksRouter(service));

  app.use(
    express.static(PUBLIC_DIRECTORY, {
      index: "index.html",
      dotfiles: "deny",
    }),
  );

  app.use(notFound);
  app.use(createErrorHandler({ logger }));

  return app;
}
