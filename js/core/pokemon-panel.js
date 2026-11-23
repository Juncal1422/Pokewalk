// Recursos compartidos entre las fichas de salvajes y las opciones de Ditto.
export function portrait(row) {
  const img = new Image();
  const path = 'portrait/' + String(row.dex).padStart(4, '0') + '/Normal.png';
  img.alt = '';
  img.className = 'portrait';
  img.onerror = () => {
    img.onerror = null;
    img.src = 'https://cdn.jsdelivr.net/gh/PMDCollab/SpriteCollab@master/' + path;
  };
  img.src = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/' + path;
  return img;
}

export function gem(type) {
  const img = new Image();
  img.src = new URL('../../assets/ui/essence-' + type + '.png', import.meta.url).href;
  img.alt = img.title = type;
  img.className = 'essence';
  return img;
}

export function element(tag, text) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}
