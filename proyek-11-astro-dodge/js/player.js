import { clamp } from "./collision.js";

const PLAYER_WIDTH = 38;
const PLAYER_HEIGHT = 48;
const PLAYER_SPEED = 470;
const SIDE_MARGIN = 22;

export class Player {
  constructor() {
    this.arenaWidth = 0;
    this.arenaHeight = 0;
    this.x = 0;
    this.y = 0;
    this.reset(0, 0);
  }

  reset(width, height) {
    this.arenaWidth = width;
    this.arenaHeight = height;
    this.x = width / 2;
    this.y = Math.max(0, height - 46);
    this.clampPosition();
  }

  resize(width, height, previousWidth = 0) {
    if (previousWidth > 0) {
      this.x = (this.x / previousWidth) * width;
    } else if (this.arenaWidth === 0) {
      this.x = width / 2;
    }

    this.arenaWidth = width;
    this.arenaHeight = height;
    this.y = Math.max(0, height - 46);
    this.clampPosition();
  }

  update(deltaSeconds, input) {
    let direction = 0;

    if (input.left) {
      direction -= 1;
    }

    if (input.right) {
      direction += 1;
    }

    this.x += direction * PLAYER_SPEED * deltaSeconds;
    this.clampPosition();
  }

  clampPosition() {
    const minX = SIDE_MARGIN;
    const maxX = Math.max(SIDE_MARGIN, this.arenaWidth - SIDE_MARGIN);
    this.x = clamp(this.x, minX, maxX);
  }

  getHitbox() {
    const width = PLAYER_WIDTH * 0.58;
    const height = PLAYER_HEIGHT * 0.52;

    return {
      x: this.x - width / 2,
      y: this.y - height / 2,
      width,
      height,
    };
  }

  draw(context, visualTime, reducedMotion) {
    const flameLength = reducedMotion ? 9 : 9 + Math.sin(visualTime * 18) * 4;

    context.save();
    context.translate(this.x, this.y);

    context.save();
    context.globalAlpha = 0.42;
    context.fillStyle = "#67f4ff";
    context.shadowColor = "#4fe9ff";
    context.shadowBlur = 22;
    context.beginPath();
    context.ellipse(0, 2, 22, 24, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();

    context.beginPath();
    context.moveTo(0, -PLAYER_HEIGHT / 2);
    context.lineTo(PLAYER_WIDTH / 2, PLAYER_HEIGHT / 2 - 8);
    context.lineTo(0, PLAYER_HEIGHT / 2 - 14);
    context.lineTo(-PLAYER_WIDTH / 2, PLAYER_HEIGHT / 2 - 8);
    context.closePath();

    const bodyGradient = context.createLinearGradient(0, -24, 0, 18);
    bodyGradient.addColorStop(0, "#ecffff");
    bodyGradient.addColorStop(0.34, "#72f2ff");
    bodyGradient.addColorStop(1, "#197eae");
    context.fillStyle = bodyGradient;
    context.shadowColor = "rgba(70, 225, 255, 0.72)";
    context.shadowBlur = 16;
    context.fill();

    context.shadowBlur = 0;
    context.strokeStyle = "rgba(210, 253, 255, 0.82)";
    context.lineWidth = 1.2;
    context.stroke();

    context.beginPath();
    context.ellipse(0, -4, 5, 8, 0, 0, Math.PI * 2);
    context.fillStyle = "#071827";
    context.fill();
    context.strokeStyle = "rgba(207, 249, 255, 0.72)";
    context.stroke();

    context.beginPath();
    context.moveTo(-5, 17);
    context.lineTo(0, 17 + flameLength);
    context.lineTo(5, 17);
    context.closePath();
    context.fillStyle = "#ffca72";
    context.shadowColor = "#ff9b4a";
    context.shadowBlur = 12;
    context.fill();

    context.restore();
  }
}
