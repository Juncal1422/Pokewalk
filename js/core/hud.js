import { assetUrl } from './asset-url.js';
import { experienceCost } from './experience.js';
import { gameTime } from './clock.js';
import { game } from './state.js';
import { playerStats } from './benefits.js';
import {combatChance} from './modifiers.js';
import { chanceBases, labels, statText } from './stats.js';

import { drawFrame } from './message-frame.js';

const icons = {};
// Obtiene la imagen precargada de un tipo de esencia.
export const essenceIcon = id => icons['essence-' + id];
// Dibuja el marco de mensajes con el recurso compartido de la interfaz.
function textBox(drawingContext, frame, x, y, width, height) {
  const key=frame.variant==='blue' && game.frameColor && game.frameColor!=='blue' ? 'textbox-b-'+game.frameColor : frameAssets[frame.variant];
  const image = icons[key];
  if (image) drawFrame(drawingContext, image, x, y, width, height, frame.background);
}
const frameAssets = { blue: 'textbox-b', 'blue-thin': 'textbox-b-thin', green: 'textbox-g', pink: 'textbox-p' };
const compact = new Intl.NumberFormat('es', { notation: 'compact', maximumFractionDigits: 1 });
// Abrevia cantidades grandes para que quepan en los contadores.
const formatValue = value => value >= 1000 ? compact.format(value) : String(value);
export const essenceNames = 'normal fire water electric grass ice fighting poison ground flying psychic bug rock ghost dragon dark steel'.split(' ');
const typeLabels = {normal:'Normal',fire:'Fuego',water:'Agua',electric:'Eléctrico',grass:'Planta',ice:'Hielo',
  fighting:'Lucha',poison:'Veneno',ground:'Tierra',flying:'Volador',psychic:'Psíquico',bug:'Bicho',
  rock:'Roca',ghost:'Fantasma',dragon:'Dragón',dark:'Siniestro',steel:'Acero'};
// Precarga las esencias y los marcos utilizados por la interfaz del canvas.
export async function loadHud() {
  // Los iconos se decodifican antes del primer fotograma.
  console.debug('[HUD] Cargando interfaz y esencias');
  await Promise.all([...essenceNames.map(id => 'essence-' + id), ...Object.values(frameAssets), ...['black','pink','green','red','white','yellow'].map(c=>'textbox-b-'+c), 'hpbar'].map(async key => {
    const image = new Image();
    image.src = assetUrl('../../assets/ui/' + key + '.png', import.meta.url).href;
    await image.decode();
    icons[key] = image;
  }));
}

// Un indicador por recogida permite ver dos efectos consecutivos del mismo atributo.
function indicators(drawingContext,key,x,y,simulationTime) {
  const theme = game.canvasTheme;
  drawingContext.save();
  drawingContext.textBaseline = 'middle';
  for (const pickupIndicator of game.pickups.filter(entry => entry.key === key)) {
    drawingContext.globalAlpha = Math.min(1, ((pickupIndicator.duration??1500) - (simulationTime-pickupIndicator.time)) / 800);
    drawingContext.fillStyle = (key === 'size' ? pickupIndicator.delta < 0 : pickupIndicator.delta > 0) ? theme.statIncrease : theme.statDecrease;
    const text = (pickupIndicator.delta > 0 ? '+' : '') + formatValue(pickupIndicator.delta);
    drawingContext.fillText(text,x,y); x += drawingContext.measureText(text).width + 6;
  }
  drawingContext.restore();
}

