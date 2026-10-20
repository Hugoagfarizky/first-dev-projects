import {
  ApiError,
  discoverMovies,
  getMovieDetails,
  getMovieGenres,
  getPopularMovies,
  getTopRatedMovies,
  getTrendingMovies,
  getUpcomingMovies,
  isAbortError,
  isConfigured,
  searchMovies,
} from "./api.js";
import {
  getFavorites,
  getFavoritesCount,
  isFavorite,
  subscribeToFavorites,
  toggleFavorite,
} from "./favorites.js";
import {
  announce,
  hideState,
  populateGenreSelect,
  renderDialogDetails,
  renderDialogError,
  renderDialogLoading,
  renderFilterChips,
  renderHero,
  renderHeroLoading,
  renderHeroUnavailable,
  renderMovieGrid,
  renderSkeletonGrid,
  renderState,
  setLoadingButton,
  showToast,
  syncFavoriteButtons,
  updateFavoriteButton,
  updateFavoritesCount,
} from "./ui.js";
import {
  debounce,
  filterByGenre,
  getSafeText,
  mergeUniqueMovies,
  sortMovies,
} from "./utils.js";

const DEFAULT_SORT = "popularity.desc";
const SORT_LABELS = {
  "popularity.desc": "Popularitas",
  "vote_average.desc": "Rating tertinggi",
};
const SECTION_ENDPOINTS = {
  trending: getTrendingMovies,
  popular: getPopularMovies,
  top_rated: getTopRatedMovies,
  upcoming: getUpcomingMovies,
};
const HOME_SECTIONS = ["trending", "popular", "top_rated", "upcoming"];
const HOME_SECTION_LIMIT = 6;
const VIEWS = new Set(["home", "discover", "favorites"]);

const dom = {
  header: document.getElementById("site-header"),
  menuToggle: document.getElementById("menu-toggle"),
  primaryNav: document.getElementById("primary-nav"),
  navLinks: [...document.querySelectorAll(".nav-link")],
  configNotice: document.getElementById("config-notice"),
  views: {
    home: document.getElementById("view-home"),
    discover: document.getElementById("view-discover"),
    favorites: document.getElementById("view-favorites"),
  },
  hero: document.getElementById("hero"),
  sections: {
    trending: {
      element: document.getElementById("section-trending"),
      grid: document.getElementById("trending-grid"),
      state: document.getElementById("trending-state"),
    },
    popular: {
      element: document.getElementById("section-popular"),
      grid: document.getElementById("popular-grid"),
      state: document.getElementById("popular-state"),
    },
    top_rated: {
      element: document.getElementById("section-top-rated"),
      grid: document.getElementById("top-rated-grid"),
      state: document.getElementById("top-rated-state"),
    },
    upcoming: {
      element: document.getElementById("section-upcoming"),
      grid: document.getElementById("upcoming-grid"),
      state: document.getElementById("upcoming-state"),
    },
  },
  searchForm: document.getElementById("search-form"),
  searchInput: document.getElementById("search-input"),
  searchButton: document.getElementById("search-button"),
  clearSearch: document.getElementById("clear-search"),
  searchFeedback: document.getElementById("search-feedback"),
  genreFilter: document.getElementById("genre-filter"),
  sortFilter: document.getElementById("sort-filter"),
  clearFilters: document.getElementById("clear-filters"),
  activeFilters: document.getElementById("active-filters"),
  resultsTitle: document.getElementById("results-title"),
  resultsCount: document.getElementById("results-count"),
  discoverGrid: document.getElementById("discover-grid"),
  discoverState: document.getElementById("discover-state"),
  loadMore: document.getElementById("load-more"),
  favoritesGrid: document.getElementById("favorites-grid"),
  favoritesState: document.getElementById("favorites-state"),
  favoritesSummary: document.getElementById("favorites-summary"),
  dialog: document.getElementById("movie-dialog"),
  dialogClose: document.getElementById("dialog-close"),
  dialogLoading: document.getElementById("dialog-loading"),
  dialogContent: document.getElementById("dialog-content"),
  dialogError: document.getElementById("dialog-error"),
  dialogErrorMessage: document.getElementById("dialog-error-message"),
  dialogRetry: document.getElementById("dialog-retry"),
  dialogErrorClose: document.getElementById("dialog-error-close"),
  dialogTitle: document.getElementById("dialog-title"),
  dialogMeta: document.getElementById("dialog-meta"),
  dialogOverview: document.getElementById("dialog-overview"),
  dialogRelease: document.getElementById("dialog-release"),
  dialogGenres: document.getElementById("dialog-genres"),
  dialogRuntime: document.getElementById("dialog-runtime"),
  dialogLanguage: document.getElementById("dialog-language"),
  dialogStatus: document.getElementById("dialog-status"),
  dialogVotes: document.getElementById("dialog-votes"),
  dialogBackdrop: document.getElementById("dialog-backdrop"),
  dialogPoster: document.getElementById("dialog-poster"),
  dialogFavorite: document.getElementById("dialog-favorite"),
};

