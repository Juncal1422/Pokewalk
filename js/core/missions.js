import { game } from './state.js';

const layouts = {
  retrieve: ['Recuperar objeto', 5, 1, 5], clear: ['Limpiar zona', 2, 3, 4],
  leader: ['Vence al líder', 5, 5, 5], hunt: ['Caza', 5, 1, 5],
};
export const sample = list => list[Math.floor(Math.random() * list.length)];

export function eligible(row, number, boss = false) {
  if (boss) {
    if (number <= 6) return row.final && [2, 3].includes(row.stage);
    if (number <= 16) return row.mythical || (row.final && row.stage === 3);
    return row.legendary;
  }
  if (row.legendary || row.mythical) return false;
  if (number <= 6) return row.stage === 1 && !row.final;
  if (number <= 16) return row.stage === 2 || (row.stage === 1 && row.final);
  return row.final;
}

export function newMission(number, biome) {
  const type = number % 4 === 0 ? 'leader' : sample(['retrieve', 'clear', 'hunt']);
  const [name, pasillos, habitaciones, cruces] = layouts[type];
  const floors = 1 + Math.floor(Math.random() * Math.min(20, number + 2));
  const pool = biome.wild.filter(id => eligible(game.pokemon.get(id), number));
  const target = type === 'hunt' ? sample(pool) : null;
  const mission = { number, biome, type, name, floors, pool, target, quota: target ? 1 + Math.floor(Math.random() * floors) : 0,
    kills: 0, defeated: [], recovered: false, layout: { pasillos, habitaciones, cruces } };
  console.info('[Misión]', name, { number, floors, biome: biome.name, target });
  return mission;
}

// Una presa garantizada por piso permite completar cualquier cuota de caza.
export function encounters(m, floor) {
  if (m.type === 'leader' && floor === m.floors) {
    return [sample(m.biome.wild.filter(id => eligible(game.pokemon.get(id), m.number, true)))];
  }
  const ids = m.target ? [m.target] : [];
  while (ids.length < 4) ids.push(sample(m.pool.filter(id => !ids.includes(id))));
  return ids;
}

export function onDefeat(target, attacker) {
  if (!attacker.isPlayer) return;
  const m = game.mission;
  const essence = sample(game.pokemon.get(target.dex).essences);
  const row = game.pokemon.get(target.dex);
  const base = row.legendary ? 5 : row.mythical ? 4 : row.stage >= 3 ? 3 : row.stage === 2 || row.final ? 2 : 1;
  game.essences[essence] = (game.essences[essence] || 0) + base + game.perks.essence;
  m.defeated.push(target.dex);
  if (m.target === target.dex) m.kills++;
  console.info('[Esencia]', essence, game.essences[essence], target.dex);
}

export function exitKind(m, floor, cleared) {
  if (m.type === 'retrieve') {
    if (floor < m.floors) return 'stairs';
    return m.recovered ? 'portal' : 'objective';
  }
  if (m.type === 'hunt' && m.kills >= m.quota) return 'portal';
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
    choices.push({ row, essence: id, bonus: game.formEssence && current.root === row.root ? game.pokemon.get(row.root)?.mejora : null });
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
      choices.push({ row, essence: choice.essence, bonus: game.formEssence && current.root === row.root ? game.pokemon.get(row.root)?.mejora : null });
    }
  }
  return choices;
}
