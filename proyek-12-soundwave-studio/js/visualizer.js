const MODES = new Set(["spectrum", "waveform"]);
const MIN_FREQUENCY = 40;
const MAX_FREQUENCY = 14000;
const LEVEL_INTERVAL_MS = 100;

const BANDS = [
  { key: "low", min: 40, max: 250 },
  { key: "mid", min: 250, max: 2000 },
  { key: "high", min: 2000, max: 8000 },
];

export class AudioVisualizer {
  constructor(canvas, options = {}) {
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new TypeError("AudioVisualizer memerlukan elemen canvas.");
    }

    this.canvas = canvas;
    this.stage = options.stage ?? canvas.parentElement;
    this.context = canvas.getContext("2d", { alpha: false });

    if (!this.context) {
      throw new Error("Canvas 2D tidak tersedia di browser ini.");
    }

    this.onLevels = options.onLevels ?? (() => {});
    this.reducedMotion = Boolean(options.reducedMotion);
    this.mode = "spectrum";
    this.state = "empty";
    this.analyser = null;
    this.frequencyData = null;
    this.timeData = null;
    this.barValues = [];
    this.hasData = false;
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.active = false;
    this.rafId = null;
    this.resizeFrame = null;
    this.lastLevelUpdate = 0;
    this.backgroundGradient = null;
    this.barGradient = null;
    this.waveGradient = null;
    this.resizeObserver = null;

    this.loopBound = this.loop.bind(this);
    this.handleResize = this.handleResize.bind(this);
    this.handleVisibility = this.handleVisibility.bind(this);

    this.resize();
    this.renderSnapshot();

    if (this.stage && "ResizeObserver" in window) {
      this.resizeObserver = new ResizeObserver(() => this.scheduleResize());
      this.resizeObserver.observe(this.stage);
    }

