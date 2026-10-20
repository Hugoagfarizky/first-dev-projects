export const IMAGE_BASE_URL = "https://image.tmdb.org/t/p";
export const POSTER_SIZE = "w342";
export const BACKDROP_SIZE = "w1280";

const numberFormatter = new Intl.NumberFormat("id-ID");
const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

export function getImageUrl(path, size = POSTER_SIZE) {
  if (typeof path !== "string") return "";
  const trimmed = path.trim();
  if (!trimmed.startsWith("/")) return "";
  return `${IMAGE_BASE_URL}/${size}${trimmed}`;
}

export function formatYear(releaseDate) {
  if (typeof releaseDate !== "string") return "Tahun belum tersedia";
  const match = releaseDate.match(/^(\d{4})/);
  return match ? match[1] : "Tahun belum tersedia";
}

export function formatDate(releaseDate) {
  if (typeof releaseDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(releaseDate)) {
    return "—";
  }
  const date = new Date(`${releaseDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "—";
  return dateFormatter.format(date);
}

export function formatRating(value) {
  if (!isFiniteNumber(value) || value <= 0) return null;
  return value.toFixed(1).replace(".", ",");
}

export function formatVoteCount(value) {
  if (!isFiniteNumber(value) || value < 0) return "—";
  return numberFormatter.format(value);
}

export function formatRuntime(minutes) {
  if (!isFiniteNumber(minutes) || minutes <= 0) return "—";
  const total = Math.round(minutes);
  const hours = Math.floor(total / 60);
  const remaining = total % 60;
  if (hours === 0) return `${remaining} menit`;
  if (remaining === 0) return `${hours} jam`;
  return `${hours} jam ${remaining} menit`;
}

export function formatLanguage(code) {
  if (typeof code !== "string" || !code.trim()) return "—";
  try {
    const displayNames = new Intl.DisplayNames(["id"], { type: "language" });
    return displayNames.of(code) || code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

export function formatPopularity(value) {
  if (!isFiniteNumber(value)) return "—";
  return numberFormatter.format(Math.round(value));
}

export function getSafeText(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function debounce(callback, delay) {
  let timer = null;
  const debounced = (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      timer = null;
      callback(...args);
    }, delay);
  };
  debounced.cancel = () => {
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
  };
  return debounced;
}

export function createElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text !== undefined && text !== null) element.textContent = String(text);
  return element;
}

export function setText(element, value, fallback = "—") {
  if (!element) return;
  const text = getSafeText(value, fallback);
  element.textContent = text;
}

export function mergeUniqueMovies(existing, incoming) {
  const seen = new Set();
  const merged = [];
  for (const movie of [...existing, ...incoming]) {
    if (!movie || !Number.isInteger(movie.id) || seen.has(movie.id)) continue;
    seen.add(movie.id);
    merged.push(movie);
  }
  return merged;
}

export function sortMovies(movies, sortBy) {
  const sorted = [...movies];
  if (sortBy === "vote_average.desc") {
    sorted.sort((a, b) => {
      const ratingA = isFiniteNumber(a.voteAverage) ? a.voteAverage : 0;
      const ratingB = isFiniteNumber(b.voteAverage) ? b.voteAverage : 0;
      if (ratingB !== ratingA) return ratingB - ratingA;
      const votesA = isFiniteNumber(a.voteCount) ? a.voteCount : 0;
      const votesB = isFiniteNumber(b.voteCount) ? b.voteCount : 0;
      return votesB - votesA;
    });
    return sorted;
  }

  sorted.sort((a, b) => {
    const popularityA = isFiniteNumber(a.popularity) ? a.popularity : 0;
    const popularityB = isFiniteNumber(b.popularity) ? b.popularity : 0;
    return popularityB - popularityA;
  });
  return sorted;
}

export function filterByGenre(movies, genreId) {
  const numericId = Number(genreId);
  if (!Number.isInteger(numericId) || numericId <= 0) return [...movies];
  return movies.filter((movie) => Array.isArray(movie.genreIds) && movie.genreIds.includes(numericId));
}
