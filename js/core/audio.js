import { assetUrl } from './asset-url.js';
import {game} from './state.js';
const sounds={select:'Highlight',accept:'Correct',hit:'Mach Punch',miss:'Wrong',item:'Pick up Item',berry:'Eating',xp:'Level Up',stairs:'Stairs Up',reward:'Applause',rescue:'Pokemon Joined',defeat:'Disappearing 1',flare:'Flamethrower',battery:'Thunder',mine:'Earthquake Hit',spin:'Fury Swipes',cog:'Warp Orb',charge:'Charge'};

// Cada voz lee el volumen actual; se reutiliza la URL del banco local de efectos.
export function playSound(event) {
  const volume=game.collection?.volume;
  if(!volume || !sounds[event] || typeof Audio==='undefined') return;
  const voice=new Audio(assetUrl('../../sounds/'+sounds[event]+'.wav',import.meta.url));
  voice.volume=volume;
  voice.play().catch(()=>{});
}
