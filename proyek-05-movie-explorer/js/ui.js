import {
  createElement,
  formatDate,
  formatLanguage,
  formatRating,
  formatRuntime,
  formatVoteCount,
  formatYear,
  getImageUrl,
  getSafeText,
  setText,
  BACKDROP_SIZE,
  POSTER_SIZE,
} from "./utils.js";

let toastTimer = null;
let dialogFavoriteMovie = null;

export function createIcon(name, className = "") {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  if (className) svg.setAttribute("class", className);
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `#icon-${name}`);
  svg.appendChild(use);
  return svg;
}

function createPosterPlaceholder() {
  const placeholder = createElement("div", "poster-placeholder");
  placeholder.appendChild(createIcon("film"));
  placeholder.appendChild(createElement("span", "", "Poster belum tersedia"));
  return placeholder;
}

function createPosterVisual(movie, { lazy = true } = {}) {
  const imageUrl = getImageUrl(movie.posterPath, POSTER_SIZE);
  if (!imageUrl) return createPosterPlaceholder();

  const image = document.createElement("img");
  image.src = imageUrl;
  image.alt = `Poster ${movie.title}`;
  image.loading = lazy ? "lazy" : "eager";
  image.decoding = "async";
  image.addEventListener(
    "error",
    () => {
      image.replaceWith(createPosterPlaceholder());
    },
    { once: true },
  );
  return image;
}

function createRatingChip(movie) {
  const rating = formatRating(movie.voteAverage);
  if (!rating) return null;
  const chip = createElement("span", "poster-rating");
  chip.appendChild(createIcon("star"));
  chip.appendChild(createElement("span", "", rating));
  chip.setAttribute("aria-label", `Rating ${rating} dari 10`);
  return chip;
}

export function updateFavoriteButton(button, favorite, title) {
  if (!button) return;
  button.setAttribute("aria-pressed", favorite ? "true" : "false");
  button.classList.toggle("is-favorite", favorite);
  const label = favorite ? `Hapus ${title} dari favorit` : `Tambah ${title} ke favorit`;
  button.setAttribute("aria-label", label);
  button.title = label;
  const text = button.querySelector("[data-favorite-label]");
  if (text) text.textContent = favorite ? "Hapus dari favorit" : "Tambah ke favorit";
}

export function syncFavoriteButtons(root, isFavorite) {
  root.querySelectorAll("[data-favorite-id]").forEach((button) => {
    const id = Number(button.dataset.favoriteId);
    const title = button.dataset.movieTitle || "film ini";
    updateFavoriteButton(button, isFavorite(id), title);
  });
}

export function createMovieCard(movie, { onOpen, onToggleFavorite, isFavorite }) {
  const card = createElement("article", "movie-card");
  card.dataset.movieId = String(movie.id);

  const posterWrap = createElement("div", "movie-card-poster-wrap");

  const posterButton = document.createElement("button");
  posterButton.type = "button";
  posterButton.className = "movie-card-poster";
  posterButton.setAttribute("aria-label", `Lihat detail ${movie.title}`);
  posterButton.appendChild(createPosterVisual(movie));

  const ratingChip = createRatingChip(movie);
  if (ratingChip) posterButton.appendChild(ratingChip);

  const peek = createElement("span", "card-peek");
  peek.appendChild(createIcon("info"));
  peek.appendChild(createElement("span", "", "Lihat detail"));
  posterButton.appendChild(peek);

  posterButton.addEventListener("click", () => onOpen(movie));

  const favoriteButton = document.createElement("button");
  favoriteButton.type = "button";
  favoriteButton.className = "favorite-button";
  favoriteButton.dataset.favoriteId = String(movie.id);
  favoriteButton.dataset.movieTitle = movie.title;
  favoriteButton.appendChild(createIcon("heart"));
  updateFavoriteButton(favoriteButton, isFavorite(movie.id), movie.title);
  favoriteButton.addEventListener("click", () => onToggleFavorite(movie));

  posterWrap.append(posterButton, favoriteButton);

  const copy = createElement("div", "movie-card-copy");
  const title = createElement("h3", "movie-card-title");
  const titleButton = createElement("button", "movie-card-title-button", movie.title);
  titleButton.type = "button";
  titleButton.addEventListener("click", () => onOpen(movie));
  title.appendChild(titleButton);

  const subline = createElement("div", "movie-card-subline");
  const year = createElement("span", "", formatYear(movie.releaseDate));
  const rating = formatRating(movie.voteAverage);
  const subRating = createElement("span", "card-rating");
  subRating.appendChild(createIcon("star"));
  subRating.appendChild(createElement("span", "", rating ? `${rating}` : "Belum dirating"));
  subline.append(year, subRating);
  copy.append(title, subline);

  card.append(posterWrap, copy);
  return card;
}

