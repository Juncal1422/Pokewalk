import { attackReach } from './stats.js';
import { DIR_VEC } from './constants.js';

// La punta del desplazamiento y el impacto usan el mismo reloj de animación.
// Se incluye la segunda mitad del fotograma de impacto y toda la recuperación.
export function attackMotion(entity, animation) {
  const marker = Number.isInteger(animation.hitFrame) ? animation.hitFrame : Math.floor(animation.frames / 2);
  const impactFrame = Math.max(0, Math.min(animation.frames - 1, marker));
  let elapsed = entity.timer, impactTime = 0, animationDuration = 0;
  for (let frame = 0; frame < animation.frames; frame++) {
    const duration = animation.durs[frame] || 8;
    if (frame < entity.frame) elapsed += duration;
    if (frame === impactFrame) impactTime = animationDuration + duration / 2;
    animationDuration += duration;
  }
  // Algunas hojas (Mothim) marcan impacto en el primer cuadro. Reservamos
  // tiempo para que la aproximación y el regreso sean visibles en ambos extremos.
  impactTime = Math.max(animationDuration * .25, Math.min(animationDuration * .75, impactTime));
  const impact = elapsed >= impactTime;
  const phase = Math.min(1, Math.max(0, impact ? (animationDuration-elapsed)/(animationDuration-impactTime) : elapsed/impactTime));
  // La derivada es cero en el impacto: la embestida cambia de sentido sin tirón.
  const easedProgress = phase * phase * (3 - 2 * phase);
  const distance = attackReach(entity.stats) * (entity.fangStrike && impact ? 1 : easedProgress);
  const [directionX, directionY] = DIR_VEC[entity.dir];
  const directionLength = Math.hypot(directionX, directionY);
  return { x: directionX / directionLength * distance, y: directionY / directionLength * distance, impact, opacity: impact ? phase : 1 };
}
