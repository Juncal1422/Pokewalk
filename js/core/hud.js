import { assetUrl } from './asset-url.js';
import { experienceCost } from './experience.js';
import { gameTime } from './clock.js';
import { game } from './state.js';
import { playerStats } from './benefits.js';
import { labels } from './stats.js';

import { drawFrame } from './message-frame.js';

const icons = {};
// Obtiene la imagen precargada de un tipo de esencia.
export const essenceIcon = id => icons['essence-' + id];
// Dibuja el marco de mensajes con el recurso compartido de la interfaz.
export const textBox = (drawingContext,x,y,width,height) => drawFrame(drawingContext,icons['textbox-b'],x,y,width,height);
const compact = new Intl.NumberFormat('es', { notation: 'compact', maximumFractionDigits: 1 });
// Abrevia cantidades grandes para que quepan en los contadores.
const formatValue = value => value >= 1000 ? compact.format(value) : String(value);
export const essenceNames = 'normal fire water electric grass ice fighting poison ground flying psychic bug rock ghost dragon dark steel'.split(' ');
// Precarga las esencias y los marcos utilizados por la interfaz del canvas.
export async function loadHud() {
  // Los iconos se decodifican antes del primer fotograma.
  console.debug('[HUD] Cargando interfaz y esencias');
  await Promise.all([...essenceNames.map(id => 'essence-' + id), 'textbox-b', 'textbox-b-thin', 'hpbar'].map(async key => {
    const image = new Image();
    image.src = assetUrl('../../assets/ui/' + key + '.png', import.meta.url).href;
    await image.decode();
    icons[key] = image;
  }));
}

// Un indicador por recogida permite ver dos efectos consecutivos del mismo atributo.
function indicators(drawingContext,key,x,y,simulationTime) {
  drawingContext.save();
  drawingContext.textBaseline = 'middle';
  for (const pickupIndicator of game.pickups.filter(entry => entry.key === key)) {
    drawingContext.globalAlpha = Math.min(1, ((pickupIndicator.duration??1500) - (simulationTime-pickupIndicator.time)) / 800);
    drawingContext.fillStyle = (key === 'size' ? pickupIndicator.delta < 0 : pickupIndicator.delta > 0) ? '#79ed8e' : '#ff7474';
    const text = (pickupIndicator.delta > 0 ? '+' : '') + formatValue(pickupIndicator.delta);
    drawingContext.fillText(text,x,y); x += drawingContext.measureText(text).width + 6;
  }
  drawingContext.restore();
}

// Compone la vida, experiencia, esencias, atributos y objetivo en coordenadas de interfaz.
export function drawHud(drawingContext, canvas, player) {
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
    drawingContext.fillStyle = '#15202b';
    drawingContext.fillRect(x,y,width,scale);
    drawingContext.fillStyle = fraction < .25 ? '#ef5350' : fraction < .5 ? '#ffd54f' : '#66cf77';
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
  textBox(drawingContext, cursor, 5, drawingContext.measureText(health).width + 18, 32);
  drawingContext.fillStyle = '#fff';
  drawingContext.fillText(health, cursor + 9, 21);
  indicators(drawingContext, 'hp', cursor + 9, 43, simulationTime);
  let index = 0;
  const columns = Math.max(1, Math.min(5, Math.floor(canvas.width / 146)));
  const essenceTop = canvas.width < 580 ? 109 : 48;
  const entries = Object.entries(game.essences);
  if (entries.length) textBox(drawingContext, 4, essenceTop, Math.min(columns, entries.length) * 80 + 9, Math.ceil(entries.length / columns) * 40 + 10);
  for (const [id, count] of entries) {
    const x = 8 + (index % columns) * 80, y = essenceTop + 4 + Math.floor(index / columns) * 40;
    drawingContext.drawImage(icons['essence-' + id], x, y, 38.4, 38.4);
    drawingContext.fillStyle = '#fff';
    drawingContext.fillText(formatValue(count), x + 40, y + 20);
    index++;
  }
  drawingContext.save();
  drawingContext.translate(0,canvas.height);
  drawingContext.scale(1.15,1.15);
  drawingContext.translate(0,-canvas.height);
  drawingContext.font = 'bold 13px Wondermail';
  let y = canvas.height - 19 * Object.keys(labels).length - 6;
  drawFrame(drawingContext, icons['textbox-b-thin'], 4, y - 25, 185, canvas.height - y + 25, .25);
  drawingContext.fillStyle = '#fff';
  drawingContext.fillText('Nv. '+player.level+' · '+(game.progress<100 ? game.xp+'/'+experienceCost(game.progress)+' EXP' : 'MÁX'),12,y-10);
  // Comparamos con los mismos objetos y nivel, antes de aplicar los beneficios.
  const baseStats = playerStats(game.pokemon.get(player.dex), game.progress, player.bonuses, new Set());
  for (const [key, label] of Object.entries(labels)) {
    const delta = (player.stats[key] - baseStats[key]) * (key === 'size' ? -1 : 1);
    drawingContext.fillStyle = delta > 0 ? '#79ed8e' : delta < 0 ? '#ff7474' : '#fff';
    drawingContext.textAlign = 'left';
    drawingContext.fillText(label,12,y+9);
    drawingContext.textAlign = 'right';
    drawingContext.fillText(String(player.stats[key]),178,y+9);
    drawingContext.textAlign = 'left';
    indicators(drawingContext, key, 182, y + 9, simulationTime);
    y += 19;
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
  textBox(drawingContext, canvas.width - width - 27, panelTop, width + 22, 59);
  drawingContext.fillStyle = '#fff';
  drawingContext.fillText(counter, canvas.width - 15, panelTop + 8);
  drawingContext.fillText(goal, canvas.width - 15, panelTop + 31);
  if(game.runRelics?.has('depleted_battery')){
    const battery='E · Batería '+Math.floor(game.batteryEnergy/10)+' · '+game.batteryEnergy%10+'/10';
    const batteryWidth=drawingContext.measureText(battery).width;
    textBox(drawingContext,canvas.width-batteryWidth-27,panelTop+60,batteryWidth+22,30);
    drawingContext.fillStyle='#c8edff';
    drawingContext.fillText(battery,canvas.width-15,panelTop+65);
  }
  drawingContext.restore();
}
