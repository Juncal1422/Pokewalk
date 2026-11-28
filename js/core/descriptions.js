import {labels,statText} from './stats.js';

const types={fire:'Fuego',water:'Agua',grass:'Planta',electric:'Eléctrico',ice:'Hielo',dragon:'Dragón',normal:'Normal',flying:'Volador',rock:'Roca',ground:'Tierra',ghost:'Fantasma',fighting:'Lucha',dark:'Siniestro',psychic:'Psíquico',steel:'Acero',poison:'Veneno',bug:'Bicho'};
const signed=n=>(n>0?'+':'')+String(n).replace('-','−');
const basicAttack=action=>'Ataque básico: '+action+'.';
const phrases={
  basicAttack:r=>basicAttack(r.basicAttack),
  attackType:r=>basicAttack('daño de tipo '+types[r.element??r.attackType]),
  lowHPAttack:r=>r.lowHPAttack,
  halfGain:r=>'Las mejoras de '+labels[r.halve].toLowerCase()+' se reducen a la mitad.',
  stats:r=>Object.entries(r.stats).map(([k,n])=>labels[k]+' '+statText(k,signed(n))+'.').join(' '),
  heal:r=>'Recuperas el '+Math.round(r.healFraction*100)+'% de tus HP máximos.',
  essenceCandy:r=>'Recoges el doble de esencias de tipo '+types[r.essence]+'. Al recoger la grajea, recuperas 1 HP por cada esencia de ese tipo que tengas.',
  threshold:r=>{const {key,threshold,delta}=r.thresholdStat;return labels[key]+' '+signed(delta)+' si está '+(delta>0?'por debajo':'por encima')+' de '+threshold+'. En otro caso, '+signed(Math.sign(delta))+'.';},
  slot:r=>r.slot.toUpperCase()+' ·',
  cooldown:r=>'Recarga de '+(r.cooldown??r.amount)+' s.'
};

// Se resuelve al cargar el catálogo, antes de construir tarjetas, inventario y tienda.
export function formatDescription(record){
  return record.description.replace(/\{(\w+)\}/g,(_,key)=>phrases[key](record))
    .replaceAll(' por ciento','%').replace(/\bPV\b/g,'HP');
}
