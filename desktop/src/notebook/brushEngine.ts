import { BrushTipType, LineStyleType, StrokeCanvasObject } from '../types';

export interface BrushPresetConfig {
  color: string;
  size: number; // 1..80
  opacity: number; // 0.05..1
  hardness: number; // 0..100
  smoothing: number; // 0..100
  lineStyle: LineStyleType;
  pressureEnabled: boolean;
}

export interface EraserSettings {
  mode: 'pixel' | 'stroke'; // 'pixel' = transparent paint over drawings; 'stroke' = delete whole touched stroke
  size: number; // 6..120 (visual circular cursor & erase radius)
  opacity: number; // 0.1..1 (erase strength for transparent paint mode)
  hardness: number; // 0..100 (edge sharpness)
}

export interface FillSettings {
  color: string;
  opacity: number; // 0.05..1
  tolerance: number; // 0..120
}

export interface DrawingToolsState {
  activeTip: BrushTipType;
  brushes: Record<BrushTipType, BrushPresetConfig>;
  eraser: EraserSettings;
  fill: FillSettings;
}

/** Legacy compatibility view for components expecting a flat BrushSettings object */
export interface BrushSettings extends BrushPresetConfig {
  tip: BrushTipType;
  eraserMode: 'stroke' | 'pixel';
}

export const BRUSH_TIPS: Array<{ id: BrushTipType; label: string; desc: string }> = [
  { id: 'round', label: 'Redonda', desc: 'Trazo limpio de precisión' },
  { id: 'square', label: 'Cuadrada', desc: 'Punta plana geométrica' },
  { id: 'calligraphy', label: 'Caligráfica', desc: 'Pluma inclinada a 40°' },
  { id: 'marker', label: 'Marcador', desc: 'Bisel denso semitransparente' },
  { id: 'highlighter', label: 'Resaltador', desc: 'Tinta traslúcida fluorescente' },
  { id: 'soft', label: 'Pincel suave', desc: 'Aerógrafo con bordes difusos' },
  { id: 'watercolor', label: 'Acuarela', desc: 'Capas orgánicas pigmentadas' },
];

export const DEFAULT_BRUSH_PRESETS: Record<BrushTipType, BrushPresetConfig> = {
  round: {
    color: '#1E293B',
    size: 3.5,
    opacity: 1,
    hardness: 95,
    smoothing: 45,
    lineStyle: 'solid',
    pressureEnabled: true,
  },
  square: {
    color: '#2B64F5',
    size: 6,
    opacity: 1,
    hardness: 100,
    smoothing: 25,
    lineStyle: 'solid',
    pressureEnabled: false,
  },
  calligraphy: {
    color: '#0F172A',
    size: 7,
    opacity: 1,
    hardness: 96,
    smoothing: 60,
    lineStyle: 'solid',
    pressureEnabled: true,
  },
  marker: {
    color: '#E11D48',
    size: 12,
    opacity: 0.82,
    hardness: 88,
    smoothing: 40,
    lineStyle: 'solid',
    pressureEnabled: false,
  },
  highlighter: {
    color: '#FACC15',
    size: 24,
    opacity: 0.42,
    hardness: 92,
    smoothing: 55,
    lineStyle: 'solid',
    pressureEnabled: false,
  },
  soft: {
    color: '#7C3AED',
    size: 18,
    opacity: 0.68,
    hardness: 22,
    smoothing: 50,
    lineStyle: 'solid',
    pressureEnabled: true,
  },
  watercolor: {
    color: '#0D9488',
    size: 20,
    opacity: 0.56,
    hardness: 35,
    smoothing: 58,
    lineStyle: 'solid',
    pressureEnabled: true,
  },
};

export const DEFAULT_ERASER_SETTINGS: EraserSettings = {
  mode: 'pixel',
  size: 30,
  opacity: 1,
  hardness: 90,
};

