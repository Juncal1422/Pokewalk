import {biomeAvailable,biomeLeaderList} from './collection.js';
import {rule} from './modifiers.js';
import {dropNewItem} from './items.js';
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

const encounterBand = number => number <= 8 ? '1-8' : number <= 16 ? '9-16' : number <= 25 ? '17-25' : number <= 36 ? '26-36' : '37-50';

// Pondera cada bioma por la distancia entre su nivel y la dificultad preferida de la misión.
export function chooseBiome(biomes, missionNumber) {
  const band = encounterBand(missionNumber);
  biomes = biomes.filter(b => b.wild[band].length && biomeAvailable(b));
  const weights = biomes.map(b => parseFloat(b._probabilidadPorOferta[band]));
  // Restar pesos de una tirada única elige el bioma según su proximidad a la dificultad objetivo.
  let roll = Math.random() * weights.reduce((sum, weight) => sum + weight, 0);
  return biomes.find((_, i) => (roll -= weights[i]) < 0) ?? biomes.at(-1);
}

// Selecciona tipo, franja de encuentros, número de pisos, presa y parámetros de generación.
export function newMission(
  number,
  biome,
  _playerLevel,
  type = sample(Object.keys(layouts)),
  red = false,
) {
  const capType = type === 'rescue' ? 'retrieve' : type;

  const [name, pasillos, habitaciones, cruces] = layouts[type];
  const floors =
    type === 'leader'
      ? 1
      : between(biome.level, floorCaps[capType][biome.level - 1]);
  const levelBand = encounterBand(number);
  const leaders = type === 'leader' ? biomeLeaderList(biome) : [];
  const specialLeaders = leaders.filter(entry => entry.relicId && entry.available &&
    number >= 25 && game.runRelics?.has(entry.relicId));
  const regular = type === 'leader' ? biome.leaders[levelBand].filter(dex =>
    !leaders.some(entry => entry.dex === dex && entry.relicId)) : biome.wild[levelBand];
  const encounterPool = specialLeaders.length ? specialLeaders.map(entry => entry.dex) : regular;
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
    relicLeader: specialLeaders.length > 0,
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
export function missionOffers(number, level, held=game.held) {
  const count=game.inventory?.has('lost_ticket')?4:3;
  const redChance=(game.inventory?.has('lost_map')?.225:.15)+rule('redChance',held);
  const redReward=rule('redReward',held), leaderChance=rule('leaderChance',held);
  const types = Object.keys(layouts).filter(type=>type!=='clear' || !leaderChance),
    redIndex = Math.random() < redChance ? Math.floor(Math.random() * count) : -1;
  // Se ajusta la probabilidad del tablón completo, sin repetir encargos.
  const baseLeaderChance=count/types.length;
  const forceLeader=baseLeaderChance<1 && Math.random()<Math.min(1,leaderChance/(1-baseLeaderChance));
  const offers = [];
  for (let index = 0; index < count; index++) {
    const biome = chooseBiome(
      game.biomes.filter((row) => !offers.some((offer) => offer.biome === row)),
      number,
    );
    const leader=types.indexOf('leader');
    const pick=index===0 && forceLeader && leader>=0?leader:Math.floor(Math.random()*types.length);
    const type=types.splice(pick,1)[0];
    const mission=newMission(number,biome,level,type,!!redReward || index===redIndex);
    offers.push(mission);
  }
  return offers;
}

// Una presa garantizada por piso permite completar cualquier cuota de caza.
export function encounters(mission, floor) {
  if (mission.type === 'leader' && floor === mission.floors) {
    return [sample(mission.pool),...(game.runRelics?.has('guild_ring') ? Array.from({length:3},()=>sample(mission.biome.wild[mission.number<=8?'1-8':mission.number<=16?'9-16':mission.number<=25?'17-25':mission.number<=36?'26-36':'37-50'])) : [])];
  }
  const speciesIds = mission.target ? [mission.target] : [];
  const max =
    enemyCaps[mission.type === 'rescue' ? 'clear' : mission.type][
      mission.biome.level - 1
    ];
  const count = between(Math.ceil(max / 2), max)+(game.runRelics?.has('guild_ring')?3:0);
  while (speciesIds.length < count) {
    speciesIds.push(sample(mission.pool));
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
  if (target.boss && (mission.red || mission.relicLeader)) mission.redLeader = target.dex;
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
  if (target.shiny) dropNewItem(target);
  if (!attacker.isPlayer) return;
  if(target.boss && rule('bossLoot'))dropNewItem(target);
  awardExperience(target);
  if (!target.boss) mission.defeated.push(target.dex);
  if (mission.target === target.dex) mission.kills++;
  console.info('[Esencia]', essence, amount, target.dex);
}

// Determina qué salida u objetivo se puede colocar según el estado de la misión.
export function exitKind(mission, floor, cleared) {
  if (mission.ejected) return 'portal';
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
    add(leader, leader.essences[0], leader.dex === current.dex);
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
    add(option.row, option.payment.type, game.donors.get(option.row.name)?.id === game.donors.get(current.name)?.id, option.payment);
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
