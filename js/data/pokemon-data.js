import { EXCLUDED_DEX } from '../core/constants.js';
import { game } from '../core/state.js';

// Algunas hojas ya trasladan el dibujo dentro de la celda. Restamos esa
// traslación al dibujar para que solo la trayectoria de combate mueva el sprite.
function frameCenters(animation) {
  const { img: spriteImage, fw: frameWidth, fh: frameHeight, frames } = animation;
  const canvas = document.createElement('canvas');
  canvas.width = spriteImage.width;
  canvas.height = spriteImage.height;
  const drawingContext = canvas.getContext('2d');
  drawingContext.drawImage(spriteImage,0,0);
  const rgbaPixels = drawingContext.getImageData(0,0,spriteImage.width,spriteImage.height).data;
  return Array.from({length:Math.floor(spriteImage.height/frameHeight)}, (_,directionRow) =>
    Array.from({length:frames}, (_,frameColumn) => {
      let opaquePixelCount=0, sumPixelX=0, sumPixelY=0;
      // El desplazamiento combina la fila de dirección y la columna del fotograma antes de leer el alfa.
      for (let y=0;y<frameHeight;y++) for (let x=0;x<frameWidth;x++) {
        if (rgbaPixels[4*((directionRow*frameHeight+y)*spriteImage.width+frameColumn*frameWidth+x)+3] < 128) continue;
        sumPixelX+=x+.5; sumPixelY+=y+.5; opaquePixelCount++;
      }
      return opaquePixelCount ? {x:sumPixelX/opaquePixelCount-frameWidth/2,y:sumPixelY/opaquePixelCount-frameHeight/2} : {x:0,y:0};
    }));
}

// Prueba las acciones disponibles en orden y resuelve CopyOf antes de descargar la hoja y sus duraciones.
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

// Carga y almacena en caché las acciones de una especie, con alternativas cuando falta una animación.
export async function loadPokemonData(pokedexNumber) {
  if (EXCLUDED_DEX.has(pokedexNumber)) return null;
  if (game.spriteCache.has(pokedexNumber)) return game.spriteCache.get(pokedexNumber);
  const paddedDexNumber = String(pokedexNumber).padStart(4, '0');
  const baseUrl = `https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/sprite/${paddedDexNumber}`;
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
    // Las prioridades proceden del catálogo. Sólo pedimos hojas presentes en el XML;
    // Charge ya está cargada y sirve de última opción para cualquier arma.
    const candidates = new Set([...game.benefits.values()].flatMap(benefit => benefit.spriteanimations ?? []));
    candidates.delete('Charge');
    const alternateAnimations = await Promise.all([...candidates].map(async name =>
      [name, await fetchAnimation(baseUrl, animations, [name])]));
    const spriteData = {
      dex: pokedexNumber,
      dexStr: paddedDexNumber,
      anims: {
        ...Object.fromEntries(alternateAnimations.filter(([,animation]) => animation)),
        Walk: walk,
        Spin: walk, Charge: charge || idle || walk,
        Idle: idle || walk,
        Attack: attack || walk,
        Hurt: hurt || idle || walk,
      },
    };
    console.debug('[Sprites] Animaciones preparadas', pokedexNumber, Object.keys(spriteData.anims));
    const attackAnimation = spriteData.anims.Attack, idleAnimation = spriteData.anims.Idle;
    const centers = frameCenters(attackAnimation), idleCenters = frameCenters(idleAnimation);
    attackAnimation.offsets = centers.map((frames,directionIndex) => {
      const origin = idleCenters[Math.min(directionIndex,idleCenters.length-1)][0];
      return frames.map(point => ({x:origin.x-point.x,y:origin.y-point.y}));
    });
    game.spriteCache.set(pokedexNumber, spriteData);
    return spriteData;
  } catch {
    return null;
  }
}