const state = {
  view: "home",
  configured: isConfigured(),
  genres: [],
  genresStatus: "idle",
  genresError: "",
  home: {
    status: "idle",
    heroMovie: null,
    sections: Object.fromEntries(
      HOME_SECTIONS.map((name) => [name, { status: "idle", movies: [], error: "" }]),
    ),
  },
  discover: {
    query: "",
    genreId: "",
    sortBy: DEFAULT_SORT,
    page: 1,
    totalPages: 1,
    totalResults: 0,
    rawItems: [],
    items: [],
    status: "idle",
    error: "",
    controller: null,
    requestId: 0,
  },
  details: {
    movie: null,
    status: "idle",
    controller: null,
    requestId: 0,
    trigger: null,
  },
  detailsCache: new Map(),
  toast: null,
  menuOpen: false,
};

const debouncedSearch = debounce(() => {
  const query = getSafeText(dom.searchInput.value);
  if (!query) return;
  state.discover.query = query;
  loadDiscover({ reset: true });
}, 450);

function getGenresById() {
  return new Map(state.genres.map((genre) => [genre.id, genre.name]));
}

function getGenreNames(genreIds) {
  if (!Array.isArray(genreIds)) return [];
  const byId = getGenresById();
  return genreIds.map((id) => byId.get(id)).filter(Boolean);
}

function setSearchAvailability(enabled) {
  dom.searchInput.disabled = !enabled;
  dom.searchButton.disabled = !enabled;
  dom.clearSearch.disabled = !enabled;
  dom.genreFilter.disabled = !enabled;
  dom.sortFilter.disabled = !enabled;
  dom.searchInput.placeholder = enabled
    ? "Cari judul film…"
    : "Aktifkan API key untuk mencari film";
}

function applyConfigurationState() {
  dom.configNotice.hidden = state.configured;
  setSearchAvailability(state.configured);
  HOME_SECTIONS.forEach((name) => {
    dom.sections[name].element.hidden = !state.configured || (name === "upcoming" && state.home.sections[name].status === "idle");
    if (!state.configured) {
      dom.sections[name].grid.replaceChildren();
      dom.sections[name].element.hidden = true;
    }
  });

  if (!state.configured) {
    renderHeroUnavailable(dom.hero, {
      configured: false,
      message:
        "Tambahkan API key TMDB di config.js untuk mulai menjelajahi film, poster, dan detail dari katalog TMDB.",
    });
    hideState(dom.discoverState);
    dom.discoverGrid.replaceChildren();
    dom.discoverGrid.hidden = true;
    dom.loadMore.hidden = true;
    dom.resultsCount.textContent = "";
    renderState(dom.discoverState, {
      type: "error",
      title: "API key TMDB belum diatur",
      message:
        "Salin config.example.js menjadi config.js, lalu isi tmdbApiKey. Setelah itu muat ulang halaman.",
      className: "state-panel",
    });
    dom.searchFeedback.textContent =
      "Pencarian memerlukan API key TMDB. Lihat petunjuk konfigurasi di bagian atas halaman.";
  }
}

