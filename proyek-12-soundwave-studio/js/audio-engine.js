const STATUS = Object.freeze({
  EMPTY: "empty",
  LOADING: "loading",
  READY: "ready",
  PLAYING: "playing",
  PAUSED: "paused",
  ENDED: "ended",
  ERROR: "error",
});

const ALLOWED_NON_AUDIO_TYPES = new Set(["application/ogg", "application/octet-stream"]);

export class AudioEngine extends EventTarget {
  constructor(audio) {
    super();

    if (!(audio instanceof HTMLAudioElement)) {
      throw new TypeError("AudioEngine memerlukan elemen HTMLAudioElement.");
    }

    this.audio = audio;
    this.audio.preload = "metadata";

    this.objectUrl = null;
    this.currentFile = null;
    this.context = null;
    this.sourceNode = null;
    this.analyser = null;
    this.graphAvailable = false;
    this.graphReason = "";
    this.status = STATUS.EMPTY;
    this.errorMessage = "";
    this.replacing = false;
    this.disposed = false;

    this.boundHandlers = {
      loadedmetadata: () => this.#handleLoadedMetadata(),
      canplay: () => this.#handleCanPlay(),
      durationchange: () => this.#handleDurationChange(),
      play: () => this.#handlePlay(),
      playing: () => this.#handlePlay(),
      pause: () => this.#handlePause(),
      ended: () => this.#handleEnded(),
      error: () => this.#handleMediaError(),
      timeupdate: () => this.#emitTimeUpdate(),
    };

    for (const [eventName, handler] of Object.entries(this.boundHandlers)) {
      this.audio.addEventListener(eventName, handler);
    }
  }

  get hasFile() {
    return Boolean(this.currentFile && this.objectUrl);
  }

  get duration() {
    const { duration } = this.audio;

    return Number.isFinite(duration) && duration > 0 ? duration : Number.NaN;
  }

  get currentTime() {
    const { currentTime } = this.audio;

    return Number.isFinite(currentTime) && currentTime > 0 ? currentTime : 0;
  }

  get isPlaying() {
    return this.status === STATUS.PLAYING && !this.audio.paused;
  }

  loadFile(file) {
    if (this.disposed) {
      return false;
    }

    if (
      !file ||
      typeof file.name !== "string" ||
      typeof file.size !== "number" ||
      typeof file.type !== "string"
    ) {
      this.#emitFileError("File tidak dapat dibaca. Pilih file audio lain.");
      return false;
    }

    if (file.size === 0) {
      this.#emitFileError("File kosong (0 byte). Pilih file audio yang berisi data.");
      return false;
    }

    const normalizedType = file.type.toLowerCase();

    if (
      normalizedType &&
      !normalizedType.startsWith("audio/") &&
      !ALLOWED_NON_AUDIO_TYPES.has(normalizedType)
    ) {
      this.#emitFileError(
        "File yang dipilih bukan tipe audio yang dikenali. Pilih file audio dari perangkat.",
      );
      return false;
    }

    let nextUrl;

    try {
      nextUrl = URL.createObjectURL(file);
    } catch {
      this.#emitFileError("Browser gagal membuat sumber audio untuk file tersebut.");
      return false;
    }

    const previousUrl = this.objectUrl;

    this.replacing = true;
    this.audio.pause();
    this.currentFile = {
      name: file.name || "Audio tanpa nama",
      size: file.size,
      type: file.type,
    };
    this.objectUrl = nextUrl;
    this.audio.src = nextUrl;
    this.audio.load();

    if (previousUrl) {
      URL.revokeObjectURL(previousUrl);
    }

    this.#setStatus(STATUS.LOADING);
    this.dispatchEvent(
      new CustomEvent("filechange", {
        detail: { file: { ...this.currentFile } },
      }),
    );

