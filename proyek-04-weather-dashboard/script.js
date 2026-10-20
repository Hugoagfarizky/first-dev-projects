(() => {
  "use strict";

  const GEOCODING_ENDPOINT = "https://geocoding-api.open-meteo.com/v1/search";
  const FORECAST_ENDPOINT = "https://api.open-meteo.com/v1/forecast";
  const DEFAULT_LOCATION = Object.freeze({
    id: "default-jakarta",
    name: "Jakarta",
    admin1: "DKI Jakarta",
    country: "Indonesia",
    latitude: -6.2088,
    longitude: 106.8456,
    timezone: "Asia/Jakarta",
  });
  const REQUEST_TIMEOUT = 15000;
  const GEOLOCATION_TIMEOUT = 10000;
  const MAX_QUERY_LENGTH = 80;

  const WEATHER_CODES = {
    0: { label: "Cerah", icon: "clear" },
    1: { label: "Sebagian besar cerah", icon: "clear" },
    2: { label: "Berawan sebagian", icon: "partly" },
    3: { label: "Mendung", icon: "cloudy" },
    45: { label: "Berkabut", icon: "fog" },
    48: { label: "Kabut tebal", icon: "fog" },
    51: { label: "Gerimis ringan", icon: "drizzle" },
    53: { label: "Gerimis", icon: "drizzle" },
    55: { label: "Gerimis lebat", icon: "drizzle" },
    56: { label: "Gerimis beku ringan", icon: "drizzle" },
    57: { label: "Gerimis beku", icon: "drizzle" },
    61: { label: "Hujan ringan", icon: "rain" },
    63: { label: "Hujan", icon: "rain" },
    65: { label: "Hujan lebat", icon: "rain" },
    66: { label: "Hujan beku ringan", icon: "rain" },
    67: { label: "Hujan beku lebat", icon: "rain" },
    71: { label: "Salju ringan", icon: "snow" },
    73: { label: "Salju", icon: "snow" },
    75: { label: "Salju lebat", icon: "snow" },
    77: { label: "Butiran salju", icon: "snow" },
    80: { label: "Hujan lokal ringan", icon: "rain" },
    81: { label: "Hujan lokal", icon: "rain" },
    82: { label: "Hujan lokal lebat", icon: "rain" },
    85: { label: "Hujan salju ringan", icon: "snow" },
    86: { label: "Hujan salju lebat", icon: "snow" },
    95: { label: "Badai petir", icon: "thunder" },
    96: { label: "Badai petir dengan hujan es ringan", icon: "thunder" },
    99: { label: "Badai petir dengan hujan es lebat", icon: "thunder" },
  };

  const FALLBACK_WEATHER = { label: "Kondisi tidak diketahui", icon: "unknown" };

  const numberFormatter = new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 1,
  });
  const dateFormatter = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const shortDateFormatter = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  const weekdayFormatter = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    timeZone: "UTC",
  });
  const clockFormatter = new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const el = {
    searchForm: document.querySelector("#search-form"),
    cityInput: document.querySelector("#city-input"),
    searchButton: document.querySelector("#search-button"),
    searchError: document.querySelector("#search-error"),
    searchResults: document.querySelector("#search-results"),
    searchResultsCount: document.querySelector("#search-results-count"),
    searchResultsList: document.querySelector("#search-results-list"),
    loadingPanel: document.querySelector("#loading-panel"),
    loadingTitle: document.querySelector("#loading-title"),
    loadingMessage: document.querySelector("#loading-message"),
    errorPanel: document.querySelector("#error-panel"),
    errorTitle: document.querySelector("#error-title"),
    errorMessage: document.querySelector("#error-message"),
    retryButton: document.querySelector("#retry-button"),
    dashboard: document.querySelector("#dashboard"),
    currentCard: document.querySelector("#current-card"),
    locationName: document.querySelector("#location-name"),
    locationRegion: document.querySelector("#location-region"),
    dayBadge: document.querySelector("#day-badge"),
    currentIcon: document.querySelector("#current-icon"),
    currentTemperature: document.querySelector("#current-temperature"),
    currentDescription: document.querySelector("#current-description"),
    observationTime: document.querySelector("#observation-time"),
    feelsLike: document.querySelector("#feels-like"),
    humidity: document.querySelector("#humidity"),
    windSpeed: document.querySelector("#wind-speed"),
    precipitation: document.querySelector("#precipitation"),
    sunrise: document.querySelector("#sunrise"),
    sunset: document.querySelector("#sunset"),
    timezoneLabel: document.querySelector("#timezone-label"),
    updatedAt: document.querySelector("#updated-at"),
    hourlyList: document.querySelector("#hourly-list"),
    dailyList: document.querySelector("#daily-list"),
    srStatus: document.querySelector("#sr-status"),
    myLocationButton: document.querySelector("#my-location-button"),
    resetLocationButton: document.querySelector("#reset-location-button"),
  };

  const state = {
    loading: false,
    currentLocation: null,
    currentWeather: null,
    retryAction: null,
  };

  class WeatherAppError extends Error {
    constructor(message) {
      super(message);
      this.name = "WeatherAppError";
    }
  }

  function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
  }

  function isValidCoordinate(latitude, longitude) {
    return (
      isFiniteNumber(latitude) &&
      isFiniteNumber(longitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180
    );
  }

  function formatNumber(value) {
    if (!isFiniteNumber(value)) return "—";
    return numberFormatter.format(value);
  }

  function formatTemperature(value) {
    if (!isFiniteNumber(value)) return "—";
    return `${Math.round(value)}°`;
  }

  function formatWind(value) {
    if (!isFiniteNumber(value)) return "—";
    return `${formatNumber(value)} km/jam`;
  }

  function formatPrecipitation(value) {
    if (!isFiniteNumber(value)) return "—";
    return `${formatNumber(value)} mm`;
  }

  function formatProbability(value) {
    if (!isFiniteNumber(value)) return "—";
    return `${Math.round(value)}%`;
  }

  function formatDateParts(isoDate) {
    if (typeof isoDate !== "string") return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
    if (!match) return null;
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
    if (
      date.getUTCFullYear() !== Number(match[1]) ||
      date.getUTCMonth() !== Number(match[2]) - 1 ||
      date.getUTCDate() !== Number(match[3])
    ) {
      return null;
    }
    return date;
  }

  function formatDayName(isoDate, index) {
    const date = formatDateParts(isoDate);
    if (!date) return "Hari";
    if (index === 0) return "Hari ini";
    if (index === 1) return "Besok";
    return weekdayFormatter.format(date);
  }

  function formatDateOnly(isoDate) {
    const date = formatDateParts(isoDate);
    return date ? shortDateFormatter.format(date) : "—";
  }

  function formatHour(isoDateTime) {
    if (typeof isoDateTime !== "string" || isoDateTime.length < 16) return "—";
    return isoDateTime.slice(11, 16).replace(":", ".");
  }

  function formatObservationTime(isoDateTime) {
    if (typeof isoDateTime !== "string") return "Waktu pengamatan belum tersedia.";
    const datePart = isoDateTime.slice(0, 10);
    const date = formatDateParts(datePart);
    if (!date) return "Waktu pengamatan belum tersedia.";
    const time = formatHour(isoDateTime);
    return `Waktu pengamatan: ${dateFormatter.format(date)} pukul ${time}.`;
  }

  function formatCoordinate(value, positive, negative) {
    if (!isFiniteNumber(value)) return "—";
    const direction = value >= 0 ? positive : negative;
    return `${Math.abs(value).toFixed(4).replace(".", ",")}° ${direction}`;
  }

  function formatRegion(location) {
    if (location.isCurrentLocation) {
      return `Koordinat GPS · ${formatCoordinate(location.latitude, "LU", "LS")}, ${formatCoordinate(
        location.longitude,
        "BT",
        "BB"
      )}`;
    }
    const parts = [location.admin1, location.country].filter(
      (part, index, list) => Boolean(part) && part !== location.name && list.indexOf(part) === index
    );
    return parts.length ? parts.join(" · ") : "Lokasi pilihan";
  }

  function weatherFor(code, isDay = true) {
    const weather = WEATHER_CODES[Number(code)] || FALLBACK_WEATHER;
    let icon = weather.icon;
    let theme = "cloudy-day";

    if (weather.icon === "clear") {
      icon = isDay ? "clear-day" : "clear-night";
      theme = isDay ? "clear-day" : "clear-night";
    } else if (weather.icon === "partly") {
      icon = isDay ? "partly-day" : "partly-night";
      theme = isDay ? "cloudy-day" : "cloudy-night";
    } else if (weather.icon === "cloudy") {
      icon = "cloudy";
      theme = isDay ? "cloudy-day" : "cloudy-night";
    } else if (weather.icon === "fog") {
      theme = "fog";
    } else if (weather.icon === "drizzle" || weather.icon === "rain") {
      theme = "rain";
    } else if (weather.icon === "snow") {
      theme = "snow";
    } else if (weather.icon === "thunder") {
      theme = "storm";
    }

    return { label: weather.label, icon, theme };
  }

  function normalizeLocation(result) {
    if (!result || typeof result !== "object") return null;
    const latitude = Number(result.latitude);
    const longitude = Number(result.longitude);
    if (!isValidCoordinate(latitude, longitude)) return null;
    const name = typeof result.name === "string" && result.name.trim() ? result.name.trim() : "Lokasi";
    return {
      id: result.id !== undefined && result.id !== null ? String(result.id) : `${latitude},${longitude}`,
      name,
      admin1: typeof result.admin1 === "string" ? result.admin1 : "",
      country: typeof result.country === "string" ? result.country : "",
      latitude,
      longitude,
      timezone: typeof result.timezone === "string" ? result.timezone : "",
    };
  }

  function parseGeocodingResults(payload) {
    if (!payload || typeof payload !== "object") {
      throw new WeatherAppError("Respons pencarian lokasi tidak valid. Coba lagi.");
    }
    if (payload.results === undefined || payload.results === null) return [];
    if (!Array.isArray(payload.results)) {
      throw new WeatherAppError("Respons pencarian lokasi tidak valid. Coba lagi.");
    }
    const results = payload.results.map(normalizeLocation).filter(Boolean).slice(0, 5);
    if (payload.results.length > 0 && results.length === 0) {
      throw new WeatherAppError("Hasil pencarian lokasi tidak lengkap. Coba kata kunci lain.");
    }
    return results;
  }

  function parseForecast(payload) {
    if (!payload || typeof payload !== "object" || !payload.current || !payload.hourly || !payload.daily) {
      throw new WeatherAppError("Respons layanan cuaca tidak valid. Coba lagi.");
    }

    const current = payload.current;
    if (
      typeof current.time !== "string" ||
      !isFiniteNumber(current.temperature_2m) ||
      !isFiniteNumber(current.relative_humidity_2m) ||
      !isFiniteNumber(current.wind_speed_10m) ||
      !isFiniteNumber(current.weather_code)
    ) {
      throw new WeatherAppError("Data cuaca saat ini tidak lengkap. Coba lagi.");
    }

    const hourly = buildHourlyForecast(payload.hourly, current.time);
    const daily = buildDailyForecast(payload.daily);
    if (!hourly.length || !daily.length) {
      throw new WeatherAppError("Prakiraan cuaca tidak lengkap. Coba lagi.");
    }

    return {
      current: {
        time: current.time,
        temperature: current.temperature_2m,
        humidity: current.relative_humidity_2m,
        apparentTemperature: isFiniteNumber(current.apparent_temperature)
          ? current.apparent_temperature
          : null,
        precipitation: isFiniteNumber(current.precipitation) ? current.precipitation : null,
        weatherCode: current.weather_code,
        windSpeed: current.wind_speed_10m,
        isDay: Number(current.is_day) !== 0,
      },
      hourly,
      daily,
      timezone: typeof payload.timezone === "string" ? payload.timezone : "",
      timezoneAbbreviation:
        typeof payload.timezone_abbreviation === "string" ? payload.timezone_abbreviation : "",
    };
  }

  function buildHourlyForecast(hourly, currentTime) {
    if (!hourly || !Array.isArray(hourly.time)) return [];
    const times = hourly.time;
    const currentHour = typeof currentTime === "string" ? `${currentTime.slice(0, 13)}:00` : "";
    let start = times.findIndex((time) => typeof time === "string" && time >= currentHour);
    if (start < 0) {
      start = times.findIndex((time) => typeof time === "string" && time >= currentTime);
    }
    if (start < 0) start = 0;

    const items = [];
    for (let index = start; index < times.length && items.length < 24; index += 1) {
      const time = times[index];
      const temperature = hourly.temperature_2m?.[index];
      const code = hourly.weather_code?.[index];
      if (typeof time !== "string" || !isFiniteNumber(temperature) || !isFiniteNumber(code)) continue;
      items.push({
        time,
        temperature,
        weatherCode: code,
        precipitationProbability: isFiniteNumber(hourly.precipitation_probability?.[index])
          ? hourly.precipitation_probability[index]
          : null,
        isDay: Number(hourly.is_day?.[index]) !== 0,
      });
    }
    return items;
  }

  function buildDailyForecast(daily) {
    if (!daily || !Array.isArray(daily.time)) return [];
    const items = [];
    for (let index = 0; index < daily.time.length && items.length < 7; index += 1) {
      const time = daily.time[index];
      const code = daily.weather_code?.[index];
      const max = daily.temperature_2m_max?.[index];
      const min = daily.temperature_2m_min?.[index];
      if (
        typeof time !== "string" ||
        !isFiniteNumber(code) ||
        !isFiniteNumber(max) ||
        !isFiniteNumber(min)
      ) {
        continue;
      }
      items.push({
        time,
        weatherCode: code,
        max,
        min,
        precipitationProbability: isFiniteNumber(daily.precipitation_probability_max?.[index])
          ? daily.precipitation_probability_max[index]
          : null,
        sunrise: typeof daily.sunrise?.[index] === "string" ? daily.sunrise[index] : "",
        sunset: typeof daily.sunset?.[index] === "string" ? daily.sunset[index] : "",
      });
    }
    return items;
  }

  function buildGeocodingUrl(query) {
    const url = new URL(GEOCODING_ENDPOINT);
    url.search = new URLSearchParams({
      name: query,
      count: "5",
      language: "id",
      format: "json",
    }).toString();
    return url.toString();
  }

  function buildForecastUrl(location) {
    const url = new URL(FORECAST_ENDPOINT);
    url.search = new URLSearchParams({
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      current:
        "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day",
      hourly: "temperature_2m,weather_code,precipitation_probability,is_day",
      daily:
        "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max",
      timezone: "auto",
      forecast_days: "7",
      temperature_unit: "celsius",
      wind_speed_unit: "kmh",
    }).toString();
    return url.toString();
  }

  async function fetchJson(url, label) {
    const controller = new AbortController();
    let timedOut = false;
    const timer = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT);

    let response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
    } catch (error) {
      if (error && error.name === "AbortError" && timedOut) {
        throw new WeatherAppError(
          `Permintaan ${label.toLowerCase()} memakan waktu terlalu lama. Coba lagi.`
        );
      }
      if (error && error.name === "AbortError") {
        throw new WeatherAppError("Permintaan dibatalkan. Silakan coba lagi.");
      }
      throw new WeatherAppError(
        "Tidak dapat terhubung ke layanan cuaca. Periksa koneksi internet Anda, lalu coba lagi."
      );
    } finally {
      window.clearTimeout(timer);
    }

    if (!response.ok) {
      throw new WeatherAppError(
        `${label} gagal (HTTP ${response.status}). Coba lagi beberapa saat lagi.`
      );
    }

    try {
      return await response.json();
    } catch (error) {
      throw new WeatherAppError(`Respons ${label.toLowerCase()} tidak valid. Coba lagi.`);
    }
  }

  function createWeatherIcon(iconName, className) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 64 64");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.setAttribute("class", className);
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", `#icon-${iconName}`);
    svg.append(use);
    return svg;
  }

  function setRetryAction(action) {
    state.retryAction = typeof action === "function" ? action : null;
    el.retryButton.hidden = !state.retryAction;
  }

  function beginLoading(message) {
    state.loading = true;
    el.loadingPanel.hidden = false;
    el.errorPanel.hidden = true;
    el.dashboard.hidden = true;
    el.loadingTitle.textContent = "Memuat data cuaca...";
    el.loadingMessage.textContent = message;
    el.searchButton.disabled = true;
    el.myLocationButton.disabled = true;
    el.resetLocationButton.disabled = true;
    el.searchForm.setAttribute("aria-busy", "true");
    setRetryAction(null);
  }

  function updateLoadingMessage(message) {
    el.loadingMessage.textContent = message;
  }

  function finishLoading() {
    state.loading = false;
    el.loadingPanel.hidden = true;
    el.searchButton.disabled = false;
    el.myLocationButton.disabled = false;
    el.resetLocationButton.disabled = false;
    el.searchForm.setAttribute("aria-busy", "false");
  }

  function showError(message, retryAction = null) {
    el.loadingPanel.hidden = true;
    el.dashboard.hidden = true;
    el.errorMessage.textContent = message;
    el.errorPanel.hidden = false;
    setRetryAction(retryAction);
  }

  function showDashboard(location) {
    el.loadingPanel.hidden = true;
    el.errorPanel.hidden = true;
    el.dashboard.hidden = false;
    el.srStatus.textContent = `Cuaca untuk ${location.name} berhasil dimuat.`;
  }

  function showSearchError(message) {
    el.searchError.textContent = message;
    el.searchError.hidden = false;
    el.cityInput.setAttribute("aria-invalid", "true");
    el.cityInput.focus();
  }

  function clearSearchError() {
    el.searchError.textContent = "";
    el.searchError.hidden = true;
    el.cityInput.removeAttribute("aria-invalid");
  }

  function hideSearchResults() {
    el.searchResults.hidden = true;
    el.searchResultsList.replaceChildren();
    el.searchResultsCount.textContent = "";
  }

  function updateSearchResultState() {
    const currentId = state.currentLocation?.id;
    for (const button of el.searchResultsList.querySelectorAll(".result-button")) {
      const active = button.dataset.locationId === currentId;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
      const mark = button.querySelector(".result-mark");
      if (mark) mark.textContent = active ? "Aktif" : "Pilih";
    }
  }

  function renderSearchResults(results) {
    el.searchResultsList.replaceChildren();
    if (results.length <= 1) {
      hideSearchResults();
      return;
    }

    el.searchResultsCount.textContent = `${results.length} hasil`;
    for (const location of results) {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "result-button";
      button.dataset.locationId = location.id;
      button.setAttribute("aria-pressed", "false");

      const copy = document.createElement("span");
      copy.className = "result-copy";
      const name = document.createElement("strong");
      name.className = "result-name";
      name.textContent = location.name;
      const region = document.createElement("span");
      region.className = "result-region";
      region.textContent = formatRegion(location);
      copy.append(name, region);

      const mark = document.createElement("span");
      mark.className = "result-mark";
      mark.setAttribute("aria-hidden", "true");
      mark.textContent = "Pilih";

      button.append(copy, mark);
      button.addEventListener("click", () => {
        if (state.loading) return;
        clearSearchError();
        el.cityInput.value = location.name;
        loadForecastFor(location, {
          message: `Mengambil data cuaca untuk ${location.name}...`,
        });
      });

      item.append(button);
      el.searchResultsList.append(item);
    }
    el.searchResults.hidden = false;
  }

  function renderCurrentIcon(weather) {
    el.currentIcon.replaceChildren(createWeatherIcon(weather.icon, "current-icon-svg"));
  }

  function renderWeather(weather, location) {
    const currentInfo = weatherFor(weather.current.weatherCode, weather.current.isDay);
    el.currentCard.dataset.theme = currentInfo.theme;
    el.locationName.textContent = location.name;
    el.locationRegion.textContent = formatRegion(location);
    el.dayBadge.textContent = weather.current.isDay ? "Siang" : "Malam";
    renderCurrentIcon(currentInfo);
    el.currentTemperature.textContent = formatNumber(Math.round(weather.current.temperature));
    el.currentDescription.textContent = currentInfo.label;
    el.observationTime.textContent = formatObservationTime(weather.current.time);
    el.feelsLike.textContent = formatTemperature(weather.current.apparentTemperature);
    el.humidity.textContent = `${Math.round(weather.current.humidity)}%`;
    el.windSpeed.textContent = formatWind(weather.current.windSpeed);
    el.precipitation.textContent = formatPrecipitation(weather.current.precipitation);

    const today = weather.daily[0];
    el.sunrise.textContent = today ? formatHour(today.sunrise) : "—";
    el.sunset.textContent = today ? formatHour(today.sunset) : "—";
    const timezone = [weather.timezone, weather.timezoneAbbreviation].filter(Boolean).join(" · ");
    el.timezoneLabel.textContent = timezone || "Waktu setempat";
    el.updatedAt.textContent = `Diperbarui pukul ${clockFormatter
      .format(new Date())
      .replace(":", ".")} waktu perangkat.`;

    renderHourly(weather.hourly);
    renderDaily(weather.daily);
    document.title = `Cuaca ${location.name} — Cuaca Kita`;
    updateSearchResultState();
  }

  function renderHourly(hourly) {
    el.hourlyList.replaceChildren();
    hourly.forEach((hour, index) => {
      const weather = weatherFor(hour.weatherCode, hour.isDay);
      const item = document.createElement("li");
      item.className = `hour-card${index === 0 ? " is-now" : ""}`;
      const probability = hour.precipitationProbability;
      item.setAttribute(
        "aria-label",
        `${index === 0 ? "Sekarang" : formatHour(hour.time)}, ${weather.label}, ${formatTemperature(
          hour.temperature
        )}, peluang hujan ${formatProbability(probability)}`
      );

      const time = document.createElement("span");
      time.className = "hour-time";
      time.textContent = index === 0 ? "Sekarang" : formatHour(hour.time);

      const icon = createWeatherIcon(weather.icon, "hour-icon");

      const temperature = document.createElement("span");
      temperature.className = "hour-temperature";
      temperature.textContent = formatTemperature(hour.temperature);

      const rain = document.createElement("span");
      rain.className = "hour-rain";
      rain.textContent = probability === null ? "—" : formatProbability(probability);

      item.append(time, icon, temperature, rain);
      el.hourlyList.append(item);
    });
  }

  function renderDaily(daily) {
    el.dailyList.replaceChildren();
    const minimums = daily.map((day) => day.min);
    const maximums = daily.map((day) => day.max);
    const globalMin = Math.min(...minimums);
    const globalMax = Math.max(...maximums);
    const spread = globalMax - globalMin;

    daily.forEach((day, index) => {
      const weather = weatherFor(day.weatherCode, true);
      const item = document.createElement("li");
      item.className = "day-row";

      const dayName = document.createElement("div");
      dayName.className = "day-name";
      const name = document.createElement("strong");
      name.textContent = formatDayName(day.time, index);
      const date = document.createElement("span");
      date.className = "day-date";
      date.textContent = formatDateOnly(day.time);
      dayName.append(name, date);

      const icon = createWeatherIcon(weather.icon, "day-icon");

      const condition = document.createElement("div");
      condition.className = "day-condition";
      const conditionLabel = document.createElement("strong");
      conditionLabel.textContent = weather.label;
      const rain = document.createElement("span");
      rain.className = "day-rain";
      rain.textContent =
        day.precipitationProbability === null
          ? "Peluang hujan —"
          : `Peluang hujan ${formatProbability(day.precipitationProbability)}`;
      condition.append(conditionLabel, rain);

      const range = document.createElement("div");
      range.className = "temp-range";
      const min = document.createElement("span");
      min.className = "temp-min";
      min.textContent = formatTemperature(day.min);
      const track = document.createElement("span");
      track.className = "temp-track";
      const fill = document.createElement("span");
      fill.className = "temp-fill";
      const start = spread === 0 ? 0 : ((day.min - globalMin) / spread) * 100;
      const width = spread === 0 ? 100 : ((day.max - day.min) / spread) * 100;
      fill.style.left = `${Math.max(0, Math.min(100, start))}%`;
      fill.style.width = `${Math.max(4, Math.min(100 - start, width))}%`;
      track.append(fill);
      const max = document.createElement("span");
      max.className = "temp-max";
      max.textContent = formatTemperature(day.max);
      range.append(min, track, max);

      item.setAttribute(
        "aria-label",
        `${formatDayName(day.time, index)}, ${weather.label}, minimum ${formatTemperature(
          day.min
        )}, maksimum ${formatTemperature(day.max)}, peluang hujan ${formatProbability(
          day.precipitationProbability
        )}`
      );
      item.append(dayName, icon, condition, range);
      el.dailyList.append(item);
    });
  }

  async function loadAndRender(location) {
    const payload = await fetchJson(buildForecastUrl(location), "Data cuaca");
    const weather = parseForecast(payload);
    state.currentWeather = weather;
    state.currentLocation = location;
    renderWeather(weather, location);
    showDashboard(location);
  }

  async function loadForecastFor(location, { message = "Mengambil data cuaca terbaru..." } = {}) {
    if (state.loading) return;
    beginLoading(message);
    try {
      await loadAndRender(location);
    } catch (error) {
      showError(error.message || "Data cuaca belum bisa dimuat. Coba lagi.", () =>
        loadForecastFor(location, { message: "Mencoba memuat ulang data cuaca..." })
      );
    } finally {
      finishLoading();
    }
  }

  async function runSearch(query) {
    if (state.loading) return;
    clearSearchError();
    hideSearchResults();
    beginLoading(`Mencari lokasi "${query}"...`);

    let pendingLocation = null;
    try {
      const payload = await fetchJson(buildGeocodingUrl(query), "Pencarian lokasi");
      const results = parseGeocodingResults(payload);
      if (!results.length) {
        showError(
          `Kota "${query}" tidak ditemukan. Periksa ejaan atau coba nama kota yang lebih lengkap.`,
          null
        );
        return;
      }

      renderSearchResults(results);
      pendingLocation = results[0];
      updateLoadingMessage(`Mengambil data cuaca untuk ${pendingLocation.name}...`);
      await loadAndRender(pendingLocation);
    } catch (error) {
      const message = error.message || "Layanan cuaca belum bisa dihubungi. Coba lagi.";
      if (pendingLocation) {
        showError(message, () =>
          loadForecastFor(pendingLocation, {
            message: `Mencoba memuat ulang cuaca untuk ${pendingLocation.name}...`,
          })
        );
      } else {
        showError(message, () => runSearch(query));
      }
    } finally {
      finishLoading();
    }
  }

  function resetToDefault() {
    if (state.loading) return;
    clearSearchError();
    hideSearchResults();
    el.cityInput.value = "";
    loadForecastFor(DEFAULT_LOCATION, { message: "Mengambil cuaca untuk Jakarta..." });
  }

  function geolocationErrorMessage(error) {
    if (!error || typeof error.code !== "number") {
      return "Lokasi tidak dapat ditentukan. Coba lagi atau cari kota secara manual.";
    }
    if (error.code === 1) {
      return "Akses lokasi ditolak. Izinkan akses lokasi di pengaturan browser atau cari kota secara manual.";
    }
    if (error.code === 2) {
      return "Lokasi tidak tersedia saat ini. Coba lagi atau cari kota secara manual.";
    }
    if (error.code === 3) {
      return "Waktu permintaan lokasi habis. Coba lagi atau cari kota secara manual.";
    }
    return "Lokasi tidak dapat ditentukan. Coba lagi atau cari kota secara manual.";
  }

  function useMyLocation() {
    if (state.loading) return;
    clearSearchError();
    hideSearchResults();
    el.cityInput.value = "";

    if (!("geolocation" in navigator)) {
      showError("Browser ini tidak mendukung geolokasi. Cari kota secara manual.", null);
      return;
    }

    beginLoading("Mendeteksi lokasi Anda...");
    try {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const latitude = Number(position.coords.latitude);
          const longitude = Number(position.coords.longitude);
          if (!isValidCoordinate(latitude, longitude)) {
            showError("Koordinat lokasi tidak valid. Coba lagi atau cari kota secara manual.", null);
            finishLoading();
            return;
          }

          const location = {
            id: "current-location",
            name: "Lokasi saat ini",
            admin1: "",
            country: "",
            latitude,
            longitude,
            timezone: "",
            isCurrentLocation: true,
          };

          try {
            updateLoadingMessage("Mengambil data cuaca untuk lokasi Anda...");
            await loadAndRender(location);
          } catch (error) {
            showError(error.message || "Data cuaca belum bisa dimuat. Coba lagi.", () =>
              useMyLocation()
            );
          } finally {
            finishLoading();
          }
        },
        (error) => {
          showError(
            geolocationErrorMessage(error),
            error && (error.code === 2 || error.code === 3) ? () => useMyLocation() : null
          );
          finishLoading();
        },
        {
          enableHighAccuracy: false,
          timeout: GEOLOCATION_TIMEOUT,
          maximumAge: 300000,
        }
      );
    } catch (error) {
      showError("Lokasi tidak dapat diminta oleh browser ini. Cari kota secara manual.", null);
      finishLoading();
    }
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    if (state.loading) return;
    const query = el.cityInput.value.trim();
    if (!query) {
      showSearchError("Masukkan nama kota terlebih dahulu.");
      return;
    }
    if (query.length > MAX_QUERY_LENGTH) {
      showSearchError("Nama kota terlalu panjang. Gunakan maksimal 80 karakter.");
      return;
    }
    clearSearchError();
    runSearch(query);
  }

  function init() {
    el.searchForm.addEventListener("submit", handleSearchSubmit);
    el.cityInput.addEventListener("input", () => {
      if (!el.cityInput.value.trim()) return;
      clearSearchError();
    });
    el.retryButton.addEventListener("click", () => {
      if (state.loading || !state.retryAction) return;
      const action = state.retryAction;
      state.retryAction = null;
      el.retryButton.hidden = true;
      action();
    });
    el.myLocationButton.addEventListener("click", useMyLocation);
    el.resetLocationButton.addEventListener("click", resetToDefault);

    loadForecastFor(DEFAULT_LOCATION, { message: "Mengambil cuaca untuk Jakarta..." });
  }

  init();
})();