export const DEFAULT_FILL_SETTINGS: FillSettings = {
  color: '#2B64F5',
  opacity: 0.85,
  tolerance: 36,
};

export const DEFAULT_DRAWING_TOOLS_STATE: DrawingToolsState = {
  activeTip: 'round',
  brushes: DEFAULT_BRUSH_PRESETS,
  eraser: DEFAULT_ERASER_SETTINGS,
  fill: DEFAULT_FILL_SETTINGS,
};

const TOOL_PROFILES_LS_KEY = 'luma_drawing_tool_profiles_v2';

export function loadDrawingToolsState(): DrawingToolsState {
  try {
    const raw = localStorage.getItem(TOOL_PROFILES_LS_KEY);
    if (!raw) return cloneDefaultDrawingToolsState();
    const parsed = JSON.parse(raw) as Partial<DrawingToolsState>;
    const brushes = {} as Record<BrushTipType, BrushPresetConfig>;
    for (const item of BRUSH_TIPS) {
      brushes[item.id] = {
        ...DEFAULT_BRUSH_PRESETS[item.id],
        ...(parsed.brushes?.[item.id] ?? {}),
      };
    }
    return {
      activeTip: parsed.activeTip && brushes[parsed.activeTip] ? parsed.activeTip : 'round',
      brushes,
      eraser: { ...DEFAULT_ERASER_SETTINGS, ...(parsed.eraser ?? {}) },
      fill: { ...DEFAULT_FILL_SETTINGS, ...(parsed.fill ?? {}) },
    };
  } catch {
    return cloneDefaultDrawingToolsState();
  }
}

export function saveDrawingToolsState(state: DrawingToolsState): void {
  try {
    localStorage.setItem(TOOL_PROFILES_LS_KEY, JSON.stringify(state));
  } catch {
    // ignore storage quota
  }
}

export function cloneDefaultDrawingToolsState(): DrawingToolsState {
  const brushes = {} as Record<BrushTipType, BrushPresetConfig>;
  for (const item of BRUSH_TIPS) {
    brushes[item.id] = { ...DEFAULT_BRUSH_PRESETS[item.id] };
  }
  return {
    activeTip: 'round',
    brushes,
    eraser: { ...DEFAULT_ERASER_SETTINGS },
    fill: { ...DEFAULT_FILL_SETTINGS },
  };
}

/**
 * Applies exponential moving average stabilization to incoming pointer points
 * based on smoothing (0..100).
 */
export function smoothIncomingPoint(
  prev: { x: number; y: number; p?: number } | undefined,
  next: { x: number; y: number; p?: number },
  smoothing: number
): { x: number; y: number; p: number } {
  const p = typeof next.p === 'number' && next.p > 0 ? next.p : 0.5;
  if (!prev || smoothing <= 0) {
    return { x: next.x, y: next.y, p };
  }
  const alpha = Math.max(0.12, 1 - (smoothing / 100) * 0.84);
  return {
    x: prev.x + (next.x - prev.x) * alpha,
    y: prev.y + (next.y - prev.y) * alpha,
    p: (prev.p ?? 0.5) + (p - (prev.p ?? 0.5)) * alpha,
  };
}

function getLineDash(style: LineStyleType | undefined, width: number): number[] {
  if (style === 'dashed') return [Math.max(8, width * 3), Math.max(6, width * 2)];
  if (style === 'dotted') return [Math.max(1.5, width * 0.4), Math.max(5, width * 2.2)];
  return [];
}

/**
 * Renders a single StrokeCanvasObject onto a 2D Canvas context with full support for:
 * - Transparent-paint pixel eraser (tool === 'eraser' via destination-out!)
 * - All 7 visually distinct brush tips (round, square, calligraphy, marker, highlighter, soft, watercolor)
 * - Per-stroke opacity, hardness/feather blur, dash styles, and stylus pressure.
 */