export function renderMovieGrid(container, movies, options) {
  container.replaceChildren();
  for (const movie of movies) {
    container.appendChild(createMovieCard(movie, options));
  }
}

export function renderSkeletonGrid(container, count = 6) {
  container.replaceChildren();
  for (let index = 0; index < count; index += 1) {
    const card = createElement("div", "skeleton-card");
    card.setAttribute("aria-hidden", "true");
    const poster = createElement("div", "skeleton-poster skeleton");
    const lines = createElement("div", "skeleton-lines");
    lines.append(createElement("span", "skeleton"), createElement("span", "skeleton"));
    card.append(poster, lines);
    container.appendChild(card);
  }
}

export function renderState(
  container,
  {
    type = "empty",
    title = "Tidak ada data",
    message = "",
    actionLabel = "",
    onAction = null,
    secondaryLabel = "",
    onSecondary = null,
    className = "state-panel",
  } = {},
) {
  container.className = className;
  container.replaceChildren();

  const iconName = type === "error" ? "alert" : type === "loading" ? "refresh" : "search";
  const icon = createElement("span", "state-icon");
  icon.appendChild(createIcon(iconName));
  icon.setAttribute("aria-hidden", "true");

  const heading = createElement("h3", "", title);
  const copy = createElement("p", "", message);
  container.append(icon, heading, copy);

  if (actionLabel && onAction) {
    const button = createElement("button", "button button-secondary", actionLabel);
    button.type = "button";
    button.addEventListener("click", onAction);
    container.appendChild(button);
  }

  if (secondaryLabel && onSecondary) {
    const button = createElement("button", "button button-ghost", secondaryLabel);
    button.type = "button";
    button.addEventListener("click", onSecondary);
    container.appendChild(button);
  }

  container.hidden = false;
  return container;
}

export function hideState(container) {
  if (!container) return;
  container.hidden = true;
  container.replaceChildren();
}

export function renderHero(heroElement, movie, { genreNames = [], onOpen, onToggleFavorite, isFavorite }) {
  heroElement.className = "hero";
  heroElement.setAttribute("aria-busy", "false");
  heroElement.replaceChildren();

  const backdropUrl = getImageUrl(movie.backdropPath, BACKDROP_SIZE);
  const media = createElement("div", "hero-media");
  if (backdropUrl) {
    const image = document.createElement("img");
    image.src = backdropUrl;
    image.alt = "";
    image.decoding = "async";
    image.addEventListener(
      "error",
      () => {
        image.remove();
      },
      { once: true },
    );
    media.appendChild(image);
  }
  media.appendChild(createElement("div", "hero-scrim"));

  const inner = createElement("div", "hero-inner shell");
  const copy = createElement("div", "hero-copy");

  const badge = createElement("span", "hero-badge");
  badge.appendChild(createIcon("sparkles"));
  badge.appendChild(createElement("span", "", "Film pilihan"));
  copy.appendChild(badge);

  const title = createElement("h1", "", movie.title);
  title.id = "hero-title";
  copy.appendChild(title);

  const meta = createElement("div", "hero-meta");
  const rating = formatRating(movie.voteAverage);
  if (rating) {
    const ratingItem = createElement("span", "rating");
    ratingItem.appendChild(createIcon("star"));
    ratingItem.appendChild(createElement("span", "", `${rating} / 10`));
    meta.appendChild(ratingItem);
  }
  meta.appendChild(createElement("span", "", formatYear(movie.releaseDate)));
  const genres = genreNames.slice(0, 2).join(" · ");
  if (genres) meta.appendChild(createElement("span", "", genres));
  copy.appendChild(meta);

  const overview = createElement(
    "p",
    "hero-overview",
    movie.overview || "Sinopsis belum tersedia untuk film ini.",
  );
  copy.appendChild(overview);

  const actions = createElement("div", "hero-actions");
  const detailButton = createElement("button", "button button-primary", "Lihat detail");
  detailButton.type = "button";
  detailButton.prepend(createIcon("info"));
  detailButton.addEventListener("click", () => onOpen(movie));
  actions.appendChild(detailButton);

  const favoriteButton = createElement("button", "button button-secondary hero-favorite");
  favoriteButton.type = "button";
  favoriteButton.dataset.favoriteId = String(movie.id);
  favoriteButton.dataset.movieTitle = movie.title;
  favoriteButton.appendChild(createIcon("heart"));
  const favoriteLabel = createElement("span", "", "Tambah ke favorit");
  favoriteLabel.dataset.favoriteLabel = "";
  favoriteButton.appendChild(favoriteLabel);
  updateFavoriteButton(favoriteButton, isFavorite(movie.id), movie.title);
  favoriteButton.addEventListener("click", () => onToggleFavorite(movie));
  actions.appendChild(favoriteButton);
  copy.appendChild(actions);

  inner.appendChild(copy);
  heroElement.append(media, inner);
}

