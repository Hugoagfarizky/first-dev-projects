export function notFound(request, response) {
  if (/^\/api(?:\/|$)/.test(request.path)) {
    response.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Endpoint tidak ditemukan.",
        details: [],
      },
    });
    return;
  }

  response.status(404).type("text/plain").send("Halaman tidak ditemukan.");
}
