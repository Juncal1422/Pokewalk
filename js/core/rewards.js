// La lista proviene de las bajas de esta planta, incluidas las causadas por la IA.
export function chooseReward(defeated, catalog, pokemon) {
  const dialog = document.getElementById('rewards');
  const cards = dialog.querySelector('.cards');
  cards.replaceChildren();
  return new Promise(resolve => {
    for (const dex of defeated) {
      const reward = catalog.find(item => item.id === pokemon.get(dex).mejora);
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
      card.append(portrait, document.createTextNode(reward.label));
      card.onclick = () => {
        if (!dialog.open) return;
        dialog.close();
        resolve(reward);
      };
      cards.append(card);
    }
    dialog.oncancel = event => event.preventDefault();
    dialog.showModal();
  });
}
