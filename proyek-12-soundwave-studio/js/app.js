import { AudioEngine } from "./audio-engine.js";
import { AudioVisualizer } from "./visualizer.js";
import { PlayerUI } from "./player-ui.js";

const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

const elements = {
  audio: getElement("audio-element"),
  canvas: getElement("visualizer-canvas"),
  stage: getElement("visualizer-stage"),
  visualizerState: getElement("visualizer-state"),
  visualizerStateText: getElement("visualizer-state-text"),
  stageMessage: getElement("stage-message"),
  stageMessageText: getElement("stage-message-text"),
  levelLow: getElement("level-low"),
  levelLowBar: getElement("level-low-bar"),
  levelMid: getElement("level-mid"),
  levelMidBar: getElement("level-mid-bar"),
  levelHigh: getElement("level-high"),
  levelHighBar: getElement("level-high-bar"),
  modeButtons: Array.from(document.querySelectorAll(".mode-button")),
  chooseButton: getElement("choose-button"),
  chooseLabel: getElement("choose-label"),
  fileInput: getElement("file-input"),
  fileName: getElement("file-name"),
  fileMeta: getElement("file-meta"),
  statusPill: getElement("status-pill"),
  statusText: getElement("status-text"),
  fileError: getElement("file-error"),
  playButton: getElement("play-button"),
  playLabel: getElement("play-label"),
  currentTime: getElement("current-time"),
  durationTime: getElement("duration-time"),
  seekInput: getElement("seek-input"),
  muteButton: getElement("mute-button"),
  volumeInput: getElement("volume-input"),
  volumeValue: getElement("volume-value"),
  liveStatus: getElement("live-status"),
};

let engine;
let visualizer;
let ui;

try {
  engine = new AudioEngine(elements.audio);
  visualizer = new AudioVisualizer(elements.canvas, {
    stage: elements.stage,
    reducedMotion: reducedMotionQuery.matches,
    onLevels: (levels) => ui?.updateLevels(levels),
  });
  ui = new PlayerUI({
    engine,
    visualizer,
    elements,
  });

  watchReducedMotion();
  watchPageLifecycle();
} catch (error) {
  console.error("Soundwave Studio gagal dimulai:", error);
  showFatalError(error);
}

function getElement(id) {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`Elemen #${id} tidak ditemukan.`);
  }

  return element;
}

function watchReducedMotion() {
  const applyPreference = (event) => {
    visualizer.setReducedMotion(event.matches);
  };

  if (reducedMotionQuery.addEventListener) {
    reducedMotionQuery.addEventListener("change", applyPreference);
  } else if (reducedMotionQuery.addListener) {
    reducedMotionQuery.addListener(applyPreference);
  }
}

function watchPageLifecycle() {
  window.addEventListener("pagehide", (event) => {
    if (event.persisted) {
      return;
    }

    ui.destroy();
    visualizer.destroy();
    engine.dispose();
  });
}

function showFatalError(error) {
  const message =
    error instanceof Error && error.message
      ? `Aplikasi tidak dapat dimulai: ${error.message}`
      : "Aplikasi tidak dapat dimulai di browser ini.";

  elements.statusPill.dataset.state = "error";
  elements.statusText.textContent = "Error";
  elements.fileError.textContent = message;
  elements.fileError.hidden = false;
  elements.stage.dataset.state = "error";
  elements.stageMessageText.textContent = "Visualizer tidak dapat dimulai di browser ini.";
  elements.stageMessage.hidden = false;
  elements.playButton.disabled = true;
  elements.seekInput.disabled = true;
  elements.liveStatus.textContent = message;
}