export function renderStrokeToCanvas(
  ctx: CanvasRenderingContext2D,
  stroke: StrokeCanvasObject
): void {
  const pts = stroke.points;
  if (!pts || pts.length === 0) return;

  const baseWidth = Math.max(1, stroke.strokeWidth);
  const baseOpacity = Math.max(0.02, Math.min(1, stroke.opacity ?? 1));
  const hardness = stroke.hardness ?? 90;

  // Transparent-paint eraser cuts cleanly through the ink canvas only (leaving paper/grid intact!)
  if (stroke.tool === 'eraser') {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = baseOpacity;
    ctx.strokeStyle = 'rgba(0,0,0,1)';
    ctx.fillStyle = 'rgba(0,0,0,1)';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = baseWidth;

    const featherBlur = ((100 - hardness) / 100) * Math.max(3, baseWidth * 0.45);
    if (featherBlur > 0.3) {
      ctx.shadowColor = 'rgba(0,0,0,1)';
      ctx.shadowBlur = featherBlur;
    }

    if (pts.length === 1) {
      ctx.beginPath();
      ctx.arc(pts[0].x, pts[0].y, baseWidth / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length - 1; i++) {
        const midX = (pts[i].x + pts[i + 1].x) / 2;
        const midY = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
      }
      const last = pts[pts.length - 1];
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  const tip: BrushTipType =
    stroke.brushTip ?? (stroke.tool === 'highlighter' ? 'highlighter' : 'round');
  const usePressure = Boolean(stroke.pressureEnabled);

  ctx.save();
  ctx.globalCompositeOperation =
    stroke.blendMode && stroke.blendMode !== 'normal'
      ? (stroke.blendMode as GlobalCompositeOperation)
      : tip === 'highlighter' || tip === 'watercolor'
        ? 'multiply'
        : 'source-over';

  const drawPathSegments = (
    widthMultiplier: number,
    opacityMultiplier: number,
    blurPx: number,
    offsetX = 0,
    offsetY = 0
  ) => {
    ctx.save();
    ctx.strokeStyle = stroke.color;
    ctx.fillStyle = stroke.color;
    ctx.globalAlpha = Math.max(0.02, Math.min(1, baseOpacity * opacityMultiplier));
    ctx.lineCap = tip === 'square' || tip === 'marker' || tip === 'highlighter' ? 'butt' : 'round';
    ctx.lineJoin = tip === 'square' ? 'miter' : 'round';
    ctx.setLineDash(getLineDash(stroke.lineStyle, baseWidth * widthMultiplier));

    if (blurPx > 0.2) {
      ctx.shadowColor = stroke.color;
      ctx.shadowBlur = blurPx;
    }

    if (pts.length === 1) {
      const p0 = pts[0];
      const r = (baseWidth * widthMultiplier) / 2;
      ctx.beginPath();
      if (tip === 'square') {
        ctx.fillRect(p0.x + offsetX - r, p0.y + offsetY - r, r * 2, r * 2);
      } else {
        ctx.arc(p0.x + offsetX, p0.y + offsetY, Math.max(1, r), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      return;
    }

    // Calligraphy nib: angled flat ribbon producing genuine thick/thin downstrokes vs upstrokes
    if (tip === 'calligraphy') {
      const nibAngle = -Math.PI / 4.2; // ~43° italic nib
      const cosA = Math.cos(nibAngle);
      const sinA = Math.sin(nibAngle);
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        const pScale = usePressure ? 0.5 + (b.p ?? 0.5) * 1.1 : 1;
        const halfNib = Math.max(2, baseWidth * widthMultiplier * 0.9 * pScale);
        ctx.beginPath();
        ctx.moveTo(a.x + offsetX - cosA * halfNib, a.y + offsetY - sinA * halfNib);
        ctx.lineTo(a.x + offsetX + cosA * halfNib, a.y + offsetY + sinA * halfNib);
        ctx.lineTo(b.x + offsetX + cosA * halfNib, b.y + offsetY + sinA * halfNib);
        ctx.lineTo(b.x + offsetX - cosA * halfNib, b.y + offsetY - sinA * halfNib);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      return;
    }

    // Square chisel nib: crisp geometric rectangular stamps along segments
    if (tip === 'square' && stroke.lineStyle === 'solid') {
      const half = Math.max(1.5, (baseWidth * widthMultiplier) / 2);
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        const dist = Math.hypot(b.x - a.x, b.y - a.y);
        const steps = Math.max(1, Math.ceil(dist / 2));
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const x = a.x + (b.x - a.x) * t + offsetX;
          const y = a.y + (b.y - a.y) * t + offsetY;
          ctx.fillRect(x - half, y - half, half * 2, half * 2);
        }
      }
      ctx.restore();
      return;
    }

    // Variable pressure smooth quadratic segments
    if (usePressure && stroke.lineStyle === 'solid') {
      for (let i = 1; i < pts.length; i++) {
        const prev = pts[i - 1];
        const curr = pts[i];
        const pFactor = 0.35 + (curr.p ?? 0.5) * 1.3;
        ctx.lineWidth = Math.max(1, baseWidth * widthMultiplier * pFactor);
        ctx.beginPath();
        ctx.moveTo(prev.x + offsetX, prev.y + offsetY);
        ctx.lineTo(curr.x + offsetX, curr.y + offsetY);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }

    // Smooth quadratic Bezier curve across all points
    ctx.lineWidth = Math.max(1, baseWidth * widthMultiplier);
    ctx.beginPath();
    ctx.moveTo(pts[0].x + offsetX, pts[0].y + offsetY);
    for (let i = 1; i < pts.length - 1; i++) {
      const midX = (pts[i].x + pts[i + 1].x) / 2;
      const midY = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(
        pts[i].x + offsetX,
        pts[i].y + offsetY,
        midX + offsetX,
        midY + offsetY
      );
    }
    const last = pts[pts.length - 1];
    ctx.lineTo(last.x + offsetX, last.y + offsetY);
    ctx.stroke();
    ctx.restore();
  };

  const softBlur = ((100 - hardness) / 100) * Math.max(4, baseWidth * 0.9);

  switch (tip) {
    case 'highlighter':
      // Wide, translucent ribbon with sharp vertical flat caps
      drawPathSegments(1.35, 0.55, softBlur * 0.15);
      break;
    case 'marker':
      // Rich chisel felt-tip: slightly wider translucent body + crisp core
      drawPathSegments(1.25, 0.62, softBlur * 0.25);
      drawPathSegments(0.88, 0.85, 0);
      break;
    case 'soft':
      // Airbrush: wide feathered halo + gentle core
      drawPathSegments(1.4, 0.36, Math.max(8, baseWidth * 0.95 + softBlur));
      drawPathSegments(0.7, 0.52, Math.max(4, baseWidth * 0.4));
      break;
    case 'watercolor':
      // Multi-wash translucent organic pigment layers with edge bleed
      drawPathSegments(1.65, 0.18, Math.max(9, baseWidth * 0.9), 2, 1.5);
      drawPathSegments(1.25, 0.24, Math.max(5, baseWidth * 0.45), -1.5, 0.8);
      drawPathSegments(0.85, 0.32, Math.max(2, softBlur * 0.35), 0, 0);
      break;
    case 'calligraphy':
    case 'square':
    case 'round':
    default:
      drawPathSegments(1, 1, softBlur);
      break;
  }

  ctx.restore();
}

/**
 * Renders a live S-curve stroke preview in the Brush Properties Panel so users
 * see the exact active brush's tip, color, thickness, opacity, hardness, and dash style.
 */
export function renderBrushPreview(
  canvas: HTMLCanvasElement,
  tip: BrushTipType,
  settings: BrushPresetConfig
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth || 220;
  const h = canvas.clientHeight || 68;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  // Subtle checkerboard to show opacity clearly
  const sq = 8;
  ctx.fillStyle = 'rgba(128, 128, 128, 0.1)';
  for (let y = 0; y < h; y += sq) {
    for (let x = 0; x < w; x += sq) {
      if ((Math.floor(x / sq) + Math.floor(y / sq)) % 2 === 0) {
        ctx.fillRect(x, y, sq, sq);
      }
    }
  }

  const pts: Array<{ x: number; y: number; p: number }> = [];
  const steps = 28;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = 18 + t * (w - 36);
    const y = h / 2 + Math.sin(t * Math.PI * 2) * (h * 0.24);
    const p = Math.sin(t * Math.PI);
    pts.push({ x, y, p: 0.25 + p * 0.75 });
  }

  const previewStroke: StrokeCanvasObject = {
    id: 'preview',
    kind: 'stroke',
    layerId: 'ink',
    x: 0,
    y: 0,
    w,
    h,
    opacity: settings.opacity,
    tool: tip === 'highlighter' ? 'highlighter' : 'pen',
    brushTip: tip,
    color: settings.color,
    strokeWidth: Math.min(28, settings.size),
    hardness: settings.hardness,
    smoothing: settings.smoothing,
    lineStyle: settings.lineStyle,
    pressureEnabled: settings.pressureEnabled,
    points: pts,
  };

  renderStrokeToCanvas(ctx, previewStroke);
}

/**
 * Renders a live visual preview of the Eraser tool (showing the exact circular erase ring
 * and how transparent-paint mode vs full-stroke mode acts on sample strokes).
 */
export function renderEraserPreview(
  canvas: HTMLCanvasElement,
  eraser: EraserSettings
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth || 220;
  const h = canvas.clientHeight || 74;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  // Checkerboard background
  const sq = 8;
  ctx.fillStyle = 'rgba(128, 128, 128, 0.1)';
  for (let y = 0; y < h; y += sq) {
    for (let x = 0; x < w; x += sq) {
      if ((Math.floor(x / sq) + Math.floor(y / sq)) % 2 === 0) {
        ctx.fillRect(x, y, sq, sq);
      }
    }
  }

  // Draw sample ink onto an offscreen canvas so destination-out demonstrates exact transparent erasing!
  const off = document.createElement('canvas');
  off.width = Math.round(w * dpr);
  off.height = Math.round(h * dpr);
  const octx = off.getContext('2d');
  if (octx) {
    octx.setTransform(dpr, 0, 0, dpr, 0, 0);
    octx.strokeStyle = '#2B64F5';
    octx.lineWidth = 7;
    octx.lineCap = 'round';
    octx.beginPath();
    octx.moveTo(20, h * 0.34);
    octx.quadraticCurveTo(w * 0.5, h * 0.14, w - 20, h * 0.4);
    octx.stroke();

    octx.strokeStyle = '#E11D48';
    octx.lineWidth = 7;
    octx.beginPath();
    octx.moveTo(22, h * 0.68);
    octx.quadraticCurveTo(w * 0.5, h * 0.85, w - 22, h * 0.62);
    octx.stroke();

    const previewRadius = Math.min(28, Math.max(5, eraser.size / 2));
    if (eraser.mode === 'pixel') {
      octx.save();
      octx.globalCompositeOperation = 'destination-out';
      octx.globalAlpha = eraser.opacity;
      const feather = ((100 - eraser.hardness) / 100) * Math.max(2, previewRadius * 0.45);
      if (feather > 0.2) {
        octx.shadowColor = 'rgba(0,0,0,1)';
        octx.shadowBlur = feather;
      }
      octx.beginPath();
      octx.arc(w / 2, h / 2, previewRadius, 0, Math.PI * 2);
      octx.fill();
      octx.restore();
    } else {
      // Stroke mode: fade the top stroke as deleted when touched
      octx.clearRect(0, 0, w, h * 0.52);
    }
    ctx.drawImage(off, 0, 0, w, h);
  }

  // Draw the live circular cursor indicator at center
  const previewRadius = Math.min(28, Math.max(5, eraser.size / 2));
  ctx.save();
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, previewRadius, 0, Math.PI * 2);
  ctx.fillStyle = eraser.mode === 'stroke' ? 'rgba(225, 29, 72, 0.10)' : 'rgba(255, 255, 255, 0.35)';
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = eraser.mode === 'stroke' ? '#E11D48' : '#0F172A';
  if (eraser.mode === 'stroke') ctx.setLineDash([4, 3]);
  ctx.stroke();
  ctx.restore();
}

/**
 * Fast scanline Flood Fill (Paint Bucket) on an HTML5 Canvas ImageData.
 */
export function floodFillCanvas(
  canvas: HTMLCanvasElement,
  startX: number,
  startY: number,
  hexColor: string,
  opacity = 1,
  tolerance = 36
): boolean {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return false;
  const w = canvas.width;
  const h = canvas.height;
  const sx = Math.floor(startX);
  const sy = Math.floor(startY);
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) return false;

  const img = ctx.getImageData(0, 0, w, h);
  const data = img.data;

  const cleanHex = hexColor.replace('#', '');
  const fullHex =
    cleanHex.length === 3
      ? cleanHex
          .split('')
          .map((c) => c + c)
          .join('')
      : cleanHex.padEnd(6, '0');
  const fillR = parseInt(fullHex.slice(0, 2), 16) || 0;
  const fillG = parseInt(fullHex.slice(2, 4), 16) || 0;
  const fillB = parseInt(fullHex.slice(4, 6), 16) || 0;
  const fillA = Math.round(Math.max(0.05, Math.min(1, opacity)) * 255);

  const startIdx = (sy * w + sx) * 4;
  const targetR = data[startIdx];
  const targetG = data[startIdx + 1];
  const targetB = data[startIdx + 2];
  const targetA = data[startIdx + 3];

  if (
    Math.abs(targetR - fillR) < 4 &&
    Math.abs(targetG - fillG) < 4 &&
    Math.abs(targetB - fillB) < 4 &&
    Math.abs(targetA - fillA) < 4
  ) {
    return false;
  }

  const matches = (idx: number) =>
    Math.abs(data[idx] - targetR) <= tolerance &&
    Math.abs(data[idx + 1] - targetG) <= tolerance &&
    Math.abs(data[idx + 2] - targetB) <= tolerance &&
    Math.abs(data[idx + 3] - targetA) <= tolerance;

  const visited = new Uint8Array(w * h);
  const stack: number[] = [sx, sy];

  while (stack.length > 0) {
    const y = stack.pop()!;
    const x = stack.pop()!;
    let lx = x;
    while (lx >= 0 && !visited[y * w + lx] && matches((y * w + lx) * 4)) {
      lx--;
    }
    lx++;

    let spanAbove = false;
    let spanBelow = false;

    while (lx < w && !visited[y * w + lx] && matches((y * w + lx) * 4)) {
      const pIdx = y * w + lx;
      visited[pIdx] = 1;
      const dIdx = pIdx * 4;
      data[dIdx] = fillR;
      data[dIdx + 1] = fillG;
      data[dIdx + 2] = fillB;
      data[dIdx + 3] = fillA;

      if (y > 0) {
        const up = (y - 1) * w + lx;
        const upMatch = !visited[up] && matches(up * 4);
        if (!spanAbove && upMatch) {
          stack.push(lx, y - 1);
          spanAbove = true;
        } else if (spanAbove && !upMatch) {
          spanAbove = false;
        }
      }
      if (y < h - 1) {
        const dn = (y + 1) * w + lx;
        const dnMatch = !visited[dn] && matches(dn * 4);
        if (!spanBelow && dnMatch) {
          stack.push(lx, y + 1);
          spanBelow = true;
        } else if (spanBelow && !dnMatch) {
          spanBelow = false;
        }
      }
      lx++;
    }
  }

  ctx.putImageData(img, 0, 0);
  return true;
}
