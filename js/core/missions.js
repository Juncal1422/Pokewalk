import { awardExperience } from './experience.js';
import { evolutionPayment } from './evolution.js';
import { game } from './state.js';

const layouts = {
  retrieve: ['Recuperar objeto', 4, 2, 4], clear: ['Limpiar piso', 2, 2, 2],
  leader: ['Vence al líder', 5, 5, 5], hunt: ['Caza', 3, 2, 2],
};
export const sample = list => list[Math.floor(Math.random() * list.length)];

// Posición 0 corresponde a un bioma de nivel 1.
const floorCaps = {
  retrieve: [3,5,7,10,15,20,25,30,40,50], clear: [2,3,4,5,6,7,10,15,20,25],
  hunt: [2,3,5,7,10,15,20,30,40,50],
};
const enemyCaps = {
  retrieve: [2,3,3,4,4,4,5,5,6,6], clear: [2,3,3,4,5,6,7,8,9,10],
  hunt: [4,5,6,7,8,8,9,9,10,10],
};
const between = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

export function chooseBiome(biomes, missionNumber) {
  const preferred = Math.min(10, 1 + (missionNumber - 1) / 8);
  const weights = biomes.map(b => Math.exp(-Math.abs(b.level - preferred) / 1.5));
  let roll = Math.random() * weights.reduce((sum, weight) => sum + weight, 0);
  return biomes.find((_, i) => (roll -= weights[i]) < 0) ?? biomes.at(-1);
}

export function newMission(number, biome, playerLevel) {
  const type = number % 4 === 0 ? 'leader' : sample(['retrieve', 'clear', 'hunt']);
  const [name, pasillos, habitaciones, cruces] = layouts[type];
  const floors = type === 'leader' ? 1 : between(biome.level, floorCaps[type][biome.level - 1]);
  const band = playerLevel <= 16 ? '1-16' : playerLevel <= 36 ? '17-36' : playerLevel <= 60 ? '37-60' : '61-100';
  const pool = (type === 'leader' ? biome.leaders : biome.wild)[band];
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
  const max = enemyCaps[m.type][m.biome.level - 1];
  const count = between(Math.ceil(max / 2), max);
  while (ids.length < count) {
    const unused = m.pool.filter(id => !ids.includes(id));
    ids.push(sample(unused.length ? unused : m.pool));
  }
  return ids;
}

export function onDefeat(target, attacker) {
  const m = game.mission;
  const essence = sample(game.pokemon.get(target.dex).essences);
  const row = game.pokemon.get(target.dex);
  const base = row.legendary ? 5 : row.mythical ? 4 : row.stage >= 3 ? 3 : row.stage === 2 || row.final ? 2 : 1;
  const amount = base * (target.boss ? 2 : 1);
  game.drops.push({ essence, amount, x: target.x, y: target.y });
  if (!attacker.isPlayer) return;
  awardExperience(target);
  if (!target.boss) m.defeated.push(target.dex);
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
export function rewardOptions(current = game.pokemon.get(game.player.dex), balancesByType = game.essences, formEssence = game.formEssence) {
  const m = game.mission;
  const defeated = [...new Set(m.defeated)].map(id => game.pokemon.get(id));
  const choices = [], used = new Set();
  const otherLines = defeated.filter(row => row.root !== current.root);
  const evolutions = current.evolutions.map(rule => ({
    row: game.pokemon.get(rule.to), payment: evolutionPayment(rule, balancesByType, formEssence),
  })).filter(option => option.payment);
  const balances = Object.entries(balancesByType).filter(([,total]) => total > 0)
    .map(([type,total]) => ({ type, total, tie: Math.random() }))
    .sort((a,b) => b.total - a.total || Number(b.type === formEssence) - Number(a.type === formEssence) || a.tie - b.tie);
  function add(row, essence, bonus = false, payment = null) {
    choices.push({ row, essence, bonus, payment });
    used.add(row.dex);
  }
  // Una rama pagable tiene prioridad incluso al completar una misión sin bajas.
  for (const option of evolutions.slice().sort((a,b) =>
    balancesByType[b.payment.type] - balancesByType[a.payment.type]).slice(0,3)) {
    add(option.row, option.payment.type, true, option.payment);
  }
  for (const {type} of balances) {
    if (choices.length === 3) break;
    if (!evolutions.length && formEssence && current.essences.includes(type) && !used.has(current.dex)) {
      add(current, type, true);
    } else {
      const row = sample(otherLines.filter(row => row.essences.includes(type) && !used.has(row.dex)));
      if (row) add(row,type);
    }
  }
  for (const {type} of balances) {
    const rest = otherLines.filter(row => row.essences.includes(type) && !used.has(row.dex));
    while (choices.length < 3 && rest.length) add(rest.splice(Math.floor(Math.random()*rest.length),1)[0],type);
  }
  return choices;
}
