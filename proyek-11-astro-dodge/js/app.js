import { Game } from "./game.js";

const HIGH_SCORE_KEY = "astroDodgeHighScore";

const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

const elements = {
  canvas: getElement("game-canvas"),
  stage: getElement("game-stage"),
  score: getElement("score"),
  highScore: getElement("high-score"),
  stateLabel: getElement("state-label"),
  stateText: getElement("state-text"),
  pauseButton: getElement("pause-button"),
  menuOverlay: getElement("menu-overlay"),
  startButton: getElement("start-button"),
  pauseOverlay: getElement("pause-overlay"),
  resumeButton: getElement("resume-button"),
  gameoverOverlay: getElement("gameover-overlay"),
  finalScore: getElement("final-score"),
  recordMessage: getElement("record-message"),
  restartButton: getElement("restart-button"),
  touchLeft: getElement("touch-left"),
  touchRight: getElement("touch-right"),
  liveStatus: getElement("live-status"),
};

const stateLabels = {
  menu: "Menu awal",
  playing: "Bermain",
  paused: "Dijeda",
  gameover: "Game over",
};

let highScore = readHighScore();
let previousState = "menu";
let resizeFrame = null;
let stageResizeObserver = null;

const pressedKeys = { left: false, right: false };
const touchState = { left: false, right: false };

const game = new Game(elements.canvas, {
  reducedMotion: reducedMotionQuery.matches,
  onScore: updateScore,
  onStateChange: handleStateChange,
  onGameOver: handleGameOver,
});

elements.highScore.textContent = String(highScore);
updateStateUI("menu");

game.resize();
watchForResize();
bindControls();
watchReducedMotion();

function getElement(id) {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`Elemen #${id} tidak ditemukan.`);
  }

  return element;
}

function readHighScore() {
  try {
    const storedValue = Number(window.localStorage.getItem(HIGH_SCORE_KEY));

    if (Number.isFinite(storedValue) && storedValue > 0) {
      return Math.floor(storedValue);
    }
  } catch {
    // localStorage dapat diblokir oleh mode privat atau kebijakan browser.
  }

  return 0;
}

function writeHighScore(value) {
  try {
    window.localStorage.setItem(HIGH_SCORE_KEY, String(Math.floor(value)));
  } catch {
    // Permainan tetap berjalan meskipun penyimpanan lokal tidak tersedia.
  }
}

function announce(message) {
  elements.liveStatus.textContent = message;
}

function updateScore(score) {
  elements.score.textContent = String(score);
}

function updateStateUI(state) {
  elements.stateLabel.dataset.state = state;
  elements.stateText.textContent = stateLabels[state];
  elements.menuOverlay.hidden = state !== "menu";
  elements.pauseOverlay.hidden = state !== "paused";
  elements.gameoverOverlay.hidden = state !== "gameover";
  elements.pauseButton.hidden = state !== "playing";
}

function clearInputs() {
  pressedKeys.left = false;
  pressedKeys.right = false;
  touchState.left = false;
  touchState.right = false;
  game.setInput(false, false);
}

function syncInput() {
  game.setInput(
    pressedKeys.left || touchState.left,
    pressedKeys.right || touchState.right,
  );
}

function handleStateChange(state) {
  updateStateUI(state);

  if (state === "paused" || state === "gameover") {
    clearInputs();
  }

  if (state === "playing") {
    const message = previousState === "paused" ? "Permainan dilanjutkan." : "Permainan dimulai.";
    announce(message);
    elements.canvas.focus({ preventScroll: true });
  } else if (state === "paused") {
    announce("Permainan dijeda.");
    elements.resumeButton.focus({ preventScroll: true });
  } else if (state === "gameover") {
    elements.restartButton.focus({ preventScroll: true });
  }

  previousState = state;
}

