import { getSafeText, isFiniteNumber } from "./utils.js";

const API_BASE_URL = "https://api.themoviedb.org/3";
const LANGUAGE = "id-ID";
const REGION = "ID";
const REQUEST_TIMEOUT_MS = 12000;

export class ApiError extends Error {
  constructor(message, { code = "API", status = 0, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

export function isAbortError(error) {
  return error instanceof ApiError && error.code === "ABORT";
}

export function getApiKey() {
  const configured = window.MOVIE_EXPLORER_CONFIG;
  if (!configured || typeof configured !== "object") return "";
  return getSafeText(configured.tmdbApiKey);
}

export function isConfigured() {
  return Boolean(getApiKey());
}

export function buildApiUrl(path, params = {}, apiKey = getApiKey()) {
  if (typeof path !== "string" || !path.startsWith("/")) {
    throw new ApiError("Path endpoint TMDB tidak valid.", { code: "CONFIG" });
  }
  const url = new URL(`${API_BASE_URL}${path}`);
  if (!apiKey) {
    throw new ApiError(
      "TMDB API key belum diatur. Salin config.example.js menjadi config.js dan isi tmdbApiKey.",
      { code: "CONFIG" },
    );
  }
  url.searchParams.set("api_key", apiKey);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  return url;
}

async function request(path, params = {}, { signal } = {}) {
  const url = buildApiUrl(path, params);
  let timedOut = false;
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort();

  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", abortFromCaller, { once: true });
  }

  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
  } catch (error) {
    if (signal?.aborted) {
      throw new ApiError("Permintaan dibatalkan.", { code: "ABORT", cause: error });
    }
    if (timedOut) {
      throw new ApiError(
        "Permintaan ke TMDB melewati batas waktu. Periksa koneksi lalu coba lagi.",
        { code: "TIMEOUT", cause: error },
      );
    }
    throw new ApiError(
      "Tidak dapat terhubung ke TMDB. Periksa koneksi internet lalu coba lagi.",
      { code: "NETWORK", cause: error },
    );
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener("abort", abortFromCaller);
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError(
        "TMDB menolak API key. Periksa nilai tmdbApiKey di config.js.",
        { code: "AUTH", status: response.status },
      );
    }
    if (response.status === 404) {
      throw new ApiError("Data yang diminta tidak ditemukan di TMDB.", {
        code: "NOT_FOUND",
        status: response.status,
      });
    }
    if (response.status === 429) {
      throw new ApiError(
        "Batas permintaan TMDB tercapai. Tunggu sebentar lalu coba lagi.",
        { code: "RATE_LIMIT", status: response.status },
      );
    }
    if (response.status >= 500) {
      throw new ApiError(
        "Server TMDB sedang bermasalah. Coba lagi beberapa saat.",
        { code: "SERVER", status: response.status },
      );
    }
    throw new ApiError(
      `Permintaan TMDB gagal (HTTP ${response.status}). Coba lagi.`,
      { code: "HTTP", status: response.status },
    );
  }

  try {
    return await response.json();
  } catch (error) {
    throw new ApiError("Respons TMDB tidak dapat dibaca sebagai JSON.", {
      code: "PARSE",
      status: response.status,
      cause: error,
    });
  }
}

function normalizeId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function normalizeGenreIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
}

export function normalizeMovie(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = normalizeId(raw.id);
  if (!id) return null;

  const title =
    getSafeText(raw.title) ||
    getSafeText(raw.original_title) ||
    "Judul tidak tersedia";

  return {
    id,
    title,
    originalTitle: getSafeText(raw.original_title),
    overview: getSafeText(raw.overview),
    releaseDate: getSafeText(raw.release_date),
    posterPath: getSafeText(raw.poster_path),
    backdropPath: getSafeText(raw.backdrop_path),
    voteAverage: isFiniteNumber(raw.vote_average) ? raw.vote_average : null,
    voteCount: isFiniteNumber(raw.vote_count) ? raw.vote_count : null,
    popularity: isFiniteNumber(raw.popularity) ? raw.popularity : null,
    genreIds: normalizeGenreIds(raw.genre_ids),
    originalLanguage: getSafeText(raw.original_language),
    adult: raw.adult === true,
  };
}

