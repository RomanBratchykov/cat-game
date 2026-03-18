import React, { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';
import { Spine } from 'pixi-spine';
 
const meows = [
  new Audio('/assets/meow1.mp3'),
  new Audio('/assets/meow2.mp3'),
];

const playMeow = () => {
  const sound = meows[Math.floor(Math.random() * meows.length)];
  sound.currentTime = 0; // rewind if already playing
  sound.volume = 0.7;
  sound.play().catch(() => {}); 
};

const CONFIG = {
  WIDTH: 800,
  HEIGHT: 600,
  BG_COLOR: 0x1a1a2e,
  MOVE_SPEED: 3,
 
  JUMP_FORCE_VERTICAL: 14,
  JUMP_FORCE_FORWARD:  10,
  JUMP_HORIZONTAL:      4,
 
  GRAVITY:  0.5,
  FLOOR_Y:  540,
 
    ANIM_IDLE: 'stand',
  ANIM_WALK: 'walk',
  ANIM_JUMP: 'jump_vertical',
 
  PHYSICS_BONES:     [], // вимкнено — конфліктує з root bone reset
  PHYSICS_STIFFNESS: 0.06,
  PHYSICS_DAMPING:   0.85,
};
 
const Game = () => {
  const canvasRef = useRef(null);
  const appRef = useRef(null);
  const isInitialized = useRef(false);
 
  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;
 
    const keys = new Set();
    const onKeyDown = (e) => keys.add(e.code);
    const onKeyUp   = (e) => keys.delete(e.code);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup',   onKeyUp);
 
    const app = new PIXI.Application({
      width:           CONFIG.WIDTH,
      height:          CONFIG.HEIGHT,
      backgroundColor: CONFIG.BG_COLOR,
      view:            canvasRef.current,
      antialias:       true,
    });
    appRef.current = app;
    const bgMusic = new Audio('/assets/bg.mp3');
    bgMusic.loop   = true;
    bgMusic.volume = 0.1;
   const startMusic = () => {
  bgMusic.play().catch(() => {});
  window.removeEventListener('keydown', startMusic);
  window.removeEventListener('pointerdown', startMusic);
};

window.addEventListener('keydown',    startMusic);
window.addEventListener('pointerdown', startMusic);
 
    const bg = new PIXI.Graphics();
    bg.beginFill(CONFIG.BG_COLOR);
    bg.drawRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
    bg.endFill();
    app.stage.addChild(bg);
 
    const floor = new PIXI.Graphics();
    floor.beginFill(0x16213e);
    floor.drawRect(0, CONFIG.FLOOR_Y, CONFIG.WIDTH, CONFIG.HEIGHT - CONFIG.FLOOR_Y);
    floor.endFill();
    app.stage.addChild(floor);
 
    app.loader
      .add('skeleton', '/assets/skeleton.json')
      .load((loader, resources) => {
        const character = new Spine(resources.skeleton.spineData);
        character.x = CONFIG.WIDTH / 2;
        character.y = CONFIG.FLOOR_Y;
        character.scale.set(0.5);
        character.state.setAnimation(0, CONFIG.ANIM_IDLE, true);
 
        // ✅ Обгортаємо кота в контейнер — фізика на контейнері, не на кістках
        const container = new PIXI.Container();
        container.addChild(character);
        app.stage.addChild(container);
 
        // Компенсуємо offset root кістки
        character.skeleton.setToSetupPose();
        character.skeleton.updateWorldTransform();
        const bounds    = character.getLocalBounds();
        const floorOffset = bounds.y + bounds.height;
 
        container.x = CONFIG.WIDTH / 2;
        container.y = CONFIG.FLOOR_Y - floorOffset * Math.abs(character.scale.y);
        character.x = 0;
        character.y = 0;
 
        // ── Стан персонажа ────────────────────────────────────
        let currentAnim = CONFIG.ANIM_IDLE;
        let velocityY   = 0;
        let velocityX   = 0;
        let isOnGround  = true;
        let facingRight = true;
        const groundY   = container.y;
 
        // Фізика нахилу контейнера
        const tilt = {
          angle:   0,
          vel:     0,
          stiff:   0.15,
          damping: 0.75,
        };
 
        const setAnim = (name, loop = true) => {
          if (currentAnim === name) return;
          character.state.setAnimation(0, name, loop);
          currentAnim = name;
        };
 
        // ── ✅ Fix 2: беремо базу з setupPose (до анімації) ───
        // Скидаємо скелет в setup pose і зчитуємо позиції кісток
        character.skeleton.setToSetupPose();
        character.skeleton.updateWorldTransform();
 
        const bonePhysics = {};
        CONFIG.PHYSICS_BONES.forEach(boneName => {
          const bone = character.skeleton.findBone(boneName);
          if (bone) {
            bonePhysics[boneName] = {
              bone,
              // ✅ baseX/baseY з setup pose — не змінюються анімацією
              baseX:   bone.x,
              baseY:   bone.y,
              offsetX: 0,
              offsetY: 0,
              velX:    0,
              velY:    0,
            };
          }
        });
 
        // Повертаємо анімацію після зчитування
        character.state.setAnimation(0, CONFIG.ANIM_IDLE, true);
        currentAnim = CONFIG.ANIM_IDLE;
 
        // ── ✅ Fix 1: явна hitArea для drag ───────────────────
        // PIXI.Rectangle(x, y, width, height) у локальних координатах
        character.interactive      = true;
        character.interactiveChildren = false;
        character.cursor           = 'grab';
        character.hitArea          = new PIXI.Rectangle(-150, -300, 300, 350);
 
        // ── Drag: кіт слідує за мишею ────────────────────────
        const drag = {
          active:  false,
          offsetX: 0,
          offsetY: 0,
          velX:    0,
          velY:    0,
          lastX:   0,
          lastY:   0,
        };
 
        // ✅ hitArea і events на character, але переміщуємо container
        character.interactive = true;
        character.cursor      = 'grab';
        character.hitArea     = new PIXI.Rectangle(-150, -300, 300, 350);
 
        character.on('pointerdown', (e) => {
            playMeow();
          drag.active  = true;
          drag.offsetX = container.x - e.data.global.x;
          drag.offsetY = container.y - e.data.global.y;
          drag.lastX   = e.data.global.x;
          drag.lastY   = e.data.global.y;
          drag.velX    = 0;
          drag.velY    = 0;
          isOnGround   = false;
          velocityY    = 0;
          character.cursor = 'grabbing';
 
          // Pivot у верхній центр — кіт висить знизу
          character.pivot.set(0, bounds.y);
        });
 
        app.stage.interactive = true;
        app.stage.on('pointermove', (e) => {
          if (!drag.active) return;
          drag.velX     = e.data.global.x - drag.lastX;
          drag.velY     = e.data.global.y - drag.lastY;
          drag.lastX    = e.data.global.x;
          drag.lastY    = e.data.global.y;
          container.x   = e.data.global.x + drag.offsetX;
          container.y   = e.data.global.y + drag.offsetY;
        });
 
        app.stage.on('pointerup', () => {
          if (!drag.active) return;
          drag.active      = false;
          character.cursor = 'grab';
          velocityX  = drag.velX * 0.5;
          velocityY  = drag.velY * 0.5;
          isOnGround = false;
 
          // Повертаємо pivot
          character.pivot.set(0, 0);
          tilt.angle = 0;
          tilt.vel   = 0;
          container.rotation = 0;
        });
 
        // ── Ticker 1: рух і анімація ──────────────────────────
        const rootBone = character.skeleton.getRootBone();
 
        app.ticker.add(() => {
          const movingLeft  = keys.has('KeyA') || keys.has('ArrowLeft');
          const movingRight = keys.has('KeyD') || keys.has('ArrowRight');
          const jumpPressed = keys.has('Space') || keys.has('KeyW') || keys.has('ArrowUp');
          const isMoving    = movingLeft || movingRight;
 
          // Під час drag — рух керується мишею, пропускаємо клавіші
          if (!drag.active) {
            // Скидаємо нахил на землі
            tilt.vel   += (0 - tilt.angle) * tilt.stiff;
            tilt.vel   *= tilt.damping;
            tilt.angle += tilt.vel;
            container.rotation = tilt.angle;
 
            if (isOnGround) {
              if (movingRight && !facingRight) {
                facingRight       = true;
                character.scale.x = Math.abs(character.scale.x);
              } else if (movingLeft && facingRight) {
                facingRight       = false;
                character.scale.x = -Math.abs(character.scale.x);
              }
            }
 
            if (isOnGround) {
              if (movingLeft)  container.x -= CONFIG.MOVE_SPEED;
              if (movingRight) container.x += CONFIG.MOVE_SPEED;
            } else {
              container.x += velocityX;
              velocityX   *= 0.98;
            }
 
            container.x = Math.max(0, Math.min(CONFIG.WIDTH, container.x));
 
            if (jumpPressed && isOnGround) {
              isOnGround = false;
              if (isMoving) {
                velocityY = -CONFIG.JUMP_FORCE_FORWARD;
                velocityX = facingRight ? CONFIG.JUMP_HORIZONTAL : -CONFIG.JUMP_HORIZONTAL;
              } else {
                velocityY = -CONFIG.JUMP_FORCE_VERTICAL;
                velocityX = 0;
              }
              setAnim(CONFIG.ANIM_JUMP, false);
            }
 
            if (!isOnGround) {
              velocityY    += CONFIG.GRAVITY;
              container.y  += velocityY;
              if (container.y >= groundY) {
                container.y = groundY;
                velocityY   = 0;
                velocityX   = 0;
                isOnGround  = true;
              }
            }
 
            container.x = Math.max(0, Math.min(CONFIG.WIDTH, container.x));
 
            if (isOnGround) {
              setAnim(isMoving ? CONFIG.ANIM_WALK : CONFIG.ANIM_IDLE);
            }
          } else {
            // ✅ Під час drag — нахил залежно від швидкості миші
            const targetTilt = drag.velX * 0.04;
            tilt.vel   += (targetTilt - tilt.angle) * tilt.stiff;
            tilt.vel   *= tilt.damping;
            tilt.angle += tilt.vel;
            // Обмеження нахилу ±35 градусів
            tilt.angle = Math.max(-0.6, Math.min(0.6, tilt.angle));
            container.rotation = tilt.angle;
 
            setAnim(CONFIG.ANIM_IDLE);
          }
 
          // ✅ Блокуємо вертикальний drift від анімації root кістки
          // root.translate y: -11.61 в анімації підіймає кота вгору — скидаємо до 0
          rootBone.y = 0;
        });
 
 
      });
 
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup',   onKeyUp);
      if (appRef.current) {
        appRef.current.destroy(true, { children: true, texture: true });
        appRef.current = null;
      }
      isInitialized.current = false;
    };
  }, []);
 
  return (
    <div style={styles.wrapper}>
      <h1 style={styles.title}>Your favourite kitten</h1>
      <div style={styles.canvasWrapper}>
        <canvas ref={canvasRef} />
      </div>
      <div style={styles.hud}>
        {[
          { key: 'A / D', hint: 'рух'        },
          { key: 'W',     hint: 'стрибок'    },
          { key: '🖱',    hint: 'потягни кота' },
        ].map(({ key, hint }) => (
          <div key={key} style={styles.keyGroup}>
            <span style={styles.key}>{key}</span>
            <span style={styles.hint}>{hint}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
 
const styles = {
  wrapper: {
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    justifyContent: 'center',
    minHeight:      '100vh',
    background:     '#0f0f1a',
    fontFamily:     '"Courier New", monospace',
    gap:            '16px',
  },
  title: {
    color:         '#e0e0ff',
    fontSize:      '1.4rem',
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    margin:        0,
    opacity:       0.7,
  },
  canvasWrapper: {
    border:       '1px solid rgba(255,255,255,0.1)',
    borderRadius: '4px',
    overflow:     'hidden',
    boxShadow:    '0 0 40px rgba(80,80,200,0.15)',
  },
  hud: {
    display:    'flex',
    alignItems: 'center',
    gap:        '20px',
  },
  keyGroup: {
    display:    'flex',
    alignItems: 'center',
    gap:        '6px',
  },
  key: {
    display:       'inline-block',
    padding:       '4px 10px',
    background:    'rgba(255,255,255,0.08)',
    border:        '1px solid rgba(255,255,255,0.2)',
    borderRadius:  '4px',
    color:         '#c0c0ff',
    fontSize:      '0.85rem',
    fontWeight:    'bold',
    letterSpacing: '0.05em',
  },
  hint: {
    color:    'rgba(200,200,255,0.4)',
    fontSize: '0.8rem',
  },
};
 
export default Game;