export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function circleIntersectsRect(circleX, circleY, radius, rect) {
  const closestX = clamp(circleX, rect.x, rect.x + rect.width);
  const closestY = clamp(circleY, rect.y, rect.y + rect.height);
  const distanceX = circleX - closestX;
  const distanceY = circleY - closestY;

  return distanceX * distanceX + distanceY * distanceY <= radius * radius;
}

export function playerHitsAsteroid(player, asteroid) {
  const hitbox = player.getHitbox();
  const asteroidRadius = asteroid.radius * 0.82;

  return circleIntersectsRect(asteroid.x, asteroid.y, asteroidRadius, hitbox);
}
