// ─────────────────────────────────────────────────────────────────
// DrawingEditor.jsx
//
// Повний редактор малювання частин тіла кота.
// Кожна частина малюється на окремому прихованому canvas.
// Коли гравець готовий — onComplete(parts) повертає Map<partName, HTMLCanvasElement>.
//
// Архітектурне рішення: тримаємо окремий canvas для кожної частини,
// а не один. Це дозволяє редагувати будь-яку частину незалежно.
// ─────────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState, useCallback } from 'react';

// Частини тіла — відповідають кісткам і слотам в Spine
// size: розмір canvas в пікселях для малювання
// hint: підказка що малювати
const PARTS = [
  { id: 'head',  label: '😺 Голова', size: [200, 200], hint: 'Намалюй голову кота — круг, трикутні вуха, очі, ніс' },
  { id: 'body',  label: '🐱 Тіло',   size: [180, 160], hint: 'Намалюй тіло — овал з хутром або візерунком' },
  { id: 'leg',   label: '🦵 Лапка',  size: [80,  130], hint: 'Одна лапка — використається для всіх чотирьох' },
  { id: 'tail',  label: '〰️ Хвіст', size: [80,  200], hint: 'Намалюй хвіст — знизу вгору' },
];

// Кольори палітри
const PALETTE = [
  '#1a1a2e', '#ffffff', '#ff6b9d', '#ffd93d',
  '#6bcb77', '#4d96ff', '#c77dff', '#f4a261',
  '#e76f51', '#8ecae6', '#a8dadc', '#457b9d',
  '#brown', '#264653', '#2a9d8f', '#e9c46a',
];

// Реальний brown замість рядка
const FIXED_PALETTE = PALETTE.map(c => c === '#brown' ? '#8B6914' : c);