function handleGameOver(score) {
  const isNewRecord = score > highScore;

  if (isNewRecord) {
    highScore = score;
    writeHighScore(highScore);
    elements.highScore.textContent = String(highScore);
  }

  elements.finalScore.textContent = String(score);

  if (isNewRecord) {
    elements.recordMessage.textContent = `Rekor baru: ${highScore}.`;
    announce(`Game over. Skor ${score}. Rekor baru.`);
  } else {
    elements.recordMessage.textContent =
      highScore > 0 ? `Rekor tetap: ${highScore}.` : "Belum ada rekor. Coba lagi!";
    announce(`Game over. Skor ${score}. Rekor ${highScore}.`);
  }
}

function startGame() {
  clearInputs();
  game.start();
}

function togglePause() {
  if (game.state === "playing") {
    game.pause();
  } else if (game.state === "paused") {
    game.resume();
  }
}

function isInteractiveTarget(target) {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(
    target.closest(
      "button, a[href], input, select, textarea, [contenteditable='true'], [role='button'], [role='link'], [role='textbox']",
    ),
  );
}

function handleKeyDown(event) {
  if (isInteractiveTarget(event.target)) {
    return;
  }

  if (event.code === "ArrowLeft" || event.code === "KeyA") {
    if (game.state === "playing") {
      event.preventDefault();
      pressedKeys.left = true;
      syncInput();
    }
    return;
  }

  if (event.code === "ArrowRight" || event.code === "KeyD") {
    if (game.state === "playing") {
      event.preventDefault();
      pressedKeys.right = true;
      syncInput();
    }
    return;
  }

  if (event.code === "KeyP" || event.code === "Escape" || event.code === "Space") {
    if (game.state === "playing" || game.state === "paused") {
      event.preventDefault();

      if (!event.repeat) {
        togglePause();
      }
    }
  }
}

function handleKeyUp(event) {
  if (event.code === "ArrowLeft" || event.code === "KeyA") {
    pressedKeys.left = false;
    syncInput();
  } else if (event.code === "ArrowRight" || event.code === "KeyD") {
    pressedKeys.right = false;
    syncInput();
  }
}

function bindHoldButton(button, direction) {
  const activePointers = new Set();

  function press(event) {
    event.preventDefault();
    activePointers.add(event.pointerId);
    touchState[direction] = true;
    syncInput();

    if (button.setPointerCapture) {
      try {
        button.setPointerCapture(event.pointerId);
      } catch {
        // Pointer sintetis atau browser lama mungkin tidak mendukung capture.
      }
    }
  }

  function release(event) {
    activePointers.delete(event.pointerId);

    if (activePointers.size === 0) {
      touchState[direction] = false;
      syncInput();
    }
  }

  button.addEventListener("pointerdown", press);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", release);
  button.addEventListener("contextmenu", (event) => event.preventDefault());
}

function bindControls() {
  elements.startButton.addEventListener("click", startGame);
  elements.restartButton.addEventListener("click", startGame);
  elements.resumeButton.addEventListener("click", () => game.resume());
  elements.pauseButton.addEventListener("click", togglePause);

  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  window.addEventListener("blur", clearInputs);

  bindHoldButton(elements.touchLeft, "left");
  bindHoldButton(elements.touchRight, "right");

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && game.state === "playing") {
      clearInputs();
      game.pause();
    }
  });
}

function watchForResize() {
  const scheduleResize = () => {
    if (resizeFrame !== null) {
      return;
    }

    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = null;
      game.resize();
    });
  };

  if ("ResizeObserver" in window) {
    stageResizeObserver = new ResizeObserver(scheduleResize);
    stageResizeObserver.observe(elements.stage);
  }

  window.addEventListener("resize", scheduleResize);
  window.addEventListener("orientationchange", scheduleResize);
}

function watchReducedMotion() {
  const applyPreference = (event) => {
    game.setReducedMotion(event.matches);
  };

  if (reducedMotionQuery.addEventListener) {
    reducedMotionQuery.addEventListener("change", applyPreference);
  } else if (reducedMotionQuery.addListener) {
    reducedMotionQuery.addListener(applyPreference);
  }
}