// Compone la vida, experiencia, esencias, atributos y objetivo en coordenadas de interfaz.
export function drawHud(drawingContext, canvas, player) {
  const theme = game.canvasTheme;
  const simulationTime = gameTime();
  game.pickups = game.pickups.filter(pickupIndicator => simulationTime - pickupIndicator.time < (pickupIndicator.duration??1500));
  const baseWidth = Math.min(144, canvas.width * 0.22);
  const length = baseWidth * Math.min(2, player.stats.hpMax / game.initialHP);
  const fraction = Math.max(0,Math.min(1, player.hp / player.stats.hpMax));
  // Los anchos del hueco siguen las seis filas interiores del nuevo marco.
  const scale = 2, endCapWidth = Math.min(16 * scale, length / 3);
  const left = 8, top = 2, healthBarImage = icons.hpbar;
  const innerInset=endCapWidth/2;
  const fillEdge=left+innerInset+(length-2*innerInset)*fraction;
  [14,12,9,8,9,12].forEach((edge,rowIndex) => {
    const inset = edge*endCapWidth/16, x=left+inset, y=top+(8+rowIndex)*scale, width=length-2*inset;
    drawingContext.fillStyle = theme.playerHealthEmpty;
    drawingContext.fillRect(x,y,width,scale);
    drawingContext.fillStyle = fraction < .25 ? theme.healthLow : fraction < .5 ? theme.healthMedium : theme.healthFull;
    drawingContext.fillRect(x,y,Math.max(0,Math.min(width,fillEdge-x)),scale);
  });
  const widths = [endCapWidth, length - 2 * endCapWidth, endCapWidth];
  let cursor = left;
  for (let part = 0; part < 3; part++) {
    drawingContext.drawImage(healthBarImage, part * 16, 0, 16, 16, cursor, top, widths[part], 16 * scale);
    cursor += widths[part];
  }
  drawingContext.font = 'bold 17px Wondermail';
  drawingContext.textBaseline = 'middle';
  const health = player.hp + '/' + player.stats.hpMax;
  textBox(drawingContext, theme.frames.health, cursor, 5, drawingContext.measureText(health).width + 18, 32);
  drawingContext.fillStyle = theme.hudText;
  drawingContext.fillText(health, cursor + 9, 21);
  indicators(drawingContext, 'hp', cursor + 9, 43, simulationTime);
  let index = 0, hoveredType;
  const pointer = game.hudPointer;
  const hudScale = drawingContext.getTransform().a;
  const pointerX = pointer?.x/hudScale, pointerY = pointer?.y/hudScale;
  const entries = Object.entries(game.essences).filter(([,count])=>count>0);
  const statsScale=Math.min(theme.hudStatsScale,canvas.width*.38/205);
  const essenceLeft=205*statsScale;
  const cell=Math.min(41,(canvas.width-essenceLeft-10)/Math.max(1,entries.length));
  const icon=Math.min(24,cell), essenceTop=canvas.height-icon-21;
  if(entries.length)textBox(drawingContext,theme.frames.essences,essenceLeft-4,essenceTop-5,cell*entries.length+10,icon+25);
  drawingContext.font='bold 12px Wondermail';
  drawingContext.textAlign='center';
  for(const [id,count] of entries){
    const center=essenceLeft+(index++ + .5)*cell,x=center-icon/2;
    drawingContext.drawImage(icons['essence-'+id],x,essenceTop,icon,icon);
    drawingContext.fillStyle=theme.hudText;
    drawingContext.fillText(formatValue(count),center,essenceTop+icon+5,cell);
    if(pointerX>=x && pointerX<x+icon && pointerY>=essenceTop && pointerY<essenceTop+icon)hoveredType=typeLabels[id];
  }
  drawingContext.textAlign='left';
  drawingContext.save();
  drawingContext.translate(0,canvas.height);
  drawingContext.scale(statsScale, statsScale);
  drawingContext.translate(0,-canvas.height);
  drawingContext.font = 'bold 13px Wondermail';
  const statRows=Object.entries(labels).filter(([key])=>key!=='hpMax');
  if (!game.statsCollapsed) {
    let y = canvas.height - 30 - 19 * statRows.length - 6;
    textBox(drawingContext, theme.frames.stats, 4, y - 25, 198, canvas.height - y - 5);
    drawingContext.fillStyle = theme.hudText;
    drawingContext.fillText('Nv. '+player.level+' · '+(game.progress<100 ? game.xp+'/'+experienceCost(game.progress)+' EXP' : 'MÁX'),12,y-10);
    // Comparamos con los mismos objetos y nivel, antes de aplicar los beneficios.
    const baseStats = playerStats(game.pokemon.get(player.dex), game.progress, player.bonuses, new Set());
    for (const [key, label] of statRows) {
      const value = key in chanceBases ? combatChance(player,key) : player.stats[key];
      const delta = (value - baseStats[key]) * (key === 'size' ? -1 : 1);
      drawingContext.fillStyle = delta > 0 ? theme.statIncrease : delta < 0 ? theme.statDecrease : theme.hudText;
      drawingContext.textAlign = 'left';
      drawingContext.fillText(label,12,y+9);
      drawingContext.textAlign = 'right';
      drawingContext.fillText(statText(key,value),178,y+9);
      drawingContext.textAlign = 'left';
      indicators(drawingContext, key, 182, y + 9, simulationTime);
      y += 19;
    }
  }
  drawingContext.restore();
  drawingContext.save();
  drawingContext.font = 'bold 17px Wondermail';
  drawingContext.textAlign = 'right';
  drawingContext.textBaseline = 'top';
  const mission = game.mission;
  const counter = 'Aventura ' + game.adventure + ' · Misión '+mission.number+' · Piso ' + game.floor + '/' + mission.floors;
  const goal = mission.type==='rescue' && game.rescueAlly ? (mission.failed?'Rescate fallido':'Aliado · '+game.rescueAlly.hp+' HP') : mission.type === 'hunt' ? 'Caza: ' + game.pokemon.get(mission.target).name + ' ' + mission.kills + '/' + mission.quota :
    mission.type === 'retrieve' && mission.recovered ? 'Objeto recuperado' : mission.name;
  const width = Math.ceil(Math.max(drawingContext.measureText(counter).width, drawingContext.measureText(goal).width));
  const panelTop = canvas.width < 580 ? 46 : 5;
  textBox(drawingContext, theme.frames.mission, canvas.width - width - 27, panelTop, width + 22, 59);
  drawingContext.fillStyle = theme.hudText;
  drawingContext.fillText(counter, canvas.width - 15, panelTop + 8);
  drawingContext.fillText(goal, canvas.width - 15, panelTop + 31);
  if(game.runRelics?.has('depleted_battery')){
    const battery='R · Batería '+Math.floor(game.batteryEnergy/4)+' · '+game.batteryEnergy%4+'/4';
    const batteryWidth=drawingContext.measureText(battery).width;
    textBox(drawingContext, theme.frames.battery, canvas.width-batteryWidth-27,panelTop+60,batteryWidth+22,30);
    drawingContext.fillStyle=theme.batteryText;
    drawingContext.fillText(battery,canvas.width-15,panelTop+65);
  }
  drawingContext.restore();
  if (hoveredType) {
    drawingContext.save();
    drawingContext.font='bold 16px Wondermail';
    drawingContext.textAlign='left';
    drawingContext.textBaseline='middle';
    const label='Esencia · '+hoveredType, width=drawingContext.measureText(label).width+16;
    const x=Math.max(0,Math.min(pointerX+8,canvas.width-width)), y=Math.min(pointerY+14,canvas.height-28);
    textBox(drawingContext, theme.frames.essenceTooltip, x,y,width,28);
    drawingContext.fillStyle=theme.hudText;
    drawingContext.fillText(label,x+8,y+14);
    drawingContext.restore();
  }
}
