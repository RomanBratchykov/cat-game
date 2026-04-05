// ─────────────────────────────────────────────────────────────────
// World.js
//
// World — центральний реєстр. Зберігає всі entities і системи.
// Це єдиний клас якому дозволено знати про всіх.
//
// Головний метод — query(...Components):
//   Повертає всі entities що мають ВСІ вказані компоненти.
//   PhysicsSystem викликає world.query(PhysicsComponent, TransformComponent)
//   і отримує список всіх об'єктів що треба рухати.
//   Додаєш новий об'єкт з цими компонентами — він автоматично
//   підхоплюється системою. Нічого не треба змінювати в системі.
//
// Порядок систем в tick() важливий:
//   1. InputSystem  — читає ввід
//   2. PhysicsSystem — рухає об'єкти
//   3. CollisionSystem — вирішує зіткнення (після руху)
//   4. AnimationSystem — оновлює анімації (після вирішення стану)
//   5. RenderSystem — малює (останній)
// ─────────────────────────────────────────────────────────────────

export class World {
  constructor() {
    this.entities = new Map(); // id → Entity
    this.systems  = [];
    this._toAdd    = []; // додаємо між кадрами щоб не ламати ітерацію
    this._toRemove = [];
  }

  // ── Entities ──────────────────────────────────────────────────

  addEntity(entity) {
    this.entities.set(entity.id, entity);
    console.log(`[World] Added entity: ${entity}`);
    return entity;
  }

  // Видалення відкладається до кінця кадру щоб не ламати query()
  removeEntity(entity) {
    this._toRemove.push(entity.id);
  }

  // Повертає всі активні entities що мають ВСІ вказані компоненти.
  // Це серце ECS — системи не знають хто конкретно є в грі,
  // вони просто запитують "дай мені всіх хто може рухатись"
  query(...ComponentClasses) {
    return [...this.entities.values()].filter(entity =>
      entity.active &&
      ComponentClasses.every(C => entity.has(C))
    );
  }

  // Знайти перший entity за ім'ям (для дебагу або специфічних задач)
  findByName(name) {
    return [...this.entities.values()].find(e => e.name === name);
  }

  // ── Systems ───────────────────────────────────────────────────

  addSystem(system) {
    system.world = this;
    system.init();
    this.systems.push(system);
    console.log(`[World] Added system: ${system.constructor.name}`);
    return this; // ланцюжок: world.addSystem(a).addSystem(b)
  }

  // ── Tick ──────────────────────────────────────────────────────

  tick(delta) {
    // Обробляємо відкладені видалення перед кадром
    this._toRemove.forEach(id => {
      this.entities.delete(id);
    });
    this._toRemove = [];

    // Оновлюємо всі системи в порядку додавання
    this.systems.forEach(system => system.update(delta));
  }

  // ── Cleanup ───────────────────────────────────────────────────

  destroy() {
    this.systems.forEach(s => s.destroy());
    this.entities.clear();
    this.systems  = [];
    console.log('[World] Destroyed');
  }
}