export function normalizeMovieList(payload) {
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.results)) {
    throw new ApiError("Respons daftar film dari TMDB tidak valid.", { code: "PARSE" });
  }

  const page = Number(payload.page);
  const totalPages = Number(payload.total_pages);
  const totalResults = Number(payload.total_results);

  return {
    page: Number.isInteger(page) && page > 0 ? page : 1,
    totalPages: Number.isInteger(totalPages) && totalPages > 0 ? totalPages : 1,
    totalResults: Number.isInteger(totalResults) && totalResults >= 0 ? totalResults : 0,
    results: payload.results.map(normalizeMovie).filter(Boolean),
  };
}

export function normalizeGenres(payload) {
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.genres)) {
    throw new ApiError("Daftar genre dari TMDB tidak valid.", { code: "PARSE" });
  }

  return payload.genres
    .map((genre) => {
      if (!genre || typeof genre !== "object") return null;
      const id = normalizeId(genre.id);
      const name = getSafeText(genre.name);
      if (!id || !name) return null;
      return { id, name };
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name, "id"));
}

export function normalizeMovieDetails(payload) {
  const base = normalizeMovie(payload);
  if (!base) return null;

  const genres = Array.isArray(payload.genres)
    ? payload.genres
        .map((genre) => {
          if (!genre || typeof genre !== "object") return null;
          const id = normalizeId(genre.id);
          const name = getSafeText(genre.name);
          return id && name ? { id, name } : null;
        })
        .filter(Boolean)
    : [];

  return {
    ...base,
    genres,
    runtime: isFiniteNumber(payload.runtime) && payload.runtime > 0 ? payload.runtime : null,
    status: getSafeText(payload.status),
    tagline: getSafeText(payload.tagline),
  };
}

export async function getTrendingMovies({ page = 1, signal } = {}) {
  const payload = await request(
    "/trending/movie/week",
    { language: LANGUAGE, page },
    { signal },
  );
  return normalizeMovieList(payload);
}

export async function getPopularMovies({ page = 1, signal } = {}) {
  const payload = await request(
    "/movie/popular",
    { language: LANGUAGE, page, region: REGION },
    { signal },
  );
  return normalizeMovieList(payload);
}

export async function getTopRatedMovies({ page = 1, signal } = {}) {
  const payload = await request(
    "/movie/top_rated",
    { language: LANGUAGE, page, region: REGION },
    { signal },
  );
  return normalizeMovieList(payload);
}

export async function getUpcomingMovies({ page = 1, signal } = {}) {
  const payload = await request(
    "/movie/upcoming",
    { language: LANGUAGE, page, region: REGION },
    { signal },
  );
  return normalizeMovieList(payload);
}

export async function searchMovies({ query, page = 1, signal } = {}) {
  const cleanQuery = getSafeText(query);
  if (!cleanQuery) {
    throw new ApiError("Masukkan judul film terlebih dahulu.", { code: "QUERY" });
  }
  const payload = await request(
    "/search/movie",
    {
      query: cleanQuery,
      page,
      include_adult: "false",
      language: LANGUAGE,
      region: REGION,
    },
    { signal },
  );
  return normalizeMovieList(payload);
}

export async function discoverMovies({
  genreId = "",
  sortBy = "popularity.desc",
  page = 1,
  signal,
} = {}) {
  const safeSort = sortBy === "vote_average.desc" ? "vote_average.desc" : "popularity.desc";
  const numericGenre = Number(genreId);
  const params = {
    page,
    include_adult: "false",
    language: LANGUAGE,
    region: REGION,
    sort_by: safeSort,
  };
  if (Number.isInteger(numericGenre) && numericGenre > 0) {
    params.with_genres = numericGenre;
  }
  if (safeSort === "vote_average.desc") {
    params["vote_count.gte"] = 100;
  }
  const payload = await request("/discover/movie", params, { signal });
  return normalizeMovieList(payload);
}

export async function getMovieDetails(movieId, { signal } = {}) {
  const id = normalizeId(movieId);
  if (!id) {
    throw new ApiError("ID film tidak valid.", { code: "PARSE" });
  }
  const payload = await request(`/movie/${id}`, { language: LANGUAGE }, { signal });
  const details = normalizeMovieDetails(payload);
  if (!details) {
    throw new ApiError("Detail film dari TMDB tidak lengkap.", { code: "PARSE" });
  }
  return details;
}

export async function getMovieGenres({ signal } = {}) {
  const payload = await request("/genre/movie/list", { language: LANGUAGE }, { signal });
  return normalizeGenres(payload);
}