export function renderHeroLoading(heroElement) {
  heroElement.className = "hero";
  heroElement.setAttribute("aria-busy", "true");
  heroElement.replaceChildren();

  const media = createElement("div", "hero-media skeleton");
  const inner = createElement("div", "hero-inner shell");
  const loading = createElement("div", "hero-loading");
  const copy = createElement("div", "hero-loading-copy");
  copy.setAttribute("aria-hidden", "true");
  for (let index = 0; index < 4; index += 1) copy.appendChild(createElement("span", "skeleton"));
  const heading = createElement("h1", "visually-hidden", "Memuat film pilihan");
  heading.id = "hero-title";
  loading.append(copy, heading);
  inner.appendChild(loading);
  heroElement.append(media, inner);
}

export function renderHeroUnavailable(heroElement, { configured = true, message = "" } = {}) {
  heroElement.className = "hero hero-unavailable";
  heroElement.setAttribute("aria-busy", "false");
  heroElement.replaceChildren();

  const inner = createElement("div", "hero-inner shell");
  const copy = createElement("div", "hero-copy");
  const eyebrow = createElement("p", "eyebrow", configured ? "Ruang film" : "Mulai dari sini");
  const title = createElement(
    "h1",
    "",
    configured ? "Film pilihan belum tersedia." : "Temukan film berikutnya.",
  );
  title.id = "hero-title";
  const copyText = createElement(
    "p",
    "",
    message ||
      (configured
        ? "Data film sedang tidak dapat dimuat. Coba lagi dari bagian di bawah."
        : "Tambahkan API key TMDB di config.js untuk mulai menjelajahi film, poster, dan detail dari katalog TMDB."),
  );
  copy.append(eyebrow, title, copyText);
  inner.appendChild(copy);
  heroElement.appendChild(inner);
}

export function renderDialogLoading(elements) {
  elements.loading.hidden = false;
  elements.content.hidden = true;
  elements.error.hidden = true;
}

export function renderDialogError(elements, message, onRetry) {
  elements.loading.hidden = true;
  elements.content.hidden = true;
  elements.error.hidden = false;
  elements.errorMessage.textContent = message;
  elements.retry.onclick = onRetry;
}

function createMetaItem(iconName, text) {
  const item = createElement("span");
  item.appendChild(createIcon(iconName));
  item.appendChild(createElement("span", "", text));
  return item;
}

