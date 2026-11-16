/* Catálogos de ejemplo. Los valores no pretenden reproducir las estadísticas oficiales. */
(function (global) {
  'use strict';
  const game = global.SlayPokemon = global.SlayPokemon || {};

  const moves = {
    placaje:       { name: 'Placaje',       type: 'Normal', power: 9,  uses: 4 },
    latigo_cepa:   { name: 'Látigo Cepa',   type: 'Planta', power: 13, uses: 3 },
    ascuas:        { name: 'Ascuas',        type: 'Fuego',  power: 13, uses: 3 },
    aranazo:       { name: 'Arañazo',       type: 'Normal', power: 9,  uses: 4 },
    pistola_agua:  { name: 'Pistola Agua',  type: 'Agua',   power: 13, uses: 3 },
    burbuja:       { name: 'Burbuja',       type: 'Agua',   power: 10, uses: 4 },
    picotazo:      { name: 'Picotazo',      type: 'Volador',power: 11, uses: 4 },
    ataque_rapido: { name: 'Ataque Rápido', type: 'Normal', power: 11, uses: 4 },
    impactrueno:   { name: 'Impactrueno',   type: 'Eléctrico', power: 14, uses: 3 },
    chispazo:      { name: 'Chispazo',      type: 'Eléctrico', power: 12, uses: 3 },
    lanzarrocas:   { name: 'Lanzarrocas',   type: 'Roca',  power: 14, uses: 3 },
    endurecer:     { name: 'Endurecer',     type: 'Normal', power: 7,  uses: 5 },
    absorcion:     { name: 'Absorción',     type: 'Planta', power: 12, uses: 3 },
    polvo_veneno:  { name: 'Polvo Veneno',  type: 'Veneno', power: 10, uses: 4 }
  };

  const species = {
    bulbasaur: { name: 'Bulbasaur', hp: 54, moves: ['placaje', 'latigo_cepa'], starter: true },
    charmander:{ name: 'Charmander',hp: 50, moves: ['aranazo', 'ascuas'], starter: true },
    squirtle:  { name: 'Squirtle',  hp: 56, moves: ['placaje', 'pistola_agua'], starter: true },
    pidgey:   { name: 'Pidgey',    hp: 42, moves: ['picotazo', 'ataque_rapido'], starter: false },
    pikachu:  { name: 'Pikachu',   hp: 44, moves: ['impactrueno', 'ataque_rapido', 'chispazo'], starter: false },
    geodude:  { name: 'Geodude',   hp: 58, moves: ['placaje', 'lanzarrocas', 'endurecer'], starter: false },
    oddish:   { name: 'Oddish',    hp: 48, moves: ['absorcion', 'polvo_veneno'], starter: false }
  };

  game.data = Object.freeze({ moves, species, starters: ['bulbasaur', 'charmander', 'squirtle'], captures: ['pidgey', 'pikachu', 'geodude', 'oddish'] });
})(window);
