import { assetUrl } from './asset-url.js';

// Guarda la hoja entre aventuras. GitHub Raw sirve el CSS como texto, por lo que
// se inserta tras resolver sus rutas relativas contra el archivo fijado al SHA.
let interfaceStylesheet;

export function loadInterfaceStylesheet() {
  if (!interfaceStylesheet) {
    const stylesheetUrl = assetUrl('../../css/pokewalk.css', import.meta.url);
    interfaceStylesheet = fetch(stylesheetUrl)
      .then(async response => {
        if (!response.ok) throw new Error('No se pudo cargar css/pokewalk.css');
        const css = await response.text();
        const style = document.createElement('style');
        style.textContent = css.replace(/url\("((?:\.\.\/|\.\/)[^"]+)"\)/g,
          (_, path) => 'url("' + new URL(path, stylesheetUrl).href + '")');
        document.head.append(style);
      })
      .catch(error => {
        interfaceStylesheet = undefined;
        throw error;
      });
  }
  return interfaceStylesheet;
}

// Lee el tema del canvas una vez al arrancar para evitar recalcular CSS en cada fotograma.
export function readCanvasTheme(app) {
  const style = getComputedStyle(app);
  const get = name => style.getPropertyValue('--' + name).trim();
  const number = name => Number(get(name));
  const frame = (panel, opacity = 'hud-textbox-opacity') => ({
    variant: get('hud-' + panel + '-textbox'),
    background: 'rgb(' + get('hud-textbox-background-rgb') + ' / ' + get(opacity) + ')',
  });
  return {
    frames: {
      health: frame('health'),
      essences: frame('essences'),
      stats: frame('stats', 'hud-stats-textbox-opacity'),
      mission: frame('mission'),
      battery: frame('battery'),
      essenceTooltip: frame('essence-tooltip'),
    },
    hudScale: number('hud-scale'),
    hudStatsScale: number('hud-stats-scale'),
    hudText: get('hud-text-color'),
    batteryText: get('hud-battery-color'),
    statIncrease: get('hud-stat-increase'),
    statDecrease: get('hud-stat-decrease'),
    playerHealthEmpty: get('hud-health-empty'),
    enemyHealthEmpty: get('enemy-health-empty'),
    healthFull: get('health-full'),
    healthMedium: get('health-medium'),
    healthLow: get('health-low'),
    dungeonVoid: get('dungeon-void'),
    playerShadow: get('player-shadow'),
    otherPokemonShadow: get('other-pokemon-shadow'),
    graceOpacity: number('player-grace-opacity'),
    shellFilter:get('shell-filter'),
    poisonFilter:get('poison-attack-filter'),
    psychicFilter:get('psychic-attack-filter'),
    fireFilter:get('fire-attack-filter'),
    tropicalFilter:get('tropical-filter'),
    goldenFilter: get('player-golden-filter'),
    amuletFilter: get('player-amulet-filter'),
    evasionFilter: get('pokemon-evasion-filter'),
    hitFilter: get('pokemon-hit-filter'),
    leaderFlashFilters: ['first', 'second', 'third'].map(step => get('leader-flash-' + step)),
    goldenWeaponFilter: get('golden-weapon-filter'),
    damageOutline: get('damage-outline'),
    damageText: get('damage-text'),
    criticalDamageText: get('critical-damage-text'),
    worldNoticeColors: { EXP: get('experience-notice-color'), HP: get('healing-notice-color') },
    worldNoticeOutline: get('world-notice-outline'),
  };
}
