import { game } from './state.js';

const layouts = {
  retrieve: ['Recuperar objeto', 4, 2, 4], clear: ['Limpiar piso', 2, 2, 2],
  leader: ['Vence al líder', 5, 5, 5], hunt: ['Caza', 3, 2, 2],
};
export const sample = list => list[Math.floor(Math.random() * list.length)];

// El presupuesto crece de forma continua. Dentro del bioma se eligen especies
// cercanas a ese presupuesto por sus bases de combate y su coste evolutivo.
function encounterPool(biome, adventure, boss) {
  const target = (boss ? 310 : 155) + adventure * (boss ? 4.5 : 4);
  const ranked = biome.wild.map(id => game.pokemon.get(id))
    .filter(row => (row.stage < 3 || adventure >= 50) &&
      (boss ? row.final : !row.legendary && !row.mythical))
    .map(row => {
      const s = row.stats;
      const strength = s.hpMax + s.attack + s.defense + s.speed + 2 * row.evolutionCost +
        (row.legendary || row.mythical ? 55 : 0);
      return { id: row.dex, distance: Math.abs(strength - target) };
    }).sort((a, b) => a.distance - b.distance);
  return ranked.slice(0, boss ? 8 : 28).map(entry => entry.id);
}

export function newMission(number, biome) {
  const type = number % 4 === 0 ? 'leader' : sample(['retrieve', 'clear', 'hunt']);
  const [name, pasillos, habitaciones, cruces] = layouts[type];
  const floors = type === 'leader' ? 1 : 1 + Math.floor(Math.random() * Math.min(20, number + 2));
  const pool = encounterPool(biome, number - 1, type === 'leader');
  const target = type === 'hunt' ? sample(pool) : null;
  const layout = { pasillos, habitaciones, cruces };
  for (const key of Object.keys(layout)) layout[key] += biome.layoutModifier[key];
  const mission = { number, biome, type, name, floors, pool, target, quota: target ? 1 + Math.floor(Math.random() * floors) : 0,
    itemBlock: -1, itemsPlaced: 0, kills: 0, defeated: [], recovered: false, layout };
  console.info('[Misión]', name, { number, floors, biome: biome.name, target });
  return mission;
}

// Una presa garantizada por piso permite completar cualquier cuota de caza.
export function encounters(m, floor) {
  if (m.type === 'leader' && floor === m.floors) {
    return [sample(m.pool)];
  }
  const ids = m.target ? [m.target] : [];
  while (ids.length < 4) ids.push(sample(m.pool.filter(id => !ids.includes(id))));
  return ids;
}

export function onDefeat(target, attacker) {
  const m = game.mission;
  const essence = sample(game.pokemon.get(target.dex).essences);
  const row = game.pokemon.get(target.dex);
  const base = row.legendary ? 5 : row.mythical ? 4 : row.stage >= 3 ? 3 : row.stage === 2 || row.final ? 2 : 1;
  const amount = (base + game.perks.essence) * (target.boss ? 2 : 1);
  game.drops.push({ essence, amount, x: target.x, y: target.y });
  if (!attacker.isPlayer) return;
  m.defeated.push(target.dex);
  if (m.target === target.dex) m.kills++;
  console.info('[Esencia]', essence, amount, target.dex);
}

export function exitKind(m, floor, cleared) {
  if (m.type === 'retrieve') {
    if (floor < m.floors) return 'stairs';
    return m.recovered ? 'portal' : 'objective';
  }
  if (m.type === 'hunt') {
    if (m.kills >= m.quota) return 'portal';
    const preyAlive = game.entities.some(e => !e.isPlayer && e.dex === m.target && e.hp > 0);
    return preyAlive ? null : 'stairs';
  }
  if (!cleared) return null;
  return floor < m.floors ? 'stairs' : 'portal';
}

// Ordenamos por el total de la run; un sorteo previo resuelve empates sin
// alterar la prioridad. Solo la esencia de la forma actual conserva su línea.
export function rewardOptions() {
  const m = game.mission, current = game.pokemon.get(game.player.dex);
  const defeated = [...new Set(m.defeated)].map(id => game.pokemon.get(id));
  // Solo cuentan las esencias de un tipo individual. No se consumen al evolucionar.
  function unlocked(row) {
    if (row.stage >= 3 && m.number < 50) return false;
    if (row.root !== current.root || row.stage <= current.stage) return true;
    const rule = current.evolutions.find(rule => rule.to === row.dex);
    return !!rule && rule.essences.some(id => (game.essences[id] || 0) >= rule.amount);
  }
  if (!defeated.length) return [];
  const hasBonus = row => Boolean(game.formEssence) && row.root === current.root;
  const priority = id => id === game.formEssence ? 2 :
    Number(defeated.some(row => hasBonus(row) && unlocked(row) && row.essences.includes(id)));
  const groups = Object.entries(game.essences).map(([id, total]) => ({ id, total, tie: Math.random() }))
    .sort((a,b) => b.total - a.total || priority(b.id) - priority(a.id) || a.tie - b.tie);
  const choices = [], used = new Set();
  for (const { id } of groups) {
    const continuation = id === game.formEssence && groups.slice(0, 3).some(entry => entry.id === id);
    const evolutions = continuation ? current.next.map(dex => game.pokemon.get(dex)).filter(unlocked) : [];
    const candidates = continuation ? (evolutions.length ? evolutions : [current]) :
      defeated.filter(row => row.essences.includes(id));
    const available = candidates.filter(row => !used.has(row.dex) && unlocked(row));
    const family = available.filter(hasBonus);
    const row = sample(family.length ? family : available);
    if (!row) continue;
    used.add(row.dex);
    choices.push({ row, essence: id, bonus: hasBonus(row) });
    if (choices.length === 3) break;
  }
  // Con dos o más bajas de la misma esencia aún podemos ofrecer tres especies
  // diferentes. Las misiones con menos de tres candidatos muestran los disponibles.
  for (const choice of [...choices]) {
    if (choice.essence === game.formEssence) continue;
    const remaining = defeated.filter(row => row.essences.includes(choice.essence) && !used.has(row.dex) && unlocked(row));
    while (choices.length < 3 && remaining.length) {
      const index = Math.floor(Math.random() * remaining.length);
      const [row] = remaining.splice(index, 1);
      if (used.has(row.dex)) continue;
      used.add(row.dex);
      choices.push({ row, essence: choice.essence, bonus: hasBonus(row) });
    }
  }
  return choices;
}
