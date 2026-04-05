// ─────────────────────────────────────────────────────────────────
// SitSystem.js
//
// Обробляє запити сісти/встати з InputComponent.
// Окрема система бо логіка сидіння специфічна і може розширюватись:
// наприклад в майбутньому — анімація переходу, звук.
// ─────────────────────────────────────────────────────────────────

import { System }           from '../game/core/System.js';
import { CatComponent }     from '../entities/index.js';
import { InputComponent }   from '../entities/index.js';
import { PhysicsComponent } from '../entities/index.js';
import { PetComponent }     from '../entities/index.js';

export class SitSystem extends System {
  constructor(audioSystem) {
    super();
    this._audio = audioSystem;
  }

  update() {
    const cats = this.world.query(CatComponent, InputComponent, PhysicsComponent);

    for (const entity of cats) {
      const input = entity.get(InputComponent);
      const phys  = entity.get(PhysicsComponent);

      // sitPending встановлює InputSystem (Ctrl) або mobile button
      // Виконуємо тільки якщо на землі — не можна сісти в повітрі
      if (!input.sitPending || !phys.onGround) {
        input.sitPending = false;
        continue;
      }

      input.sitPending = false;
      input.isSitting  = !input.isSitting;

      if (input.isSitting) {
        console.log('[SIT] Cat sat down — movement locked');
      } else {
        // Встали — скидаємо petting стан
        if (entity.has(PetComponent)) {
          const pet = entity.get(PetComponent);
          pet.moveCount  = 0;
          pet.heartTimer = 0;
        }
        this._audio?.stopPurr();
        console.log('[SIT] Cat stood up — movement unlocked');
      }
    }
  }
}
