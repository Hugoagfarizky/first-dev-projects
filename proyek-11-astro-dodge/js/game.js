import { Asteroid } from "./asteroid.js";
import { playerHitsAsteroid } from "./collision.js";
import { Player } from "./player.js";

const FIXED_STEP_SECONDS = 1 / 120;
const MAX_FRAME_DELTA_SECONDS = 0.1;
const MAX_STEPS_PER_FRAME = 12;
const MAX_ASTEROIDS = 26;
const SCORE_PER_SECOND = 10;
const DIFFICULTY_RAMP_SECONDS = 75;
const INITIAL_SPAWN_DELAY = 0.7;

export class Game {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d", { alpha: false });

    if (!this.context) {
      throw new Error("Canvas 2D tidak tersedia di browser ini.");
    }

    this.onScore = options.onScore ?? (() => {});
    this.onStateChange = options.onStateChange ?? (() => {});
    this.onGameOver = options.onGameOver ?? (() => {});
    this.reducedMotion = Boolean(options.reducedMotion);

    this.player = new Player();
    this.asteroids = [];
    this.particles = [];
    this.stars = [];
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.state = "menu";
    this.input = { left: false, right: false };
    this.score = 0;
    this.elapsed = 0;
    this.spawnTimer = INITIAL_SPAWN_DELAY;
    this.accumulator = 0;
    this.lastTimestamp = null;
    this.visualTime = 0;
    this.backgroundGradient = null;
    this.nebulaGradient = null;
    this.planetGradient = null;
    this.planet = null;
    this.rafId = null;
    this.loopBound = this.loop.bind(this);

