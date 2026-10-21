export class ApiError extends Error {
  constructor(status, code, message, details = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function validationError(details, message = "Input tidak valid.") {
  return new ApiError(400, "VALIDATION_ERROR", message, details);
}

export function notFoundError(message = "Tugas tidak ditemukan.") {
  return new ApiError(404, "NOT_FOUND", message);
}
