const STORAGE_KEYS = {
  mode: "soundwaveStudioMode",
  volume: "soundwaveStudioVolume",
};

const STATUS_LABELS = {
  empty: "Belum ada audio",
  loading: "Memuat audio",
  ready: "Siap diputar",
  playing: "Sedang diputar",
  paused: "Dijeda",
  ended: "Pemutaran selesai",
  error: "Error audio",
};

const STAGE_LABELS = {
  empty: "Menunggu audio",
  loading: "Menyiapkan",
  ready: "Siap",
  playing: "Audio aktif",
  paused: "Dijeda",
  ended: "Selesai",
  error: "Error",
};

const MODE_LABELS = {
  spectrum: "Spectrum",
  waveform: "Waveform",
};

const MODE_CANVAS_LABELS = {
  spectrum: "Visualisasi spektrum frekuensi audio real-time",
  waveform: "Visualisasi bentuk gelombang audio real-time",
};

export class PlayerUI {
  constructor({ engine, visualizer, elements }) {
    this.engine = engine;
    this.visualizer = visualizer;
    this.elements = elements;

    this.pendingSeekValue = null;
    this.startingPlayback = false;
    this.previousStatus = null;
    this.analysisAvailable = false;
    this.graphAttempted = false;
    this.analysisReason = "";

    this.bindEngineEvents();
    this.bindControls();

    const initialMode = this.readMode();
    const initialVolume = this.readVolume();

    this.applyMode(initialMode, { persist: false, announce: false });
    this.engine.setVolume(initialVolume);
    this.updateVolumeUI();
    this.updateFileUI(null);
    this.updateDuration();
    this.updateStatus(engine.status, "");
    this.updateLevels(null);
  }

  bindEngineEvents() {
    this.handleStatusChange = (event) => {
      const { status, message, file } = event.detail;

      if (file) {
        this.updateFileUI(file);
      }

      this.updateStatus(status, message);
    };

    this.handleFileChange = (event) => {
      this.pendingSeekValue = null;
      this.elements.seekInput.value = "0";
      this.updateFileUI(event.detail.file);
      this.updateDuration();
      this.updateProgress(0, Number.NaN);
      this.clearError();
      this.visualizer.reset();
      this.visualizer.setState(this.engine.status);
      this.renderStage(this.engine.status);
    };

    this.handleTimeUpdate = (event) => {
      const { currentTime, duration } = event.detail;

      if (this.pendingSeekValue === null) {
        this.updateProgress(currentTime, duration);
      }
    };

    this.handleDurationChange = (event) => {
      this.updateDuration(event.detail.duration);
    };

    this.handleGraphChange = (event) => {
      const { available, analyser, reason } = event.detail;

      this.graphAttempted = true;
      this.analysisAvailable = available;
      this.analysisReason = reason || "";
      this.visualizer.setAnalyser(available ? analyser : null);
      this.renderStage(this.engine.status);

      if (!available && reason) {
        this.announce(reason);
      }
    };

    this.handleFileError = (event) => {
      this.showError(event.detail.message);
      this.announce("File audio tidak dapat digunakan.");
    };

    this.engine.addEventListener("statuschange", this.handleStatusChange);
    this.engine.addEventListener("filechange", this.handleFileChange);
    this.engine.addEventListener("timeupdate", this.handleTimeUpdate);
    this.engine.addEventListener("durationchange", this.handleDurationChange);
    this.engine.addEventListener("graphchange", this.handleGraphChange);
    this.engine.addEventListener("fileerror", this.handleFileError);
  }

