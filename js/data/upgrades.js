import { clampStat, initialStats } from '../core/stats.js';

// Cada tipo de efecto declara su validación y cómo modificar la run.
// El catálogo solo contiene datos: nuevos efectos específicos se registran aquí.
const effects = new Map([
  ['increaseStat', {
    valid: item => Object.hasOwn(initialStats(), item.stat) && Number.isInteger(item.amount) && item.amount > 0,
    apply: (stats, item) => { stats[item.stat] = clampStat(item.stat, stats[item.stat] + item.amount); },
  }],
]);

export async function loadUpgrades() {
  const response = await fetch(new URL('./upgrades.json', import.meta.url));
  if (!response.ok) throw new Error('No se pudo cargar el catálogo de mejoras.');
  const items = await response.json();
  if (!Array.isArray(items) || !items.length) throw new Error('El catálogo de mejoras está vacío.');
  const ids = new Set();
  for (const item of items) {
    if (!item || typeof item.id !== 'string' || !item.id || ids.has(item.id) ||
        typeof item.label !== 'string' || !item.label || !effects.get(item.effect)?.valid(item)) {
      throw new Error('Hay una mejora inválida o duplicada en el catálogo.');
    }
    ids.add(item.id);
  }
  return items;
}

export function applyUpgrade(stats, item) {
  effects.get(item.effect).apply(stats, item);
  console.info('[Mejora] Aplicada', item.id);
}
