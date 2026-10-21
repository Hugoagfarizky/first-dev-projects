import { ApiError } from "../utils/ApiError.js";

function errorResponse(response, status, code, message, details = []) {
  response.status(status).json({
    error: {
      code,
      message,
      details,
    },
  });
}

export function createErrorHandler({ logger = console } = {}) {
  return function errorHandler(error, request, response, next) {
    if (response.headersSent) {
      next(error);
      return;
    }

    if (error instanceof ApiError) {
      errorResponse(response, error.status, error.code, error.message, error.details);
      return;
    }

    if (error?.type === "entity.too.large" || error?.status === 413) {
      errorResponse(
        response,
        413,
        "PAYLOAD_TOO_LARGE",
        "Ukuran payload melebihi batas yang diizinkan.",
      );
      return;
    }

    if (error?.type === "entity.parse.failed") {
      errorResponse(response, 400, "INVALID_JSON", "Body JSON tidak valid.");
      return;
    }

    if (error?.type === "charset.unsupported" || error?.type === "encoding.unsupported") {
      errorResponse(
        response,
        415,
        "UNSUPPORTED_MEDIA_TYPE",
        "Encoding request tidak didukung.",
      );
      return;
    }

    logger.error?.(`[${request.method} ${request.originalUrl}]`, error);
    errorResponse(
      response,
      500,
      "INTERNAL_ERROR",
      "Terjadi kesalahan internal. Silakan coba lagi.",
    );
  };
}