  bindControls() {
    this.handleChooseClick = () => {
      this.elements.fileInput.value = "";
      this.elements.fileInput.click();
    };

    this.handleFileInput = () => {
      const file = this.elements.fileInput.files?.[0];

      this.elements.fileInput.value = "";

      if (file) {
        this.engine.loadFile(file);
      }
    };

    this.handlePlayClick = () => {
      this.togglePlayback();
    };

    this.handleSeekInput = () => {
      const duration = this.engine.duration;

      if (!Number.isFinite(duration)) {
        return;
      }

      this.pendingSeekValue = Number(this.elements.seekInput.value);
      const seconds = (this.pendingSeekValue / 1000) * duration;

      this.elements.currentTime.textContent = this.formatTime(seconds);
      this.elements.seekInput.setAttribute(
        "aria-valuetext",
        `${this.formatTime(seconds)} dari ${this.formatTime(duration)}`,
      );
      this.elements.seekInput.style.setProperty(
        "--range-progress",
        `${(this.pendingSeekValue / 10).toFixed(1)}%`,
      );
    };

    this.handleSeekChange = () => {
      const duration = this.engine.duration;

      if (!Number.isFinite(duration) || this.pendingSeekValue === null) {
        return;
      }

      const seconds = (this.pendingSeekValue / 1000) * duration;

      this.pendingSeekValue = null;
      this.engine.seek(seconds);
      this.updateProgress(seconds, duration);
      this.announce(`Posisi audio dipindah ke ${this.formatTime(seconds)}.`);
    };

    this.handleSeekCancel = () => {
      if (this.pendingSeekValue === null) {
        return;
      }

      this.pendingSeekValue = null;
      this.updateProgress(this.engine.currentTime, this.engine.duration);
    };

    this.handleVolumeInput = () => {
      const volume = this.engine.setVolume(this.elements.volumeInput.value);

      this.engine.setMuted(false);
      this.writeVolume(volume);
      this.updateVolumeUI();
    };

    this.handleMuteClick = () => {
      const muted = this.engine.setMuted(!this.engine.audio.muted);

      this.updateVolumeUI();
      this.announce(muted ? "Audio dibisukan." : "Audio dinyalakan.");
    };

    this.handleModeClick = (event) => {
      const mode = event.currentTarget.dataset.mode;

      this.applyMode(mode, { persist: true, announce: true });
    };

    this.handleKeyDown = (event) => {
      if (
        event.code !== "Space" ||
        event.repeat ||
        this.isInteractiveTarget(event.target) ||
        !["ready", "playing", "paused", "ended"].includes(this.engine.status)
      ) {
        return;
      }

      event.preventDefault();
      this.togglePlayback();
    };

    this.elements.chooseButton.addEventListener("click", this.handleChooseClick);
    this.elements.fileInput.addEventListener("change", this.handleFileInput);
    this.elements.playButton.addEventListener("click", this.handlePlayClick);
    this.elements.seekInput.addEventListener("input", this.handleSeekInput);
    this.elements.seekInput.addEventListener("change", this.handleSeekChange);
    this.elements.seekInput.addEventListener("pointercancel", this.handleSeekCancel);
    this.elements.volumeInput.addEventListener("input", this.handleVolumeInput);
    this.elements.muteButton.addEventListener("click", this.handleMuteClick);

    for (const button of this.elements.modeButtons) {
      button.addEventListener("click", this.handleModeClick);
    }

    document.addEventListener("keydown", this.handleKeyDown);
  }

  async togglePlayback() {
    if (this.startingPlayback) {
      return;
    }

    if (this.engine.status === "playing") {
      this.engine.pause();
      return;
    }

    if (!this.engine.hasFile || ["loading", "error"].includes(this.engine.status)) {
      return;
    }

    this.startingPlayback = true;
    this.updateTransport();
    await this.engine.play();
    this.startingPlayback = false;
    this.updateTransport();
  }

  updateStatus(status, message) {
    const statusLabel = STATUS_LABELS[status] ?? STATUS_LABELS.empty;

    this.elements.statusPill.dataset.state = status;
    this.elements.statusText.textContent = statusLabel;

    if (status === "loading") {
      this.visualizer.reset();
      this.pendingSeekValue = null;
      this.updateProgress(0, Number.NaN);
      this.clearError();
    }

    if (status === "error") {
      this.visualizer.reset();
      this.visualizer.setState("error");
      this.showError(message || "Audio gagal dimuat atau diputar.");
    } else {
      this.clearError();
    }

    this.visualizer.setState(status);

    if (status === "ready" || status === "ended") {
      this.updateDuration();
    }

    if (status === "ended") {
      this.updateProgress(this.engine.duration, this.engine.duration);
    }

    this.updateTransport();
    this.renderStage(status);

    if (this.previousStatus !== status) {
      const announcements = {
        loading: `Memuat ${this.engine.currentFile?.name ?? "audio"}.`,
        ready: "Audio siap diputar.",
        playing: "Pemutaran dimulai.",
        paused: "Pemutaran dijeda.",
        ended: "Pemutaran selesai.",
        error: "Pemutaran audio gagal.",
      };

      if (announcements[status]) {
        this.announce(announcements[status]);
      }
    }

    this.previousStatus = status;
  }

  updateFileUI(file) {
    if (!file) {
      this.elements.fileName.textContent = "Belum ada file";
      this.elements.fileName.removeAttribute("title");
      this.elements.fileMeta.textContent = "Pilih file audio dari perangkat ini";
      this.elements.chooseLabel.textContent = "Pilih audio";
      return;
    }

    this.elements.fileName.textContent = file.name;
    this.elements.fileName.title = file.name;
    this.elements.fileMeta.textContent = `${this.formatBytes(file.size)} · ${
      file.type || "Tipe file tidak dilaporkan"
    }`;
    this.elements.chooseLabel.textContent = "Ganti audio";
  }

