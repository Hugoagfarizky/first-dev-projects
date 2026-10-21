export class ApiError extends Error {
  constructor(message, { status = 0, code = "NETWORK_ERROR", details = [] } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = Array.isArray(details) ? details : [];
  }
}

const API_ROOT = "/api/v1/tasks";

async function request(path, { method = "GET", body, signal } = {}) {
  let response;
  try {
    response = await fetch(path, {
      method,
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
      cache: "no-store",
    });
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    throw new ApiError(
      "Tidak dapat terhubung ke server TaskFlow. Pastikan server berjalan lalu coba lagi.",
      { code: "NETWORK_ERROR" },
    );
  }

  let payload = null;
  if (response.status !== 204) {
    const text = await response.text();
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }
    }
  }

  if (!response.ok) {
    const apiError = payload?.error;
    throw new ApiError(apiError?.message || `Server mengembalikan status ${response.status}.`, {
      status: response.status,
      code: apiError?.code || "REQUEST_FAILED",
      details: apiError?.details,
    });
  }

  return payload;
}

export const api = {
  listTasks(params = {}, signal) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === "") continue;
      search.set(key, String(value));
    }
    const query = search.toString();
    return request(query ? `${API_ROOT}?${query}` : API_ROOT, { signal });
  },

  getTask(id, signal) {
    return request(`${API_ROOT}/${encodeURIComponent(id)}`, { signal });
  },

  createTask(task) {
    return request(API_ROOT, { method: "POST", body: task });
  },

  updateTask(id, changes) {
    return request(`${API_ROOT}/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: changes,
    });
  },

  deleteTask(id) {
    return request(`${API_ROOT}/${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  health(signal) {
    return request("/api/health", { signal });
  },
};
