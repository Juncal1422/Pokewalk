// La lista proviene de las bajas de esta planta, incluidas las causadas por la IA.
export function chooseReward(options, catalog) {
  console.info('[Mejoras] Formas ofrecidas', options.map(option => option.row.name));
  const dialog = document.getElementById('rewards');
  const cards = dialog.querySelector('.cards');
  cards.replaceChildren();
  return new Promise(resolve => {
    for (const option of options) {
      const { row, essence, bonus } = option;
      const dex = row.dex;
      const reward = catalog.find(item => item.id === row.mejora);
      const card = document.createElement('button');
      const portrait = new Image();
      const number = String(dex).padStart(4, '0');
      portrait.src = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/portrait/' + number + '/Normal.png';
      portrait.alt = 'Retrato del Pokémon ' + dex;
      portrait.onerror = () => {
        portrait.onerror = null;
        portrait.src = 'https://cdn.jsdelivr.net/gh/PMDCollab/SpriteCollab@master/portrait/' + number + '/Normal.png';
      };
      card.type = 'button';
      const gem = new Image();
      gem.src = new URL('../../assets/ui/essence-' + essence + '.png', import.meta.url).href;
      gem.alt = essence;
      gem.className = 'essence';
      card.append(portrait, row.name, gem, reward.label);
      if (bonus) card.append('Bono de línea: ' + catalog.find(item => item.id === bonus).label);
      card.onclick = () => {
        if (!dialog.open) return;
        dialog.close();
        resolve(option);
      };
      cards.append(card);
    }
    if (!options.length) {
      const button = document.createElement('button');
      button.textContent = 'Continuar con la forma actual';
      button.onclick = () => { dialog.close(); resolve(null); };
      cards.append(button);
    }
    dialog.oncancel = event => event.preventDefault();
    dialog.showModal();
  });
}
