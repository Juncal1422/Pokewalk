import { assetUrl } from './asset-url.js';
// Recursos compartidos entre las fichas de salvajes y las opciones de Ditto.
export function portrait(species) {
  const iconImage = new Image();
  const path = 'portrait/' + (species.spritePath ?? String(species.dex).padStart(4, '0')) + '/Normal.png';
  iconImage.alt = '';
  iconImage.className = 'pokemon-portrait';
  // Si falla el origen principal, intenta una sola vez el recurso de respaldo.
  iconImage.onerror = () => {
    // Desarma el manejador antes de cambiar la URL para evitar reintentos en bucle.
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
  iconImage.className = 'essence-icon';
  return iconImage;
}

// Crea un nodo de interfaz y asigna su texto cuando se proporciona.
export function element(tag, text) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}
