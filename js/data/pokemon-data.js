import { EXCLUDED_DEX } from '../core/constants.js';
import { game } from '../core/state.js';

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
      fetchAnimation(baseUrl, animations, [
        'Charge',
        'DeepBreath',
        'Withdraw',
        'Idle',
      ]),
    ]);
    if (!walk) return null;
    const data = {
      dex,
      dexStr,
      anims: {
        Walk: walk,
        Idle: idle || walk,
        Attack: attack || walk,
        Hurt: hurt || idle || walk,
        Charge: charge || idle || walk,
      },
    };
    game.spriteCache.set(dex, data);
    return data;
  } catch {
    return null;
  }
}
