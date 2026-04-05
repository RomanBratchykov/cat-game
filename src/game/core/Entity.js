// ─────────────────────────────────────────────────────────────────
// Entity.js
//
// Entity — це просто контейнер з унікальним ID та набором компонентів.
// Сам по собі він нічого не робить — це як "особова справа" об'єкта.
// Вся логіка і дані живуть в компонентах, а поведінка — в системах.
//
// Чому ID замість посилань:
//   Системи шукають entities по типу компонентів, а не по імені.
//   Числовий ID дозволяє ефективно зберігати і видаляти entities.
// ─────────────────────────────────────────────────────────────────

let _nextId = 0;

export class Entity {
  constructor(name = 'unnamed') {
    this.id         = _nextId++;
    this.name       = name;            // для дебагу — не впливає на логіку
    this.components = new Map();       // ComponentClassName → instance
    this.active     = true;            // false = система пропускає цей entity
  }

  // Додати компонент. Повертає this для ланцюжка:
  // new Entity().add(new PhysicsComponent()).add(new RenderComponent())
  add(component) {
    const key = component.constructor.name;
    if (this.components.has(key)) {
      console.warn(`[Entity:${this.name}] Overwriting component ${key}`);
    }
    this.components.set(key, component);
    return this;
  }

  // Отримати компонент за класом. Повертає undefined якщо немає.
  get(ComponentClass) {
    return this.components.get(ComponentClass.name);
  }

  // Перевірити чи є компонент
  has(ComponentClass) {
    return this.components.has(ComponentClass.name);
  }

  // Видалити компонент (наприклад прибрати DragComponent після відпускання)
  remove(ComponentClass) {
    this.components.delete(ComponentClass.name);
    return this;
  }

  toString() {
    return `Entity(${this.id}:${this.name})`;
  }
}
