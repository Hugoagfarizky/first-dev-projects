import { getSafeText, isFiniteNumber } from "./utils.js";

export const FAVORITES_STORAGE_KEY = "movieExplorer.favorites.v1";

const listeners = new Set();
let favorites = readFavorites();

function normalizeStoredMovie(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = Number(raw.id);
  if (!Number.isInteger(id) || id <= 0) return null;
  const title = getSafeText(raw.title, "Judul tidak tersedia");

  return {
    id,
    title,
    overview: getSafeText(raw.overview),
    releaseDate: getSafeText(raw.releaseDate),
    posterPath: getSafeText(raw.posterPath),
    backdropPath: getSafeText(raw.backdropPath),
    voteAverage: isFiniteNumber(raw.voteAverage) ? raw.voteAverage : null,
    voteCount: isFiniteNumber(raw.voteCount) ? raw.voteCount : null,
    popularity: isFiniteNumber(raw.popularity) ? raw.popularity : null,
    genreIds: Array.isArray(raw.genreIds)
      ? [...new Set(raw.genreIds.map(Number).filter((value) => Number.isInteger(value) && value > 0))]
      : [],
    originalLanguage: getSafeText(raw.originalLanguage),
  };
}

function readFavorites() {
  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set();
    return parsed
      .map(normalizeStoredMovie)
      .filter((movie) => {
        if (!movie || seen.has(movie.id)) return false;
        seen.add(movie.id);
        return true;
      });
  } catch {
    return [];
  }
}

function persist(nextFavorites) {
  try {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(nextFavorites));
  } catch {
    throw new Error(
      "Favorit tidak dapat disimpan. Penyimpanan browser mungkin penuh atau diblokir.",
    );
  }
}

function emit(event) {
  for (const listener of listeners) {
    listener(event);
  }
}

function toStoredMovie(movie) {
  return normalizeStoredMovie({
    id: movie.id,
    title: movie.title,
    overview: movie.overview,
    releaseDate: movie.releaseDate,
    posterPath: movie.posterPath,
    backdropPath: movie.backdropPath,
    voteAverage: movie.voteAverage,
    voteCount: movie.voteCount,
    popularity: movie.popularity,
    genreIds: movie.genreIds,
    originalLanguage: movie.originalLanguage,
  });
}

export function getFavorites() {
  return favorites.slice();
}

export function getFavoritesCount() {
  return favorites.length;
}

export function isFavorite(movieId) {
  const id = Number(movieId);
  return favorites.some((movie) => movie.id === id);
}

export function toggleFavorite(movie) {
  const stored = toStoredMovie(movie);
  if (!stored) throw new Error("Film tidak dapat disimpan karena datanya tidak lengkap.");

  const exists = favorites.some((favorite) => favorite.id === stored.id);
  const nextFavorites = exists
    ? favorites.filter((favorite) => favorite.id !== stored.id)
    : [stored, ...favorites];

  persist(nextFavorites);
  favorites = nextFavorites;
  emit({ type: exists ? "removed" : "added", movie: stored });
  return { added: !exists, favorites: getFavorites() };
}

export function removeFavorite(movieId) {
  const id = Number(movieId);
  const exists = favorites.some((movie) => movie.id === id);
  if (!exists) return false;
  const nextFavorites = favorites.filter((movie) => movie.id !== id);
  persist(nextFavorites);
  favorites = nextFavorites;
  emit({ type: "removed", movie: { id } });
  return true;
}

export function subscribeToFavorites(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== FAVORITES_STORAGE_KEY) return;
    favorites = readFavorites();
    emit({ type: "external" });
  });
}