const DrawingEditor = ({ onComplete }) => {
  const [activePart, setActivePart]     = useState('head');
  const [tool, setTool]                 = useState('brush');  // brush | eraser | fill
  const [color, setColor]               = useState('#8B6914');
  const [brushSize, setBrushSize]       = useState(8);
  const [isDrawing, setIsDrawing]       = useState(false);
  const [completedParts, setCompleted]  = useState(new Set());

  // Тримаємо окремий canvas ref для кожної частини
//   const canvasRefs  = useRef({});
  const ctxRefs     = useRef({});
  const canvasEls   = useRef({}); // offscreen canvases (зберігають малюнки)
  const displayRef  = useRef(null); // canvas що показується
  const lastPos     = useRef(null);

  // Ініціалізуємо offscreen canvas для кожної частини
  useEffect(() => {
    PARTS.forEach(part => {
      if (!canvasEls.current[part.id]) {
        const c  = document.createElement('canvas');
        c.width  = part.size[0];
        c.height = part.size[1];
        const ctx = c.getContext('2d');
        // Прозорий фон — важливо для накладання на скелет
        ctx.clearRect(0, 0, c.width, c.height);
        canvasEls.current[part.id] = c;
        ctxRefs.current[part.id]   = ctx;
      }
    });
  }, []);

  const drawCheckerboard = (ctx, w, h) => {
    const size = 10;
    for (let x = 0; x < w; x += size) {
      for (let y = 0; y < h; y += size) {
        ctx.fillStyle = ((x / size + y / size) % 2 === 0) ? '#e0e0e0' : '#c0c0c0';
        ctx.fillRect(x, y, size, size);
      }
    }
  };

   const syncDisplay = useCallback(() => {
    const display = displayRef.current;
    if (!display) return;
    const part     = PARTS.find(p => p.id === activePart);
    display.width  = part.size[0];
    display.height = part.size[1];
    const dCtx = display.getContext('2d');
    dCtx.clearRect(0, 0, display.width, display.height);
    // Малюємо шахову підкладку (показує прозорість)
    drawCheckerboard(dCtx, display.width, display.height);
    // Копіюємо поточний малюнок
    const src = canvasEls.current[activePart];
    if (src) dCtx.drawImage(src, 0, 0);
  }, [activePart]);

  

  // Копіюємо offscreen canvas на display canvas при зміні частини
  useEffect(() => {
    syncDisplay();
  }, [activePart, syncDisplay]);


  // ── Drawing ──────────────────────────────────────────────────────

  const getPos = useCallback((e) => {
    const rect = displayRef.current.getBoundingClientRect();
    const part = PARTS.find(p => p.id === activePart);
    const scaleX = part.size[0] / rect.width;
    const scaleY = part.size[1] / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top)  * scaleY,
    };
  }, [activePart]);

  const fillAt = useCallback((x, y) => {
    const canvas = canvasEls.current[activePart];
    const ctx    = ctxRefs.current[activePart];
    const w = canvas.width, h = canvas.height;
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;

    const px = Math.round(x), py = Math.round(y);
    const idx = (py * w + px) * 4;

    const targetR = data[idx], targetG = data[idx+1],
          targetB = data[idx+2], targetA = data[idx+3];

    const fillR = parseInt(color.slice(1,3), 16);
    const fillG = parseInt(color.slice(3,5), 16);
    const fillB = parseInt(color.slice(5,7), 16);

    if (targetR === fillR && targetG === fillG && targetB === fillB) return;

    const match = (i) =>
      Math.abs(data[i]   - targetR) < 30 &&
      Math.abs(data[i+1] - targetG) < 30 &&
      Math.abs(data[i+2] - targetB) < 30 &&
      Math.abs(data[i+3] - targetA) < 30;

    const stack = [[px, py]];
    const visited = new Uint8Array(w * h);

    while (stack.length) {
      const [cx, cy] = stack.pop();
      if (cx < 0 || cx >= w || cy < 0 || cy >= h) continue;
      const ci = cy * w + cx;
      if (visited[ci]) continue;
      visited[ci] = 1;
      const di = ci * 4;
      if (!match(di)) continue;

      data[di]   = fillR;
      data[di+1] = fillG;
      data[di+2] = fillB;
      data[di+3] = 255;

      stack.push([cx+1, cy], [cx-1, cy], [cx, cy+1], [cx, cy-1]);
    }

    ctx.putImageData(imageData, 0, 0);
    syncDisplay();
    setCompleted(prev => new Set([...prev, activePart]));
  }, [color, activePart, syncDisplay]);

  const startDraw = useCallback((e) => {
    e.preventDefault();
    setIsDrawing(true);
    const pos = getPos(e);
    lastPos.current = pos;

    if (tool === 'fill') {
      fillAt(pos.x, pos.y);
      return;
    }

    // Починаємо нову лінію
    const ctx = ctxRefs.current[activePart];
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, brushSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = tool === 'eraser' ? 'rgba(0,0,0,0)' : color;
    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
    } else {
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.fill();
    syncDisplay();
  }, [activePart, tool, fillAt, getPos, syncDisplay, color, brushSize]);


  const draw = useCallback((e) => {
    if (!isDrawing || tool === 'fill') return;
    e.preventDefault();

    const pos = getPos(e);
    const ctx = ctxRefs.current[activePart];

    ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.strokeStyle = color;
    ctx.lineWidth   = brushSize;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';

    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();

    lastPos.current = pos;
    syncDisplay();
  }, [isDrawing, activePart, getPos, syncDisplay, tool, color, brushSize]);


  const stopDraw = useCallback(() => {
    setIsDrawing(false);
    lastPos.current = null;

    // Позначаємо частину як намальовану якщо canvas не порожній
    const canvas = canvasEls.current[activePart];
    const ctx    = canvas.getContext('2d');
    const data   = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const hasPixels = data.some((v, i) => i % 4 === 3 && v > 0);
    if (hasPixels) {
      setCompleted(prev => new Set([...prev, activePart]));
    }
  }, [activePart]);


  // ── Flood fill ────────────────────────────────────────────────────



  const clearPart = () => {
    const canvas = canvasEls.current[activePart];
    const ctx    = ctxRefs.current[activePart];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setCompleted(prev => {
      const next = new Set(prev);
      next.delete(activePart);
      return next;
    });
    syncDisplay();
  };

  const handleComplete = () => {
    const parts = {};
    PARTS.forEach(part => {
      parts[part.id] = canvasEls.current[part.id];
    });
    console.log('[Editor] Completed parts:', Object.keys(parts));
    onComplete(parts);
  };

  const currentPart = PARTS.find(p => p.id === activePart);

  return (
    <div style={s.wrapper}>
      <h1 style={s.title}>🎨 Намалюй свого кота</h1>

      {/* Вибір частини тіла */}
      <div style={s.partSelector}>
        {PARTS.map(part => (
          <button
            key={part.id}
            onClick={() => setActivePart(part.id)}
            style={{
              ...s.partBtn,
              ...(activePart === part.id ? s.partBtnActive : {}),
              ...(completedParts.has(part.id) ? s.partBtnDone : {}),
            }}
          >
            {part.label}
            {completedParts.has(part.id) && <span style={s.checkmark}>✓</span>}
          </button>
        ))}
      </div>

      {/* Підказка */}
      <p style={s.hint}>{currentPart.hint}</p>

      <div style={s.main}>

        <div style={s.toolbar}>
          {/* Інструменти */}
          <div style={s.toolGroup}>
            {[
              { id: 'brush',  label: '✏️' },
              { id: 'eraser', label: '⬜' },
              { id: 'fill',   label: '🪣' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTool(t.id)}
                style={{ ...s.toolBtn, ...(tool === t.id ? s.toolBtnActive : {}) }}
                title={t.id}
              >{t.label}</button>
            ))}
          </div>

          {/* Розмір пензля */}
          <div style={s.toolGroup}>
            <label style={s.label}>Розмір</label>
            <input
              type="range" min="2" max="40" value={brushSize}
              onChange={e => setBrushSize(Number(e.target.value))}
              style={s.slider}
            />
            <span style={s.label}>{brushSize}px</span>
          </div>

          {/* Очистити */}
          <button onClick={clearPart} style={s.clearBtn}>🗑 Очистити</button>
        </div>

        {/* Canvas */}
        <div style={s.canvasWrapper}>
          <canvas
            ref={displayRef}
            style={{
              ...s.canvas,
              width:  currentPart.size[0] * 2,
              height: currentPart.size[1] * 2,
              cursor: tool === 'eraser' ? 'cell' : tool === 'fill' ? 'crosshair' : 'default',
            }}
            onPointerDown={startDraw}
            onPointerMove={draw}
            onPointerUp={stopDraw}
            onPointerLeave={stopDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={stopDraw}
          />
        </div>

        {/* Палітра */}
        <div style={s.palette}>
          {FIXED_PALETTE.map(c => (
            <button
              key={c}
              onClick={() => { setColor(c); setTool('brush'); }}
              style={{
                ...s.colorBtn,
                background: c,
                boxShadow: color === c ? `0 0 0 3px white, 0 0 0 5px ${c}` : 'none',
              }}
            />
          ))}
          {/* Кастомний колір */}
          <input
            type="color" value={color}
            onChange={e => { setColor(e.target.value); setTool('brush'); }}
            style={s.colorInput}
            title="Свій колір"
          />
        </div>

      </div>

      {/* Кнопка завершення */}
      <button
        onClick={handleComplete}
        style={s.doneBtn}
      >
        🐱 Грати!
      </button>
      <p style={s.doneHint}>
        Намальовано: {completedParts.size}/{PARTS.length} частин
        {completedParts.size === 0 && ' — можна грати і з порожнім котом'}
      </p>
    </div>
  );
};

