import { EXCLUDED_DEX } from '../core/constants.js';
import { game } from '../core/state.js';

// Algunas hojas ya trasladan el dibujo dentro de la celda. Restamos esa
// traslación al dibujar para que solo la trayectoria de combate mueva el sprite.
function frameCenters(animation) {
  const { img, fw, fh, frames } = animation;
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img,0,0);
  const data = ctx.getImageData(0,0,img.width,img.height).data;
  return Array.from({length:Math.floor(img.height/fh)}, (_,row) =>
    Array.from({length:frames}, (_,col) => {
      let count=0, sx=0, sy=0;
      for (let y=0;y<fh;y++) for (let x=0;x<fw;x++) {
        if (data[4*((row*fh+y)*img.width+col*fw+x)+3] < 128) continue;
        sx+=x+.5; sy+=y+.5; count++;
      }
      return count ? {x:sx/count-fw/2,y:sy/count-fh/2} : {x:0,y:0};
    }));
}

async function fetchAnimation(baseUrl, animations, candidates) {
  for (const name of candidates) {
    let node = animations.find(
      (item) => item.getElementsByTagName('Name')[0]?.textContent === name,
    );
    if (!node) continue;
    // Algunas animaciones remiten a otra hoja del mismo Pokémon.
    const copyOf = node.getElementsByTagName('CopyOf')[0]?.textContent;
    const imageName = copyOf || name;
    if (copyOf)
      node =
        animations.find(
          (item) =>
            item.getElementsByTagName('Name')[0]?.textContent === copyOf,
        ) || node;
    const frameWidth = parseInt(
      node.getElementsByTagName('FrameWidth')[0]?.textContent || '32',
      10,
    );
    const frameHeight = parseInt(
      node.getElementsByTagName('FrameHeight')[0]?.textContent || '32',
      10,
    );
    const durations = Array.from(node.getElementsByTagName('Duration')).map(
      (item) => parseInt(item.textContent, 10),
    );
    try {
      const image = await new Promise((resolve, reject) => {
        const element = new Image();
        element.crossOrigin = 'Anonymous';
        element.onload = () => resolve(element);
        element.onerror = reject;
        element.src = `${baseUrl}/${imageName}-Anim.png`;
      });
      return {
        img: image,
        // HitFrame indica en qué fotograma conecta el golpe de esta hoja.
        hitFrame: parseInt(node.getElementsByTagName('HitFrame')[0]?.textContent, 10),
        fw: frameWidth,
        fh: frameHeight,
        durs: durations.length ? durations : [8],
        frames: Math.max(1, Math.floor(image.width / frameWidth)),
      };
    } catch {}
  }
  return null;
}

export async function loadPokemonData(dex) {
  if (EXCLUDED_DEX.has(dex)) return null;
  if (game.spriteCache.has(dex)) return game.spriteCache.get(dex);
  const dexStr = String(dex).padStart(4, '0');
  const baseUrl = `https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/sprite/${dexStr}`;
  try {
    const response = await fetch(`${baseUrl}/AnimData.xml`);
    if (!response.ok) return null;
    const documentXml = new DOMParser().parseFromString(
      await response.text(),
      'text/xml',
    );
    const animations = Array.from(documentXml.getElementsByTagName('Anim'));
    const [walk, idle, attack, hurt, charge] = await Promise.all([
      fetchAnimation(baseUrl, animations, ['Walk', 'Idle']),
      fetchAnimation(baseUrl, animations, ['Idle', 'Walk']),
      fetchAnimation(baseUrl, animations, [
        'Attack',
        'Shoot',
        'Strike',
        'Swing',
        'SpAttack',
        'Walk',
      ]),
      fetchAnimation(baseUrl, animations, ['Hurt', 'Faint', 'Idle']),
      fetchAnimation(baseUrl, animations, ['Charge']),
    ]);
    if (!walk) return null;
    const data = {
      dex,
      dexStr,
      anims: {
        Walk: walk,
        Spin: walk, Charge: charge || idle || walk,
        Idle: idle || walk,
        Attack: attack || walk,
        Hurt: hurt || idle || walk,
      },
    };
    console.debug('[Sprites] Animaciones preparadas', dex, Object.keys(data.anims));
    const strike = data.anims.Attack, rest = data.anims.Idle;
    const centers = frameCenters(strike), idleCenters = frameCenters(rest);
    strike.offsets = centers.map((frames,dir) => {
      const origin = idleCenters[Math.min(dir,idleCenters.length-1)][0];
      return frames.map(point => ({x:origin.x-point.x,y:origin.y-point.y}));
    });
    game.spriteCache.set(dex, data);
    return data;
  } catch {
    return null;
  }
}
