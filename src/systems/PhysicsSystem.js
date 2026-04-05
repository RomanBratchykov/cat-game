// ─────────────────────────────────────────────────────────────────
// PhysicsSystem.js
//
// Оновлює позицію ВСІХ entities що мають PhysicsComponent.
// Не знає що таке "кіт" або "м'яч" — просто рухає всіх однаково.
//
// Це і є суть ECS: додаєш нового ворога з PhysicsComponent —
// він автоматично починає падати, відскакувати від підлоги,
// і стикатись зі стінами. Нічого не треба змінювати тут.
// ─────────────────────────────────────────────────────────────────

import { System }              from '../game/core/System.js';
import { TransformComponent }  from '../entities/index.js';
import { PhysicsComponent }    from '../entities/index.js';
import { DragComponent }       from '../entities/index.js';
import { CONFIG }              from '../config.js';

export class PhysicsSystem extends System {
  update() {
    // query() повертає всіх у кого є і Transform і Physics
    const entities = this.world.query(TransformComponent, PhysicsComponent);

    for (const entity of entities) {
      // Якщо entity зараз перетягується — фізика не застосовується
      // DragSystem сам оновлює позицію
      if (entity.has(DragComponent)) continue;

      const tf   = entity.get(TransformComponent);
      const phys = entity.get(PhysicsComponent);

      // Гравітація
      phys.vy += phys.gravity;

      // Рух
      tf.x += phys.vx;
      tf.y += phys.vy;

      // Тертя (тільки на підлозі)
      if (phys.onGround) {
        phys.vx *= phys.friction;
        // Зупиняємо мікро-рух
        if (Math.abs(phys.vx) < 0.1) phys.vx = 0;
      }

      // Підлога
      if (tf.y >= CONFIG.FLOOR_Y) {
        tf.y          = CONFIG.FLOOR_Y;
        phys.vy       = -Math.abs(phys.vy) * phys.bounce;
        phys.onGround = true;
        if (Math.abs(phys.vy) < 1) phys.vy = 0;
      } else {
        phys.onGround = false;
      }

      // Стіни
      if (tf.x < 0) {
        tf.x    = 0;
        phys.vx = Math.abs(phys.vx) * phys.bounce;
      }
      if (tf.x > CONFIG.WIDTH) {
        tf.x    = CONFIG.WIDTH;
        phys.vx = -Math.abs(phys.vx) * phys.bounce;
      }
    }
  }
}
