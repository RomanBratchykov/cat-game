// ─────────────────────────────────────────────────────────────────
// CatMovementSystem.js
//
// Застосовує ввід гравця до кота. Відокремлено від PhysicsSystem
// бо кіт рухається інакше: у нього є jump логіка, обмеження
// на рух в повітрі, і сидіння блокує все.
//
// Чому не в PhysicsSystem:
//   PhysicsSystem — загальна. Вона не знає про "стрибок" чи "сидіння".
//   CatMovementSystem — специфічна для кота. Вона читає InputComponent
//   і модифікує PhysicsComponent, але саму фізику (гравітацію, колізії)
//   все одно обробляє PhysicsSystem.
// ─────────────────────────────────────────────────────────────────

import { System }             from '../game/core/System.js';
import { CatComponent }       from '../entities/index.js';
import { TransformComponent } from '../entities/index.js';
import { PhysicsComponent }   from '../entities/index.js';
import { InputComponent }     from '../entities/index.js';
import { DragComponent }      from '../entities/index.js';
import { CONFIG }             from '../config.js';

export class CatMovementSystem extends System {
  constructor(inputSystem) {
    super();
    // Зберігаємо посилання на InputSystem щоб читати клавіші
    // Альтернатива: зберігати стан в InputComponent — теж валідно
    this._input = inputSystem;
  }

  update() {
    const cats = this.world.query(CatComponent, InputComponent, PhysicsComponent, TransformComponent);

    for (const entity of cats) {
      // Якщо кота перетягують — рухом керує DragSystem
      if (entity.has(DragComponent)) continue;

      const input = entity.get(InputComponent);
      const phys  = entity.get(PhysicsComponent);
      const tf    = entity.get(TransformComponent);

      // Сидіння блокує весь рух
      if (input.isSitting) continue;

      const left    = this._input.isLeft();
      const right   = this._input.isRight();
      const jumping = this._input.isJump();

      // ── Напрямок ──────────────────────────────────────────────
      // Міняємо тільки на землі — в повітрі не перевертаємось
      if (phys.onGround) {
        if (right && !input.facingRight) {
          input.facingRight = true;
          tf.scaleX         = Math.abs(tf.scaleX);
          console.log('[CAT] Facing right');
        } else if (left && !input.facingRight === false) {
          if (left && input.facingRight) {
            input.facingRight = false;
            tf.scaleX         = -Math.abs(tf.scaleX);
            console.log('[CAT] Facing left');
          }
        }
      }

      // ── Горизонтальний рух ────────────────────────────────────
      if (phys.onGround) {
        if (left)  phys.vx = -CONFIG.MOVE_SPEED;
        else if (right) phys.vx = CONFIG.MOVE_SPEED;
        else phys.vx = 0;
      } else {
        // В повітрі — легке керування (air steer)
        if (left)  phys.vx = Math.max(phys.vx - CONFIG.AIR_STEER, -CONFIG.MOVE_SPEED);
        if (right) phys.vx = Math.min(phys.vx + CONFIG.AIR_STEER,  CONFIG.MOVE_SPEED);
      }

      // ── Стрибок ───────────────────────────────────────────────
      if (jumping && phys.onGround) {
        phys.onGround = false;
        const moving  = left || right;
        if (moving) {
          phys.vy = -CONFIG.JUMP_FORCE_FORWARD;
          phys.vx = input.facingRight ? CONFIG.JUMP_HORIZONTAL : -CONFIG.JUMP_HORIZONTAL;
          console.log('[CAT] Forward jump');
        } else {
          phys.vy = -CONFIG.JUMP_FORCE_VERTICAL;
          phys.vx = 0;
          console.log('[CAT] Vertical jump');
        }
      }
    }
  }
}