  updateTransport() {
    const status = this.engine.status;
    const canPlay = this.engine.hasFile && !["loading", "error"].includes(status);
    const isPlaying = status === "playing";
    const playLabel = isPlaying ? "Jeda" : status === "ended" ? "Putar ulang" : "Putar";

    this.elements.playButton.disabled = !canPlay || this.startingPlayback;
    this.elements.playButton.dataset.playing = String(isPlaying);
    this.elements.playButton.setAttribute(
      "aria-label",
      isPlaying ? "Jeda audio" : status === "ended" ? "Putar ulang audio" : "Putar audio",
    );
    this.elements.playLabel.textContent = playLabel;

    const duration = this.engine.duration;
    this.elements.seekInput.disabled =
      !this.engine.hasFile ||
      !Number.isFinite(duration) ||
      ["loading", "error"].includes(status);
  }

  updateDuration(duration = this.engine.duration) {
    const hasDuration = Number.isFinite(duration) && duration > 0;

    this.elements.durationTime.textContent = hasDuration ? this.formatTime(duration) : "0:00";
    this.updateTransport();

    if (!hasDuration) {
      this.elements.seekInput.value = "0";
      this.elements.seekInput.style.setProperty("--range-progress", "0%");
      this.elements.seekInput.setAttribute("aria-valuetext", "0:00 dari 0:00");
    }
  }

  updateProgress(currentTime, duration = this.engine.duration) {
    const safeCurrent = Number.isFinite(currentTime) ? Math.max(0, currentTime) : 0;
    const hasDuration = Number.isFinite(duration) && duration > 0;
    const ratio = hasDuration ? Math.min(safeCurrent / duration, 1) : 0;

    this.elements.currentTime.textContent = this.formatTime(safeCurrent);
    this.elements.seekInput.value = String(Math.round(ratio * 1000));
    this.elements.seekInput.style.setProperty(
      "--range-progress",
      `${(ratio * 100).toFixed(1)}%`,
    );
    this.elements.seekInput.setAttribute(
      "aria-valuetext",
      `${this.formatTime(safeCurrent)} dari ${hasDuration ? this.formatTime(duration) : "0:00"}`,
    );

    if (hasDuration) {
      this.elements.durationTime.textContent = this.formatTime(duration);
    }
  }

  updateVolumeUI() {
    const volume = this.engine.audio.volume;
    const muted = this.engine.audio.muted;
    const percent = Math.round(volume * 100);

    this.elements.volumeInput.value = String(volume);
    this.elements.volumeInput.style.setProperty("--range-progress", `${percent}%`);
    this.elements.volumeInput.setAttribute(
      "aria-valuetext",
      muted ? `${percent}%, dibisukan` : `${percent}%`,
    );
    this.elements.volumeValue.textContent = muted ? "Bisu" : `${percent}%`;
    this.elements.muteButton.setAttribute("aria-pressed", String(muted));
    this.elements.muteButton.setAttribute(
      "aria-label",
      muted ? "Bunyikan audio" : "Bisukan audio",
    );
  }

  updateLevels(levels) {
    const bands = [
      { key: "low", value: this.elements.levelLow, bar: this.elements.levelLowBar },
      { key: "mid", value: this.elements.levelMid, bar: this.elements.levelMidBar },
      { key: "high", value: this.elements.levelHigh, bar: this.elements.levelHighBar },
    ];

    for (const band of bands) {
      if (!levels || typeof levels[band.key] !== "number") {
        band.value.textContent = "—";
        band.bar.style.width = "0%";
        continue;
      }

      const percent = Math.round(Math.max(0, Math.min(1, levels[band.key])) * 100);

      band.value.textContent = `${percent}%`;
      band.bar.style.width = `${percent}%`;
    }
  }

  renderStage(status) {
    const badge = this.elements.visualizerState;
    const badgeText = this.elements.visualizerStateText;
    const message = this.elements.stageMessage;
    const messageText = this.elements.stageMessageText;
    const analysisUnavailable =
      this.graphAttempted && !this.analysisAvailable && ["playing", "paused"].includes(status);
    const graphUnavailable = this.graphAttempted && !this.analysisAvailable;
    let nextMessage = "";

    this.elements.stage.dataset.state = status;
    badge.dataset.state = status;

    if (status === "empty") {
      nextMessage = "Pilih file audio lokal untuk mulai.";
    } else if (status === "loading") {
      nextMessage = "Membaca metadata audio...";
    } else if (status === "ready") {
      nextMessage = "Audio siap. Tekan Putar untuk memulai visualisasi.";
    } else if (status === "error") {
      nextMessage = "Audio tidak dapat divisualisasikan. Pilih file lain.";
    } else if (analysisUnavailable) {
      nextMessage =
        this.analysisReason ||
        "Visualisasi tidak tersedia. Audio tetap dapat diputar tanpa data analyser.";
    }

    if (analysisUnavailable) {
      badgeText.textContent = "Visual nonaktif";
    } else {
      badgeText.textContent = STAGE_LABELS[status] ?? STAGE_LABELS.empty;
    }

    messageText.textContent = nextMessage;
    message.hidden = !nextMessage;

    if (graphUnavailable) {
      this.elements.canvas.setAttribute(
        "aria-label",
        "Area visualisasi audio. Web Audio API tidak tersedia.",
      );
    } else {
      this.elements.canvas.setAttribute("aria-label", MODE_CANVAS_LABELS[this.visualizer.mode]);
    }
  }

