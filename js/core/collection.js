import { game } from './state.js';

const storageKey = 'pokewalk.pommedew.collection.v1';
// Durante las pruebas se puede activar cualquier reliquia y visitar todos los biomas.
export const testingUnlocks = true;
export function isUnlocked(key,id) {
  return testingUnlocks || game.collection?.[key]?.includes(id);
}
export const relics = {
  ...Object.fromEntries([
    ['egg_articuno','Huevo de Articuno','mt.-freeze','Monte Helado',144,'Articuno','items/gem_articuno.png'],
    ['egg_zapdos','Huevo de Zapdos','mt.-travail','Monte Esfuerzo',145,'Zapdos','items/gem_zapdos.png'],
    ['egg_moltres','Huevo de Moltres','burning-mountain','Monte Ardiente',146,'Moltres','items/gem_moltres.png'],
    ['relic_ice','Criorreliquia','relic','Reliquia Enterrada',378,'Regice','relics/relic_ice.png'],
    ['relic_rock','Petrorreliquia','relic','Reliquia Enterrada',377,'Regirock','relics/relic_rock.png'],
    ['relic_steel','Siderorreliquia','relic','Reliquia Enterrada',379,'Registeel','relics/relic_steel.png'],
  ].map(([id,name,biome,place,dex,species,image]) => [id,{name,biome,dex,image,guildEgg:id.startsWith('egg_'),price:0,
    description:'Desde la misión 25, '+species+' aparece como líder en '+place+'.'}])),
  debugger: {
    name: 'Debugger',
    stats: {attack:300,defense:300,speed:200,attackSpeed:100,range:100,hpMax:100},
    price: 0,
    image: 'relics/debugger.png',
    description: 'Empieza con 100 esencias de cada tipo. Ataque y defensa +300, velocidad +200, PV, rango y velocidad de ataque +100 y esencias recogidas ×4. Probabilidad de objetos ×1,5.',
  },
  black_sash: {
    name: 'Cinta Negra',
    price: 12,
    description:
      'Fija la defensa base de cada forma. La mitad de los aumentos de defensa se convierte en ataque.',
  },
  depleted_battery: {
    name: 'Batería agotada',
    price: 18,
    description:
      'R · Cada 4 esencias eléctricas almacena una descarga de ataque ×4 y alcance ×3.',
  },
};

// El archivo conserva IDs y crónicas, nunca referencias a pisos, entidades o catálogos.
export function emptyCollection() {
  return {
    version: 1,
    intro: false,
    volume: 0.6,
    emblems: 0,
    forms: [],
    items: [],
    benefits: [],
    synergies: [],
    biomes: [],
    relics: ['debugger'],
    enabled: [],
    history: [],
  };
}

// Valida todo el documento antes de sustituir el guardado, conservando IDs de otras versiones.
export function parseCollection(text) {
  const data = JSON.parse(text);
  const list = (values, test) => Array.isArray(values) && values.every(test);
  const id = (value) => typeof value === 'string' && value.length > 0;
  const count = (value) => Number.isSafeInteger(value) && value >= 0;
  const stats = (value) =>
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.values(value).every(Number.isFinite);
  if (
    !data ||
    data.version !== 1 ||
    typeof data.intro !== 'boolean' ||
    !count(data.emblems) ||
    !Number.isFinite(data.volume) ||
    data.volume < 0 ||
    data.volume > 1 ||
    !list(data.forms, count) ||
    !['items', 'benefits', 'synergies', 'relics', 'enabled'].every((key) =>
      list(data[key], id),
    ) ||
    !data.enabled.every((key) => data.relics.includes(key)) ||
    !list(
      data.history,
      (run) =>
        run &&
        id(run.date) &&
        id(run.status) &&
        list(run.forms, count) &&
        list(run.items, id) &&
        list(run.benefits, id) &&
        stats(run.stats) &&
        count(run.level) &&
        list(
          run.missions,
          (m) =>
            m &&
            id(m.name) &&
            id(m.biome) &&
            id(m.status) &&
            count(m.floor) &&
            count(m.floors) &&
            count(m.reward) &&
            typeof m.red === 'boolean',
        ),
    )
  )
    throw Error('El archivo no contiene una colección válida.');
  const aliases = {
    long_horn: 'rhyhorn_horn',
    cog: 'machinery',
    deep_scale: 'reinforced',
    green_scale: 'scaled',
    golden_spike: 'golden',
    green_spike: 'spiked',
    iron_tag: 'protected',
    lovefool: 'heartbreaker',
    mint_leaf: 'minty',
    silvercoat: 'swift',
    fire_brooch: 'hooh_brooch',
    spike: 'spiky',
    amulet: 'seer',
    gunpowder_rock: 'gunpowder_core',
  };
  for (const record of [data, ...data.history])
    record.benefits = [
      ...new Set(record.benefits.map((id) => aliases[id] ?? id)),
    ];
  // Traduce etiquetas históricas tanto al cargar desde el navegador como al importar.
  for (const run of data.history) {
    if (run.status === 'Rescatada') run.status = 'Fallida';
    for (const mission of run.missions) {
      if (mission.status === 'Completada') mission.status = 'Exitosa';
      if (['Derrota','Rescate fallido'].includes(mission.status)) mission.status = 'Fallida';
    }
  }
  data.biomes ??= [];
  if (!list(data.biomes,id)) throw Error('Lista de biomas desbloqueados inválida.');
  if (!data.relics.includes('debugger')) data.relics.push('debugger');
  return data;
}