    this.reset();
    this.rafId = requestAnimationFrame(this.loopBound);
  }

  setReducedMotion(value) {
    this.reducedMotion = Boolean(value);

    if (this.reducedMotion) {
      this.particles = [];
    }
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
    const previousWidth = this.width;
    const previousHeight = this.height;

    if (this.canvas.width !== backingWidth || this.canvas.height !== backingHeight) {
      this.canvas.width = backingWidth;
      this.canvas.height = backingHeight;
    }

    this.context.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (previousWidth > 0 && previousHeight > 0) {
      const scaleX = width / previousWidth;
      const scaleY = height / previousHeight;
      const objectScale = Math.min(scaleX, scaleY);

      for (const asteroid of this.asteroids) {
        asteroid.x *= scaleX;
        asteroid.y *= scaleY;
        asteroid.radius = Math.max(7, asteroid.radius * objectScale);
      }

      for (const particle of this.particles) {
        particle.x *= scaleX;
        particle.y *= scaleY;
        particle.size = Math.max(1, particle.size * objectScale);
      }
    }

    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.player.resize(width, height, previousWidth);
    this.createBackground();
  }

  reset() {
    this.player.reset(this.width, this.height);
    this.asteroids = [];
    this.particles = [];
    this.score = 0;
    this.elapsed = 0;
    this.spawnTimer = INITIAL_SPAWN_DELAY;
    this.accumulator = 0;
    this.lastTimestamp = null;
    this.input.left = false;
    this.input.right = false;
    this.onScore(0);
  }

  start() {
    this.reset();
    this.state = "playing";
    this.onStateChange(this.state);
  }

  pause() {
    if (this.state !== "playing") {
      return;
    }

    this.state = "paused";
    this.input.left = false;
    this.input.right = false;
    this.accumulator = 0;
    this.lastTimestamp = null;
    this.onStateChange(this.state);
  }

  resume() {
    if (this.state !== "paused") {
      return;
    }

    this.state = "playing";
    this.accumulator = 0;
    this.lastTimestamp = null;
    this.onStateChange(this.state);
  }

  setInput(left, right) {
    this.input.left = Boolean(left);
    this.input.right = Boolean(right);
  }

  update(deltaSeconds) {
    this.elapsed += deltaSeconds;

    const nextScore = Math.floor(this.elapsed * SCORE_PER_SECOND);

    if (nextScore !== this.score) {
      this.score = nextScore;
      this.onScore(this.score);
    }

    this.player.update(deltaSeconds, this.input);
    this.spawnTimer -= deltaSeconds;

    if (this.spawnTimer <= 0) {
      if (this.asteroids.length < MAX_ASTEROIDS) {
        this.spawnAsteroid();
      }

      const difficulty = Math.min(1, this.elapsed / DIFFICULTY_RAMP_SECONDS);
      const baseInterval = 1.05 - difficulty * 0.7;
      this.spawnTimer = baseInterval * (0.82 + Math.random() * 0.36);
    }

    for (const asteroid of this.asteroids) {
      asteroid.update(deltaSeconds);
    }

    for (let index = this.asteroids.length - 1; index >= 0; index -= 1) {
      if (this.asteroids[index].isOffscreen(this.height)) {
        this.asteroids.splice(index, 1);
      }
    }

    for (const asteroid of this.asteroids) {
      if (playerHitsAsteroid(this.player, asteroid)) {
        this.endGame();
        return;
      }
    }

    this.updateParticles(deltaSeconds);
  }

  spawnAsteroid() {
    const difficulty = Math.min(1, this.elapsed / DIFFICULTY_RAMP_SECONDS);
    const radius = 10 + Math.random() * 16;
    const margin = radius + 14;
    const minX = margin;
    const maxX = Math.max(minX, this.width - margin);
    const x = minX + Math.random() * (maxX - minX);
    const speed = 94 + Math.random() * 44 + difficulty * 118;

    this.asteroids.push(
      new Asteroid({
        x,
        y: -radius - 12,
        radius,
        speed,
      }),
    );
  }

  endGame() {
    if (this.state !== "playing") {
      return;
    }

    this.state = "gameover";
    this.input.left = false;
    this.input.right = false;
    this.accumulator = 0;
    this.lastTimestamp = null;
    this.createExplosion();
    this.onGameOver(this.score);
    this.onStateChange(this.state);
  }

  createExplosion() {
    if (this.reducedMotion) {
      return;
    }

    const colors = ["#6cf5ff", "#ffca72", "#a794ff", "#f4f7ff"];

    for (let index = 0; index < 28; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 35 + Math.random() * 130;
      const life = 0.35 + Math.random() * 0.55;

      this.particles.push({
        x: this.player.x,
        y: this.player.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life,
        maxLife: life,
        size: 1.5 + Math.random() * 3,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }

  updateParticles(deltaSeconds) {
    for (let index = this.particles.length - 1; index >= 0; index -= 1) {
      const particle = this.particles[index];
      particle.life -= deltaSeconds;

      if (particle.life <= 0) {
        this.particles.splice(index, 1);
        continue;
      }

      particle.x += particle.vx * deltaSeconds;
      particle.y += particle.vy * deltaSeconds;
      particle.vx *= 0.985;
      particle.vy = particle.vy * 0.985 + 55 * deltaSeconds;
    }
  }

  createBackground() {
    const context = this.context;
    const gradient = context.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, "#060a20");
    gradient.addColorStop(0.52, "#080d24");
    gradient.addColorStop(1, "#03060f");
    this.backgroundGradient = gradient;

    const nebulaRadius = Math.max(this.width, this.height) * 0.52;
    const nebula = context.createRadialGradient(
      this.width * 0.18,
      this.height * 0.08,
      0,
      this.width * 0.18,
      this.height * 0.08,
      nebulaRadius,
    );
    nebula.addColorStop(0, "rgba(81, 74, 192, 0.2)");
    nebula.addColorStop(0.5, "rgba(48, 62, 149, 0.08)");
    nebula.addColorStop(1, "rgba(5, 8, 22, 0)");
    this.nebulaGradient = nebula;

    const starCount = Math.round(
      Math.min(150, Math.max(52, (this.width * this.height) / 8500)),
    );
    this.stars = [];

    for (let index = 0; index < starCount; index += 1) {
      this.stars.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        radius: 0.5 + Math.random() * 1.5,
        alpha: 0.25 + Math.random() * 0.65,
        phase: Math.random() * Math.PI * 2,
      });
    }

    const planetRadius = Math.min(this.width, this.height) * 0.145;
    const planetX = this.width * 0.84;
    const planetY = this.height * 0.17;
    const planet = context.createRadialGradient(
      planetX - planetRadius * 0.34,
      planetY - planetRadius * 0.38,
      planetRadius * 0.08,
      planetX,
      planetY,
      planetRadius,
    );
    planet.addColorStop(0, "#7b8cc8");
    planet.addColorStop(0.35, "#4e5d99");
    planet.addColorStop(0.72, "#28345f");
    planet.addColorStop(1, "#11182f");
    this.planetGradient = planet;
    this.planet = {
      x: planetX,
      y: planetY,
      radius: planetRadius,
    };
  }

  render() {
    if (this.width === 0 || this.height === 0) {
      return;
    }

    const context = this.context;
    this.drawBackground(context);

    for (const asteroid of this.asteroids) {
      asteroid.draw(context);
    }

    this.player.draw(context, this.visualTime, this.reducedMotion);
    this.drawParticles(context);
  }

  drawBackground(context) {
    context.fillStyle = this.backgroundGradient;
    context.fillRect(0, 0, this.width, this.height);

    context.fillStyle = this.nebulaGradient;
    context.fillRect(0, 0, this.width, this.height);

    for (const star of this.stars) {
      const twinkle = this.reducedMotion
        ? 1
        : 0.72 + 0.28 * Math.sin(this.visualTime * 1.5 + star.phase);

      context.globalAlpha = star.alpha * twinkle;
      context.fillStyle = star.radius > 1.4 ? "#b9f5ff" : "#dce5ff";
      context.beginPath();
      context.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      context.fill();
    }

    context.globalAlpha = 1;

    if (this.planet) {
      const { x, y, radius } = this.planet;

      context.save();
      context.translate(x, y);
      context.rotate(-0.28);
      context.beginPath();
      context.ellipse(0, 0, radius * 1.75, radius * 0.34, 0, 0, Math.PI * 2);
      context.strokeStyle = "rgba(144, 161, 235, 0.26)";
      context.lineWidth = Math.max(2, radius * 0.12);
      context.stroke();
      context.restore();

      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fillStyle = this.planetGradient;
      context.fill();
      context.strokeStyle = "rgba(172, 192, 255, 0.28)";
      context.lineWidth = 1;
      context.stroke();

      context.beginPath();
      context.arc(x - radius * 0.26, y - radius * 0.25, radius * 0.17, 0, Math.PI * 2);
      context.fillStyle = "rgba(10, 15, 40, 0.24)";
      context.fill();
    }

    const horizon = context.createLinearGradient(0, this.height * 0.66, 0, this.height);
    horizon.addColorStop(0, "rgba(55, 94, 173, 0)");
    horizon.addColorStop(1, "rgba(38, 80, 153, 0.12)");
    context.fillStyle = horizon;
    context.fillRect(0, this.height * 0.66, this.width, this.height * 0.34);

    context.globalAlpha = 1;
  }

  drawParticles(context) {
    for (const particle of this.particles) {
      const alpha = Math.max(0, particle.life / particle.maxLife);
      context.globalAlpha = alpha;
      context.fillStyle = particle.color;
      context.beginPath();
      context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      context.fill();
    }

    context.globalAlpha = 1;
  }

  loop(timestamp) {
    this.rafId = requestAnimationFrame(this.loopBound);

    if (this.lastTimestamp === null) {
      this.lastTimestamp = timestamp;
    }

    const rawDelta = (timestamp - this.lastTimestamp) / 1000;
    const frameDelta = Math.min(Math.max(rawDelta, 0), MAX_FRAME_DELTA_SECONDS);
    this.lastTimestamp = timestamp;
    this.visualTime += frameDelta;

    if (this.state === "playing") {
      this.accumulator += frameDelta;
      let steps = 0;

      while (this.accumulator >= FIXED_STEP_SECONDS && steps < MAX_STEPS_PER_FRAME) {
        this.update(FIXED_STEP_SECONDS);
        this.accumulator -= FIXED_STEP_SECONDS;
        steps += 1;

        if (this.state !== "playing") {
          this.accumulator = 0;
          break;
        }
      }

      if (steps >= MAX_STEPS_PER_FRAME) {
        this.accumulator = 0;
      }
    } else if (this.state === "gameover") {
      this.updateParticles(frameDelta);
    }

    this.render();
  }
}
