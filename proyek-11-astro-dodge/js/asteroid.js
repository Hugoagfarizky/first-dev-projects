export class Asteroid {
  constructor({ x, y, radius, speed }) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.speed = speed;
    this.rotation = Math.random() * Math.PI * 2;
    this.spin = (Math.random() - 0.5) * 1.3;
    this.points = this.createOutline();
    this.craters = this.createCraters();
  }

  createOutline() {
    const pointCount = 9 + Math.floor(Math.random() * 4);
    const points = [];

    for (let index = 0; index < pointCount; index += 1) {
      const angle = (index / pointCount) * Math.PI * 2;
      const distance = 0.76 + Math.random() * 0.28;
      points.push({ angle, distance });
    }

    return points;
  }

  createCraters() {
    const craterCount = 2 + Math.floor(Math.random() * 3);
    const craters = [];

    for (let index = 0; index < craterCount; index += 1) {
      craters.push({
        x: (Math.random() - 0.5) * 1.1,
        y: (Math.random() - 0.5) * 1.1,
        size: 0.08 + Math.random() * 0.14,
      });
    }

    return craters;
  }

  update(deltaSeconds) {
    this.y += this.speed * deltaSeconds;
    this.rotation += this.spin * deltaSeconds;
  }

  isOffscreen(arenaHeight) {
    return this.y - this.radius > arenaHeight + 24;
  }

  draw(context) {
    context.save();
    context.translate(this.x, this.y);
    context.rotate(this.rotation);

    context.beginPath();

    for (let index = 0; index < this.points.length; index += 1) {
      const point = this.points[index];
      const pointX = Math.cos(point.angle) * this.radius * point.distance;
      const pointY = Math.sin(point.angle) * this.radius * point.distance;

      if (index === 0) {
        context.moveTo(pointX, pointY);
      } else {
        context.lineTo(pointX, pointY);
      }
    }

    context.closePath();

    const bodyGradient = context.createRadialGradient(
      -this.radius * 0.34,
      -this.radius * 0.4,
      this.radius * 0.08,
      0,
      0,
      this.radius,
    );
    bodyGradient.addColorStop(0, "#aaa4bc");
    bodyGradient.addColorStop(0.42, "#756e8b");
    bodyGradient.addColorStop(1, "#302b42");
    context.fillStyle = bodyGradient;
    context.fill();

    context.strokeStyle = "rgba(218, 211, 238, 0.5)";
    context.lineWidth = 1.2;
    context.stroke();

    for (const crater of this.craters) {
      context.beginPath();
      context.arc(
        crater.x * this.radius,
        crater.y * this.radius,
        crater.size * this.radius,
        0,
        Math.PI * 2,
      );
      context.fillStyle = "rgba(21, 18, 34, 0.42)";
      context.fill();
      context.strokeStyle = "rgba(196, 187, 219, 0.16)";
      context.lineWidth = 1;
      context.stroke();
    }

    context.restore();
  }
}