    return true;
  }

  async play() {
    if (!this.hasFile || this.disposed) {
      return false;
    }

    if (this.status === STATUS.LOADING) {
      return false;
    }

    try {
      const graphReady = await this.#ensureAudioGraph();

      if (!graphReady && this.sourceNode) {
        throw new Error(
          "AudioContext tidak dapat dijalankan. Muat ulang halaman lalu coba lagi.",
        );
      }

      if (this.audio.ended) {
        this.audio.currentTime = 0;
      }

      await this.audio.play();
      return true;
    } catch (error) {
      if (error?.name === "AbortError") {
        return false;
      }

      const message = this.#playbackErrorMessage(error);
      this.#setStatus(STATUS.ERROR, message);
      return false;
    }
  }

  pause() {
    if (!this.audio.paused) {
      this.audio.pause();
    }
  }

  seek(seconds) {
    const duration = this.duration;

    if (!Number.isFinite(duration) || !Number.isFinite(seconds)) {
      return;
    }

    const nextTime = Math.min(Math.max(seconds, 0), duration);

    try {
      this.audio.currentTime = nextTime;
      this.#emitTimeUpdate();
    } catch {
      this.#emitFileError("Posisi audio tidak dapat diubah untuk file ini.");
    }
  }

  setVolume(value) {
    const nextVolume = Math.min(Math.max(Number(value) || 0, 0), 1);

    this.audio.volume = nextVolume;
    return nextVolume;
  }

  setMuted(muted) {
    this.audio.muted = Boolean(muted);
    return this.audio.muted;
  }

  async #ensureAudioGraph() {
    if (this.sourceNode) {
      return this.#resumeContext();
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
      this.#setGraphAvailability(
        false,
        "Web Audio API tidak tersedia. Audio tetap dapat diputar tanpa visualisasi.",
      );
      return false;
    }

    let context;

    try {
      context = new AudioContextClass();
      const analyser = context.createAnalyser();

      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.72;
      analyser.minDecibels = -90;
      analyser.maxDecibels = -10;

      const sourceNode = context.createMediaElementSource(this.audio);

      sourceNode.connect(analyser);
      analyser.connect(context.destination);

      this.context = context;
      this.analyser = analyser;
      this.sourceNode = sourceNode;

      context.addEventListener("statechange", () => {
        this.dispatchEvent(
          new CustomEvent("contextchange", {
            detail: { state: context.state },
          }),
        );
      });

      const running = await this.#resumeContext();

      if (!running) {
        throw new Error("AudioContext tidak mencapai status running.");
      }

      this.#setGraphAvailability(true, "");
      return true;
    } catch (error) {
      if (this.sourceNode) {
        this.#setGraphAvailability(
          false,
          "AudioContext gagal berjalan. Visualisasi dan pemutaran Web Audio tidak tersedia.",
        );
        throw error;
      }

      if (context && context.state !== "closed") {
        context.close().catch(() => {});
      }

      this.context = null;
      this.analyser = null;
      this.#setGraphAvailability(
        false,
        "Visualisasi Web Audio tidak dapat dimulai. Audio tetap dapat diputar tanpa visualisasi.",
      );
      return false;
    }
  }

  async #resumeContext() {
    if (!this.context) {
      return false;
    }

    if (this.context.state === "suspended") {
      try {
        await this.context.resume();
      } catch {
        return false;
      }
    }

    return this.context.state === "running";
  }

  #handleLoadedMetadata() {
    if (!this.hasFile || this.disposed) {
      return;
    }

    this.replacing = false;
    this.#setStatus(STATUS.READY);
    this.#emitDurationChange();
  }

  #handleCanPlay() {
    if (!this.hasFile || this.disposed || this.status !== STATUS.LOADING) {
      return;
    }

    this.replacing = false;
    this.#setStatus(STATUS.READY);
    this.#emitDurationChange();
  }

  #handleDurationChange() {
    if (!this.hasFile || this.disposed) {
      return;
    }

    this.#emitDurationChange();
  }

  #handlePlay() {
    if (!this.hasFile || this.disposed || this.replacing) {
      return;
    }

    this.#setStatus(STATUS.PLAYING);
    this.#emitTimeUpdate();
  }

  #handlePause() {
    if (
      !this.hasFile ||
      this.disposed ||
      this.replacing ||
      this.audio.ended ||
      this.status === STATUS.ERROR
    ) {
      return;
    }

    this.#setStatus(STATUS.PAUSED);
    this.#emitTimeUpdate();
  }

  #handleEnded() {
    if (!this.hasFile || this.disposed) {
      return;
    }

    this.#setStatus(STATUS.ENDED);
    this.#emitTimeUpdate();
  }

  #handleMediaError() {
    if (this.disposed || !this.audio.getAttribute("src")) {
      return;
    }

    this.replacing = false;
    const code = this.audio.error?.code;
    const messages = {
      1: "Pemuatan audio dibatalkan.",
      2: "File audio tidak dapat dibaca dari perangkat.",
      3: "File audio rusak atau formatnya tidak dapat didekode browser ini.",
      4: "Format audio tidak didukung browser ini.",
    };
    const message =
      messages[code] ?? "Audio gagal dimuat. File mungkin rusak atau formatnya tidak didukung.";

    this.#setStatus(STATUS.ERROR, message);
  }

  #playbackErrorMessage(error) {
    if (error?.name === "NotAllowedError") {
      return "Browser memblokir pemutaran. Tekan tombol Putar sekali lagi untuk mengizinkan audio.";
    }

    if (error?.name === "NotSupportedError") {
      return "File audio tidak dapat diputar oleh browser ini.";
    }

    if (error instanceof Error && error.message) {
      return error.message;
    }

    const mediaError = this.audio.error;

    if (mediaError?.code === 3) {
      return "File audio rusak atau formatnya tidak dapat didekode browser ini.";
    }

    if (mediaError?.code === 4) {
      return "Format audio tidak didukung browser ini.";
    }

    return "Audio tidak dapat diputar. Coba file lain atau muat ulang halaman.";
  }

  #setStatus(status, message = "") {
    if (this.status === status && this.errorMessage === message) {
      return;
    }

    this.status = status;
    this.errorMessage = status === STATUS.ERROR ? message : "";
    this.dispatchEvent(
      new CustomEvent("statuschange", {
        detail: {
          status,
          message: this.errorMessage,
          file: this.currentFile ? { ...this.currentFile } : null,
        },
      }),
    );
  }

  #setGraphAvailability(available, reason) {
    if (this.graphAvailable === available && this.graphReason === reason) {
      return;
    }

    this.graphAvailable = available;
    this.graphReason = reason;
    this.dispatchEvent(
      new CustomEvent("graphchange", {
        detail: {
          available,
          reason,
          analyser: available ? this.analyser : null,
          contextState: this.context?.state ?? "not-created",
        },
      }),
    );
  }

  #emitTimeUpdate() {
    this.dispatchEvent(
      new CustomEvent("timeupdate", {
        detail: {
          currentTime: this.currentTime,
          duration: this.duration,
        },
      }),
    );
  }

  #emitDurationChange() {
    this.dispatchEvent(
      new CustomEvent("durationchange", {
        detail: { duration: this.duration },
      }),
    );
  }

  #emitFileError(message) {
    this.dispatchEvent(
      new CustomEvent("fileerror", {
        detail: { message },
      }),
    );
  }

  dispose() {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.audio.pause();

    for (const [eventName, handler] of Object.entries(this.boundHandlers)) {
      this.audio.removeEventListener(eventName, handler);
    }

    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }

    this.audio.removeAttribute("src");
    this.audio.load();

    if (this.sourceNode) {
      this.sourceNode.disconnect();
    }

    if (this.analyser) {
      this.analyser.disconnect();
    }

    if (this.context && this.context.state !== "closed") {
      this.context.close().catch(() => {});
    }

    this.sourceNode = null;
    this.analyser = null;
    this.context = null;
    this.currentFile = null;
  }
}