function getRouteFromHash() {
  const route = window.location.hash.replace(/^#/, "").split("/")[0];
  return VIEWS.has(route) ? route : "home";
}

function setDocumentTitle() {
  if (state.view === "discover") {
    document.title = state.discover.query
      ? `Cari “${state.discover.query}” — Movie Explorer`
      : "Jelajahi film — Movie Explorer";
    return;
  }
  if (state.view === "favorites") {
    document.title = "Film favorit — Movie Explorer";
    return;
  }
  document.title = "Movie Explorer — Temukan film berikutnya";
}

function renderView(route) {
  state.view = route;
  Object.entries(dom.views).forEach(([name, element]) => {
    element.hidden = name !== route;
  });
  dom.navLinks.forEach((link) => {
    if (link.dataset.nav === route) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  closeMenu();
  setDocumentTitle();

  if (route === "home") {
    if (state.configured) loadHome();
  } else if (route === "discover") {
    if (state.configured) {
      ensureGenres();
      if (state.discover.status === "idle") loadDiscover({ reset: true });
      else renderDiscoverState();
    }
  } else if (route === "favorites") {
    renderFavorites();
  }
}

function handleRouteChange() {
  const route = getRouteFromHash();
  renderView(route);
  if (window.scrollY > 24) window.scrollTo({ top: 0, behavior: "auto" });
}

async function ensureGenres() {
  if (!state.configured || state.genresStatus === "loading" || state.genresStatus === "ready") {
    return;
  }
  state.genresStatus = "loading";
  state.genresError = "";
  dom.genreFilter.disabled = true;
  try {
    state.genres = await getMovieGenres();
    state.genresStatus = "ready";
    populateGenreSelect(dom.genreFilter, state.genres, state.discover.genreId);
    dom.genreFilter.disabled = false;
    if (state.home.heroMovie) renderHomeHero();
    if (state.view === "discover") updateFilterUI();
  } catch (error) {
    state.genresStatus = "error";
    state.genresError = error instanceof ApiError ? error.message : "Genre tidak dapat dimuat.";
    populateGenreSelect(dom.genreFilter, [], "");
    dom.genreFilter.disabled = true;
    if (state.view === "discover") {
      showToast("Daftar genre tidak dapat dimuat. Pencarian tetap tersedia.", "error");
    }
  }
}

function setSectionLoading(name) {
  const section = state.home.sections[name];
  const refs = dom.sections[name];
  section.status = "loading";
  section.error = "";
  refs.element.hidden = false;
  refs.grid.hidden = false;
  hideState(refs.state);
  renderSkeletonGrid(refs.grid, HOME_SECTION_LIMIT);
}

function renderSectionResult(name, result) {
  const refs = dom.sections[name];
  const section = state.home.sections[name];

  if (result.status === "fulfilled") {
    const movies = result.value.results.slice(0, HOME_SECTION_LIMIT);
    section.status = movies.length ? "ready" : "empty";
    section.movies = movies;
    section.error = "";
    refs.element.hidden = name === "upcoming" && movies.length === 0;
    refs.grid.hidden = false;
    hideState(refs.state);
    if (movies.length) {
      renderMovieGrid(refs.grid, movies, {
        onOpen: openDetails,
        onToggleFavorite: handleFavoriteToggle,
        isFavorite,
      });
    } else {
      refs.grid.replaceChildren();
      renderState(refs.state, {
        type: "empty",
        title: "Belum ada film di daftar ini",
        message: "TMDB tidak mengembalikan film untuk bagian ini saat ini.",
        className: "shelf-state",
      });
    }
    return;
  }

  section.status = "error";
  section.movies = [];
  section.error =
    result.reason instanceof ApiError
      ? result.reason.message
      : "Daftar film tidak dapat dimuat.";
  refs.element.hidden = name === "upcoming";
  refs.grid.replaceChildren();
  refs.grid.hidden = true;
  if (name !== "upcoming") {
    renderState(refs.state, {
      type: "error",
      title: "Bagian ini belum bisa dimuat",
      message: section.error,
      actionLabel: "Coba lagi",
      onAction: () => retryHomeSection(name),
      className: "shelf-state",
    });
  }
}

function pickHeroMovie() {
  for (const name of ["trending", "popular", "top_rated", "upcoming"]) {
    const movie = state.home.sections[name].movies[0];
    if (movie) return movie;
  }
  return null;
}

function renderHomeHero() {
  const movie = state.home.heroMovie;
  if (!movie) {
    renderHeroUnavailable(dom.hero, {
      configured: true,
      message: "Data film sedang tidak dapat dimuat. Coba lagi dari bagian di bawah.",
    });
    return;
  }
  renderHero(dom.hero, movie, {
    genreNames: getGenreNames(movie.genreIds),
    onOpen: openDetails,
    onToggleFavorite: handleFavoriteToggle,
    isFavorite,
  });
}

async function loadHome() {
  if (!state.configured) return;
  if (state.home.status === "loading" || state.home.status === "ready") return;
  state.home.status = "loading";
  renderHeroLoading(dom.hero);
  HOME_SECTIONS.forEach((name) => {
    if (name === "upcoming") dom.sections[name].element.hidden = false;
    setSectionLoading(name);
  });

  const results = await Promise.allSettled(
    HOME_SECTIONS.map((name) => SECTION_ENDPOINTS[name]()),
  );

  HOME_SECTIONS.forEach((name, index) => {
    renderSectionResult(name, results[index]);
  });

  state.home.heroMovie = pickHeroMovie();
  renderHomeHero();
  state.home.status = state.home.heroMovie ? "ready" : "error";

  if (!state.home.heroMovie) {
    renderHeroUnavailable(dom.hero, {
      configured: true,
      message: "TMDB belum mengembalikan data film yang bisa ditampilkan. Coba lagi nanti.",
    });
  }
}

async function retryHomeSection(name) {
  if (!state.configured) return;
  setSectionLoading(name);
  try {
    const data = await SECTION_ENDPOINTS[name]();
    renderSectionResult(name, { status: "fulfilled", value: data });
    if (!state.home.heroMovie) {
      state.home.heroMovie = pickHeroMovie();
      renderHomeHero();
    }
    state.home.status = "ready";
  } catch (error) {
    renderSectionResult(name, { status: "rejected", reason: error });
  }
}

function getMode() {
  return state.discover.query ? "search" : "discover";
}

function applyLocalFilters() {
  if (getMode() === "discover") return [...state.discover.rawItems];
  return sortMovies(
    filterByGenre(state.discover.rawItems, state.discover.genreId),
    state.discover.sortBy,
  );
}

function getActiveGenreName() {
  return state.genres.find((genre) => String(genre.id) === String(state.discover.genreId))?.name || "";
}

function updateResultsHeading() {
  dom.resultsTitle.textContent = state.discover.query
    ? `Hasil untuk “${state.discover.query}”`
    : "Jelajahi film";

  if (state.discover.status === "loading" || state.discover.status === "idle") {
    dom.resultsCount.textContent = "";
    return;
  }

  if (state.discover.status === "error") {
    dom.resultsCount.textContent = "";
    return;
  }

  const displayed = state.discover.items.length;
  const loaded = state.discover.rawItems.length;
  const total = state.discover.totalResults;
  if (getMode() === "search" && loaded > displayed) {
    dom.resultsCount.textContent = `${displayed} cocok dari ${loaded} hasil yang dimuat`;
  } else if (total > 0) {
    dom.resultsCount.textContent = `${displayed} film dimuat dari ${total} hasil`;
  } else {
    dom.resultsCount.textContent = displayed ? `${displayed} film` : "";
  }
}

function updateFilterUI() {
  dom.genreFilter.value = state.discover.genreId;
  dom.sortFilter.value = state.discover.sortBy;
  const hasFilters =
    Boolean(state.discover.genreId) || state.discover.sortBy !== DEFAULT_SORT;
  dom.clearFilters.hidden = !hasFilters;

  const genreName = getActiveGenreName();
  renderFilterChips(dom.activeFilters, {
    genreName,
    sortLabel: state.discover.sortBy !== DEFAULT_SORT ? SORT_LABELS[state.discover.sortBy] : "",
    onRemoveGenre: () => {
      state.discover.genreId = "";
      handleFilterChange();
    },
    onRemoveSort: () => {
      state.discover.sortBy = DEFAULT_SORT;
      handleFilterChange();
    },
  });

  updateResultsHeading();
}

function renderDiscoverGrid() {
  if (!state.discover.items.length) {
    dom.discoverGrid.replaceChildren();
    dom.discoverGrid.hidden = true;
    return;
  }
  dom.discoverGrid.hidden = false;
  renderMovieGrid(dom.discoverGrid, state.discover.items, {
    onOpen: openDetails,
    onToggleFavorite: handleFavoriteToggle,
    isFavorite,
  });
}

function renderDiscoverEmpty() {
  const hasFilters = Boolean(state.discover.genreId) || state.discover.sortBy !== DEFAULT_SORT;
  const hasMore = state.discover.page < state.discover.totalPages;
  if (!state.discover.items.length) {
    if (state.discover.query) {
      renderState(dom.discoverState, {
        type: "empty",
        title: "Tidak ada hasil yang cocok",
        message: hasFilters
          ? "Tidak ada film pada hasil yang dimuat yang cocok dengan filter ini. Coba hapus filter atau muat lebih banyak."
          : `TMDB tidak menemukan film untuk “${state.discover.query}”. Coba kata kunci lain.`,
        actionLabel: hasFilters ? "Reset filter" : "Hapus pencarian",
        onAction: hasFilters ? resetFilters : clearSearchAndReload,
        className: "state-panel",
      });
    } else {
      renderState(dom.discoverState, {
        type: "empty",
        title: "Belum ada film",
        message: hasFilters
          ? "Kombinasi filter ini tidak mengembalikan film. Coba genre atau urutan lain."
          : "TMDB belum mengembalikan film untuk katalog ini.",
        actionLabel: hasFilters ? "Reset filter" : "",
        onAction: hasFilters ? resetFilters : null,
        className: "state-panel",
      });
    }
    if (hasMore) {
      dom.loadMore.hidden = false;
    }
    return;
  }

  hideState(dom.discoverState);
}

function renderDiscoverState() {
  if (state.discover.status === "loading" || state.discover.status === "idle") {
    dom.discoverGrid.hidden = false;
    hideState(dom.discoverState);
    dom.loadMore.hidden = true;
    renderSkeletonGrid(dom.discoverGrid, 12);
    updateResultsHeading();
    updateFilterUI();
    return;
  }

  if (state.discover.status === "error") {
    dom.discoverGrid.hidden = true;
    dom.discoverGrid.replaceChildren();
    dom.loadMore.hidden = true;
    renderState(dom.discoverState, {
      type: "error",
      title: "Pencarian belum berhasil",
      message: state.discover.error || "Data film tidak dapat dimuat.",
      actionLabel: "Coba lagi",
      onAction: () => loadDiscover({ reset: true }),
      className: "state-panel",
    });
    updateResultsHeading();
    updateFilterUI();
    return;
  }

  renderDiscoverGrid();
  renderDiscoverEmpty();
  dom.loadMore.hidden = !(state.discover.page < state.discover.totalPages);
  updateResultsHeading();
  updateFilterUI();
}

async function loadDiscover({ reset = true } = {}) {
  if (!state.configured) return;
  if (state.discover.status === "loading" && !reset) return;
  if (!reset && state.discover.page >= state.discover.totalPages) return;

  state.discover.controller?.abort();
  const controller = new AbortController();
  state.discover.controller = controller;
  state.discover.requestId += 1;
  const requestId = state.discover.requestId;
  const page = reset ? 1 : state.discover.page + 1;
  const query = state.discover.query;
  const mode = getMode();

  if (reset) {
    state.discover.status = "loading";
    state.discover.items = [];
    state.discover.rawItems = [];
    dom.discoverGrid.hidden = false;
    dom.discoverGrid.setAttribute("aria-busy", "true");
    hideState(dom.discoverState);
    dom.loadMore.hidden = true;
    renderSkeletonGrid(dom.discoverGrid, 12);
  } else {
    state.discover.status = "loading-more";
    dom.discoverGrid.setAttribute("aria-busy", "true");
    setLoadingButton(dom.loadMore, true, "Memuat…");
  }

  updateResultsHeading();
  updateFilterUI();

  try {
    const data =
      mode === "search"
        ? await searchMovies({ query, page, signal: controller.signal })
        : await discoverMovies({
            genreId: state.discover.genreId,
            sortBy: state.discover.sortBy,
            page,
            signal: controller.signal,
          });

    if (requestId !== state.discover.requestId) return;

    state.discover.rawItems = reset
      ? data.results
      : mergeUniqueMovies(state.discover.rawItems, data.results);
    state.discover.items =
      mode === "search" ? applyLocalFilters() : [...state.discover.rawItems];
    state.discover.page = data.page || page;
    state.discover.totalPages = data.totalPages || 1;
    state.discover.totalResults = data.totalResults || 0;
    state.discover.status = "ready";
    state.discover.error = "";
    dom.discoverGrid.setAttribute("aria-busy", "false");
    setLoadingButton(dom.loadMore, false);

    const loadedCount = state.discover.items.length;
    announce(loadedCount ? `${loadedCount} film ditampilkan.` : "Tidak ada film ditemukan.");
    renderDiscoverState();
  } catch (error) {
    if (isAbortError(error) || requestId !== state.discover.requestId) return;
    setLoadingButton(dom.loadMore, false);
    dom.discoverGrid.setAttribute("aria-busy", "false");
    const message =
      error instanceof ApiError ? error.message : "Terjadi kesalahan saat mengambil data film.";
    if (reset) {
      state.discover.status = "error";
      state.discover.error = message;
      state.discover.items = [];
      state.discover.rawItems = [];
      renderDiscoverState();
    } else {
      state.discover.status = "ready";
      showToast(message, "error");
      renderDiscoverState();
    }
  }
}

function handleFilterChange() {
  if (!state.configured) return;
  if (getMode() === "search") {
    state.discover.items = applyLocalFilters();
    state.discover.status = "ready";
    renderDiscoverState();
    return;
  }
  loadDiscover({ reset: true });
}

function resetFilters() {
  state.discover.genreId = "";
  state.discover.sortBy = DEFAULT_SORT;
  updateFilterUI();
  if (state.configured) {
    if (getMode() === "search") {
      state.discover.items = applyLocalFilters();
      renderDiscoverState();
    } else {
      loadDiscover({ reset: true });
    }
  }
}

function clearSearchAndReload() {
  debouncedSearch.cancel();
  dom.searchInput.value = "";
  dom.clearSearch.hidden = true;
  state.discover.query = "";
  setSearchFeedback("Tekan Enter atau tombol Cari. Pencarian berjalan otomatis saat Anda berhenti mengetik.");
  if (state.configured) loadDiscover({ reset: true });
  dom.searchInput.focus();
}

function setSearchFeedback(message, isError = false) {
  dom.searchFeedback.textContent = message;
  dom.searchFeedback.classList.toggle("is-error", isError);
  dom.searchInput.setAttribute("aria-invalid", isError ? "true" : "false");
}

function handleSearchInput() {
  const query = getSafeText(dom.searchInput.value);
  dom.clearSearch.hidden = !dom.searchInput.value;
  if (dom.searchInput.value && !query) {
    debouncedSearch.cancel();
    return;
  }
  setSearchFeedback(
    query
      ? "Pencarian berjalan otomatis saat Anda berhenti mengetik."
      : "Tekan Enter atau tombol Cari. Pencarian berjalan otomatis saat Anda berhenti mengetik.",
  );
  debouncedSearch.cancel();
  if (!query) {
    if (state.discover.query) {
      state.discover.query = "";
      if (state.configured) loadDiscover({ reset: true });
    }
    return;
  }
  debouncedSearch();
}

function handleSearchSubmit(event) {
  event.preventDefault();
  debouncedSearch.cancel();
  const query = getSafeText(dom.searchInput.value);
  if (!query) {
    setSearchFeedback("Masukkan judul film terlebih dahulu.", true);
    dom.searchInput.focus();
    return;
  }
  setSearchFeedback("Tekan Enter atau tombol Cari. Pencarian berjalan otomatis saat Anda berhenti mengetik.");
  state.discover.query = query;
  loadDiscover({ reset: true });
}

function renderFavorites() {
  const favorites = getFavorites();
  dom.favoritesSummary.textContent = favorites.length
    ? `${favorites.length} film tersimpan di browser ini.`
    : "Belum ada film di daftar favorit.";
  updateFavoritesCount(favorites.length);

  if (!favorites.length) {
    dom.favoritesGrid.hidden = true;
    dom.favoritesGrid.replaceChildren();
    renderState(dom.favoritesState, {
      type: "empty",
      title: "Daftar favoritmu masih kosong",
      message:
        "Tekan ikon hati pada kartu film atau detail film untuk menyimpannya di sini.",
      actionLabel: "Jelajahi film",
      onAction: () => {
        window.location.hash = "#discover";
      },
      className: "state-panel",
    });
    return;
  }

  hideState(dom.favoritesState);
  dom.favoritesGrid.hidden = false;
  renderMovieGrid(dom.favoritesGrid, favorites, {
    onOpen: openDetails,
    onToggleFavorite: handleFavoriteToggle,
    isFavorite,
  });
}

function handleFavoriteToggle(movie) {
  try {
    const result = toggleFavorite(movie);
    updateFavoritesCount(result.favorites.length);
    syncFavoriteButtons(document, isFavorite);
    if (state.details.movie?.id === movie.id) {
      updateFavoriteButton(dom.dialogFavorite, isFavorite(movie.id), movie.title);
    }
    if (state.view === "favorites") renderFavorites();
    showToast(
      result.added
        ? `${movie.title} ditambahkan ke favorit.`
        : `${movie.title} dihapus dari favorit.`,
    );
  } catch (error) {
    showToast(error.message || "Favorit tidak dapat diperbarui.", "error");
  }
}

function openDetails(movie) {
  if (!movie) return;
  state.details.movie = movie;
  state.details.trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  renderDialogLoading({
    loading: dom.dialogLoading,
    content: dom.dialogContent,
    error: dom.dialogError,
  });
  dom.dialogTitle.textContent = movie.title;

  if (!dom.dialog.open) {
    dom.dialog.showModal();
    document.body.classList.add("dialog-open");
    dom.dialogClose.focus();
  }

  const cached = state.detailsCache.get(movie.id);
  if (cached) {
    renderDialogMovie(cached);
    return;
  }

  if (!state.configured) {
    renderDialogError(
      {
        loading: dom.dialogLoading,
        content: dom.dialogContent,
        error: dom.dialogError,
        errorMessage: dom.dialogErrorMessage,
        retry: dom.dialogRetry,
      },
      "Detail film memerlukan API key TMDB. Isi config.js lalu muat ulang halaman.",
      () => openDetails(movie),
    );
    return;
  }

  loadDetails(movie);
}

async function loadDetails(movie) {
  state.details.controller?.abort();
  const controller = new AbortController();
  state.details.controller = controller;
  state.details.requestId += 1;
  const requestId = state.details.requestId;
  renderDialogLoading({
    loading: dom.dialogLoading,
    content: dom.dialogContent,
    error: dom.dialogError,
  });

  try {
    const details = await getMovieDetails(movie.id, { signal: controller.signal });
    if (requestId !== state.details.requestId) return;
    state.detailsCache.set(movie.id, details);
    state.details.movie = details;
    renderDialogMovie(details);
  } catch (error) {
    if (isAbortError(error) || requestId !== state.details.requestId) return;
    renderDialogError(
      {
        loading: dom.dialogLoading,
        content: dom.dialogContent,
        error: dom.dialogError,
        errorMessage: dom.dialogErrorMessage,
        retry: dom.dialogRetry,
      },
      error instanceof ApiError ? error.message : "Detail film tidak dapat dimuat.",
      () => loadDetails(movie),
    );
  }
}

function renderDialogMovie(movie) {
  state.details.movie = movie;
  renderDialogDetails(
    {
      loading: dom.dialogLoading,
      content: dom.dialogContent,
      error: dom.dialogError,
      title: dom.dialogTitle,
      meta: dom.dialogMeta,
      overview: dom.dialogOverview,
      release: dom.dialogRelease,
      genres: dom.dialogGenres,
      runtime: dom.dialogRuntime,
      language: dom.dialogLanguage,
      status: dom.dialogStatus,
      votes: dom.dialogVotes,
      backdrop: dom.dialogBackdrop,
      poster: dom.dialogPoster,
      favorite: dom.dialogFavorite,
    },
    movie,
    {
      genreNames: Array.isArray(movie.genres)
        ? movie.genres.map((genre) => genre.name).filter(Boolean)
        : getGenreNames(movie.genreIds),
      isFavorite,
    },
  );
}

function closeDetails() {
  if (dom.dialog.open) dom.dialog.close();
}

function toggleMenu(force) {
  const open = typeof force === "boolean" ? force : !state.menuOpen;
  state.menuOpen = open;
  dom.menuToggle.setAttribute("aria-expanded", String(open));
  dom.primaryNav.classList.toggle("is-open", open);
  dom.menuToggle.querySelector(".visually-hidden").textContent = open
    ? "Tutup menu navigasi"
    : "Buka menu navigasi";
}

function closeMenu() {
  if (state.menuOpen) toggleMenu(false);
}

function bindEvents() {
  window.addEventListener("hashchange", handleRouteChange);

  dom.menuToggle.addEventListener("click", () => toggleMenu());

  dom.navLinks.forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  document.addEventListener("click", (event) => {
    if (!state.menuOpen) return;
    if (!dom.header.contains(event.target)) closeMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.menuOpen) {
      closeMenu();
      dom.menuToggle.focus();
    }
  });

  window.addEventListener(
    "resize",
    () => {
      if (window.innerWidth > 864) closeMenu();
    },
    { passive: true },
  );

  window.addEventListener(
    "scroll",
    () => {
      dom.header.classList.toggle("is-scrolled", window.scrollY > 8);
    },
    { passive: true },
  );

  dom.searchForm.addEventListener("submit", handleSearchSubmit);
  dom.searchInput.addEventListener("input", handleSearchInput);

  dom.clearSearch.addEventListener("click", clearSearchAndReload);

  dom.genreFilter.addEventListener("change", () => {
    state.discover.genreId = dom.genreFilter.value;
    handleFilterChange();
  });

  dom.sortFilter.addEventListener("change", () => {
    state.discover.sortBy = dom.sortFilter.value;
    handleFilterChange();
  });

  dom.clearFilters.addEventListener("click", resetFilters);
  dom.loadMore.addEventListener("click", () => loadDiscover({ reset: false }));

  dom.dialogClose.addEventListener("click", closeDetails);
  dom.dialogErrorClose.addEventListener("click", closeDetails);

  dom.dialog.addEventListener("click", (event) => {
    if (event.target === dom.dialog) closeDetails();
  });

  dom.dialog.addEventListener("close", () => {
    document.body.classList.remove("dialog-open");
    state.details.controller?.abort();
    const trigger = state.details.trigger;
    if (trigger && document.contains(trigger)) trigger.focus();
  });

  dom.dialogFavorite.addEventListener("click", () => {
    const movie = state.details.movie;
    if (movie) handleFavoriteToggle(movie);
  });

  subscribeToFavorites(() => {
    updateFavoritesCount(getFavoritesCount());
    syncFavoriteButtons(document, isFavorite);
    if (state.details.movie) {
      updateFavoriteButton(dom.dialogFavorite, isFavorite(state.details.movie.id), state.details.movie.title);
    }
    if (state.view === "favorites") renderFavorites();
  });
}

function initialize() {
  bindEvents();
  updateFavoritesCount(getFavoritesCount());
  applyConfigurationState();
  if (state.configured) ensureGenres();
  renderView(getRouteFromHash());
  if (!window.location.hash) {
    window.history.replaceState(null, "", "#home");
  }
}

initialize();

export { state };
