import { assetUrl } from './asset-url.js';
// Recursos compartidos entre las fichas de salvajes y las opciones de Ditto.
export function portrait(species) {
  const iconImage = new Image();
  const path = 'portrait/' + String(species.dex).padStart(4, '0') + '/Normal.png';
  iconImage.alt = '';
  iconImage.className = 'portrait';
  // Si falla el origen principal, intenta una sola vez el recurso de respaldo.
  iconImage.onerror = () => {
    // Si falla el origen principal, intenta una sola vez el recurso de respaldo.
  iconImage.onerror = null;
    iconImage.src = 'https://cdn.jsdelivr.net/gh/PMDCollab/SpriteCollab@master/' + path;
  };
  iconImage.src = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/' + path;
  return iconImage;
}

// Crea el icono accesible de un tipo de esencia.
export function gem(type) {
  const iconImage = new Image();
  iconImage.src = assetUrl('../../assets/ui/essence-' + type + '.png', import.meta.url).href;
  iconImage.alt = iconImage.title = type;
  iconImage.className = 'essence';
  return iconImage;
}

// Crea un nodo de interfaz y asigna su texto cuando se proporciona.
export function element(tag, text) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}

export const tones = { normal:'#494641', fire:'#622821', water:'#203d61', electric:'#554519',
  grass:'#244b30', ice:'#285059', fighting:'#532e28', poison:'#482951', ground:'#53412b',
  flying:'#35455e', psychic:'#582e4d', bug:'#414b23', rock:'#4b4232', ghost:'#392e50',
  dragon:'#302e62', dark:'#343037', steel:'#36454b' };