export function renderDialogDetails(elements, movie, { genreNames = [], isFavorite }) {
  dialogFavoriteMovie = movie;
  elements.loading.hidden = true;
  elements.error.hidden = true;
  elements.content.hidden = false;

  setText(elements.title, movie.title, "Judul tidak tersedia");
  setText(
    elements.overview,
    movie.overview,
    "Sinopsis belum tersedia untuk film ini.",
  );
  setText(elements.release, formatDate(movie.releaseDate));
  setText(elements.genres, genreNames.join(", "), "Genre belum tersedia.");
  setText(elements.runtime, formatRuntime(movie.runtime));
  setText(elements.language, formatLanguage(movie.originalLanguage));
  setText(elements.status, movie.status, "Status belum tersedia.");

  const rating = formatRating(movie.voteAverage);
  const votes = formatVoteCount(movie.voteCount);
  setText(
    elements.votes,
    rating
      ? `${rating} / 10${movie.voteCount ? ` · ${votes} suara` : ""}`
      : "Belum ada rating.",
  );

  elements.meta.replaceChildren();
  if (rating) elements.meta.appendChild(createMetaItem("star", `${rating} / 10`));
  elements.meta.appendChild(createMetaItem("film", formatYear(movie.releaseDate)));
  if (movie.runtime) elements.meta.appendChild(createMetaItem("info", formatRuntime(movie.runtime)));
  if (movie.status) elements.meta.appendChild(createMetaItem("info", movie.status));

  const backdropUrl = getImageUrl(movie.backdropPath, BACKDROP_SIZE);
  elements.backdrop.style.backgroundImage = backdropUrl ? `url("${backdropUrl}")` : "none";

  elements.poster.replaceChildren();
  const imageUrl = getImageUrl(movie.posterPath, POSTER_SIZE);
  if (imageUrl) {
    const image = document.createElement("img");
    image.src = imageUrl;
    image.alt = `Poster ${movie.title}`;
    image.decoding = "async";
    image.addEventListener(
      "error",
      () => {
        elements.poster.replaceChildren(createPosterPlaceholder());
      },
      { once: true },
    );
    elements.poster.appendChild(image);
  } else {
    elements.poster.appendChild(createPosterPlaceholder());
  }

  elements.favorite.dataset.favoriteId = String(movie.id);
  elements.favorite.dataset.movieTitle = movie.title;
  updateFavoriteButton(elements.favorite, isFavorite(movie.id), movie.title);
  elements.favorite.hidden = false;
}

export function getDialogMovie() {
  return dialogFavoriteMovie;
}

export function populateGenreSelect(select, genres, selectedValue = "") {
  const current = String(selectedValue || "");
  select.replaceChildren();
  const all = document.createElement("option");
  all.value = "";
  all.textContent = "Semua genre";
  select.appendChild(all);

  for (const genre of genres) {
    const option = document.createElement("option");
    option.value = String(genre.id);
    option.textContent = genre.name;
    select.appendChild(option);
  }
  select.value = genres.some((genre) => String(genre.id) === current) ? current : "";
}

export function renderFilterChips(container, { genreName, sortLabel, onRemoveGenre, onRemoveSort }) {
  container.replaceChildren();
  const chips = [];

  if (genreName) {
    const chip = createElement("span", "filter-chip");
    chip.appendChild(createElement("span", "", `Genre: ${genreName}`));
    const remove = createElement("button");
    remove.type = "button";
    remove.setAttribute("aria-label", `Hapus filter genre ${genreName}`);
    remove.appendChild(createIcon("close"));
    remove.addEventListener("click", onRemoveGenre);
    chip.appendChild(remove);
    chips.push(chip);
  }

  if (sortLabel) {
    const chip = createElement("span", "filter-chip");
    chip.appendChild(createElement("span", "", `Urutan: ${sortLabel}`));
    const remove = createElement("button");
    remove.type = "button";
    remove.setAttribute("aria-label", `Kembalikan urutan ke popularitas`);
    remove.appendChild(createIcon("close"));
    remove.addEventListener("click", onRemoveSort);
    chip.appendChild(remove);
    chips.push(chip);
  }

  container.append(...chips);
  container.hidden = chips.length === 0;
}

export function showToast(message, tone = "success") {
  const toast = document.getElementById("toast");
  if (!toast) return;
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.toggle("is-error", tone === "error");
  toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 3200);
}

export function announce(message) {
  const region = document.getElementById("sr-status");
  if (!region) return;
  region.textContent = "";
  window.setTimeout(() => {
    region.textContent = message;
  }, 20);
}

export function setLoadingButton(button, loading, loadingLabel = "Memuat…") {
  if (!button) return;
  if (loading) {
    button.dataset.originalLabel = button.textContent.trim();
    button.textContent = loadingLabel;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
  } else {
    button.textContent = button.dataset.originalLabel || button.textContent;
    button.disabled = false;
    button.removeAttribute("aria-busy");
    delete button.dataset.originalLabel;
  }
}

export function updateFavoritesCount(count) {
  const badge = document.getElementById("favorites-count");
  if (!badge) return;
  badge.textContent = String(count);
  badge.hidden = count === 0;
}
