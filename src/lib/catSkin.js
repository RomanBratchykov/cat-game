import { loadSkeletonPartSizes } from './skeletonLayout.js';

const PART_KEYS = ['head', 'body', 'leg', 'tail'];

function imageFromSource(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to decode image source'));
    image.src = source;
  });
}

function createCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function shouldDecodeSource(source) {
  if (typeof source !== 'string' || !source) return false;
  return (
    source.startsWith('data:image/') ||
    source.startsWith('/') ||
    source.startsWith('./') ||
    source.startsWith('../') ||
    source.startsWith('http://') ||
    source.startsWith('https://') ||
    source.startsWith('blob:')
  );
}

function fitImageToPartCanvas(image, partKey, partSizes) {
  const resolved = partSizes?.[partKey];
  const [targetW, targetH] = resolved || [image.width || 1, image.height || 1];
  const canvas = createCanvas(targetW, targetH);
  const ctx = canvas.getContext('2d');

  if (!image.width || !image.height) return canvas;

  const scale = Math.min(targetW / image.width, targetH / image.height);
  const drawW = Math.max(1, Math.round(image.width * scale));
  const drawH = Math.max(1, Math.round(image.height * scale));
  const drawX = Math.round((targetW - drawW) / 2);
  const drawY = Math.round((targetH - drawH) / 2);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, drawX, drawY, drawW, drawH);
  return canvas;
}

async function sourceToPartCanvas(source, partKey, partSizes) {
  if (!shouldDecodeSource(source)) return null;
  const image = await imageFromSource(source);
  return fitImageToPartCanvas(image, partKey, partSizes);
}

function pickLibraryEntry(partKey, partLibrary, selectedParts) {
  const list = Array.isArray(partLibrary?.[partKey]) ? partLibrary[partKey] : [];
  if (list.length === 0) return null;

  const selectedId = typeof selectedParts?.[partKey] === 'string' ? selectedParts[partKey] : null;
  if (selectedId) {
    const selected = list.find((item) => item?.id === selectedId);
    if (selected?.dataUrl) return selected;
  }

  const systemDefault = list.find((item) => item?.isSystemDefault && typeof item?.dataUrl === 'string');
  if (systemDefault) return systemDefault;

  return list.find((item) => typeof item?.dataUrl === 'string') || null;
}

export function canvasesToDataUrls(parts = {}) {
  const result = {};

  Object.entries(parts).forEach(([key, canvas]) => {
    if (!canvas || typeof canvas.toDataURL !== 'function') return;

    try {
      const compressed = canvas.toDataURL('image/webp', 0.88);
      result[key] = compressed.startsWith('data:image/webp') ? compressed : canvas.toDataURL('image/png');
    } catch {
      result[key] = canvas.toDataURL('image/png');
    }
  });

  return result;
}

export async function dataUrlsToCanvases(dataUrls = {}, options = {}) {
  const result = {};
  const partSizes = options.partSizes || await loadSkeletonPartSizes();

  for (const [key, source] of Object.entries(dataUrls)) {
    const canvas = await sourceToPartCanvas(source, key, partSizes);
    if (!canvas) continue;
    result[key] = canvas;
  }

  return result;
}

export async function buildSkinCanvasesFromCat(catRecord = null) {
  if (!catRecord) return {};

  const partSizes = await loadSkeletonPartSizes();
  const merged = await dataUrlsToCanvases(catRecord.skin_parts || {}, { partSizes });
  const partLibrary = catRecord.part_library || {};
  const selectedParts = catRecord.selected_parts || {};

  for (const partKey of PART_KEYS) {
    if (merged[partKey]) continue;

    const entry = pickLibraryEntry(partKey, partLibrary, selectedParts);
    if (!entry?.dataUrl) continue;

    try {
      const canvas = await sourceToPartCanvas(entry.dataUrl, partKey, partSizes);
      if (canvas) merged[partKey] = canvas;
    } catch {
      // Ignore invalid sources; game skeleton fallback will render this part.
    }
  }

  return merged;
}
