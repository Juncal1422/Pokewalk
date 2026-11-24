import { awardExperience } from './experience.js';
import { evolutionPayment } from './evolution.js';
import { game } from './state.js';

const layouts = {
  retrieve: ['Recuperar objeto', 4, 2, 4],
  clear: ['Limpiar piso', 2, 2, 2],
  rescue: ['Rescate', 4, 2, 4],
  leader: ['Vence al líder', 5, 5, 5],
  hunt: ['Caza', 3, 2, 2],
};
// Elige un elemento de una lista con distribución uniforme.
export const sample = (list) => list[Math.floor(Math.random() * list.length)];

// Posición 0 corresponde a un bioma de nivel 1.
const floorCaps = {
  retrieve: [3, 5, 7, 10, 15, 20, 25, 30, 40, 50],
  clear: [2, 3, 4, 5, 6, 7, 10, 15, 20, 25],
  hunt: [2, 3, 5, 7, 10, 15, 20, 30, 40, 50],
};
const enemyCaps = {
  retrieve: [2, 3, 3, 4, 4, 4, 5, 5, 6, 6],
  clear: [2, 3, 3, 4, 5, 6, 7, 8, 9, 10],
  hunt: [4, 5, 6, 7, 8, 8, 9, 9, 10, 10],
};
// Sortea una cantidad entera entre los dos límites incluidos.
const between = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

// Pondera cada bioma por la distancia entre su nivel y la dificultad preferida de la misión.
export function chooseBiome(biomes, missionNumber) {
  const preferred = Math.min(10, 1 + (missionNumber - 1) / 8);
  const weights = biomes.map((candidateBiome) =>
    Math.exp(-Math.abs(candidateBiome.level - preferred) / 1.5),
  );
  let roll = Math.random() * weights.reduce((sum, weight) => sum + weight, 0);
  return biomes.find((_, i) => (roll -= weights[i]) < 0) ?? biomes.at(-1);
}

// Selecciona tipo, franja de encuentros, número de pisos, presa y parámetros de generación.
export function newMission(
  number,
  biome,
  playerLevel,
  type = sample(Object.keys(layouts)),
  red = false,
) {
  const capType = type === 'rescue' ? 'retrieve' : type;
  playerLevel += red ? 15 : 0;
  const [name, pasillos, habitaciones, cruces] = layouts[type];
  const floors =
    type === 'leader'
      ? 1
      : between(biome.level, floorCaps[capType][biome.level - 1]);
  const levelBand =
    playerLevel <= 16
      ? '1-16'
      : playerLevel <= 36
        ? '17-36'
        : playerLevel <= 60
          ? '37-60'
          : '61-100';
  const encounterPool = (type === 'leader' ? biome.leaders : biome.wild)[
    levelBand
  ];
  const target = type === 'hunt' ? sample(encounterPool) : null;
  const layout = { pasillos, habitaciones, cruces };
  for (const key of Object.keys(layout))
    layout[key] += biome.layoutModifier[key];
  const reward =
    Math.min(
      10,
      Math.max(
        1,
        Math.ceil(biome.level * 0.7) +
          { retrieve: 0, hunt: 1, clear: 1, rescue: 2, leader: 3 }[type],
      ),
    ) * (red ? 3 : 1);
  const mission = {
    number,
    red,
    reward,
    biome,
    type,
    name,
    floors,
    pool: encounterPool,
    target,
    quota: target ? 1 + Math.floor(Math.random() * floors) : 0,
    itemBlock: -1,
    itemsPlaced: 0,
    kills: 0,
    defeated: [],
    recovered: false,
    layout,
  };
  console.info('[Misión]', name, { number, floors, biome: biome.name, target });
  return mission;
}

// La tirada roja pertenece al par completo; como máximo hay un papel rojo.
export function missionOffers(number, level) {
  const types = Object.keys(layouts),
    redIndex = Math.random() < 0.15 ? Math.floor(Math.random() * 2) : -1;
  const offers = [];
  for (let index = 0; index < 2; index++) {
    const biome = chooseBiome(
      game.biomes.filter((row) => !offers.some((offer) => offer.biome === row)),
      number,
    );
    const type = types.splice(Math.floor(Math.random() * types.length), 1)[0];
    offers.push(newMission(number, biome, level, type, index === redIndex));
  }
  return offers;
}

// Una presa garantizada por piso permite completar cualquier cuota de caza.
export function encounters(mission, floor) {
  if (mission.type === 'leader' && floor === mission.floors) {
    return [sample(mission.pool)];
  }
  const speciesIds = mission.target ? [mission.target] : [];
  const max =
    enemyCaps[mission.type === 'rescue' ? 'clear' : mission.type][
      mission.biome.level - 1
    ];
  const count = between(Math.ceil(max / 2), max);
  while (speciesIds.length < count) {
    const unused = mission.pool.filter((id) => !speciesIds.includes(id));
    speciesIds.push(sample(unused.length ? unused : mission.pool));
  }
  if (mission.type === 'rescue' && floor === mission.floors)
    speciesIds.push(sample(mission.pool));
  return speciesIds;
}

