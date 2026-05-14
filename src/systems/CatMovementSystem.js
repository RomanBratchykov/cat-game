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

      const rawMoveMultiplier = Number.isFinite(input.moveSpeedMultiplier)
        ? input.moveSpeedMultiplier
        : 1;
      const rawJumpMultiplier = Number.isFinite(input.jumpMultiplier)
        ? input.jumpMultiplier
        : 1;
      const moveMultiplier = Math.max(0.35, Math.min(1, rawMoveMultiplier));
      const jumpMultiplier = Math.max(0.5, Math.min(1, rawJumpMultiplier));
      const moveSpeed = CONFIG.MOVE_SPEED * moveMultiplier;
      const airSteer = CONFIG.AIR_STEER * moveMultiplier;
      const jumpForward = CONFIG.JUMP_FORCE_FORWARD * jumpMultiplier;
      const jumpVertical = CONFIG.JUMP_FORCE_VERTICAL * jumpMultiplier;
      const jumpHorizontal = CONFIG.JUMP_HORIZONTAL * jumpMultiplier;

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
        if (left)  phys.vx = -moveSpeed;
        else if (right) phys.vx = moveSpeed;
        else phys.vx = 0;
      } else {
        // В повітрі — легке керування (air steer)
        if (left)  phys.vx = Math.max(phys.vx - airSteer, -moveSpeed);
        if (right) phys.vx = Math.min(phys.vx + airSteer,  moveSpeed);
      }

      // ── Стрибок ───────────────────────────────────────────────
      if (jumping && phys.onGround) {
        phys.onGround = false;
        const moving  = left || right;
        if (moving) {
          phys.vy = -jumpForward;
          phys.vx = input.facingRight ? jumpHorizontal : -jumpHorizontal;
          console.log('[CAT] Forward jump');
        } else {
          phys.vy = -jumpVertical;
          phys.vx = 0;
          console.log('[CAT] Vertical jump');
        }
      }
    }
  }
}