// ── Стилі ─────────────────────────────────────────────────────────

const s = {
  wrapper: {
    minHeight:      '100vh',
    background:     '#0f0f1a',
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    padding:        '20px',
    gap:            '16px',
    fontFamily:     '"Courier New", monospace',
    boxSizing:      'border-box',
  },
  title: {
    color:         '#e0e0ff',
    fontSize:      '1.6rem',
    letterSpacing: '0.1em',
    margin:        0,
  },
  partSelector: {
    display:        'flex',
    gap:            '8px',
    flexWrap:       'wrap',
    justifyContent: 'center',
  },
  partBtn: {
    padding:      '8px 16px',
    background:   'rgba(255,255,255,0.06)',
    border:       '1px solid rgba(255,255,255,0.15)',
    borderRadius: '8px',
    color:        '#c0c0ff',
    cursor:       'pointer',
    fontSize:     '0.9rem',
    position:     'relative',
    transition:   'all 0.15s',
  },
  partBtnActive: {
    background:   'rgba(100,100,255,0.25)',
    border:       '1px solid rgba(100,100,255,0.6)',
    color:        '#ffffff',
  },
  partBtnDone: {
    borderColor: 'rgba(100,255,150,0.5)',
  },
  checkmark: {
    position:   'absolute',
    top:        '-6px',
    right:      '-6px',
    fontSize:   '10px',
    background: '#4caf50',
    color:      'white',
    borderRadius: '50%',
    width:      '16px',
    height:     '16px',
    display:    'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    color:    'rgba(200,200,255,0.5)',
    fontSize: '0.85rem',
    margin:   0,
    textAlign:'center',
    maxWidth: '500px',
  },
  main: {
    display:       'flex',
    gap:           '16px',
    alignItems:    'flex-start',
    flexWrap:      'wrap',
    justifyContent:'center',
  },
  toolbar: {
    display:       'flex',
    flexDirection: 'column',
    gap:           '12px',
    padding:       '12px',
    background:    'rgba(255,255,255,0.05)',
    border:        '1px solid rgba(255,255,255,0.1)',
    borderRadius:  '8px',
    minWidth:      '120px',
  },
  toolGroup: {
    display:       'flex',
    flexDirection: 'column',
    gap:           '6px',
  },
  toolBtn: {
    padding:      '8px',
    background:   'rgba(255,255,255,0.06)',
    border:       '1px solid rgba(255,255,255,0.1)',
    borderRadius: '6px',
    color:        '#c0c0ff',
    cursor:       'pointer',
    fontSize:     '1.2rem',
  },
  toolBtnActive: {
    background: 'rgba(100,100,255,0.3)',
    border:     '1px solid rgba(100,100,255,0.6)',
  },
  label: {
    color:    'rgba(200,200,255,0.5)',
    fontSize: '0.75rem',
  },
  slider: {
    width: '100%',
  },
  clearBtn: {
    padding:      '8px',
    background:   'rgba(255,80,80,0.15)',
    border:       '1px solid rgba(255,80,80,0.3)',
    borderRadius: '6px',
    color:        '#ff8080',
    cursor:       'pointer',
    fontSize:     '0.8rem',
  },
  canvasWrapper: {
    border:       '2px solid rgba(255,255,255,0.15)',
    borderRadius: '8px',
    overflow:     'hidden',
    lineHeight:   0,
  },
  canvas: {
    display:   'block',
    imageRendering: 'pixelated',
    touchAction: 'none',
  },
  palette: {
    display:        'flex',
    flexDirection:  'column',
    flexWrap:       'wrap',
    gap:            '6px',
    maxHeight:      '400px',
    padding:        '12px',
    background:     'rgba(255,255,255,0.05)',
    border:         '1px solid rgba(255,255,255,0.1)',
    borderRadius:   '8px',
  },
  colorBtn: {
    width:        '32px',
    height:       '32px',
    borderRadius: '50%',
    border:       '2px solid rgba(255,255,255,0.2)',
    cursor:       'pointer',
    padding:      0,
    transition:   'transform 0.1s',
  },
  colorInput: {
    width:        '32px',
    height:       '32px',
    borderRadius: '50%',
    border:       '2px solid rgba(255,255,255,0.2)',
    cursor:       'pointer',
    padding:      0,
    background:   'none',
  },
  doneBtn: {
    padding:      '14px 40px',
    background:   'rgba(100,200,150,0.2)',
    border:       '2px solid rgba(100,200,150,0.5)',
    borderRadius: '12px',
    color:        '#a0ffc0',
    cursor:       'pointer',
    fontSize:     '1.1rem',
    fontFamily:   '"Courier New", monospace',
    letterSpacing:'0.1em',
    transition:   'all 0.2s',
  },
  doneHint: {
    color:    'rgba(200,200,255,0.4)',
    fontSize: '0.8rem',
    margin:   0,
  },
};

export default DrawingEditor;