    window.addEventListener("resize", this.handleResize);
    window.addEventListener("orientationchange", this.handleResize);
    document.addEventListener("visibilitychange", this.handleVisibility);
  }

  setAnalyser(analyser) {
    this.analyser = analyser ?? null;

    if (this.analyser) {
      this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
      this.timeData = new Uint8Array(this.analyser.fftSize);
      this.barValues = [];
      this.hasData = false;

      if (this.state === "playing") {
        this.start();
      }
    } else {
      this.frequencyData = null;
      this.timeData = null;
      this.barValues = [];
      this.hasData = false;
      this.stop();
      this.renderSnapshot();
    }
  }

  setMode(mode) {
    if (!MODES.has(mode) || this.mode === mode) {
      return;
    }

    this.mode = mode;
    this.hasData = false;
    this.barValues = [];

    if (!this.active) {
      this.renderSnapshot();
    }
  }

  setState(state) {
    const previousState = this.state;

    this.state = state;

    if (state === "playing" && this.analyser) {
      this.start();
    } else {
      this.stop();

      if (previousState !== state) {
        this.renderSnapshot();
      }
    }

    if (state !== "playing") {
      this.onLevels(null);
    }
  }

  setReducedMotion(reducedMotion) {
    this.reducedMotion = Boolean(reducedMotion);
    this.renderSnapshot();
  }

  reset() {
    this.stop();
    this.hasData = false;
    this.barValues = [];
    this.lastLevelUpdate = 0;

    if (this.frequencyData) {
      this.frequencyData.fill(0);
    }

    if (this.timeData) {
      this.timeData.fill(128);
    }

    this.onLevels(null);
    this.renderSnapshot();
  }

  start() {
    if (
      this.active ||
      !this.analyser ||
      this.state !== "playing" ||
      document.hidden ||
      this.width < 1 ||
      this.height < 1
    ) {
      return;
    }

    this.active = true;
    this.lastLevelUpdate = 0;
    this.rafId = requestAnimationFrame(this.loopBound);
  }

  stop() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    this.active = false;
  }

  loop(timestamp) {
    if (!this.active) {
      return;
    }

    if (document.hidden || this.state !== "playing" || !this.analyser) {
      this.stop();
      return;
    }

    this.readAnalyserData(timestamp);
    this.drawFrame();

    this.rafId = requestAnimationFrame(this.loopBound);
  }

  readAnalyserData(timestamp) {
    if (!this.analyser || !this.frequencyData || !this.timeData) {
      return;
    }

    if (this.mode === "waveform") {
      this.analyser.getByteTimeDomainData(this.timeData);
    } else {
      this.analyser.getByteFrequencyData(this.frequencyData);
    }

    if (
      timestamp - this.lastLevelUpdate >= LEVEL_INTERVAL_MS ||
      this.lastLevelUpdate === 0
    ) {
      if (this.mode !== "spectrum") {
        this.analyser.getByteFrequencyData(this.frequencyData);
      }

      this.onLevels(this.computeLevels());
      this.lastLevelUpdate = timestamp;
    }

    this.hasData = true;
  }

  computeLevels() {
    if (!this.frequencyData || !this.analyser) {
      return null;
    }

    const nyquist = this.analyser.context.sampleRate / 2;
    const binWidth = nyquist / this.frequencyData.length;
    const levels = {};

    for (const band of BANDS) {
      const start = Math.min(
        this.frequencyData.length - 1,
        Math.max(0, Math.floor(band.min / binWidth)),
      );
      const end = Math.max(
        start + 1,
        Math.min(this.frequencyData.length, Math.ceil(band.max / binWidth)),
      );
      let total = 0;

      for (let index = start; index < end; index += 1) {
        total += this.frequencyData[index];
      }

      levels[band.key] = total / (end - start) / 255;
    }

    return levels;
  }

  drawFrame() {
    this.drawBackground();

    if (this.mode === "spectrum") {
      this.drawSpectrum();
    } else {
      this.drawWaveform();
    }
  }

  renderSnapshot() {
    if (this.width < 1 || this.height < 1) {
      return;
    }

    this.drawBackground();

    if (this.mode === "spectrum") {
      this.drawSpectrum();
    } else {
      this.drawWaveform();
    }
  }

  drawBackground() {
    const { context, width, height } = this;

    context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    context.fillStyle = this.backgroundGradient ?? "#03050c";
    context.fillRect(0, 0, width, height);

    context.save();
    context.strokeStyle = "rgba(141, 165, 255, 0.075)";
    context.lineWidth = 1;

    for (let index = 1; index < 4; index += 1) {
      const y = Math.round((height / 4) * index) + 0.5;

      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }

    context.strokeStyle = "rgba(141, 165, 255, 0.04)";

    for (let index = 1; index < 6; index += 1) {
      const x = Math.round((width / 6) * index) + 0.5;

      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
    }

    context.restore();
  }

  drawSpectrum() {
    const { context, width, height } = this;

    if (width < 1 || height < 1) {
      return;
    }

    const left = width < 520 ? 10 : 18;
    const right = width < 520 ? 10 : 18;
    const top = width < 520 ? 24 : 32;
    const bottom = height - (width < 520 ? 22 : 28);
    const plotWidth = Math.max(1, width - left - right);
    const plotHeight = Math.max(1, bottom - top);
    const count = Math.max(36, Math.min(92, Math.floor(plotWidth / (width < 520 ? 6 : 9))));
    const gap = count > 72 ? 2 : 3;
    const barWidth = Math.max(1.5, (plotWidth - gap * (count - 1)) / count);

    if (this.barValues.length !== count) {
      this.barValues = new Array(count).fill(0);
    }

    context.save();
    context.fillStyle = this.barGradient;
    context.shadowColor = "rgba(95, 231, 255, 0.25)";
    context.shadowBlur = this.reducedMotion ? 0 : 10;

    const nyquist = this.analyser?.context.sampleRate
      ? this.analyser.context.sampleRate / 2
      : 24000;
    const maximum = Math.min(nyquist, MAX_FREQUENCY);
    const binCount = this.frequencyData?.length ?? 1;

    for (let index = 0; index < count; index += 1) {
      let target = 0;

      if (this.frequencyData && this.hasData) {
        const hzStart = MIN_FREQUENCY * Math.pow(maximum / MIN_FREQUENCY, index / count);
        const hzEnd =
          MIN_FREQUENCY * Math.pow(maximum / MIN_FREQUENCY, (index + 1) / count);
        const binStart = Math.max(0, Math.floor((hzStart / nyquist) * binCount));
        const binEnd = Math.min(
          binCount,
          Math.max(binStart + 1, Math.ceil((hzEnd / nyquist) * binCount)),
        );
        let total = 0;

        for (let bin = binStart; bin < binEnd; bin += 1) {
          total += this.frequencyData[bin];
        }

        target = total / (binEnd - binStart) / 255;
      }

      const previous = this.barValues[index] ?? 0;
      const easing = this.reducedMotion ? 1 : target > previous ? 0.58 : 0.16;
      const value = previous + (target - previous) * easing;

      this.barValues[index] = value;

      const visibleValue = Math.pow(Math.max(0, Math.min(1, value)), 0.82);
      const barHeight = Math.max(0, visibleValue * plotHeight);
      const x = left + index * (barWidth + gap);
      const y = bottom - barHeight;

      if (barHeight > 0.5) {
        context.beginPath();
        context.roundRect(x, y, barWidth, barHeight, Math.min(3, barWidth / 2));
        context.fill();
      }
    }

    context.restore();

    context.save();
    context.strokeStyle = "rgba(141, 165, 255, 0.2)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(left, bottom + 0.5);
    context.lineTo(width - right, bottom + 0.5);
    context.stroke();

    context.fillStyle = "rgba(168, 182, 216, 0.64)";
    context.font = `${width < 520 ? 8 : 9}px "Cascadia Mono", Consolas, monospace`;
    context.textBaseline = "top";

    const labels = [
      { hz: 50, text: "50" },
      { hz: 250, text: "250" },
      { hz: 1000, text: "1k" },
      { hz: 4000, text: "4k" },
      { hz: 12000, text: "12k" },
    ];

    for (const label of labels) {
      if (label.hz >= maximum) {
        continue;
      }

      const ratio = Math.log(label.hz / MIN_FREQUENCY) / Math.log(maximum / MIN_FREQUENCY);
      const x = left + ratio * plotWidth;

      context.textAlign = "center";
      context.fillText(label.text, x, bottom + 7);
    }

    context.textAlign = "left";
    context.fillText("Hz", left, 10);
    context.restore();
  }

  drawWaveform() {
    const { context, width, height } = this;

    if (width < 1 || height < 1) {
      return;
    }

    const left = width < 520 ? 10 : 18;
    const right = width < 520 ? 10 : 18;
    const top = width < 520 ? 24 : 32;
    const bottom = height - (width < 520 ? 24 : 30);
    const plotWidth = Math.max(1, width - left - right);
    const plotHeight = Math.max(1, bottom - top);
    const center = top + plotHeight / 2;
    const amplitude = plotHeight * 0.46;

    context.save();
    context.strokeStyle = "rgba(141, 165, 255, 0.18)";
    context.lineWidth = 1;
    context.setLineDash([4, 6]);
    context.beginPath();
    context.moveTo(left, center + 0.5);
    context.lineTo(width - right, center + 0.5);
    context.stroke();
    context.restore();

    if (!this.timeData || !this.hasData) {
      return;
    }

    context.save();
    context.strokeStyle = this.waveGradient;
    context.lineWidth = width < 520 ? 1.7 : 2.1;
    context.lineJoin = "round";
    context.lineCap = "round";
    context.shadowColor = "rgba(103, 241, 255, 0.3)";
    context.shadowBlur = this.reducedMotion ? 0 : 12;
    context.beginPath();

    const step = width > 760 ? 2 : 1;

    for (let x = 0; x <= plotWidth; x += step) {
      const ratio = x / plotWidth;
      const dataIndex = Math.min(
        this.timeData.length - 1,
        Math.floor(ratio * (this.timeData.length - 1)),
      );
      const sample = (this.timeData[dataIndex] - 128) / 128;
      const y = center + sample * amplitude;

      if (x === 0) {
        context.moveTo(left, y);
      } else {
        context.lineTo(left + x, y);
      }
    }

    context.stroke();
    context.restore();

    context.save();
    context.fillStyle = "rgba(168, 182, 216, 0.64)";
    context.font = `${width < 520 ? 8 : 9}px "Cascadia Mono", Consolas, monospace`;
    context.textAlign = "right";
    context.textBaseline = "top";
    context.fillText("+1", width - right, top - 3);
    context.fillText("0", width - right, center - 5);
    context.fillText("−1", width - right, bottom - 9);
    context.restore();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();

    if (rect.width < 1 || rect.height < 1) {
      return;
    }

    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);
    const backingWidth = Math.max(1, Math.round(width * dpr));
    const backingHeight = Math.max(1, Math.round(height * dpr));
    const sizeChanged =
      this.canvas.width !== backingWidth || this.canvas.height !== backingHeight;

    if (sizeChanged) {
      this.canvas.width = backingWidth;
      this.canvas.height = backingHeight;
    }

    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.context.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.backgroundGradient = this.context.createLinearGradient(0, 0, 0, height);
    this.backgroundGradient.addColorStop(0, "#070b16");
    this.backgroundGradient.addColorStop(0.55, "#040711");
    this.backgroundGradient.addColorStop(1, "#02040a");

    this.barGradient = this.context.createLinearGradient(0, height * 0.15, 0, height * 0.86);
    this.barGradient.addColorStop(0, "#7ff7ff");
    this.barGradient.addColorStop(0.52, "#45d8ee");
    this.barGradient.addColorStop(1, "#9a7bff");

    this.waveGradient = this.context.createLinearGradient(0, 0, width, 0);
    this.waveGradient.addColorStop(0, "#67f1ff");
    this.waveGradient.addColorStop(0.62, "#7ee7f8");
    this.waveGradient.addColorStop(1, "#aa8cff");

    if (!this.active) {
      this.renderSnapshot();
    }
  }

  scheduleResize() {
    if (this.resizeFrame !== null) {
      return;
    }

    this.resizeFrame = requestAnimationFrame(() => {
      this.resizeFrame = null;
      this.resize();
    });
  }

  handleResize() {
    this.scheduleResize();
  }

  handleVisibility() {
    if (document.hidden) {
      this.stop();
      return;
    }

    if (this.state === "playing" && this.analyser) {
      this.start();
    }
  }

  destroy() {
    this.stop();

    if (this.resizeFrame !== null) {
      cancelAnimationFrame(this.resizeFrame);
      this.resizeFrame = null;
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    window.removeEventListener("resize", this.handleResize);
    window.removeEventListener("orientationchange", this.handleResize);
    document.removeEventListener("visibilitychange", this.handleVisibility);
  }
}