// Deja las esencias en el suelo y atribuye experiencia y progreso de misión a las bajas del jugador.
export function onDefeat(target, attacker) {
  const mission = game.mission;
  if (target.ally) {
    mission.failed = true;
    return;
  }
  if (target.boss && mission.red) mission.redLeader = target.dex;
  const essence = sample(game.pokemon.get(target.dex).essences);
  const species = game.pokemon.get(target.dex);
  const baseEssenceCount = species.legendary
    ? 5
    : species.mythical
      ? 4
      : species.stage >= 3
        ? 3
        : species.stage === 2 || species.final
          ? 2
          : 1;
  const amount = baseEssenceCount * (target.boss ? 2 : 1);
  game.drops.push({ essence, amount, x: target.x, y: target.y });
  if (!attacker.isPlayer) return;
  awardExperience(target);
  if (!target.boss) mission.defeated.push(target.dex);
  if (mission.target === target.dex) mission.kills++;
  console.info('[Esencia]', essence, amount, target.dex);
}

// Determina qué salida u objetivo se puede colocar según el estado de la misión.
export function exitKind(mission, floor, cleared) {
  if (mission.type === 'rescue') {
    if (floor < mission.floors) return 'stairs';
    return mission.failed ||
      !game.entities.some((e) => !e.isPlayer && !e.ally && e.hp > 0)
      ? 'portal'
      : null;
  }
  if (mission.type === 'retrieve') {
    if (floor < mission.floors) return 'stairs';
    return mission.recovered ? 'portal' : 'objective';
  }
  if (mission.type === 'hunt') {
    if (mission.kills >= mission.quota) return 'portal';
    const preyAlive = game.entities.some(
      (enemy) =>
        !enemy.isPlayer && enemy.dex === mission.target && enemy.hp > 0,
    );
    return preyAlive ? null : 'stairs';
  }
  if (!cleared) return null;
  return floor < mission.floors ? 'stairs' : 'portal';
}

// Ordenamos por el total de la run; un sorteo previo resuelve empates sin
// alterar la prioridad. Solo la esencia de la forma actual conserva su línea.
export function rewardOptions(
  current = game.pokemon.get(game.player.dex),
  balancesByType = game.essences,
  formEssence = game.formEssence,
) {
  const mission = game.mission;
  const defeated = [...new Set(mission.defeated)].map((id) =>
    game.pokemon.get(id),
  );
  const choices = [],
    offeredDexNumbers = new Set();
  const otherLines = defeated.filter(
    (species) => species.root !== current.root,
  );
  const evolutions = current.evolutions
    .map((rule) => ({
      row: game.pokemon.get(rule.to),
      payment: evolutionPayment(rule, balancesByType, formEssence),
    }))
    .filter((option) => option.payment);
  const balances = Object.entries(balancesByType)
    .filter(([, total]) => total > 0)
    .map(([type, total]) => ({ type, total, tie: Math.random() }))
    .sort(
      (firstCandidate, secondCandidate) =>
        secondCandidate.total - firstCandidate.total ||
        Number(secondCandidate.type === formEssence) -
          Number(firstCandidate.type === formEssence) ||
        firstCandidate.tie - secondCandidate.tie,
    );
  // Registra una opción de transformación y marca su especie para evitar duplicados.
  function add(species, essence, bonus = false, payment = null) {
    choices.push({ row: species, essence, bonus, payment });
    offeredDexNumbers.add(species.dex);
  }
  if (mission.redLeader) {
    const leader = game.pokemon.get(mission.redLeader);
    add(leader, leader.essences[0], leader.root === current.root);
  }
  // Una rama pagable tiene prioridad incluso al completar una misión sin bajas.
  for (const option of evolutions
    .slice()
    .sort(
      (firstCandidate, secondCandidate) =>
        balancesByType[secondCandidate.payment.type] -
        balancesByType[firstCandidate.payment.type],
    )
    .filter((option) => !offeredDexNumbers.has(option.row.dex))
    .slice(0, 3 - choices.length)) {
    add(option.row, option.payment.type, true, option.payment);
  }
  for (const { type } of balances) {
    if (choices.length === 3) break;
    if (
      !evolutions.length &&
      formEssence &&
      current.essences.includes(type) &&
      !offeredDexNumbers.has(current.dex)
    ) {
      add(current, type, true);
    } else {
      const species = sample(
        otherLines.filter(
          (species) =>
            species.essences.includes(type) &&
            !offeredDexNumbers.has(species.dex),
        ),
      );
      if (species) add(species, type);
    }
  }
  for (const { type } of balances) {
    const remainingCandidates = otherLines.filter(
      (species) =>
        species.essences.includes(type) && !offeredDexNumbers.has(species.dex),
    );
    while (choices.length < 3 && remainingCandidates.length)
      add(
        remainingCandidates.splice(
          Math.floor(Math.random() * remainingCandidates.length),
          1,
        )[0],
        type,
      );
  }
  return choices;
}
