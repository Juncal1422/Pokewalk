/* Clases de dominio compartidas por Pokémon, movimientos, objetos y eventos. */
(function (global) {
  'use strict';
  const game = global.SlayPokemon = global.SlayPokemon || {};

  class Entity {
    constructor(data) {
      this.id = data.id;
      this.name = data.name;
      this.locked = Boolean(data.locked);
      this.unlockCondition = data.unlockCondition || { type: 'always' };
    }
  }

  class Pokemon extends Entity {
    constructor(data) {
      super(data);
      this.hp = data.hp;
      this.moves = (data.moves || []).slice();
      this.moveIds = (data.moveIds || []).slice();
      this.starter = Boolean(data.starter);
      this.speciesId = data.speciesId || data.id;
      this.maxHp = data.maxHp || data.hp;
    }

    createOwned(id) {
      return new this.constructor({
        id,
        speciesId: this.speciesId,
        name: this.name,
        hp: this.maxHp,
        maxHp: this.maxHp,
        moveIds: this.moves,
        starter: this.starter,
        locked: false,
        unlockCondition: this.unlockCondition
      });
    }
  }

  class StarterPokemon extends Pokemon {}
  class WildPokemon extends Pokemon {}

  class Move extends Entity {
    constructor(data) {
      super(data);
      this.type = data.type;
      this.power = data.power;
      this.uses = data.uses;
    }
  }

  class BasicMove extends Move {}
  class ElementalMove extends Move {}

  class Item extends Entity {
    constructor(data) {
      super(data);
      this.effect = data.effect;
      this.amount = data.amount;
    }
  }

  class BerryItem extends Item {}
  class PotionItem extends Item {}

  class GameEvent extends Entity {
    constructor(data) {
      super(data);
      this.description = data.description;
    }
  }

  class BattleEvent extends GameEvent {}
  class RestEvent extends GameEvent {}

  game.entities = {
    Entity,
    Pokemon,
    StarterPokemon,
    WildPokemon,
    Move,
    BasicMove,
    ElementalMove,
    Item,
    BerryItem,
    PotionItem,
    GameEvent,
    BattleEvent,
    RestEvent
  };
})(window);