// El guardado se escribe como una sola operación. Los errores nunca sustituyen un archivo válido al importar.
export function saveCollection(data = game.collection) {
  localStorage.setItem(storageKey, JSON.stringify(data));
  game.collection = data;
}

// Una recarga termina la aventura anterior. El historial sirve para leerla, no para reanudarla.
export function loadCollection() {
  const saved = localStorage.getItem(storageKey);
  const data = saved === null ? emptyCollection() : parseCollection(saved);
  for (const run of data.history)
    if (run.status === 'En curso') {
      run.status = 'Interrumpida';
      const last = run.missions.at(-1);
      if (last?.status === 'En curso') last.status = 'Interrumpida';
    }
  saveCollection(data);
}

// Abre la crónica solo cuando el jugador ha aceptado su primera misión.
export function beginChronicle() {
  game.chronicle = {
    date: new Date().toISOString(),
    status: 'En curso',
    forms: [],
    items: [],
    benefits: [],
    stats: {},
    level: 5,
    missions: [],
  };
  game.collection.history.push(game.chronicle);
}

// Anota cada descubrimiento una sola vez, incluso si un consumible vuelve a aparecer.
export function discover(kind, id) {
  if (!game.chronicle) return;
  for (const list of [game.collection[kind], game.chronicle[kind]])
    if (list && !list.includes(id)) list.push(id);
}

// Actualiza la instantánea legible tras una adquisición, al cambiar de piso o al terminar.
export function checkpoint() {
  if (!game.chronicle || !game.player) return;
  game.chronicle.stats = { ...game.player.stats };
  game.chronicle.level = game.player.level;
  game.chronicle.hp = game.player.hp;
  const current = game.chronicle.missions.at(-1);
  if (current && game.mission) {
    current.kills = game.mission.kills;
    current.quota = game.mission.quota;
    current.form = game.player.dex;
  }
  for (const id of game.held) discover('benefits', id);
  discover('forms', game.player.dex);
  for (const rule of game.synergies.values())
    if (
      (rule.items ?? []).every((id) => game.inventory.has(id)) &&
      rule.requires.every((id) => game.held.has(id)) &&
      (!rule.anyOf || rule.anyOf.some((id) => game.held.has(id)))
    )
      discover('synergies', rule.effect);
  saveCollection();
}

// Cada misión ocupa una fila; los pisos actualizan la misma fila.
export function recordFloor() {
  const mission = game.mission;
  const missions = game.chronicle.missions;
  if (game.floor === 1)
    missions.push({
      number: mission.number,
      type: mission.type,
      name: mission.name,
      biomeId: mission.biome.id,
      biome: mission.biome.name,
      floors: mission.floors,
      red: mission.red,
      reward: 0,
      status: 'En curso',
      floor: 1,
    });
  missions.at(-1).floor = game.floor;
  checkpoint();
}

// El pago se registra antes de abrir las tarjetas, una sola vez aunque se reintente la transición.
export function settleMission() {
  const entry = game.chronicle.missions.at(-1);
  if (entry.status !== 'En curso') return 0;
  entry.status = game.mission.failed ? 'Fallida' : 'Exitosa';
  if (game.chronicle.missions.filter(m => m.status === 'Exitosa').length >= 50) {
    for (const id of game.inventory) {
      const item = game.items[id];
      for (const [field, key] of [['unlockRelic','relics'],['unlockBiome','biomes']]) {
        const list = game.collection[key] ??= [];
        if (item?.[field] && !list.includes(item[field])) list.push(item[field]);
      }
    }
    game.chronicle.status = 'Exitosa';
    game.chronicle.ended = new Date().toISOString();
  }
  entry.reward = game.mission.failed ? 0 : game.mission.reward;
  game.collection.emblems += entry.reward;
  checkpoint();
  return entry.reward;
}
