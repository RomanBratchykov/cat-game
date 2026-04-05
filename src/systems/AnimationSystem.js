// ─────────────────────────────────────────────────────────────────
// AnimationSystem.js
//
// Вибирає анімацію для Spine entities на основі їх стану.
// Читає PhysicsComponent і InputComponent → пише в SpineComponent.
//
// Чому окрема система:
//   Анімація залежить від стану (сидить? рухається? в повітрі?)
//   але ні PhysicsSystem ні InputSystem не мають право знати про Spine.
//   AnimationSystem — "перекладач" між фізичним станом і анімацією.
// ─────────────────────────────────────────────────────────────────

import { System }           from '../game/core/System.js';
import { SpineComponent }   from '../entities/index.js';
import { PhysicsComponent } from '../entities/index.js';
import { InputComponent }   from '../entities/index.js';
import { DragComponent }    from '../entities/index.js';
import { CONFIG }           from '../config.js';

export class AnimationSystem extends System {
  update() {
    const entities = this.world.query(SpineComponent, PhysicsComponent);

    for (const entity of entities) {
      const spine = entity.get(SpineComponent);
      const phys  = entity.get(PhysicsComponent);

      // Якщо немає InputComponent — кіт не управляється гравцем
      // (на майбутнє: NPC кіт теж матиме SpineComponent але без InputComponent)
      if (!entity.has(InputComponent)) continue;

      const input = entity.get(InputComponent);

      let targetAnim;

      if (entity.has(DragComponent)) {
        targetAnim = CONFIG.ANIM.STAND;
      } else if (input.isSitting) {
        targetAnim = CONFIG.ANIM.SIT;
      } else if (!phys.onGround) {
        targetAnim = CONFIG.ANIM.JUMP;
      } else if (Math.abs(phys.vx) > 0.1) {
        targetAnim = CONFIG.ANIM.WALK;
      } else {
        targetAnim = CONFIG.ANIM.STAND;
      }

      this._setAnim(spine, targetAnim);
    }
  }

  _setAnim(spine, name, loop = true) {
    if (!spine.instance) return;
    if (spine.currentAnim === name) return; // guard — не перезапускаємо той самий
    console.log(`[ANIM] ${spine.currentAnim} → ${name}`);
    spine.instance.state.setAnimation(0, name, loop);
    spine.currentAnim = name;
  }
}
