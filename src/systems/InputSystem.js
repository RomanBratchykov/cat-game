// ─────────────────────────────────────────────────────────────────
// InputSystem.js
//
// Відповідає ТІЛЬКИ за читання вводу і запис в InputComponent.
// Не знає про фізику, анімацію або рендер.
//
// Чому система а не глобальний об'єкт:
//   Система має доступ до world.query() і може знайти кота.
//   Глобальний об'єкт не знає що таке "кіт" — він просто Set клавіш.
//   Але keys Set залишається в системі бо це внутрішній стан вводу.
// ─────────────────────────────────────────────────────────────────

import { System }         from '../game/core/System.js';
import { InputComponent } from '../entities/index.js';
import { CatComponent }   from '../entities/index.js';
import { CONFIG }         from '../config.js';

export class InputSystem extends System {
  constructor() {
    super();
    this.keys          = new Set();
    this._ctrlConsumed = false;

    // Прив'язуємо методи щоб removeEventListener працював
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp   = this._onKeyUp.bind(this);
  }

  init() {
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup',   this._onKeyUp);

    // Мобільні кнопки викликають ці функції напряму
    // Вони записують в той самий keys Set — система не бачить різниці
    window.__catVirtualKeys = {
      pressKey:   (code) => this.keys.add(code),
      releaseKey: (code) => this.keys.delete(code),
    };

    // Кнопка sit — встановлює sitPending в InputComponent
    window.__catSitToggle = () => {
      const cats = this.world.query(CatComponent, InputComponent);
      cats.forEach(cat => {
        cat.get(InputComponent).sitPending = true;
      });
      console.log('[INPUT] Mobile sit toggle');
    };

    console.log('[InputSystem] Initialized — listening for keyboard and touch');
  }

  update() {
    // Знаходимо всі entities що реагують на ввід (тільки кіт зараз)
    const entities = this.world.query(InputComponent);

    for (const entity of entities) {
      const input = entity.get(InputComponent);

      // Ctrl → запит сісти
      // Якщо _ctrlConsumed = true, значить Ctrl вже оброблений цього натискання
      // Без цього прапора: затримуєш Ctrl → sitPending=true кожен кадр
      if (
        (this.keys.has('ControlLeft') || this.keys.has('ControlRight')) &&
        !this._ctrlConsumed
      ) {
        this._ctrlConsumed   = true;
        input.sitPending     = true;
        console.log('[INPUT] Ctrl → sitPending');
      }
    }
  }

  // Чи натиснута клавіша — викликається з інших систем
  isDown(code) {
    return this.keys.has(code);
  }

  isLeft()  { return this.keys.has('KeyA')  || this.keys.has('ArrowLeft');  }
  isRight() { return this.keys.has('KeyD')  || this.keys.has('ArrowRight'); }
  isJump()  { return this.keys.has('KeyW')  || this.keys.has('Space') || this.keys.has('ArrowUp'); }

  _onKeyDown(e) {
    this.keys.add(e.code);
    if (e.ctrlKey) e.preventDefault();
  }

  _onKeyUp(e) {
    this.keys.delete(e.code);
    if (e.code === 'ControlLeft' || e.code === 'ControlRight') {
      this._ctrlConsumed = false;
    }
  }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup',   this._onKeyUp);
    delete window.__catVirtualKeys;
    delete window.__catSitToggle;
  }
}