  applyMode(mode, { persist, announce }) {
    const nextMode = mode === "waveform" ? "waveform" : "spectrum";

    this.visualizer.setMode(nextMode);

    for (const button of this.elements.modeButtons) {
      button.setAttribute("aria-pressed", String(button.dataset.mode === nextMode));
    }

    const graphUnavailable = this.graphAttempted && !this.analysisAvailable;

    this.elements.canvas.setAttribute(
      "aria-label",
      graphUnavailable
        ? "Area visualisasi audio. Web Audio API tidak tersedia."
        : MODE_CANVAS_LABELS[nextMode],
    );

    if (persist) {
      this.writeMode(nextMode);
    }

    if (announce) {
      this.announce(`Mode visualisasi: ${MODE_LABELS[nextMode]}.`);
    }
  }

  showError(message) {
    this.elements.fileError.textContent = message;
    this.elements.fileError.hidden = false;
  }

  clearError() {
    this.elements.fileError.textContent = "";
    this.elements.fileError.hidden = true;
  }

  announce(message) {
    this.elements.liveStatus.textContent = message;
  }

  formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) {
      return "0:00";
    }

    const totalSeconds = Math.floor(seconds);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const remainingSeconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
    }

    return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
  }

  formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) {
      return "Ukuran tidak diketahui";
    }

    if (bytes < 1024) {
      return `${bytes} B`;
    }

    const units = ["KB", "MB", "GB"];
    let size = bytes / 1024;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex += 1;
    }

    const formatted = new Intl.NumberFormat("id-ID", {
      maximumFractionDigits: size >= 10 ? 0 : 1,
    }).format(size);

    return `${formatted} ${units[unitIndex]}`;
  }

  isInteractiveTarget(target) {
    if (!(target instanceof Element)) {
      return false;
    }

    return Boolean(
      target.closest(
        "button, a[href], input, select, textarea, [contenteditable='true'], [role='button'], [role='link'], [role='textbox']",
      ),
    );
  }

  readMode() {
    try {
      const mode = window.localStorage.getItem(STORAGE_KEYS.mode);

      return mode === "waveform" ? "waveform" : "spectrum";
    } catch {
      return "spectrum";
    }
  }

  readVolume() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.volume);

      if (raw === null) {
        return 0.8;
      }

      const volume = Number(raw);

      if (Number.isFinite(volume) && volume >= 0 && volume <= 1) {
        return volume;
      }
    } catch {
      // Preferensi tidak tersedia; gunakan nilai awal yang aman.
    }

    return 0.8;
  }

  writeMode(mode) {
    try {
      window.localStorage.setItem(STORAGE_KEYS.mode, mode);
    } catch {
      // Mode tetap berfungsi selama sesi meskipun storage diblokir.
    }
  }

  writeVolume(volume) {
    try {
      window.localStorage.setItem(STORAGE_KEYS.volume, String(volume));
    } catch {
      // Volume tetap berfungsi selama sesi meskipun storage diblokir.
    }
  }

  destroy() {
    this.engine.removeEventListener("statuschange", this.handleStatusChange);
    this.engine.removeEventListener("filechange", this.handleFileChange);
    this.engine.removeEventListener("timeupdate", this.handleTimeUpdate);
    this.engine.removeEventListener("durationchange", this.handleDurationChange);
    this.engine.removeEventListener("graphchange", this.handleGraphChange);
    this.engine.removeEventListener("fileerror", this.handleFileError);

    this.elements.chooseButton.removeEventListener("click", this.handleChooseClick);
    this.elements.fileInput.removeEventListener("change", this.handleFileInput);
    this.elements.playButton.removeEventListener("click", this.handlePlayClick);
    this.elements.seekInput.removeEventListener("input", this.handleSeekInput);
    this.elements.seekInput.removeEventListener("change", this.handleSeekChange);
    this.elements.seekInput.removeEventListener("pointercancel", this.handleSeekCancel);
    this.elements.volumeInput.removeEventListener("input", this.handleVolumeInput);
    this.elements.muteButton.removeEventListener("click", this.handleMuteClick);

    for (const button of this.elements.modeButtons) {
      button.removeEventListener("click", this.handleModeClick);
    }

    document.removeEventListener("keydown", this.handleKeyDown);
  }
}
